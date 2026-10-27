// The chat module's server entry point (SPEC-chat, One turn): handleChat() takes a request from the
// browser and answers with a stream of server-sent events. It takes its dependencies, so the tests,
// the evals and the preview pass the fake model and the in-memory log, budget and telemetry.

import {
  chat,
  chatParamsFromRequestBody,
  toServerSentEventsResponse,
  type AnyTextAdapter,
  type ModelMessage,
  type StreamChunk,
  type UIMessage,
} from "@tanstack/ai";
import type { Knowledge } from "../../knowledge/types";
import { createFinishTurn } from "./finish-turn";
import { citationMarkers } from "./markers";
import { systemPrompt } from "./prompt";
import type { Budget, QuestionLog, Telemetry } from "./question-log";
import { NO_MODEL_CALL, turnUsage } from "./telemetry";
import { wireError } from "./wire";

export type ChatDeps = {
  adapter: AnyTextAdapter; // anthropicText("claude-sonnet-5-5"), createAnthropicChat() in the evals, or fakeText()
  knowledge: Knowledge; // virtual:knowledge in the route; fixtures in tests
  log: QuestionLog;
  budget: Budget; // this module's interface; SPEC-deploy implements it; tests pass an in-memory one
  telemetry: Telemetry; // this module's interface; SPEC-deploy prints the chat_turn line and adds it to the daily totals
  origins: string[]; // the allowed Origin values; the route computes them from VERCEL_ENV and VERCEL_URL;
  // empty means the request's own origin (outside production, tests, evals)
  now(): Date;
};

/**
 * The newest question's text as sent. The browser sends a question of text parts as one string
 * (TanStack AI's uiMessagesToWire), and C4's request check passes no other user message.
 */
function questionText(messages: ReadonlyArray<UIMessage | ModelMessage>): string {
  const newest = messages.findLast((message) => message.role === "user");
  const content = newest && "content" in newest ? newest.content : undefined;
  return typeof content === "string" ? content : "";
}

/** A stream of one event, for an answer the model does not give. */
async function* only(event: StreamChunk): AsyncGenerator<StreamChunk> {
  yield event;
}

export async function handleChat(request: Request, deps: ChatDeps): Promise<Response> {
  const startedAt = deps.now();
  const params = await chatParamsFromRequestBody(await request.json());
  const question = questionText(params.messages);

  // At the day's cap or the month's limit, the answer is the limit stream, and the model is not called.
  // The browser reads no body of a response that is not 200, so the refusal is a 200 stream (The request, "Limits").
  const reserved = await deps.budget.reserve();
  const finishTurn = createFinishTurn(deps, { question, startedAt, reservation: reserved.ok ? reserved.reservation : undefined });
  if (!reserved.ok) {
    await finishTurn({ outcome: "limit", errorCode: reserved.errorCode, reads: 0, read: [], citations: [], removed: 0, usage: NO_MODEL_CALL });
    return toServerSentEventsResponse(only(wireError(reserved.errorCode)));
  }

  const markers = citationMarkers(deps.knowledge);
  const usage = turnUsage();
  const stream = chat({
    adapter: deps.adapter,
    threadId: params.threadId,
    systemPrompts: [systemPrompt(deps.knowledge)],
    messages: params.messages,
    middleware: [
      markers.middleware,
      usage.middleware,
      {
        name: "finish-turn",
        // The terminal hook: the run awaits the deferred writes before the stream ends (One turn, step 9).
        // The turn reads nothing until C5 adds read_sources.
        onFinish: (ctx) =>
          ctx.defer(
            finishTurn({ outcome: "answered", errorCode: null, reads: 0, read: [], ...markers.citations(), usage: usage.sum() }),
          ),
      },
    ],
  });
  return toServerSentEventsResponse(stream);
}
