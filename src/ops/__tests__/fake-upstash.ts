// The in-test Upstash REST server for seam 2 (SPEC-deploy, Testing Strategy). It runs the commands
// the ops module sends, through `/multi-exec` and `/pipeline`, with Upstash's reply shapes and status
// codes (https://upstash.com/docs/redis/features/restapi, read 2026-10-27). It keeps each key's expiry
// on the clock it is given, as Redis does: a key is gone once that clock passes its expiry, and an
// expiry already past deletes the key at once. It records every request, so a test can check what
// reached the store, or that nothing did.

export type UpstashRequest = {
  method: string;
  path: string;
  authorization: string | null;
  body: string;
};

export type FakeUpstash = {
  /** The server's origin, for KV_REST_API_URL. */
  url: string;
  /** The standard token, for KV_REST_API_TOKEN. The server answers 401 to a request without it. */
  token: string;
  /** Every request the server received, in the order received. */
  requests: UpstashRequest[];
  /** When a key expires, as Redis's EXPIRETIME gives it; null for a missing key or a key with no expiry. */
  expiresAt(key: string): Date | null;
  /** Stores a string at a key, as SET does, so that a test can give a key the wrong type or a starting value. */
  set(key: string, value: string): void;
  /** The string at a key, as GET gives it; null for a missing key. */
  get(key: string): string | null;
  stop(): Promise<void>;
};

type Value = { type: "string"; value: string } | { type: "list"; items: string[] };
type Entry = { value: Value; expiresAtMs?: number };
type Reply = { result: unknown } | { error: string };

/** Redis's reply to a command on a key of another type. */
const WRONGTYPE = "WRONGTYPE Operation against a key holding the wrong kind of value";
const NOT_AN_INTEGER = "ERR value is not an integer or out of range";

/** The commands the server runs, each with its argument count, the command name included. */
const ARITY: Record<string, { min: number; max: number }> = {
  RPUSH: { min: 3, max: Infinity },
  EXPIREAT: { min: 3, max: 3 },
  LRANGE: { min: 4, max: 4 },
  INCRBY: { min: 3, max: 3 },
};

/**
 * Starts the server on a free port of 127.0.0.1. Stop it when the test ends.
 *
 * @param now the store's clock. Pass the clock the test gives createOps(), so the function and the
 *   store agree on the time, as they do in production.
 */
export function startFakeUpstash({ now = () => new Date() }: { now?: () => Date } = {}): FakeUpstash {
  const token = "test";
  const requests: UpstashRequest[] = [];
  const keys = new Map<string, Entry>();

  /** The key's entry, or undefined once the store's clock has passed its expiry (Redis: now > when). */
  const live = (key: string): Entry | undefined => {
    const entry = keys.get(key);
    if (entry?.expiresAtMs !== undefined && now().getTime() > entry.expiresAtMs) {
      keys.delete(key);
      return undefined;
    }
    return entry;
  };

  const run = (command: string[]): Reply => {
    const [name, key, ...args] = command as [string, string, ...string[]];
    const entry = live(key);
    switch (name.toUpperCase()) {
      case "RPUSH": {
        if (entry && entry.value.type !== "list") return { error: WRONGTYPE };
        const items = entry?.value.type === "list" ? entry.value.items : [];
        items.push(...args);
        if (!entry) keys.set(key, { value: { type: "list", items } });
        return { result: items.length };
      }
      case "EXPIREAT": {
        const seconds = integer(args[0]);
        if (seconds === undefined) return { error: NOT_AN_INTEGER };
        if (!entry) return { result: 0 };
        const expiresAtMs = seconds * 1000;
        // Redis deletes a key at once when the expiry is already past (when <= now).
        if (expiresAtMs <= now().getTime()) keys.delete(key);
        else entry.expiresAtMs = expiresAtMs;
        return { result: 1 };
      }
      case "INCRBY": {
        // A missing key counts as 0; the new value is stored as a string, as in Redis.
        const increment = integer(args[0]);
        if (increment === undefined) return { error: NOT_AN_INTEGER };
        if (entry && entry.value.type !== "string") return { error: WRONGTYPE };
        const current = entry?.value.type === "string" ? integer(entry.value.value) : 0;
        if (current === undefined) return { error: NOT_AN_INTEGER };
        const value: Value = { type: "string", value: String(current + increment) };
        // The key keeps its expiry, as in Redis.
        if (entry) entry.value = value;
        else keys.set(key, { value });
        return { result: current + increment };
      }
      case "LRANGE": {
        const start = integer(args[0]);
        const stop = integer(args[1]);
        if (start === undefined || stop === undefined) return { error: NOT_AN_INTEGER };
        if (!entry) return { result: [] };
        if (entry.value.type !== "list") return { error: WRONGTYPE };
        const items = entry.value.items;
        const from = Math.max(start < 0 ? items.length + start : start, 0);
        const to = Math.min(stop < 0 ? items.length + stop : stop, items.length - 1);
        return { result: items.slice(from, to + 1) };
      }
      default:
        return { error: `ERR unknown command '${name}'` };
    }
  };

  /** Why Upstash would refuse a command before it runs: an unknown name or a wrong argument count. */
  const refusal = (command: unknown): string | undefined => {
    if (!Array.isArray(command) || command.length === 0) return "ERR syntax error";
    const name = String(command[0]).toUpperCase();
    const arity = ARITY[name];
    if (!arity) return `ERR unknown command '${command[0]}'`;
    if (command.length < arity.min || command.length > arity.max) {
      return `ERR wrong number of arguments for '${name.toLowerCase()}' command`;
    }
    return undefined;
  };

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      const authorization = request.headers.get("authorization");
      const body = await request.text();
      requests.push({ method: request.method, path, authorization, body });

      if (authorization !== `Bearer ${token}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
      if (request.method !== "POST" || (path !== "/multi-exec" && path !== "/pipeline")) {
        return Response.json({ error: "ERR unknown command" }, { status: 400 });
      }
      let commands: unknown;
      try {
        commands = JSON.parse(body);
      } catch {
        return Response.json({ error: "ERR syntax error" }, { status: 400 });
      }
      if (!Array.isArray(commands)) return Response.json({ error: "ERR syntax error" }, { status: 400 });
      const asStrings = (command: unknown[]) => command.map(String);

      if (path === "/multi-exec") {
        // A transaction with a refused command is discarded as a whole: one error, nothing runs.
        for (const command of commands) {
          const error = refusal(command);
          if (error) return Response.json({ error }, { status: 400 });
        }
        // Every command runs, also after one fails, as in Redis's EXEC.
        return Response.json(commands.map((command: unknown[]) => run(asStrings(command))));
      }
      // A pipeline runs each command on its own: a refused one gets its error, and the rest run.
      return Response.json(
        commands.map((command: unknown) => {
          const error = refusal(command);
          return error ? { error } : run(asStrings(command as unknown[]));
        }),
      );
    },
  });

  return {
    url: server.url.origin,
    token,
    requests,
    expiresAt(key) {
      const expiresAtMs = live(key)?.expiresAtMs;
      return expiresAtMs === undefined ? null : new Date(expiresAtMs);
    },
    set(key, value) {
      keys.set(key, { value: { type: "string", value } });
    },
    get(key) {
      const value = live(key)?.value;
      if (value?.type === "list") throw new Error(`The key ${key} holds a list, not a string.`);
      return value?.value ?? null;
    },
    stop: () => server.stop(true),
  };
}

/** A Redis integer argument, or undefined when the text is not one. */
function integer(text: string | undefined): number | undefined {
  return text !== undefined && /^-?\d+$/.test(text) ? Number(text) : undefined;
}
