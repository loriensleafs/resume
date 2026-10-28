// Seam 4 of SPEC-knowledge: `bun run knowledge` as a child process, on fixture roots given with
// --root. Seams 1 to 3 call the knowledge module's functions; this seam checks the script's own
// code: its modes, its flag errors, its Skipped id line, which output gets what, and its exit codes.
// Each expected text is written out in full, as the spec's Rendered text gives it.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { relative, resolve } from "node:path";
import { loadResume } from "../../src/content";
import { deepDiveFile, FAKE_PHONE, fixture, interviewFile, RESUME_YAML, removeFixtures } from "../../src/knowledge/__tests__/fixtures";
import { holds } from "../../src/private-details";

const REPO = Bun.fileURLToPath(new URL("../../", import.meta.url));
afterAll(removeFixtures);

type Run = { exitCode: number; stdout: string; stderr: string };

/**
 * `bun run knowledge` with `args`, from the repository, as Peter runs it. `--silent` only keeps
 * bun's echo of the command line out of standard error; the script runs the same. Every run's
 * output is checked for the fixture private.yaml's fake phone number, which no output may hold.
 */
async function knowledge(...args: string[]): Promise<Run> {
  const child = Bun.spawn([process.execPath, "run", "--silent", "knowledge", ...args], { cwd: REPO, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  expect(holds(stdout, FAKE_PHONE) || holds(stderr, FAKE_PHONE)).toBe(false);
  return { exitCode, stdout, stderr };
}

/** The script's usage, which follows every flag error on standard error. */
const USAGE = "Usage: bun run knowledge [--root <folder>] [<source or passage id> ...]\n       bun run knowledge [--root <folder>] --draft <source id>\n";

/** A short interview body: one question, then Not public. */
const SHORT_BODY = "## Why Bun?\n\nIt is fast.\n\n## Not public\n\nColleague names.\n";

/**
 * The main fixture root: two approved sources, a clean draft, a draft that breaks one rule, an
 * approved logistics answer, and two draft files outside knowledge/sources/' own files, which
 * `--draft ../secret` and `--draft deeper/secret` would read if the id were joined into a path.
 */
const FILES = {
  "knowledge/sources/alpha.md": deepDiveFile({ id: "alpha", title: "The first thing" }),
  "knowledge/sources/beta.md": interviewFile({ id: "beta", title: "Why platform work" }),
  "knowledge/sources/draft-clean.md": interviewFile({ id: "draft-clean", title: "A clean draft", status: "draft", approved: null }, SHORT_BODY),
  "knowledge/sources/draft-broken.md": interviewFile({ id: "draft-broken", title: "A broken draft", roles: "[nope]", status: "draft", approved: null }, SHORT_BODY),
  "knowledge/logistics.yaml": "topics:\n  - topic: location\n    answer: Seattle area.\n    status: approved\n    approved: 2026-10-27\n",
  "knowledge/secret.md": interviewFile({ id: "secret", status: "draft", approved: null }, SHORT_BODY),
  "knowledge/sources/deeper/secret.md": interviewFile({ id: "secret", status: "draft", approved: null }, SHORT_BODY),
};

let root: string;
beforeAll(async () => {
  root = await fixture("script", FILES);
});

/** The core of the main fixture root: the fixture resume, the approved logistics answer, then the catalog in source-id order. */
const CORE = [
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
  "[beta] Why platform work: interview, roles acme. Why Peter chose front-end platform work.",
  "",
].join("\n");

/** The approved deep dive `alpha` read whole. */
const ALPHA = [
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

/** The approved interview `beta` read whole. */
const BETA = [
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
].join("\n");

/** The clean draft as the chat will read it once approved. */
const DRAFT_CLEAN = [
  "# [draft-clean] A clean draft",
  "Interview: Peter's own words, in the first person.",
  "Roles: acme.",
  "",
  "## [draft-clean.1] Why Bun?",
  "It is fast.",
  "",
  "## Not public: decline to describe these kinds of material",
  "Colleague names.",
  "",
].join("\n");

describe("bun run knowledge --root <folder>, the core", () => {
  test("prints the folder's core to standard output, and its size and each approved source's size to standard error, and exits with 0", async () => {
    expect(await knowledge("--root", root)).toEqual({
      exitCode: 0,
      stdout: CORE,
      stderr: [
        `Core: 9 entries (6 resume, 1 logistics, 2 catalog); ${CORE.length} of 80,000 characters.`,
        `Source alpha: 5 passages; ${ALPHA.length} of 24,000 characters.`,
        `Source beta: 3 passages; ${BETA.length} of 24,000 characters.`,
        "",
      ].join("\n"),
    });
  });

  test("prints a core at or over its 80,000 characters all the same, says it must stay under them, and exits with 1", async () => {
    const long = await fixture("script-core-over", { "resume.yaml": RESUME_YAML.replace("summary: A summary.", `summary: ${"a".repeat(80_000)}`) });
    const run = await knowledge("--root", long);
    expect(run.stdout).toStartWith(`# Resume\n\n[basics] Test Person: Engineer: ${"a".repeat(80_000)} Location: Boston, MA.`);
    expect(run.stderr).toBe(
      `Core: 6 entries (6 resume, 0 logistics, 0 catalog); ${run.stdout.length.toLocaleString("en-US")} of 80,000 characters.\nSources: none approved.\nThe core must stay under 80,000 characters.\n`,
    );
    expect(run.exitCode).toBe(1);
  });

  test("takes a --root relative to the working folder, which bun run sets to the repository", async () => {
    expect(await knowledge("--root", relative(REPO, root))).toMatchObject({ exitCode: 0, stdout: CORE });
  });

  test("reads the repository with no --root", async () => {
    const { basics } = await loadResume("public", REPO);
    const run = await knowledge();
    expect(run.stdout).toStartWith(`# Resume\n\n[basics] ${basics.name}: ${basics.label}: `);
    expect(run.exitCode).toBe(0);
  });
});

describe("bun run knowledge --root <folder> <id> ...", () => {
  test("prints a source id as all its passages, as one read gives them, with nothing on standard error, and exits with 0", async () => {
    expect(await knowledge("--root", root, "alpha")).toEqual({ exitCode: 0, stdout: ALPHA, stderr: "" });
  });

  test("prints passage ids as one read: grouped by source in the order asked, each source with its header and Not public once", async () => {
    const stdout = [
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
      "# [alpha] The first thing",
      "Deep dive: written from Peter's answers, in the third person.",
      "Roles: acme. Highlights: highlight:acme.1.",
      "",
      "## [alpha.1] Problem",
      "Text for Problem.",
      "",
      "## Not public: decline to describe these kinds of material",
      "Internal code.",
      "",
    ].join("\n");
    expect(await knowledge("--root", root, "beta.2", "alpha.1")).toEqual({ exitCode: 0, stdout, stderr: "" });
  });

  test("prints what it read, names each unknown id on standard error, a draft's id among them, and exits with 1", async () => {
    expect(await knowledge("--root", root, "alpha", "nope", "draft-clean")).toEqual({
      exitCode: 1,
      stdout: ALPHA,
      stderr: [
        'Unknown id "nope": no approved source or passage has it.',
        'Unknown id "draft-clean": no approved source or passage has it.',
        "`bun run knowledge` lists the approved sources.",
        "",
      ].join("\n"),
    });
  });

  test("names the Skipped id that the read's 24,000-character limit left out, and exits with 1", async () => {
    // `long` renders to 23,571 characters, as in seam 1, so `fill`, with an answer of 500 characters, takes the read past its limit.
    // Seam 1 checks the exact edge; this test checks the line the script prints for it.
    const sized = await fixture("script-limit", {
      "knowledge/sources/long.md": interviewFile(
        { id: "long", title: "Long answers" },
        [...Array.from({ length: 8 }, (_, i) => `## Question ${i + 1}?\n\n${"a".repeat(2_900)}\n`), "## Not public\n\nColleague names.\n"].join("\n"),
      ),
      "knowledge/sources/fill.md": interviewFile({ id: "fill", title: "Filler" }, `## Question 1?\n\n${"a".repeat(500)}\n\n## Not public\n\nColleague names.\n`),
    });
    const run = await knowledge("--root", sized, "long", "fill");
    expect(run.stdout).toStartWith("# [long] Long answers\n");
    expect(run.stdout).toHaveLength(23_571);
    expect(run.stderr).toBe('Skipped id "fill": the read reached its limit of 24,000 characters before it.\n');
    expect(run.exitCode).toBe(1);
  });
});

describe("bun run knowledge --root <folder> --draft <source id>", () => {
  test.each([
    ["--draft draft-clean", ["--draft", "draft-clean"]],
    ["--draft=draft-clean", ["--draft=draft-clean"]],
  ])("%s prints a clean draft as the chat will read it once approved, says it breaks no rule, and exits with 0", async (_form, args) => {
    expect(await knowledge("--root", root, ...args)).toEqual({
      exitCode: 0,
      stdout: DRAFT_CLEAN,
      stderr: `"draft-clean" renders to ${DRAFT_CLEAN.length} of 24,000 characters and breaks no rule of an approved source.\n`,
    });
  });

  test("prints a draft that breaks a rule, names the rule with its file and field, and exits with 1", async () => {
    expect(await knowledge("--root", root, "--draft", "draft-broken")).toEqual({
      exitCode: 1,
      stdout: DRAFT_CLEAN.replaceAll("draft-clean", "draft-broken").replace("A clean draft", "A broken draft").replace("Roles: acme.", "Roles: nope."),
      stderr: 'knowledge/sources/draft-broken.md: roles[0] "nope" is not a role id in resume.yaml\n"draft-broken" breaks 1 rule of an approved source.\n',
    });
  });

  test.each([["nope"], ["../secret"], ["deeper/secret"]])(
    "--draft %s, which no file of knowledge/sources/ has, prints nothing, names the id, and exits with 1",
    async (id) => {
      expect(await knowledge("--root", root, "--draft", id)).toEqual({
        exitCode: 1,
        stdout: "",
        stderr: `knowledge/sources: no source file has the id ${JSON.stringify(id)}\n`,
      });
    },
  );
});

describe("bun run knowledge --root <folder> on a draft with a broken shape", () => {
  /** A draft whose code block holds a line that looks like the Not public heading, on line 16 of its file. */
  let shape: string;
  beforeAll(async () => {
    const body = "## How is a source laid out?\n\n```\n## Not public: SHAPE-SECRET\n```\n\n## Not public\n\nColleague names.\n";
    shape = await fixture("script-shape", { "knowledge/sources/draft-shape.md": interviewFile({ id: "draft-shape", status: "draft", approved: null }, body) });
  });
  const PROBLEM =
    'knowledge/sources/draft-shape.md: line 16, in a code block, starts with "## Not public", which looks like the Not public heading, and the chat could read it as that section: write the line another way\n';

  test("--draft prints no text, names the shape rule by its line and never the rest of the line, and exits with 1", async () => {
    expect(await knowledge("--root", shape, "--draft", "draft-shape")).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: `${PROBLEM}"draft-shape": the rules of an approved source are checked once its front matter and sections are right.\n`,
    });
  });

  test("the core stops on it: no text, the build's message, and exit 1", async () => {
    expect(await knowledge("--root", shape)).toEqual({ exitCode: 1, stdout: "", stderr: PROBLEM });
  });
});

describe("bun run knowledge with a flag error", () => {
  test.each([
    ["a misspelt flag", ["--drfat", "draft-clean"], "'--drfat'"],
    ["--draft with no id", ["--draft"], "'--draft"],
    ["--root with no folder", ["alpha", "--root"], "'--root"],
  ])("%s prints nothing, names the flag, then the usage, on standard error, and exits with 2", async (_case, args, flag) => {
    const run = await knowledge(...args);
    expect(run.stdout).toBe("");
    expect(run.stderr.split("\n")[0]).toContain(flag);
    expect(run.stderr).toEndWith(USAGE);
    expect(run.exitCode).toBe(2);
  });

  test.each([
    ["a path that does not exist", "no-such-folder"],
    ["a file", "resume.yaml"],
  ])("--root with %s prints nothing, names the path it looked at, then the usage, and exits with 2", async (_case, name) => {
    // The message names the resolved path: TMPDIR can end in a slash, which gives the fixture root a "//".
    const path = `${root}/${name}`;
    expect(await knowledge("--root", path)).toEqual({ exitCode: 2, stdout: "", stderr: `--root ${JSON.stringify(resolve(path))} is not a folder\n${USAGE}` });
  });

  test.each([
    ["another id after it", ["--draft", "draft-clean", "alpha"]],
    ["an id before it", ["alpha", "--draft", "draft-clean"]],
  ])("--draft with %s prints nothing, says --draft takes one source id, then the usage, and exits with 2", async (_case, args) => {
    expect(await knowledge("--root", root, ...args)).toEqual({ exitCode: 2, stdout: "", stderr: `--draft takes one source id and no other ids\n${USAGE}` });
  });
});
