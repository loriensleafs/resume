// The store calls (SPEC-deploy, "Store calls"; decision 0022): Upstash's REST API through `fetch`
// with `Authorization: Bearer`, and no package. Each write runs its commands as one transaction
// through `/multi-exec`. Each read runs through `/pipeline`, which the read-only token may also use;
// Upstash refuses `/multi-exec` to that token, even for reads (spike check 9, row 167). Each call has
// a time limit, and every failure, no answer included, is an UpstashError with a short code. The key
// layout and the expiry rules are in upstash.ts.

/** One Redis command, its name first. */
export type Command = [string, ...string[]];

/**
 * Where the store is: its REST address, its token, the fetch that reaches it, and how long each call
 * may take, in milliseconds (SPEC-deploy, "Store calls": each store call 2 s, `reserve()` 1 s).
 */
export type UpstashSettings = { url: string; token: string; fetch: typeof fetch; limitMs: number };

/** The store. Each call gives each command's result, in order. */
export type UpstashStore = {
  /** Runs the commands as one transaction: for writes, so a key never exists without its expiry. */
  transaction(commands: Command[]): Promise<unknown[]>;
  /** Runs the commands in order in one request, not atomically: for reads. */
  pipeline(commands: Command[]): Promise<unknown[]>;
};

/**
 * A store call the store refused, or a command in it that failed. Its `code` is one short word, the
 * HTTP status or Redis's error word, so a log line can name the failure without any text. Its message
 * holds the endpoint, the command's name and the code only: the store's own error text can repeat a
 * command's values (Redis's "unknown command" error quotes its first arguments).
 */
export class UpstashError extends Error {
  override readonly name = "UpstashError";
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

/**
 * The store at `settings.url`, reached through `settings.fetch`.
 *
 * Every call carries the token, so it goes only to an https address, or to a loopback address, where
 * the request never leaves the machine. With any other address, each call throws an UpstashError with
 * the code NOT_HTTPS before any request. It throws per call, not here, so that a wrong address is a
 * store failure, which never breaks an answer (SPEC-deploy, "The store fails").
 */
export function upstashStore(settings: UpstashSettings): UpstashStore {
  const base = safeBase(settings.url);
  const send = async (endpoint: Endpoint, commands: Command[]) => {
    // The message holds no address: a store address is not a value for a log line.
    if (base === undefined) throw new UpstashError("The store address is not https, so no request was sent", "NOT_HTTPS");
    return call({ ...settings, url: base }, endpoint, commands);
  };
  return {
    transaction: (commands) => send("/multi-exec", commands),
    pipeline: (commands) => send("/pipeline", commands),
  };
}

type Endpoint = "/multi-exec" | "/pipeline";

/**
 * The address without its trailing slashes; undefined when a secret that a request to it carries
 * would cross a network in clear text: the store's token, or the ntfy topic, whose name is a secret
 * (alerts.ts).
 */
export function safeBase(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  const safe = parsed.protocol === "https:" || (parsed.protocol === "http:" && isLoopback(parsed.hostname));
  return safe ? url.replace(/\/+$/, "") : undefined;
}

/**
 * A loopback host: 127.0.0.0/8, ::1 or localhost, which the W3C's Secure Contexts counts as
 * trustworthy. The in-test server is one; a local Upstash REST proxy would be another.
 */
function isLoopback(hostname: string): boolean {
  // The pattern matches 127.999.1.1 too, but new URL() refuses such a host first, so it never gets here.
  return /^127(\.\d{1,3}){3}$/.test(hostname) || hostname === "[::1]" || hostname === "localhost";
}

/**
 * Sends the commands to one endpoint and gives each command's result, in order. It throws an
 * UpstashError when the store refuses the call, and when any command fails: in a transaction the
 * other commands still run and the store answers 200, so each reply is read. It also throws one when
 * no answer comes: TIMEOUT once the call's time limit passes, so a slow store never holds an answer
 * longer, and NETWORK when the request itself fails.
 */
async function call(store: UpstashSettings, endpoint: Endpoint, commands: Command[]): Promise<unknown[]> {
  const signal = AbortSignal.timeout(store.limitMs);
  let response: Response;
  try {
    response = await store.fetch(`${store.url}${endpoint}`, {
      method: "POST",
      headers: { authorization: `Bearer ${store.token}`, "content-type": "application/json" },
      body: JSON.stringify(commands),
      // The store never redirects, and a redirect must never carry the token to another address.
      redirect: "error",
      signal,
    });
  } catch {
    throw noAnswer(endpoint, signal);
  }
  let replies: unknown;
  try {
    replies = await response.json();
  } catch {
    // The time limit also covers the body. A body that is not JSON is a bad reply, read below.
    if (signal.aborted) throw noAnswer(endpoint, signal);
  }
  if (!response.ok) {
    const code = `HTTP_${response.status}`;
    throw new UpstashError(`Upstash ${endpoint} answered ${code}`, code);
  }
  if (!Array.isArray(replies) || replies.length !== commands.length) {
    throw new UpstashError(`Upstash ${endpoint} did not answer each command`, "BAD_REPLY");
  }
  return replies.map((reply: unknown, index) => {
    if (typeof reply === "object" && reply !== null && "result" in reply) return reply.result;
    const code = errorWord(reply);
    throw new UpstashError(`Upstash ${endpoint}: ${commands[index]![0]} failed with ${code}`, code);
  });
}

/**
 * The error of a call that got no answer: TIMEOUT when its time limit passed, NETWORK when the request
 * failed. The fetch's own error is dropped, because Bun's connection error holds the whole address in
 * its message, and a store address is not a value for a log line.
 */
function noAnswer(endpoint: Endpoint, signal: AbortSignal): UpstashError {
  return signal.aborted
    ? new UpstashError(`Upstash ${endpoint} did not answer within its time limit`, "TIMEOUT")
    : new UpstashError(`Upstash ${endpoint} could not be reached`, "NETWORK");
}

/** Redis's error word from a reply `{ "error": "WRONGTYPE Operation against …" }`, or BAD_REPLY. */
function errorWord(reply: unknown): string {
  const error = typeof reply === "object" && reply !== null && "error" in reply ? reply.error : undefined;
  if (typeof error !== "string") return "BAD_REPLY";
  return /^[A-Z]+\b/.exec(error)?.[0] ?? "ERR";
}
