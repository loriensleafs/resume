// The private-detail check that runs before every push under Peter's standing approval
// (the `release` skill, step 1; decision record row 151; decision 0006).
//
//   bun .agents/skills/release/scripts/private-detail-check.ts <from>..<to>
//
// It looks for each value of private.yaml, at the repository root, in everything the range sends:
// - each commit's message, author and committer, and each change, a merge commit's own changes included;
// - the whole content of each file version that the range adds or changes: a PDF's text (pdftotext), the text
//   of a zip file's XML parts, such as a Word file's (unzip), any other binary file's raw bytes, and a text file.
// A value matches in any letter case. A value with 7 or more digits, such as a phone number, also matches with
// separators between its digits: up to 4 spaces, brackets, dots, plus signs, slashes, hyphens or dashes, or a
// line break (two for a blank line) followed by indentation. Fewer digits would match too much other text.
//
// It prints one number: how many values the range holds, plus one when private.yaml is tracked.
// Exit 0: none. Exit 1: some. Exit 2: it cannot check, and stderr says why. It fails closed: a missing, empty
// or broken private.yaml, a git error, or a pdftotext or unzip that fails or is missing all mean exit 2.
// It never prints a value, nor a tool's own error text, which could quote a file.

import { CannotCheck, decode, git, gitText, parseRange, repoRoot, report, run } from "./git";

const MIN_DIGITS = 7;
// One separator: a space, a tab or a no-break space, a bracket, a dot, a plus sign, a slash, a hyphen, or a dash (U+2010 to U+2015, U+2212).
const SEPARATOR = "[\\t \\u00a0().+/\\-\\u2010-\\u2015\\u2212]";
// A line break, then up to 12 characters of indentation: spaces, a diff's "+", a quote's ">", a list's "*" or "-".
const LINE_BREAK = "\\r?\\n[\\t \\u00a0+>*\\-]{0,12}";
// Between two digits: up to 4 separators, or one or two line breaks with up to 4 separators around them.
const GAP = `(?:${SEPARATOR}{0,4}|${SEPARATOR}{0,4}(?:${LINE_BREAK}){1,2}${SEPARATOR}{0,4})`;
// Between two pieces of text, so that no match runs from one piece into the next.
const SPLIT = "\n\u0000\n";
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // "PK": a zip file, such as a Word file

/** Every non-empty scalar value in the parsed private.yaml. */
export function privateValues(parsed: unknown): string[] {
  const values: string[] = [];
  const walk = (node: unknown): void => {
    if (node !== null && typeof node === "object") Object.values(node).forEach(walk);
    else if (node !== null && node !== undefined) {
      const value = String(node).trim();
      if (value !== "") values.push(value);
    }
  };
  walk(parsed);
  return [...new Set(values)];
}

/** How many of the values the text holds: as written in any letter case, or, with enough digits, with separators. */
export function countHeld(values: string[], text: string): number {
  const lower = text.toLowerCase();
  return values.filter((value) => {
    if (lower.includes(value.toLowerCase())) return true;
    const digits = value.replace(/\D/g, "");
    return digits.length >= MIN_DIGITS && new RegExp(digits.split("").join(GAP)).test(text);
  }).length;
}

/** Each byte as one character, so the ASCII text inside a binary file stays readable. */
function bytesAsText(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
}

/** The text to search in one file version. */
async function contentText(bytes: Uint8Array, dir: string): Promise<string> {
  const startsWith = (signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  if (startsWith(PDF) || startsWith(ZIP)) {
    const file = `${dir}/${crypto.randomUUID()}`;
    await Bun.write(file, bytes);
    const extracted = startsWith(PDF)
      ? decode(await run(["pdftotext", "-q", file, "-"], dir, "pdftotext failed or is missing"))
      : decode(await run(["unzip", "-p", file], dir, "unzip failed or is missing")).replace(/<[^>]*>/g, "");
    return bytesAsText(bytes) + SPLIT + extracted;
  }
  // Git's own rule: a NUL byte in the first 8,000 bytes makes a file binary.
  return bytes.subarray(0, 8000).includes(0) ? bytesAsText(bytes) : decode(bytes);
}

/** The ids of the file versions that the range's commits add or change, against each parent of a merge. */
async function changedFileVersions(root: string, range: string): Promise<string[]> {
  const raw = await gitText(root, ["log", "-m", "--raw", "--no-abbrev", "--no-renames", "--format=", "--end-of-options", range, "--"]);
  const ids = new Set<string>();
  // Each line: ":<old mode> <new mode> <old id> <new id> <status>\t<path>".
  for (const line of raw.split("\n")) {
    const match = /^:\d+ (\d+) [0-9a-f]+ ([0-9a-f]+) [A-Z]/.exec(line);
    // Mode 160000 is a submodule, and an all-zero id is a deleted file: neither has content here.
    if (match && match[1] !== "160000" && !/^0+$/.test(match[2]!)) ids.add(match[2]!);
  }
  return [...ids];
}

/** The number of private details that the commits in the range hold. */
export async function countPrivateDetails(range: string, cwd: string): Promise<number> {
  parseRange(range);
  const root = await repoRoot(cwd);
  const file = Bun.file(`${root}/private.yaml`);
  if (!(await file.exists())) throw new CannotCheck("private.yaml is missing in this clone");
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(await file.text());
  } catch {
    throw new CannotCheck("private.yaml does not parse");
  }
  const values = privateValues(parsed);
  if (values.length === 0) throw new CannotCheck("private.yaml holds no value");

  const dir = `${Bun.env.TMPDIR ?? "/tmp"}/private-detail-check-${crypto.randomUUID()}`;
  try {
    // `-m` shows a merge's changes against each parent, so a value only in a conflict resolution shows too.
    // `--format=fuller` adds the committer. `--end-of-options` keeps the range from acting as an option.
    const pieces = [
      await gitText(root, ["log", "-p", "-m", "--format=fuller", "--no-color", "--no-ext-diff", "--no-textconv", "--end-of-options", range, "--"]),
    ];
    for (const id of await changedFileVersions(root, range)) {
      pieces.push(await contentText(await git(root, ["cat-file", "blob", id]), dir));
    }
    const tracked = (await gitText(root, ["ls-files", "--", "private.yaml"])).trim() !== "";
    return countHeld(values, pieces.join(SPLIT)) + (tracked ? 1 : 0);
  } finally {
    Bun.spawnSync(["rm", "-rf", dir]);
  }
}

if (import.meta.main) {
  await report(async () => {
    const count = await countPrivateDetails(Bun.argv[2] ?? "", process.cwd());
    return { lines: [String(count)], found: count > 0 };
  });
}
