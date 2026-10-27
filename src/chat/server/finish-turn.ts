// finishTurn() (SPEC-chat, Question log; Turn telemetry): the one function that writes a turn's
// question-log entry and its chat_turn event, from the turn's state. The terminal middleware hook
// calls it with ctx.defer(), so the run awaits the writes before the response ends. Each turn writes
// each record exactly once, and a failed write never breaks the answer.

import { utcDay, type QuestionLog, type QuestionLogEntry, type Telemetry } from "./question-log";
import { logServerError } from "./server-log";
import type { ChatTurnEvent } from "./telemetry";
import type { TokenCounts, Turn } from "./turn";
import { runErrorCode, type RunErrorCode } from "./wire";

/** How the turn ended. */
export type TurnEnding = { outcome: QuestionLogEntry["outcome"]; errorCode: RunErrorCode | null };

/** The turns already written: a second call for one turn writes nothing. */
const finished = new WeakSet<Turn>();

/** The counts of a turn whose model calls all failed to finish, or that made none. */
const NO_TOKENS: { [K in keyof TokenCounts]: null } = {
  inputTokens: null,
  cachedInputTokens: null,
  cacheWriteTokens: null,
  cacheWrite1hTokens: null,
  outputTokens: null,
};

export async function finishTurn(
  deps: { log: QuestionLog; telemetry: Telemetry; now(): Date },
  turn: Turn,
  ending: TurnEnding,
): Promise<void> {
  if (finished.has(turn)) return;
  finished.add(turn);
  const event: ChatTurnEvent = {
    event: "chat_turn",
    outcome: ending.outcome,
    reads: turn.reads,
    citations: turn.citations.length,
    removed: turn.removed,
    modelCalls: turn.modelCalls,
    ...(turn.tokens ?? NO_TOKENS),
    durationMs: deps.now().getTime() - turn.startedAt.getTime(),
    // Only a known code reaches the telemetry (wire.ts, runErrorCode()).
    errorCode: ending.errorCode === null ? null : runErrorCode(ending.errorCode),
  };
  // One entry per turn that reached the model: a turn refused before the model call writes none.
  const entry: QuestionLogEntry | undefined =
    turn.modelCalls > 0
      ? {
          id: crypto.randomUUID(),
          date: utcDay(turn.startedAt.getTime()),
          question: turn.question,
          read: [...turn.readIds],
          citations: [...turn.citations],
          removed: turn.removed,
          outcome: ending.outcome,
        }
      : undefined;
  await Promise.all([
    entry && attempt("question-log", () => deps.log.append(entry)),
    attempt("telemetry", () => deps.telemetry.record(event, turn.reservation)),
  ]);
}

/** Runs one write; a failure is logged on the server and never thrown, so it never breaks the answer. */
async function attempt(store: string, write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch (error) {
    logServerError(`chat finishTurn: the ${store} write failed`, error);
  }
}
