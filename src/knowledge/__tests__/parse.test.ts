// Seam 2 of SPEC-knowledge: unit tests on the source parser. parseDeepDive() is the old
// contract's parser, and its tests go with it in K4.

import { describe, expect, test } from "bun:test";
import { parseDeepDive, parseSource, SECTIONS } from "../parse";
import { DEEP_DIVE_BODY, deepDive, deepDiveFile, interviewFile } from "./fixtures";

const FILE = "knowledge/deep-dives/sample.md";
const SOURCE_FILE = "knowledge/sources/sample.md";

/** The message parseSource() stops with on `text`; it must start with the file it names. */
function failure(text: string, file = SOURCE_FILE): string {
  let message: string | undefined;
  try {
    parseSource(text, file);
  } catch (e) {
    message = (e as Error).message;
  }
  expect(message).toStartWith(`${file}: `);
  return message!;
}

describe("parseSource", () => {
  test("reads an approved deep dive: its front matter, numbered passages and Not public text", () => {
    expect(parseSource(deepDiveFile(), SOURCE_FILE)).toEqual({
      status: "approved",
      source: {
        id: "sample",
        title: "A sample deep dive",
        kind: "deep-dive",
        subject: "project",
        roles: ["acme"],
        highlights: ["highlight:acme.1"],
        summary: "How Peter built the first thing.",
        links: [],
        notPublic: "Internal code.",
        passages: [
          { id: "sample.1", heading: "Problem", text: "Text for Problem." },
          { id: "sample.2", heading: "What Peter did", text: "Text for What Peter did." },
          { id: "sample.3", heading: "How it worked", text: "Text for How it worked." },
          { id: "sample.4", heading: "Result", text: "Text for Result." },
          { id: "sample.5", heading: "Tools", text: "Text for Tools." },
        ],
      },
    });
  });

  test("reads an interview: each question is a passage, a (continued) one too, and it needs no highlights field", () => {
    const { source } = parseSource(interviewFile(), SOURCE_FILE);
    expect(source.kind).toBe("interview");
    expect(source.highlights).toEqual([]);
    expect(source.passages).toEqual([
      { id: "sample.1", heading: "Why front-end platform work?", text: "I like building what other engineers use." },
      { id: "sample.2", heading: "Why front-end platform work? (continued)", text: "And I like seeing a whole team move faster." },
      { id: "sample.3", heading: "How did you help with the migration?", text: "I helped plan it." },
    ]);
    expect(source.notPublic).toBe("Colleague names.");
  });

  test("lets a (continued) heading come only directly after the heading it continues", () => {
    const answer = (heading: string) => `## ${heading}\n\nAn answer.\n`;
    const body = (...headings: string[]) => [...headings, "Not public"].map(answer).join("\n");
    const chain = body("Why platform work?", "Why platform work? (continued)", "Why platform work? (continued)");
    expect(parseSource(interviewFile({}, chain), SOURCE_FILE).source.passages).toHaveLength(3);

    expect(failure(interviewFile({}, body("Why platform work?", "Another question?", "Why platform work? (continued)")))).toContain(
      '"Why platform work? (continued)" must come directly after "Why platform work?"',
    );
    expect(failure(interviewFile({}, body("Why platform work? (continued)")))).toContain(
      '"Why platform work? (continued)" must come directly after "Why platform work?"',
    );
  });

  test("needs Not public as the last section of an interview, after at least one question", () => {
    const missing = "## Why platform work?\n\nAn answer.\n";
    expect(failure(interviewFile({}, missing))).toContain("the last section, and only the last, must be Not public. Found: Why platform work?");
    const middle = "## Why platform work?\n\nAn answer.\n\n## Not public\n\nColleague names.\n\n## Another question?\n\nAn answer.\n";
    expect(failure(interviewFile({}, middle))).toContain(
      "the last section, and only the last, must be Not public. Found: Why platform work?, Not public, Another question?",
    );
    const twice = "## Why platform work?\n\nAn answer.\n\n## Not public\n\nColleague names.\n\n## Not public\n\nInternal links.\n";
    expect(failure(interviewFile({}, twice))).toContain("the last section, and only the last, must be Not public");
    expect(failure(interviewFile({}, "## Not public\n\nColleague names.\n"))).toContain("an interview needs at least one question before Not public");
  });

  test("stops a deep dive with a missing, unknown or moved section, and names the six in order", () => {
    const sections = (...headings: string[]) => headings.map((h) => `## ${h}\n\nText.\n`).join("\n");
    const expected = "a deep dive's sections must be, in order: Problem, What Peter did, How it worked, Result, Tools, Not public.";
    const missing = sections("Problem", "What Peter did", "How it worked", "Tools", "Not public");
    expect(failure(deepDiveFile({}, missing))).toContain(`${expected} Found: Problem, What Peter did, How it worked, Tools, Not public`);
    const unknown = sections(...SECTIONS.slice(0, 5), "Lessons", "Not public");
    expect(failure(deepDiveFile({}, unknown))).toContain(`${expected} Found: Problem, What Peter did, How it worked, Result, Tools, Lessons, Not public`);
    const moved = sections("What Peter did", "Problem", ...SECTIONS.slice(2));
    expect(failure(deepDiveFile({}, moved))).toContain(`${expected} Found: What Peter did, Problem`);
  });

  test("needs front matter between --- lines, written in YAML", () => {
    expect(failure(DEEP_DIVE_BODY)).toContain("must start with front matter between --- lines");
    expect(failure(deepDiveFile({ summary: "Peter: what he built." }))).toContain("front matter is not YAML:");
  });

  test("reads front matter with a strict schema, so an unknown field is named", () => {
    expect(failure(deepDiveFile({ roles: null, role: "acme" }))).toMatch(/Unrecognized key: "role"/);
  });

  test.each(["id", "title", "kind", "subject", "summary", "status", "source"])("names the field %s when it is missing", (field) => {
    expect(failure(deepDiveFile({ [field]: null }))).toMatch(new RegExp(`→ at ${field}$`, "m"));
  });

  test("names a kind or a subject outside its list", () => {
    expect(failure(deepDiveFile({ kind: "case-study" }))).toMatch(/→ at kind$/m);
    expect(failure(interviewFile({ subject: "hobby" }))).toMatch(/→ at subject$/m);
  });

  test("reads roles, highlights and links that are left out as empty lists", () => {
    const { source } = parseSource(deepDiveFile({ roles: null, highlights: null, links: null }), SOURCE_FILE);
    expect([source.roles, source.highlights, source.links]).toEqual([[], [], []]);
  });

  test("needs each highlight in the form highlight:<role id>.<n>, and names the one that is not", () => {
    expect(failure(deepDiveFile({ highlights: "[1]" }))).toMatch(/expected string[\s\S]*→ at highlights\[0\]/);
    expect(failure(deepDiveFile({ highlights: "[highlight:acme.1, highlight:acme.0]" }))).toMatch(
      /not a highlight id: use highlight:<role id>\.<n>[\s\S]*→ at highlights\[1\]/,
    );
    expect(failure(deepDiveFile({ highlights: "[role:acme]" }))).toMatch(/not a highlight id[\s\S]*→ at highlights\[0\]/);
    expect(failure(deepDiveFile({ highlights: "[highlight:Acme.1]" }))).toMatch(/not a highlight id[\s\S]*→ at highlights\[0\]/);
  });

  test("lets only a deep dive have highlights", () => {
    expect(failure(interviewFile({ highlights: "[highlight:acme.1]" }))).toMatch(/only a deep dive may have highlights[\s\S]*→ at highlights/);
    expect(parseSource(interviewFile({ highlights: "[]" }), SOURCE_FILE).source.highlights).toEqual([]);
  });

  test("needs the date Peter approved an approved source, as a real date; a draft needs none", () => {
    expect(failure(deepDiveFile({ approved: null }))).toMatch(/an approved source needs the date Peter approved it[\s\S]*→ at approved/);
    expect(failure(deepDiveFile({ approved: "" }))).toMatch(/an approved source needs the date Peter approved it[\s\S]*→ at approved/);
    expect(failure(deepDiveFile({ approved: "2026-02-30" }))).toMatch(/→ at approved/);
    expect(parseSource(deepDiveFile({ status: "draft", approved: "" }), SOURCE_FILE).status).toBe("draft");
  });

  test("needs the file name to be <id>.md", () => {
    expect(failure(deepDiveFile(), "knowledge/sources/other.md")).toContain("the file name must be sample.md, to match its id");
    // The whole file name must match: an id with a folder in it never names a file deeper down.
    expect(failure(deepDiveFile({ id: "sources/sample" }))).toContain("the file name must be sources/sample.md");
  });

  test("stops an approved source with a passage over 3,000 characters, and names the passage; a draft passes", () => {
    const body = (text: string) => DEEP_DIVE_BODY.replace("Text for What Peter did.", text);
    expect(failure(deepDiveFile({}, body("a".repeat(3001))))).toContain(
      'passage sample.2 ("What Peter did") has 3001 characters; an approved passage holds at most 3000',
    );
    expect(parseSource(deepDiveFile({}, body("a".repeat(3000))), SOURCE_FILE).source.passages[1]!.text).toHaveLength(3000);
    expect(parseSource(deepDiveFile({ status: "draft" }, body("a".repeat(3001))), SOURCE_FILE).status).toBe("draft");
  });

  test("stops an approved source whose summary is not one line of 1 to 200 characters; a draft passes", () => {
    const rule = "summary must be one line of 1 to 200 characters";
    expect(failure(deepDiveFile({ summary: "a".repeat(201) }))).toContain(`${rule}; it has 201 characters on 1 line`);
    expect(failure(deepDiveFile({ summary: "|\n  First line.\n  Second line." }))).toContain(`${rule}; it has 24 characters on 2 lines`);
    expect(failure(deepDiveFile({ summary: '""' }))).toContain(`${rule}; it has 0 characters on 1 line`);
    expect(parseSource(deepDiveFile({ summary: "a".repeat(200) }), SOURCE_FILE).source.summary).toHaveLength(200);
    expect(parseSource(deepDiveFile({ status: "draft", summary: "a".repeat(201) }), SOURCE_FILE).status).toBe("draft");
  });

  test("names every rule an approved source breaks, in one message", () => {
    const body = DEEP_DIVE_BODY.replace("Text for Problem.", "a".repeat(3001)).replace("Text for Tools.", "b".repeat(3002));
    expect(failure(deepDiveFile({ summary: "a".repeat(201) }, body))).toBe(
      `${SOURCE_FILE}: an approved source breaks these rules:\n` +
        "- summary must be one line of 1 to 200 characters; it has 201 characters on 1 line\n" +
        '- passage sample.1 ("Problem") has 3001 characters; an approved passage holds at most 3000\n' +
        '- passage sample.5 ("Tools") has 3002 characters; an approved passage holds at most 3000',
    );
  });

  test("checks a draft for shape: its front matter and its sections", () => {
    expect(failure(deepDiveFile({ status: "draft", approved: null, kind: "case-study" }))).toMatch(/→ at kind$/m);
    const missing = SECTIONS.filter((s) => s !== "Result").map((s) => `## ${s}\n\nText.\n`).join("\n");
    expect(failure(deepDiveFile({ status: "draft", approved: null }, missing))).toContain("a deep dive's sections must be, in order");
  });

  test("lets Not public be empty", () => {
    const body = DEEP_DIVE_BODY.replace("Internal code.", "");
    expect(parseSource(deepDiveFile({}, body), SOURCE_FILE).source.notPublic).toBe("");
  });

  test("stops on a section heading with no text", () => {
    expect(failure(interviewFile({}, "## \n\nAn answer.\n\n## Not public\n\nColleague names.\n"))).toContain('a "## " heading has no text');
  });

  test("stops on text before the first section", () => {
    expect(failure(deepDiveFile({}, `An introduction.\n\n${DEEP_DIVE_BODY}`))).toContain("text before the first section is not allowed");
  });
});

describe("parseDeepDive", () => {
  test("reads front matter and every section", () => {
    const d = parseDeepDive(deepDive(), FILE);
    expect(d.id).toBe("sample");
    expect(d.highlights).toEqual([1]);
    expect(d.approved).toBe("2026-10-27");
    expect(d.sections["What Peter did"]).toBe("Text for What Peter did.");
    expect(d.sections["Not public"]).toBe("");
  });

  test("requires front matter", () => {
    expect(() => parseDeepDive("## Problem\n", FILE)).toThrow(/front matter/);
  });

  test("requires the file name to match the id", () => {
    expect(() => parseDeepDive(deepDive(), "knowledge/deep-dives/other.md")).toThrow(/sample\.md/);
  });

  test("names a bad front-matter field", () => {
    const front = "id: sample\ntitle: T\nrole: acme\nstatus: done\nsource: S";
    expect(() => parseDeepDive(deepDive({ front }), FILE)).toThrow(/status/);
  });

  test("requires the approval date on an approved deep dive", () => {
    const front = "id: sample\ntitle: T\nrole: acme\nstatus: approved\nsource: S";
    expect(() => parseDeepDive(deepDive({ front }), FILE)).toThrow(/date Peter approved/);
  });

  test("requires every section, in order", () => {
    const missing = SECTIONS.filter((s) => s !== "Result").map((s) => `## ${s}\n\nText.\n`).join("\n");
    expect(() => parseDeepDive(deepDive({ body: missing }), FILE)).toThrow(/in order/);
    const swapped = ["What Peter did", "Problem", ...SECTIONS.slice(2)].map((s) => `## ${s}\n\nText.\n`).join("\n");
    expect(() => parseDeepDive(deepDive({ body: swapped }), FILE)).toThrow(/in order/);
  });

  test("rejects an unknown section and text before the first section", () => {
    const extra = SECTIONS.map((s) => `## ${s}\n\nText.\n`).join("\n") + "\n## Extra\n\nMore.\n";
    expect(() => parseDeepDive(deepDive({ body: extra }), FILE)).toThrow(/in order/);
    const preamble = "Intro text.\n\n" + SECTIONS.map((s) => `## ${s}\n\nText.\n`).join("\n");
    expect(() => parseDeepDive(deepDive({ body: preamble }), FILE)).toThrow(/before the first section/);
  });

  test("needs text in required sections only once approved", () => {
    const empty = SECTIONS.map((s) => `## ${s}\n`).join("\n");
    expect(() => parseDeepDive(deepDive({ body: empty }), FILE)).toThrow(/needs text in: Problem/);
    const draft = "id: sample\ntitle: T\nrole: acme\nstatus: draft\nsource: S";
    expect(parseDeepDive(deepDive({ front: draft, body: empty }), FILE).status).toBe("draft");
  });
});
