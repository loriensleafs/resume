// PROTOTYPE (deploy spike): the last build step. It writes build-info.json into the static output twice:
// - /build-info.json, which check.ts polls on the protected deployment and Git branch hosts;
// - /api/build-info.json, which stays reachable on the production .vercel.app address after D3 adds the host
//   redirect there (SPEC-deploy's redirect leaves /api/ alone), so `wait` can confirm that address too.
// Checks take their expected values from this file, read from the built output, not from constants in check.ts.
// It writes named fields only: the build environment also holds VERCEL_AUTOMATION_BYPASS_SECRET.
import { $, Glob } from "bun";

const root = import.meta.dir;
const output = `${root}/.vercel/output`;
const vercelJson = (await Bun.file(`${root}/vercel.json`).json()) as { bunVersion?: string };
// Vercel's install step picks the Bun 1.4 binary when bun.lock has lockfileVersion 2 (@vercel/build-utils 14.10.1).
const lockfileVersion = /"lockfileVersion":\s*(\d+)/.exec(await Bun.file(`${root}/bun.lock`).text())?.[1];

// Each function's runtime settings as the build wrote them, keyed by its path ("/__server").
const functions: Record<string, { runtime: string | null; maxDuration: number | null }> = {};
const configs = new Glob("**/.vc-config.json").scan({ cwd: `${output}/functions`, dot: true, followSymlinks: true });
for await (const path of configs) {
  const config = (await Bun.file(`${output}/functions/${path}`).json()) as { runtime?: string; maxDuration?: number };
  functions[`/${path.replace(/\.func\/\.vc-config\.json$/, "")}`] = {
    runtime: config.runtime ?? null,
    maxDuration: config.maxDuration ?? null,
  };
}

const info = {
  commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  vercelEnv: process.env.VERCEL_ENV ?? null,
  deploymentHost: process.env.VERCEL_URL ?? null, // the deployment's own address, no scheme
  branchHost: process.env.VERCEL_BRANCH_URL ?? null,
  productionHost: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
  vercelJsonBunVersion: vercelJson.bunVersion ?? null,
  lockfileVersion: lockfileVersion ? Number(lockfileVersion) : null,
  bunVersion: (await $`bun --version`.text()).trim(), // the `bun` on the build's PATH
  bunRevision: Bun.revision,
  bunPath: process.execPath,
  functions,
  builtAt: new Date().toISOString(),
};

const json = JSON.stringify(info, null, 2) + "\n";
await Bun.write(`${output}/static/build-info.json`, json);
await Bun.write(`${output}/static/api/build-info.json`, json);
console.log(
  `build-info: bun ${info.bunVersion} at ${info.bunPath}; vercel.json bunVersion ${info.vercelJsonBunVersion}; ` +
    `lockfileVersion ${info.lockfileVersion}; functions ${Object.keys(functions).join(", ") || "none"}`,
);
