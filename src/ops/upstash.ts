// The store's key layout and expiry rules (SPEC-deploy, the key table; decision 0022), and the parts
// of the ops module that live in the store: the question log and the budget. The daily totals, which
// use the same keys, are in daily-totals.ts. The calls themselves go through upstash-rest.ts.

import { utcDay, type Budget, type QuestionLog, type QuestionLogEntry } from "../chat/server/question-log";
import * as limits from "./limits";
import { UpstashError, type Command, type UpstashStore } from "./upstash-rest";

const DAY_MS = 86_400_000;

/** The store keeps a day's keys until 00:00 UTC on the 90th day after it, then deletes them itself (decision 0022). */
const RETENTION_DAYS = 90;

/** The key of a day's question-log list. */
const questionLogKey = (day: string) => `qlog:${day}`;

/** The key of a day's cost with its open reservations, in millionths of a dollar. */
export const dayCostKey = (day: string) => `qcost:${day}`;

/** The key of the settled cost of the month of `day`, in millionths of a dollar: `qcost:<YYYY-MM>`. */
export const monthCostKey = (day: string) => `qcost:${day.slice(0, 7)}`;

/** The key of a day's totals: a hash of counts (`qstats`). */
export const dayStatsKey = (day: string) => `qstats:${day}`;

/** The one member of a day's `qslow` sorted set; its score is the day's longest duration. */
export const LONGEST = "longest";

/** The key of a day's longest duration: a sorted set whose one member is LONGEST (`qslow`). */
export const dayLongestKey = (day: string) => `qslow:${day}`;

/**
 * When a day's keys expire, in Unix seconds for `EXPIREAT`: 00:00 UTC on the 90th day after the day.
 * A text that is not a UTC day such as "2026-10-27" has no expiry, so it throws before any write.
 */
export function dayKeysExpireAt(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const start = match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : NaN;
  // "2026-02-30" matches, but it is not a day: Date.UTC() moves it to 2026-03-02.
  if (Number.isNaN(start) || utcDay(start) !== day) throw new RangeError("The date is not a UTC day.");
  return String((start + RETENTION_DAYS * DAY_MS) / 1000);
}

/**
 * When the keys of the month of `day`, a UTC day, expire, in Unix seconds for `EXPIREAT`: 90 days
 * after the month ends, at 00:00 UTC on the first day of the next month.
 */
export function monthKeysExpireAt(day: string): string {
  // Date.UTC() counts months from 0, so the month's own number, from 1, gives the next month.
  const end = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 1);
  return String((end + RETENTION_DAYS * DAY_MS) / 1000);
}

/**
 * The last `days` UTC days, today included, newest first. The store keeps no day older than the
 * retention, so a read of one would only cost a command.
 */
export function keptDays(now: () => Date, days: number): string[] {
  const today = now().getTime();
  return Array.from({ length: Math.max(0, Math.min(days, RETENTION_DAYS)) }, (_, back) => utcDay(today - back * DAY_MS));
}

/**
 * A new reservation. It names the UTC day its cost counts on, so a turn that ends after 00:00 UTC
 * settles on the day it reserved; the rest makes each reservation unique.
 */
const reservationOn = (day: string) => `${day}/${crypto.randomUUID()}`;

/** The UTC day a reservation names. A text that is not one of this budget's reservations throws. */
export function reservationDay(reservation: string): string {
  const day = /^(\d{4}-\d{2}-\d{2})\//.exec(reservation)?.[1];
  if (day === undefined) throw new RangeError("The reservation is not one that this store's budget gave.");
  return day;
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
      await store.transaction([
        ["RPUSH", key, JSON.stringify(entryFields(entry))],
        ["EXPIREAT", key, expiresAt],
      ]);
    },
    async list(days) {
      const keys = keptDays(now, days).map(questionLogKey);
      if (keys.length === 0) return [];
      const lists = await store.pipeline(keys.map((key): Command => ["LRANGE", key, "0", "-1"]));
      // A day's list holds its entries in the order appended; the spec fixes no order within a day,
      // and this log, like the in-memory one, puts the later entry first.
      return lists.flatMap((list) => (list as string[]).map((json) => JSON.parse(json) as QuestionLogEntry).reverse());
    },
  };
}

/**
 * The budget in the store: the daily cap (SPEC-deploy, "The daily cap").
 *
 * - `reserve()` adds the reservation to the day's cost, `qcost:<day>`, in one transaction. The store
 *   adds atomically, so parallel calls, on one function instance or on many, never pass the cap together.
 * - When the new total passes the cap, it takes the reservation back and refuses with DAILY_LIMIT. This
 *   budget then remembers the capped day and refuses later turns that day with no store call.
 * - The telemetry settles each reservation after its turn (daily-totals.ts). A reservation that is
 *   never settled stays counted for the day, which errs toward pausing.
 *
 * @param now says which UTC day is today.
 */
export function upstashBudget(store: UpstashStore, now: () => Date): Budget {
  /** The UTC day on which this function instance saw the cap, if any. */
  let cappedDay: string | undefined;
  return {
    async reserve() {
      const day = utcDay(now().getTime());
      if (day === cappedDay) return { ok: false, errorCode: "DAILY_LIMIT" };
      const total = await addToDayCost(store, day, limits.reservation);
      if (total <= limits.dailyCap) return { ok: true, reservation: reservationOn(day) };
      // Set before the await: a turn that starts while takeBack() waits is refused with no store call.
      cappedDay = day;
      await takeBack(store, day);
      return { ok: false, errorCode: "DAILY_LIMIT" };
    },
  };
}

/**
 * Takes a refused turn's reservation back from the day's cost. The refusal stands when this fails:
 * the cap was passed, and the amount left counted errs toward pausing, as an unsettled reservation
 * does (SPEC-deploy, "The daily cap", step 4). D15 prints the failure as an ops_error line.
 */
async function takeBack(store: UpstashStore, day: string): Promise<void> {
  try {
    await addToDayCost(store, day, -limits.reservation);
  } catch {
    // Nothing more to do here until D15: a refusal never becomes an allowed turn.
  }
}

/**
 * Adds `amount`, in millionths of a dollar, to the day's cost in one transaction that also gives the
 * key its expiry, so the key never exists without it. Gives the new total.
 */
async function addToDayCost(store: UpstashStore, day: string, amount: number): Promise<number> {
  const key = dayCostKey(day);
  const [total] = await store.transaction([
    ["INCRBY", key, String(amount)],
    ["EXPIREAT", key, dayKeysExpireAt(day)],
  ]);
  if (typeof total !== "number" || !Number.isSafeInteger(total)) {
    throw new UpstashError("Upstash /multi-exec: INCRBY did not answer a whole number", "BAD_REPLY");
  }
  return total;
}

/**
 * The entry's seven fields and nothing else. An object with more fields, such as a threadId, still
 * fits the type at run time, and the log keeps no field that SPEC-chat leaves out (decision 0020).
 */
function entryFields({ id, date, question, read, citations, removed, outcome }: QuestionLogEntry): QuestionLogEntry {
  return { id, date, question, read, citations, removed, outcome };
}
