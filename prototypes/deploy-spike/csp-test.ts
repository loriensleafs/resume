// Probe: do the prerendered TanStack Start pages, the design system and the service worker
// run under a strict, hash-based Content Security Policy with no 'unsafe-inline'?
// The server computes each page's script hashes, as a build step would.
const { chromium } = require("playwright");
const root = `${import.meta.dir}/dist/client`;

async function hashes(html: string): Promise<string[]> {
  const out: string[] = [];
  for (const m of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(m[1]));
    out.push(`'sha256-${Buffer.from(digest).toString("base64")}'`);
  }
  return out;
}

function policy(scriptHashes: string[]): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(" ")}`.trim(),
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
}

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    let file = Bun.file(root + path);
    if (path.endsWith("/") || !(await file.exists())) file = Bun.file(root + path.replace(/\/$/, "") + "/index.html");
    if (!(await file.exists())) return new Response("not found", { status: 404 });
    const isHtml = file.name!.endsWith(".html");
    const csp = policy(isHtml ? await hashes(await file.text()) : []);
    return new Response(file, Bun.env.NOCSP ? {} : { headers: { "Content-Security-Policy": csp } });
  },
});

const base = `http://localhost:${server.port}`;
const browser = await chromium.launch();
const context = await browser.newContext();
await context.addInitScript(() => {
  (window as any).__violations = [];
  document.addEventListener("securitypolicyviolation", (e) =>
    (window as any).__violations.push(`${e.violatedDirective} ${e.blockedURI || "inline"} ${e.sample ?? ""}`.trim()),
  );
});
const errors: string[] = [];
const report: Record<string, unknown> = {};

async function visit(label: string, path: string) {
  const page = await context.newPage();
  page.on("pageerror", (e: Error) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m: any) => m.type() === "error" && errors.push(`${label} console: ${m.text()}`));
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  report[label] = await page.evaluate(() => ({
    violations: (window as any).__violations,
    hydrated: !!(window as any).$_TSR?.hydrated || !!document.querySelector("[data-hydrated]"),
    routerOnWindow: typeof (window as any).__TSR_ROUTER__ !== "undefined",
    acmeButtonDefined: !!customElements.get("acme-button"),
    swControlled: !!navigator.serviceWorker.controller,
    h1: document.querySelector("h1")?.textContent ?? null,
  }));
  return page;
}

await (await visit("first visit /", "/")).close();
const second = await visit("second visit /", "/");
await visit("deep dive", "/deep-dives/design-system-mcp");
await context.setOffline(true);
await visit("offline /", "/");
console.log(JSON.stringify(report, null, 2));
console.log({ errors });
await browser.close();
server.stop();
