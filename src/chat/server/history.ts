// The conversation sent (SPEC-chat, Limits, "Conversation sent"; The request, "Trust"): what the model
// gets of the request's messages.
//
// Every message in the request is visitor material, the earlier answers and reads included: the browser
// holds the conversation, so a visitor can edit it. So the model gets each message rebuilt from the
// fields it needs, and from no other:
//
// - a question as its text;
// - an earlier answer as its text and its calls of the chat's own tools, each call's arguments as that
//   tool's input schema reads them, and each call followed by its result;
// - an earlier result as the fields the browser got of it (wire.ts). An earlier read is its ids only,
//   and only the ids its call asked for, so edited read text never reaches the model.
//
// Every other field stays behind: thinking and its signatures, the block order, the metadata (a
// provider's tool result and a result's content parts among them), a result's error text and the
// visitor's call ids. The earlier turns then go within two bounds, the last turnLimits.turnsSent turns
// and at most turnLimits.historyCharacters characters of them, oldest dropped first, and the question
// goes last.

import type { ModelMessage } from "@tanstack/ai";
import { z } from "zod";
import { turnLimits } from "./limits";
import { questionText, UserMessage } from "./props";
import type { CheckedRequest } from "./request-checks";
import { READ_SOURCES, type ToolName } from "./tool-names";
import { TOOL_INPUTS } from "./tools";
import { ReadIdsSchema, resultFieldsOf } from "./wire";

/** A message of the request, as the request checks give it. */
type RequestMessage = CheckedRequest["messages"][number];

/** One tool call of a message the model gets. */
type ToolCallSent = NonNullable<ModelMessage["toolCalls"]>[number];

/** The fields of an earlier answer that the model reads: its text and its tool calls. */
const EarlierAnswer = z.object({ role: z.literal("assistant"), content: z.string().optional(), toolCalls: z.array(z.unknown()).optional() });
/** The fields of an earlier tool call: its id, which pairs it with its result, its tool's name and its arguments as JSON text. */
const EarlierCall = z.object({ id: z.string(), function: z.object({ name: z.string(), arguments: z.string() }) });
/** The fields of an earlier tool result: the id of the call it answers, and its content. */
const EarlierResult = z.object({ role: z.literal("tool"), toolCallId: z.string(), content: z.string() });

const isToolName = (name: string): name is ToolName => Object.hasOwn(TOOL_INPUTS, name);

/** An earlier call's arguments as its tool's input schema reads them, or undefined when they fail it. */
function inputOf(tool: ToolName, args: string): unknown {
  let value: unknown;
  try {
    value = JSON.parse(args);
  } catch {
    return undefined;
  }
  const input = TOOL_INPUTS[tool].safeParse(value);
  return input.success ? input.data : undefined;
}

/**
 * An earlier call's result as the model gets it: the fields that the browser got of it (wire.ts), read
 * from the request's copy. A read keeps only the ids that its call asked for, each once in a list.
 */
function resultSent(tool: ToolName, input: unknown, content: string): string {
  const fields = resultFieldsOf(tool, content);
  if (tool !== READ_SOURCES) return JSON.stringify(fields);
  const asked = new Set(TOOL_INPUTS[READ_SOURCES].safeParse(input).data?.ids);
  const { read, unknown, skipped } = ReadIdsSchema.parse(fields);
  const askedOnly = (ids: string[]) => [...new Set(ids)].filter((id) => asked.has(id));
  return JSON.stringify({ read: askedOnly(read), unknown: askedOnly(unknown), skipped: askedOnly(skipped) });
}

/**
 * One earlier turn as the model gets it. An earlier call goes only when it calls one of the chat's
 * tools, its arguments pass that tool's input schema, and the turn holds its result; its result then
 * follows the answer that calls it, so each call has exactly one result. A result whose call does not
 * go stays behind, and so does an answer with no text and no call. `callId` gives each call the
 * model gets a new id, so no id the visitor wrote reaches the model.
 */
function turnSent(turn: readonly RequestMessage[], callId: () => string): ModelMessage[] {
  /** Each call's result, by the call's id: the first that the turn holds for it. */
  const results = new Map<string, string>();
  for (const message of turn) {
    const result = EarlierResult.safeParse(message);
    if (result.success && !results.has(result.data.toolCallId)) results.set(result.data.toolCallId, result.data.content);
  }
  const sent: ModelMessage[] = [];
  for (const message of turn) {
    const asked = UserMessage.safeParse(message);
    if (asked.success) {
      sent.push({ role: "user", content: questionText(asked.data) });
      continue;
    }
    // A tool result goes after the answer that calls it, below.
    const answer = EarlierAnswer.safeParse(message);
    if (!answer.success) continue;
    const calls: { call: ToolCallSent; result: string }[] = [];
    for (const each of answer.data.toolCalls ?? []) {
      const call = EarlierCall.safeParse(each);
      if (!call.success) continue;
      const { id, function: called } = call.data;
      const result = results.get(id);
      // A result answers one call: a second call with the same id has none.
      results.delete(id);
      if (result === undefined || !isToolName(called.name)) continue;
      const input = inputOf(called.name, called.arguments);
      if (input === undefined) continue;
      calls.push({
        call: { id: callId(), type: "function", function: { name: called.name, arguments: JSON.stringify(input) } },
        result: resultSent(called.name, input, result),
      });
    }
    const text = answer.data.content || null;
    if (text === null && calls.length === 0) continue;
    sent.push({ role: "assistant", content: text, ...(calls.length > 0 ? { toolCalls: calls.map(({ call }) => call) } : {}) });
    for (const { call, result } of calls) sent.push({ role: "tool", toolCallId: call.id, content: result });
  }
  return sent;
}

/** The characters of a message that the model reads: its text, and each tool call's arguments. */
const characters = (message: ModelMessage): number =>
  (typeof message.content === "string" ? message.content.length : 0) +
  (message.toolCalls ?? []).reduce((sum, call) => sum + call.function.arguments.length, 0);

/**
 * The earlier turns of a request, oldest first. A turn is one question and its answer, with the reads
 * made for it: each user message starts a turn, which holds the messages after it until the next user
 * message. A message before the first question is in no turn.
 */
function turnsOf(earlier: readonly RequestMessage[]): RequestMessage[][] {
  const turns: RequestMessage[][] = [];
  for (const message of earlier) {
    if (message.role === "user") turns.push([message]);
    else turns.at(-1)?.push(message);
  }
  return turns;
}

/**
 * The newest earlier turns within the bounds, oldest first: at most turnLimits.turnsSent turns, and at
 * most turnLimits.historyCharacters characters of them, as the model gets them. A turn goes whole or
 * not at all, and once one is dropped every older one is too.
 */
function newestWithin(turns: readonly ModelMessage[][]): ModelMessage[][] {
  const sent: ModelMessage[][] = [];
  let total = 0;
  for (const turn of turns.toReversed()) {
    total += turn.reduce((sum, message) => sum + characters(message), 0);
    if (sent.length === turnLimits.turnsSent || total > turnLimits.historyCharacters) break;
    sent.unshift(turn);
  }
  return sent;
}

/**
 * The messages the model gets for a request that passed the request checks: the newest earlier turns
 * within the bounds, oldest first, each rebuilt from the fields the model needs, then the question.
 */
export function conversationSent({ messages, question }: Pick<CheckedRequest, "messages" | "question">): ModelMessage[] {
  let calls = 0;
  const callId = () => `earlier-${++calls}`;
  const turns = turnsOf(messages.slice(0, -1)).map((turn) => turnSent(turn, callId));
  return [...newestWithin(turns).flat(), { role: "user", content: question }];
}
