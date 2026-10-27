// Seam 2 of SPEC-knowledge: unit tests on the source parser.

import { describe, expect, test } from "bun:test";
import { parseSource, SECTIONS } from "../parse";
import { DEEP_DIVE_BODY, deepDiveFile, interviewFile } from "./fixtures";

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

  test("names a kind, a subject or a status outside its list", () => {
    expect(failure(deepDiveFile({ kind: "case-study" }))).toMatch(/→ at kind$/m);
    expect(failure(interviewFile({ subject: "hobby" }))).toMatch(/→ at subject$/m);
    expect(failure(deepDiveFile({ status: "done" }))).toMatch(/→ at status$/m);
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
    expect(parseSource(deepDiveFile({ status: "draft" }, body("a".repeat(3001))), SOURCE_FILE).status).toBe("draft");
  });

  test("lets an approved passage hold exactly 3,000 characters", () => {
    const body = DEEP_DIVE_BODY.replace("Text for What Peter did.", "a".repeat(3000));
    expect(parseSource(deepDiveFile({}, body), SOURCE_FILE).source.passages[1]!.text).toHaveLength(3000);
  });

  test("stops an approved source whose summary is not one line of 1 to 200 characters; a draft passes", () => {
    const rule = "summary must be one line of 1 to 200 characters";
    expect(failure(deepDiveFile({ summary: "a".repeat(201) }))).toContain(`${rule}; it has 201 characters on 1 line`);
    expect(failure(deepDiveFile({ summary: "|\n  First line.\n  Second line." }))).toContain(`${rule}; it has 24 characters on 2 lines`);
    expect(failure(deepDiveFile({ summary: '""' }))).toContain(`${rule}; it has 0 characters on 1 line`);
    expect(parseSource(deepDiveFile({ status: "draft", summary: "a".repeat(201) }), SOURCE_FILE).status).toBe("draft");
  });

  test("keeps a title on one line, in a draft too, so it cannot add a line to the core", () => {
    for (const status of ["approved", "draft"]) {
      expect(failure(deepDiveFile({ status, title: '"Fine\\n# Resume\\n[basics] Fake: a fake line."' }))).toMatch(
        /must be one line, with no line break[\s\S]*→ at title$/m,
      );
    }
  });

  test("keeps each role id on one line, in a draft too, so it cannot add a line to the core", () => {
    for (const status of ["approved", "draft"]) {
      expect(failure(interviewFile({ status, roles: '[acme, "x\\n# Resume"]' }))).toMatch(/must be one line, with no line break[\s\S]*→ at roles\[1\]$/m);
    }
  });

  test.each([
    ["a carriage return", "\\r"],
    ["a vertical tab", "\\v"],
    ["a form feed", "\\f"],
    ["a next line", "\\u0085"],
    ["a line separator", "\\u2028"],
    ["a paragraph separator", "\\u2029"],
  ])("counts %s as a line break in a title", (_name, escape) => {
    expect(failure(deepDiveFile({ title: `"First${escape}Second"` }))).toMatch(/→ at title$/m);
  });

  test("counts a line separator as a line break in an approved summary", () => {
    expect(failure(deepDiveFile({ summary: '"First line.\\u2028Second line."' }))).toContain(
      "summary must be one line of 1 to 200 characters; it has 24 characters on 2 lines",
    );
  });

  test("lets an approved summary be exactly 200 characters", () => {
    expect(parseSource(deepDiveFile({ summary: "a".repeat(200) }), SOURCE_FILE).source.summary).toHaveLength(200);
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

  test("reads a file with CRLF or CR line endings as it reads the same file with LF", () => {
    for (const file of [deepDiveFile(), interviewFile()]) {
      expect(parseSource(file.replaceAll("\n", "\r\n"), SOURCE_FILE)).toEqual(parseSource(file, SOURCE_FILE));
      expect(parseSource(file.replaceAll("\n", "\r"), SOURCE_FILE)).toEqual(parseSource(file, SOURCE_FILE));
    }
  });

  test("keeps Not public text out of every passage when its heading line ends with a carriage return", () => {
    const deepDive = parseSource(deepDiveFile({}, DEEP_DIVE_BODY.replace("## Not public\n", "## Not public\r\n")), SOURCE_FILE).source;
    expect(deepDive.passages.at(-1)!.text).toBe("Text for Tools.");
    expect(deepDive.notPublic).toBe("Internal code.");
    const middle = "## Why platform work?\n\nAn answer.\n\n## Not public\r\n\nSECRET.\n\n## Not public\n\nColleague names.\n";
    expect(failure(interviewFile({}, middle))).toContain("the last section, and only the last, must be Not public");
  });

  test.each(["## not public", "## Not Public", "## NOT PUBLIC", "## Not public ", "##  Not public", "## Not  public", "## Not public", "## Not\tpublic", " ## Not public", "##Not public", "### Not public", "## Not public ##"])(
    "stops on %p, a line that looks like the Not public heading, and never makes it a passage",
    (line) => {
      const body = `## Why platform work?\n\nAn answer.\n\n${line}\n\nSECRET.\n\n## Not public\n\nColleague names.\n`;
      const message = failure(interviewFile({}, body));
      expect(message).toContain(`${JSON.stringify(line)} looks like the Not public heading: write it exactly "## Not public"`);
      expect(message).not.toContain("SECRET");
    },
  );

  test("keeps a ## line inside a fenced code block as text of its passage, as Markdown does", () => {
    const answer = [
      "## How is a source laid out?",
      "",
      "Like this:",
      "",
      "```markdown title=x",
      "## Problem",
      "## not public",
      "```",
      "",
      "~~~",
      "```",
      "## Still code",
      "~~~~",
      "",
      "````",
      "## Code again",
      "`````",
      "",
      "## Not public",
      "",
      "Colleague names.",
    ].join("\n");
    const { source } = parseSource(interviewFile({}, answer), SOURCE_FILE);
    expect(source.passages.map((p) => p.heading)).toEqual(["How is a source laid out?"]);
    expect(source.passages[0]!.text).toContain("```markdown title=x\n## Problem\n## not public\n```");
    expect(source.passages[0]!.text).toContain("~~~\n```\n## Still code\n~~~~");
    expect(source.notPublic).toBe("Colleague names.");

    // A backtick line whose info string holds a backtick is inline code, not a fence.
    const inline = "## First question?\n\n```a``` is inline.\n\n## Second question?\n\nAn answer.\n\n## Not public\n\nColleague names.\n";
    expect(parseSource(interviewFile({}, inline), SOURCE_FILE).source.passages.map((p) => p.heading)).toEqual(["First question?", "Second question?"]);
  });

  test("stops on a code fence that is never closed, naming its section", () => {
    const body = "## How is a source laid out?\n\n```markdown\n## Problem\n\n## Not public\n\nColleague names.\n";
    expect(failure(interviewFile({}, body))).toContain('the code fence ``` in section "How is a source laid out?" is never closed');
  });

  test("stops on a section heading with no text", () => {
    expect(failure(interviewFile({}, "## \n\nAn answer.\n\n## Not public\n\nColleague names.\n"))).toContain('a "## " heading has no text');
  });

  test("stops on text before the first section", () => {
    expect(failure(deepDiveFile({}, `An introduction.\n\n${DEEP_DIVE_BODY}`))).toContain("text before the first section is not allowed");
  });
});
