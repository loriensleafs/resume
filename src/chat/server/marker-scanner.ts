// The marker scanner (SPEC-chat, Markers): a pure state machine over the answer text of one message. It
// finds each [id] marker and each <<…>> marker, asks the caller's verdict on each [id], and returns the
// text that can pass now. A <<…>> marker and a removed [id] marker leave the text with the white space
// before them, so the text keeps no stray space ("migration ."). It tracks inline code, fenced code and
// link text as CommonMark reads them, and so as the browser's Markdown renderer does: no text inside
// them is a marker.
//
// The scanner holds text only while it cannot decide it yet: the text from an open "[" (at most 120
// characters), a closed [id] until the next character says whether it is link text, the text from "<<"
// until its ">>", a run of backticks or tildes until it ends, a code span until its closing run or the
// end of its paragraph, a backtick fence's line until it ends, and the white space that a removed
// marker after it would take. At the message's end every held text is decided. The marker middleware
// (markers.ts) keeps one scanner per text message and records the markers in the turn.

import type { RefusalKind } from "./question-log";

/** Text from "[" is held at most this many characters, "[" included (Markers, "Holding"). */
const HOLD_CHARACTERS = 120;
/** Every id form is written with these characters only (SPEC-knowledge, Ids). */
const ID_CHARACTER = /^[a-z0-9:.-]$/;
/** The characters that can start something other than plain text: white space, a line break, code, a marker. */
const SPECIAL = /[ \t\n`~[<]/;
/** A line that may still become a closing fence when more of it arrives. */
const FENCE_PREFIX = /^[ \t]*(?:`*|~*)[ \t]*$/;
/** A closing fence: a run of backticks or tildes, alone on its line. */
const CLOSING_FENCE = /^[ \t]*(`+|~+)[ \t]*$/;
/** A blank line, which ends a paragraph and so any code span in it. */
const BLANK_LINE = /\n[ \t]*\n/;
/** The shortest fence (CommonMark, "Fenced code blocks"). */
const FENCE_LENGTH = 3;

/** The check's verdict on a bracketed id: a citation kept or removed, or no citation, which passes as text. */
export type Verdict = "kept" | "removed" | "not-a-citation";

/** The kinds a refusal marker can name: one key for each RefusalKind, so the typecheck finds a kind missing here. */
const REFUSAL_KINDS: Record<RefusalKind, true> = { "out-of-scope": true, "not-covered": true };
const isRefusalKind = (kind: string): kind is RefusalKind => Object.hasOwn(REFUSAL_KINDS, kind);

/**
 * A marker the scanner found. A citation carries the check's verdict. A <<…>> is a refusal of one of the
 * two kinds, a follow-up question, or neither ("unknown"); each leaves the text.
 */
export type Marker =
  | { kind: "citation"; id: string; verdict: "kept" | "removed" }
  | { kind: "refusal"; refusal: RefusalKind }
  | { kind: "follow-up"; question: string }
  | { kind: "unknown" };

/** What one scan gives: the text that passes now, and each marker it closed, in order. */
export type Scan = { text: string; markers: Marker[] };

/** The scanner of one message's answer text. */
export type MarkerScanner = {
  /** Scans the message's next text. */
  scan(delta: string): Scan;
  /** The end of the message: every held text is decided, and passes as text unless it is a marker. */
  end(): Scan;
};

/** Where the scan is in the Markdown: in text, where markers are checked, or in fenced code, where nothing is a marker. */
type Context = { in: "text" } | { in: "fenced code"; mark: string; length: number };
const TEXT: Context = { in: "text" };

const REFUSAL = /^refusal:\s*(\S+)$/;
const FOLLOW_UP = /^follow-up:([\s\S]*)$/;

/** The marker that the text between "<<" and ">>" names. */
function markerIn(inside: string): Marker {
  const text = inside.trim();
  const refusal = REFUSAL.exec(text)?.[1];
  if (refusal !== undefined && isRefusalKind(refusal)) return { kind: "refusal", refusal };
  const followUp = FOLLOW_UP.exec(text);
  if (followUp !== null) return { kind: "follow-up", question: followUp[1]!.trim() };
  return { kind: "unknown" };
}

/** The index of the first character from `from` that can start something, or the text's length. */
function nextSpecial(text: string, from: number): number {
  for (let at = from; at < text.length; at++) if (SPECIAL.test(text[at]!)) return at;
  return text.length;
}

/** The length of the run of the character at `at`. */
function runLength(text: string, at: number): number {
  let end = at;
  while (end < text.length && text[end] === text[at]) end++;
  return end - at;
}

/** The index of the line break at or after `from`, or the text's length. */
function lineEnd(text: string, from: number): number {
  const end = text.indexOf("\n", from);
  return end === -1 ? text.length : end;
}

/**
 * Where the code span that the run of `length` backticks at `at` opens ends: the index after a run of
 * exactly as many backticks in the same paragraph. "never" when the paragraph or the text ends first,
 * so the run is text, as Markdown reads it; "not yet" while more text could still decide it.
 */
function codeSpanEnd(text: string, at: number, length: number, final: boolean): number | "never" | "not yet" {
  const blank = text.slice(at + length).search(BLANK_LINE);
  const paragraphEnd = blank === -1 ? text.length : at + length + blank;
  for (let run = text.indexOf("`", at + length); run !== -1 && run < paragraphEnd; ) {
    const runEnd = run + runLength(text, run);
    if (runEnd === text.length && !final) return "not yet";
    if (runEnd - run === length) return runEnd;
    run = text.indexOf("`", runEnd);
  }
  return blank !== -1 || final ? "never" : "not yet";
}

export function markerScanner(verdictOf: (id: string) => Verdict): MarkerScanner {
  let context = TEXT;
  /** Whether the next character starts a line of the text that has passed. */
  let lineStart = true;
  /** White space in text, held until what follows it decides it: a removed marker takes it. */
  let spaces = "";
  /** The text not decided yet: it waits for the characters that decide it. */
  let pending = "";
  /** The scan's output so far. */
  let text = "";
  let markers: Marker[] = [];

  /** Passes `out` on, after the white space held before it. */
  function pass(out: string): void {
    text += spaces + out;
    spaces = "";
    if (out !== "") lineStart = out.endsWith("\n");
  }

  /** Takes a marker out of the text, with the white space before it. */
  function remove(): void {
    spaces = "";
  }

  /**
   * An open "[". It is a citation marker when it closes as an id. When "(" follows its "]", it is link
   * text, or an image's alt text after "!", and passes as text. It waits while it is at most 120
   * characters long and its next character has not arrived; past that, or at the message's end, it is
   * decided.
   */
  function bracket(input: string, at: number, final: boolean): number | null {
    let end = at + 1;
    while (end < input.length && ID_CHARACTER.test(input[end]!)) end++;
    if (end === input.length) {
      if (!final && end - at <= HOLD_CHARACTERS) return null;
      pass(input.slice(at, end));
      return end - at;
    }
    // No id holds this character, so the text from "[" up to it is text.
    if (input[end] !== "]") {
      pass(input.slice(at, end));
      return end - at;
    }
    const marker = input.slice(at, end + 1);
    if (end + 1 === input.length && !final && marker.length <= HOLD_CHARACTERS) return null;
    if (input[end + 1] === "(") {
      pass(marker);
      return marker.length;
    }
    const id = marker.slice(1, -1);
    const verdict = verdictOf(id);
    if (verdict !== "not-a-citation") markers.push({ kind: "citation", id, verdict });
    if (verdict === "removed") remove();
    else pass(marker);
    return marker.length;
  }

  /**
   * A "<": text, or the start of a <<…>> marker, which is held until its ">>", so no part of a long
   * follow-up question reaches the text. A "<<" that never closes is text at the message's end, and the
   * scan goes on from its second "<", so the markers after it are still checked.
   */
  function angle(input: string, at: number, final: boolean): number | null {
    if (at + 1 === input.length && !final) return null;
    if (input[at + 1] !== "<") {
      pass("<");
      return 1;
    }
    const close = input.indexOf(">>", at + 2);
    if (close === -1) {
      if (!final) return null;
      pass("<");
      return 1;
    }
    markers.push(markerIn(input.slice(at + 2, close)));
    remove();
    return close + 2 - at;
  }

  /**
   * A run of backticks, or of tildes at a line's start. At a line's start, a run of 3 or more opens
   * fenced code (a backtick fence's info text holds no backtick, so it waits for its line's end). A run
   * of backticks otherwise opens a code span, which passes whole once its closing run arrives. A run
   * that opens neither is text, and the scan goes on after it.
   */
  function code(input: string, at: number, final: boolean): number | null {
    const mark = input[at]!;
    const length = runLength(input, at);
    if (at + length === input.length && !final) return null;
    if (lineStart && length >= FENCE_LENGTH) {
      const end = lineEnd(input, at + length);
      if (mark === "`" && end === input.length && !final) return null;
      if (mark === "~" || !input.slice(at + length, end).includes("`")) {
        pass(input.slice(at, end));
        context = { in: "fenced code", mark, length };
        return end - at;
      }
    }
    if (mark === "`") {
      const end = codeSpanEnd(input, at, length, final);
      if (end === "not yet") return null;
      if (end !== "never") {
        pass(input.slice(at, end));
        return end - at;
      }
    }
    pass(input.slice(at, at + length));
    return length;
  }

  /** Decides the text from `at` in text: returns how many characters it decided, or null when it must wait. */
  function inText(input: string, at: number, final: boolean): number | null {
    const character = input[at]!;
    if (character === " " || character === "\t") {
      spaces += character;
      return 1;
    }
    if (character === "`" || (character === "~" && lineStart)) return code(input, at, final);
    if (character === "[") return bracket(input, at, final);
    if (character === "<") return angle(input, at, final);
    const end = nextSpecial(input, at + 1);
    pass(input.slice(at, end));
    return end - at;
  }

  /** Decides the text from `at` in fenced code, line by line, until a fence of its mark that is at least as long. */
  function inFencedCode(input: string, at: number, final: boolean, mark: string, length: number): number | null {
    if (input[at] === "\n") {
      pass("\n");
      return 1;
    }
    const line = input.slice(at, lineEnd(input, at));
    if (lineStart) {
      if (at + line.length === input.length && !final && FENCE_PREFIX.test(line)) return null;
      const fence = CLOSING_FENCE.exec(line)?.[1];
      if (fence !== undefined && fence[0] === mark && fence.length >= length) context = TEXT;
    }
    pass(line);
    return line.length;
  }

  function step(input: string, at: number, final: boolean): number | null {
    switch (context.in) {
      case "text":
        return inText(input, at, final);
      case "fenced code":
        return inFencedCode(input, at, final, context.mark, context.length);
    }
  }

  function run(input: string, final: boolean): Scan {
    text = "";
    markers = [];
    let at = 0;
    while (at < input.length) {
      const used = step(input, at, final);
      if (used === null) break;
      at += used;
    }
    pending = input.slice(at);
    // At the end, the held white space passes as text.
    if (final) pass("");
    return { text, markers };
  }

  return {
    scan: (delta) => run(pending + delta, false),
    end: () => run(pending, true),
  };
}
