// Seam 1 of SPEC-knowledge: buildKnowledge() on fixtures and on the real files, with renderCore(),
// renderSource(), publicKnowledge() and previewDraft() on its output.

import { afterAll, describe, expect, test } from "bun:test";
import { loadResume } from "../../content";
import { holds } from "../../private-details";
import { buildKnowledge, previewDraft, publicKnowledge } from "../build";
import { parseId } from "../ids";
import { renderCore, renderSource } from "../render";
import type { Source } from "../types";
import { DEEP_DIVE_BODY, deepDiveFile, FAKE_PHONE, fixture, interviewFile, removeFixtures, RESUME_YAML } from "./fixtures";

const REPO = `${import.meta.dir}/../../..`;
afterAll(removeFixtures);

/** The fixture deep dive and interview are both `sample`, so either one goes in this file. */
const SAMPLE = "knowledge/sources/sample.md";

/** The message buildKnowledge() stops with on a fixture repo that holds `files`. */
async function stops(name: string, files: Record<string, string>): Promise<string> {
  const root = await fixture(name, files);
  let message: string | undefined;
  try {
    await buildKnowledge({ root });
  } catch (e) {
    message = (e as Error).message;
  }
  expect(message).toBeDefined();
  return message!;
}

/** The approved sources buildKnowledge() gives on a fixture repo that holds `files`. */
async function builds(name: string, files: Record<string, string>): Promise<Source[]> {
  return (await buildKnowledge({ root: await fixture(name, files) })).sources;
}

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

  test("gives every id in the knowledge base, passage ids included, one use and the form it should have", async () => {
    const { core, sources } = await buildKnowledge({ root: await fixture("unique-ids", SOURCES) });
    const ids = [...core.map((e) => e.id), ...sources.flatMap((s) => s.passages.map((p) => p.id))];
    expect(new Set(ids).size).toBe(ids.length);
    // The six resume entries, the two catalog entries, then the 5 passages of alpha and the 3 of alpha-beta.
    expect(ids.map((id) => parseId(id)?.form)).toEqual([
      "basics", "role", "highlight", "highlight", "skills", "education", "source", "source",
      "passage", "passage", "passage", "passage", "passage", "passage", "passage", "passage",
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

  test("keeps private details out of the core and the sources, and out of their rendered text", async () => {
    const root = await fixture("private", SOURCES);
    const knowledge = await buildKnowledge({ root });
    const rendered = [renderCore(knowledge), ...knowledge.sources.map((s) => renderSource(s))];
    expect(rendered).toHaveLength(3);
    // holds() finds the number in any format, not only as private.yaml writes it.
    expect(rendered.some((text) => holds(text, FAKE_PHONE))).toBe(false);
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

describe("renderSource on buildKnowledge's output", () => {
  test("renders a deep dive whole: its header, kind line, roles and highlights, every passage in file order, then Not public", async () => {
    const [alpha] = await builds("render-deep-dive", SOURCES);
    expect(renderSource(alpha!)).toBe(
      [
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
      ].join("\n"),
    );
  });

  test("renders an interview with its kind line, and leaves out the line of roles, highlights and links when all three are empty", async () => {
    const [, alphaBeta] = await builds("render-interview", SOURCES);
    expect(renderSource(alphaBeta!)).toBe(
      [
        "# [alpha-beta] Why platform work",
        "Interview: Peter's own words, in the first person.",
        "",
        "## [alpha-beta.1] Why front-end platform work?",
        "I like building what other engineers use.",
        "",
        "## [alpha-beta.2] Why front-end platform work? (continued)",
        "And I like seeing a whole team move faster.",
        "",
        "## [alpha-beta.3] How did you help with the migration?",
        "I helped plan it.",
        "",
        "## Not public: decline to describe these kinds of material",
        "Colleague names.",
        "",
      ].join("\n"),
    );
  });

  test.each([
    ["roles only", interviewFile(), "Roles: acme."],
    ["links only", interviewFile({ roles: "[]", links: '["https://github.com/loriensleafs/brain", "https://peterkloss.dev"]' }), "Links: https://github.com/loriensleafs/brain, https://peterkloss.dev."],
    ["highlights only", deepDiveFile({ roles: "[]" }), "Highlights: highlight:acme.1."],
    [
      "roles, highlights and links",
      deepDiveFile({ highlights: "[highlight:acme.1, highlight:acme.2]", links: '["https://peterkloss.dev"]' }),
      "Roles: acme. Highlights: highlight:acme.1, highlight:acme.2. Links: https://peterkloss.dev.",
    ],
  ])("renders the line after the kind line with only its parts that are not empty: %s", async (name, file, line) => {
    const [source] = await builds(`render-line-${name.replaceAll(/[ ,]+/g, "-")}`, { [SAMPLE]: file });
    expect(renderSource(source!).split("\n").slice(2, 4)).toEqual([line, ""]);
  });

  test("renders only the passages asked for, in file order, with the header and Not public once", async () => {
    const [alpha] = await builds("render-passages", SOURCES);
    expect(renderSource(alpha!, ["alpha.4", "alpha.2"])).toBe(
      [
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
    );
  });

  test('writes "Nothing listed." under Not public when the section is empty', async () => {
    const [source] = await builds("render-nothing-listed", { [SAMPLE]: deepDiveFile({}, DEEP_DIVE_BODY.replace("Internal code.", "")) });
    expect(renderSource(source!)).toEndWith("## [sample.5] Tools\nText for Tools.\n\n## Not public: decline to describe these kinds of material\nNothing listed.\n");
  });

  test("renders a fixture source as the chat reads it (snapshot; review the diff when the rendered text changes)", async () => {
    const [source] = await builds("render-snapshot", { [SAMPLE]: interviewFile({ links: '["https://github.com/loriensleafs/brain"]' }) });
    expect(renderSource(source!)).toMatchSnapshot();
  });
});

// Everything that reaches a browser comes from publicKnowledge(): the site's pages and the device
// index (SPEC-knowledge, "Who gets which shape"). They write it as JSON, so the tests read its JSON.
describe("publicKnowledge on buildKnowledge's output", () => {
  test("gives JSON that holds no Not public text", async () => {
    const knowledge = await buildKnowledge({ root: await fixture("public-no-not-public", SOURCES) });
    // Both approved fixture sources have Not public text, so the checks below look for real text.
    expect(knowledge.sources.map((s) => s.notPublic)).toEqual(["Internal code.", "Colleague names."]);
    const json = JSON.stringify(publicKnowledge(knowledge));
    expect(json).not.toContain("Internal code.");
    expect(json).not.toContain("Colleague names.");
  });

  test("gives the rest of buildKnowledge's output unchanged: the core, and each source without its Not public text", async () => {
    // A logistics answer in the core, and a third source with a link, so every field has a value to keep.
    const root = await fixture("public-rest", {
      ...SOURCES,
      [SAMPLE]: interviewFile({ links: '["https://github.com/loriensleafs/brain"]' }),
      "knowledge/logistics.yaml": LOGISTICS_YAML,
    });
    const knowledge = await buildKnowledge({ root });
    expect(knowledge.sources.map((s) => s.id)).toEqual(["alpha", "alpha-beta", "sample"]);
    expect(JSON.parse(JSON.stringify(publicKnowledge(knowledge)))).toStrictEqual({
      core: knowledge.core,
      sources: knowledge.sources.map(({ notPublic: _notPublic, ...source }) => source),
    });
  });
});

describe("buildKnowledge on the rules of an approved source", () => {
  test.each([
    ["a capital letter", "Sample"],
    ["an underscore", "sam_ple"],
    ["two hyphens together", "sam--ple"],
    ["61 characters", "a".repeat(61)],
    ["the resume entry id basics", "basics"],
    ["the resume entry id education", "education"],
  ])("stops an approved source whose id has %s, naming the file and the field", async (_case, id) => {
    const file = `knowledge/sources/${id}.md`;
    expect(await stops(`id-${_case.replaceAll(" ", "-")}`, { [file]: deepDiveFile({ id }) })).toBe(
      `${file}: id "${id}" is not a source id: use a slug (lowercase letters and digits, with single hyphens between them, at most 60 characters), never "basics" or "education"`,
    );
  });

  test("lets an approved source id be 60 characters", async () => {
    const id = "a".repeat(60);
    expect((await builds("id-60", { [`knowledge/sources/${id}.md`]: deepDiveFile({ id }) })).map((s) => s.id)).toEqual([id]);
  });

  test("stops an approved source whose passage id would pass 64 characters, and names the passage", async () => {
    const id = "a".repeat(60);
    const file = `knowledge/sources/${id}.md`;
    const body = [...Array.from({ length: 1000 }, (_, i) => `## Question ${i + 1}?\n\nAn answer.\n`), "## Not public\n\nColleague names.\n"].join("\n");
    // 1,000 passages never render under 24,000 characters, so the source's size stops it too.
    expect((await stops("passage-id-65", { [file]: interviewFile({ id }, body) })).split("\n")).toEqual([
      `${file}: passage ${id}.1000 ("Question 1000?") breaks the passage id rule: use <source id>.<n>, at most 64 characters; this id has 65`,
      expect.stringMatching(/^knowledge\/sources\/a{60}\.md: the rendered source has \d+ characters; an approved source renders to at most 24000$/),
    ]);
  });

  test.each([
    ["a role resume.yaml does not have", "nope"],
    ["a property name of every object", "constructor"],
    ["a role entry id instead of a role id", "role:acme"],
  ])("stops an approved source whose roles hold %s, naming the field", async (_case, role) => {
    expect(await stops(`role-${role.replace(":", "-")}`, { [SAMPLE]: interviewFile({ roles: `[acme, "${role}"]` }) })).toBe(
      `${SAMPLE}: roles[1] "${role}" is not a role id in resume.yaml`,
    );
  });

  test.each([
    ["a number past the role's highlights", "highlight:acme.3"],
    ["a role resume.yaml does not have", "highlight:nope.1"],
    ["a property name of every object", "highlight:constructor.1"],
  ])("stops an approved deep dive whose highlights hold %s, naming the field", async (_case, highlight) => {
    expect(await stops(`highlight-${highlight.replace(/[:.]/g, "-")}`, { [SAMPLE]: deepDiveFile({ highlights: `[highlight:acme.2, ${highlight}]` }) })).toBe(
      `${SAMPLE}: highlights[1] "${highlight}" is not a highlight in resume.yaml`,
    );
  });

  test("lets an approved deep dive name every role and highlight resume.yaml has", async () => {
    const [source] = await builds("roles-and-highlights", { [SAMPLE]: deepDiveFile({ highlights: "[highlight:acme.1, highlight:acme.2]" }) });
    expect([source!.roles, source!.highlights]).toEqual([["acme"], ["highlight:acme.1", "highlight:acme.2"]]);
  });

  test.each([
    ["an http URL", "http://example.com/brain"],
    ["another scheme", "ftp://example.com/brain"],
    ["a relative URL", "/projects/brain"],
    ["no scheme", "example.com/brain"],
    ["https: without the two slashes", "https:example.com/brain"],
    ["the scheme in capitals", "HTTPS://example.com/brain"],
    ["a line break, which the URL class drops", "https://example.com/\n# Resume"],
    ["a tab, which the URL class drops", "https://exam\tple.com/"],
    ["a line separator", "https://example.com/a\u{2028}b"],
    ["a space", "https://example.com/a b"],
    ["a backslash, which the URL class reads as a slash", "https://example.com\\@evil.example"],
    ["a right-to-left override, which can disguise it", "https://example.com/\u{202E}gnp.exe"],
    ["a zero-width space, which the URL class drops from the host", "https://exa\u{200B}mple.com/"],
    ["no host", "https://"],
  ])("stops an approved source with a link that has %s, naming only its place in links", async (_case, link) => {
    expect(await stops(`link-${_case.split(",")[0]!.replaceAll(" ", "-")}`, { [SAMPLE]: interviewFile({ links: JSON.stringify([link]) }) })).toBe(
      `${SAMPLE}: links[0] is not an absolute https:// URL: write it in full, with no space, line break, backslash or invisible character`,
    );
  });

  test.each([
    ["a space, so it is not an absolute https:// URL", "space", "https://peter:hunter2@example.com/a b"],
    ["http, so it is not an absolute https:// URL", "http", "http://peter:hunter2@example.com/x"],
    ["an otherwise absolute https:// URL", "https", "https://peter:hunter2@example.com/x"],
  ])("never shows the user name or password of a link with %s", async (_case, name, link) => {
    const message = await stops(`link-credentials-${name}`, { [SAMPLE]: interviewFile({ links: JSON.stringify([link]) }) });
    expect(message).toStartWith(`${SAMPLE}: links[0] `);
    expect(message).not.toContain("peter");
    expect(message).not.toContain("hunter2");
  });

  test.each([
    ["a user name", "https://peter@example.com/"],
    ["a user name and a password", "https://peter:hunter2@example.com/"],
    ["a password alone", "https://:hunter2@example.com/"],
  ])("stops an approved source with a link that holds %s, and never shows it", async (_case, link) => {
    const message = await stops(`link-${_case.replaceAll(" ", "-")}`, { [SAMPLE]: interviewFile({ links: `["https://github.com/loriensleafs", "${link}"]` }) });
    expect(message).toBe(`${SAMPLE}: links[1] holds a user name or password: give the URL without them`);
  });

  test("lets an approved source give absolute https:// links", async () => {
    const links = ["https://github.com/loriensleafs/brain", "https://peterkloss.dev", "https://example.com/a?b=c#d"];
    expect((await builds("links", { [SAMPLE]: interviewFile({ links: JSON.stringify(links) }) }))[0]!.links).toEqual(links);
  });

  test.each([
    ["an https URL", "Internal links such as https://wiki.example.com/fednow."],
    ["an http URL", "Tickets at http://jira/browse/FN-1."],
    ["an ftp URL", "Files at ftp://files.example.com/."],
    ["a URL with an app's own scheme", "Channels such as slack://channel?team=T1."],
    ["a protocol-relative link", "Pages such as //corp.example.com/x."],
    ["an IPv4 address", "The server at 10.0.0.1."],
    ["an IPv4 address with a port", "The server at 10.0.0.1:8080."],
    ["an IPv4 address with a path", "The page at 10.0.0.1/admin."],
    ["a javascript: link", "Links such as javascript:alert(1)."],
    ["a data: link", "Images such as data:image/png;base64,iVBORw0."],
  ])("stops an approved source whose Not public holds %s, and never shows it", async (form, notPublic) => {
    const message = await stops(`not-public-${form.replace(/[^a-z0-9]+/gi, "-")}`, {
      [SAMPLE]: deepDiveFile({}, DEEP_DIVE_BODY.replace("Internal code.", notPublic)),
    });
    expect(message).toBe(`${SAMPLE}: Not public holds a URL or an IP address; it names kinds of material only, such as "internal links"`);
  });

  test("checks a Not public section of 300,000 characters with no break in it well under a second", async () => {
    const root = await fixture("not-public-long", { [SAMPLE]: deepDiveFile({}, DEEP_DIVE_BODY.replace("Internal code.", "a".repeat(300_000))) });
    const start = performance.now();
    const message = await buildKnowledge({ root }).then(
      () => "",
      (e: Error) => e.message,
    );
    expect(performance.now() - start).toBeLessThan(500);
    // Only the size stops it: no URL, IP address or email address pattern matches the plain text.
    expect(message).toMatch(/^knowledge\/sources\/sample\.md: the rendered source has \d+ characters; an approved source renders to at most 24000$/);
  });

  test.each([
    ["with a domain", "Mail from alice@example.com."],
    ["with an internal host", "Mail from alice@corp."],
    ["in a mailto: link", "Write to mailto:alice@example.com."],
  ])("stops an approved source whose Not public holds an email address %s, and never shows it", async (form, notPublic) => {
    const message = await stops(`not-public-email-${form.replaceAll(" ", "-").replace(":", "")}`, {
      [SAMPLE]: deepDiveFile({}, DEEP_DIVE_BODY.replace("Internal code.", notPublic)),
    });
    expect(message).toBe(`${SAMPLE}: Not public holds an email address; it names kinds of material only, such as "colleague names"`);
  });

  test("lets an approved source's Not public name kinds of material, or be empty", async () => {
    // Prose a link pattern could mistake for a link: a colon after "data" and "JavaScript", and a dot and a slash in "Node.js/Bun".
    const kinds = "Internal links, colleague names and customer names. Customer data: accounts. JavaScript: internal code. Node.js/Bun build files.";
    const files = {
      "knowledge/sources/sample.md": deepDiveFile({}, DEEP_DIVE_BODY.replace("Internal code.", kinds)),
      "knowledge/sources/empty.md": deepDiveFile({ id: "empty" }, DEEP_DIVE_BODY.replace("Internal code.", "")),
    };
    expect((await builds("not-public-kinds", files)).map((s) => s.notPublic)).toEqual(["", kinds]);
  });

  test("stops an approved deep dive with a section that has no text, and names the passage", async () => {
    const body = DEEP_DIVE_BODY.replace("Text for Result.", "   ");
    expect(await stops("empty-section", { [SAMPLE]: deepDiveFile({}, body) })).toBe(
      `${SAMPLE}: passage sample.4 ("Result") has no text; an approved passage holds text, and only Not public may be empty`,
    );
  });

  test("stops an approved interview with a question that has no answer, and names the passage", async () => {
    const body = "## Why platform work?\n\nAn answer.\n\n## What came next?\n\n## Not public\n\nColleague names.\n";
    expect(await stops("empty-answer", { [SAMPLE]: interviewFile({}, body) })).toBe(
      `${SAMPLE}: passage sample.2 ("What came next?") has no text; an approved passage holds text, and only Not public may be empty`,
    );
  });

  test("stops an approved source with a passage over 3,000 characters, and names the passage", async () => {
    const body = DEEP_DIVE_BODY.replace("Text for What Peter did.", "a".repeat(3001));
    expect(await stops("passage-3001", { [SAMPLE]: deepDiveFile({}, body) })).toBe(
      `${SAMPLE}: passage sample.2 ("What Peter did") has 3001 characters; an approved passage holds at most 3000`,
    );
  });

  test("lets an approved passage hold exactly 3,000 characters", async () => {
    const body = DEEP_DIVE_BODY.replace("Text for What Peter did.", "a".repeat(3000));
    expect((await builds("passage-3000", { [SAMPLE]: deepDiveFile({}, body) }))[0]!.passages[1]!.text).toHaveLength(3000);
  });

  /**
   * The fixture interview with nine questions: eight answers of 2,600 characters, then `last`. The
   * rendered text around the answers holds 422 characters: the header (92), each passage's heading
   * line and the blank line before it (28 each), and Not public with its blank line and the final line
   * break (78). So a last answer of 2,778 characters renders the source to exactly 24,000.
   */
  const nineAnswers = (last: number) =>
    [...[...Array(8).fill(2600), last].map((n, i) => `## Question ${i + 1}?\n\n${"a".repeat(n)}\n`), "## Not public\n\nColleague names.\n"].join("\n");

  test("stops an approved source whose rendered text has over 24,000 characters, and names its size", async () => {
    expect(await stops("source-24001", { [SAMPLE]: interviewFile({}, nineAnswers(2779)) })).toBe(
      `${SAMPLE}: the rendered source has 24001 characters; an approved source renders to at most 24000`,
    );
  });

  test("lets an approved source render to exactly 24,000 characters", async () => {
    const [source] = await builds("source-24000", { [SAMPLE]: interviewFile({}, nineAnswers(2778)) });
    expect(renderSource(source!)).toHaveLength(24_000);
  });

  test.each([
    ["201 characters", "a".repeat(201), "it has 201 characters on 1 line"],
    ["two lines", "|\n  First line.\n  Second line.", "it has 24 characters on 2 lines"],
    ["a line separator", '"First line.\\u2028Second line."', "it has 24 characters on 2 lines"],
    ["no text", '""', "it has 0 characters on 1 line"],
  ])("stops an approved source whose summary has %s, and names the field", async (_case, summary, found) => {
    expect(await stops(`summary-${_case.replaceAll(" ", "-")}`, { [SAMPLE]: deepDiveFile({ summary }) })).toBe(
      `${SAMPLE}: summary must be one line of 1 to 200 characters; ${found}`,
    );
  });

  test("lets an approved summary be exactly 200 characters", async () => {
    expect((await builds("summary-200", { [SAMPLE]: deepDiveFile({ summary: "a".repeat(200) }) }))[0]!.summary).toHaveLength(200);
  });

  test("names every rule an approved source breaks, one line each with the file and the field", async () => {
    const front = {
      roles: "[nope]",
      highlights: "[highlight:acme.9]",
      summary: "a".repeat(201),
      links: '["http://example.com/", "https://peter:hunter2@example.com/"]',
    };
    // The 24,001-character passage takes the rendered source past its budget too: 507 characters around it.
    const body = DEEP_DIVE_BODY.replace("Text for Problem.", "a".repeat(24_001))
      .replace("Text for Result.", "")
      .replace("Internal code.", "See https://wiki.example.com/ or ask alice@example.com.");
    expect(await stops("every-rule", { [SAMPLE]: deepDiveFile(front, body) })).toBe(
      [
        'roles[0] "nope" is not a role id in resume.yaml',
        'highlights[0] "highlight:acme.9" is not a highlight in resume.yaml',
        "summary must be one line of 1 to 200 characters; it has 201 characters on 1 line",
        "links[0] is not an absolute https:// URL: write it in full, with no space, line break, backslash or invisible character",
        "links[1] holds a user name or password: give the URL without them",
        'passage sample.1 ("Problem") has 24001 characters; an approved passage holds at most 3000',
        'passage sample.4 ("Result") has no text; an approved passage holds text, and only Not public may be empty',
        'Not public holds a URL or an IP address; it names kinds of material only, such as "internal links"',
        'Not public holds an email address; it names kinds of material only, such as "colleague names"',
        "the rendered source has 24508 characters; an approved source renders to at most 24000",
      ]
        .map((problem) => `${SAMPLE}: ${problem}`)
        .join("\n"),
    );
  });
});

describe("buildKnowledge on a draft source file", () => {
  test("builds with a draft that breaks every rule of an approved source, and leaves the draft out", async () => {
    const front = {
      id: "Draft_One",
      status: "draft",
      approved: null,
      roles: "[nope]",
      highlights: "[highlight:acme.9]",
      summary: "a".repeat(201),
      links: '["http://example.com/", "https://peter:hunter2@example.com/"]',
    };
    // Over the passage budget, and with it over the rendered source's budget.
    const body = DEEP_DIVE_BODY.replace("Text for Problem.", "a".repeat(24_001))
      .replace("Text for Result.", "")
      .replace("Internal code.", "See https://wiki.example.com/ or ask alice@example.com.");
    const sources = await builds("draft-every-rule", { ...SOURCES, "knowledge/sources/Draft_One.md": deepDiveFile(front, body) });
    expect(sources.map((s) => s.id)).toEqual(["alpha", "alpha-beta"]);
  });

  test("stops on a draft with broken front matter, naming the file and the field", async () => {
    const file = "knowledge/sources/draft-one.md";
    const message = await stops("draft-front-matter", { [file]: deepDiveFile({ id: "draft-one", status: "draft", approved: null, kind: "case-study" }) });
    expect(message).toStartWith(`${file}: front matter is not valid:`);
    expect(message).toMatch(/→ at kind$/m);
  });

  test("stops on a draft with a missing section, naming the file", async () => {
    const file = "knowledge/sources/draft-one.md";
    const body = DEEP_DIVE_BODY.replace("## Result\n\nText for Result.\n\n", "");
    expect(await stops("draft-sections", { [file]: deepDiveFile({ id: "draft-one", status: "draft", approved: null }, body) })).toStartWith(
      `${file}: a deep dive's sections must be, in order: Problem, What Peter did, How it worked, Result, Tools, Not public. Found: Problem, What Peter did, How it worked, Tools, Not public`,
    );
  });
});

// What `bun run knowledge --draft <source id>` prints (SPEC-knowledge, Drafts and approval).
describe("previewDraft on a draft source file", () => {
  /** The fixture interview as a draft, with a link, so the line after the kind line has every part it can have in an interview. */
  const DRAFT = interviewFile({ status: "draft", approved: null, links: '["https://github.com/loriensleafs/brain"]' });

  test("gives the draft's text as renderSource() gives it once the draft is approved, and no problems for a draft that breaks no rule", async () => {
    const preview = await previewDraft({ root: await fixture("preview-text", { [SAMPLE]: DRAFT }), id: "sample" });
    // The same file, approved: only its status and its approved date change.
    const approved = DRAFT.replace("status: draft", "status: approved\napproved: 2026-10-27");
    const [source] = await builds("preview-text-approved", { [SAMPLE]: approved });
    expect(preview).toEqual({ text: renderSource(source!), problems: [] });
  });

  test("names each rule a draft breaks, one line each with the file and the field, as the build names them once the draft is approved", async () => {
    const file = "knowledge/sources/Draft_One.md";
    const front = {
      id: "Draft_One",
      status: "draft",
      approved: null,
      roles: "[nope]",
      highlights: "[highlight:acme.9]",
      summary: "a".repeat(201),
      links: '["http://example.com/", "https://peter:hunter2@example.com/"]',
    };
    // Over the passage budget, and with it over the rendered source's budget: 525 characters around the long passage.
    const body = DEEP_DIVE_BODY.replace("Text for Problem.", "a".repeat(24_001))
      .replace("Text for Result.", "")
      .replace("Internal code.", "See https://wiki.example.com/ or ask alice@example.com.");
    const draft = deepDiveFile(front, body);
    const { text, problems } = await previewDraft({ root: await fixture("preview-every-rule", { ...SOURCES, [file]: draft }), id: "Draft_One" });
    expect(problems).toEqual(
      [
        'id "Draft_One" is not a source id: use a slug (lowercase letters and digits, with single hyphens between them, at most 60 characters), never "basics" or "education"',
        'roles[0] "nope" is not a role id in resume.yaml',
        'highlights[0] "highlight:acme.9" is not a highlight in resume.yaml',
        "summary must be one line of 1 to 200 characters; it has 201 characters on 1 line",
        "links[0] is not an absolute https:// URL: write it in full, with no space, line break, backslash or invisible character",
        "links[1] holds a user name or password: give the URL without them",
        'passage Draft_One.1 ("Problem") has 24001 characters; an approved passage holds at most 3000',
        'passage Draft_One.4 ("Result") has no text; an approved passage holds text, and only Not public may be empty',
        'Not public holds a URL or an IP address; it names kinds of material only, such as "internal links"',
        'Not public holds an email address; it names kinds of material only, such as "colleague names"',
        "the rendered source has 24526 characters; an approved source renders to at most 24000",
      ].map((problem) => `${file}: ${problem}`),
    );
    // The draft is rendered all the same, so its reader sees what the rules are about.
    expect(text).toStartWith("# [Draft_One] A sample deep dive\nDeep dive: written from Peter's answers, in the third person.\n");
    expect(text).toHaveLength(24_526);
    // Once approved, the same file stops the build with the same lines.
    const approved = draft.replace("status: draft", "status: approved\napproved: 2026-10-27");
    expect(await stops("preview-every-rule-approved", { [file]: approved })).toBe(problems.join("\n"));
  });

  test.each([
    ["broken front matter", deepDiveFile({ id: "draft-one", status: "draft", approved: null, kind: "case-study" })],
    ["a missing section", deepDiveFile({ id: "draft-one", status: "draft", approved: null }, DEEP_DIVE_BODY.replace("## Result\n\nText for Result.\n\n", ""))],
    [
      "the Not public heading in a code block",
      deepDiveFile({ id: "draft-one", status: "draft", approved: null }, DEEP_DIVE_BODY.replace("Text for Tools.", "```\n## Not public: decline to describe these kinds of material\n```")),
    ],
  ])("names the shape rule a draft with %s breaks, as the build stops on it, and gives no text, since nothing can be rendered", async (name, draft) => {
    const files = { "knowledge/sources/draft-one.md": draft };
    const preview = await previewDraft({ root: await fixture(`preview-shape-${name.replaceAll(" ", "-")}`, files), id: "draft-one" });
    expect(preview).toEqual({ text: "", problems: [await stops(`preview-shape-${name.replaceAll(" ", "-")}-build`, files)] });
  });

  test("reads an approved source file the same way, so a change to one can be read with the rules it breaks", async () => {
    const { text, problems } = await previewDraft({ root: await fixture("preview-approved-file", { [SAMPLE]: interviewFile({ roles: "[nope]" }) }), id: "sample" });
    expect(text).toStartWith("# [sample] Why platform work\nInterview: Peter's own words, in the first person.\nRoles: nope.\n\n## [sample.1] Why front-end platform work?\n");
    expect(problems).toEqual([`${SAMPLE}: roles[0] "nope" is not a role id in resume.yaml`]);
  });

  test.each([
    ["an id no source file has", "nope"],
    ["a path up out of knowledge/sources/", "../secret"],
    ["a path into a folder inside knowledge/sources/", "deeper/secret"],
  ])("stops on %s, naming the id, and reads no file outside the files of knowledge/sources/", async (_case, id) => {
    // Each file would parse as a draft from its own folder, so a path joined from the id would read it.
    const root = await fixture(`preview-not-found-${_case.replace(/[^a-z]+/g, "-")}`, {
      [SAMPLE]: DRAFT,
      "knowledge/secret.md": interviewFile({ id: "secret", status: "draft", approved: null }),
      "knowledge/sources/deeper/secret.md": interviewFile({ id: "secret", status: "draft", approved: null }),
    });
    await expect(previewDraft({ root, id })).rejects.toThrow(`knowledge/sources: no source file has the id ${JSON.stringify(id)}`);
  });
});

describe("buildKnowledge on the real files", () => {
  test("gives every id in the knowledge base, passage ids included, one use and the id rules", async () => {
    const { core, sources } = await buildKnowledge({ root: REPO });
    const ids = [...core.map((e) => e.id), ...sources.flatMap((s) => s.passages.map((p) => p.id))];
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

  // Approved passages are append-only (SPEC-knowledge, Sources), so an approved passage id always
  // names the same passage, also in a visitor's saved session. It holds one list per approved source, in
  // source-id order; the nine deep dives were the first approved sources.
  test("lists every approved source's passage ids with their headings (snapshot, append-only: accept a diff only when it adds lines at the end of a source's list, or a new source's list)", async () => {
    const { sources } = await buildKnowledge({ root: REPO });
    expect(sources.flatMap((s) => s.passages.map((p) => `[${p.id}] ${p.heading}`))).toMatchSnapshot();
  });
});
