// The chat's tools (SPEC-chat, Tools). Every tool runs on the server, and no tool writes anything.
// read_sources reads approved sources through readPassages(): the model gets the whole result, text
// included, and the wire middleware sends the browser its ids only (wire.ts). C9 adds open_resume and
// open_source.

import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import { readLimits, readPassages } from "../../knowledge/read";
import type { Knowledge } from "../../knowledge/types";
import { turnLimits } from "./limits";
import { recordRead, type Turn } from "./turn";

/** The read tool's name, which the wire middleware also reads. */
export const READ_SOURCES = "read_sources";

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

/** The tools of one turn. A read records what it read in the turn (recordRead()). */
export function chatTools(knowledge: Knowledge, turn: Turn) {
  return [
    readSources.server(({ ids }) => {
      const result = readPassages(knowledge, ids);
      recordRead(turn, result);
      return result;
    }),
  ];
}
