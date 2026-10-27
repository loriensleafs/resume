// Seam 1 of SPEC-site: buildSite() writes the real build output, and these tests read its files.
// The fixture root holds the project's files with a fake phone number in private.yaml.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $, Glob } from "bun";
import { holds } from "../../private-details";
import { buildSite } from "../build";

const REPO = `${import.meta.dir}/../../..`;
const FAKE_PHONE = "(555) 555-0100";
const tmp = `${Bun.env.TMPDIR ?? "/tmp"}/site-test-${crypto.randomUUID()}`;
const root = `${tmp}/root`;
const outDir = `${tmp}/out`;
const staticDir = `${outDir}/.vercel/output/static`;

/** Every HTML file under the static folder, by its path in that folder. */
async function htmlFiles(): Promise<string[]> {
  return (await Array.fromAsync(new Glob("**/*.html").scan({ cwd: staticDir }))).sort();
}

/**
 * The JavaScript files a page loads before any interaction, by address: its scripts and module preloads, and every
 * file they import statically. A dynamic import waits for a navigation, so it stays out.
 */
async function scriptsLoadedBy(page: string): Promise<string[]> {
  const entries: string[] = [];
  // Each selector matches only elements that have the attribute, so getAttribute() returns a string.
  new HTMLRewriter()
    .on("script[src]", { element: (element) => void entries.push(element.getAttribute("src")!) })
    .on('link[rel="modulepreload"]', { element: (element) => void entries.push(element.getAttribute("href")!) })
    .transform(await Bun.file(`${staticDir}/${page}`).text());
  const loaded = new Set<string>();
  const scanner = new Bun.Transpiler({ loader: "js" });
  const visit = async (address: string): Promise<void> => {
    if (loaded.has(address)) return;
    loaded.add(address);
    for (const { path, kind } of scanner.scanImports(await Bun.file(`${staticDir}${address}`).text())) {
      if (kind === "import-statement") await visit(new URL(path, `https://peterkloss.dev${address}`).pathname);
    }
  };
  for (const entry of entries) await visit(entry);
  return [...loaded];
}

beforeAll(async () => {
  await Bun.write(`${root}/resume.yaml`, Bun.file(`${REPO}/resume.yaml`));
  await Bun.write(`${root}/private.yaml`, `basics:\n  phone: ${FAKE_PHONE}\n`);
  // The build runs from another working folder, with a relative output folder, as a caller outside the
  // repository would: neither may change where Vite finds the site or where the output goes.
  const testsFolder = process.cwd();
  process.chdir(tmp);
  try {
    await buildSite({ root, outDir: "out" });
  } finally {
    process.chdir(testsFolder);
  }
}, 120_000);

afterAll(async () => {
  await $`rm -rf ${tmp}`.quiet().nothrow();
});

describe("the prerendered pages", () => {
  test("are / and /resume, and no other page", async () => {
    expect(await htmlFiles()).toEqual(["index.html", "resume/index.html"]);
  });
});

describe("the sitemap", () => {
  // A crawled /?source= or /?role= link would otherwise be listed here (SPEC-site, Tech Stack).
  test("lists / and /resume on peterkloss.dev, and no address with a query", async () => {
    const sitemap = await Bun.file(`${staticDir}/sitemap.xml`).text();
    const addresses = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map(([, address]) => address).sort();
    expect(addresses).toEqual(["https://peterkloss.dev/", "https://peterkloss.dev/resume"]);
  });
});

describe("private details", () => {
  // holds() also finds the number in any other format (src/private-details.ts). The failure names files only.
  test("no file under the output holds the fixture root's phone number", async () => {
    const leaks: string[] = [];
    for await (const path of new Glob("**/*").scan({ cwd: outDir, dot: true })) {
      if (holds(await Bun.file(`${outDir}/${path}`).text(), FAKE_PHONE)) leaks.push(path);
    }
    expect(leaks).toEqual([]);
  });
});

describe("the Content Security Policy", () => {
  // style-src 'self' blocks a style attribute, and no hash can allow one (SPEC-deploy, Headers).
  test("no page holds a style attribute", async () => {
    const styled: string[] = [];
    for (const page of await htmlFiles()) {
      const finder = new HTMLRewriter().on("[style]", {
        element: (element) => void styled.push(`${page}: <${element.tagName}>`),
      });
      finder.transform(await Bun.file(`${staticDir}/${page}`).text());
    }
    expect(styled).toEqual([]);
  });
});

describe("the speed budget", () => {
  // Peter's target: the JavaScript that / loads before any interaction is under 200 KB compressed (SPEC-site,
  // Acceptance criteria; row 24). The browser test measures it from the network log; this check catches growth
  // at build time.
  test("the JavaScript that / loads is under 200 KB, gzip-compressed", async () => {
    const scripts = await scriptsLoadedBy("index.html");
    let compressed = 0;
    for (const script of scripts) compressed += Bun.gzipSync(await Bun.file(`${staticDir}${script}`).bytes()).length;
    expect(scripts.length).toBeGreaterThan(0);
    expect(compressed).toBeLessThan(200_000);
  });
});
