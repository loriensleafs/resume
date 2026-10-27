// Turn telemetry (SPEC-chat, Turn telemetry): the one chat_turn event per turn that the handler
// hands to Telemetry.record(). It holds no question text, threadId, IP address or other visitor data.

import type { QuestionLogEntry } from "./question-log";

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
  errorCode: string | null;  // the model API's code, "DEADLINE", "MAX_TOKENS", "DAILY_LIMIT" or "SPEND_LIMIT"; never a message or stack trace
};
