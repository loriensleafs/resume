// Turn telemetry (SPEC-chat, Turn telemetry): the one chat_turn event per turn that the handler
// hands to Telemetry.record(), and the middleware that counts the turn's model calls and sums the
// usage of each call that finishes. The event holds no question text, threadId, IP address or other
// visitor data.

import type { ChatMiddleware } from "@tanstack/ai";
import type { QuestionLogEntry } from "./question-log";
import type { Turn } from "./turn";

export type ChatTurnEvent = {
  event: "chat_turn";
  outcome: QuestionLogEntry["outcome"] | "rejected";   // "limit" also for a refusal before the model call
  reads: number;
  citations: number;
  removed: number;
  modelCalls: number;
  inputTokens: number | null;        // uncached input only
  cachedInputTokens: number | null;  // cache reads
  cacheWriteTokens: number | null;   // all cache writes, the 1-hour ones included
  cacheWrite1hTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
  errorCode: string | null;  // the model API's code, "DEADLINE", "MAX_TOKENS", "SERVER_ERROR", "DAILY_LIMIT" or "SPEND_LIMIT"; never a message or stack trace
};

/**
 * The usage middleware for one turn: it writes the turn's model calls and token counts. TanStack AI
 * calls `onUsage` once for each model call that finishes, so the sum covers the finished calls only,
 * and the counts stay null until one finishes. The five counts follow SPEC-deploy's mapping: the
 * adapter's `promptTokens` holds the uncached input, the cache reads and the cache writes together.
 */
export function turnUsage(turn: Turn): ChatMiddleware {
  return {
    name: "turn-usage",
    onIteration: () => {
      turn.modelCalls++;
    },
    onUsage: (_ctx, usage) => {
      const cached = usage.promptTokensDetails?.cachedTokens ?? 0;
      const writes = usage.promptTokensDetails?.cacheWriteTokens ?? 0;
      const writes1h = usage.promptTokensDetails?.cacheWrite1hTokens ?? 0;
      const sum = turn.tokens;
      turn.tokens = {
        inputTokens: (sum?.inputTokens ?? 0) + usage.promptTokens - cached - writes,
        cachedInputTokens: (sum?.cachedInputTokens ?? 0) + cached,
        cacheWriteTokens: (sum?.cacheWriteTokens ?? 0) + writes,
        cacheWrite1hTokens: (sum?.cacheWrite1hTokens ?? 0) + writes1h,
        outputTokens: (sum?.outputTokens ?? 0) + usage.completionTokens,
      };
    },
  };
}
