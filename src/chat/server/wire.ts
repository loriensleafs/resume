// What reaches the browser (SPEC-chat, The request, "Events on the wire" and "Stream errors"; Read
// results on the wire): one table of fixed messages, one per code, and wireError(code), which builds
// every RUN_ERROR event the handler sends. The event holds its code and fixed message only. The wire
// middleware, a new instance per request, sends each read result as its ids only and replaces every
// RUN_ERROR of the run with wireError(code). C12 adds the thinking summary as chat.thinking events.

import {
  EventType,
  type ChatMiddleware,
  type RunErrorEvent,
  type StreamChunk,
  type ToolCallResultEvent,
} from "@tanstack/ai";
import { z } from "zod";
import type { ReadResult } from "../../knowledge/types";
import { logServerError } from "./server-log";
import { READ_SOURCES } from "./tools";

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

/** The fixed message of every model API code: SERVER_ERROR's, as the browser shows the same alert as for an error. */
const MODEL_API_MESSAGE = MESSAGES.SERVER_ERROR;

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
 * The event types the browser needs (The request, "Events on the wire"): the 11 that research 07,
 * finding 9, checked against the installed source. The wire drops every other type, so an event type
 * that a later version of TanStack AI adds never reaches the browser: every REASONING_* event, every
 * snapshot, every *_CHUNK form and every STEP_* event among them.
 */
const WIRE_TYPES: ReadonlySet<string> = new Set<StreamChunk["type"]>([
  EventType.RUN_STARTED,
  EventType.RUN_FINISHED,
  EventType.RUN_ERROR,
  EventType.TEXT_MESSAGE_START,
  EventType.TEXT_MESSAGE_CONTENT,
  EventType.TEXT_MESSAGE_END,
  EventType.TOOL_CALL_START,
  EventType.TOOL_CALL_ARGS,
  EventType.TOOL_CALL_END,
  EventType.TOOL_CALL_RESULT,
  EventType.CUSTOM,
]);

/**
 * The chat's own CUSTOM events are each named `chat.<name>`: chat.citations, chat.thinking and the
 * marker middleware's refusal and follow-up events. Every other name, the engine's own among them
 * (structured-output.*, sandbox.file*, ui-resource), is dropped.
 */
const CHAT_EVENT_PREFIX = "chat.";

/** Whether an event may reach the browser: its type is on the allowlist, and a CUSTOM event is the chat's own. */
const onTheWire = (chunk: StreamChunk) =>
  WIRE_TYPES.has(chunk.type) && (chunk.type !== EventType.CUSTOM || chunk.name.startsWith(CHAT_EVENT_PREFIX));

/** What the browser gets of a read: its ids, never its text (Read results on the wire). */
export type ReadIds = Omit<ReadResult, "text">;

/** A list of ids, or none when the value is not a list of strings. */
const Ids = z.array(z.string()).catch([]);
/** The three lists of ids, and no other field: an object schema drops every key it does not name, `text` among them. */
const ReadIds = z.object({ read: Ids, unknown: Ids, skipped: Ids }).catch({ read: [], unknown: [], skipped: [] });

/** The ids of a read result's content. A content that is no read result, such as a tool error, has none. */
function readIdsOf(content: ToolCallResultEvent["content"]): ReadIds {
  let result: unknown;
  try {
    result = typeof content === "string" ? JSON.parse(content) : undefined;
  } catch {
    result = undefined;
  }
  return ReadIds.parse(result);
}

/**
 * A new TOOL_CALL_RESULT event for a read, from its named fields only: the content is the read's ids,
 * and a tool error keeps its state, so the browser knows the read failed. The server's own tool
 * message keeps the whole result for the model: the engine stores it before the event reaches onChunk.
 */
function idsOnly(event: ToolCallResultEvent): ToolCallResultEvent {
  const failed = event.metadata?.tanstack?.state === "output-error";
  return {
    type: EventType.TOOL_CALL_RESULT,
    timestamp: event.timestamp ?? Date.now(),
    messageId: event.messageId,
    toolCallId: event.toolCallId,
    role: "tool",
    content: JSON.stringify(readIdsOf(event.content) satisfies ReadIds),
    ...(failed ? { metadata: { tanstack: { state: "output-error" } } } : {}),
  };
}

/**
 * The wire middleware for one turn. Only the allowlisted events pass. Each read_sources result
 * leaves as its ids only, so no read text and no Not public section reaches the browser. Every
 * RUN_ERROR of the run leaves as wireError(code), so no rawEvent, metadata, usage, nested error or
 * other provider detail reaches the browser, and the turn keeps the code it sent for finishTurn().
 */
export function wireEvents(turn: { errorCode: RunErrorCode | null }): ChatMiddleware {
  /** The tool of each call this run started, by the call's id. */
  const toolOf = new Map<string, string>();

  function rewrite(chunk: StreamChunk): StreamChunk | null | undefined {
    if (!onTheWire(chunk)) return null;
    switch (chunk.type) {
      case EventType.TOOL_CALL_START:
        toolOf.set(chunk.toolCallId, chunk.toolCallName);
        return undefined;
      case EventType.TOOL_CALL_RESULT: {
        // A result of a call this run did not start is taken as a read, so a read never passes whole.
        const tool = toolOf.get(chunk.toolCallId);
        return tool === undefined || tool === READ_SOURCES ? idsOnly(chunk) : undefined;
      }
      case EventType.RUN_ERROR: {
        const code = wireCodeOf(chunk);
        turn.errorCode = code;
        return wireError(code);
      }
    }
    return undefined;
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
