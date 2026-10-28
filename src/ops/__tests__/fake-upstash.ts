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

type Value =
  | { type: "string"; value: string }
  | { type: "list"; items: string[] }
  | { type: "hash"; fields: Map<string, string> }
  | { type: "zset"; scores: Map<string, number> };
type Entry = { value: Value; expiresAtMs?: number };
type Reply = { result: unknown } | { error: string };

/** Redis's reply to a command on a key of another type. */
const WRONGTYPE = "WRONGTYPE Operation against a key holding the wrong kind of value";
const NOT_AN_INTEGER = "ERR value is not an integer or out of range";
const NOT_A_FLOAT = "ERR value is not a valid float";
const SYNTAX = "ERR syntax error";

/** The commands the server runs, each with its argument count, the command name included. */
const ARITY: Record<string, { min: number; max: number }> = {
  RPUSH: { min: 3, max: Infinity },
  EXPIREAT: { min: 3, max: 3 },
  LRANGE: { min: 4, max: 4 },
  INCRBY: { min: 3, max: 3 },
  HINCRBY: { min: 4, max: 4 },
  HGETALL: { min: 2, max: 2 },
  ZADD: { min: 4, max: Infinity },
  ZRANGE: { min: 4, max: 5 },
  SET: { min: 3, max: Infinity },
  PTTL: { min: 2, max: 2 },
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
        return { result: byIndex(entry.value.items, start, stop) };
      }
      case "HINCRBY": {
        // A missing hash or field counts as 0; the new value is stored as a string, as in Redis.
        const [field, by] = args as [string, string];
        const increment = integer(by);
        if (increment === undefined) return { error: NOT_AN_INTEGER };
        if (entry && entry.value.type !== "hash") return { error: WRONGTYPE };
        const fields = entry?.value.type === "hash" ? entry.value.fields : new Map<string, string>();
        const current = fields.has(field) ? integer(fields.get(field)) : 0;
        if (current === undefined) return { error: NOT_AN_INTEGER };
        fields.set(field, String(current + increment));
        if (!entry) keys.set(key, { value: { type: "hash", fields } });
        return { result: current + increment };
      }
      case "HGETALL": {
        // Upstash's REST API answers a hash as one flat list: field, value, field, value.
        if (!entry) return { result: [] };
        if (entry.value.type !== "hash") return { error: WRONGTYPE };
        return { result: [...entry.value.fields].flat() };
      }
      case "ZADD": {
        // ZADD key [GT] score member [score member …]: GT changes a member's score only to a greater
        // one, and still adds a new member. The other options are not used, so this server refuses them.
        const greaterOnly = args[0]?.toUpperCase() === "GT";
        const pairs = greaterOnly ? args.slice(1) : args;
        if (pairs.length === 0 || pairs.length % 2 !== 0) return { error: SYNTAX };
        if (entry && entry.value.type !== "zset") return { error: WRONGTYPE };
        const scores = entry?.value.type === "zset" ? entry.value.scores : new Map<string, number>();
        let added = 0;
        for (let index = 0; index < pairs.length; index += 2) {
          const score = float(pairs[index]);
          if (score === undefined) return { error: NOT_A_FLOAT };
          const member = pairs[index + 1]!;
          const current = scores.get(member);
          if (current === undefined) added++;
          if (current === undefined || !greaterOnly || score > current) scores.set(member, score);
        }
        if (!entry) keys.set(key, { value: { type: "zset", scores } });
        return { result: added };
      }
      case "ZRANGE": {
        // ZRANGE key start stop [WITHSCORES], by rank, lowest score first; scores come back as text.
        const [from, to, withScores] = args;
        const start = integer(from);
        const stop = integer(to);
        if (start === undefined || stop === undefined) return { error: NOT_AN_INTEGER };
        if (withScores !== undefined && withScores.toUpperCase() !== "WITHSCORES") return { error: SYNTAX };
        if (!entry) return { result: [] };
        if (entry.value.type !== "zset") return { error: WRONGTYPE };
        const ranked = [...entry.value.scores].sort(([a, x], [b, y]) => x - y || a.localeCompare(b));
        const members = byIndex(ranked, start, stop);
        return { result: withScores ? members.flatMap(([member, score]) => [member, String(score)]) : members.map(([member]) => member) };
      }
      case "SET": {
        // SET key value [NX] [EX seconds]: NX sets only a missing key, and answers null otherwise; EX
        // gives the key an expiry. Without NX, SET replaces a key of any type and its expiry, as in
        // Redis. The other options are not used, so this server refuses them.
        const [value, ...options] = args as [string, ...string[]];
        let onlyIfMissing = false;
        let expiresAtMs: number | undefined;
        for (let index = 0; index < options.length; index++) {
          const option = options[index]!.toUpperCase();
          if (option === "NX" && !onlyIfMissing) onlyIfMissing = true;
          else if (option === "EX" && expiresAtMs === undefined) {
            const seconds = integer(options[++index]);
            if (seconds === undefined) return { error: NOT_AN_INTEGER };
            if (seconds <= 0) return { error: "ERR invalid expire time in 'set' command" };
            expiresAtMs = now().getTime() + seconds * 1000;
          } else return { error: SYNTAX };
        }
        if (onlyIfMissing && entry) return { result: null };
        keys.set(key, { value: { type: "string", value }, expiresAtMs });
        return { result: "OK" };
      }
      case "PTTL": {
        // The milliseconds left before the key expires: -2 for a missing key, -1 for a key with no expiry.
        if (!entry) return { result: -2 };
        return { result: entry.expiresAtMs === undefined ? -1 : entry.expiresAtMs - now().getTime() };
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
      if (value !== undefined && value.type !== "string") throw new Error(`The key ${key} holds a ${value.type}, not a string.`);
      return value?.value ?? null;
    },
    stop: () => server.stop(true),
  };
}

/** A Redis integer argument, or undefined when the text is not one. */
function integer(text: string | undefined): number | undefined {
  return text !== undefined && /^-?\d+$/.test(text) ? Number(text) : undefined;
}

/** A Redis score argument, or undefined when the text is not a number. */
function float(text: string | undefined): number | undefined {
  return text !== undefined && /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : undefined;
}

/** The items from `start` to `stop`, both included, where a negative index counts from the end, as LRANGE and ZRANGE do. */
function byIndex<T>(items: T[], start: number, stop: number): T[] {
  const from = Math.max(start < 0 ? items.length + start : start, 0);
  const to = Math.min(stop < 0 ? items.length + stop : stop, items.length - 1);
  return items.slice(from, to + 1);
}
