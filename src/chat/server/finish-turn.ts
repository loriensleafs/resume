// finishTurn() (SPEC-chat, Question log; Turn telemetry): the one function that writes a turn's
// question-log entry and its chat_turn event, from the turn's state. The terminal middleware hooks
// below call it with ctx.defer(), so the run awaits the writes before the response ends, and the
// stream wrapper in handle-chat.ts calls it after a throw. Each turn writes each record exactly once,
// and a failed write never breaks the answer.

import type { ChatMiddleware } from "@tanstack/ai";
import { utcDay, type QuestionLog, type QuestionLogEntry, type Telemetry } from "./question-log";
import { logServerError } from "./server-log";
import type { ChatTurnEvent } from "./telemetry";
import type { TokenCounts, Turn } from "./turn";
import { runErrorCode, type RunErrorCode } from "./wire";

/** How the turn ended. */
export type TurnEnding = { outcome: QuestionLogEntry["outcome"]; errorCode: RunErrorCode | null };

/**
 * How a turn that ended with an error event ended. Anthropic's spend limit during the run is `limit`,
 * as a refusal by the budget is (Question log; SPEC-deploy, "How the limit state reaches the browser").
 * Every other code is `error`.
 */
const errorEnding = (errorCode: RunErrorCode): TurnEnding => ({ outcome: errorCode === "SPEND_LIMIT" ? "limit" : "error", errorCode });

/** What finishTurn() writes to: the question log, the telemetry and the clock of ChatDeps. */
type FinishDeps = { log: QuestionLog; telemetry: Telemetry; now(): Date };

/**
 * The terminal hooks of one turn (How a turn ends). TanStack AI runs exactly one of them per run, and
 * each ends the turn through finishTurn() with ctx.defer().
 */
export function finishTurnHooks(deps: FinishDeps, turn: Turn): ChatMiddleware {
  return {
    name: "finish-turn",
    onFinish: (ctx) => ctx.defer(finishTurn(deps, turn, { outcome: "answered", errorCode: null })),
    // A model error ends with the code the wire sent for it. A throw has none: it is SERVER_ERROR,
    // which the stream wrapper also sends.
    onError: (ctx) => ctx.defer(finishTurn(deps, turn, errorEnding(turn.errorCode ?? "SERVER_ERROR"))),
    // The visitor's Stop, where its abort reaches the handler (row 168).
    onAbort: (ctx) => ctx.defer(finishTurn(deps, turn, { outcome: "stopped", errorCode: null })),
  };
}

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

export async function finishTurn(deps: FinishDeps, turn: Turn, ending: TurnEnding): Promise<void> {
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
