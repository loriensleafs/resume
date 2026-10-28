// The build output that seams 1 and 2 share (SPEC-site, Testing): `bun run build:site` writes it once per test run into
// the seam-1 folder, from the fixture root (fixture-root.ts). Seam 1 reads its files; seam 2 serves it with
// `bun run preview --dir`. So a test run builds the site once, never twice, and one build per checkout runs at a time:
// Nitro keeps the last build's output folder at a fixed path (src/site/build.ts).

import { join, resolve } from "node:path";
import { $ } from "bun";
import { writeFixtureRoot } from "./fixture-root";

const REPO = resolve(import.meta.dir, "../../..");

/**
 * The seam-1 folder: one per checkout, named after the checkout's path, so two checkouts never share one. `bun test`
 * runs no exit hook (seen with Bun 1.4.4: neither `exit` nor `beforeExit` fires), and the first test file to finish
 * cannot know whether a later one needs the folder. So the folder stays after the run, ready to look at, and the next
 * run replaces it.
 */
const folder = join(Bun.env.TMPDIR ?? "/tmp", `site-test-${Bun.hash(REPO).toString(36)}`);

/** The folders of the build output: the fixture root it reads, the folder it writes, and the static folder in it. */
export const seam1 = {
  root: `${folder}/root`,
  outDir: `${folder}/out`,
  staticDir: `${folder}/out/.vercel/output/static`,
} as const;

let built: Promise<string> | undefined;

/**
 * Builds the seam-1 folder, with every step that Vercel's build runs (SPEC-deploy, "The build script"). The first call
 * of a test run builds; every later call gets the same build, or the same failure. It resolves to what the build script
 * wrote to standard output, TanStack Start's prerender log among it.
 */
export function buildOutput(): Promise<string> {
  built ??= build();
  return built;
}

async function build(): Promise<string> {
  await $`rm -rf ${folder}`.quiet();
  await writeFixtureRoot(seam1.root);
  // `bun run` starts the script in the repository, so both folders are absolute. The script inherits `bun test`'s
  // NODE_ENV, "test", and makes the production build all the same.
  const result = await $`${process.execPath} run build:site --root ${seam1.root} --out ${seam1.outDir}`
    .cwd(REPO)
    .quiet()
    .nothrow();
  if (result.exitCode !== 0) {
    throw new Error(`bun run build:site failed with exit code ${result.exitCode}:\n${result.stderr}\n${result.stdout}`);
  }
  return result.stdout.toString();
}
