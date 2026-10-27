// The question log, the budget and the telemetry (SPEC-chat, Question log): the three interfaces
// that SPEC-deploy implements, so the chat imports nothing from the deploy module, and the in-memory
// versions that the tests and the evals pass as ChatDeps. No entry holds an IP address, threadId,
// scope, audience, cookie or other saved-session data (decision 0020).

import type { ChatTurnEvent } from "./telemetry";

export type QuestionLogEntry = {
  id: string;           // random, not the threadId
  date: string;         // the UTC day only, "2026-10-27"
  question: string;     // the visitor's text as sent; a pasted posting included
  read: string[];       // source and passage ids read this turn
  citations: string[];  // kept citations
  removed: number;      // markers the check removed
  outcome: "answered" | "refusal:out-of-scope" | "refusal:not-covered" | "stopped" | "error" | "limit";
};

export type QuestionLog = {
  append(entry: QuestionLogEntry): Promise<void>;
  /** The entries of the last `days` UTC days, today included, newest first. */
  list(days: number): Promise<QuestionLogEntry[]>;
};
export type Budget = {
  reserve(): Promise<{ ok: true; reservation: string } | { ok: false; errorCode: "DAILY_LIMIT" | "SPEND_LIMIT" }>;
};
export type Telemetry = { record(event: ChatTurnEvent, reservation?: string): Promise<void> };

const DAY_MS = 86_400_000;

/** The UTC day of a time, as "2026-10-27". */
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A question log in memory. `now` says which UTC day is today. */
export function inMemoryQuestionLog(now: () => Date): QuestionLog {
  const entries: QuestionLogEntry[] = [];
  return {
    async append(entry) {
      entries.push(entry);
    },
    async list(days) {
      const today = now().getTime();
      const newestFirst: QuestionLogEntry[] = [];
      for (let back = 0; back < days; back++) {
        const day = utcDay(today - back * DAY_MS);
        newestFirst.push(...entries.filter((entry) => entry.date === day).reverse());
      }
      return newestFirst;
    },
  };
}

/** A budget in memory: it allows every turn, or, given a code, refuses every turn with it. */
export function inMemoryBudget(refuse?: "DAILY_LIMIT" | "SPEND_LIMIT"): Budget {
  return {
    async reserve() {
      return refuse ? { ok: false, errorCode: refuse } : { ok: true, reservation: crypto.randomUUID() };
    },
  };
}

/** Telemetry in memory: it keeps each chat_turn event, in the order recorded, for tests and the evals' review file. */
export function inMemoryTelemetry(): Telemetry & { readonly events: readonly ChatTurnEvent[] } {
  const events: ChatTurnEvent[] = [];
  return {
    events,
    async record(event) {
      events.push(event);
    },
  };
}
