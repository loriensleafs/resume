// The marker middleware (SPEC-chat, Markers): it checks each [id] citation in the answer text as the
// text streams, through the scanner in marker-scanner.ts, and writes the kept citations and the count
// removed into the turn. It ends the run with a chat.citations event. It checks text events only, so
// the thinking summary never passes it.

import { EventType, type ChatMiddleware, type StreamChunk } from "@tanstack/ai";
import { parseId } from "../../knowledge/ids";
import type { Knowledge } from "../../knowledge/types";
import { scanMarkers, type Verdict } from "./marker-scanner";
import { logServerError } from "./server-log";
import type { Turn } from "./turn";

/** The value of the chat.citations event. */
export type Citations = { citations: string[]; removed: number };

type CitableIds = {
  /** Resume entries and logistics answers: they are in the core, so an answer cites them with no read. */
  citable: ReadonlySet<string>;
  /** The sources in the catalog: a source or passage form names one of these, or it is no citation. */
  catalog: ReadonlySet<string>;
};

/** Built once for each Knowledge value, not once per request. */
const citableIdsOf = new WeakMap<Knowledge, CitableIds>();

function citableIds(knowledge: Knowledge): CitableIds {
  let ids = citableIdsOf.get(knowledge);
  if (ids === undefined) {
    ids = {
      citable: new Set(knowledge.core.filter((entry) => entry.kind !== "catalog").map((entry) => entry.id)),
      catalog: new Set(knowledge.sources.map((source) => source.id)),
    };
    citableIdsOf.set(knowledge, ids);
  }
  return ids;
}

/** The marker middleware for one turn. It keeps the text held from an open "[" per text message. */
export function citationMarkers(knowledge: Knowledge, turn: Turn): ChatMiddleware {
  const { citable, catalog } = citableIds(knowledge);
  const held = new Map<string, string>();

  /** A bracketed text is a citation only in an id form, and a source or passage form only for a source in the catalog. */
  function verdictOf(id: string): Verdict {
    const form = parseId(id);
    if (!form) return "not-a-citation";
    if ((form.form === "source" || form.form === "passage") && !catalog.has(form.source)) return "not-a-citation";
    return citable.has(id) ? "kept" : "removed";
  }

  /** Scans the message's held text and `delta`, records the verdicts in the turn, and returns the text that passes now. */
  function checkText(messageId: string, delta: string): string {
    const scan = scanMarkers((held.get(messageId) ?? "") + delta, verdictOf);
    if (scan.held === "") held.delete(messageId);
    else held.set(messageId, scan.held);
    for (const { id, verdict } of scan.markers) {
      if (verdict === "kept" && !turn.citations.includes(id)) turn.citations.push(id);
      if (verdict === "removed") turn.removed++;
    }
    return scan.out;
  }

  /** A text event with only the fields the browser needs: never the adapter's cumulative `content`, which holds every marker unchecked. */
  const textEvent = (messageId: string, delta: string): StreamChunk => ({
    type: EventType.TEXT_MESSAGE_CONTENT,
    messageId,
    delta,
    timestamp: Date.now(),
  });

  function checkChunk(chunk: StreamChunk): StreamChunk | StreamChunk[] | null | undefined {
    switch (chunk.type) {
      case EventType.TEXT_MESSAGE_CONTENT: {
        const out = checkText(chunk.messageId, chunk.delta);
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
          value: { citations: [...turn.citations], removed: turn.removed } satisfies Citations,
          timestamp: Date.now(),
        };
        return [citations, chunk];
      }
    }
    return undefined;
  }

  return {
    name: "markers",
    // TanStack AI does not guard onChunk, and a throw out of chat() would put its message on the
    // wire. So the middleware catches its own error and decides: the chunk it could not check is
    // dropped, so no unchecked marker reaches the browser.
    onChunk: (_ctx, chunk) => {
      try {
        return checkChunk(chunk);
      } catch (error) {
        logServerError("chat markers: a chunk could not be checked and was dropped", error);
        return null;
      }
    },
  };
}
