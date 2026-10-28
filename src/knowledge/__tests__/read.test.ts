// Seam 1 of SPEC-knowledge: readPassages() on buildKnowledge()'s output, by the readPassages()
// rules. Each expected text is written out in full, as the chat's read tool gets it.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { buildKnowledge } from "../build";
import { readLimits, readPassages } from "../read";
import type { Knowledge } from "../types";
import { deepDiveFile, fixture, interviewFile, removeFixtures } from "./fixtures";

afterAll(removeFixtures);

/**
 * Two approved sources and a draft. `beta` sorts after `alpha`, so a text that follows the order
 * the ids were asked in, not source-id order, puts `beta` first when it is asked for first.
 */
const SOURCES = {
  "knowledge/sources/alpha.md": deepDiveFile({ id: "alpha", title: "The first thing" }),
  "knowledge/sources/beta.md": interviewFile({ id: "beta", title: "Why platform work" }),
  "knowledge/sources/draft-one.md": deepDiveFile({ id: "draft-one", title: "A draft", status: "draft", approved: null }),
};

/** buildKnowledge()'s output on SOURCES, built once: readPassages() changes nothing in it. */
let knowledge: Knowledge;
beforeAll(async () => {
  knowledge = await buildKnowledge({ root: await fixture("read", SOURCES) });
});

/** The approved deep dive `alpha` read whole: its header, its five passages in file order, then Not public. */
const ALPHA_WHOLE = [
  "# [alpha] The first thing",
  "Deep dive: written from Peter's answers, in the third person.",
  "Roles: acme. Highlights: highlight:acme.1.",
  "",
  "## [alpha.1] Problem",
  "Text for Problem.",
  "",
  "## [alpha.2] What Peter did",
  "Text for What Peter did.",
  "",
  "## [alpha.3] How it worked",
  "Text for How it worked.",
  "",
  "## [alpha.4] Result",
  "Text for Result.",
  "",
  "## [alpha.5] Tools",
  "Text for Tools.",
  "",
  "## Not public: decline to describe these kinds of material",
  "Internal code.",
  "",
].join("\n");

describe("readPassages on buildKnowledge's output", () => {
  test("reads a source id as all its passages in file order, with its header and Not public once", () => {
    expect(readPassages(knowledge, ["alpha"])).toEqual({ text: ALPHA_WHOLE, read: ["alpha"], unknown: [], skipped: [] });
  });

  test("reads a passage id as that one passage, with its source's header and Not public", () => {
    expect(readPassages(knowledge, ["beta.2"])).toEqual({
      text: [
        "# [beta] Why platform work",
        "Interview: Peter's own words, in the first person.",
        "Roles: acme.",
        "",
        "## [beta.2] Why front-end platform work? (continued)",
        "And I like seeing a whole team move faster.",
        "",
        "## Not public: decline to describe these kinds of material",
        "Colleague names.",
        "",
      ].join("\n"),
      read: ["beta.2"],
      unknown: [],
      skipped: [],
    });
  });

  test("puts a draft's id, a resume entry id and every other id it does not know in unknown, each once, in the order asked", () => {
    const ids = [
      "draft-one", // a draft source
      "draft-one.1", // a draft's passage
      "basics", // resume entries, which are in the core
      "role:acme",
      "highlight:acme.1",
      "__proto__", // property names of every object
      "constructor",
      "alpha.6", // a passage number past alpha's last passage
      "alpha.0",
      "Alpha",
      "",
      "draft-one", // asked twice
      "__proto__",
    ];
    expect(readPassages(knowledge, ids)).toEqual({
      text: "",
      read: [],
      unknown: ["draft-one", "draft-one.1", "basics", "role:acme", "highlight:acme.1", "__proto__", "constructor", "alpha.6", "alpha.0", "Alpha", ""],
      skipped: [],
    });
  });

  test("reads the ids it knows and names the ones it does not, each list in the order asked", () => {
    const { read, unknown } = readPassages(knowledge, ["nope", "beta.1", "__proto__", "alpha", "nope"]);
    expect({ read, unknown }).toEqual({ read: ["beta.1", "alpha"], unknown: ["nope", "__proto__"] });
  });

  test("groups the passages by source, in the order each source first appears, in file order within a source, with one header and one Not public per source", () => {
    expect(readPassages(knowledge, ["beta.3", "alpha.4", "beta.1", "alpha.2"])).toEqual({
      text: [
        "# [beta] Why platform work",
        "Interview: Peter's own words, in the first person.",
        "Roles: acme.",
        "",
        "## [beta.1] Why front-end platform work?",
        "I like building what other engineers use.",
        "",
        "## [beta.3] How did you help with the migration?",
        "I helped plan it.",
        "",
        "## Not public: decline to describe these kinds of material",
        "Colleague names.",
        "",
        "# [alpha] The first thing",
        "Deep dive: written from Peter's answers, in the third person.",
        "Roles: acme. Highlights: highlight:acme.1.",
        "",
        "## [alpha.2] What Peter did",
        "Text for What Peter did.",
        "",
        "## [alpha.4] Result",
        "Text for Result.",
        "",
        "## Not public: decline to describe these kinds of material",
        "Internal code.",
        "",
      ].join("\n"),
      read: ["beta.3", "alpha.4", "beta.1", "alpha.2"],
      unknown: [],
      skipped: [],
    });
  });

  test("adds nothing for an id whose passages are already in the text, and lists each id once in read", () => {
    expect(readPassages(knowledge, ["alpha", "alpha.2", "alpha", "alpha.2"])).toEqual({
      text: ALPHA_WHOLE,
      read: ["alpha", "alpha.2"],
      unknown: [],
      skipped: [],
    });
  });

  test("reads a passage id, then its source id, as the whole source once, in file order", () => {
    expect(readPassages(knowledge, ["alpha.4", "alpha"])).toEqual({ text: ALPHA_WHOLE, read: ["alpha.4", "alpha"], unknown: [], skipped: [] });
  });

  test("widens a source's group when a later source id names all of it, keeping the source where it first appears, with no passage twice", () => {
    expect(readPassages(knowledge, ["alpha.2", "beta", "alpha"])).toEqual({
      text: [
        ALPHA_WHOLE,
        "# [beta] Why platform work",
        "Interview: Peter's own words, in the first person.",
        "Roles: acme.",
        "",
        "## [beta.1] Why front-end platform work?",
        "I like building what other engineers use.",
        "",
        "## [beta.2] Why front-end platform work? (continued)",
        "And I like seeing a whole team move faster.",
        "",
        "## [beta.3] How did you help with the migration?",
        "I helped plan it.",
        "",
        "## Not public: decline to describe these kinds of material",
        "Colleague names.",
        "",
      ].join("\n"),
      read: ["alpha.2", "beta", "alpha"],
      unknown: [],
      skipped: [],
    });
  });

  test("gives an empty text and empty lists when no id is asked for", () => {
    expect(readPassages(knowledge, [])).toEqual({ text: "", read: [], unknown: [], skipped: [] });
  });
});

describe("readLimits on the ids of one read", () => {
  test("are 20 ids of at most 64 characters, and 24,000 characters of text", () => {
    expect(readLimits).toEqual({ ids: 20, idCharacters: 64, characters: 24_000 });
  });

  test("throws on more than 20 ids, and reads 20", () => {
    const ids = Array.from({ length: 21 }, (_, i) => `nope-${i + 1}`);
    expect(() => readPassages(knowledge, ids)).toThrow("readPassages() takes at most 20 ids; it got 21");
    expect(readPassages(knowledge, ids.slice(0, 20)).unknown).toHaveLength(20);
  });

  test("throws on an id over 64 characters, and takes one of 64", () => {
    expect(() => readPassages(knowledge, ["alpha", "a".repeat(65)])).toThrow(
      "readPassages() takes ids of at most 64 characters; the id at position 2 has 65",
    );
    expect(readPassages(knowledge, ["a".repeat(64)]).unknown).toEqual(["a".repeat(64)]);
  });

  test("counts an id's characters as code points, as the read tool's schema does: 64 emoji are unknown, 65 throw", () => {
    // An emoji is two UTF-16 units, so 64 of them are a string of length 128. zod's string max()
    // counts code points, so the read tool's schema lets them through; readPassages() must not throw.
    expect(readPassages(knowledge, ["😀".repeat(64)]).unknown).toEqual(["😀".repeat(64)]);
    expect(() => readPassages(knowledge, ["😀".repeat(65)])).toThrow("the id at position 1 has 65");
  });
});

/** An approved interview whose answers hold `answers` characters each, under "Question <n>?". */
const interviewOf = (id: string, title: string, answers: number[]) =>
  interviewFile(
    { id, title },
    [...answers.map((n, i) => `## Question ${i + 1}?\n\n${"a".repeat(n)}\n`), "## Not public\n\nColleague names.\n"].join("\n"),
  );

/**
 * SOURCES, and three sources sized against the limit. `long`, with eight answers of 2,900 characters,
 * renders to 23,571 characters: the header (85), each answer's heading line and the blank line before
 * it (26 each), and Not public with its blank line and the final line break (78). `fill-a` and
 * `fill-b` each hold one answer, of 241 and 242 characters, and render to 428 and 429: the header
 * (81), the heading (28) and Not public (78). One blank line, one character, parts two sources. So
 * `long` then `fill-a` is exactly 24,000 characters, and `long` then `fill-b` is 24,001. `long.1`
 * alone renders to 3,089 (85, 26 and 2,900, then 78), and with `fill-b` after it to 3,519.
 */
const SIZED_SOURCES = {
  ...SOURCES,
  "knowledge/sources/long.md": interviewOf("long", "Long answers", Array(8).fill(2900)),
  "knowledge/sources/fill-a.md": interviewOf("fill-a", "Filler", [241]),
  "knowledge/sources/fill-b.md": interviewOf("fill-b", "Filler", [242]),
};

describe("readPassages at the 24,000-character limit", () => {
  let sized: Knowledge;
  beforeAll(async () => {
    sized = await buildKnowledge({ root: await fixture("read-limit", SIZED_SOURCES) });
  });

  /** A read with its text's length in place of the text, to set against SIZED_SOURCES' sizes. */
  const measured = (ids: string[]) => {
    const result = readPassages(sized, ids);
    return { ...result, text: result.text.length };
  };

  test("reads a text of exactly 24,000 characters, and stops at the id that would make it 24,001: headers, passages, Not public and the blank line between sources all count", () => {
    expect(measured(["long", "fill-a"])).toEqual({ text: 24_000, read: ["long", "fill-a"], unknown: [], skipped: [] });
    expect(measured(["long", "fill-b"])).toEqual({ text: 23_571, read: ["long"], unknown: [], skipped: ["fill-b"] });
  });

  test("counts a source's group as it widens where the source first appears, not as text added at the end", () => {
    expect(measured(["long.1", "fill-a", "long"])).toEqual({ text: 24_000, read: ["long.1", "fill-a", "long"], unknown: [], skipped: [] });
    expect(measured(["long.1", "fill-b", "long"])).toEqual({ text: 3_519, read: ["long.1", "fill-b"], unknown: [], skipped: ["long"] });
  });

  test("stops at the id that would take the text past the limit: that id and every later id it knows go to skipped in order, also one that would fit", () => {
    // `beta.1` (252 characters) and `alpha` (426) would each fit after `long`, but the read has stopped.
    expect(measured(["long", "fill-b", "beta.1", "alpha"])).toEqual({ text: 23_571, read: ["long"], unknown: [], skipped: ["fill-b", "beta.1", "alpha"] });
  });

  test("still names each later unknown id once after the stop, in the order asked", () => {
    const { unknown, skipped } = readPassages(sized, ["long", "fill-b", "nope", "beta", "nope", "draft-one", "__proto__", "beta"]);
    expect({ unknown, skipped }).toEqual({ unknown: ["nope", "draft-one", "__proto__"], skipped: ["fill-b", "beta"] });
  });

  test("puts a later id whose passages are already in the text in read, not skipped, so read names every id whose text is in the result", () => {
    expect(measured(["long", "fill-b", "long.2", "long", "fill-b"])).toEqual({ text: 23_571, read: ["long", "long.2"], unknown: [], skipped: ["fill-b"] });
  });
});
