// The chat module's server entry point (SPEC-chat, One turn): handleChat() takes a request from the
// browser and answers with a stream of server-sent events. It takes its dependencies, so the tests,
// the evals and the preview pass the fake model and the in-memory log, budget and telemetry.

import {
  chat,
  chatParamsFromRequestBody,
  maxIterations,
  toServerSentEventsResponse,
  type AnyTextAdapter,
  type ChatMiddleware,
  type StreamChunk,
} from "@tanstack/ai";
import type { Knowledge } from "../../knowledge/types";
import { readAbout } from "./about-read";
import { finishTurn, finishTurnHooks } from "./finish-turn";
import { readBudget, turnLimits } from "./limits";
import { citationMarkers } from "./markers";
import { systemPrompts } from "./prompt";
import { ChatMessages, ChatProps } from "./props";
import type { Budget, QuestionLog, Telemetry } from "./question-log";
import { libraryLogging, logServerError } from "./server-log";
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

/**
 * The codes of a rejected request, each with its HTTP status and its fixed message. The message says
 * what the rule is and nothing of the server's insides; the browser shows its own text for each status.
 */
const CHAT_ERRORS = {
  INVALID_REQUEST: { status: 400, message: "The request is not a chat request." },
  QUESTION_TOO_LONG: {
    status: 413,
    message: `The question is longer than ${turnLimits.questionCharacters.toLocaleString("en-US")} characters.`,
  },
  REQUEST_TOO_LARGE: { status: 413, message: `The request is larger than ${turnLimits.requestBytes / 1024} KB.` },
  FORBIDDEN_ORIGIN: { status: 403, message: "The chat answers requests from its own site only." },
} as const;

export type ChatErrorCode = keyof typeof CHAT_ERRORS;

/** The one shape of a rejected request's body (SPEC-chat, The request). */
export type ChatError = { error: { code: ChatErrorCode; message: string } };

/** The response to a rejected request: the ChatError JSON with the code's status. */
function chatError(code: ChatErrorCode): Response {
  const { status, message } = CHAT_ERRORS[code];
  return Response.json({ error: { code, message } } satisfies ChatError, { status });
}

/**
 * The request body's bytes. The read stops as soon as the bytes pass `limit`, so a larger body is
 * never read to its end: it is "too-large".
 */
async function readBody(request: Request, limit: number): Promise<Uint8Array | "too-large"> {
  if (request.body === null) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    size += read.value.byteLength;
    if (size > limit) {
      // The size decides; a cancel that fails changes nothing the visitor gets.
      await reader.cancel().catch(() => undefined);
      return "too-large";
    }
    chunks.push(read.value);
  }
  return new Uint8Array(Bun.concatArrayBuffers(chunks));
}

/** The value of `step`, or undefined when it throws. No step below returns undefined itself. */
async function unlessThrown<T>(step: () => T | Promise<T>): Promise<T | undefined> {
  try {
    return await step();
  } catch {
    return undefined;
  }
}

/** JSON is UTF-8 (RFC 8259), so bytes that are not UTF-8 are bad JSON. */
const utf8 = new TextDecoder("utf-8", { fatal: true });

type ChatParams = Awaited<ReturnType<typeof chatParamsFromRequestBody>>;

/**
 * What the turn takes from a request that passed every check: the thread id, the messages, the question
 * and the props only. The body's tools, context, state and resume stay behind, so they cannot reach
 * chat(): it gets only the handler's own tools. The scope, audience and about lines (C7, C15) read `props`.
 */
type CheckedRequest = {
  threadId: ChatParams["threadId"];
  messages: ChatParams["messages"];
  question: string;
  props: ChatProps;
};

/**
 * Whether the request's page may use the chat (The request, "Origin"): its Origin is one of `origins`,
 * or, when the list is empty, the request's own origin. A request with no Origin header passes; the
 * rate limits and the cap still apply to it. Any other Origin, "null" included, fails.
 */
function originAllowed(request: Request, origins: readonly string[]): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  return origins.length === 0 ? origin === new URL(request.url).origin : origins.includes(origin);
}

/** The request checks, in SPEC-chat's order (The request). Each failure is one ChatError code. */
async function checkRequest(request: Request, origins: readonly string[]): Promise<CheckedRequest | ChatErrorCode> {
  // The origin first, so another site's page cannot make the server read its body.
  if (!originAllowed(request, origins)) return "FORBIDDEN_ORIGIN";
  // 1. The body as bytes, read no further than the limit. A body that fails to arrive is no chat request.
  const bytes = await unlessThrown(() => readBody(request, turnLimits.requestBytes));
  if (bytes === undefined) return "INVALID_REQUEST";
  if (bytes === "too-large") return "REQUEST_TOO_LARGE";
  // 2. The bytes as JSON.
  const body: unknown = await unlessThrown(() => JSON.parse(utf8.decode(bytes)));
  if (body === undefined) return "INVALID_REQUEST";
  // 3. TanStack AI's check of the body. Not chatParamsFromRequest(): it reads the body itself and answers a plain-text 400.
  const params = await unlessThrown(() => chatParamsFromRequestBody(body));
  if (params === undefined) return "INVALID_REQUEST";
  // 4. The messages: the roles user, assistant and tool only, a user message of text only, and the newest
  // message the question, with text. Then the question's length; earlier turns are bounded by the bytes
  // and by the conversation sent.
  const messages = ChatMessages.safeParse(params.messages);
  if (!messages.success) return "INVALID_REQUEST";
  const { question } = messages.data;
  if (question.length > turnLimits.questionCharacters) return "QUESTION_TOO_LONG";
  // 5. The question's own request properties.
  const props = ChatProps.safeParse(params.forwardedProps);
  if (!props.success) return "INVALID_REQUEST";
  return { threadId: params.threadId, messages: params.messages, question, props: props.data };
}

/**
 * The stream wrapper (The request, "A thrown run"). A throw out of the chat() stream never passes the
 * chunk middleware, and toServerSentEventsResponse() would send the error's own message. So a throw
 * becomes wireError("SERVER_ERROR"), the real error is logged on the server only, and `endTurn` ends the
 * turn as error, which does nothing when the terminal hook already did. An abort is not a throw of
 * this kind: the abort decides how the turn ends, and the stream closes with no error event.
 */
async function* serverErrorOnThrow(
  stream: AsyncIterable<StreamChunk>,
  run: AbortSignal,
  endTurn: () => Promise<void>,
): AsyncGenerator<StreamChunk> {
  try {
    yield* stream;
  } catch (error) {
    if (run.aborted) return;
    logServerError("chat: the run threw, and the turn ends with SERVER_ERROR", error);
    await endTurn();
    yield wireError("SERVER_ERROR");
  }
}

/**
 * The run's controller, which the visitor's Stop aborts (How a turn ends): the first of `signals` to
 * abort reaches the model call through chat(). On Vercel the request's signal never fires (row 168),
 * and SPEC-deploy owns that case ("A Stop on Vercel"); this code only reacts where the signal fires.
 */
function stoppedBy(...signals: AbortSignal[]): AbortController {
  const run = new AbortController();
  const stop = AbortSignal.any(signals);
  if (stop.aborted) run.abort();
  else stop.addEventListener("abort", () => run.abort(), { once: true });
  return run;
}

export async function handleChat(request: Request, deps: ChatDeps): Promise<Response> {
  const startedAt = deps.now();
  const checked = await checkRequest(request, deps.origins);
  if (typeof checked === "string") return chatError(checked);
  const { threadId, messages, question, props } = checked;

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

  // The response's own controller, which only the visitor's closed connection aborts. A Stop aborts the
  // run but not the response, so the response reads the run to its end, and the run's terminal hook ends
  // the turn, also after a Stop that came before the run started.
  const delivery = new AbortController();
  const run = stoppedBy(request.signal, delivery.signal);
  const stream = chat({
    adapter: deps.adapter,
    threadId,
    systemPrompts: systemPrompts(deps.knowledge, props),
    messages: [...messages, ...about.messages],
    // The handler's own tools only: the request's tools never reach chat() (The request).
    tools: chatTools(deps.knowledge, turn),
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
    // The About read's events go first, so every other middleware sees them. The wire middleware sees
    // every event the others leave. The read budget's guard runs last of the guards, so it counts only
    // reads that run, and its onConfig last, so no other middleware gives the last call its tools
    // back. The terminal hooks come last: the run awaits their deferred writes before the stream ends
    // (One turn, step 9).
    middleware: [
      about.middleware,
      citationMarkers(deps.knowledge, turn),
      turnUsage(turn),
      ...(deps.testMiddleware ?? []),
      wireEvents(turn),
      readBudget(turn),
      finishTurnHooks(deps, turn),
    ],
  });
  const endAsThrown = () => finishTurn(deps, turn, { outcome: "error", errorCode: "SERVER_ERROR" });
  return toServerSentEventsResponse(serverErrorOnThrow(stream, run.signal, endAsThrown), { abortController: delivery });
}
