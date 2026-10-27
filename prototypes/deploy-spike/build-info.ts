// PROTOTYPE (deploy spike, check 1): the first build step. It writes public/build-info.json, which Vite copies
// into the static output, so check.ts can read which Bun ran this build and which deployment it is.
// It writes named fields only: the build environment also holds VERCEL_AUTOMATION_BYPASS_SECRET.
import { $ } from "bun";

const vercelJson = (await Bun.file(`${import.meta.dir}/vercel.json`).json()) as { bunVersion?: string };
// Vercel's install step picks the Bun 1.4 binary when bun.lock has lockfileVersion 2 (@vercel/build-utils 14.10.1).
const lockfileVersion = /"lockfileVersion":\s*(\d+)/.exec(await Bun.file(`${import.meta.dir}/bun.lock`).text())?.[1];

const info = {
  commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  vercelEnv: process.env.VERCEL_ENV ?? null,
  deploymentHost: process.env.VERCEL_URL ?? null, // the deployment's own address, no scheme
  branchHost: process.env.VERCEL_BRANCH_URL ?? null,
  vercelJsonBunVersion: vercelJson.bunVersion ?? null,
  lockfileVersion: lockfileVersion ? Number(lockfileVersion) : null,
  bunVersion: (await $`bun --version`.text()).trim(), // the `bun` on the build's PATH
  bunRevision: Bun.revision,
  bunPath: process.execPath,
  builtAt: new Date().toISOString(),
};

await Bun.write(`${import.meta.dir}/public/build-info.json`, JSON.stringify(info, null, 2) + "\n");
console.log(`build-info: bun ${info.bunVersion} at ${info.bunPath}; vercel.json bunVersion ${info.vercelJsonBunVersion}`);
