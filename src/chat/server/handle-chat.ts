// The chat module's server entry point (SPEC-chat, One turn): handleChat() takes a request from the
// browser and answers with a stream of server-sent events. It takes its dependencies, so the tests,
// the evals and the preview pass the fake model and the in-memory log, budget and telemetry.

import {
  chat,
  maxIterations,
  toServerSentEventsResponse,
  type AnyTextAdapter,
  type ChatMiddleware,
  type StreamChunk,
} from "@tanstack/ai";
import type { Knowledge } from "../../knowledge/types";
import { readAbout } from "./about-read";
import { finishRejected, finishTurn, finishTurnHooks, type EndTurn } from "./finish-turn";
import { conversationSent } from "./history";
import { deadline, readBudget, turnLimits } from "./limits";
import { answerMarkers } from "./markers";
import { systemPrompts } from "./prompt";
import type { Budget, QuestionLog, Telemetry } from "./question-log";
import { chatError, checkRequest } from "./request-checks";
import { stoppedBy, wrapRun } from "./run";
import { libraryLogging } from "./server-log";
import { turnUsage } from "./telemetry";
import { chatTools } from "./tools";
import { startTurn } from "./turn";
import { wireError, wireEvents } from "./wire";

export type ChatDeps = {
  adapter: AnyTextAdapter; // anthropicText("claude-sonnet-5-5"), createAnthropicChat() in the evals, or fakeText()
  knowledge: Knowledge; // virtual:knowledge in the route; fixtures in tests
  log: QuestionLog;
  budget: Budget; // this module's interface; SPEC-deploy implements it; tests pass an in-memory one
  telemetry: Telemetry; // this module's interface; SPEC-deploy prints the chat_turn line and adds it to the daily totals
  origins: string[]; // the allowed Origin values; the route computes them from VERCEL_ENV and VERCEL_URL;
  // empty means the request's own origin (outside production, tests, evals)
  now(): Date;
  /**
   * Tests only: middleware that runs after the marker and usage middleware and before the wire
   * middleware, so a seam-1 test can throw inside the run or add an event the wire must handle
   * (SPEC-chat, Testing Strategy, "Stream errors" and "Events on the wire"). The route, the evals and
   * the preview never set it.
   */
  testMiddleware?: ChatMiddleware[];
};

/** A stream of one event, for an answer the model does not give. */
async function* only(event: StreamChunk): AsyncGenerator<StreamChunk> {
  yield event;
}

export async function handleChat(request: Request, deps: ChatDeps): Promise<Response> {
  const startedAt = deps.now();
  const checked = await checkRequest(request, deps.origins);
  if (!checked.ok) {
    // A rejected request never reaches the model: it writes its chat_turn event only (Turn telemetry).
    await finishRejected(deps, startedAt);
    return chatError(checked.errorCode);
  }
  const { threadId, question, props } = checked.request;
  // The earlier turns within the conversation's limits, each message rebuilt from the fields the model
  // needs, earlier reads as ids only, then the question (Limits, "Conversation sent"; The request, "Trust").
  const messages = conversationSent(checked.request);

  // At the day's cap or the month's limit, the answer is the limit stream, and the model is not called.
  // The browser reads no body of a response that is not 200, so the refusal is a 200 stream (The request, "Limits").
  const reserved = await deps.budget.reserve();
  const turn = startTurn({ question, startedAt, reservation: reserved.ok ? reserved.reservation : undefined });
  if (!reserved.ok) {
    await finishTurn(deps, turn, { outcome: "limit", errorCode: reserved.errorCode });
    return toServerSentEventsResponse(only(wireError(reserved.errorCode)));
  }

  // "Ask about this" on a passage or a source: read 1, before readBudget(turn) copies the turn's reads.
  const about = readAbout(deps.knowledge, turn, props.about);

  // The response's own controller, which only the visitor's closed connection aborts. A Stop or the
  // deadline aborts the run but not the response, so the response reads the run to its end, the run's
  // terminal hook ends the turn, also after a Stop that came before the run started, and the response
  // still sends the deadline's RUN_ERROR.
  const delivery = new AbortController();
  const run = stoppedBy(request.signal, delivery.signal);
  const endTurn: EndTurn = (ending) => finishTurn(deps, turn, ending);
  const stream = chat({
    adapter: deps.adapter,
    threadId,
    systemPrompts: systemPrompts(deps.knowledge, props),
    messages: [...messages, ...about.messages],
    // The handler's own tools only: the request's tools never reach chat() (The request). open_source
    // reads the earlier answers that the model gets for the passages they cite, so it opens no passage
    // that only a turn past the conversation's limits cites.
    tools: chatTools(deps.knowledge, turn, messages),
    // At most six model calls; readBudget() makes the sixth answer (Limits, "Model calls").
    agentLoopStrategy: maxIterations(turnLimits.modelCalls),
    // Sonnet 5.5 always thinks (Limits, "Thinking"; row 156). The adapter sends adaptive thinking at effort
    // medium with the summarized display, so the thinking summary streams; the wire sends it as chat.thinking.
    reasoning: { level: "medium", summary: true },
    // Anthropic's max_tokens for each model call, thinking included (row 131).
    modelOptions: { max_tokens: turnLimits.answerTokens },
    // The 5-minute prompt cache, keyed by the threadId. The handler sets it itself: no caller chooses it.
    promptCache: "short",
    abortController: run,
    // The library's own log lines hold the error alone, as the chat's do.
    debug: libraryLogging,
    // The deadline goes first, so its terminal hook stops its timer before any other terminal hook
    // runs; it handles no event. The About read's events go first of the events, so every other
    // middleware sees them. The wire middleware sees every event the others leave. The read budget's
    // guard runs last of the guards, so it counts only reads that run, and its onConfig last, so no
    // other middleware gives the last call its tools back. The turn's terminal hooks come last: the run
    // awaits their deferred writes before the stream ends (One turn, step 9).
    middleware: [
      deadline(run, endTurn),
      about.middleware,
      answerMarkers(deps.knowledge, turn),
      turnUsage(turn),
      ...(deps.testMiddleware ?? []),
      wireEvents(turn),
      readBudget(turn),
      finishTurnHooks(deps, turn),
    ],
  });
  return toServerSentEventsResponse(wrapRun(stream, run.signal, endTurn), { abortController: delivery });
}
