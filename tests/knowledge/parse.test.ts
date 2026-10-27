// Seam 2 of SPEC-knowledge: the deep-dive parser and its rules.

import { describe, expect, test } from "bun:test";
import { parseDeepDive, SECTIONS } from "../../src/knowledge/parse";
import { deepDive } from "./fixtures";

const FILE = "knowledge/deep-dives/sample.md";

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
