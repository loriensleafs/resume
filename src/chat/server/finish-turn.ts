// finishTurn() (SPEC-chat, Question log; Turn telemetry): the one function that writes a turn's
// question-log entry and its chat_turn event. The terminal middleware hook calls it with ctx.defer(),
// so the run awaits the writes before the response ends. It keeps per-turn state, so each turn
// writes each record exactly once, and a failed write never breaks the answer.

import { utcDay, type QuestionLog, type QuestionLogEntry, type Telemetry } from "./question-log";
import { logServerError } from "./server-log";
import type { ChatTurnEvent, TurnUsage } from "./telemetry";
import { runErrorCode, type RunErrorCode } from "./wire";

/** How the turn ended, and what its middleware learned by then. */
export type TurnEnding = Pick<QuestionLogEntry, "outcome" | "read" | "citations" | "removed"> & {
  errorCode: RunErrorCode | null;
  /** The turn's reads: its read_sources calls that ran. */
  reads: number;
  usage: TurnUsage;
};

/**
 * Makes the finishTurn() of one turn: the question as sent, asked at `startedAt`, and the budget's
 * reservation when it gave one.
 */
export function createFinishTurn(
  deps: { log: QuestionLog; telemetry: Telemetry; now(): Date },
  turn: { question: string; startedAt: Date; reservation?: string },
): (ending: TurnEnding) => Promise<void> {
  let finished = false;
  return async (ending) => {
    if (finished) return;
    finished = true;
    // Only a known code reaches the telemetry (wire.ts, runErrorCode()).
    const errorCode = ending.errorCode === null ? null : runErrorCode(ending.errorCode);
    const event: ChatTurnEvent = {
      event: "chat_turn",
      outcome: ending.outcome,
      reads: ending.reads,
      citations: ending.citations.length,
      removed: ending.removed,
      ...ending.usage,
      durationMs: deps.now().getTime() - turn.startedAt.getTime(),
      errorCode,
    };
    // One entry per turn that reached the model: a turn refused before the model call writes none.
    const entry: QuestionLogEntry | undefined =
      ending.usage.modelCalls > 0
        ? {
            id: crypto.randomUUID(),
            date: utcDay(turn.startedAt.getTime()),
            question: turn.question,
            read: ending.read,
            citations: ending.citations,
            removed: ending.removed,
            outcome: ending.outcome,
          }
        : undefined;
    await Promise.all([
      entry && attempt("question-log", () => deps.log.append(entry)),
      attempt("telemetry", () => deps.telemetry.record(event, turn.reservation)),
    ]);
  };
}

/** Runs one write; a failure is logged on the server and never thrown, so it never breaks the answer. */
async function attempt(store: string, write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch (error) {
    logServerError(`chat finishTurn: the ${store} write failed`, error);
  }
}
