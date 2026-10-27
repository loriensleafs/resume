// Seam 1 of SPEC-knowledge: buildKnowledge() on fixtures and on the real files, with renderCore()
// on its output.

import { afterAll, describe, expect, test } from "bun:test";
import { loadResume } from "../../content";
import { buildKnowledge } from "../build";
import { parseId } from "../ids";
import { renderCore } from "../render";
import { deepDiveFile, FAKE_PHONE, fixture, interviewFile, removeFixtures, RESUME_YAML } from "./fixtures";

const REPO = `${import.meta.dir}/../../..`;
afterAll(removeFixtures);

/** One approved logistics answer and one draft. */
const LOGISTICS_YAML =
  "topics:\n  - topic: location\n    answer: Seattle area.\n    status: approved\n    approved: 2026-10-27\n  - topic: availability\n    answer: Soon.\n    status: draft\n";

/**
 * Two approved sources and a draft. The file names sort the other way round from the source ids
 * ("alpha-beta.md" before "alpha.md"), so a list in file-name order fails the source-id order.
 */
const SOURCES = {
  "knowledge/sources/alpha-beta.md": interviewFile({ id: "alpha-beta", title: "Why platform work", roles: "[]" }),
  "knowledge/sources/alpha.md": deepDiveFile({ id: "alpha", title: "The first thing" }),
  "knowledge/sources/draft-one.md": deepDiveFile({ id: "draft-one", title: "A draft", status: "draft", approved: null }),
};

describe("buildKnowledge on fixtures", () => {
  test("orders the core: resume entries, approved logistics answers, then one catalog entry per approved source in source-id order", async () => {
    const root = await fixture("order", { ...SOURCES, "knowledge/logistics.yaml": LOGISTICS_YAML });
    const { core } = await buildKnowledge({ root });
    expect(core.map((e) => `${e.kind} ${e.id}`)).toEqual([
      "resume basics",
      "resume role:acme",
      "resume highlight:acme.1",
      "resume highlight:acme.2",
      "resume skills:platform-and-tooling",
      "resume education",
      "logistics logistics:location",
      "catalog alpha",
      "catalog alpha-beta",
    ]);
  });

  test("gives the approved sources in source-id order, each with its passages and Not public text", async () => {
    const root = await fixture("sources", SOURCES);
    const { sources } = await buildKnowledge({ root });
    expect(sources.map((s) => s.id)).toEqual(["alpha", "alpha-beta"]);
    expect(sources[0]!.passages.map((p) => p.id)).toEqual(["alpha.1", "alpha.2", "alpha.3", "alpha.4", "alpha.5"]);
    expect(sources[0]!.notPublic).toBe("Internal code.");
    expect(sources[1]!.passages.map((p) => p.heading)).toEqual([
      "Why front-end platform work?",
      "Why front-end platform work? (continued)",
      "How did you help with the migration?",
    ]);
  });

  test("keeps a draft source file out of the catalog and out of the sources", async () => {
    const root = await fixture("drafts", SOURCES);
    const knowledge = await buildKnowledge({ root });
    expect(knowledge.core.map((e) => e.id)).not.toContain("draft-one");
    expect(knowledge.sources.map((s) => s.id)).not.toContain("draft-one");
    expect(renderCore(knowledge)).not.toContain("draft-one");
  });

  test("renders the core in three parts; a catalog line gives the kind, the roles when there are any, and the summary", async () => {
    const root = await fixture("render", { ...SOURCES, "knowledge/logistics.yaml": LOGISTICS_YAML });
    expect(renderCore(await buildKnowledge({ root }))).toBe(
      [
        "# Resume",
        "",
        "[basics] Test Person: Engineer: A summary. Location: Boston, MA. Email: test@example.com.",
        "[role:acme] Acme: Engineer, 2020 – Present.",
        "[highlight:acme.1] Acme, highlight 1: Built the first thing.",
        "[highlight:acme.2] Acme, highlight 2: Built the second thing.",
        "[skills:platform-and-tooling] Skills: Platform and tooling: Bun",
        "[education] Education: A University",
        "",
        "# Job-search logistics",
        "",
        "[logistics:location] location: Seattle area.",
        "",
        "# Catalog",
        "",
        "[alpha] The first thing: deep-dive, roles acme. How Peter built the first thing.",
        "[alpha-beta] Why platform work: interview. Why Peter chose front-end platform work.",
        "",
      ].join("\n"),
    );
  });

  test("prints every heading of the core, also over a part with no entries", async () => {
    const root = await fixture("empty-parts", {});
    const text = renderCore(await buildKnowledge({ root }));
    expect(text).toContain("[education] Education: A University\n\n# Job-search logistics\n\n# Catalog\n");
    expect(text).toEndWith("# Catalog\n");
  });

  test("keeps private details out of the core and the sources", async () => {
    const root = await fixture("private", SOURCES);
    const knowledge = await buildKnowledge({ root });
    expect(renderCore(knowledge)).not.toContain(FAKE_PHONE);
    expect(JSON.stringify(knowledge)).not.toContain(FAKE_PHONE);
  });

  test("gives an empty catalog and no sources when knowledge/sources/ does not exist", async () => {
    const root = await fixture("no-sources", {});
    const knowledge = await buildKnowledge({ root });
    expect(knowledge.core.filter((e) => e.kind === "catalog")).toEqual([]);
    expect(knowledge.sources).toEqual([]);
  });

  test("stops when knowledge/sources/ exists but cannot be read as a folder, instead of giving an empty catalog", async () => {
    const root = await fixture("sources-not-a-folder", { "knowledge/sources": "a file, not a folder" });
    await expect(buildKnowledge({ root })).rejects.toThrow(/ENOTDIR/);
  });

  test("rejects an approved logistics answer without text or date", async () => {
    const root = await fixture("bad-logistics", {
      "knowledge/logistics.yaml": "topics:\n  - topic: location\n    answer:\n    status: approved\n    approved: 2026-10-27\n",
    });
    await expect(buildKnowledge({ root })).rejects.toThrow(/logistics\.yaml/);
  });

  test("stops on a role id that is not a slug, naming the file and the field", async () => {
    const root = await fixture("role-not-slug", { "resume.yaml": RESUME_YAML.replace("id: acme", "id: acme--two") });
    await expect(buildKnowledge({ root })).rejects.toThrow(/^resume\.yaml: work\[0\]\.id "acme--two" is not a slug/);
  });

  test("stops on a logistics topic that is not a slug, naming the file and the field", async () => {
    const root = await fixture("topic-not-slug", {
      "knowledge/logistics.yaml": "topics:\n  - topic: -location\n    answer: Seattle area.\n    status: approved\n    approved: 2026-10-27\n",
    });
    // zod's printed error sits between the file and the field.
    await expect(buildKnowledge({ root })).rejects.toThrow(/^knowledge\/logistics\.yaml: [\s\S]*not a slug[\s\S]*topics\[0\]\.topic/);
  });

  test("stops on a skills group whose name gives no slug, naming the file and the field", async () => {
    const root = await fixture("skills-no-slug", { "resume.yaml": RESUME_YAML.replace("name: Platform and tooling", 'name: "+++"') });
    await expect(buildKnowledge({ root })).rejects.toThrow(/^resume\.yaml: skills\[0\]\.name "\+\+\+" gives no slug/);
  });
});

describe("buildKnowledge on the real files", () => {
  test("gives every core entry a unique id that follows the id rules", async () => {
    const ids = (await buildKnowledge({ root: REPO })).core.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(parseId(id)).toBeDefined();
  });

  test("covers every role, highlight, skills group and the lead", async () => {
    const resume = await loadResume("public", REPO);
    const text = renderCore(await buildKnowledge({ root: REPO }));
    expect(text).toContain(resume.basics.summary);
    for (const job of resume.work) {
      expect(text).toContain(`[role:${job.id}]`);
      job.highlights.forEach((h, i) => expect(text).toContain(`[highlight:${job.id}.${i + 1}] ${job.name}, highlight ${i + 1}: ${h}`));
    }
    for (const group of resume.skills) expect(text).toContain(group.keywords.join(", "));
  });

  test("keeps the rendered core under 80,000 characters", async () => {
    expect(renderCore(await buildKnowledge({ root: REPO })).length).toBeLessThan(80_000);
  });

  test("renders the core the chat sees (snapshot; review the diff when content changes)", async () => {
    expect(renderCore(await buildKnowledge({ root: REPO }))).toMatchSnapshot();
  });
});
