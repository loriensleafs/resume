// Seam 3 of SPEC-knowledge: the id grammar, including the forms the build never makes.

import { describe, expect, test } from "bun:test";
import { highlightId, logisticsId, parseId, roleId, skillsId, toSlug, type IdForm } from "../ids";

const slug60 = "a".repeat(60);

describe("parseId", () => {
  test.each<[string, IdForm]>([
    ["basics", { form: "basics" }],
    ["education", { form: "education" }],
    ["role:fednow", { form: "role", role: "fednow" }],
    [`role:${slug60}`, { form: "role", role: slug60 }],
    ["highlight:highspot.3", { form: "highlight", role: "highspot", n: 3 }],
    ["highlight:acme.9007199254740991", { form: "highlight", role: "acme", n: 9007199254740991 }],
    ["skills:ai-platform", { form: "skills", slug: "ai-platform" }],
    ["logistics:work-arrangement", { form: "logistics", topic: "work-arrangement" }],
    ["fednow-architecture", { form: "source", source: "fednow-architecture" }],
    [slug60, { form: "source", source: slug60 }],
    ["fednow-architecture.3", { form: "passage", source: "fednow-architecture", n: 3 }],
    [`${slug60}.999`, { form: "passage", source: slug60, n: 999 }],
  ])("reads %p", (id, form) => {
    expect(parseId(id)).toEqual(form);
  });

  test.each([
    ["an empty id", ""],
    ["a capital letter", "Basics"],
    ["a trailing newline", "basics\n"],
    ["an underscore", "fednow_architecture"],
    ["two hyphens together", "fednow--architecture"],
    ["a hyphen at the start", "-fednow"],
    ["a hyphen at the end", "fednow-"],
    ["a 61-character source id", "a".repeat(61)],
    ["a 65-character passage id", `${slug60}.1000`],
    ["passage number 0", "fednow-architecture.0"],
    ["a leading zero", "fednow-architecture.01"],
    ["a passage of basics", "basics.1"],
    ["a passage of education", "education.1"],
    ["a dot with no source id", ".1"],
    ["a number past the safe integers", "fednow.9007199254740993"],
    ["an empty role id", "role:"],
    ["a second colon", "role:acme:two"],
    ["a 61-character role id", `role:${"a".repeat(61)}`],
    ["a highlight with no number", "highlight:acme"],
    ["highlight number 0", "highlight:acme.0"],
    ["a highlight number with a leading zero", "highlight:acme.01"],
    ["a dot in the role id", "highlight:acme.1.2"],
    ["a 400-digit highlight number", `highlight:acme.${"9".repeat(400)}`],
    ["an empty skills slug", "skills:"],
    ["an empty logistics topic", "logistics:"],
    ["an unknown prefix", "deep:fednow-architecture"],
  ])("gives no form for %s", (_, id) => {
    expect(parseId(id)).toBeUndefined();
  });
});

describe("the id builders", () => {
  test("give ids that parseId reads back", () => {
    expect(roleId("fednow")).toBe("role:fednow");
    expect(highlightId("highspot", 3)).toBe("highlight:highspot.3");
    expect(skillsId("Platform and tooling")).toBe("skills:platform-and-tooling");
    expect(logisticsId("work-arrangement")).toBe("logistics:work-arrangement");
    expect(parseId(highlightId("highspot", 3))).toEqual({ form: "highlight", role: "highspot", n: 3 });
  });

  test("toSlug makes each run of other characters one hyphen, with none at either end", () => {
    expect(toSlug("  AI / Platform & Tooling!  ")).toBe("ai-platform-tooling");
    expect(toSlug("+++")).toBe("");
  });
});
