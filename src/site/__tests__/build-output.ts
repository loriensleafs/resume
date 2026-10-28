// The build output that seams 1 and 2 share (SPEC-site, Testing): `bun run build:site` writes it once per test run into
// the seam-1 folder, from the fixture root (fixture-root.ts). Seam 1 reads its files; seam 2 serves it with
// `bun run preview --dir`. So a test run builds the site once, never twice, and one build per checkout runs at a time:
// Nitro keeps the last build's output folder at a fixed path (src/site/build.ts).

import { join, resolve } from "node:path";
import { $ } from "bun";
import { FIXTURE_BUILD_DATE, type FixtureRole, writeFixtureRoot } from "./fixture-root";

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

/**
 * Runs the build script on the fixture root in `root`, into `outDir`. `bun run` starts the script in the repository,
 * so both folders are absolute. The script inherits `bun test`'s NODE_ENV, "test", and makes the production build all
 * the same. SOURCE_DATE_EPOCH gives it the fixture's build date (src/site/site-data.ts).
 */
function runBuildScript(root: string, outDir: string) {
  return $`${process.execPath} run build:site --root ${root} --out ${outDir}`
    .cwd(REPO)
    .env({ ...process.env, SOURCE_DATE_EPOCH: String(FIXTURE_BUILD_DATE / 1000) })
    .quiet()
    .nothrow();
}

async function build(): Promise<string> {
  await $`rm -rf ${folder}`.quiet();
  await writeFixtureRoot(seam1.root);
  const result = await runBuildScript(seam1.root, seam1.outDir);
  if (result.exitCode !== 0) {
    throw new Error(`bun run build:site failed with exit code ${result.exitCode}:\n${result.stderr}\n${result.stdout}`);
  }
  return result.stdout.toString();
}

/**
 * Runs the build script on a fixture root whose roles `changeRoles` changes, in a folder of its own beside the seam-1
 * folder, and gives its exit code and its standard error. It is for a build that must stop: such a build stops at its
 * data step, before Vite writes any file. Run it after buildOutput(), never beside it (one build per checkout at a
 * time).
 */
export async function buildRefused(
  name: string,
  changeRoles: (roles: FixtureRole[]) => FixtureRole[],
): Promise<{ exitCode: number; stderr: string }> {
  const refused = `${folder}-${name}`;
  await $`rm -rf ${refused}`.quiet();
  await writeFixtureRoot(`${refused}/root`, changeRoles);
  const result = await runBuildScript(`${refused}/root`, `${refused}/out`);
  return { exitCode: result.exitCode, stderr: result.stderr.toString() };
}
