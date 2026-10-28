// Seam 1 of SPEC-knowledge: readPassages() on buildKnowledge()'s output, by the readPassages()
// rules. Each expected text is written out in full, as the chat's read tool gets it.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { buildKnowledge } from "../build";
import { readPassages } from "../read";
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

  test("gives an empty text and empty lists when no id is asked for", () => {
    expect(readPassages(knowledge, [])).toEqual({ text: "", read: [], unknown: [], skipped: [] });
  });
});
