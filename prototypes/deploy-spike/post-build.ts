// PROTOTYPE (deploy spike): the spike's twin of SPEC-deploy's writeVercelConfig(), plus the static not-found page.
// `bun post-build.ts` runs after `vite build` (see package.json) and:
// 1. writes static/404.html, a not-found page with no script (SPEC-site amendment 5);
// 2. replaces the `routes` Nitro wrote in .vercel/output/config.json with SPEC-deploy's list ("Routes"), keeps
//    Nitro's other fields, and adds `overrides` for the prerendered pages and the cron. One route is new to the
//    spec's list: function folders that no API route names get the not-found page (check 3, run 40570467882).
// Checks 2 and 3 test what Vercel does with this file. D3 adds the redirects and the header routes.
// check.ts imports the route and cron values below, so the build and the checks cannot drift apart. Importing
// this file writes nothing: the build runs only when the file is the entry point (import.meta.main).
// https://vercel.com/docs/build-output-api/configuration, https://bun.com/docs/guides/util/entrypoint
import { Glob } from "bun";

/** The path of the spike's API route; GET answers with the function's name and Bun (src/site/routes/api.spike.ts). */
export const SPIKE_PATH = "/api/spike";

/**
 * The API routes (SPEC-deploy step 4): each path and the function it runs in. /api/spike is the chat's twin (its
 * own function); /api/cron/health goes to __server, as SPEC-deploy's /api/status and /api/cron/health do. D4 adds
 * the health route's handler.
 */
export const API_ROUTES = [
  { path: SPIKE_PATH, fn: "/api/spike" },
  { path: "/api/cron/health", fn: "/__server" },
] as const;

/**
 * Spike only: a query on /api/spike picks another function. `probe` marks the function with Nitro's documented
 * runtime value "bun1.x": check 2 records its Bun and does not judge it.
 */
export const QUERY_ROUTES = [
  { query: "server", fn: "/__server", probe: false }, // a route's dest to /__server, as the spec's status and health
  { query: "bun1x", fn: "/api/spike-bun1x", probe: true },
] as const;

/** SPEC-deploy's cron. */
export const CRON = { path: "/api/cron/health", schedule: "17 15 * * *" } as const;

const NOT_FOUND_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found</title>
</head>
<body>
<main>
<h1>Page not found</h1>
<p><a href="/">Home</a></p>
</main>
</body>
</html>
`;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function main(): Promise<void> {
  const output = `${import.meta.dir}/.vercel/output`;
  const configPath = `${output}/config.json`;

  // ---- 1. The not-found page ----------------------------------------------------------------------------------
  await Bun.write(`${output}/static/404.html`, NOT_FOUND_PAGE);

  // ---- 2. config.json -----------------------------------------------------------------------------------------
  type Route = Record<string, unknown>;
  const config = (await Bun.file(configPath).json()) as { routes?: Route[]; overrides?: Record<string, unknown> };

  // Each function the routes name must exist, or a route would point at nothing.
  for (const fn of new Set([...API_ROUTES, ...QUERY_ROUTES].map((route) => route.fn))) {
    if (!(await Bun.file(`${output}/functions${fn}.func/.vc-config.json`).exists())) {
      throw new Error(`post-build: the function ${fn}.func is missing; check vercel.functionRules in vite.config.ts`);
    }
  }

  // A .func folder also answers at its own path, and the filesystem phase finds it before any later route (run
  // 40570467882: /__server rendered TanStack's page). So every function folder that is not an API route's own path
  // gets the not-found page before the filesystem phase. A route's dest still reaches it. Nitro can write a .func
  // folder as a symlink to __server.func (its observability routes), so the scan follows symlinks.
  const functionPaths: string[] = [];
  const funcs = new Glob("**/*.func/.vc-config.json").scan({ cwd: `${output}/functions`, dot: true, followSymlinks: true });
  for await (const file of funcs) {
    functionPaths.push(`/${file.slice(0, -".func/.vc-config.json".length)}`);
  }
  const hidden = functionPaths.filter((path) => !API_ROUTES.some((route) => route.path === path)).sort();

  // SPEC-deploy gives each prerendered page an override for its clean address: "deep-dives/x/index.html" at
  // "deep-dives/x". Control run 40571589174 shows Vercel serves the file there without one too (README, check 2).
  const overrides: Record<string, { path: string }> = {};
  for await (const file of new Glob("**/index.html").scan({ cwd: `${output}/static` })) {
    if (file !== "index.html") overrides[file] = { path: file.slice(0, -"/index.html".length) };
  }

  const routes: Route[] = [
    // SPEC-deploy step 1, the host redirects, is D3's (check 5).
    // Step 2, the headers: Nitro's cache rule for the hashed assets, kept. D3 adds the security headers (check 4).
    { src: "^/assets/(.*)$", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
    // Spike only: the routes to the other functions, chosen by a query. They come before the filesystem, because
    // the filesystem phase can match /api/spike to its own function first.
    ...QUERY_ROUTES.map((route) => ({
      src: `^${escape(SPIKE_PATH)}$`,
      has: [{ type: "query", key: "function", value: route.query }],
      dest: route.fn,
      caseSensitive: true,
    })),
    // New, before step 3: the function folders that no API route names, by their own paths, get the not-found page.
    ...hidden.map((path) => ({ src: `^${escape(path)}(?:/.*)?$`, dest: "/404.html", status: 404 })),
    // Step 3: the files, with the overrides above.
    { handle: "filesystem" },
    // Step 4: the API routes, case-sensitive.
    ...API_ROUTES.map((route) => ({ src: `^${escape(route.path)}$`, dest: route.fn, caseSensitive: true })),
    // Step 5: every other path gets the not-found page with status 404.
    { src: "^/(.*)$", dest: "/404.html", status: 404 },
  ];

  const written = { ...config, overrides, routes, crons: [{ ...CRON }] };
  await Bun.write(configPath, JSON.stringify(written, null, 2) + "\n");
  console.log(
    `post-build: 404.html; ${routes.length} routes; function folders sent to 404.html: ${hidden.join(", ")}; overrides for ${Object.values(overrides).map((o) => `/${o.path}`).join(", ")}; ` +
      `cron ${written.crons.map((c) => `${c.path} "${c.schedule}"`).join(", ")}`,
  );
}

if (import.meta.main) await main();
