// What reaches the browser (SPEC-chat, The request, "Events on the wire" and "Stream errors"; Read
// results on the wire; Thinking): one table of fixed messages, one per code, and wireError(code), which
// builds every RUN_ERROR event the handler sends. The event holds its code and fixed message only. The
// wire middleware, a new instance per request, sends each allowlisted event with its named fields only,
// each read result as its ids only and any other tool's result as {}, the thinking summary as
// chat.thinking events of at most turnLimits.thinkingCharacters characters a turn, and every RUN_ERROR
// of the run as wireError(code), Anthropic's spend limit as SPEND_LIMIT.

import {
  EventType,
  type ChatMiddleware,
  type RunErrorEvent,
  type RunFinishedEvent,
  type StreamChunk,
  type ToolCallResultEvent,
} from "@tanstack/ai";
import { z } from "zod";
import type { ReadResult } from "../../knowledge/types";
import { turnLimits } from "./limits";
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
 * Anthropic's answers when a spend limit stops the API (SPEC-deploy, "The monthly limit"; Anthropic's
 * Rate limits page), by the response's HTTP status. The adapter puts the status in the RUN_ERROR's
 * `code` and the response's JSON body in its `rawEvent`. Each schema reads the body's fields only: the
 * SDK error's own message holds the whole body as text, so no check reads a message's text but the body's.
 */
const SPEND_LIMIT_BODIES: ReadonlyMap<string, z.ZodType> = new Map<string, z.ZodType>([
  // A spend limit Peter set: invalid_request_error, with a message that starts with these words.
  [
    "400",
    z.object({
      error: z.object({ type: z.literal("invalid_request_error"), message: z.string().startsWith("You have reached your specified") }),
    }),
  ],
  // The tier's spend cap: a rate_limit_error that this error code tells apart from a rate limit.
  ["429", z.object({ error: z.object({ details: z.object({ error_code: z.literal("enforced_spend_limit_reached") }) }) })],
]);

/** Whether a RUN_ERROR is Anthropic's spend limit: its status and its body, never its message text. */
function isSpendLimit(event: RunErrorEvent): boolean {
  const body = event.code === undefined ? undefined : SPEND_LIMIT_BODIES.get(event.code);
  return body !== undefined && body.safeParse(event.rawEvent).success;
}

/**
 * The wire code of a RUN_ERROR that the model adapter or the engine sent. Anthropic's spend limit is
 * the handler's SPEND_LIMIT, and the adapter's `max_tokens` is the handler's MAX_TOKENS (research 07,
 * finding 4). A model API code passes. Any other code, or none, is SERVER_ERROR.
 */
function wireCodeOf(event: RunErrorEvent): RunErrorCode {
  if (isSpendLimit(event)) return "SPEND_LIMIT";
  if (event.code === "max_tokens") return "MAX_TOKENS";
  return runErrorCode(event.code ?? "");
}

/**
 * The chat's own CUSTOM events are each named `chat.<name>`: chat.citations, chat.thinking and the
 * marker middleware's refusal and follow-up events. Every other name, the engine's own among them
 * (structured-output.*, sandbox.file*, ui-resource), is dropped.
 */
const CHAT_EVENT_PREFIX = "chat.";

/**
 * The value of a chat.thinking event (Thinking, rule 2): a thinking block's start or end, or a piece of
 * the thinking summary's text. It never holds a signature.
 */
type ThinkingValue = { active: boolean } | { delta: string };

/** A new chat.thinking event with the value and nothing else. */
const thinkingEvent = (value: ThinkingValue): StreamChunk => ({
  type: EventType.CUSTOM,
  name: "chat.thinking",
  value,
  timestamp: Date.now(),
});

/** The text before index `end`, never ending in the first half of a surrogate pair, so a cut leaves no broken character. */
function textBefore(text: string, end: number): string {
  const cut = text.slice(0, end);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/**
 * The thinking summary's text that one turn sends (Thinking, rule 3): at most
 * `turnLimits.thinkingCharacters` characters, counted across every thinking block of the turn. The text
 * that reaches the limit is cut, and "…" takes the limit's last character; later text is dropped. A
 * stream cannot see ahead, so a summary of exactly the limit also ends with "…", in place of its last
 * character.
 */
function thinkingSummary() {
  let sent = 0;
  return (delta: string): ThinkingValue | null => {
    const room = turnLimits.thinkingCharacters - sent;
    if (delta === "" || room <= 0) return null;
    if (delta.length < room) {
      sent += delta.length;
      return { delta };
    }
    sent = turnLimits.thinkingCharacters;
    return { delta: `${textBefore(delta, room - 1)}…` };
  };
}

/** What the browser gets of a read: its ids, never its text (Read results on the wire). */
type ReadIds = Omit<ReadResult, "text">;

/** A list of ids, or none when the value is not a list of strings. */
const Ids = z.array(z.string()).catch([]);
/** The three lists of ids, and no other field: an object schema drops every key it does not name, `text` among them. */
const ReadIdsSchema = z.object({ read: Ids, unknown: Ids, skipped: Ids }).catch({ read: [], unknown: [], skipped: [] });

/** The ids of a read result's content. A content that is no read result, such as a tool error, has none. */
function readIdsOf(content: ToolCallResultEvent["content"]): ReadIds {
  let result: unknown;
  try {
    result = typeof content === "string" ? JSON.parse(content) : undefined;
  } catch {
    result = undefined;
  }
  return ReadIdsSchema.parse(result) satisfies ReadIds;
}

/**
 * A new TOOL_CALL_RESULT event with the given content, from its named fields only: a tool error keeps
 * its state, so the browser knows the call failed. For a read, the content is the read's ids: the
 * server's own tool message keeps the whole result for the model, because the engine stores it before
 * the event reaches onChunk.
 */
function resultEvent(event: ToolCallResultEvent, content: ToolCallResultEvent["content"]): ToolCallResultEvent {
  const failed = event.metadata?.tanstack?.state === "output-error";
  return {
    type: EventType.TOOL_CALL_RESULT,
    timestamp: event.timestamp ?? Date.now(),
    messageId: event.messageId,
    toolCallId: event.toolCallId,
    role: "tool",
    content,
    ...(failed ? { metadata: { tanstack: { state: "output-error" } } } : {}),
  };
}

/** The finish reason of a RUN_FINISHED: the adapter sets it on the event, and the engine's own one keeps it in its metadata. */
const finishReasonOf = (event: RunFinishedEvent) => event.finishReason ?? event.metadata?.tanstack?.finishReason;

/**
 * The wire middleware for one turn. Only the allowlisted events pass, each as a new event built from
 * its named fields. Each read_sources result leaves as its ids only, so no read text and no Not public
 * section reaches the browser, and any other tool's result as {}. The thinking summary leaves as
 * chat.thinking events. Every RUN_ERROR of the run leaves as wireError(code), so no rawEvent, metadata,
 * usage, nested error or other provider detail reaches the browser, and the turn keeps the code it sent
 * for finishTurn().
 */
export function wireEvents(turn: { errorCode: RunErrorCode | null }): ChatMiddleware {
  /** The tool of each call this run started, by the call's id. */
  const toolOf = new Map<string, string>();
  /** The thinking summary's text that this run may still send. */
  const summary = thinkingSummary();

  /**
   * The wire's one allowlist (The request, "Events on the wire"): each case is an event type that the
   * browser needs, and it returns a new event that replaces `chunk` on the wire, with the fields that
   * the browser's client reads and no other. Every other type is dropped, so an event type that a later
   * version of TanStack AI adds never reaches the browser: every snapshot, every *_CHUNK form and every
   * STEP_* event among them. Research 07, finding 9, checked the 11 types against the installed source.
   * The REASONING_* events leave as chat.thinking events in their place.
   *
   * The adapter and the engine put the provider's detail on each event: its `rawEvent`, the `metadata`
   * that names the provider, its API and the model, the `model`, Anthropic's response id and the
   * `usage`. After the middleware, the engine moves each field it does not know into `metadata`
   * (normalizeStreamChunk), turns a TOOL_CALL_END's `result` into a TOOL_CALL_RESULT and a
   * TOOL_CALL_START's `metadata.thoughtSignature` into a REASONING_ENCRYPTED_VALUE, and neither new event
   * passes this middleware. So no event leaves as it came: a field left out here never reaches the
   * browser. It never returns the chunk unchanged.
   */
  function rewrite(chunk: StreamChunk): StreamChunk | null {
    const timestamp = chunk.timestamp ?? Date.now();
    switch (chunk.type) {
      case EventType.RUN_STARTED:
        return { type: chunk.type, runId: chunk.runId, threadId: chunk.threadId, timestamp };
      case EventType.RUN_FINISHED: {
        const finishReason = finishReasonOf(chunk);
        return { type: chunk.type, runId: chunk.runId, threadId: chunk.threadId, timestamp, ...(finishReason === undefined ? {} : { finishReason }) };
      }
      case EventType.RUN_ERROR: {
        const code = wireCodeOf(chunk);
        turn.errorCode = code;
        return wireError(code);
      }
      case EventType.TEXT_MESSAGE_START:
        return { type: chunk.type, messageId: chunk.messageId, role: chunk.role, timestamp };
      case EventType.TEXT_MESSAGE_CONTENT:
        return { type: chunk.type, messageId: chunk.messageId, delta: chunk.delta, timestamp };
      case EventType.TEXT_MESSAGE_END:
        return { type: chunk.type, messageId: chunk.messageId, timestamp };
      case EventType.TOOL_CALL_START:
        toolOf.set(chunk.toolCallId, chunk.toolCallName);
        return {
          type: chunk.type,
          toolCallId: chunk.toolCallId,
          toolCallName: chunk.toolCallName,
          ...(chunk.parentMessageId === undefined ? {} : { parentMessageId: chunk.parentMessageId }),
          timestamp,
        };
      case EventType.TOOL_CALL_ARGS:
        return { type: chunk.type, toolCallId: chunk.toolCallId, delta: chunk.delta, timestamp };
      case EventType.TOOL_CALL_END:
        return { type: chunk.type, toolCallId: chunk.toolCallId, ...(chunk.input === undefined ? {} : { input: chunk.input }), timestamp };
      case EventType.TOOL_CALL_RESULT: {
        // No tool's result passes whole. A read leaves as its ids, and a result of a call this run did not
        // start is taken as a read. Any other tool's result leaves as {}, with no field of its own: a tool
        // that a later task adds sends nothing of its result until this case names the fields that the
        // spec gives the browser for it (Tools).
        const tool = toolOf.get(chunk.toolCallId) ?? READ_SOURCES;
        return resultEvent(chunk, tool === READ_SOURCES ? JSON.stringify(readIdsOf(chunk.content)) : "{}");
      }
      case EventType.CUSTOM:
        return chunk.name.startsWith(CHAT_EVENT_PREFIX) ? { type: chunk.type, name: chunk.name, value: chunk.value, timestamp } : null;
      // The thinking summary leaves as chat.thinking events. Every other REASONING_* event is dropped,
      // the signature's REASONING_ENCRYPTED_VALUE among them (Thinking, rules 1 and 2).
      case EventType.REASONING_START:
        return thinkingEvent({ active: true });
      case EventType.REASONING_MESSAGE_CONTENT: {
        const step = summary(chunk.delta);
        return step === null ? null : thinkingEvent(step);
      }
      case EventType.REASONING_END:
        return thinkingEvent({ active: false });
      default:
        return null;
    }
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
