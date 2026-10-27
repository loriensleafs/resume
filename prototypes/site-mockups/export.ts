// Renders canvas boards to PNG, light and dark, without the canvas runtime.
// Usage: bun export.ts boards ../../docs/design/mockups [slug ...]
// Needs boards/acme/design-system.js; see README.md.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [projectDir, outDir, ...only] = process.argv.slice(2);
const work = `${import.meta.dir}/boards`;
mkdirSync(outDir, { recursive: true });

type Board = { file: string; slug: string; modes: ("light" | "dark")[] };
const boards: Board[] = [
  { file: "MergedStart", slug: "first-view", modes: ["light", "dark"] },
  { file: "MergedAnswer", slug: "answer-with-source", modes: ["light", "dark"] },
  { file: "MergedReturn", slug: "returning-visitor", modes: ["light", "dark"] },
  { file: "MergedInstalled", slug: "installed-app", modes: ["light", "dark"] },
  { file: "MergedPhone", slug: "phone-typing", modes: ["light", "dark"] },
  { file: "MergedPhoneRole", slug: "phone-role-selected", modes: ["light", "dark"] },
  { file: "MergedSourcePhone", slug: "phone-source", modes: ["light", "dark"] },
  { file: "MergedInstallPhone", slug: "phone-install-offer", modes: ["light", "dark"] },
  { file: "MergedStartOverPhone", slug: "phone-new-chat", modes: ["light", "dark"] },
  { file: "ComposerStates", slug: "chat-input-states", modes: ["light", "dark"] },
  { file: "ConversationStates", slug: "conversation-states", modes: ["light", "dark"] },
  { file: "TimelineStates", slug: "career-timeline-states", modes: ["light", "dark"] },
  { file: "TimelineOneLine", slug: "career-timeline-options", modes: ["light"] },
  { file: "AppIcons", slug: "app-icon", modes: ["light"] },
  { file: "NotFound", slug: "page-not-found", modes: ["light", "dark"] },
  { file: "NotFoundPhone", slug: "phone-page-not-found", modes: ["light", "dark"] },
];

const canvas = await Bun.file(`${projectDir}/canvas.json`).json();
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

class DCLogic { props: Record<string, unknown>; constructor(props: Record<string, unknown>) { this.props = props; } }

const browser = await chromium.launch();
for (const b of boards) {
  if (only.length && !only.includes(b.slug)) continue;
  const html = await Bun.file(`${projectDir}/${b.file}.dc.html`).text();
  const { w, h } = canvas.boards[`${b.file}.dc.html`];
  const script = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? "";
  for (const mode of b.modes) {
    const Component = new Function("DCLogic", `${script}\nreturn Component;`)(DCLogic);
    const vals = new Component({ appearance: mode }).renderVals() as Record<string, unknown>;
    const filled = html.replace(/\{\{\s*([\w.$]+)\s*\}\}/g, (_, path: string) => {
      const v = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], vals);
      return v === undefined ? "" : escape(String(v));
    });
    const tmp = `${work}/__export.html`;
    await Bun.write(tmp, filled);
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: mode });
    await page.goto(`file://${tmp}`);
    await page.evaluate((m) => document.documentElement.setAttribute("data-acme-appearance", m), mode);
    await page.evaluate(() => document.fonts.ready);
    // The boards set the toggle tip trigger to tiny tertiary in their lifecycle, which this script does not run.
    await page.evaluate(() => document.querySelectorAll("acme-toggle-tip.m-info").forEach((t) => { const b = t.shadowRoot?.querySelector("[part~=trigger]"); if (b) { b.setAttribute("variant", "tertiary"); b.setAttribute("size", "tiny"); } }));
    await page.waitForTimeout(1500);
    await page.evaluate((m) => document.documentElement.setAttribute("data-acme-appearance", m), mode);
    await page.waitForTimeout(300);
    const out = `${outDir}/${b.slug}-${mode}.png`;
    await page.screenshot({ path: out });
    await page.close();
    console.log(out);
  }
}
await browser.close();
