// What reaches the browser (SPEC-chat, The request, "Stream errors"): one table of fixed messages, one
// per code, and wireError(code), which builds every RUN_ERROR event the handler sends. The event holds
// its code and fixed message only. The wire middleware, a new instance per request, replaces every
// RUN_ERROR of the run with wireError(code). C5 adds its event allowlist and the read results as ids,
// and C12 the thinking summary as chat.thinking events.

import { EventType, type ChatMiddleware, type RunErrorEvent, type StreamChunk } from "@tanstack/ai";
import { logServerError } from "./server-log";
import type { Turn } from "./turn";

/**
 * The handler's own codes, each with its fixed message. The browser shows its own text for each code
 * (How a turn ends); these messages say the same.
 */
const MESSAGES = {
  DAILY_LIMIT: "The chat has reached today's limit.",
  SPEND_LIMIT: "The chat has reached this month's limit.",
  DEADLINE: "The answer didn't arrive.",
  MAX_TOKENS: "The answer didn't arrive.",
  SERVER_ERROR: "The answer didn't arrive.",
} as const;

/** The fixed message of every model API code: the browser shows the same alert as for an error. */
const MODEL_API_MESSAGE = "The answer didn't arrive.";

export type HandlerErrorCode = keyof typeof MESSAGES;

/** The model API's code: its HTTP status, or context_overflow (research 07, finding 4). */
type ModelApiErrorCode = `${number}` | "context_overflow";
const MODEL_API_ERROR_CODE = /^(?:[1-5][0-9]{2}|context_overflow)$/;

/** The code of a RUN_ERROR event and of a chat_turn event: the handler's own or the model API's. Never a message or a stack trace. */
export type RunErrorCode = HandlerErrorCode | ModelApiErrorCode;

const isHandlerErrorCode = (code: string): code is HandlerErrorCode => Object.hasOwn(MESSAGES, code);

/**
 * The code when it is the handler's own or the model API's, and SERVER_ERROR for any other value.
 * The types allow no other value, so this is a runtime guard for callers the types do not reach,
 * such as another module's Budget: an error's text never passes as a code.
 */
export function runErrorCode(code: string): RunErrorCode {
  return isHandlerErrorCode(code) || MODEL_API_ERROR_CODE.test(code) ? (code as RunErrorCode) : "SERVER_ERROR";
}

/**
 * A new RUN_ERROR event with the code and its fixed message, and nothing else. A code that is neither
 * the handler's own nor the model API's (the same runtime guard) becomes SERVER_ERROR.
 */
export function wireError(code: RunErrorCode): RunErrorEvent {
  const known = runErrorCode(code);
  const message = isHandlerErrorCode(known) ? MESSAGES[known] : MODEL_API_MESSAGE;
  return { type: EventType.RUN_ERROR, code: known, message, timestamp: Date.now() };
}

/**
 * The wire code of a RUN_ERROR that the model adapter or the engine sent. The adapter's `max_tokens`
 * is the handler's MAX_TOKENS (research 07, finding 4). A model API code passes. Any other code, or
 * none, is SERVER_ERROR. C12 adds Anthropic's spend limit, which it finds from the status and the body.
 */
function wireCodeOf(event: Extract<StreamChunk, { type: "RUN_ERROR" }>): RunErrorCode {
  if (event.code === "max_tokens") return "MAX_TOKENS";
  return runErrorCode(event.code ?? "");
}

/**
 * The wire middleware for one turn. Every RUN_ERROR of the run leaves as wireError(code), so no
 * rawEvent, metadata, usage, nested error or other provider detail reaches the browser, and the turn
 * keeps the code it sent for finishTurn().
 */
export function wireEvents(turn: Turn): ChatMiddleware {
  function rewrite(chunk: StreamChunk): StreamChunk | undefined {
    if (chunk.type !== EventType.RUN_ERROR) return undefined;
    const code = wireCodeOf(chunk);
    turn.errorCode = code;
    return wireError(code);
  }

  return {
    name: "wire",
    // TanStack AI does not guard onChunk, and a throw out of chat() would put its message on the wire.
    // So the middleware catches its own error and decides: a chunk it could not check is dropped, and a
    // RUN_ERROR it could not read still ends the stream, as SERVER_ERROR.
    onChunk: (_ctx, chunk) => {
      try {
        return rewrite(chunk);
      } catch (error) {
        logServerError("chat wire: a chunk could not be checked and was dropped", error);
        if (chunk.type !== EventType.RUN_ERROR) return null;
        turn.errorCode = "SERVER_ERROR";
        return wireError("SERVER_ERROR");
      }
    },
  };
}
