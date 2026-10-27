// PROTOTYPE (deploy spike): the last build step. It writes build-info.json into the static output twice:
// - /build-info.json, which check.ts polls on the protected deployment and Git branch hosts;
// - /api/build-info.json, which stays reachable on the production .vercel.app address after D3 adds the host
//   redirect there (SPEC-deploy's redirect leaves /api/ alone), so `wait` can confirm that address too.
// Checks take their expected values from this file, read from the built output, not from constants in check.ts:
// each function's runtime, the prerendered pages with their overrides, the not-found page and the crons.
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

// What config.json holds after post-build.ts (checks 2 and 3), with the SHA-256 of each file a route serves,
// so a check can tell the static file from a page a function rendered.
const sha256 = async (path: string) =>
  (await Bun.file(path).exists()) ? new Bun.CryptoHasher("sha256").update(await Bun.file(path).bytes()).digest("hex") : null;
const config = (await Bun.file(`${output}/config.json`).json()) as {
  routes?: unknown[];
  overrides?: Record<string, { path?: string }>;
  crons?: { path: string; schedule: string }[];
};
// The prerendered pages, read from the files, so check 2 asks each clean address whether or not an override names it.
const pages: { file: string; path: string; sha256: string | null; override: string | null }[] = [];
for await (const file of new Glob("**/index.html").scan({ cwd: `${output}/static` })) {
  if (file === "index.html") continue;
  const override = config.overrides?.[file]?.path ?? null;
  pages.push({ file, path: file.slice(0, -"/index.html".length), sha256: await sha256(`${output}/static/${file}`), override });
}
pages.sort((a, b) => a.path.localeCompare(b.path));

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
  routeCount: config.routes?.length ?? 0,
  pages, // each prerendered page except /, with the clean address its config.json override names (or null)
  notFoundSha256: await sha256(`${output}/static/404.html`),
  crons: config.crons ?? [],
  builtAt: new Date().toISOString(),
};

const json = JSON.stringify(info, null, 2) + "\n";
await Bun.write(`${output}/static/build-info.json`, json);
await Bun.write(`${output}/static/api/build-info.json`, json);
console.log(
  `build-info: bun ${info.bunVersion} at ${info.bunPath}; vercel.json bunVersion ${info.vercelJsonBunVersion}; ` +
    `lockfileVersion ${info.lockfileVersion}; functions ${Object.entries(functions).map(([f, c]) => `${f} ${c.runtime}`).join(", ") || "none"}; ` +
    `${info.routeCount} routes, ${pages.filter((p) => p.override !== null).length} of ${pages.length} pages with an override, ` +
    `${info.crons.length} crons`,
);
