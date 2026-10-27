// The private-detail check that runs before every push under Peter's standing approval
// (the `release` skill, step 1; decision record row 151; decision 0006).
//
//   bun scripts/private-detail-check.ts <from>..<to>
//
// It reads private.yaml at the repository root and every commit in the range, with its message
// and its changes (`git log -p`), so a value that a later commit removes still counts. It prints
// one number: how many private values the commits hold, plus one when private.yaml is tracked.
// A value with 7 or more digits, such as a phone number, also counts when spaces, dashes, dots,
// slashes or brackets separate its digits.
//
// Exit 0 when the number is 0, 1 when it is above 0, and 2 when it cannot check, with a reason
// on stderr. It fails closed: a missing or empty private.yaml, a file that does not parse, or a
// git error means "cannot check". It never prints a value, and never prints an error's own text,
// because a YAML or git error can quote the file.

const MIN_DIGITS = 7;
const SEPARATORS = "[\\s().+/-]{0,3}";

class CannotCheck extends Error {}

/** Every non-empty scalar value in the parsed private.yaml. */
export function privateValues(parsed: unknown): string[] {
  const values: string[] = [];
  const walk = (node: unknown): void => {
    if (node !== null && typeof node === "object") Object.values(node).forEach(walk);
    else if (node !== null && node !== undefined && String(node).trim() !== "") values.push(String(node).trim());
  };
  walk(parsed);
  return [...new Set(values)];
}

/** Whether the text holds the value as written, or, for a value with enough digits, its digits with separators. */
export function holds(text: string, value: string): boolean {
  if (text.includes(value)) return true;
  const digits = value.replace(/\D/g, "");
  if (digits.length < MIN_DIGITS) return false;
  return new RegExp(digits.split("").join(SEPARATORS)).test(text);
}

async function git(root: string, args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], { cwd: root, stdout: "pipe", stderr: "ignore" });
  const out = await new Response(proc.stdout).text();
  if ((await proc.exited) !== 0) throw new CannotCheck(`git ${args[0]} failed`);
  return out;
}

/** The number of private details that the commits in the range hold. */
export async function countPrivateDetails(range: string, cwd: string): Promise<number> {
  if (!/^[^-\s][^\s]*\.\.[^\s]+$/.test(range)) throw new CannotCheck("the argument is not a range such as origin/main..main");
  const root = (await git(cwd, ["rev-parse", "--show-toplevel"])).trim();
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
  const sent = await git(root, ["log", "-p", "--no-color", "--no-ext-diff", "--no-textconv", "--end-of-options", range, "--"]);
  const tracked = (await git(root, ["ls-files", "--", "private.yaml"])).trim() !== "";
  return values.filter((value) => holds(sent, value)).length + (tracked ? 1 : 0);
}

if (import.meta.main) {
  try {
    const count = await countPrivateDetails(Bun.argv[2] ?? "", process.cwd());
    console.log(count);
    process.exit(count === 0 ? 0 : 1);
  } catch (error) {
    console.error(`cannot check: ${error instanceof CannotCheck ? error.message : "unexpected error"}`);
    process.exit(2);
  }
}
