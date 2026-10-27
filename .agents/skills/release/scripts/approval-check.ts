// The approval check that runs before every push (the `release` skill, step 1). It lists the changes in a range
// that need Peter's approval each time and that the commits show (AGENTS.md, "Releases and approvals"; row 151).
//
//   bun .agents/skills/release/scripts/approval-check.ts <from>..<to>
//
// It compares the range's end with the commit where the range starts (their merge base), and prints one line per change:
// - "docs-only list: scripts/docs-only.txt" when the range changes or deletes that file and the base holds it.
//   A new list needs no line: D30 writes it from the approved spec.
// - "approved knowledge: <path>" for a file in knowledge/ that the range adds, changes, deletes or moves, when its
//   version before or after the change is approved: its YAML front matter, or for a YAML file any entry, holds
//   `status: approved` (SPEC-knowledge, "Drafts and approval"). A new approved source and a draft that becomes
//   approved both count, so each needs the row that holds Peter's approval.
// - "new package: <name>" for a name that the dependency fields of a package.json add; "package without an exact
//   version: <name>" for a known name whose spec changes to anything but an exact registry version (a range, a git
//   or GitHub reference, a URL, a tarball, `file:`, `link:`, `workspace:`, `npm:` or a nested override), because
//   that brings in other code; and "newly trusted package: <name>" for a name that trustedDependencies adds.
//   A change from one exact version to another passes: each task's review checks it. This covers every
//   package.json that the range adds or changes, at any path, such as a prototype's; a line for a package.json
//   other than the root one ends with " in <path>".
//
// Exit 0: none. Exit 1: some. Exit 2: it cannot check, and stderr says why (fail closed).

import { CannotCheck, gitText, parseRange, repoRoot, report } from "./git";

const DOCS_ONLY = "scripts/docs-only.txt";
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "overrides",
  "resolutions",
  "patchedDependencies",
];
// An exact registry version: major.minor.patch, with an optional pre-release and build part, such as 3.0.260903-beta.
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** The file's text at a commit, or null when the commit does not hold it. */
async function fileAt(root: string, commit: string, path: string): Promise<string | null> {
  const listed = await gitText(root, ["ls-tree", "--name-only", commit, "--", path]);
  return listed.trim() === "" ? null : gitText(root, ["cat-file", "blob", `${commit}:${path}`]);
}

function parseYaml(text: string, path: string): unknown {
  try {
    return Bun.YAML.parse(text);
  } catch {
    throw new CannotCheck(`the YAML in ${path} does not parse`);
  }
}

/** Whether a knowledge file is approved: its front matter's `status`, or for a YAML file any entry's `status`, is "approved". */
function isApproved(path: string, text: string | null): boolean {
  if (text === null) return false;
  const approved = (status: unknown) => String(status ?? "").trim().toLowerCase() === "approved";
  if (/\.ya?ml$/.test(path)) {
    let found = false;
    const walk = (node: unknown): void => {
      if (node === null || typeof node !== "object") return;
      if (!Array.isArray(node) && approved((node as Record<string, unknown>).status)) found = true;
      Object.values(node).forEach(walk);
    };
    walk(parseYaml(text, path));
    return found;
  }
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!frontMatter) return false;
  const parsed = parseYaml(frontMatter[1]!, path);
  return parsed !== null && typeof parsed === "object" && approved((parsed as Record<string, unknown>).status);
}

/** The package.json fields that this check reads, each as a map from name to spec. */
function dependencies(json: string | null, path: string): { specs: Map<string, Map<string, unknown>>; trusted: Set<string> } {
  const specs = new Map<string, Map<string, unknown>>();
  const trusted = new Set<string>();
  if (json === null) return { specs, trusted };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) ?? {};
  } catch {
    throw new CannotCheck(`${path} does not parse`);
  }
  for (const field of DEPENDENCY_FIELDS) {
    const map = parsed[field];
    specs.set(field, new Map(map !== null && typeof map === "object" ? Object.entries(map) : []));
  }
  const trustedList = parsed.trustedDependencies;
  if (Array.isArray(trustedList)) for (const name of trustedList) trusted.add(String(name));
  return { specs, trusted };
}

/** The changes to the package.json at `path` that need Peter's approval. */
function packageChanges(path: string, before: string | null, after: string | null): string[] {
  const base = dependencies(before, path);
  const tip = dependencies(after, path);
  const known = new Set([...base.specs.values()].flatMap((map) => [...map.keys()]));
  const where = path === "package.json" ? "" : ` in ${path}`;
  const lines = new Set<string>();
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, spec] of tip.specs.get(field)!) {
      if (!known.has(name)) lines.add(`new package: ${name}${where}`);
      else if (spec !== base.specs.get(field)!.get(name) && !(typeof spec === "string" && EXACT_VERSION.test(spec))) {
        lines.add(`package without an exact version: ${name}${where}`);
      }
    }
  }
  for (const name of tip.trusted) if (!base.trusted.has(name)) lines.add(`newly trusted package: ${name}${where}`);
  return [...lines];
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
    if (path === DOCS_ONLY) {
      if (status !== "A") changes.push(`docs-only list: ${path}`);
    } else if (isApproved(path, await fileAt(root, base, path)) || isApproved(path, await fileAt(root, to, path))) {
      changes.push(`approved knowledge: ${path}`);
    }
  }

  // Every package.json that the range adds or changes, at any depth; `**/` also matches the root.
  const manifests = (await gitText(root, ["diff", "--name-only", "-z", "--no-renames", "--diff-filter=AM", base, to, "--", ":(glob)**/package.json"]))
    .split("\0")
    .filter(Boolean);
  for (const path of manifests) {
    changes.push(...packageChanges(path, await fileAt(root, base, path), await fileAt(root, to, path)));
  }
  return changes;
}

if (import.meta.main) {
  await report(async () => {
    const lines = await approvalsNeeded(Bun.argv[2] ?? "", process.cwd());
    return { lines, found: lines.length > 0 };
  });
}
