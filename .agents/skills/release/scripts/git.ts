// Shared by the `release` skill's checks. They run git and other tools without a shell, and fail closed:
// a tool that fails or is missing is a CannotCheck, whose message is fixed text and never quotes a file.

export class CannotCheck extends Error {}

/** Splits a range such as `origin/main..main`. Neither end may start with "-", so a range never acts as an option for git. */
export function parseRange(arg: string): { from: string; to: string } {
  const match = /^([^\s-][^\s]*?)\.\.([^\s.-][^\s]*)$/.exec(arg);
  if (!match) throw new CannotCheck("the argument is not a range such as origin/main..main");
  return { from: match[1]!, to: match[2]! };
}

/** Runs a command without a shell and returns its stdout; a missing tool or an exit code other than 0 is a CannotCheck. */
export async function run(cmd: string[], cwd: string, reason: string): Promise<Uint8Array> {
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(cmd, { cwd, stdin: "ignore", stdout: "pipe", stderr: "ignore" });
  } catch {
    throw new CannotCheck(reason);
  }
  const out = new Uint8Array(await new Response(proc.stdout as ReadableStream).arrayBuffer());
  if ((await proc.exited) !== 0) throw new CannotCheck(reason);
  return out;
}

export const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

export const git = (root: string, args: string[]): Promise<Uint8Array> => run(["git", ...args], root, `git ${args[0]} failed`);

export const gitText = async (root: string, args: string[]): Promise<string> => decode(await git(root, args));

export async function repoRoot(cwd: string): Promise<string> {
  return (await gitText(cwd, ["rev-parse", "--show-toplevel"])).trim();
}

/** Reports the check's result: exit 0 when `found` is false, 1 when it is true, and 2 with a fixed reason when it cannot check. */
export async function report(check: () => Promise<{ lines: string[]; found: boolean }>): Promise<never> {
  try {
    const { lines, found } = await check();
    for (const line of lines) console.log(line);
    process.exit(found ? 1 : 0);
  } catch (error) {
    console.error(`cannot check: ${error instanceof CannotCheck ? error.message : "unexpected error"}`);
    process.exit(2);
  }
}
