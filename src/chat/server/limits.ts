// The chat's limits (SPEC-chat, Limits): code enforces every limit below except the fit check's; the
// system prompt only explains them to the model. Peter set answerTokens, deadlineMs and the effort
// (decision record rows 131 and 132); the other values were approved with the spec. A change to a
// limit asks Peter first (SPEC-chat, Boundaries).
//
// The readBudget middleware below enforces the reads and the last call; C13 adds the deadline.

import type { ChatMiddleware } from "@tanstack/ai";
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
 * The read tool's name, as tools.ts gives it. This module imports nothing from tools.ts, because
 * tools.ts reads turnLimits when it loads; the read-budget tests fail when the two names differ.
 */
const READ_TOOL = "read_sources";

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
      if (call.toolName !== READ_TOOL) return undefined;
      if (reads >= turnLimits.reads) return { type: "skip", result: { error: "The read limit for this question is reached." } };
      reads++;
      return undefined;
    },
    onConfig: (ctx) => (reads >= turnLimits.reads || ctx.iteration >= turnLimits.modelCalls - 1 ? { toolChoice: "none" } : undefined),
  };
}
