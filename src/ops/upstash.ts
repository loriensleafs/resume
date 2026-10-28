// The store calls (SPEC-deploy, "Store calls"; decision 0022): Upstash's REST API through `fetch`
// with `Authorization: Bearer`, and no package. Each write runs its commands as one transaction
// through `/multi-exec`. Each read runs through `/pipeline`, which the read-only token may also use;
// Upstash refuses `/multi-exec` to that token, even for reads (spike check 9, row 167). This file also
// holds the key layout and the expiry rules.

import { utcDay, type QuestionLog, type QuestionLogEntry } from "../chat/server/question-log";

/** The store: its REST address and token, and the fetch that reaches it. */
export type UpstashStore = { url: string; token: string; fetch: typeof fetch };

/** One Redis command, its name first. */
type Command = [string, ...string[]];

const DAY_MS = 86_400_000;

/** The store keeps a day's keys until 00:00 UTC on the 90th day after it, then deletes them itself (decision 0022). */
const RETENTION_DAYS = 90;

/** The key of a day's question-log list. */
const questionLogKey = (day: string) => `qlog:${day}`;

/**
 * When a day's keys expire, in Unix seconds for `EXPIREAT`: 00:00 UTC on the 90th day after the day.
 * A text that is not a UTC day such as "2026-10-27" has no expiry, so it throws before any write.
 */
function dayKeysExpireAt(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const start = match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : NaN;
  // "2026-02-30" matches, but it is not a day: Date.UTC() moves it to 2026-03-02.
  if (Number.isNaN(start) || utcDay(start) !== day) throw new RangeError("The entry's date is not a UTC day.");
  return String((start + RETENTION_DAYS * DAY_MS) / 1000);
}

/**
 * The question log in the store: one list of entry JSON per UTC day, `qlog:<day>`.
 *
 * @param now says which UTC day is today, for `list(days)`.
 */
export function upstashQuestionLog(store: UpstashStore, now: () => Date): QuestionLog {
  return {
    async append(entry) {
      const key = questionLogKey(entry.date);
      const expiresAt = dayKeysExpireAt(entry.date);
      // One transaction, so the list never exists without its expiry.
      await transaction(store, [
        ["RPUSH", key, JSON.stringify(entryFields(entry))],
        ["EXPIREAT", key, expiresAt],
      ]);
    },
    async list(days) {
      const today = now().getTime();
      // The store keeps no day older than the retention, so reading one would only cost a command.
      const kept = Math.min(days, RETENTION_DAYS);
      const keys: string[] = [];
      for (let back = 0; back < kept; back++) keys.push(questionLogKey(utcDay(today - back * DAY_MS)));
      if (keys.length === 0) return [];
      const lists = await pipeline(
        store,
        keys.map((key): Command => ["LRANGE", key, "0", "-1"]),
      );
      // A day's list holds its entries in the order appended; the spec fixes no order within a day,
      // and this log, like the in-memory one, puts the later entry first.
      return lists.flatMap((list) => (list as string[]).map((json) => JSON.parse(json) as QuestionLogEntry).reverse());
    },
  };
}

/**
 * The entry's seven fields and nothing else. An object with more fields, such as a threadId, still
 * fits the type at run time, and the log keeps no field that SPEC-chat leaves out (decision 0020).
 */
function entryFields({ id, date, question, read, citations, removed, outcome }: QuestionLogEntry): QuestionLogEntry {
  return { id, date, question, read, citations, removed, outcome };
}

/** Runs the commands as one transaction. */
const transaction = (store: UpstashStore, commands: Command[]) => call(store, "/multi-exec", commands);

/** Runs the commands in order in one request, not atomically: for reads. */
const pipeline = (store: UpstashStore, commands: Command[]) => call(store, "/pipeline", commands);

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
 * Sends the commands to one endpoint and gives each command's result, in order. It throws an
 * UpstashError when the store refuses the call, and when any command fails: in a transaction the
 * other commands still run and the store answers 200, so each reply is read.
 */
async function call(store: UpstashStore, endpoint: "/multi-exec" | "/pipeline", commands: Command[]): Promise<unknown[]> {
  const response = await store.fetch(`${store.url.replace(/\/+$/, "")}${endpoint}`, {
    method: "POST",
    headers: { authorization: `Bearer ${store.token}`, "content-type": "application/json" },
    body: JSON.stringify(commands),
  });
  const replies: unknown = await response.json().catch(() => undefined);
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

/** Redis's error word from a reply `{ "error": "WRONGTYPE Operation against …" }`, or BAD_REPLY. */
function errorWord(reply: unknown): string {
  const error = typeof reply === "object" && reply !== null && "error" in reply ? reply.error : undefined;
  if (typeof error !== "string") return "BAD_REPLY";
  return /^[A-Z]+\b/.exec(error)?.[0] ?? "ERR";
}
