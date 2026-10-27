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

export const isRunErrorCode = (code: string): code is RunErrorCode => Object.hasOwn(MESSAGES, code) || MODEL_API_ERROR_CODE.test(code);

/** A new RUN_ERROR event with the code and its fixed message, and nothing else. */
export function wireError(code: HandlerErrorCode): RunErrorEvent {
  return { type: EventType.RUN_ERROR, code, message: MESSAGES[code], timestamp: Date.now() };
}
