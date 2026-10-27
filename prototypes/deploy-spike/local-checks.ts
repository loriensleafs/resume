// PROTOTYPE (deploy spike): runs checks 4, 5 and 11 of check.ts against two local servers that answer as the
// routes post-build.ts writes should answer on Vercel. It tests the check code and Chrome's part, not Vercel.
//   bun run build && bun local-checks.ts               all three pass
//   bun local-checks.ts merge-first                    the worker files get the header policy: check 4 fails
//   bun local-checks.ts style-none                     the header policy blocks the stylesheet: check 11 fails
// No bypass and no secret: the local servers need none.
import { CHECKS, chromeVisits, type Ctx } from "./check.ts";
import { DOCUMENTS, HEADER_POLICY, IMMUTABLE, SECURITY_HEADERS, WORKER_POLICY } from "./post-build.ts";

const root = `${import.meta.dir}/.vercel/output/static`;
const info = await Bun.file(`${root}/build-info.json`).json();
const control = process.argv[2];
if (control !== undefined && control !== "merge-first" && control !== "style-none") {
  console.log("usage: bun local-checks.ts [merge-first | style-none]");
  process.exit(2);
}

// The deployment: the static output with the headers of the D3 routes, /api/spike as a function, and the
// not-found page for unknown paths and for /__server.
const deployment = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    const name = path.slice(1);
    const headers = new Headers(SECURITY_HEADERS);
    const headerPolicy = control === "style-none" ? HEADER_POLICY.replace("style-src 'self'", "style-src 'none'") : HEADER_POLICY;
    if (/^(sw\.js|workbox-[0-9a-f]+\.js)$/.test(name) && control !== "merge-first") headers.set("content-security-policy", WORKER_POLICY);
    else if (!(DOCUMENTS as readonly string[]).includes(name)) headers.set("content-security-policy", headerPolicy);
    headers.set("cache-control", /^(assets\/.*|workbox-[0-9a-f]+\.js)$/.test(name) ? IMMUTABLE : "public, max-age=0, must-revalidate");
    if (path === "/api/spike") {
      headers.set("cache-control", "no-store");
      return Response.json({ function: "/api/spike" }, { headers });
    }
    let file = Bun.file(root + (path.endsWith("/") ? `${path}index.html` : path));
    if (path !== "/__server" && !(await file.exists())) file = Bun.file(`${root}${path}/index.html`);
    if (path === "/__server" || !(await file.exists())) return new Response(Bun.file(`${root}/404.html`), { status: 404, headers });
    return new Response(file, { headers });
  },
});

// The production address: 308 to the same path and query on peterkloss.dev, except /api/.
const production = Bun.serve({
  port: 0,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) return new Response(Bun.file(`${root}/api/build-info.json`));
    return new Response(null, { status: 308, headers: { Location: `https://peterkloss.dev${url.pathname}${url.search}` } });
  },
});

const origin = (port: number | undefined) => `http://localhost:${port}`;
const ctx: Ctx = {
  deployment: `localhost:${deployment.port}`,
  production: `localhost:${production.port}`,
  info: { ...info, productionHost: null },
  deadline: Date.now() + 120_000,
  deploymentFetch: (path, init) => fetch(`${origin(deployment.port)}${path}`, { ...init, redirect: "manual" }),
  productionFetch: (path, init) => fetch(`${origin(production.port)}${path}`, { ...init, redirect: "manual" }),
  report: async () => ({}),
  poll: async () => undefined,
  chrome: (paths) => chromeVisits(origin(deployment.port), paths, () => ({})),
};
try {
  for (const check of CHECKS.filter((c) => [4, 5, 11].includes(c.check))) {
    const result = await check.run(ctx).catch((error: Error) => ({ pass: false, detail: `error: ${error.message}` }));
    console.log(`check ${check.check} (${check.name}): ${result.pass ? "pass" : "FAIL"}: ${result.detail}`);
  }
} finally {
  deployment.stop(true);
  production.stop(true);
}
