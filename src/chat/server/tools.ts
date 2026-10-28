// The chat's tools (SPEC-chat, Tools). Every tool runs on the server, and no tool writes anything.
// read_sources reads approved sources through readPassages(): the model gets the whole result, text
// included, and the wire middleware sends the browser its ids only (wire.ts). open_resume and
// open_source return a result only: the browser opens the resume, or the passage, when the result
// arrives in a live stream. open_source opens only a passage of an approved source that the
// conversation cites or that this turn read.

import { toolDefinition, type ModelMessage, type UIMessage } from "@tanstack/ai";
import { z } from "zod";
import { readLimits, readPassages } from "../../knowledge/read";
import type { Knowledge } from "../../knowledge/types";
import { turnLimits } from "./limits";
import { markerScanner } from "./marker-scanner";
import { OPEN_RESUME, OPEN_SOURCE, READ_SOURCES } from "./tool-names";
import { hasRead, recordRead, type Turn } from "./turn";

/**
 * The read tool's input. The engine checks it before the tool runs, so a call past `readLimits` is
 * a tool error the model reads, and the run goes on; readPassages() would throw past the same limits.
 * zod counts an id's characters as readPassages() does, so an id this schema passes never throws.
 * A call with no id, or with no topic, reads nothing worth a read, so it fails the check too.
 */
const ReadInput = z.strictObject({
  ids: z
    .array(z.string().max(readLimits.idCharacters))
    .min(1)
    .max(readLimits.ids)
    .meta({ description: `Source ids or passage ids from the catalog, at most ${readLimits.ids}.` }),
  topic: z
    .string()
    .min(1)
    .max(turnLimits.topicCharacters)
    .meta({ description: `What the read looks for, in a few words, at most ${turnLimits.topicCharacters} characters. The visitor sees it.` }),
});

const readSources = toolDefinition({
  name: READ_SOURCES,
  description:
    "Reads approved sources of the knowledge base. A source id reads all of the source's passages; a passage id reads that passage.",
  inputSchema: ReadInput,
});

/**
 * What an open tool returns when it opens. The server opens nothing: the browser opens the view when
 * this result arrives in a live stream, and a restored conversation shows the call's card only (Tools).
 */
const opened = () => ({ opened: true }) as const;

const openResume = toolDefinition({
  name: OPEN_RESUME,
  description: "Opens the whole resume beside the chat, for a visitor who asks to see the resume. It returns { opened: true }.",
  // No field: the browser opens the whole resume, at its top.
  inputSchema: z.strictObject({}),
});

const openSource = toolDefinition({
  name: OPEN_SOURCE,
  description:
    "Opens one passage of an approved source beside the chat, for a visitor who asks where a fact came from. " +
    "Only a passage that an earlier answer cited, or that this turn read, opens. It returns { opened: true }, or an error.",
  inputSchema: z.strictObject({
    passageId: z.string().meta({ description: "The id of one passage, <source id>.<n>." }),
  }),
});

/** open_source's two errors, as fixed text the model reads. Neither holds the id or any read text. */
const OPEN_SOURCE_ERRORS = {
  notAPassage: "This id is not a passage of an approved source, so it cannot be opened.",
  notCited: "Only a passage that an earlier answer cited, or that this turn read, can be opened.",
} as const;

/** Each passage of the approved sources, by its id, with its source's id. */
type PassageSources = ReadonlyMap<string, string>;

/** Built once for each Knowledge value, not once per request. */
const passageSourcesOf = new WeakMap<Knowledge, PassageSources>();

function passageSources(knowledge: Knowledge): PassageSources {
  let sources = passageSourcesOf.get(knowledge);
  if (sources === undefined) {
    sources = new Map(knowledge.sources.flatMap((source) => source.passages.map((passage) => [passage.id, source.id] as const)));
    passageSourcesOf.set(knowledge, sources);
  }
  return sources;
}

/** A message of the request, as chatParamsFromRequestBody() gives it. */
type RequestMessage = UIMessage | ModelMessage;

/** The text of each earlier answer: each assistant message's text. A message that only calls tools has none. */
const answerTexts = (conversation: readonly RequestMessage[]): string[] =>
  conversation.flatMap((message) =>
    message.role === "assistant" && "content" in message && typeof message.content === "string" ? [message.content] : [],
  );

/**
 * The passages that the conversation cites (Tools, open_source): each citation marker in an earlier
 * answer's text that names a passage of an approved source. The marker scanner reads each answer as the
 * citation check reads answer text (Markers), so a citation form inside inline code, fenced code or link
 * text cites nothing, and a visitor's own question cites nothing. The earlier answers are visitor
 * material, and an edited answer can cite any passage of an approved source: the spec accepts that
 * trade-off, as every approved source is public (The request, "Trust" and "Edited answers").
 */
function citedPassages(answers: readonly string[], passages: PassageSources): ReadonlySet<string> {
  const cited = new Set<string>();
  for (const text of answers) {
    const scanner = markerScanner((id) => (passages.has(id) ? "kept" : "not-a-citation"));
    for (const { markers } of [scanner.scan(text), scanner.end()]) {
      for (const marker of markers) if (marker.kind === "citation") cited.add(marker.id);
    }
  }
  return cited;
}

/**
 * The tools of one turn. A read records what it read in the turn (recordRead()); the open tools write
 * nothing. `conversation` is the request's messages: open_source opens a passage that an earlier answer
 * in it cites.
 */
export function chatTools(knowledge: Knowledge, turn: Turn, conversation: readonly RequestMessage[]) {
  const passages = passageSources(knowledge);
  const answers = answerTexts(conversation);
  // Scanned at the turn's first open_source call, and only then: most turns open nothing.
  let cited: ReadonlySet<string> | undefined;
  const citedByConversation = () => (cited ??= citedPassages(answers, passages));
  return [
    readSources.server(({ ids }) => {
      const result = readPassages(knowledge, ids);
      recordRead(turn, result);
      return result;
    }),
    openResume.server(opened),
    // A refused id is a throw, which the engine turns into the tool error { error } that the model reads,
    // marked as an error (Anthropic's is_error); the run goes on.
    openSource.server(({ passageId }) => {
      const source = passages.get(passageId);
      if (source === undefined) throw new Error(OPEN_SOURCE_ERRORS.notAPassage);
      if (!hasRead(turn, passageId, source) && !citedByConversation().has(passageId)) throw new Error(OPEN_SOURCE_ERRORS.notCited);
      return opened();
    }),
  ];
}
