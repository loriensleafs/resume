// The chat's limits (SPEC-chat, Limits): code enforces every limit below except the fit check's; the
// system prompt only explains them to the model. Peter set answerTokens, deadlineMs and the effort
// (decision record rows 131 and 132); the other values were approved with the spec. A change to a
// limit asks Peter first (SPEC-chat, Boundaries).
//
// The readBudget middleware below enforces the reads and the last call, and the deadline middleware
// the 120 seconds of a run.

import type { ChatMiddleware } from "@tanstack/ai";
import type { EndTurn } from "./finish-turn";
import { READ_SOURCES } from "./tool-names";
import type { Turn } from "./turn";

export const turnLimits = {
  questionCharacters: 10_000, // fits a pasted job description
  historyCharacters: 40_000,  // earlier turns sent, oldest dropped first (row 125)
  requestBytes: 262_144,      // a larger request gets 413 REQUEST_TOO_LARGE (row 125)
  reads: 3,                   // read_sources calls per turn, the "Ask about this" read included (Peter, 2026-10-27)
  modelCalls: 6,              // agentLoopStrategy: maxIterations(6); the sixth call can only answer
  answerTokens: 8_000,        // Anthropic max_tokens for each model call, thinking included (row 131)
  turnsSent: 20,              // earlier turns stay on screen but are not sent
  deadlineMs: 120_000,        // the handler ends the run with RUN_ERROR DEADLINE after this (row 132)
  followUps: 2,
  followUpCharacters: 80,
  topicCharacters: 60,        // the read tool's "topic" text in the answer steps
  thinkingCharacters: 20_000, // the thinking summary of one turn that reaches the browser; longer text ends with "…"
                              // (a typical one is 1 to 3 KB; the conductor's value, for Peter's end review)
  fitCheckRequirements: 10,   // a prompt rule: the fit check lists at most this many requirements; the evals check it
} as const;

/**
 * The read budget of one turn (Limits, "Reads" and "The last call"): code, not the prompt, stops the
 * fourth read and makes the last model call answer.
 *
 * - Its guard counts the reads. TanStack AI runs a guard after every onBeforeToolCall hook and after
 *   the tool's input check, just before the tool runs. So a read that fails the check, or that another
 *   middleware skips, never reaches it, and no read runs past the budget. A read past the budget is
 *   skipped with an error result, which the model reads; the run goes on.
 * - The read tool stays in every call's tools, because the tools open the cached prompt. After the
 *   third read, and at the sixth model call (iteration 5), onConfig gives the next call toolChoice
 *   "none", so it can only answer. agentLoopStrategy: maxIterations(turnLimits.modelCalls) ends the
 *   loop after that call.
 * - The reads the turn made before the run count too.
 *
 * Both hooks only compare numbers, so neither can throw: TanStack AI guards neither hook.
 */
export function readBudget(turn: Pick<Turn, "reads">): ChatMiddleware {
  let reads = turn.reads;
  return {
    name: "read-budget",
    onGuardToolCall: (_ctx, call) => {
      if (call.toolName !== READ_SOURCES) return undefined;
      if (reads >= turnLimits.reads) return { type: "skip", result: { error: "The read limit for this question is reached." } };
      reads++;
      return undefined;
    },
    onConfig: (ctx) => {
      const readsUsedUp = reads >= turnLimits.reads;
      const lastCall = ctx.iteration >= turnLimits.modelCalls - 1;
      return readsUsedUp || lastCall ? { toolChoice: "none" } : undefined;
    },
  };
}

/** The reason the deadline aborts a run with. Only passedDeadline() reads it. */
const DEADLINE_REASON = "DEADLINE";

/** Whether the deadline aborted the run whose controller has `signal`. */
export const passedDeadline = (signal: AbortSignal): boolean => signal.reason === DEADLINE_REASON;

/**
 * The deadline of one turn (Limits, "Deadline"): a timer on the run's abortController, `run`.
 *
 * - The timer starts when the run starts. When it fires, the deadline ends the turn with
 *   `endTurn()` as error DEADLINE, then aborts the run. The abort reaches the model call through
 *   chat()'s abortController, so a call that never ends ends too. The stream wrapper (run.ts) then
 *   sends the handler's own RUN_ERROR DEADLINE before the stream closes, because the browser takes a
 *   stream that closes with no error event as a finished answer.
 * - The turn ends before the abort reaches the run's terminal hook, so the hook's later ending writes
 *   nothing (finishTurn() writes a turn once): the log records error, not stopped. ctx.defer() makes
 *   the run await the writes before its stream ends.
 * - A Stop or a closed connection that aborted the run first decides how the turn ends.
 * - The timer stops at the run's terminal hook, so no timer outlives the turn. TanStack AI runs exactly
 *   one terminal hook per run, and it runs the middleware's hooks in array order: put the deadline
 *   first, so it stops the timer before any of the chat's other terminal hooks runs or waits.
 */
export function deadline(run: AbortController, endTurn: EndTurn): ChatMiddleware {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => clearTimeout(timer);
  return {
    name: "deadline",
    onStart: (ctx) => {
      timer = setTimeout(() => {
        if (run.signal.aborted) return;
        ctx.defer(endTurn({ outcome: "error", errorCode: "DEADLINE" }));
        run.abort(DEADLINE_REASON);
      }, turnLimits.deadlineMs);
    },
    onFinish: stop,
    onAbort: stop,
    onError: stop,
  };
}
