// The store's key layout and expiry rules (SPEC-deploy, the key table; decision 0022), and the parts
// of the ops module that live in the store: the question log, the budget with the monthly limit's
// marker and probe, and the limit alerts' markers. The daily totals, which use the same keys, are in
// daily-totals.ts; the alerts' rules and their push are in alerts.ts. The calls themselves go through
// upstash-rest.ts.

import { utcDay, type Budget, type QuestionLog, type QuestionLogEntry } from "../chat/server/question-log";
import type { ChatTurnEvent } from "../chat/server/telemetry";
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
  return String((dayStart(day) + RETENTION_DAYS * DAY_MS) / 1000);
}

/** 00:00 UTC on a UTC day such as "2026-10-27", in Unix milliseconds. Any other text throws. */
function dayStart(day: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const start = match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : NaN;
  // "2026-02-30" matches, but it is not a day: Date.UTC() moves it to 2026-03-02.
  if (Number.isNaN(start) || utcDay(start) !== day) throw new RangeError("The date is not a UTC day.");
  return start;
}

/** The key of a limit alert's marker: `alert:<kind>:<period>`, where the period is a UTC day or a UTC month. */
const alertMarkerKey = (kind: string, period: string) => `alert:${kind}:${period}`;

/** How long a claim holds an alert's marker while its push is going out: 10 minutes. */
export const ALERT_CLAIM_MS = 600_000;

/**
 * When a limit alert's period ends, in Unix milliseconds: 00:00 UTC after a UTC day "2026-10-27", or
 * on the first day after a UTC month "2026-10". Any other text throws before any write.
 */
export function alertPeriodEnd(period: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return dayStart(period) + DAY_MS;
  const month = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  // Date.UTC() counts months from 0, so the month's own number, from 1, gives the next month.
  if (month) return Date.UTC(Number(month[1]), Number(month[2]), 1);
  throw new RangeError("The period is not a UTC day or month.");
}

/**
 * Claims a limit alert's marker before its push (SPEC-deploy, "Limit alerts"): `SET NX` with a
 * 10-minute expiry, so one function instance pushes and the others do not. If the push fails, or the
 * function stops before it finishes, the marker expires and a later event claims it again.
 *
 * Gives whether this call took the marker, and how long the marker lives from now: 10 minutes after
 * this claim, or what is left of the marker another claim holds, read in the same transaction.
 */
export async function claimAlertMarker(
  store: UpstashStore,
  kind: string,
  period: string,
  claimedAt: Date,
): Promise<{ claimed: boolean; heldForMs: number }> {
  const key = alertMarkerKey(kind, period);
  const [claim, left] = await store.transaction([
    ["SET", key, claimedAt.toISOString(), "NX", "EX", String(ALERT_CLAIM_MS / 1000)],
    ["PTTL", key],
  ]);
  // PTTL gives 0 in a key's last millisecond, and -1 for a key with no expiry. A marker always has
  // one, so a claim's 10 minutes stand in for anything but a count of milliseconds.
  const heldForMs = typeof left === "number" && left >= 0 ? left : ALERT_CLAIM_MS;
  return { claimed: claim === "OK", heldForMs };
}

/**
 * After a successful push, keeps the alert's marker until `endsAt`, the end of its period in Unix
 * milliseconds, so no other push of its kind goes out in it.
 */
export async function keepAlertMarker(store: UpstashStore, kind: string, period: string, endsAt: number): Promise<void> {
  await store.transaction([["EXPIREAT", alertMarkerKey(kind, period), String(endsAt / 1000)]]);
}

/**
 * The monthly limit's marker (SPEC-deploy, "The monthly limit"): when a turn last met Anthropic's
 * limit, as an ISO time. It expires at 00:00 UTC on the first day of the next month.
 */
const SPEND_LIMIT_MARKER = "limit:spend";

/** How long the budget refuses every turn after a turn meets Anthropic's limit, before a probe: 1 hour. */
const SPEND_LIMIT_PAUSE_MS = 3_600_000;

/** The key of the probe claim of the UTC hour of `at`: `limit:probe:<YYYY-MM-DDTHH>`. */
const probeClaimKey = (at: Date) => `limit:probe:${at.toISOString().slice(0, 13)}`;

/** How long an hour's probe claim lives: 2 hours, so it outlives its hour. */
const PROBE_CLAIM_SECONDS = 7_200;

/** Whether a turn met Anthropic's monthly limit during its run: the handler ends it with SPEND_LIMIT (SPEC-chat, The request, "Limits"). */
export const metSpendLimit = (event: ChatTurnEvent) => event.errorCode === "SPEND_LIMIT";

/**
 * The commands that `record()` adds to its transaction for the monthly limit (SPEC-deploy, "The
 * monthly limit"). Call it only for a turn that holds a reservation, so a turn that reached the model:
 *
 * - A turn that met Anthropic's limit sets the marker to `at`, until 00:00 UTC on the first day of the
 *   next month. A probe that met it again does the same, so the hour's pause starts again.
 * - The probe, when at least one of its model calls finished and none met the limit, deletes the
 *   marker, so the chat works again. A call that started and did not finish, after a server error, the
 *   deadline, an abort or a rate limit, says nothing about the limit. Only the probe deletes: a turn
 *   that reserved before the marker, and ends after it, says nothing about the limit now.
 * - Any other turn adds nothing, so the next hour's probe tries again.
 *
 * @param turn says whether the turn is the hour's probe (readReservation()), and whether at least
 *   one of its model calls finished: its token counts are known.
 */
export function spendLimitMarkerCommands(event: ChatTurnEvent, turn: { probe: boolean; callFinished: boolean }, at: Date): Command[] {
  if (metSpendLimit(event)) {
    const nextMonth = alertPeriodEnd(utcDay(at.getTime()).slice(0, 7));
    return [
      ["SET", SPEND_LIMIT_MARKER, at.toISOString()],
      ["EXPIREAT", SPEND_LIMIT_MARKER, String(nextMonth / 1000)],
    ];
  }
  if (turn.probe && turn.callFinished) return [["DEL", SPEND_LIMIT_MARKER]];
  return [];
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
 * A new reservation: `<day>/<uuid>`, `<day>/probe/<uuid>` for the hour's probe of the monthly limit,
 * or `<day>/uncounted/<uuid>` for an uncounted reservation (uncountedReservationOn()). The day is the
 * UTC day its cost counts on, so a turn that ends after 00:00 UTC settles on the day it reserved; the
 * uuid makes each reservation unique. RESERVATION and readReservation() are the one reader of this
 * text, so the writer and the reader stay side by side.
 */
const reservationOn = (day: string, kind: "turn" | "probe" | "uncounted" = "turn") =>
  `${day}/${kind === "turn" ? "" : `${kind}/`}${crypto.randomUUID()}`;

/**
 * The reservation of a turn that reserve() allowed although the store failed (SPEC-deploy, "The store
 * fails"). Its $0.90 never reached the day's cost, so the telemetry adds the turn's whole cost to the
 * day, not the cost less the $0.90 (daily-totals.ts). A `<day>/<uuid>` reservation here would take
 * $0.90 off the day that was never added, and the day's cost would come out low.
 */
export const uncountedReservationOn = (day: string) => reservationOn(day, "uncounted");

/** The start of every reservation: its UTC day, then its kind when it is not a plain turn's. */
const RESERVATION = /^(\d{4}-\d{2}-\d{2})\/(?:(probe|uncounted)\/)?/;

/**
 * The UTC day a reservation names, whether it is the hour's probe, and whether the day's cost counts
 * its $0.90: false only for an uncounted reservation. A text that is not one of this budget's
 * reservations throws.
 */
export function readReservation(reservation: string): { day: string; probe: boolean; counted: boolean } {
  const match = RESERVATION.exec(reservation);
  if (match === null) throw new RangeError("The reservation is not one that this store's budget gave.");
  return { day: match[1]!, probe: match[2] === "probe", counted: match[2] !== "uncounted" };
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
 * The budget in the store: the daily cap and the monthly limit (SPEC-deploy, "The daily cap" and "The
 * monthly limit").
 *
 * - `reserve()` adds the reservation to the day's cost, `qcost:<day>`, and reads the monthly limit's
 *   marker, in one transaction. The store adds atomically, so parallel calls, on one function instance
 *   or on many, never pass the cap together.
 * - While the marker is less than an hour old, it takes the reservation back and refuses with
 *   SPEND_LIMIT, so no model call is wasted. This budget then remembers when that hour ends and refuses
 *   until then with no store call.
 * - Once the marker is an hour old, one turn each UTC hour goes through as the probe: the first that
 *   claims `limit:probe:<hour>` with `SET NX`. The others take their reservation back and refuse with
 *   SPEND_LIMIT. The telemetry then deletes the marker or resets its time (spendLimitMarkerCommands()).
 *   While the marker stands, every refusal is SPEND_LIMIT, the probe's at the cap too: the month's
 *   limit pauses the chat for longer than the day's cap, and no daycap push goes out for it.
 * - With no marker, when the new total passes the cap, it takes the reservation back and refuses with
 *   DAILY_LIMIT. This budget then remembers the capped day and refuses later turns that day with no
 *   store call.
 * - The telemetry settles each reservation after its turn (daily-totals.ts). A reservation that is
 *   never settled stays counted for the day, which errs toward pausing.
 *
 * @param now says which UTC day and hour it is.
 * @param onCapped gets the UTC day of each DAILY_LIMIT refusal, for the daycap alert (alerts.ts). It
 *   decides itself whether the refusal needs a store call.
 * @param onTakeBackFailed gets the error of a take-back that failed, for its ops_error line and the
 *   storefail alert (alerts.ts). The refusal stands.
 */
export function upstashBudget(
  store: UpstashStore,
  now: () => Date,
  onCapped: (day: string) => Promise<void> = async () => {},
  onTakeBackFailed: (step: "take_back", error: unknown) => Promise<void> = async () => {},
): Budget {
  /** The UTC day on which this function instance saw the cap, if any. */
  let cappedDay: string | undefined;
  /** Until when, in Unix milliseconds, this function instance knows that the monthly limit's marker is less than an hour old. */
  let pausedUntil = 0;
  return {
    async reserve() {
      const at = now();
      const day = utcDay(at.getTime());
      if (at.getTime() < pausedUntil) return { ok: false, errorCode: "SPEND_LIMIT" };
      if (day === cappedDay) {
        await onCapped(day);
        return { ok: false, errorCode: "DAILY_LIMIT" };
      }
      const { total, spendLimitAt } = await reserveOnDay(store, day);
      if (spendLimitAt !== undefined) {
        const pauseEnds = spendLimitAt + SPEND_LIMIT_PAUSE_MS;
        const step = await atSpendLimit(store, at, pauseEnds, total);
        if (step === "probe") return { ok: true, reservation: reservationOn(day, "probe") };
        // Set before takeBack(): a turn that starts while it waits is refused with no store call.
        if (step === "pause") pausedUntil = pauseEnds;
        await takeBack(store, day, onTakeBackFailed);
        return { ok: false, errorCode: "SPEND_LIMIT" };
      }
      if (total <= limits.dailyCap) return { ok: true, reservation: reservationOn(day) };
      // Set before the await: a turn that starts while takeBack() waits is refused with no store call.
      cappedDay = day;
      await takeBack(store, day, onTakeBackFailed);
      await onCapped(day);
      return { ok: false, errorCode: "DAILY_LIMIT" };
    },
  };
}

/**
 * The reservation's transaction (SPEC-deploy, "The daily cap", step 1): it adds the reservation to the
 * day's cost, gives the key its expiry, and reads the monthly limit's marker. Gives the day's new
 * total, and when the marker says a turn last met the limit, in Unix milliseconds.
 */
async function reserveOnDay(store: UpstashStore, day: string): Promise<{ total: number; spendLimitAt: number | undefined }> {
  const [total, , marker] = await store.transaction([...dayCostCommands(day, limits.reservation), ["GET", SPEND_LIMIT_MARKER]]);
  return { total: wholeNumber(total), spendLimitAt: markerTime(marker) };
}

/**
 * The time a marker holds, in Unix milliseconds; undefined when there is no marker. A marker whose
 * text is not a time counts as an old one, so the hour's probe can still go through and clear it.
 */
function markerTime(reply: unknown): number | undefined {
  if (reply === null) return undefined;
  if (typeof reply !== "string") throw new UpstashError("Upstash /multi-exec: GET did not answer text", "BAD_REPLY");
  const at = Date.parse(reply);
  return Number.isNaN(at) ? 0 : at;
}

/**
 * What the budget does with a turn while the monthly limit's marker stands, at `at`:
 *
 * - "pause" until `pauseEnds`, an hour after a turn last met the limit;
 * - "probe" when the day's new `total` is within the cap and the turn claims the hour's probe, which
 *   is a store write (claimProbe());
 * - "refuse" when the day is past its cap, or another turn holds the hour's probe.
 */
async function atSpendLimit(store: UpstashStore, at: Date, pauseEnds: number, total: number): Promise<"pause" | "probe" | "refuse"> {
  if (at.getTime() < pauseEnds) return "pause";
  if (total > limits.dailyCap) return "refuse";
  const claimed = await claimProbe(store, at);
  return claimed ? "probe" : "refuse";
}

/**
 * Claims the probe of the UTC hour of `at` with `SET NX`, so one turn in the hour goes through on
 * all function instances together. The claim lives 2 hours. Gives whether this call took it.
 */
async function claimProbe(store: UpstashStore, at: Date): Promise<boolean> {
  const [claim] = await store.transaction([
    ["SET", probeClaimKey(at), at.toISOString(), "NX", "EX", String(PROBE_CLAIM_SECONDS)],
  ]);
  return claim === "OK";
}

/**
 * Takes a refused turn's reservation back from the day's cost, at the cap or at the monthly limit.
 * The refusal stands when this fails, and the amount left counted errs toward pausing, as an
 * unsettled reservation does (SPEC-deploy, "The daily cap", step 4). The failure goes to `failed`,
 * for its ops_error line.
 */
async function takeBack(store: UpstashStore, day: string, failed: (step: "take_back", error: unknown) => Promise<void>): Promise<void> {
  try {
    await addToDayCost(store, day, -limits.reservation);
  } catch (error) {
    // A refusal never becomes an allowed turn, so the failure is reported and nothing more.
    await failed("take_back", error);
  }
}

/**
 * Adds `amount`, in millionths of a dollar, to the day's cost in one transaction that also gives the
 * key its expiry, so the key never exists without it. Gives the new total.
 */
async function addToDayCost(store: UpstashStore, day: string, amount: number): Promise<number> {
  const [total] = await store.transaction(dayCostCommands(day, amount));
  return wholeNumber(total);
}

/** The commands that add `amount`, in millionths of a dollar, to the day's cost and give the key its expiry. */
function dayCostCommands(day: string, amount: number): Command[] {
  const key = dayCostKey(day);
  return [
    ["INCRBY", key, String(amount)],
    ["EXPIREAT", key, dayKeysExpireAt(day)],
  ];
}

/** INCRBY's reply, which must be a whole number. */
function wholeNumber(reply: unknown): number {
  if (typeof reply !== "number" || !Number.isSafeInteger(reply)) {
    throw new UpstashError("Upstash /multi-exec: INCRBY did not answer a whole number", "BAD_REPLY");
  }
  return reply;
}

/**
 * The entry's seven fields and nothing else. An object with more fields, such as a threadId, still
 * fits the type at run time, and the log keeps no field that SPEC-chat leaves out (decision 0020).
 */
function entryFields({ id, date, question, read, citations, removed, outcome }: QuestionLogEntry): QuestionLogEntry {
  return { id, date, question, read, citations, removed, outcome };
}
