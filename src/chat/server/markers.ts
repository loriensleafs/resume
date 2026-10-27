// The marker middleware (SPEC-chat, Markers): it checks each [id] citation in the answer text as the
// text streams, keeps it or removes it, and ends the run with a chat.citations event that lists the
// kept ids, in order of first use, and the count removed. It reads TEXT_MESSAGE_CONTENT text only, so
// the thinking summary never passes it.
//
// C8 adds the refusal and follow-up markers (<<…>>) and the code and link rules; C5 adds the passages
// read in the same turn to what a citation may name.

import { EventType, type ChatMiddleware, type StreamChunk } from "@tanstack/ai";
import { parseId } from "../../knowledge/ids";
import type { Knowledge } from "../../knowledge/types";
import { logServerError } from "./server-log";

/** Text from "[" is held at most this many characters, "[" included (SPEC-chat, Markers, "Holding"). */
const HOLD_CHARACTERS = 120;
/** Every id form is written with these characters only (SPEC-knowledge, Ids). */
const ID_CHARACTER = /^[a-z0-9:.-]$/;

/** The value of the chat.citations event, and what the question log keeps of the check. */
export type Citations = { citations: string[]; removed: number };

type Verdict = "text" | "kept" | "removed";

/**
 * The marker middleware for one turn, and the result of its check so far. Make a new one for each
 * request: it keeps the turn's held text, kept citations and count removed.
 */
export function citationMarkers(knowledge: Knowledge): { middleware: ChatMiddleware; citations(): Citations } {
  // Resume entries and logistics answers are in the core, so an answer cites them with no read.
  const citable = new Set(knowledge.core.filter((entry) => entry.kind !== "catalog").map((entry) => entry.id));
  const catalog = new Set(knowledge.sources.map((source) => source.id));
  const kept: string[] = [];
  let removed = 0;
  /** The text held from an open "[", per text message. */
  const held = new Map<string, string>();

  /** A bracketed text is a citation only in an id form, and a source or passage form only for a source in the catalog. */
  function verdict(id: string): Verdict {
    const form = parseId(id);
    if (!form) return "text";
    if ((form.form === "source" || form.form === "passage") && !catalog.has(form.source)) return "text";
    return citable.has(id) ? "kept" : "removed";
  }

  /** Adds `delta` to the message's held text, and returns the text that can pass now. */
  function release(messageId: string, delta: string): string {
    let rest = (held.get(messageId) ?? "") + delta;
    let out = "";
    while (rest !== "") {
      const open = rest.indexOf("[");
      if (open === -1) {
        out += rest;
        rest = "";
        break;
      }
      out += rest.slice(0, open);
      rest = rest.slice(open);
      // The first character after "[" that no id holds ends the candidate.
      let end = 1;
      while (end < rest.length && ID_CHARACTER.test(rest[end]!)) end++;
      if (end === rest.length) {
        // Still open. Hold it, unless it is past the limit; then it is text.
        if (rest.length <= HOLD_CHARACTERS) break;
        out += rest;
        rest = "";
        break;
      }
      if (rest[end] !== "]") {
        // No id form holds this character, so the text from "[" up to it is text.
        out += rest.slice(0, end);
        rest = rest.slice(end);
        continue;
      }
      const marker = rest.slice(0, end + 1);
      const id = rest.slice(1, end);
      rest = rest.slice(end + 1);
      switch (verdict(id)) {
        case "text":
          out += marker;
          break;
        case "kept":
          if (!kept.includes(id)) kept.push(id);
          out += marker;
          break;
        case "removed":
          removed++;
          break;
      }
    }
    if (rest === "") held.delete(messageId);
    else held.set(messageId, rest);
    return out;
  }

  /** A text event with only the fields the browser needs: never the adapter's cumulative `content`, which holds every marker unchecked. */
  const textEvent = (messageId: string, delta: string): StreamChunk => ({
    type: EventType.TEXT_MESSAGE_CONTENT,
    messageId,
    delta,
    timestamp: Date.now(),
  });

  function onChunk(chunk: StreamChunk): StreamChunk | StreamChunk[] | null | void {
    switch (chunk.type) {
      case EventType.TEXT_MESSAGE_CONTENT: {
        const out = release(chunk.messageId, chunk.delta);
        return out === "" ? null : textEvent(chunk.messageId, out);
      }
      case EventType.TEXT_MESSAGE_END: {
        // At the end of each message, held text is flushed as text.
        const rest = held.get(chunk.messageId);
        held.delete(chunk.messageId);
        return rest === undefined ? undefined : [textEvent(chunk.messageId, rest), chunk];
      }
      case EventType.RUN_FINISHED: {
        // A model call that ends on tool calls is not the run's end: the next call answers.
        if (chunk.finishReason === "tool_calls") return undefined;
        const citations: StreamChunk = {
          type: EventType.CUSTOM,
          name: "chat.citations",
          value: { citations: [...kept], removed } satisfies Citations,
          timestamp: Date.now(),
        };
        return [citations, chunk];
      }
    }
    return undefined;
  }

  return {
    middleware: {
      name: "markers",
      // TanStack AI does not guard onChunk, and a throw out of chat() would put its message on the
      // wire. So the middleware catches its own error and decides: the chunk it could not check is
      // dropped, so no unchecked marker reaches the browser.
      onChunk: (_ctx, chunk) => {
        try {
          return onChunk(chunk);
        } catch (error) {
          logServerError("chat markers: a chunk could not be checked and was dropped", error);
          return null;
        }
      },
    },
    citations: () => ({ citations: [...kept], removed }),
  };
}
