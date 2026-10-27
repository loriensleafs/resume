// The `release` skill's private-detail check, `.agents/skills/release/scripts/private-detail-check.ts` (row 151).
// Bun's test runner skips folders whose names start with a dot, so this test sits in the root `__tests__/`
// with the other checks of the agent files. Each test makes a temporary repository with a fixture
// private.yaml and fake commits, then runs the script on a range the way the skill does.

import { afterAll, describe, expect, test } from "bun:test";

const SCRIPT = `${import.meta.dir}/../.agents/skills/release/scripts/private-detail-check.ts`;
const FAKE_PHONE = "(555) 555-0100";
const FAKE_EMAIL = "Fake.Person@Example.com";
const FIXTURE = `basics:\n  phone: ${FAKE_PHONE}\n  email: ${FAKE_EMAIL}\n`;
const GIT = ["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false"];
const roots: string[] = [];

function git(root: string, ...args: string[]): string {
  const result = Bun.spawnSync([...GIT, ...args], { cwd: root });
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

async function commit(root: string, file: string, content: string | Uint8Array, message = "change"): Promise<void> {
  await Bun.write(`${root}/${file}`, content);
  git(root, "add", "--force", file);
  git(root, "commit", "-q", "-m", message);
}

function check(root: string, range = "base..HEAD") {
  const result = Bun.spawnSync(["bun", SCRIPT, range], { cwd: root });
  const stdout = result.stdout.toString();
  const stderr = result.stderr.toString();
  return { exitCode: result.exitCode, stdout, stderr, all: stdout + stderr };
}

/** The check prints the count, exits 1 when it is above 0, and never prints a fixture value. */
function expectCount(root: string, count: number): void {
  const result = check(root);
  expect(result.stdout).toBe(`${count}\n`);
  expect(result.exitCode).toBe(count === 0 ? 0 : 1);
  expect(result.all).not.toContain("555");
  expect(result.all.toLowerCase()).not.toContain("fake.person");
}

/** A one-page PDF whose text sits in a compressed stream, so only a PDF reader finds it. */
function pdf(text: string): Uint8Array {
  const plain = new TextEncoder().encode(`BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, (c) => `\\${c}`)}) Tj ET`);
  const deflated = Bun.deflateSync(plain);
  let a = 1;
  let b = 0;
  for (const byte of plain) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const stream = new Uint8Array(deflated.length + 6); // a zlib stream: a header, the deflate data, then its Adler-32
  stream.set([0x78, 0x9c], 0);
  stream.set(deflated, 2);
  new DataView(stream.buffer).setUint32(deflated.length + 2, ((b << 16) | a) >>> 0);
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? new TextEncoder().encode(part) : part;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (n: number, ...body: (string | Uint8Array)[]) => {
    offsets.push(length);
    push(`${n} 0 obj\n`);
    body.forEach(push);
    push("\nendobj\n");
  };
  push("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>");
  object(4, `<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`, stream, "\nendstream");
  object(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const xref = length;
  const rows = offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  push(`xref\n0 6\n0000000000 65535 f \n${rows}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** A Word-like zip whose document.xml splits the text across two runs; zip compresses it. */
async function docx(text: string): Promise<Uint8Array> {
  const dir = `${Bun.env.TMPDIR ?? "/tmp"}/private-detail-docx-${crypto.randomUUID()}`;
  roots.push(dir);
  const half = Math.floor(text.length / 2);
  const runs = `<w:r><w:t>${text.slice(0, half)}</w:t></w:r><w:r><w:t>${text.slice(half)}</w:t></w:r>`;
  await Bun.write(`${dir}/word/document.xml`, `<?xml version="1.0"?><w:document><w:body><w:p>${runs}</w:p></w:body></w:document>`);
  const zipped = Bun.spawnSync(["zip", "-q", "-r", "-9", "out.docx", "word"], { cwd: dir });
  if (zipped.exitCode !== 0) throw new Error("zip failed");
  return new Uint8Array(await Bun.file(`${dir}/out.docx`).arrayBuffer());
}

afterAll(() => {
  for (const root of roots) Bun.spawnSync(["rm", "-rf", root]);
});

describe("the private-detail check", () => {
  test("prints 0 for commits that hold no private detail", async () => {
    const root = await repo();
    await commit(root, "notes.md", "A public note.\n");
    expectCount(root, 0);
  });

  test("counts a value written in a changed file", async () => {
    const root = await repo();
    await commit(root, "notes.md", `Call ${FAKE_PHONE}.\n`);
    expectCount(root, 1);
  });

  test.each([
    ["spaces and dots", "Call 555 555 0100 or 555.555.0100.\n"],
    ["en dashes", "Call 555–555–0100.\n"],
    ["em dashes", "Call 555—555—0100.\n"],
    ["four separators", "Call (555) - 555 - 0100.\n"],
    ["a space between each digit", "Call 5 5 5 5 5 5 0 1 0 0.\n"],
    ["a blank line", "Call 555\n\n555-0100.\n"],
    ["indentation", "Call 555\n        555-0100.\n"],
    ["underscores", "Call 555_555_0100.\n"],
    ["a zero-width space", "Call 555​555​0100.\n"],
  ])("counts a phone number split by %s", async (_name, text) => {
    const root = await repo();
    await commit(root, "notes.md", text);
    expectCount(root, 1);
  });

  test("counts a phone number written in other digits", async () => {
    const root = await repo();
    await commit(root, "notes.md", "Call ５５５-５５５-０１００.\n");
    expectCount(root, 1);
  });

  test("cannot check a number with fewer than 7 digits, and quotes none of it", async () => {
    const root = await repo("basics:\n  code: 123-456\n");
    await commit(root, "notes.md", "Code 123-456.\n");
    const result = check(root);
    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(2);
    expect(result.all).not.toContain("123");
  });

  test("matches an email in any letter case", async () => {
    const root = await repo();
    await commit(root, "notes.md", `Write to ${FAKE_EMAIL.toLowerCase()}.\n`);
    expectCount(root, 1);
  });

  test("counts a value that only a commit message holds", async () => {
    const root = await repo();
    await commit(root, "notes.md", "A public note.\n", `Note for ${FAKE_PHONE}`);
    expectCount(root, 1);
  });

  test("counts a value that only the committer holds", async () => {
    const root = await repo();
    await Bun.write(`${root}/notes.md`, "A public note.\n");
    git(root, "add", "notes.md");
    const result = Bun.spawnSync([...GIT, "commit", "-q", "-m", "change"], {
      cwd: root,
      env: { ...Bun.env, GIT_COMMITTER_NAME: "Someone", GIT_COMMITTER_EMAIL: FAKE_EMAIL },
    });
    expect(result.exitCode).toBe(0);
    expectCount(root, 1);
  });

  test("counts a value that a later commit in the range removes again", async () => {
    const root = await repo();
    await commit(root, "notes.md", `Call ${FAKE_PHONE}.\n`);
    await commit(root, "notes.md", "A public note.\n");
    expectCount(root, 1);
  });

  test("counts a value that only a merge's conflict resolution holds", async () => {
    const root = await repo();
    await commit(root, "notes.md", "first\n");
    git(root, "checkout", "-q", "-b", "side");
    await commit(root, "notes.md", "side\n");
    git(root, "checkout", "-q", "-");
    await commit(root, "notes.md", "main\n");
    expect(Bun.spawnSync([...GIT, "merge", "-q", "side"], { cwd: root }).exitCode).not.toBe(0); // a conflict
    await Bun.write(`${root}/notes.md`, `Call ${FAKE_PHONE}.\n`);
    git(root, "add", "notes.md");
    git(root, "commit", "-q", "--no-edit");
    expectCount(root, 1);
  });

  test("counts a value in a PDF's compressed text", async () => {
    const root = await repo();
    const file = pdf(`Call ${FAKE_PHONE}.`);
    expect(new TextDecoder().decode(file)).not.toContain("555-0100"); // control: the raw bytes hide it
    await commit(root, "documents/resume.pdf", file);
    expectCount(root, 1);
  });

  test("counts a value in a Word file's text, split across runs", async () => {
    const root = await repo();
    const file = await docx(`Call ${FAKE_PHONE}.`);
    expect(new TextDecoder().decode(file)).not.toContain("555-0100"); // control: the raw bytes hide it
    await commit(root, "documents/resume.docx", file);
    expectCount(root, 1);
  });

  test("counts a value in a binary file's raw bytes", async () => {
    const root = await repo();
    const text = new TextEncoder().encode(`Call ${FAKE_PHONE}.`);
    await commit(root, "data.bin", new Uint8Array([0, 1, 2, ...text, 0]));
    expectCount(root, 1);
  });

  test("counts a value in a file that .gitattributes marks as binary", async () => {
    const root = await repo();
    await Bun.write(`${root}/.gitattributes`, "*.txt binary\n");
    git(root, "add", ".gitattributes");
    await commit(root, "notes.txt", `Call ${FAKE_PHONE}.\n`);
    expectCount(root, 1);
  });

  test("counts a private.yaml that the range tracks", async () => {
    const root = await repo();
    git(root, "add", "--force", "private.yaml");
    git(root, "commit", "-q", "-m", "track the private file");
    const result = check(root);
    expect(Number(result.stdout)).toBeGreaterThan(0);
    expect(result.exitCode).toBe(1);
    expect(result.all).not.toContain("555");
  });

  test("counts a private.yaml that an earlier commit tracked, though the range holds no value", async () => {
    const root = await repo();
    git(root, "add", "--force", "private.yaml");
    git(root, "commit", "-q", "-m", "track the private file");
    git(root, "tag", "-f", "base");
    await commit(root, "notes.md", "A public note.\n");
    expectCount(root, 1);
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
    expect(check(root, "--output=x..HEAD").exitCode).toBe(2);
    expect(check(root, "HEAD").exitCode).toBe(2);
  });
});
