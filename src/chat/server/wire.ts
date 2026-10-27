// What reaches the browser (SPEC-chat, The request, "Stream errors"): one table of fixed messages, one
// per code, and wireError(code), which builds every RUN_ERROR event the handler sends. The event holds
// its code and fixed message only. C5 adds the wire middleware here; C11 makes every RUN_ERROR on the
// wire one of these.

import { EventType, type RunErrorEvent } from "@tanstack/ai";

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

/** A new RUN_ERROR event with the code and its fixed message, and nothing else. A code that is not the handler's own (the same runtime guard) becomes SERVER_ERROR. */
export function wireError(code: HandlerErrorCode): RunErrorEvent {
  const known = isHandlerErrorCode(code) ? code : "SERVER_ERROR";
  return { type: EventType.RUN_ERROR, code: known, message: MESSAGES[known], timestamp: Date.now() };
}
