// The approval check that runs before every push (the `release` skill, step 1). It lists the changes in a range
// that need Peter's approval each time and that the commits show (AGENTS.md, "Releases and approvals"; row 151).
//
//   bun .agents/skills/release/scripts/approval-check.ts <from>..<to>
//
// It compares the range's end with the commit where the range starts (their merge base), and prints one line per change:
// - "docs-only list: scripts/docs-only.txt" when the range changes or deletes that file and the base holds it;
// - "approved knowledge: <path>" for a file in knowledge/ that the range changes, deletes or moves, when the base's
//   version holds `status: approved` (SPEC-knowledge, "Drafts and approval");
// - "new package: <name>" for a name that package.json adds to dependencies, devDependencies, optionalDependencies,
//   peerDependencies or overrides.
// A new file needs no line: D30 writes the docs-only list, and the `write-source` skill puts a new source to Peter.
//
// Exit 0: none. Exit 1: some. Exit 2: it cannot check, and stderr says why (fail closed).

import { CannotCheck, gitText, parseRange, repoRoot, report } from "./git";

const DOCS_ONLY = "scripts/docs-only.txt";
const APPROVED = /^\s*status:\s*approved\s*$/m;
const PACKAGE_FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies", "overrides"];

/** The file's text at a commit, or null when the commit does not hold it. */
async function fileAt(root: string, commit: string, path: string): Promise<string | null> {
  const listed = await gitText(root, ["ls-tree", "--name-only", commit, "--", path]);
  return listed.trim() === "" ? null : gitText(root, ["cat-file", "blob", `${commit}:${path}`]);
}

function packageNames(json: string | null): Set<string> {
  if (json === null) return new Set();
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new CannotCheck("package.json does not parse");
  }
  const names = new Set<string>();
  for (const field of PACKAGE_FIELDS) {
    const map = (parsed as Record<string, unknown> | null)?.[field];
    if (map !== null && typeof map === "object") for (const name of Object.keys(map)) names.add(name);
  }
  return names;
}

/** The changes in the range that need Peter's approval, one line each. */
export async function approvalsNeeded(range: string, cwd: string): Promise<string[]> {
  const { from, to } = parseRange(range);
  const root = await repoRoot(cwd);
  const base = (await gitText(root, ["merge-base", from, to])).trim();
  const changes: string[] = [];

  // `-z` gives "<status>\0<path>\0" pairs; with `--no-renames`, a move is a deletion and an addition.
  const listing = (await gitText(root, ["diff", "--name-status", "-z", "--no-renames", base, to, "--", DOCS_ONLY, "knowledge"])).split("\0");
  for (let i = 0; i + 1 < listing.length; i += 2) {
    const [status, path] = [listing[i]!, listing[i + 1]!];
    if (status === "A") continue;
    if (path === DOCS_ONLY) changes.push(`docs-only list: ${path}`);
    else if (APPROVED.test((await fileAt(root, base, path)) ?? "")) changes.push(`approved knowledge: ${path}`);
  }

  const before = packageNames(await fileAt(root, base, "package.json"));
  for (const name of packageNames(await fileAt(root, to, "package.json"))) {
    if (!before.has(name)) changes.push(`new package: ${name}`);
  }
  return changes;
}

if (import.meta.main) {
  await report(async () => {
    const lines = await approvalsNeeded(Bun.argv[2] ?? "", process.cwd());
    return { lines, found: lines.length > 0 };
  });
}
