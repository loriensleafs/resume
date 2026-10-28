// readPassages(): what the chat's read tool returns (SPEC-knowledge, readPassages() rules). It runs
// on the server only: its text holds each source's Not public section, and only { read, unknown,
// skipped } reaches a browser. This module imports the renderer and types only, so the chat's
// server function can use it without the build.

import { renderSource } from "./render";
import type { Knowledge, ReadResult, Source } from "./types";

/** What one id reads: its source, and the passages it names there. */
type Named = { source: Source; passageIds: string[] };

/**
 * Every id a read can name, from the approved sources in `knowledge` only: each source id, which
 * names all its passages, and each passage id. It is a Map, so an id such as "__proto__" or
 * "constructor" names nothing (SPEC-knowledge, Code Style).
 */
function namedIds(knowledge: Knowledge): Map<string, Named> {
  const named = new Map<string, Named>();
  for (const source of knowledge.sources) {
    named.set(source.id, { source, passageIds: source.passages.map((p) => p.id) });
    for (const p of source.passages) named.set(p.id, { source, passageIds: [p.id] });
  }
  return named;
}

/**
 * The text of the sources and passages that `ids` name, as the chat reads it. Each id is a source
 * id, which reads all its passages, or a passage id, of an approved source; any other id, a draft's
 * or a resume entry's among them, goes to `unknown`. The text groups the passages by source, in the
 * order each source first appears, in file order within a source, with the source's header and its
 * Not public section once. An id whose passages are already in the text adds nothing. `read` and
 * `unknown` hold each id once, in the order asked; a source id in `read` means all its passages
 * were read.
 */
export function readPassages(knowledge: Knowledge, ids: string[]): ReadResult {
  const named = namedIds(knowledge);
  // The passages asked for in each source, in the order each source first appears.
  const asked = new Map<Source, Set<string>>();
  const read = new Set<string>();
  const unknown = new Set<string>();
  for (const id of ids) {
    const found = named.get(id);
    if (!found) {
      unknown.add(id);
      continue;
    }
    const passageIds = asked.get(found.source) ?? new Set<string>();
    for (const p of found.passageIds) passageIds.add(p);
    asked.set(found.source, passageIds);
    read.add(id);
  }
  // One blank line parts two sources.
  const text = [...asked].map(([source, passageIds]) => renderSource(source, [...passageIds])).join("\n");
  return { text, read: [...read], unknown: [...unknown], skipped: [] };
}
