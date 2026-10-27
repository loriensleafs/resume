// PROTOTYPE (deploy spike, D4): Upstash REST calls for checks 6, 7 and 9, with fetch and `Authorization: Bearer`,
// as SPEC-deploy's "Store calls" says, so the spike adds no package. https://upstash.com/docs/redis/features/restapi
// The values of KV_REST_API_URL, KV_REST_API_TOKEN and KV_REST_API_READ_ONLY_TOKEN never leave this file: callers
// get the HTTP status, the results and, for an error, its first word only (such as NOPERM), never its text.
// Every key starts with `spike:` and gets an expiry, so nothing stays in the database.

/** The list of calls that reached /api/cron/health (check 6): the newest 50, kept 7 days. */
export const CRON_CALLS_KEY = "spike:cron:calls";

export type Token = "standard" | "readOnly";
export type Command = (string | number)[];
/** One command's reply. `error` is the error's first word, such as "NOPERM" or "ERR". */
export type Reply = { result?: unknown; error?: string };
/** A call's outcome: the HTTP status (0 when the call failed before an answer), and the replies or one error word. */
export type Outcome = { status: number; replies: Reply[]; error?: string };

/** Whether each store variable is set: booleans only. */
export const storeConfig = () => ({
  url: Boolean(process.env.KV_REST_API_URL),
  token: Boolean(process.env.KV_REST_API_TOKEN),
  readOnlyToken: Boolean(process.env.KV_REST_API_READ_ONLY_TOKEN),
});

/** An error's first word, letters and underscores only, so no free text from Upstash reaches a check line. */
const errorWord = (error: unknown) => String(error).trim().split(/\s/)[0]!.replace(/[^A-Za-z_]/g, "").slice(0, 24) || "ERROR";

const reply = (value: unknown): Reply => {
  const r = (value ?? {}) as { result?: unknown; error?: unknown };
  return r.error === undefined ? { result: r.result } : { error: errorWord(r.error) };
};

/**
 * POSTs `body` to the store at `path`: "/" for one command, "/pipeline" or "/multi-exec" for a list of commands.
 * The time limit is 5 s: the spike asks what the platform does, so a slow store must not look like a lost write.
 */
async function call(token: Token, path: "/" | "/pipeline" | "/multi-exec", body: unknown): Promise<Outcome> {
  const base = process.env.KV_REST_API_URL;
  const secret = token === "standard" ? process.env.KV_REST_API_TOKEN : process.env.KV_REST_API_READ_ONLY_TOKEN;
  if (!base || !secret) return { status: 0, replies: [], error: "missing_config" };
  try {
    const res = await fetch(new URL(path, base), {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
    const json = (await res.json().catch(() => null)) as unknown;
    if (Array.isArray(json)) return { status: res.status, replies: json.map(reply) };
    const one = reply(json);
    return one.error === undefined ? { status: res.status, replies: [one] } : { status: res.status, replies: [], error: one.error };
  } catch (error) {
    return { status: 0, replies: [], error: (error as Error).name === "TimeoutError" ? "timeout" : "fetch_failed" };
  }
}

/** One command. */
export const command = (token: Token, cmd: Command) => call(token, "/", cmd);
/** Several commands in order, not atomic. */
export const pipeline = (token: Token, cmds: Command[]) => call(token, "/pipeline", cmds);
/** Several commands as one transaction (MULTI ... EXEC), so a key never exists without its expiry. */
export const multiExec = (token: Token, cmds: Command[]) => call(token, "/multi-exec", cmds);

/** True when every reply holds a result and no error. */
export const allOk = (outcome: Outcome, count: number) =>
  outcome.status === 200 && outcome.error === undefined && outcome.replies.length === count && outcome.replies.every((r) => r.error === undefined);

/**
 * The deployment URL and the Git branch URL: the hosts that Standard Protection guards, so only a caller with the
 * bypass secret (the spike workflow) reaches them. The spike's store modes answer only there; the production
 * address is public. The same pattern as check.ts's PROTECTED_HOST.
 */
const PROTECTED_HOST = /^resume-deploy-spike-[a-z0-9-]+-peterkloss\.vercel\.app$/;

/** The hosts a request names: its Host header, x-forwarded-host and its URL. Each cut to a safe length and set. */
export function requestHosts(request: Request) {
  return {
    host: safeText(request.headers.get("host"), 100),
    forwardedHost: safeText(request.headers.get("x-forwarded-host"), 100),
    urlHost: safeText(new URL(request.url).host, 100),
  };
}

/** Whether every host the request names is a protected one. */
export function onProtectedHost(request: Request): boolean {
  const { host, forwardedHost, urlHost } = requestHosts(request);
  return [host, forwardedHost ?? host, urlHost].every((h) => h !== null && PROTECTED_HOST.test(h));
}

/** A header value fit for a record or a check line: printable letters, digits and a few signs, at most `max` long. */
export function safeText(value: string | null, max: number): string | null {
  return value === null ? null : value.replace(/[^A-Za-z0-9.:*/ ,_-]/g, "?").slice(0, max);
}
