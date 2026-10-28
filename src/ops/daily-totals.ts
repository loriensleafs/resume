// The daily totals in the store (SPEC-deploy, the key table, "Cost estimate" and "Which usage a turn
// settles with"): the telemetry that adds each turn to its day's totals and settles its reservation,
// and the read of the totals. The keys and their expiry rules are in upstash.ts; the prices and the
// reservation are in limits.ts.

import type { Telemetry } from "../chat/server/question-log";
import type { ChatTurnEvent } from "../chat/server/telemetry";
import * as limits from "./limits";
import type { TurnTokens } from "./limits";
import {
  LONGEST,
  dayCostKey,
  dayKeysExpireAt,
  dayLongestKey,
  dayStatsKey,
  keptDays,
  monthCostKey,
  monthKeysExpireAt,
  reservationDay,
} from "./upstash";
import { UpstashError, type Command, type UpstashStore } from "./upstash-rest";

/** The outcomes of a turn whose model calls all finished. */
const FINISHED_OUTCOMES = new Set<ChatTurnEvent["outcome"]>(["answered", "refusal:out-of-scope", "refusal:not-covered"]);

/** The outcomes of a turn that reached the model: the outcomes the totals count. */
const OUTCOMES = ["answered", "refusal:out-of-scope", "refusal:not-covered", "stopped", "error", "limit"] as const;

/** The counts of a turn that its day adds up, the summed duration among them. */
const TURN_COUNTS = ["modelCalls", "reads", "citations", "removed", "durationMs"] as const;

/** The five token counts (SPEC-deploy, "Cost estimate"). */
const TOKEN_COUNTS = ["inputTokens", "cachedInputTokens", "cacheWriteTokens", "cacheWrite1hTokens", "outputTokens"] as const;

/** What the store keeps for one UTC day: how its chat turns ended, the tokens they used and how long they took. */
export type DailyTotals = {
  date: string; // the UTC day, "2026-10-27"
  turns: Record<(typeof OUTCOMES)[number], number>; // the turns that reached the model, by outcome
  modelCalls: number;
  reads: number;
  citations: number;
  removed: number; // markers the check removed
  inputTokens: number; // uncached input only
  cachedInputTokens: number; // cache reads
  cacheWriteTokens: number; // all cache writes, the 1-hour ones included
  cacheWrite1hTokens: number;
  outputTokens: number;
  errors: Record<string, number>; // turns by error code
  durationMs: number; // the turns' summed duration
  longestDurationMs: number; // the day's longest turn
};

/**
 * The telemetry in the store. A turn with a reservation reached the model: in one transaction,
 * `record()` adds the turn to its day's totals, replaces its reservation with its cost or keeps it,
 * and adds that cost to the month. A turn without one, a rejected request or a refusal at the cap or
 * the monthly limit, writes nothing, so a flood of bad requests costs the store nothing. Printing the
 * chat_turn line is createOps()'s part.
 *
 * @param onMonthCost gets the month's estimate after each turn that adds to it, from the same
 *   transaction's reply, for the spend75 alert (alerts.ts).
 */
export function upstashTelemetry(
  store: UpstashStore,
  onMonthCost: (day: string, monthCost: number) => Promise<void> = async () => {},
): Telemetry {
  return {
    async record(event, reservation) {
      if (reservation === undefined) return;
      const day = reservationDay(reservation);
      const expiresAt = dayKeysExpireAt(day);
      const tokens = knownTokens(event);
      const cost = settledCost(event, tokens);
      const stats = dayStatsKey(day);
      const longest = dayLongestKey(day);
      const month = monthCostKey(day);
      // The settlement replaces the reservation on the day it counts on with the turn's cost.
      const settlement = cost - limits.reservation;
      const commands: Command[] = [
        ...statsIncrements(event, tokens).map(([field, amount]): Command => ["HINCRBY", stats, field, String(amount)]),
        ["EXPIREAT", stats, expiresAt],
        ["ZADD", longest, "GT", String(wholeCount(event.durationMs)), LONGEST],
        ["EXPIREAT", longest, expiresAt],
        ...(settlement === 0
          ? []
          : ([
              ["INCRBY", dayCostKey(day), String(settlement)],
              ["EXPIREAT", dayCostKey(day), expiresAt],
            ] satisfies Command[])),
      ];
      const monthReply = commands.length;
      commands.push(["INCRBY", month, String(cost)], ["EXPIREAT", month, monthKeysExpireAt(day)]);
      const monthCost = (await store.transaction(commands))[monthReply];
      if (typeof monthCost !== "number" || !Number.isSafeInteger(monthCost)) {
        throw new UpstashError("Upstash /multi-exec: INCRBY did not answer a whole number", "BAD_REPLY");
      }
      await onMonthCost(day, monthCost);
    },
  };
}

/**
 * The daily totals of the last `days` UTC days, today included, newest first: one for each day, with
 * zeros for a day with no turn. One `/pipeline` request reads them all.
 *
 * @param now says which UTC day is today.
 */
export function upstashTotals(store: UpstashStore, now: () => Date): (days: number) => Promise<DailyTotals[]> {
  return async (days) => {
    const dates = keptDays(now, days);
    if (dates.length === 0) return [];
    const replies = await store.pipeline(
      dates.flatMap((day): Command[] => [
        ["HGETALL", dayStatsKey(day)],
        ["ZRANGE", dayLongestKey(day), "0", "-1", "WITHSCORES"],
      ]),
    );
    return dates.map((date, index) => dailyTotals(date, replies[2 * index], replies[2 * index + 1]));
  };
}

/**
 * What a turn costs once it ends (SPEC-deploy, "Which usage a turn settles with"). A turn whose model
 * calls all finished, an answer or a refusal with no error code, costs the estimate of its summed
 * usage. Any other turn keeps its whole reservation, because its last call's usage is not known: a
 * stopped turn, a DEADLINE, MAX_TOKENS or SERVER_ERROR turn, a broken stream, a turn that met the
 * monthly limit, and a turn whose counts are null or cannot be true.
 */
function settledCost(event: ChatTurnEvent, tokens: TurnTokens | undefined): number {
  const finished = FINISHED_OUTCOMES.has(event.outcome) && event.errorCode === null;
  return finished && tokens ? limits.estimatedCost(tokens) : limits.reservation;
}

/**
 * What one turn adds to its day's hash, field by field: its token counts only when they are known.
 * A field it adds nothing to gets no command.
 */
function statsIncrements(event: ChatTurnEvent, tokens: TurnTokens | undefined): [field: string, amount: number][] {
  const increments: [field: string, amount: number][] = [[`outcome:${event.outcome}`, 1]];
  if (event.errorCode !== null) increments.push([`errorCode:${codeWord(event.errorCode)}`, 1]);
  for (const count of TURN_COUNTS) increments.push([count, wholeCount(event[count])]);
  if (tokens) {
    for (const count of TOKEN_COUNTS) increments.push([count, tokens[count]]);
  }
  return increments.filter(([, amount]) => amount > 0);
}

/**
 * The turn's five token counts, when they are known: each a whole number, none negative, and no more
 * 1-hour writes than writes. They are null when no model call finished. Counts that cannot be true
 * say the usage is not known, so they add nothing to the totals and the turn keeps its reservation.
 */
function knownTokens(event: ChatTurnEvent): TurnTokens | undefined {
  const { inputTokens, cachedInputTokens, cacheWriteTokens, cacheWrite1hTokens, outputTokens } = event;
  if (
    !isCount(inputTokens) ||
    !isCount(cachedInputTokens) ||
    !isCount(cacheWriteTokens) ||
    !isCount(cacheWrite1hTokens) ||
    !isCount(outputTokens) ||
    cacheWrite1hTokens > cacheWriteTokens
  ) {
    return undefined;
  }
  return { inputTokens, cachedInputTokens, cacheWriteTokens, cacheWrite1hTokens, outputTokens };
}

/** A whole number of at least 0. */
const isCount = (value: number | null): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

/** A count as a whole number of at least 0; anything else counts as 0, because HINCRBY takes whole numbers only. */
const wholeCount = (value: number) => (Number.isSafeInteger(value) && value > 0 ? value : 0);

/**
 * An error code as one short word for a hash field. The chat module sends only its own codes and the
 * model API's, never a message; any other text counts as OTHER, so no text reaches a field name.
 */
const codeWord = (code: string) => (/^[A-Za-z0-9_]{1,32}$/.test(code) ? code : "OTHER");

/** One day's totals from its hash and its sorted set, as the store answers them: flat lists of text. */
function dailyTotals(date: string, stats: unknown, longest: unknown): DailyTotals {
  const fields = textList(stats);
  const counts = new Map<string, number>();
  for (let index = 0; index + 1 < fields.length; index += 2) counts.set(fields[index]!, Number(fields[index + 1]));
  const count = (field: string) => counts.get(field) ?? 0;
  const errors = [...counts].filter(([field]) => field.startsWith("errorCode:"));
  return {
    date,
    turns: Object.fromEntries(OUTCOMES.map((outcome) => [outcome, count(`outcome:${outcome}`)])) as DailyTotals["turns"],
    modelCalls: count("modelCalls"),
    reads: count("reads"),
    citations: count("citations"),
    removed: count("removed"),
    inputTokens: count("inputTokens"),
    cachedInputTokens: count("cachedInputTokens"),
    cacheWriteTokens: count("cacheWriteTokens"),
    cacheWrite1hTokens: count("cacheWrite1hTokens"),
    outputTokens: count("outputTokens"),
    // Object.fromEntries() defines each code as the object's own field, also a code such as "__proto__".
    errors: Object.fromEntries(errors.map(([field, amount]) => [field.slice("errorCode:".length), amount])),
    durationMs: count("durationMs"),
    // ZRANGE … WITHSCORES answers [member, score]: the one member's score is the day's longest duration.
    longestDurationMs: Number(textList(longest)[1] ?? 0),
  };
}

/**
 * A reply that must be a flat list, as HGETALL and ZRANGE give, each item as text. Upstash's REST API
 * gives the Redis reply in RESP2's form, where a score is text; a number is taken too, because no run
 * has shown the shape (research 12, spike check 9, saw the commands run). Anything else is a bad reply.
 */
function textList(reply: unknown): string[] {
  if (Array.isArray(reply) && reply.every((item) => typeof item === "string" || typeof item === "number")) {
    return reply.map(String);
  }
  throw new UpstashError("Upstash /pipeline: a read did not answer a list", "BAD_REPLY");
}
