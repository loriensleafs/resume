// Seam 2 of SPEC-site: one real-browser test. Playwright drives Google Chrome under Bun against
// `bun run preview --dir <folder>`, where <folder> is the seam-1 folder (build-output.ts). So the test builds first, and
// a test run builds the site once.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import axe from "axe-core";
import type { Subprocess } from "bun";
import { type Browser, type BrowserContext, chromium, type Page } from "playwright";
import { buildOutput, seam1 } from "./build-output";
import { FIXTURE_NAME } from "./fixture-root";

const REPO = resolve(import.meta.dir, "../../..");

/** The preview, serving the seam-1 folder, and its address. Its errors go to the test's own output. */
let preview: Subprocess<"ignore", "pipe", "inherit">;
let origin: string;
let browser: Browser;

/**
 * The address that `bun run preview` prints when it listens, read from its output. Port 0 lets the system choose a free
 * port, so the test never meets another preview on 4173. The rest of the output keeps draining, so the preview never
 * waits on a full pipe.
 */
async function previewOrigin(child: typeof preview): Promise<string> {
  const decoder = new TextDecoder();
  let output = "";
  const reader = child.stdout.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
    const address = output.match(/Preview: (http:\/\/\S+?)\/? /)?.[1];
    if (address) {
      void (async () => {
        // Drain the rest of the output: read each chunk and drop it, until the stream ends.
        let chunk = await reader.read();
        while (!chunk.done) chunk = await reader.read();
      })();
      return address;
    }
  }
  throw new Error(`bun run preview stopped before it listened (its errors are above):\n${output}`);
}

/**
 * Google Chrome at CHROME_PATH, or at Chrome's default place on this system (Playwright's "chrome" channel). The test
 * never downloads a browser (AGENTS.md, Verify).
 */
function chrome() {
  const path = Bun.env.CHROME_PATH;
  return path ? { executablePath: path } : { channel: "chrome" };
}

/**
 * The preview's variables, as a preview deployment can hold them: the test's own, with VERCEL_ENV "preview" and a
 * stand-in key that the Anthropic API refuses. Outside production the chat answers with the fake model whatever
 * variables are set, an ANTHROPIC_API_KEY included (SPEC-chat, Tech Stack), so every chat test here runs with a key
 * set. The test's own Anthropic credentials stay out, so no browser test can reach the model with them.
 */
function previewEnv(): Record<string, string | undefined> {
  const { ANTHROPIC_API_KEY: _key, ANTHROPIC_AUTH_TOKEN: _token, ANTHROPIC_OAUTH_TOKEN: _oauth, ...inherited } = process.env;
  return { ...inherited, VERCEL_ENV: "preview", ANTHROPIC_API_KEY: "stand-in-key-for-the-browser-test" };
}

beforeAll(async () => {
  await buildOutput();
  preview = Bun.spawn([process.execPath, "run", "preview", "--dir", seam1.outDir, "--port", "0"], {
    cwd: REPO,
    env: previewEnv(),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
  });
  origin = await previewOrigin(preview);
  browser = await chromium.launch(chrome());
}, 120_000);

// On a busy machine, closing Chrome and stopping the preview can take longer than Bun's 5-second limit for a hook
// (Chrome alone took up to 6.5 s while other worktrees' builds ran, task S10, 2026-10-27).
afterAll(async () => {
  await browser?.close();
  preview?.kill();
  await preview?.exited;
}, 30_000);

/** The two screen sizes of SPEC-site's browser checks. */
const WIDE = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/**
 * A browser window with the policy check (SPEC-site, Testing 2: Policy; SPEC-deploy, Testing 1). On every page it
 * shows, the window records each Content Security Policy violation, each page error, each error in the console and each
 * request to `/_serverFn/`: no page and no server function runs at request time (decision 0023), so a page that asks a
 * server function for its data is broken. React reports a hydration mismatch in the console, not as a page error.
 */
type TestWindow = { context: BrowserContext; problems: string[] };

/** The page's own path, which names it in a problem. */
const pathOf = (address: string) => new URL(address).pathname;

/** What Chrome writes to the console for a response with status 404 (seen with Chrome on 2026-10-27). */
const NOT_FOUND_LOG = "Failed to load resource: the server responded with a status of 404 (Not Found)";

/** Opens a window with the policy check, in the system's light appearance, at a screen size. */
async function openWindow(viewport = WIDE): Promise<TestWindow> {
  const context = await browser.newContext({ viewport, colorScheme: "light" });
  const problems: string[] = [];
  // The browser fires securitypolicyviolation for each violation of the header policy or the page's policy tag
  // (https://www.w3.org/TR/CSP3/#report-violation), an inline event handler included: Chrome reported an `onclick`
  // attribute at load, before any click (task S9). A hash cannot allow such a handler, so this check is the one that
  // finds it.
  await context.exposeBinding("reportPolicyViolation", ({ page }, violation: string) => {
    problems.push(`${pathOf(page.url())}: policy violation: ${violation}`);
  });
  await context.addInitScript(() => {
    const report = (window as unknown as { reportPolicyViolation(violation: string): void }).reportPolicyViolation;
    document.addEventListener("securitypolicyviolation", (event) => {
      report(`${event.effectiveDirective} blocked ${event.blockedURI}`);
    });
  });
  context.on("page", (page) => {
    page.on("pageerror", (error) => problems.push(`${pathOf(page.url())}: page error: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(`${pathOf(page.url())}: console error: ${message.text()}`);
    });
  });
  context.on("request", (request) => {
    const path = pathOf(request.url());
    if (!path.startsWith("/_serverFn/")) return;
    // A service worker's request has no frame, and request.frame() throws for it (Playwright's Request API).
    const from = request.serviceWorker() ? "the service worker" : pathOf(request.frame().url());
    problems.push(`${from}: request to ${path}`);
  });
  return { context, problems };
}

/**
 * Opens a page at a path. It waits until the network has been quiet for 500 ms, so a request or a violation that comes
 * after the load event still reaches the policy check.
 */
async function visit(browserWindow: TestWindow, path: string) {
  const page = await browserWindow.context.newPage();
  const response = await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
  return { page, response };
}

/** Runs a test's steps in a new window, then applies the policy check to every page they visited. */
async function inWindow(viewport: typeof WIDE, steps: (browserWindow: TestWindow) => Promise<void>): Promise<void> {
  const browserWindow = await openWindow(viewport);
  try {
    await steps(browserWindow);
    expect(browserWindow.problems).toEqual([]);
  } finally {
    await browserWindow.context.close();
  }
}

// The policy check's control, as the deploy spike planted its own (research 12, check 11): a check that has never seen
// a problem proves nothing. Each kind of problem is planted on a clean page, and the check must name each one.
test("the policy check names each planted problem: a violation, an event handler, an error and a server request", async () => {
  const browserWindow = await openWindow();
  try {
    const { page } = await visit(browserWindow, "/resume");
    expect(browserWindow.problems).toEqual([]);
    await page.evaluate(async () => {
      const script = document.createElement("script");
      script.textContent = "void 0"; // an inline script that no hash allows
      document.body.append(script);
      document.body.setAttribute("onclick", "void 0");
      setTimeout(() => {
        throw new Error("planted");
      });
      console.error("planted");
      await fetch("/_serverFn/planted");
    });
    // The reports reach the test through the browser's protocol, so they can arrive after the page's last step. Chrome
    // also writes each blocked inline script and the 404 of the planted request to the console.
    for (let wait = 0; browserWindow.problems.length < 8 && wait < 50; wait++) await Bun.sleep(100);
    expect(browserWindow.problems.toSorted()).toEqual([
      expect.stringContaining("/resume: console error: Executing inline event handler violates"),
      expect.stringContaining("/resume: console error: Executing inline script violates"),
      `/resume: console error: ${NOT_FOUND_LOG}`,
      "/resume: console error: planted",
      "/resume: page error: planted",
      "/resume: policy violation: script-src-attr blocked inline",
      "/resume: policy violation: script-src-elem blocked inline",
      "/resume: request to /_serverFn/planted",
    ]);
  } finally {
    await browserWindow.context.close();
  }
});

// SPEC-site, Commands: the preview serves the build output with the routes, overrides and status codes of its
// config.json, as Vercel does. writeVercelConfig() writes those routes (SPEC-deploy, "Routes").
describe("the preview", () => {
  test.each([
    ["/", 200, FIXTURE_NAME],
    ["/resume", 200, `${FIXTURE_NAME} — Resume`],
    // Every other path gets the not-found page with 404 (SPEC-site, Workspace addresses).
    ["/nope", 404, "Page not found"],
    ["/sources/nope", 404, "Page not found"],
    // The override serves resume/index.html at /resume only: Vercel's overrides example answers 404 at the file's own
    // path (https://github.com/vercel/examples/tree/main/build-output-api/overrides).
    ["/resume/index.html", 404, "Page not found"],
    // A function folder that no API route names answers with the not-found page, before the filesystem phase.
    ["/__server", 404, "Page not found"],
    // The API routes match case-sensitively, and the filesystem too.
    ["/API/chat", 404, "Page not found"],
  ])("%s answers %d with the page titled %p", async (path, status, title) => {
    await inWindow(WIDE, async (browserWindow) => {
      const { page, response } = await visit(browserWindow, path);
      expect({ status: response?.status(), title: await page.title() }).toEqual({ status, title });
      // Chrome writes each 404 response to the console, the page's own too, and this page answers 404 on purpose. The
      // one message it writes for it is allowed here, by its exact text, and nowhere else.
      if (status === 404) {
        const log = `${path}: console error: ${NOT_FOUND_LOG}`;
        expect(browserWindow.problems).toContain(log);
        browserWindow.problems.splice(browserWindow.problems.indexOf(log), 1);
      }
    });
  });
});

/**
 * The parts whose definition a page loads on the first interaction, not at load: the career timeline's acme-tooltip,
 * which keeps the JavaScript that / loads before any interaction under 200 KB (src/site/shell/CareerTimeline.tsx).
 */
const DEFINED_ON_FIRST_INTERACTION = ["acme-tooltip"];

/**
 * Each design-system part on the page, in page order: whether it is defined, upgraded and given its shadow root. It
 * waits up to 2 s for the definition of each part that is not in `skipped`.
 */
function partsOf(page: Page, skipped: string[] = []) {
  return page.evaluate(async (notAwaited) => {
    const elements = [...document.querySelectorAll("*")].filter((element) => element.localName.startsWith("acme-"));
    const tags = [...new Set(elements.map((element) => element.localName))].filter((tag) => !notAwaited.includes(tag));
    // A tag that no module defines would wait for ever; the page's own scripts ran before the network went quiet.
    const defined = Promise.all(tags.map((tag) => customElements.whenDefined(tag)));
    await Promise.race([defined, new Promise((done) => setTimeout(done, 2_000))]);
    return elements.map((element) => {
      const definition = customElements.get(element.localName);
      return {
        tag: element.localName,
        defined: definition !== undefined,
        // An element that is not upgraded is a plain HTMLElement, not an instance of its definition.
        upgraded: definition !== undefined && element instanceof definition && element.matches(":defined"),
        shadowRoot: element.shadowRoot !== null,
      };
    });
  }, skipped);
}

// SPEC-site, Tech Stack and Testing 2: Design-system parts. The prerender writes each part as its tag with its light-DOM
// text (seam 1); in the browser, each part must then be defined, upgraded and given its shadow root: at load, or, for
// a part in DEFINED_ON_FIRST_INTERACTION, after the first interaction. The wrappers use the global custom-element
// registry (the design system's react-integration skill, 0.3.3), and the design system documents no ready signal of
// its own (its docs server, 0.3.3), so the check reads the registry and the element.
describe.each(["/", "/resume"])("the design-system parts on %s", (path) => {
  test("each part is defined and upgraded, with its shadow root, at load or after the first Tab", async () => {
    await inWindow(WIDE, async (browserWindow) => {
      const { page } = await visit(browserWindow, path);
      const atLoad = await partsOf(page, DEFINED_ON_FIRST_INTERACTION);
      expect(atLoad.length).toBeGreaterThan(0);
      expect(atLoad).toEqual(
        atLoad.map(({ tag }) => {
          const loaded = !DEFINED_ON_FIRST_INTERACTION.includes(tag);
          return { tag, defined: loaded, upgraded: loaded, shadowRoot: loaded };
        }),
      );
      await page.keyboard.press("Tab");
      const afterTab = await partsOf(page);
      expect(afterTab).toEqual(afterTab.map(({ tag }) => ({ tag, defined: true, upgraded: true, shadowRoot: true })));
    });
  });
});

/** How long a check waits for the page to show a change, in ms: well inside bun test's 5-second limit for a test. */
const CHANGE_WAIT = 2_000;

/** What the install offer's stand-ins count in the page: the saved prompt's calls and the persistent-storage requests. */
type InstallCounts = { installPromptCalls: number; persistCalls: number };

/**
 * Stands in for the browser's offer to install the site (SPEC-site, Views: Install offer). Chrome fires
 * `beforeinstallprompt` only for a site that meets its install criteria, which a test cannot arrange, so the test
 * dispatches an event of its own. Its prompt() counts its calls in `installPromptCalls`, and the browser answers
 * "dismissed". With `promptRejects`, prompt() rejects instead, as the browser's does when it cannot show the dialog. The
 * page then has two animation frames to show the change.
 */
async function offerInstall(page: Page, { promptRejects = false } = {}): Promise<void> {
  await page.evaluate(async (rejects) => {
    const counts = window as unknown as InstallCounts;
    counts.installPromptCalls = 0;
    const choice = { outcome: "dismissed", platform: "" };
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: async () => {
        counts.installPromptCalls += 1;
        if (rejects) throw new DOMException("The browser shows no install dialog.", "NotAllowedError");
        return choice;
      },
      userChoice: Promise.resolve(choice),
    });
    window.dispatchEvent(event);
    await new Promise((shown) => requestAnimationFrame(() => requestAnimationFrame(shown)));
  }, promptRejects);
}

/** A layout-shift entry (https://w3c.github.io/layout-instability/#sec-layout-shift). TypeScript's DOM library lacks it. */
type LayoutShiftEntry = PerformanceEntry & { value: number; hadRecentInput: boolean };

/** What the layout-shift count keeps in the page: the shift counted so far, and the observer that counts it. */
type LayoutShiftCount = { layoutShift: number; layoutShiftObserver: PerformanceObserver };

/**
 * An init script that adds up each page's layout shift from its start: the value of every shift, apart from a shift
 * right after the visitor's input, which layout shift does not score (https://web.dev/articles/cls). The sum of every
 * shift is never less than the score, which takes the largest window of shifts.
 */
async function countLayoutShift(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const counts = window as unknown as LayoutShiftCount;
    counts.layoutShift = 0;
    counts.layoutShiftObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        if (!entry.hadRecentInput) counts.layoutShift += entry.value;
      }
    });
    counts.layoutShiftObserver.observe({ type: "layout-shift", buffered: true });
  });
}

/**
 * The page's layout shift so far, two animation frames from now: what the observer counted, and the shifts still
 * waiting for its callback.
 */
async function layoutShift(page: Page): Promise<number> {
  return page.evaluate(async () => {
    await new Promise((painted) => requestAnimationFrame(() => requestAnimationFrame(painted)));
    const counts = window as unknown as LayoutShiftCount;
    for (const entry of counts.layoutShiftObserver.takeRecords() as LayoutShiftEntry[]) {
      if (!entry.hadRecentInput) counts.layoutShift += entry.value;
    }
    return counts.layoutShift;
  });
}

/** The box of the app bar's main region, the design system's part "content", which holds the headline. */
async function appBarContentBox(page: Page) {
  return page.evaluate(() =>
    document.querySelector("acme-app-bar")?.shadowRoot?.querySelector('[part="content"]')?.getBoundingClientRect().toJSON(),
  );
}

/**
 * An init script that counts the page's calls of navigator.storage.persist() in `persistCalls`. The stand-in answers
 * true and asks the browser nothing.
 */
async function countPersistCalls(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const counts = window as unknown as InstallCounts;
    counts.persistCalls = 0;
    // Each new page starts at about:blank, which is no secure context, so the browser gives it no StorageManager.
    if (typeof StorageManager === "undefined") return;
    StorageManager.prototype.persist = async () => {
      counts.persistCalls += 1;
      return true;
    };
  });
}

/**
 * An init script that makes each page run as the installed app: `(display-mode: standalone)` matches, as in the app's
 * own window. It answers that media query with `standIn`, by default "all", which matches every page, so the page still
 * gets a real MediaQueryList, with its change events. A stand-in such as `(prefers-color-scheme: dark)` lets the test
 * move the page into the app's window later, with page.emulateMedia(). Chrome's protocol cannot do it: its
 * Emulation.setEmulatedMedia accepted the feature display-mode and changed nothing (seen with Chrome on 2026-10-27).
 */
async function runAsApp(context: BrowserContext, standIn = "all"): Promise<void> {
  await context.addInitScript((replacement) => {
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => matchMedia(query.replace(/\(\s*display-mode\s*:\s*standalone\s*\)/g, replacement));
  }, standIn);
}

/** The "Install app" button, as the accessibility tree names it: the native button inside acme-button. */
const installApp = (page: Page) => page.getByRole("button", { name: "Install app" });

// SPEC-site, Views: App bar and Install offer. On wide screens, "Install app" (a secondary button with Chrome's install
// icon) shows in the app bar's end slot only after the browser offers installation, and never while the site runs as
// an app. Selecting it calls the browser's saved prompt. On phones, the install sheet offers the app instead (S36).
describe('"Install app" in the app bar', () => {
  test("shows on a wide screen after beforeinstallprompt, and selecting it calls the saved prompt once", async () => {
    await inWindow(WIDE, async (browserWindow) => {
      const { page } = await visit(browserWindow, "/");
      expect(await installApp(page).count()).toBe(0);
      await offerInstall(page);
      await installApp(page).waitFor({ state: "visible", timeout: CHANGE_WAIT });
      const shown = await page.evaluate(() => {
        const button = document.querySelector('acme-app-bar [slot="end"] acme-button') as
          | (HTMLElement & { variant: string })
          | null;
        return {
          variant: button?.variant,
          icon: button?.querySelector('[slot="start"]')?.localName,
          label: button?.textContent?.trim(),
          upgraded: button?.shadowRoot !== null && button?.matches(":defined"),
        };
      });
      expect(shown).toEqual({
        variant: "secondary",
        icon: "acme-install-desktop-icon",
        label: "Install app",
        upgraded: true,
      });
      await installApp(page).click();
      expect(await page.evaluate(() => (window as unknown as InstallCounts).installPromptCalls)).toBe(1);
      // The browser's prompt serves one call per event, so the button goes once it has been used.
      await installApp(page).waitFor({ state: "detached", timeout: CHANGE_WAIT });
    });
  });

  // SPEC-site, Testing 2: Speed: layout shift stays under 0.1. The button comes after the page's scripts run, so it
  // must not move what the visitor already sees.
  test("keeps the page's layout shift under 0.1 when it shows at 1440 × 900", async () => {
    await inWindow(WIDE, async (browserWindow) => {
      await countLayoutShift(browserWindow.context);
      const { page } = await visit(browserWindow, "/");
      await offerInstall(page);
      await installApp(page).waitFor({ state: "visible", timeout: CHANGE_WAIT });
      expect(await layoutShift(page)).toBeLessThan(0.1);
    });
  });

  // The browser's prompt() rejects when it cannot show the dialog. The site shows nothing for that, and no unhandled
  // rejection reaches the page. The browser fires unhandledrejection in a task after the rejection.
  test("leaves no unhandled rejection when the browser rejects the prompt", async () => {
    await inWindow(WIDE, async (browserWindow) => {
      const { page } = await visit(browserWindow, "/");
      await offerInstall(page, { promptRejects: true });
      await installApp(page).waitFor({ state: "visible", timeout: CHANGE_WAIT });
      await page.evaluate(() => {
        const counts = window as unknown as { unhandledRejections: number };
        counts.unhandledRejections = 0;
        window.addEventListener("unhandledrejection", () => (counts.unhandledRejections += 1));
      });
      await installApp(page).click();
      await installApp(page).waitFor({ state: "detached", timeout: CHANGE_WAIT });
      const result = await page.evaluate(async () => {
        for (let task = 0; task < 3; task++) await new Promise((next) => setTimeout(next));
        const counts = window as unknown as InstallCounts & { unhandledRejections: number };
        return { promptCalls: counts.installPromptCalls, unhandledRejections: counts.unhandledRejections };
      });
      expect(result).toEqual({ promptCalls: 1, unhandledRejections: 0 });
    });
  });

  // On a phone the button is not shown, so the offer leaves the app bar as it was: the end slot adds no empty region,
  // which would take the bar's gap from the headline.
  test("leaves the app bar as it was at 390 × 844 after beforeinstallprompt", async () => {
    await inWindow(PHONE, async (browserWindow) => {
      const { page } = await visit(browserWindow, "/");
      const before = await appBarContentBox(page);
      expect(before?.width).toBeGreaterThan(0);
      await offerInstall(page);
      expect(await appBarContentBox(page)).toEqual(before);
    });
  });

  // The offer is kept on a phone, and the width alone hides the button: at the wide size it shows.
  test("shows nothing at 390 × 844 after beforeinstallprompt, and shows once the window is wide", async () => {
    await inWindow(PHONE, async (browserWindow) => {
      const { page } = await visit(browserWindow, "/");
      await offerInstall(page);
      expect(await installApp(page).isVisible()).toBe(false);
      await page.setViewportSize(WIDE);
      await installApp(page).waitFor({ state: "visible", timeout: CHANGE_WAIT });
    });
  });

  test("shows nothing after beforeinstallprompt while the site runs as an app", async () => {
    await inWindow(WIDE, async (browserWindow) => {
      await runAsApp(browserWindow.context);
      const { page } = await visit(browserWindow, "/");
      await offerInstall(page);
      expect(await installApp(page).count()).toBe(0);
    });
  });
});

// SPEC-site, Saved views: the site asks the browser for persistent storage when it runs as the installed app, so the
// browser keeps the saved session. In a browser tab it asks nothing.
describe("persistent storage", () => {
  test.each([
    ["running as an app, the site asks once", true, 1],
    ["in a browser tab, the site does not ask", false, 0],
  ])("%s", async (_name, asApp, calls) => {
    await inWindow(WIDE, async (browserWindow) => {
      await countPersistCalls(browserWindow.context);
      if (asApp) await runAsApp(browserWindow.context);
      const { page } = await visit(browserWindow, "/");
      expect(await page.evaluate(() => (window as unknown as InstallCounts).persistCalls)).toBe(calls);
    });
  });

  // Chrome can move an open tab into the app's own window when the site is installed (src/site/install-offer.ts). The
  // stand-in query `(prefers-color-scheme: dark)` starts false in the test's light window, and emulateMedia flips it.
  test('a tab that moves into the app\'s window hides "Install app" and asks once', async () => {
    await inWindow(WIDE, async (browserWindow) => {
      await countPersistCalls(browserWindow.context);
      await runAsApp(browserWindow.context, "(prefers-color-scheme: dark)");
      const { page } = await visit(browserWindow, "/");
      await offerInstall(page);
      await installApp(page).waitFor({ state: "visible", timeout: CHANGE_WAIT });
      const persistCalls = () => page.evaluate(() => (window as unknown as InstallCounts).persistCalls);
      expect(await persistCalls()).toBe(0);
      await page.emulateMedia({ colorScheme: "dark" });
      await installApp(page).waitFor({ state: "detached", timeout: CHANGE_WAIT });
      expect(await persistCalls()).toBe(1);
    });
  });
});

/** WCAG 2.2 at levels A and AA, as axe-core tags its rules. axe-core 4.14 has no rule for WCAG 2.2's new A criteria. */
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Runs axe-core on the page and gives each violation, one per element, as "<rule>: <help> at <target>: <html>". */
async function axeViolations(page: Page): Promise<string[]> {
  // The test injects axe-core through the browser's protocol, which no Content Security Policy blocks, as
  // @axe-core/playwright does.
  await page.evaluate(axe.source);
  return page.evaluate(async (tags) => {
    const inPage = (window as unknown as { axe: typeof axe }).axe;
    const results = await inPage.run(document, {
      runOnly: { type: "tag", values: tags },
      resultTypes: ["violations"],
      elementRef: true,
    });
    return results.violations.flatMap((rule) =>
      rule.nodes
        // The app bar's name box keeps the approved board's colors, white on --ds-blue-700, 4.44:1, by Peter's choice
        // (decision record row 171). It is the site's one known contrast exception, so the color-contrast rule skips
        // that element, and only that element; every other rule still checks it (SPEC-site, Testing 2: Accessibility).
        .filter((node) => !(rule.id === "color-contrast" && node.element?.matches(".app-bar-name")))
        .map((node) => `${rule.id}: ${rule.help} at ${node.target.join(" ")}: ${node.html}`),
    );
  }, WCAG_22_AA);
}

// SPEC-site, Testing 2: Accessibility. axe-core reports no WCAG 2.2 AA violation on each page, at the wide screen size
// and the phone's, in the system's light appearance. The dark appearance comes with the theme switch (task S13).
describe.each(["/", "/resume"])("accessibility of %s", (path) => {
  test.each([
    ["1440 × 900", WIDE],
    ["390 × 844", PHONE],
  ])("axe-core reports no WCAG 2.2 AA violation at %s", async (_size, viewport) => {
    await inWindow(viewport, async (browserWindow) => {
      const { page } = await visit(browserWindow, path);
      expect(await axeViolations(page)).toEqual([]);
    });
  });

  test('axe-core reports no WCAG 2.2 AA violation at 1440 × 900 with "Install app" shown', async () => {
    await inWindow(WIDE, async (browserWindow) => {
      const { page } = await visit(browserWindow, path);
      await offerInstall(page);
      await installApp(page).waitFor({ state: "visible", timeout: CHANGE_WAIT });
      expect(await axeViolations(page)).toEqual([]);
    });
  });
});

// SPEC-site, Testing 2: Speed. From the network log, the JavaScript that / loads before any interaction,
// gzip-compressed, is under 200 KB (decision record row 24). The career timeline loads acme-tooltip's definition on
// the first interaction, so it is not part of it. The service worker's own requests, which precache every file for
// offline use, are not the page's.
describe("the JavaScript that / loads", () => {
  test("before any interaction is under 200 KB, gzip-compressed; the first Tab loads acme-tooltip's code", async () => {
    await inWindow(WIDE, async (browserWindow) => {
      const page = await browserWindow.context.newPage();
      const scripts = new Map<string, Promise<Uint8Array>>();
      page.on("response", (response) => {
        if (response.request().resourceType() === "script") scripts.set(pathOf(response.url()), response.body());
      });
      await page.goto(`${origin}/`, { waitUntil: "networkidle" });
      const atLoad = new Set(scripts.keys());
      let compressed = 0;
      for (const body of scripts.values()) compressed += Bun.gzipSync(new Uint8Array(await body)).length;
      expect(atLoad.size).toBeGreaterThan(0);
      expect(compressed).toBeLessThan(200_000);
      expect(await page.evaluate(() => customElements.get("acme-tooltip") === undefined)).toBe(true);
      await page.keyboard.press("Tab");
      await tooltipDefined(page);
      const later = [...scripts.keys()].filter((script) => !atLoad.has(script));
      expect(later.some((script) => /^\/assets\/tooltip-[\w-]+\.js$/.test(script))).toBe(true);
    });
  });
});

/** The box of each element that matches a selector, in page order: its left and right edges and its size, in px. */
function boxesOf(page: Page, selector: string) {
  return page.$$eval(selector, (elements) =>
    elements.map((element) => {
      const { left, right, width, height } = element.getBoundingClientRect();
      return { left, right, width, height };
    }),
  );
}

/**
 * Waits until acme-tooltip is defined. The career timeline loads its definition on the first interaction with the page
 * (src/site/shell/CareerTimeline.tsx).
 */
function tooltipDefined(page: Page): Promise<void> {
  return page.evaluate(() => customElements.whenDefined("acme-tooltip").then(() => undefined));
}

/**
 * Presses Tab until keyboard focus is on the career timeline span whose button name starts with `name`. The first press
 * starts the load of acme-tooltip's definition. A person presses the next key later than a test does, so the test waits
 * for the definition after the first press. (It took about 30 ms from the preview, and about 1.3 s on a slow 4G network,
 * measured on 2026-10-27.)
 */
async function tabToSpan(page: Page, name: string): Promise<void> {
  for (let press = 0; press < 20; press++) {
    await page.keyboard.press("Tab");
    if (press === 0) await tooltipDefined(page);
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
    if (focused.startsWith(name)) return;
  }
  throw new Error(`Tab never reached the career timeline span "${name}"`);
}

/** A span's bar colour and outline, with the colour of its label, which is --ds-gray-1000, the darkened bar's colour. */
function barOf(page: Page, roleId: string) {
  return page.$eval(`.career-timeline-span-${roleId}`, (span) => {
    const bar = getComputedStyle(span.querySelector(".career-timeline-bar")!);
    const label = getComputedStyle(span.querySelector(".career-timeline-label")!);
    return { color: bar.backgroundColor, outline: `${bar.outlineStyle} ${bar.outlineWidth}`, darkened: label.color };
  });
}

/**
 * The accessible name and description of the element that a selector finds, as Chrome's own accessibility tree gives
 * them: what a screen reader receives.
 */
async function nameAndDescriptionOf(browserWindow: TestWindow, page: Page, selector: string) {
  const cdp = await browserWindow.context.newCDPSession(page);
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false });
  const [node] = nodes;
  return { role: node?.role?.value, name: node?.name?.value, description: node?.description?.value };
}

/** Whether a span's tooltip is open, and the text of each line its surface shows. */
function tooltipOf(page: Page, roleId: string) {
  return page.$eval(`.career-timeline-span-${roleId} acme-tooltip`, (tooltip) => ({
    open: tooltip.shadowRoot?.querySelector('[part="content"]')?.matches(":popover-open") ?? false,
    lines: [...tooltip.querySelectorAll<HTMLElement>('[slot="content"]')]
      .filter((line) => line.checkVisibility())
      .map((line) => line.textContent),
  }));
}

// SPEC-site, Views: Career timeline band; Testing 2. The band on /, as the first-view and career-timeline-states boards
// draw it. The build-output test checks its text and its stylesheet; these check what the browser makes of them.
describe("the career timeline on /", () => {
  // The fixture root's resume.yaml is the repository's: Brigham and Women's (2009 – 2012) has 36 months, Jack Morton
  // (2016 – 2017) 12, and the year from 2012 to 2013 holds no role.
  test("each span is as long as its role, and the gap from 2012 to 2013 shows as space, at 1440 × 900", async () => {
    await inWindow(WIDE, async (browserWindow) => {
      const { page } = await visit(browserWindow, "/");
      const [axis] = await boxesOf(page, ".career-timeline-spans");
      const spans = await boxesOf(page, ".career-timeline-span");
      const [brigham] = await boxesOf(page, ".career-timeline-span-brigham");
      const [sixRedMarbles] = await boxesOf(page, ".career-timeline-span-six-red-marbles");
      const [jackMorton] = await boxesOf(page, ".career-timeline-span-jack-morton");
      expect(brigham!.left).toBeCloseTo(axis!.left, 0);
      expect(spans.at(-1)!.right).toBeCloseTo(axis!.right, 0);
      expect(brigham!.width).toBeCloseTo(3 * jackMorton!.width, 0);
      expect(sixRedMarbles!.left - brigham!.right).toBeCloseTo(jackMorton!.width, 0);
      // Left to right, earliest first, with no overlap.
      spans.slice(1).forEach((span, i) => expect(span.left).toBeGreaterThanOrEqual(spans[i]!.right - 0.5));
      // Each bar fills its span, but for the 2 px at each end that keep neighbouring roles apart.
      const bars = await boxesOf(page, ".career-timeline-bar");
      bars.forEach((bar, i) => expect(bar.width).toBeCloseTo(spans[i]!.width - 4, 0));
    });
  });

  // Decision record row 50: the instruction follows the heading on wide screens.
  test('shows "Select a role to read it and scope the chat" at 1440 × 900, and not at 390 × 844', async () => {
    for (const [viewport, visible] of [
      [WIDE, true],
      [PHONE, false],
    ] as const) {
      await inWindow(viewport, async (browserWindow) => {
        const { page } = await visit(browserWindow, "/");
        const hint = page.getByText("Select a role to read it and scope the chat");
        expect({ viewport, visible: await hint.isVisible() }).toEqual({ viewport, visible });
      });
    }
  });

  // At 1024 × 768, the narrowest wide screen, a year is about 53 px, so "Jack Morton" is longer than its span.
  test("keeps each label on one line, and ends a label longer than its span in an ellipsis", async () => {
    await inWindow({ width: 1024, height: 768 }, async (browserWindow) => {
      const { page } = await visit(browserWindow, "/");
      const labels = await page.$$eval(".career-timeline-label", (elements) =>
        elements.map((label) => ({
          text: label.textContent,
          cut: label.scrollWidth > label.clientWidth,
          lines: Math.round(label.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(label).lineHeight)),
          overflow: `${getComputedStyle(label).overflow} ${getComputedStyle(label).textOverflow}`,
        })),
      );
      expect(labels.filter((label) => label.cut).map((label) => label.text)).toContain("Jack Morton");
      expect(labels.map((label) => label.lines)).toEqual(labels.map(() => 1));
      expect(labels.map((label) => label.overflow)).toEqual(labels.map(() => "hidden ellipsis"));
    });
  });

  // A pointer crosses the page before it reaches a span. Its first move over the page starts the load of acme-tooltip's
  // definition; here it crosses the band's heading.
  test("hover darkens the span, and its tooltip shows the full employer name, then the title and the years", async () => {
    await inWindow(WIDE, async (browserWindow) => {
      const { page } = await visit(browserWindow, "/");
      const before = await barOf(page, "jack-morton");
      expect(before.color).not.toBe(before.darkened);
      await page.getByRole("heading", { name: "Career timeline" }).hover();
      await tooltipDefined(page);
      await page.locator(".career-timeline-span-jack-morton button").hover();
      await page.locator(".career-timeline-span-jack-morton acme-tooltip[open]").waitFor();
      const after = await barOf(page, "jack-morton");
      expect(after.color).toBe(after.darkened);
      // SPEC-site's own example.
      expect(await tooltipOf(page, "jack-morton")).toEqual({
        open: true,
        lines: ["Jack Morton Worldwide", "Senior Front-End Engineer, 2016 – 2017"],
      });
    });
  });

  // Chrome's own accessibility tree is the oracle: the name and the description that a screen reader receives.
  test("keyboard focus darkens and rings the span, and the tooltip's text is the button's description", async () => {
    await inWindow(WIDE, async (browserWindow) => {
      const { page } = await visit(browserWindow, "/");
      await tabToSpan(page, "Jack Morton");
      await page.locator(".career-timeline-span-jack-morton acme-tooltip[open]").waitFor();
      const bar = await barOf(page, "jack-morton");
      expect({ darkened: bar.color === bar.darkened, outline: bar.outline }).toEqual({
        darkened: true,
        outline: "solid 2px",
      });
      expect(await nameAndDescriptionOf(browserWindow, page, ".career-timeline-span-jack-morton button")).toEqual({
        role: "button",
        name: "Jack Morton Worldwide, 2016 – 2017",
        // acme-tooltip joins the lines of its content slot with a space (0.3.3).
        description: "Jack Morton Worldwide Senior Front-End Engineer, 2016 – 2017",
      });
    });
  });

  // A keyboard user's first Tab reaches the app bar before any span, and starts the load of acme-tooltip's definition.
  // Once the definition is there, the first span that Tab reaches has the tooltip's text as its description.
  test("after the first Tab, the first span that Tab reaches has the tooltip's text as its description", async () => {
    await inWindow(WIDE, async (browserWindow) => {
      const { page } = await visit(browserWindow, "/");
      await tabToSpan(page, "Brigham");
      await page.locator(".career-timeline-span-brigham acme-tooltip[open]").waitFor();
      expect(await nameAndDescriptionOf(browserWindow, page, ".career-timeline-span-brigham button")).toEqual({
        role: "button",
        name: "Brigham and Women’s Hospital, 2009 – 2012",
        description: "Brigham and Women’s Hospital UX Engineer, 2009 – 2012",
      });
    });
  });

  test("axe-core reports no WCAG 2.2 AA violation with a span's tooltip open, at 1440 × 900", async () => {
    await inWindow(WIDE, async (browserWindow) => {
      const { page } = await visit(browserWindow, "/");
      await tabToSpan(page, "Jack Morton");
      await page.locator(".career-timeline-span-jack-morton acme-tooltip[open]").waitFor();
      expect(await axeViolations(page)).toEqual([]);
    });
  });

  // Below 1024 px the band keeps about 70 px a year and scrolls sideways inside itself (task S23 adds the rest of the
  // phone band), so its spans stay targets of at least 24 × 24 px and the page never scrolls sideways.
  test("never makes the page scroll sideways at 390 × 844; the band scrolls inside itself", async () => {
    await inWindow(PHONE, async (browserWindow) => {
      const { page } = await visit(browserWindow, "/");
      const widths = await page.evaluate(() => {
        const scroller = document.querySelector(".career-timeline-scroller")!;
        return {
          page: document.documentElement.scrollWidth <= window.innerWidth,
          band: scroller.scrollWidth > scroller.clientWidth,
        };
      });
      expect(widths).toEqual({ page: true, band: true });
      const buttons = await boxesOf(page, ".career-timeline-span button");
      expect(buttons.filter((button) => button.width < 24 || button.height < 24)).toEqual([]);
    });
  });
});
