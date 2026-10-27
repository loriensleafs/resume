// Prints HTML files to PDF with headless Chrome.
//
// Talks to Chrome directly over the DevTools protocol (a WebSocket), so printing
// needs Bun and a Chrome or Chromium install, and nothing else.
// Set CHROME_PATH to pick a specific browser.

import { $ } from "bun";

export type PrintJob = { html: string; pdf: string };

async function findChrome(): Promise<string> {
  const home = Bun.env.HOME ?? "";
  const candidates = [
    Bun.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ...["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"].map((n) => Bun.which(n)),
  ];
  for (const c of candidates) if (c && (await Bun.file(c).exists())) return c;

  // Chromium that Playwright downloaded earlier, if any.
  const caches = [Bun.env.PLAYWRIGHT_BROWSERS_PATH, `${home}/.cache/ms-playwright`, `${home}/Library/Caches/ms-playwright`];
  const builds = ["chromium-*/chrome-linux/chrome", "chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium"];
  for (const cwd of caches) {
    if (!cwd) continue;
    for (const pattern of builds) {
      try {
        for await (const hit of new Bun.Glob(pattern).scan({ cwd, absolute: true, onlyFiles: true })) return hit;
      } catch {
        // That cache folder does not exist on this machine.
      }
    }
  }
  throw new Error("Chrome not found. Install Google Chrome, or set CHROME_PATH.");
}

// A small DevTools protocol client: one WebSocket, commands matched to replies by id.
class DevTools {
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private listeners = new Map<string, (params: any) => void>();

  private constructor(private ws: WebSocket) {
    ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id !== undefined) {
        const waiter = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) waiter?.reject(new Error(`${msg.error.message} (${msg.error.code})`));
        else waiter?.resolve(msg.result);
      } else {
        this.listeners.get(`${msg.sessionId ?? ""}:${msg.method}`)?.(msg.params);
      }
    };
  }

  static connect(url: string): Promise<DevTools> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.onopen = () => resolve(new DevTools(ws));
      ws.onerror = () => reject(new Error(`could not connect to ${url}`));
    });
  }

  send(method: string, params: object = {}, sessionId?: string): Promise<any> {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  once(method: string, sessionId?: string): Promise<any> {
    return new Promise((resolve) => this.listeners.set(`${sessionId ?? ""}:${method}`, resolve));
  }

  close() {
    this.ws.close();
  }
}

// Read the "DevTools listening on ws://..." line that Chrome prints at start-up.
async function devToolsUrl(stderr: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let text = "";
  for await (const chunk of stderr) {
    text += decoder.decode(chunk, { stream: true });
    const match = text.match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) return match[1];
  }
  throw new Error(`Chrome exited before it opened DevTools:\n${text}`);
}

async function printOne(cdp: DevTools, job: PrintJob) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);

  const loaded = cdp.once("Page.loadEventFired", sessionId);
  const nav = await cdp.send("Page.navigate", { url: Bun.pathToFileURL(job.html).href }, sessionId);
  if (nav.errorText) throw new Error(`could not open ${job.html}: ${nav.errorText}`);
  await loaded;

  // Wait for the web fonts; print before they load and the PDF falls back to a system font.
  const fonts = await cdp.send(
    "Runtime.evaluate",
    {
      expression: "document.fonts.ready.then(() => [...document.fonts].map((f) => `${f.weight}:${f.status}`))",
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  );
  const failed = (fonts.result.value as string[]).filter((f) => !f.endsWith(":loaded"));
  if (failed.length) throw new Error(`fonts did not load in ${job.html}: ${failed.join(", ")}`);

  const pdf = await cdp.send(
    "Page.printToPDF",
    {
      preferCSSPageSize: true, // size and margins come from @page in the print CSS
      printBackground: true,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      generateTaggedPDF: true, // headings, paragraphs and lists marked up for screen readers
    },
    sessionId,
  );
  await Bun.write(job.pdf, Uint8Array.fromBase64(pdf.data));
  await cdp.send("Target.closeTarget", { targetId });
}

/** Prints each HTML file to its PDF path, with one Chrome process for all of them. */
export async function printToPdf(jobs: PrintJob[]): Promise<void> {
  const chrome = await findChrome();
  const profile = `${Bun.env.TMPDIR ?? "/tmp"}/resume-chrome-${crypto.randomUUID()}`;
  const args = [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
  ];
  if (process.getuid?.() === 0) args.push("--no-sandbox"); // Chrome refuses to sandbox as root (CI, containers).

  const proc = Bun.spawn([chrome, ...args, "about:blank"], { stdout: "ignore", stderr: "pipe" });
  try {
    const cdp = await DevTools.connect(await devToolsUrl(proc.stderr));
    for (const job of jobs) await printOne(cdp, job);
    await cdp.send("Browser.close").catch(() => {});
    cdp.close();
  } finally {
    proc.kill();
    await proc.exited;
    await $`rm -rf ${profile}`.quiet().nothrow();
  }
}
