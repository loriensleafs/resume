// The stub Anthropic client of seam 1 (SPEC-chat, Testing Strategy, "The handler"). It scripts the
// model calls that fakeText() cannot: thinking with a signature, a max_tokens stop, and the Messages
// API's own error answers. So a seam-1 test runs the real Anthropic adapter, as production does.
//
// stubAnthropic() is a Messages client for createAnthropicChatWithClient(): each model call takes the
// next scripted call and streams it as the Messages API's stream events, and the stub keeps each
// call's request, so a test reads what the adapter sent. anthropicAnswering() answers a model call
// with an HTTP error instead, read by the adapter's own SDK client.

import { createAnthropicChat, createAnthropicChatWithClient, type AnthropicMessagesClient } from "@tanstack/ai-anthropic";

/** The chat's model (decision 0013). */
const MODEL = "claude-sonnet-5-5";

/** The thinking summary streams in pieces of this many characters, as Anthropic's thinking_delta events do. */
const THINKING_PIECE = 1_000;
/** The answer text streams in pieces of this many characters, so a marker spans several text events. */
const TEXT_PIECE = 8;

/** The signature of every scripted thinking block, unless a call sets its own: a test finds it anywhere. */
export const SIGNATURE = "EqQBCkgIBxABGAIiQHN0dWItc2lnbmF0dXJl-stub-signature";

/** One scripted model call: one thinking block, then text, then a tool call, as Sonnet 5.5 answers. */
export type StubCall = {
  /** The thinking summary: the text of one thinking block. */
  thinking?: string;
  /** The thinking summary streams in pieces of this many characters. THINKING_PIECE when not set. */
  thinkingPiece?: number;
  /** The thinking block's signature, the encrypted thinking. SIGNATURE when not set. */
  signature?: string;
  /** The answer text. */
  text?: string;
  /** A tool call after the text. */
  toolUse?: { name: string; input: unknown };
  /** Why the call stops. Not set: tool_use for a call with a tool call, else end_turn. */
  stopReason?: "end_turn" | "tool_use" | "max_tokens";
};

/** The parts of a Messages request that seam 1 reads: what the adapter sent to Anthropic. */
export type StubRequest = {
  model: string;
  max_tokens: number;
  thinking?: unknown;
  output_config?: unknown;
  system?: { type: string; text: string; cache_control?: unknown }[];
  tools?: { name?: string; type?: string; input_schema?: unknown; cache_control?: unknown }[];
  tool_choice?: unknown;
  messages: unknown[];
};

/** `text` in pieces of `size` characters. */
function piecesOf(text: string, size: number): string[] {
  const pieces: string[] = [];
  for (let start = 0; start < text.length; start += size) pieces.push(text.slice(start, start + size));
  return pieces;
}

/** The Messages API's stream events for one scripted call, the `n`th of the turn. */
async function* streamOf(call: StubCall, n: number) {
  yield {
    type: "message_start",
    message: {
      id: `msg_stub_${n}`,
      type: "message",
      role: "assistant",
      model: MODEL,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 1_000, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    },
  };
  let index = 0;
  if (call.thinking !== undefined) {
    yield { type: "content_block_start", index, content_block: { type: "thinking", thinking: "", signature: "" } };
    for (const thinking of piecesOf(call.thinking, call.thinkingPiece ?? THINKING_PIECE)) {
      yield { type: "content_block_delta", index, delta: { type: "thinking_delta", thinking } };
    }
    yield { type: "content_block_delta", index, delta: { type: "signature_delta", signature: call.signature ?? SIGNATURE } };
    yield { type: "content_block_stop", index };
    index++;
  }
  if (call.text !== undefined) {
    yield { type: "content_block_start", index, content_block: { type: "text", text: "" } };
    for (const text of piecesOf(call.text, TEXT_PIECE)) yield { type: "content_block_delta", index, delta: { type: "text_delta", text } };
    yield { type: "content_block_stop", index };
    index++;
  }
  if (call.toolUse !== undefined) {
    const { name, input } = call.toolUse;
    yield { type: "content_block_start", index, content_block: { type: "tool_use", id: `toolu_stub_${n}`, name, input: {} } };
    yield { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(input) } };
    yield { type: "content_block_stop", index };
  }
  const written = (call.thinking ?? "").length + (call.text ?? "").length;
  yield {
    type: "message_delta",
    delta: { stop_reason: call.stopReason ?? (call.toolUse ? "tool_use" : "end_turn"), stop_sequence: null },
    usage: { output_tokens: Math.ceil(written / 4) },
  };
  yield { type: "message_stop" };
}

/**
 * An adapter on the stub Messages client: the turn's model calls take `calls` in order. `requests`
 * holds each model call's request as the adapter sent it.
 */
export function stubAnthropic(calls: StubCall[]) {
  const requests: StubRequest[] = [];
  const client = {
    beta: {
      messages: {
        create: async (request: StubRequest) => {
          requests.push(request);
          const call = calls[requests.length - 1];
          if (call === undefined) throw new Error(`The stub has no model call number ${requests.length}.`);
          return streamOf(call, requests.length);
        },
      },
    },
  } satisfies AnthropicMessagesClient;
  return { adapter: createAnthropicChatWithClient(MODEL, client), requests };
}

/** An HTTP error answer of the Messages API: its status and its JSON body. */
export type ApiError = { status: number; body: object };

/**
 * Anthropic's documented answers when a spend limit stops the API (the Rate limits page, "Adjust
 * your spend limit" and "Reaching your spend cap"; SPEC-deploy, "The monthly limit"). The message
 * text of each is Anthropic's example; the handler reads only the status and the body's fields.
 */
export const SPEND_LIMIT_ERRORS = {
  "the 400 of a spend limit Peter set": {
    status: 400,
    body: {
      type: "error",
      error: {
        type: "invalid_request_error",
        message: "You have reached your specified workspace API usage limits. You will regain access on 2026-11-01 at 00:00 UTC.",
      },
      request_id: "req_stub_spend_limit",
    },
  },
  "the 429 of the tier's spend cap": {
    status: 429,
    body: {
      type: "error",
      error: {
        type: "rate_limit_error",
        message:
          "You have reached your API usage limits: your organization has crossed its monthly API usage threshold, set based on your organization's API tier. You will regain access on 2026-11-01 at 00:00 UTC.",
        details: { error_code: "enforced_spend_limit_reached" },
      },
      request_id: "req_stub_spend_cap",
    },
  },
} satisfies Record<string, ApiError>;

/**
 * An adapter whose model call gets `error` from the Messages API. The adapter's own SDK client reads
 * the stub's HTTP response, so the error that the adapter catches is the SDK's real error class, built
 * from the status and the body as for a real answer. It makes no retry: the answer is the test's subject.
 */
export function anthropicAnswering(error: ApiError) {
  return createAnthropicChat(MODEL, "stub-key", {
    maxRetries: 0,
    fetch: async () => Response.json(error.body, { status: error.status, headers: { "request-id": "req_stub_error" } }),
  });
}
