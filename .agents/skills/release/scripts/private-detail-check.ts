// The private-detail check that runs before every push under Peter's standing approval
// (the `release` skill, step 1; decision record row 151; decision 0006).
//
//   bun .agents/skills/release/scripts/private-detail-check.ts <from>..<to>
//
// It looks for each value of private.yaml, at the repository root, in everything the range sends:
// - each commit's message, author and committer, and each change, a merge commit's own changes included;
// - the whole content of each file version that the range adds or changes: a PDF's text (pdftotext), the text
//   of a zip file's XML parts, such as a Word file's (unzip), any other binary file's raw bytes, and a text file.
// The one rule for private details, src/private-details.ts, loads the values and finds each one: as written in
// any letter case, and a number with 7 or more digits in any format. It does not decode text that someone encoded
// on purpose, such as base64, gzip or UTF-16.
//
// It prints one number: how many values the range holds, plus one when private.yaml is tracked.
// Exit 0: none. Exit 1: some. Exit 2: it cannot check, and stderr says why. It fails closed: a missing, unreadable,
// empty or broken private.yaml, a number in it with fewer than 7 digits, a git error, or a pdftotext or unzip that
// fails or is missing all mean exit 2. It never prints a value, nor a tool's own error text, which could quote a file.

import { holds, loadPrivateValues } from "../../../../src/private-details";
import { CannotCheck, decode, git, gitText, parseRange, repoRoot, report, run } from "./git";

// Between two pieces of text, so that no match runs from one piece into the next: a NUL is no separator.
const SPLIT = "\n\u0000\n";
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // "PK": a zip file, such as a Word file

/** Each byte as one character, so the ASCII text inside a binary file stays readable. */
function bytesAsText(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
}

/** The text to search in one file version. A PDF or a zip file goes through a temporary file, deleted at once. */
async function contentText(bytes: Uint8Array, tmp: string): Promise<string> {
  const startsWith = (signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  if (startsWith(PDF) || startsWith(ZIP)) {
    const file = `${tmp}/private-detail-check-${crypto.randomUUID()}`;
    await Bun.write(file, bytes);
    try {
      const extracted = startsWith(PDF)
        ? decode(await run(["pdftotext", "-q", file, "-"], tmp, "pdftotext failed or is missing"))
        : decode(await run(["unzip", "-p", file], tmp, "unzip failed or is missing")).replace(/<[^>]*>/g, "");
      return bytesAsText(bytes) + SPLIT + extracted;
    } finally {
      await Bun.file(file).delete().catch(() => {});
    }
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
  const loaded = await loadPrivateValues(root);
  if (!loaded.ok) throw new CannotCheck(loaded.reason);

  const tmp = (Bun.env.TMPDIR ?? "/tmp").replace(/\/$/, "");
  // `-m` shows a merge's changes against each parent, so a value only in a conflict resolution shows too.
  // `--format=fuller` adds the committer. `--end-of-options` keeps the range from acting as an option.
  const pieces = [
    await gitText(root, ["log", "-p", "-m", "--format=fuller", "--no-color", "--no-ext-diff", "--no-textconv", "--end-of-options", range, "--"]),
  ];
  for (const id of await changedFileVersions(root, range)) {
    pieces.push(await contentText(await git(root, ["cat-file", "blob", id]), tmp));
  }
  const tracked = (await gitText(root, ["ls-files", "--", "private.yaml"])).trim() !== "";
  const sent = pieces.join(SPLIT);
  return loaded.values.filter((value) => holds(sent, value)).length + (tracked ? 1 : 0);
}

if (import.meta.main) {
  await report(async () => {
    const count = await countPrivateDetails(Bun.argv[2] ?? "", process.cwd());
    return { lines: [String(count)], found: count > 0 };
  });
}
