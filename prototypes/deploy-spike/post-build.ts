// PROTOTYPE (deploy spike): the spike's twin of SPEC-deploy's writeVercelConfig() and addPolicyTags(), plus the
// static not-found page. `bun post-build.ts` runs after `vite build` (see package.json) and:
// 1. writes static/404.html, a not-found page with no script (SPEC-site amendment 5);
// 2. gives each HTML file, 404.html included, its policy tag (SPEC-deploy "Headers", build step 3). It runs before
//    gen-sw.ts, as step 3 runs before step 4, so the precache holds each page with its tag;
// 3. replaces the `routes` Nitro wrote in .vercel/output/config.json with SPEC-deploy's list ("Routes"), keeps
//    Nitro's other fields, and adds `overrides` for the prerendered pages and the cron. One route is new to the
//    spec's list: function folders that no API route names get the not-found page (check 3, run 40570467882).
// Checks 2 and 3 test what Vercel does with this file; checks 4, 5 and 11 (D3) test the redirect, the headers and
// the policy tags. The spike has one host redirect, for its own .vercel.app address: the other hosts have no
// domains on this project, so no request can reach them.
// check.ts imports the values below, so the build and the checks cannot drift apart. Importing this file writes
// nothing: the build runs only when the file is the entry point (import.meta.main).
// https://vercel.com/docs/build-output-api/configuration, https://bun.com/docs/guides/util/entrypoint
import { Glob } from "bun";

/** The project's production .vercel.app address. SPEC-deploy's setup step 11 writes the real one into routes.ts. */
export const PRODUCTION_HOST = "project-8ar0o.vercel.app";

/** Where the host redirect sends a request: the same path on peterkloss.dev (SPEC-deploy "Routes", step 1). */
export const REDIRECT_ORIGIN = "https://peterkloss.dev";

/**
 * SPEC-deploy "Headers": the headers on every response. Every route writes each name in lower case, so two routes
 * never set one header under two spellings.
 */
export const SECURITY_HEADERS = {
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  "cross-origin-opener-policy": "same-origin",
  "x-frame-options": "DENY",
} as const;

/** The header policy: every path except the documents and the worker files. */
export const HEADER_POLICY = [
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** The worker policy: /sw.js and /workbox-<hash>.js get the header policy plus a script rule. */
export const WORKER_POLICY = `${HEADER_POLICY}; script-src 'self'`;

/** The hashed files' cache rule: /assets/ (Nitro's rule) and /workbox-<hash>.js. */
export const IMMUTABLE = "public, max-age=31536000, immutable";

/** The documents get no policy: object-src 'none' can blank a PDF in a browser's viewer. The spike serves the PDF. */
export const DOCUMENTS = ["Peter-Kloss-Resume.pdf", "Peter-Kloss-Resume.docx", "Peter-Kloss-Resume.txt"] as const;

/** The policy tag's content: `<hashes>` are the SHA-256 hashes of the page's own inline scripts. */
export const tagPolicy = (hashes: string[]) => `default-src 'self'; script-src ${["'self'", ...hashes].join(" ")}`;

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

// An inline script: a <script> element with no src attribute. Group 1 is its text, which the hash covers.
const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;

/**
 * The twin of SPEC-deploy's addPolicyTags(staticDir): each HTML file starts its <head> with a policy tag that lists
 * the SHA-256 hashes of its own inline scripts; a page with none gets script-src 'self' alone. Returns one line per file.
 */
async function addPolicyTags(staticDir: string): Promise<string[]> {
  const tagged: string[] = [];
  for await (const file of new Glob("**/*.html").scan({ cwd: staticDir })) {
    const path = `${staticDir}/${file}`;
    const html = await Bun.file(path).text();
    const head = /<head(?:\s[^>]*)?>/i.exec(html);
    if (!head) throw new Error(`post-build: ${file} has no <head> for its policy tag`);
    const hashes = [
      ...new Set([...html.matchAll(INLINE_SCRIPT)].map(([, text]) => `'sha256-${new Bun.CryptoHasher("sha256").update(text!).digest("base64")}'`)),
    ];
    const at = head.index + head[0].length;
    await Bun.write(path, `${html.slice(0, at)}<meta http-equiv="Content-Security-Policy" content="${tagPolicy(hashes)}">${html.slice(at)}`);
    tagged.push(`${file} (${hashes.length} hashes)`);
  }
  return tagged.sort();
}

async function main(): Promise<void> {
  const output = `${import.meta.dir}/.vercel/output`;
  const configPath = `${output}/config.json`;

  // ---- 1. The not-found page ----------------------------------------------------------------------------------
  await Bun.write(`${output}/static/404.html`, NOT_FOUND_PAGE);

  // ---- 2. The policy tags -------------------------------------------------------------------------------------
  const tagged = await addPolicyTags(`${output}/static`);

  // ---- 3. config.json -----------------------------------------------------------------------------------------
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
    // Step 1, the host redirect (check 5): the project's .vercel.app address answers 308 with the same path on
    // peterkloss.dev, except /api/, so Vercel Cron and the checks still reach the functions there. $1 is the path
    // without its leading slash. Whether Vercel adds the query string to Location is what check 5 asks.
    {
      src: "^/(?!api/)(.*)$",
      has: [{ type: "host", value: { eq: PRODUCTION_HOST } }],
      status: 308,
      headers: { Location: `${REDIRECT_ORIGIN}/$1` },
    },
    // Step 2, the headers (check 4), each route with continue: true. A route's headers is a map, so the routes
    // below set the content-security-policy header twice on a worker file; the spec expects the last one to win.
    // The hashed files: Nitro's rule for /assets/, plus Workbox's runtime.
    { src: "^/(?:assets/.*|workbox-[0-9a-f]+\\.js)$", headers: { "cache-control": IMMUTABLE }, continue: true },
    // Every response.
    { src: "^/(.*)$", headers: { ...SECURITY_HEADERS }, continue: true },
    // The header policy: every path except the documents.
    {
      src: `^/(?!(?:${DOCUMENTS.map(escape).join("|")})$).*$`,
      headers: { "content-security-policy": HEADER_POLICY },
      continue: true,
    },
    // The worker policy: the worker files, which the route above also matched.
    { src: "^/(?:sw\\.js|workbox-[0-9a-f]+\\.js)$", headers: { "content-security-policy": WORKER_POLICY }, continue: true },
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
    `post-build: 404.html; policy tags in ${tagged.join(", ")}; ${routes.length} routes; function folders sent to 404.html: ${hidden.join(", ")}; overrides for ${Object.values(overrides).map((o) => `/${o.path}`).join(", ")}; ` +
      `cron ${written.crons.map((c) => `${c.path} "${c.schedule}"`).join(", ")}`,
  );
}

if (import.meta.main) await main();
