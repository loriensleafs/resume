// The "Ask about this" read (SPEC-chat, The request, "About"; One turn, step 5). On a passage or a
// source, code reads it, because Sonnet 5.5 cannot be made to call a tool. The read runs after
// budget.reserve() and before the first model call, and it counts as read 1 of turnLimits.reads. The
// model gets it as if it had called read_sources itself: the call and its whole result follow the
// question. The browser gets the call and its id-only result first in the stream, so the answer steps
// show it like any other read. "Ask about this" on a resume entry reads nothing: prompt.ts names the
// entry in a request line.
//
// The model's turn starts with this assistant message, which holds a tool call and no thinking block.
// With adaptive thinking that is valid history: "Assistant turns don't need to start with a thinking
// block" (Anthropic's adaptive-thinking docs, "Turn validation", checked on 2026-10-27).

import { EventType, type ChatMiddleware, type ModelMessage, type StreamChunk } from "@tanstack/ai";
import { readPassages } from "../../knowledge/read";
import type { Knowledge, ReadResult, Source } from "../../knowledge/types";
import { turnLimits } from "./limits";
import { READ_SOURCES } from "./tool-names";
import { recordRead, type Turn } from "./turn";
import type { ReadIds } from "./wire";

/** What a question's About read adds to the turn. A question with no About read adds no message, and its middleware sends nothing. */
export type AboutRead = {
  /** The read_sources call and its whole result, in that order, for the messages after the question. */
  messages: ModelMessage[];
  /** Sends the call and its id-only result right after the run's start. It goes before the wire middleware. */
  middleware: ChatMiddleware;
};

/** A new About read that adds nothing, one per call, so no two turns share its messages or its middleware. */
const noAboutRead = (): AboutRead => ({ messages: [], middleware: { name: "about-read" } });

/** The approved source that `id` names, as a source id or as one of its passage ids. */
const sourceNamedBy = (knowledge: Knowledge, id: string): Source | undefined =>
  knowledge.sources.find((source) => source.id === id || source.passages.some((passage) => passage.id === id));

/**
 * The call's topic: the source's title, cut to the read tool's limit of turnLimits.topicCharacters
 * characters, so the call passes the tool's own input rule. A longer title ends with "…". The limit
 * counts code points, as the tool's input schema does.
 */
function topicOf(title: string): string {
  const characters = [...title];
  return characters.length <= turnLimits.topicCharacters ? title : `${characters.slice(0, turnLimits.topicCharacters - 1).join("")}…`;
}

/** The call and its result as the browser gets them: the result's ids, never its text (Read results on the wire). */
function streamEvents(callId: string, input: { ids: string[]; topic: string }, result: ReadResult): StreamChunk[] {
  const timestamp = Date.now();
  const ids: ReadIds = { read: result.read, unknown: result.unknown, skipped: result.skipped };
  return [
    { type: EventType.TOOL_CALL_START, toolCallId: callId, toolCallName: READ_SOURCES, timestamp },
    { type: EventType.TOOL_CALL_ARGS, toolCallId: callId, delta: JSON.stringify(input), timestamp },
    { type: EventType.TOOL_CALL_END, toolCallId: callId, input, timestamp },
    { type: EventType.TOOL_CALL_RESULT, messageId: callId, toolCallId: callId, role: "tool", content: JSON.stringify(ids), timestamp },
  ];
}

/**
 * Reads the passage or source that `about` names, and records the read in the turn (recordRead()).
 * Call it after budget.reserve() and before readBudget(turn), which copies the turn's reads once.
 * An `about` that names no approved source or passage reads nothing: a resume entry gets its request
 * line from prompt.ts, and any other id is ignored, as the scope ignores an unknown role id.
 */
export function readAbout(knowledge: Knowledge, turn: Turn, about: string | null | undefined): AboutRead {
  if (!about) return noAboutRead();
  const source = sourceNamedBy(knowledge, about);
  if (!source) return noAboutRead();
  const input = { ids: [about], topic: topicOf(source.title) };
  const result = readPassages(knowledge, input.ids);
  recordRead(turn, result);
  const callId = `about-${crypto.randomUUID()}`;
  // Each model call of the turn sends its own RUN_STARTED, and onChunk sees every one: the read goes out after the first only.
  let sent = false;
  return {
    messages: [
      { role: "assistant", content: null, toolCalls: [{ id: callId, type: "function", function: { name: READ_SOURCES, arguments: JSON.stringify(input) } }] },
      // The model reads the whole result, as the engine stores a read_sources result: its JSON.
      { role: "tool", toolCallId: callId, content: JSON.stringify(result) },
    ],
    middleware: {
      name: "about-read",
      // TanStack AI does not guard onChunk; this hook only compares and builds plain values, so it cannot throw.
      onChunk: (_ctx, chunk) => {
        if (sent || chunk.type !== EventType.RUN_STARTED) return undefined;
        sent = true;
        return [chunk, ...streamEvents(callId, input, result)];
      },
    },
  };
}
