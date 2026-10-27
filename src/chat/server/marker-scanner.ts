// The marker scanner (SPEC-chat, Markers, "Holding"): a pure function over answer text. It finds each
// [id] marker, asks the caller's verdict on it, and returns the text that can pass now and the text
// that stays held from an open "[". The marker middleware (markers.ts) keeps the held text between
// text events and the turn's citations.

/** Text from "[" is held at most this many characters, "[" included. */
const HOLD_CHARACTERS = 120;
/** Every id form is written with these characters only (SPEC-knowledge, Ids). */
const ID_CHARACTER = /^[a-z0-9:.-]$/;

/** The check's verdict on a bracketed id: a citation kept or removed, or no citation, which passes as text. */
export type Verdict = "kept" | "removed" | "not-a-citation";

export type Scan = {
  /** The text that passes now, with each removed marker taken out. */
  out: string;
  /** The text from an open "[" that waits for the next text. */
  held: string;
  /** Each closed marker, in order, with its verdict. */
  markers: { id: string; verdict: Verdict }[];
};

/** Scans `text`, which begins with the text held from the scan before, and says what passes now. */
export function scanMarkers(text: string, verdictOf: (id: string) => Verdict): Scan {
  const markers: Scan["markers"] = [];
  let out = "";
  let rest = text;
  while (rest !== "") {
    const open = rest.indexOf("[");
    if (open === -1) return { out: out + rest, held: "", markers };
    out += rest.slice(0, open);
    rest = rest.slice(open);
    // The first character after "[" that no id holds ends the candidate.
    let end = 1;
    while (end < rest.length && ID_CHARACTER.test(rest[end]!)) end++;
    if (end === rest.length) {
      // Still open: it waits, unless it is past the limit; then it is text.
      return rest.length <= HOLD_CHARACTERS ? { out, held: rest, markers } : { out: out + rest, held: "", markers };
    }
    if (rest[end] !== "]") {
      // No id holds this character, so the text from "[" up to it is text.
      out += rest.slice(0, end);
      rest = rest.slice(end);
      continue;
    }
    const id = rest.slice(1, end);
    const verdict = verdictOf(id);
    markers.push({ id, verdict });
    if (verdict !== "removed") out += rest.slice(0, end + 1);
    rest = rest.slice(end + 1);
  }
  return { out, held: "", markers };
}
