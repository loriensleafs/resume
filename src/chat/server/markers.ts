// The marker middleware (SPEC-chat, Markers): it checks the markers of the answer text as the text
// streams, through one scanner of marker-scanner.ts per text message. It keeps or removes each [id]
// citation, and takes each refusal and follow-up marker out of the text. It writes the kept citations,
// the count removed and the refusal kind into the turn, and keeps the follow-up questions that pass the
// check: at most turnLimits.followUps, each at most turnLimits.followUpCharacters characters. A passage
// counts once the turn's read tool has read it (tools.ts writes the turn's reads). It ends the run with
// a chat.citations event, then chat.refusal and chat.follow-ups when the answer has them. It checks text
// events only, so the thinking summary never passes it.

import { EventType, type ChatMiddleware, type StreamChunk } from "@tanstack/ai";
import { parseId } from "../../knowledge/ids";
import type { Knowledge } from "../../knowledge/types";
import { turnLimits } from "./limits";
import { markerScanner, type MarkerScanner, type Scan, type Verdict } from "./marker-scanner";
import type { RefusalKind } from "./question-log";
import { logServerError } from "./server-log";
import { hasRead, type Turn } from "./turn";

/** The value of the chat.citations event. */
export type Citations = { citations: string[]; removed: number };
/** The value of the chat.refusal event: the kind of the answer's refusal marker. */
export type Refusal = { refusal: RefusalKind };
/** The value of the chat.follow-ups event: the answer's follow-up questions that passed the check, in order. */
export type FollowUps = { followUps: string[] };

/** A new CUSTOM event of the chat's own, named chat.<name>, which the wire middleware passes. */
const chatEvent = (name: string, value: Citations | Refusal | FollowUps): StreamChunk => ({
  type: EventType.CUSTOM,
  name,
  value,
  timestamp: Date.now(),
});

/** A follow-up question passes the check with some text and at most turnLimits.followUpCharacters characters (Markers). */
const passesFollowUpCheck = (question: string) => question !== "" && question.length <= turnLimits.followUpCharacters;

type CitableIds = {
  /** Resume entries and logistics answers: they are in the core, so an answer cites them with no read. */
  citable: ReadonlySet<string>;
  /** The sources in the catalog: a source or passage form names one of these, or it is no citation. */
  catalog: ReadonlySet<string>;
  /** Every passage of the approved sources: a passage is citable once the turn has read it. */
  passages: ReadonlySet<string>;
};

/** Built once for each Knowledge value, not once per request. */
const citableIdsOf = new WeakMap<Knowledge, CitableIds>();

function citableIds(knowledge: Knowledge): CitableIds {
  let ids = citableIdsOf.get(knowledge);
  if (ids === undefined) {
    ids = {
      citable: new Set(knowledge.core.filter((entry) => entry.kind !== "catalog").map((entry) => entry.id)),
      catalog: new Set(knowledge.sources.map((source) => source.id)),
      passages: new Set(knowledge.sources.flatMap((source) => source.passages.map((passage) => passage.id))),
    };
    citableIdsOf.set(knowledge, ids);
  }
  return ids;
}

/** The marker middleware for one turn. It keeps one marker scanner per text message, which holds that message's undecided text. */
export function answerMarkers(knowledge: Knowledge, turn: Turn): ChatMiddleware {
  const { citable, catalog, passages } = citableIds(knowledge);
  const scanners = new Map<string, MarkerScanner>();
  /** The turn's follow-up questions that passed the check. */
  const followUps: string[] = [];

  /**
   * Whether the turn has read this passage of an approved source: its id, or its whole source, is in
   * the turn's reads (hasRead()). A whole-source read reads every passage the source has, and no other.
   */
  const readThisTurn = (id: string, source: string) => passages.has(id) && hasRead(turn, id, source);

  /**
   * A bracketed text is a citation only in an id form, and a source or passage form only for a source
   * in the catalog. It is kept for a resume entry or a logistics answer, or for a passage the turn has
   * read; a whole-source citation is always removed, because a citation names a passage.
   */
  function verdictOf(id: string): Verdict {
    const form = parseId(id);
    if (!form) return "not-a-citation";
    if ((form.form === "source" || form.form === "passage") && !catalog.has(form.source)) return "not-a-citation";
    if (form.form === "passage") return readThisTurn(id, form.source) ? "kept" : "removed";
    return citable.has(id) ? "kept" : "removed";
  }

  /** Records the markers of one scan in the turn, and returns the scan's text. */
  function record({ text, markers }: Scan): string {
    for (const marker of markers) {
      switch (marker.kind) {
        case "citation":
          if (marker.verdict === "removed") turn.removed++;
          else if (!turn.citations.includes(marker.id)) turn.citations.push(marker.id);
          break;
        case "refusal":
          // The first refusal marker decides the kind.
          turn.refusal ??= marker.refusal;
          break;
        case "follow-up":
          // A follow-up question past the first two, or too long, is dropped; it is no citation, so it is not counted.
          if (followUps.length < turnLimits.followUps && passesFollowUpCheck(marker.question)) followUps.push(marker.question);
          break;
        case "unknown":
          turn.removed++;
          break;
      }
    }
    return text;
  }

  /**
   * The events that end the answer: the kept citations and the count removed, then the refusal kind and
   * the follow-up questions, each only when the answer has one.
   */
  function answerEvents(): StreamChunk[] {
    const events = [chatEvent("chat.citations", { citations: [...turn.citations], removed: turn.removed })];
    if (turn.refusal !== null) events.push(chatEvent("chat.refusal", { refusal: turn.refusal }));
    if (followUps.length > 0) events.push(chatEvent("chat.follow-ups", { followUps: [...followUps] }));
    return events;
  }

  /** The scanner of a text message, made at its first text. */
  function scannerOf(messageId: string): MarkerScanner {
    let scanner = scanners.get(messageId);
    if (scanner === undefined) {
      scanner = markerScanner(verdictOf);
      scanners.set(messageId, scanner);
    }
    return scanner;
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
        const text = record(scannerOf(chunk.messageId).scan(chunk.delta));
        return text === "" ? null : textEvent(chunk.messageId, text);
      }
      case EventType.TEXT_MESSAGE_END: {
        // At the end of each message, held text is flushed as text, apart from a marker it closes.
        const scanner = scanners.get(chunk.messageId);
        scanners.delete(chunk.messageId);
        const text = scanner === undefined ? "" : record(scanner.end());
        return text === "" ? undefined : [textEvent(chunk.messageId, text), chunk];
      }
      case EventType.RUN_FINISHED: {
        // A model call that ends on tool calls is not the run's end: the next call answers.
        if (chunk.finishReason === "tool_calls") return undefined;
        return [...answerEvents(), chunk];
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
