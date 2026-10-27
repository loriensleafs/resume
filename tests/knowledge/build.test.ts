// Seam 1 of SPEC-knowledge: buildKnowledge() on fixtures and on the real files.

import { afterAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { loadResume } from "../../src/content";
import { buildKnowledge, ID_PATTERN } from "../../src/knowledge/build";
import { KNOWLEDGE_BUDGET, renderKnowledge } from "../../src/knowledge/render";
import { deepDive } from "./fixtures";

const REPO = `${import.meta.dir}/../..`;
const FAKE_PHONE = "(555) 555-0100";
const tmp = `${Bun.env.TMPDIR ?? "/tmp"}/knowledge-test-${crypto.randomUUID()}`;
afterAll(async () => {
  await $`rm -rf ${tmp}`.quiet().nothrow();
});

const resumeYaml = `basics:
  name: Test Person
  label: Engineer
  email: test@example.com
  summary: A summary.
  location: { city: Boston, region: MA, countryCode: US }
  profiles: []
work:
  - id: acme
    name: Acme
    position: Engineer
    startDate: 2020
    highlights: [Built the first thing., Built the second thing.]
skills:
  - name: Platform and tooling
    keywords: [Bun]
education:
  - institution: A University
`;

const approvedFront = (id: string, extra = "") =>
  `id: ${id}\ntitle: Deep dive ${id}\nrole: acme\nhighlights: [1]\nstatus: approved\napproved: 2026-10-27\nsource: Interview${extra}`;

async function fixture(name: string, files: Record<string, string>) {
  const root = `${tmp}/${name}`;
  await Bun.write(`${root}/resume.yaml`, resumeYaml);
  await Bun.write(`${root}/private.yaml`, `basics:\n  phone: ${FAKE_PHONE}\n`);
  for (const [path, text] of Object.entries(files)) await Bun.write(`${root}/${path}`, text);
  return root;
}

describe("buildKnowledge on fixtures", () => {
  test("orders resume entries, approved deep dives, then approved logistics", async () => {
    const root = await fixture("order", {
      "knowledge/deep-dives/first.md": deepDive({ front: approvedFront("first") }),
      "knowledge/deep-dives/draft-one.md": deepDive({ front: "id: draft-one\ntitle: D\nrole: acme\nstatus: draft\nsource: S" }),
      "knowledge/logistics.yaml":
        "topics:\n  - topic: location\n    answer: Seattle area.\n    status: approved\n    approved: 2026-10-27\n  - topic: availability\n    answer: Soon.\n    status: draft\n",
    });
    const ids = (await buildKnowledge({ root })).map((e) => e.id);
    expect(ids).toEqual([
      "basics",
      "role:acme",
      "highlight:acme.1",
      "highlight:acme.2",
      "skills:platform-and-tooling",
      "education",
      "deep:first",
      "logistics:location",
    ]);
  });

  test("never ships a draft", async () => {
    const root = await fixture("drafts", {
      "knowledge/deep-dives/draft-one.md": deepDive({ front: "id: draft-one\ntitle: D\nrole: acme\nstatus: draft\nsource: S" }),
    });
    const text = renderKnowledge(await buildKnowledge({ root }));
    expect(text).not.toContain("draft-one");
  });

  test("rejects a deep dive whose role or highlight does not exist", async () => {
    const badRole = await fixture("bad-role", {
      "knowledge/deep-dives/x.md": deepDive({ front: approvedFront("x").replace("role: acme", "role: nowhere") }),
    });
    await expect(buildKnowledge({ root: badRole })).rejects.toThrow(/role "nowhere"/);
    const badHighlight = await fixture("bad-highlight", {
      "knowledge/deep-dives/x.md": deepDive({ front: approvedFront("x").replace("highlights: [1]", "highlights: [3]") }),
    });
    await expect(buildKnowledge({ root: badHighlight })).rejects.toThrow(/no highlight 3/);
  });

  test("rejects an approved logistics answer without text or date", async () => {
    const root = await fixture("bad-logistics", {
      "knowledge/logistics.yaml": "topics:\n  - topic: location\n    answer:\n    status: approved\n    approved: 2026-10-27\n",
    });
    await expect(buildKnowledge({ root })).rejects.toThrow(/logistics\.yaml/);
  });

  test("keeps private details out", async () => {
    const root = await fixture("private", {});
    expect(renderKnowledge(await buildKnowledge({ root }))).not.toContain(FAKE_PHONE);
  });
});

describe("buildKnowledge on the real files", () => {
  test("gives every entry a unique, well-formed id", async () => {
    const entries = await buildKnowledge({ root: REPO });
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(ID_PATTERN);
  });

  test("covers every role, highlight, skills group and the lead", async () => {
    const resume = await loadResume("public", REPO);
    const text = renderKnowledge(await buildKnowledge({ root: REPO }));
    expect(text).toContain(resume.basics.summary);
    for (const job of resume.work) {
      expect(text).toContain(`[role:${job.id}]`);
      job.highlights.forEach((h, i) => expect(text).toContain(`[highlight:${job.id}.${i + 1}] ${job.name}, highlight ${i + 1}: ${h}`));
    }
    for (const group of resume.skills) expect(text).toContain(group.keywords.join(", "));
  });

  test("stays under the size budget", async () => {
    expect(renderKnowledge(await buildKnowledge({ root: REPO })).length).toBeLessThan(KNOWLEDGE_BUDGET);
  });

  test("renders what the chat sees (snapshot; review the diff when content changes)", async () => {
    expect(renderKnowledge(await buildKnowledge({ root: REPO }))).toMatchSnapshot();
  });
});
