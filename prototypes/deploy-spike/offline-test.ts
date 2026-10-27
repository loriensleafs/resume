const { chromium } = require("playwright");
const root = `${import.meta.dir}/dist/client`;
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    let file = Bun.file(root + path);
    if (path.endsWith("/") || !(await file.exists())) file = Bun.file(root + path.replace(/\/$/, "") + "/index.html");
    return (await file.exists()) ? new Response(file) : new Response("not found", { status: 404 });
  },
});
const base = `http://localhost:${server.port}`;
const browser = await chromium.launch();
const context = await browser.newContext();
const first = await context.newPage();
const errors: string[] = [];
first.on("pageerror", (e: Error) => errors.push(e.message));
await first.goto(base + "/", { waitUntil: "networkidle" });
await first.waitForTimeout(2500); // install and activate the worker
await first.close();
const page = await context.newPage();
page.on("pageerror", (e: Error) => errors.push(e.message));
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const state = await page.evaluate(() => ({ controlled: !!navigator.serviceWorker.controller, acmeButton: !!customElements.get("acme-button") }));
await context.setOffline(true);
const results: Record<string, string> = {};
for (const path of ["/", "/deep-dives/design-system-mcp", "/deep-dives/agent-workflows"]) {
  try {
    const res = await page.goto(base + path, { waitUntil: "load" });
    const html = (await page.content()).replace(/\s+/g, " ");
    results[path] = `${res?.status()} ${html.match(/<h1>[^<]*<\/h1>/)?.[0] ?? html.slice(0, 120)}`;
  } catch (e) { results[path] = "FAILED " + (e as Error).message.split("\n")[0]; }
}
results["/resume.pdf"] = await page.evaluate(async () => { try { const r = await fetch("/resume.pdf"); return `${r.status} ${(await r.text()).slice(0, 8)}`; } catch (e) { return "FAILED " + e; } });
console.log(state, { errors });
console.log(results);
await browser.close();
server.stop();
