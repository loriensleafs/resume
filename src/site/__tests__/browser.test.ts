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

beforeAll(async () => {
  await buildOutput();
  preview = Bun.spawn([process.execPath, "run", "preview", "--dir", seam1.outDir, "--port", "0"], {
    cwd: REPO,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
  });
  origin = await previewOrigin(preview);
  browser = await chromium.launch(chrome());
}, 120_000);

// Google Chrome's own shutdown took up to 6.5 s while other worktrees' builds and browsers ran (task S10, 2026-10-27),
// longer than bun test's default hook timeout of 5 s, so the hook has its own limit.
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
 * shows, the window records each Content Security Policy violation, each page error and each request to `/_serverFn/`:
 * no page and no server function runs at request time (decision 0023), so a page that asks a server function for its
 * data is broken.
 */
type TestWindow = { context: BrowserContext; problems: string[] };

/** The page's own path, which names it in a problem. */
const pathOf = (address: string) => new URL(address).pathname;

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
test("the policy check names a planted violation, inline event handler, page error and /_serverFn/ request", async () => {
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
      await fetch("/_serverFn/planted");
    });
    // The reports reach the test through the browser's protocol, so they can arrive after the page's last step.
    for (let wait = 0; browserWindow.problems.length < 4 && wait < 50; wait++) await Bun.sleep(100);
    expect(browserWindow.problems.toSorted()).toEqual([
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
    });
  });
});

// SPEC-site, Tech Stack and Testing 2: Design-system parts. The prerender writes each part as its tag with its light-DOM
// text (seam 1); in the browser, each part must then be defined, upgraded and given its shadow root. The wrappers use
// the global custom-element registry (the design system's react-integration skill, 0.3.3), and the design system
// documents no ready signal of its own (its docs server, 0.3.3), so the check reads the registry and the element.
describe.each(["/", "/resume"])("the design-system parts on %s", (path) => {
  test("each part is defined and upgraded, with its shadow root", async () => {
    await inWindow(WIDE, async (browserWindow) => {
      const { page } = await visit(browserWindow, path);
      const parts = await page.evaluate(async () => {
        const elements = [...document.querySelectorAll("*")].filter((element) => element.localName.startsWith("acme-"));
        const tags = [...new Set(elements.map((element) => element.localName))];
        // A tag that no module defines would wait for ever; the page's own scripts ran before the network went quiet.
        const defined = Promise.all(tags.map((tag) => customElements.whenDefined(tag)));
        await Promise.race([defined, new Promise((done) => setTimeout(done, 5_000))]);
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
      });
      expect(parts.length).toBeGreaterThan(0);
      expect(parts).toEqual(parts.map(({ tag }) => ({ tag, defined: true, upgraded: true, shadowRoot: true })));
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

/** Presses Tab until keyboard focus is on the career timeline span whose button name starts with `name`. */
async function tabToSpan(page: Page, name: string): Promise<void> {
  for (let press = 0; press < 20; press++) {
    await page.keyboard.press("Tab");
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

  test("hover darkens the span, and its tooltip shows the full employer name, then the title and the years", async () => {
    await inWindow(WIDE, async (browserWindow) => {
      const { page } = await visit(browserWindow, "/");
      const before = await barOf(page, "jack-morton");
      expect(before.color).not.toBe(before.darkened);
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
      const cdp = await browserWindow.context.newCDPSession(page);
      const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
      const { nodeId } = await cdp.send("DOM.querySelector", {
        nodeId: root.nodeId,
        selector: ".career-timeline-span-jack-morton button",
      });
      const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false });
      const button = nodes.find((node) => node.role?.value === "button");
      expect({
        name: button?.name?.value,
        description: button?.description?.value,
      }).toEqual({
        name: "Jack Morton Worldwide, 2016 – 2017",
        // acme-tooltip joins the lines of its content slot with a space (0.3.3).
        description: "Jack Morton Worldwide Senior Front-End Engineer, 2016 – 2017",
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
