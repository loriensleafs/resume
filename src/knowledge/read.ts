// readPassages(): what the chat's read tool returns (SPEC-knowledge, readPassages() rules). It runs
// on the server only: its text holds each source's Not public section, and only { read, unknown,
// skipped } reaches a browser. This module imports the id grammar, the renderer and types only, so
// the chat's server function can use it without the build.

import { PASSAGE_ID_CHARACTERS } from "./ids";
import { renderSource, SOURCE_CHARACTERS } from "./render";
import type { Knowledge, ReadResult, Source } from "./types";

/**
 * The bounds of one read. The chat's read tool checks its input against `ids` and `idCharacters`
 * first, so the model gets a tool error (SPEC-chat); a call past them is a programming error, and
 * readPassages() throws.
 */
export const readLimits = {
  /** At most this many ids in one read. */
  ids: 20,
  /** No id is longer than this: the longest id that can name a passage. */
  idCharacters: PASSAGE_ID_CHARACTERS,
  /** `text` holds at most this: the most an approved source renders to, so one read always holds a whole source. */
  characters: SOURCE_CHARACTERS,
} as const;

/**
 * Throws on a call past `readLimits.ids` or `readLimits.idCharacters`. An id's characters are its
 * code points, as zod's string max() counts them, so an id the read tool's schema lets through never
 * throws here: 64 emoji are a string of length 128. Code points are never more than the length, so
 * only an id over the limit in length is counted.
 */
function checkLimits(ids: string[]): void {
  if (ids.length > readLimits.ids) throw new RangeError(`readPassages() takes at most ${readLimits.ids} ids; it got ${ids.length}`);
  for (const [i, id] of ids.entries()) {
    const characters = id.length > readLimits.idCharacters ? [...id].length : id.length;
    if (characters > readLimits.idCharacters) {
      throw new RangeError(`readPassages() takes ids of at most ${readLimits.idCharacters} characters; the id at position ${i + 1} has ${characters}`);
    }
  }
}

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
 * A read's text: each source with the passages read in it, in the order the sources first appear.
 * Each rendered source ends with a line break, so one blank line parts two sources.
 */
function renderRead(inText: ReadonlyMap<Source, ReadonlySet<string>>): string {
  return [...inText].map(([source, passageIds]) => renderSource(source, [...passageIds])).join("\n");
}

/**
 * The text of the sources and passages that `ids` name, as the chat reads it. Each id is a source
 * id, which reads all its passages, or a passage id, of an approved source; any other id, a draft's
 * or a resume entry's among them, goes to `unknown`. The text groups the passages by source, in the
 * order each source first appears, in file order within a source, with the source's header and its
 * Not public section once. An id whose passages are already in the text adds nothing. `read` and
 * `unknown` hold each id once, in the order asked; a source id in `read` means all its passages
 * were read.
 *
 * The text holds at most `readLimits.characters`. When the next id would take it past them, the
 * read stops: that id and each later id it knows go to `skipped`, once each, in order. A later id
 * whose passages are already in the text goes to `read`, since its text is in the result. More than
 * `readLimits.ids` ids, or an id over `readLimits.idCharacters`, throws.
 */
export function readPassages(knowledge: Knowledge, ids: string[]): ReadResult {
  checkLimits(ids);
  const named = namedIds(knowledge);
  // The passages in the text, by source, in the order each source first appears.
  let inText = new Map<Source, ReadonlySet<string>>();
  let text = "";
  const read = new Set<string>();
  const unknown = new Set<string>();
  // Empty until the read stops.
  const skipped = new Set<string>();
  for (const id of ids) {
    const found = named.get(id);
    if (!found) {
      unknown.add(id);
      continue;
    }
    const before = inText.get(found.source);
    const after = new Set([...(before ?? []), ...found.passageIds]);
    // Its source is in the text with all the passages it names: it adds nothing, also after the stop.
    if (before?.size === after.size) {
      read.add(id);
      continue;
    }
    if (!skipped.size) {
      // Map.set keeps a source where it first appears, so a widened group stays in its place. The
      // whole read renders again for each id: at most 20 ids, so this stays cheap.
      const next = new Map(inText).set(found.source, after);
      const nextText = renderRead(next);
      if (nextText.length <= readLimits.characters) {
        inText = next;
        text = nextText;
        read.add(id);
        continue;
      }
    }
    // This id would take the text past the limit, or an earlier one did: the read has stopped.
    skipped.add(id);
  }
  return { text, read: [...read], unknown: [...unknown], skipped: [...skipped] };
}
