// PROTOTYPE: does client-side navigation need a server at run time?
const { chromium } = require("playwright");
const root = `${import.meta.dir}/dist/client`;
const hits: string[] = [];
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    hits.push(`${req.method} ${path}`);
    let file = Bun.file(root + path);
    if (path.endsWith("/") || !(await file.exists())) file = Bun.file(root + path.replace(/\/$/, "") + "/index.html");
    if (await file.exists()) return new Response(file);
    return new Response(Bun.file(`${root}/404.html`), { status: 404, headers: { "Content-Type": "text/html" } });
  },
});
const base = `http://localhost:${server.port}`;
const browser = await chromium.launch();
const page = await (await browser.newContext({ serviceWorkers: "block" })).newPage();
const failed: string[] = [];
page.on("response", (r: any) => { if (r.status() >= 400) failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
await page.goto(`${base}/deep-dives/design-system-mcp`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
hits.length = 0;
await page.click("nav a");
await page.waitForTimeout(2000);
console.log({ path: await page.evaluate(() => location.pathname), h1: await page.evaluate(() => document.querySelector("h1")?.textContent), requestsAfterClick: hits, failed });
await browser.close(); server.stop();
