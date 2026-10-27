// PROTOTYPE (deploy spike): the spike's twin of SPEC-deploy's writeVercelConfig(), plus the static not-found page.
// It runs after `vite build` (see package.json) and:
// 1. writes static/404.html, a not-found page with no script (SPEC-site amendment 5);
// 2. replaces the `routes` Nitro wrote in .vercel/output/config.json with SPEC-deploy's list ("Routes"), keeps
//    Nitro's other fields, and adds `overrides` for the prerendered pages and the cron. One route is new to the
//    spec's list: function folders that no API route names get the not-found page (check 3, run 40570467882).
// Checks 2 and 3 test what Vercel does with this file. D3 adds the redirects and the header routes.
// https://vercel.com/docs/build-output-api/configuration
import { Glob } from "bun";

const output = `${import.meta.dir}/.vercel/output`;
const configPath = `${output}/config.json`;

// ---- 1. The not-found page ------------------------------------------------------------------------------------
await Bun.write(
  `${output}/static/404.html`,
  `<!doctype html>
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
`,
);

// ---- 2. config.json -------------------------------------------------------------------------------------------
type Route = Record<string, unknown>;
const config = (await Bun.file(configPath).json()) as { routes?: Route[]; overrides?: Record<string, unknown> };

// Each function the routes name must exist, or a route would point at nothing.
for (const fn of ["__server", "api/spike", "api/spike-bun1x"]) {
  if (!(await Bun.file(`${output}/functions/${fn}.func/.vc-config.json`).exists())) {
    throw new Error(`post-build: the function ${fn}.func is missing; check vercel.functionRules in vite.config.ts`);
  }
}

// The API routes: each path and the function it runs in. /api/spike is the chat's twin (its own function);
// /api/cron/health goes to __server, as SPEC-deploy's /api/status and /api/cron/health do. D4 adds its handler.
const apiRoutes = [
  { path: "/api/spike", fn: "/api/spike" },
  { path: "/api/cron/health", fn: "/__server" },
];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A .func folder also answers at its own path, and the filesystem phase finds it before any later route (run
// 40570467882: /__server rendered TanStack's page). So every function folder that is not an API route's own path
// gets the not-found page before the filesystem phase. A route's dest still reaches it.
const functionPaths: string[] = [];
for await (const file of new Glob("**/*.func/.vc-config.json").scan({ cwd: `${output}/functions`, dot: true })) {
  functionPaths.push(`/${file.slice(0, -".func/.vc-config.json".length)}`);
}
const hidden = functionPaths.filter((path) => !apiRoutes.some((route) => route.path === path)).sort();

// An override serves each prerendered page at its clean address: "deep-dives/x/index.html" at "deep-dives/x".
// The root index.html needs none.
const overrides: Record<string, { path: string }> = {};
for await (const file of new Glob("**/index.html").scan({ cwd: `${output}/static` })) {
  if (file !== "index.html") overrides[file] = { path: file.slice(0, -"/index.html".length) };
}

const routes: Route[] = [
  // SPEC-deploy step 1, the host redirects, is D3's (check 5).
  // Step 2, the headers: Nitro's cache rule for the hashed assets, kept. D3 adds the security headers (check 4).
  { src: "^/assets/(.*)$", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
  // Spike only: two routes to the other functions, chosen by a query. They come before the filesystem, because
  // the filesystem phase can match /api/spike to its own function first.
  { src: "^/api/spike$", has: [{ type: "query", key: "function", value: "server" }], dest: "/__server", caseSensitive: true },
  { src: "^/api/spike$", has: [{ type: "query", key: "function", value: "bun1x" }], dest: "/api/spike-bun1x", caseSensitive: true },
  // New, before step 3: the function folders that no API route names, by their own paths, get the not-found page.
  ...hidden.map((path) => ({ src: `^${escape(path)}(?:/.*)?$`, dest: "/404.html", status: 404 })),
  // Step 3: the files, with the overrides above.
  { handle: "filesystem" },
  // Step 4: the API routes, case-sensitive.
  ...apiRoutes.map((route) => ({ src: `^${escape(route.path)}$`, dest: route.fn, caseSensitive: true })),
  // Step 5: every other path gets the not-found page with status 404.
  { src: "^/(.*)$", dest: "/404.html", status: 404 },
];

const written = {
  ...config,
  overrides,
  routes,
  crons: [{ path: "/api/cron/health", schedule: "17 15 * * *" }],
};
await Bun.write(configPath, JSON.stringify(written, null, 2) + "\n");
console.log(
  `post-build: 404.html; ${routes.length} routes; function folders sent to 404.html: ${hidden.join(", ")}; overrides for ${Object.values(overrides).map((o) => `/${o.path}`).join(", ")}; ` +
    `cron ${written.crons.map((c) => `${c.path} "${c.schedule}"`).join(", ")}`,
);
