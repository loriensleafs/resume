// PROTOTYPE: does SPEC-deploy's split policy hold? A header policy with no default-src or
// script-src on every response, a policy tag in each page, a static not-found page with no
// scripts, and a service worker that serves that page offline for unknown paths.
const { chromium } = require("playwright");
const root = `${import.meta.dir}/dist/client`;

const HEADER_POLICY = [
  "style-src 'self'", "img-src 'self' data:", "font-src 'self'", "connect-src 'self'",
  "manifest-src 'self'", "worker-src 'self'", "frame-src 'none'", "object-src 'none'",
  "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
].join("; ");
const WORKER_POLICY = `${HEADER_POLICY}; script-src 'self'`; // one policy for the worker files

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    const worker = path === "/sw.js" || /^\/workbox-[\w-]+\.js$/.test(path);
    const headers = { "Content-Security-Policy": worker ? WORKER_POLICY : HEADER_POLICY };
    let file = Bun.file(root + path);
    if (path.endsWith("/") || !(await file.exists())) file = Bun.file(root + path.replace(/\/$/, "") + "/index.html");
    if (await file.exists()) return new Response(file, { headers });
    return new Response(Bun.file(`${root}/404.html`), { status: 404, headers: { ...headers, "Content-Type": "text/html" } });
  },
});

const base = `http://localhost:${server.port}`;
const browser = await chromium.launch();
const context = await browser.newContext();
await context.addInitScript(() => {
  (window as any).__violations = [];
  document.addEventListener("securitypolicyviolation", (e) =>
    (window as any).__violations.push(`${e.violatedDirective} ${e.blockedURI || "inline"}`),
  );
});
const errors: string[] = [];
const workerConsole: string[] = [];
context.on("serviceworker", (w: any) => w.on("console", (m: any) => workerConsole.push(`${m.type()}: ${m.text()}`)));
const report: Record<string, unknown> = {};

async function visit(label: string, path: string, page?: any) {
  page ??= await context.newPage();
  page.on("pageerror", (e: Error) => errors.push(`${label}: ${e.message}`));
  const res = await page.goto(base + path, { waitUntil: "networkidle" }).catch((e: Error) => ({ status: () => `FAILED ${e.message.split("\n")[0]}` }));
  await page.waitForTimeout(1500);
  report[label] = {
    status: res?.status?.(),
    ...(await page.evaluate(() => ({
      violations: (window as any).__violations,
      routerRunning: typeof (window as any).__TSR_ROUTER__ !== "undefined",
      swControlled: !!navigator.serviceWorker?.controller,
      h1: document.querySelector("h1")?.textContent ?? null,
    })).catch((e: Error) => ({ evaluateFailed: e.message.split("\n")[0] }))),
  };
  return page;
}

await (await visit("first visit /", "/")).close();
const p = await visit("second visit /", "/");
await visit("deep dive", "/deep-dives/design-system-mcp", p);
// client-side navigation back to / through the app's own link
await p.click("nav a").catch(() => {});
await p.waitForTimeout(1000);
report["client navigation to /"] = await p.evaluate(() => ({ path: location.pathname, violations: (window as any).__violations }));
await visit("unknown path online", "/sources/does-not-exist");
await context.setOffline(true);
await visit("offline /", "/");
await visit("unknown path offline", "/sources/also-missing");
console.log(JSON.stringify(report, null, 2));
console.log({ errors: errors.filter((e) => !e.includes("Invalid action variant")), workerConsole });
await browser.close();
server.stop();
