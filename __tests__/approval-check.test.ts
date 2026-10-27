// The `release` skill's approval check, `.agents/skills/release/scripts/approval-check.ts` (row 151).
// It sits in the root `__tests__/` because Bun's test runner skips folders whose names start with a dot.
// Each test makes a temporary repository with a base commit, tagged `base`, then changes it.

import { afterAll, describe, expect, test } from "bun:test";

const SCRIPT = `${import.meta.dir}/../.agents/skills/release/scripts/approval-check.ts`;
const GIT = ["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false"];
const PACKAGE = JSON.stringify({ dependencies: { zod: "4.6.7" }, devDependencies: {} }, null, 2);
const APPROVED = "---\nid: sample\nstatus: approved\napproved: 2026-10-26\n---\n\n## Problem\n\nText.\n";
const DRAFT = "---\nid: draft\nstatus: draft\n---\n\n## Problem\n\nText.\n";
const roots: string[] = [];

function git(root: string, ...args: string[]): void {
  const result = Bun.spawnSync([...GIT, ...args], { cwd: root });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr.toString()}`);
}

async function repo(files: Record<string, string>): Promise<string> {
  const root = `${Bun.env.TMPDIR ?? "/tmp"}/approval-check-${crypto.randomUUID()}`;
  roots.push(root);
  for (const [path, text] of Object.entries(files)) await Bun.write(`${root}/${path}`, text);
  git(root, "init", "-q");
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "base");
  git(root, "tag", "base");
  return root;
}

async function change(root: string, files: Record<string, string | null>): Promise<void> {
  for (const [path, text] of Object.entries(files)) {
    if (text === null) git(root, "rm", "-q", path);
    else {
      await Bun.write(`${root}/${path}`, text);
      git(root, "add", path);
    }
  }
  git(root, "commit", "-q", "-m", "change");
}

function check(root: string, range = "base..HEAD") {
  const result = Bun.spawnSync(["bun", SCRIPT, range], { cwd: root });
  return { exitCode: result.exitCode, lines: result.stdout.toString().split("\n").filter(Boolean), stderr: result.stderr.toString() };
}

afterAll(() => {
  for (const root of roots) Bun.spawnSync(["rm", "-rf", root]);
});

describe("the approval check", () => {
  test("prints nothing for a change that needs no approval", async () => {
    const root = await repo({ "package.json": PACKAGE, "notes.md": "one\n" });
    await change(root, { "notes.md": "two\n" });
    expect(check(root)).toEqual({ exitCode: 0, lines: [], stderr: "" });
  });

  test("lists a change to a docs-only list that the base holds", async () => {
    const root = await repo({ "package.json": PACKAGE, "scripts/docs-only.txt": "docs/\n" });
    await change(root, { "scripts/docs-only.txt": "docs/\nsrc/\n" });
    expect(check(root)).toMatchObject({ exitCode: 1, lines: ["docs-only list: scripts/docs-only.txt"] });
  });

  test("passes a docs-only list that the range creates", async () => {
    const root = await repo({ "package.json": PACKAGE });
    await change(root, { "scripts/docs-only.txt": "docs/\n" });
    expect(check(root)).toMatchObject({ exitCode: 0, lines: [] });
  });

  test("lists a change to an approved knowledge source", async () => {
    const root = await repo({ "package.json": PACKAGE, "knowledge/sources/sample.md": APPROVED });
    await change(root, { "knowledge/sources/sample.md": `${APPROVED}More text.\n` });
    expect(check(root)).toMatchObject({ exitCode: 1, lines: ["approved knowledge: knowledge/sources/sample.md"] });
  });

  test("lists both paths of an approved knowledge source that the range moves", async () => {
    const root = await repo({ "package.json": PACKAGE, "knowledge/deep-dives/sample.md": APPROVED });
    Bun.spawnSync(["mkdir", "-p", `${root}/knowledge/sources`]);
    git(root, "mv", "knowledge/deep-dives/sample.md", "knowledge/sources/sample.md");
    git(root, "commit", "-q", "-m", "move");
    expect(check(root)).toMatchObject({
      exitCode: 1,
      lines: ["approved knowledge: knowledge/deep-dives/sample.md", "approved knowledge: knowledge/sources/sample.md"],
    });
  });

  test("lists a change to approved logistics answers", async () => {
    const yaml = "answers:\n  - topic: remote\n    status: approved\n";
    const root = await repo({ "package.json": PACKAGE, "knowledge/logistics.yaml": yaml });
    await change(root, { "knowledge/logistics.yaml": yaml.replace("remote", "location") });
    expect(check(root)).toMatchObject({ exitCode: 1, lines: ["approved knowledge: knowledge/logistics.yaml"] });
  });

  test.each([
    ["in double quotes", 'status: "approved"'],
    ["in single quotes", "status: 'approved'"],
    ["with a comment", "status: approved   # draft | approved"],
  ])("reads an approved status written %s", async (_name, line) => {
    const source = APPROVED.replace("status: approved", line);
    const root = await repo({ "package.json": PACKAGE, "knowledge/sources/sample.md": source });
    await change(root, { "knowledge/sources/sample.md": `${source}More text.\n` });
    expect(check(root)).toMatchObject({ exitCode: 1, lines: ["approved knowledge: knowledge/sources/sample.md"] });
  });

  test("lists a new approved source and a draft that the range approves", async () => {
    const root = await repo({ "package.json": PACKAGE, "knowledge/sources/draft.md": DRAFT });
    await change(root, {
      "knowledge/sources/draft.md": DRAFT.replace("status: draft", "status: approved"),
      "knowledge/sources/new.md": APPROVED,
    });
    expect(check(root)).toMatchObject({
      exitCode: 1,
      lines: ["approved knowledge: knowledge/sources/draft.md", "approved knowledge: knowledge/sources/new.md"],
    });
  });

  test("passes a change to a draft source and a new draft source", async () => {
    const root = await repo({ "package.json": PACKAGE, "knowledge/sources/draft.md": DRAFT, "knowledge/README.md": "# Knowledge\n" });
    await change(root, {
      "knowledge/sources/draft.md": `${DRAFT}More text.\n`,
      "knowledge/sources/new.md": DRAFT,
      "knowledge/README.md": "# Knowledge base\n",
    });
    expect(check(root)).toMatchObject({ exitCode: 0, lines: [] });
  });

  test("lists each package that the range adds, overrides included", async () => {
    const root = await repo({ "package.json": PACKAGE });
    const added = { dependencies: { zod: "4.6.7" }, devDependencies: { "left-pad": "1.3.0" }, overrides: { zod: "4.6.7" } };
    await change(root, { "package.json": JSON.stringify(added, null, 2) });
    expect(check(root)).toMatchObject({ exitCode: 1, lines: ["new package: left-pad"] });
  });

  test("passes a new exact version of a package", async () => {
    const root = await repo({ "package.json": PACKAGE });
    await change(root, { "package.json": PACKAGE.replace("4.6.7", "4.6.8") });
    expect(check(root)).toMatchObject({ exitCode: 0, lines: [] });
  });

  test.each([
    ["a git URL", "git+https://github.com/someone/zod.git"],
    ["a GitHub reference", "github:someone/zod"],
    ["a range", "^4.6.7"],
    ["a local folder", "file:../zod"],
    ["another registry name", "npm:other-package@4.6.7"],
  ])("lists a package whose spec changes to %s", async (_name, spec) => {
    const root = await repo({ "package.json": PACKAGE });
    await change(root, { "package.json": PACKAGE.replace('"4.6.7"', JSON.stringify(spec)) });
    expect(check(root)).toMatchObject({ exitCode: 1, lines: ["package without an exact version: zod"] });
  });

  test("lists a package that the range trusts to run its install scripts", async () => {
    const root = await repo({ "package.json": PACKAGE });
    const trusted = { ...JSON.parse(PACKAGE), trustedDependencies: ["zod"] };
    await change(root, { "package.json": JSON.stringify(trusted, null, 2) });
    expect(check(root)).toMatchObject({ exitCode: 1, lines: ["newly trusted package: zod"] });
  });

  test("lists each package that a nested package.json adds, with its path", async () => {
    const root = await repo({ "package.json": PACKAGE });
    await change(root, { "prototypes/site/package.json": JSON.stringify({ dependencies: { "left-pad": "1.3.0" } }) });
    expect(check(root)).toMatchObject({ exitCode: 1, lines: ["new package: left-pad in prototypes/site/package.json"] });
  });

  test("lists a package in a nested package.json whose spec changes to a range", async () => {
    const root = await repo({ "package.json": PACKAGE, "prototypes/site/package.json": PACKAGE });
    await change(root, { "prototypes/site/package.json": PACKAGE.replace('"4.6.7"', '"^4.6.7"') });
    expect(check(root)).toMatchObject({ exitCode: 1, lines: ["package without an exact version: zod in prototypes/site/package.json"] });
  });

  test("passes a new exact version in a nested package.json", async () => {
    const root = await repo({ "package.json": PACKAGE, "prototypes/site/package.json": PACKAGE });
    await change(root, { "prototypes/site/package.json": PACKAGE.replace("4.6.7", "4.6.8") });
    expect(check(root)).toMatchObject({ exitCode: 0, lines: [] });
  });

  test("cannot check a nested package.json that does not parse", async () => {
    const root = await repo({ "package.json": PACKAGE });
    await change(root, { "prototypes/site/package.json": "{ not json" });
    const result = check(root);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toStartWith("cannot check");
  });

  test("cannot check a package.json that does not parse", async () => {
    const root = await repo({ "package.json": PACKAGE });
    await change(root, { "package.json": "{ not json" });
    const result = check(root);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toStartWith("cannot check");
  });

  test("cannot check an argument that is not a range", async () => {
    const root = await repo({ "package.json": PACKAGE });
    expect(check(root, "--output=x..HEAD").exitCode).toBe(2);
    expect(check(root, "HEAD").exitCode).toBe(2);
  });
});
