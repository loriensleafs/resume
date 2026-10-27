// The private-detail check that runs before every push (the `release` skill, step 1; row 151).
// Each test makes a temporary repository with a fixture private.yaml and fake commits, then runs
// the script on a commit range the way the skill does.

import { afterAll, describe, expect, test } from "bun:test";

const SCRIPT = `${import.meta.dir}/../private-detail-check.ts`;
const FAKE_PHONE = "(555) 555-0100";
const FIXTURE = `basics:\n  phone: ${FAKE_PHONE}\n`;
const roots: string[] = [];

function git(root: string, ...args: string[]): string {
  const result = Bun.spawnSync(
    ["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", ...args],
    { cwd: root },
  );
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr.toString()}`);
  return result.stdout.toString().trim();
}

/** A repository with one base commit, tagged `base`, and an untracked private.yaml. */
async function repo(privateYaml: string | null = FIXTURE): Promise<string> {
  const root = `${Bun.env.TMPDIR ?? "/tmp"}/private-detail-check-${crypto.randomUUID()}`;
  roots.push(root);
  await Bun.write(`${root}/.gitignore`, "private.yaml\n");
  if (privateYaml !== null) await Bun.write(`${root}/private.yaml`, privateYaml);
  git(root, "init", "-q");
  git(root, "add", ".gitignore");
  git(root, "commit", "-q", "-m", "base");
  git(root, "tag", "base");
  return root;
}

async function commit(root: string, file: string, text: string, message = "change"): Promise<void> {
  await Bun.write(`${root}/${file}`, text);
  git(root, "add", "--force", file);
  git(root, "commit", "-q", "-m", message);
}

function check(root: string, range = "base..HEAD") {
  const result = Bun.spawnSync(["bun", SCRIPT, range], { cwd: root });
  const stdout = result.stdout.toString();
  const stderr = result.stderr.toString();
  return { exitCode: result.exitCode, stdout, stderr, all: stdout + stderr };
}

afterAll(() => {
  for (const root of roots) Bun.spawnSync(["rm", "-rf", root]);
});

describe("the private-detail check", () => {
  test("prints 0 for commits that hold no private detail", async () => {
    const root = await repo();
    await commit(root, "notes.md", "A public note.\n");
    const result = check(root);
    expect(result.stdout).toBe("0\n");
    expect(result.exitCode).toBe(0);
  });

  test("counts a value written in a changed file, and prints no value", async () => {
    const root = await repo();
    await commit(root, "notes.md", `Call ${FAKE_PHONE}.\n`);
    const result = check(root);
    expect(result.stdout).toBe("1\n");
    expect(result.exitCode).toBe(1);
    expect(result.all).not.toContain("555");
  });

  test("counts a phone number written with other spaces and dashes", async () => {
    const root = await repo();
    await commit(root, "notes.md", "Call 555 555 0100 or 555.555.0100.\n");
    const result = check(root);
    expect(result.stdout).toBe("1\n");
    expect(result.exitCode).toBe(1);
  });

  test("counts a value that only a commit message holds", async () => {
    const root = await repo();
    await commit(root, "notes.md", "A public note.\n", `Note for ${FAKE_PHONE}`);
    const result = check(root);
    expect(result.stdout).toBe("1\n");
    expect(result.exitCode).toBe(1);
  });

  test("counts a value that a later commit in the range removes again", async () => {
    const root = await repo();
    await commit(root, "notes.md", `Call ${FAKE_PHONE}.\n`);
    await commit(root, "notes.md", "A public note.\n");
    const result = check(root);
    expect(result.stdout).toBe("1\n");
    expect(result.exitCode).toBe(1);
  });

  test("counts a tracked private.yaml", async () => {
    const root = await repo();
    git(root, "add", "--force", "private.yaml");
    git(root, "commit", "-q", "-m", "track the private file");
    const result = check(root);
    expect(Number(result.stdout)).toBeGreaterThan(0);
    expect(result.exitCode).toBe(1);
    expect(result.all).not.toContain("555");
  });

  test("cannot check without private.yaml, and says so", async () => {
    const root = await repo(null);
    await commit(root, "notes.md", "A public note.\n");
    const result = check(root);
    expect(result.stdout).toBe("");
    expect(result.stderr).toStartWith("cannot check");
    expect(result.exitCode).toBe(2);
  });

  test("cannot check a private.yaml that holds no value", async () => {
    const root = await repo("basics: {}\n");
    await commit(root, "notes.md", "A public note.\n");
    const result = check(root);
    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(2);
  });

  test("cannot check a private.yaml that does not parse, and quotes none of it", async () => {
    const root = await repo(`basics: [\n  phone: ${FAKE_PHONE}\n`);
    await commit(root, "notes.md", "A public note.\n");
    const result = check(root);
    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(2);
    expect(result.all).not.toContain("555");
  });

  test("cannot check a range that git does not know", async () => {
    const root = await repo();
    const result = check(root, "nope..HEAD");
    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(2);
  });

  test("cannot check an argument that is not a range", async () => {
    const root = await repo();
    expect(check(root, "--output=x").exitCode).toBe(2);
    expect(check(root, "HEAD").exitCode).toBe(2);
  });
});
