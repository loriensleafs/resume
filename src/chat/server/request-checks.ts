// The request checks (SPEC-chat, The request): the origin first, then the body in the spec's order.
// Each failure is one ChatError code, and the handler answers it with chatError(), the one JSON shape
// of a rejected request. A request that passes gives the turn its thread id, messages, question and
// props only.

import { chatParamsFromRequestBody } from "@tanstack/ai";
import { turnLimits } from "./limits";
import { ChatMessages, ChatProps } from "./props";

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
export function chatError(code: ChatErrorCode): Response {
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

/** A step of the checks: its value, or `ok: false` when it threw. */
type Attempt<T> = { ok: true; value: T } | { ok: false };

/** Runs one step of the checks. A throw is `ok: false`, so the check that runs the step maps it to its code. */
async function attempt<T>(step: () => T | Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await step() };
  } catch {
    return { ok: false };
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
export type CheckedRequest = {
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
export async function checkRequest(request: Request, origins: readonly string[]): Promise<CheckedRequest | ChatErrorCode> {
  // The origin first, so another site's page cannot make the server read its body.
  if (!originAllowed(request, origins)) return "FORBIDDEN_ORIGIN";
  // 1. The body as bytes, read no further than the limit. A body that fails to arrive is no chat request.
  const bytes = await attempt(() => readBody(request, turnLimits.requestBytes));
  if (!bytes.ok) return "INVALID_REQUEST";
  if (bytes.value === "too-large") return "REQUEST_TOO_LARGE";
  const sent = bytes.value;
  // 2. The bytes as JSON.
  const body = await attempt((): unknown => JSON.parse(utf8.decode(sent)));
  if (!body.ok) return "INVALID_REQUEST";
  // 3. TanStack AI's check of the body. Not chatParamsFromRequest(): it reads the body itself and answers a plain-text 400.
  const params = await attempt(() => chatParamsFromRequestBody(body.value));
  if (!params.ok) return "INVALID_REQUEST";
  const { threadId, messages, forwardedProps } = params.value;
  // 4. The messages: the roles user, assistant and tool only, a user message of text only, and the newest
  // message the question, with text. Then the question's length; earlier turns are bounded by the bytes
  // and by the conversation sent.
  const checked = ChatMessages.safeParse(messages);
  if (!checked.success) return "INVALID_REQUEST";
  const { question } = checked.data;
  if (question.length > turnLimits.questionCharacters) return "QUESTION_TOO_LONG";
  // 5. The question's own request properties.
  const props = ChatProps.safeParse(forwardedProps);
  if (!props.success) return "INVALID_REQUEST";
  return { threadId, messages, question, props: props.data };
}
