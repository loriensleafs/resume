// Seam 1 of SPEC-site: buildSite() writes the real build output, and these tests read its files.
// The fixture root holds the project's files: the repository's resume.yaml with a lead and a headline of its own, and
// a fake phone number in private.yaml.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $, Glob } from "bun";
import { formatRange, formatTitle, loadResume, type Resume } from "../../content";
import { buildKnowledge } from "../../knowledge/build";
import { holds } from "../../private-details";
import { buildSite } from "../build";

const REPO = `${import.meta.dir}/../../..`;
const FAKE_PHONE = "(555) 555-0100";
/** Only the fixture root's resume.yaml holds this lead, so a page that shows it read resume.yaml from that root. */
const FIXTURE_LEAD = "The fixture root’s lead, which no other resume.yaml holds.";
/** Only the fixture root's resume.yaml holds this headline, so an app bar that shows it read that resume.yaml. */
const FIXTURE_HEADLINE = "The fixture root’s headline, which no other resume.yaml holds";
const tmp = `${Bun.env.TMPDIR ?? "/tmp"}/site-test-${crypto.randomUUID()}`;
const root = `${tmp}/root`;
const outDir = `${tmp}/out`;
const staticDir = `${outDir}/.vercel/output/static`;

/** The fixture root's resume, as the content module's loader reads it: what the pages must show. */
let resume: Resume;

/** Every HTML file under the static folder, by its path in that folder. */
async function htmlFiles(): Promise<string[]> {
  return (await Array.fromAsync(new Glob("**/*.html").scan({ cwd: staticDir }))).sort();
}

/** React escapes these characters in text; HTMLRewriter hands the text over as written. */
const ESCAPES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'" };

/**
 * Each element of a page that carries a knowledge id, in page order: its id and its text, with each run of white space
 * made one space. An id on two elements shows twice.
 */
async function knowledgeEntriesOn(page: string): Promise<{ id: string; text: string }[]> {
  const entries: { id: string; text: string }[] = [];
  let open: { id: string; text: string }[] = [];
  new HTMLRewriter()
    .on("[data-knowledge-id]", {
      element(element) {
        const entry = { id: element.getAttribute("data-knowledge-id")!, text: "" };
        entries.push(entry);
        open.push(entry);
        element.onEndTag(() => void (open = open.filter((other) => other !== entry)));
      },
      text(chunk) {
        for (const entry of open) entry.text += chunk.text;
      },
    })
    .transform(await Bun.file(`${staticDir}/${page}`).text());
  return entries.map(({ id, text }) => ({
    id,
    text: text.replace(/&(amp|lt|gt|quot|#x27);/g, (escape) => ESCAPES[escape]!).replace(/\s+/g, " ").trim(),
  }));
}

/**
 * Each element of a page that matches a CSS selector, in page order: its tag and its text, which is all the text
 * inside it, with each run of white space made one space.
 */
async function elementsOn(page: string, selector: string): Promise<{ tag: string; text: string }[]> {
  const elements: { tag: string; text: string }[] = [];
  let open: { tag: string; text: string }[] = [];
  new HTMLRewriter()
    .on(selector, {
      element(element) {
        const entry = { tag: element.tagName, text: "" };
        elements.push(entry);
        if (element.selfClosing || !element.canHaveContent) return;
        open.push(entry);
        element.onEndTag(() => void (open = open.filter((other) => other !== entry)));
      },
      // HTMLRewriter calls this once for each piece of text, however many open elements match, so each open element
      // gets the text here.
      text(chunk) {
        for (const entry of open) entry.text += chunk.text;
      },
    })
    .transform(await Bun.file(`${staticDir}/${page}`).text());
  return elements.map(({ tag, text }) => ({
    tag,
    text: text.replace(/&(amp|lt|gt|quot|#x27);/g, (escape) => ESCAPES[escape]!).replace(/\s+/g, " ").trim(),
  }));
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
  const source = Bun.YAML.parse(await Bun.file(`${REPO}/resume.yaml`).text()) as { basics: object };
  const fixtureSource = { ...source, basics: { ...source.basics, summary: FIXTURE_LEAD, label: FIXTURE_HEADLINE } };
  await Bun.write(`${root}/resume.yaml`, Bun.YAML.stringify(fixtureSource));
  await Bun.write(`${root}/private.yaml`, `basics:\n  phone: ${FAKE_PHONE}\n`);
  resume = await loadResume("public", root);
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

// SPEC-site, Views: Resume view; Testing 1. Both pages show the whole resume, each entry with its knowledge id.
describe.each(["index.html", "resume/index.html"])("the resume view in %s", (page) => {
  test("the lead is the fixture root's basics.summary, with the id basics", async () => {
    const lead = (await knowledgeEntriesOn(page)).filter((entry) => entry.id === "basics");
    expect(lead).toEqual([{ id: "basics", text: FIXTURE_LEAD }]);
  });

  test("each role's heading holds its employer, dates, title line and location, with the id role:<id>", async () => {
    const entries = await knowledgeEntriesOn(page);
    for (const role of resume.work.filter((role) => !role.earlier)) {
      const headings = entries.filter((entry) => entry.id === `role:${role.id}`);
      expect(headings).toHaveLength(1);
      // The dates and the title line as the documents print them.
      const parts = [role.name, formatRange(role), formatTitle(role), ...(role.location ? [role.location] : [])];
      for (const part of parts) expect(headings[0]!.text).toContain(part);
    }
  });

  test("each highlight holds its text, with the id highlight:<role id>.<n>, from 1 in resume.yaml order", async () => {
    const highlights = (await knowledgeEntriesOn(page)).filter((entry) => entry.id.startsWith("highlight:"));
    const expected = resume.work.flatMap((role) =>
      role.highlights.map((text, i) => ({ id: `highlight:${role.id}.${i + 1}`, text })),
    );
    expect(highlights.map((highlight) => highlight.id)).toEqual(expected.map((highlight) => highlight.id));
    expected.forEach(({ text }, i) => expect(highlights[i]!.text).toContain(text.replace(/\s+/g, " ")));
  });

  test("each earlier role holds its employer, title and dates, with the id role:<role id>", async () => {
    const entries = await knowledgeEntriesOn(page);
    for (const role of resume.work.filter((role) => role.earlier)) {
      const rows = entries.filter((entry) => entry.id === `role:${role.id}`);
      expect(rows).toHaveLength(1);
      for (const part of [role.name, role.position, formatRange(role)]) expect(rows[0]!.text).toContain(part);
    }
  });

  test("each skills group holds its name and keywords, in resume.yaml order, with an id skills:<slug>", async () => {
    const groups = (await knowledgeEntriesOn(page)).filter((entry) => entry.id.startsWith("skills:"));
    expect(groups).toHaveLength(resume.skills.length);
    resume.skills.forEach((group, i) => {
      for (const part of [group.name, ...group.keywords]) expect(groups[i]!.text).toContain(part);
    });
  });

  test("the education entry holds every institution, with the id education", async () => {
    const education = (await knowledgeEntriesOn(page)).filter((entry) => entry.id === "education");
    expect(education).toHaveLength(1);
    for (const { institution } of resume.education) expect(education[0]!.text).toContain(institution);
  });

  // The chat cites the ids of the knowledge core (SPEC-knowledge, Ids), so each must find its element on the page.
  test("the ids are those of the knowledge core's resume entries, each on one element", async () => {
    const { core } = await buildKnowledge({ root });
    const resumeEntryIds = core.filter((entry) => entry.kind === "resume").map((entry) => entry.id);
    const ids = (await knowledgeEntriesOn(page)).map((entry) => entry.id);
    expect(ids.toSorted()).toEqual(resumeEntryIds.toSorted());
  });
});

// SPEC-site, Views: App bar. Every page opens with the design system's acme-app-bar: the name box, then the headline.
describe.each(["index.html", "resume/index.html"])("the app bar in %s", (page) => {
  test("is the first element of the page's body", async () => {
    const [first] = await elementsOn(page, "body > *");
    expect(first?.tag).toBe("acme-app-bar");
  });

  test("holds the name box with basics.name, then the headline, basics.label, from the fixture root", async () => {
    const texts = (await elementsOn(page, "acme-app-bar *")).map((element) => element.text);
    const nameBox = texts.indexOf(resume.basics.name);
    expect(nameBox).toBeGreaterThanOrEqual(0);
    expect(texts.indexOf(FIXTURE_HEADLINE)).toBeGreaterThan(nameBox);
  });
});

// The page's one h1 names what the page is about. On /resume that is Peter, as the documents open with his name; the
// app bar above it is the site's banner, not the page's heading. The workspace's h1 is its first view's heading (S11).
describe("the headings of resume/index.html", () => {
  test("one h1, basics.name, comes before the lead", async () => {
    const headingThenLead = await elementsOn("resume/index.html", "h1, [data-knowledge-id=basics]");
    expect(headingThenLead).toEqual([
      { tag: "h1", text: resume.basics.name },
      { tag: "p", text: FIXTURE_LEAD },
    ]);
  });
});

/**
 * Each design-system part the pages use, with the text the prerender writes inside its tag. A task that adds a part
 * adds it here.
 */
const PARTS: Record<string, (resume: Resume) => string[]> = {
  "acme-app-bar": (resume) => [resume.basics.name, resume.basics.label],
};

// SPEC-site, Tech Stack and Testing 1. The wrappers render in the browser only (decision 0007), so the prerender writes
// each part as its tag with its light-DOM content, and never its shadow DOM; in the browser the part upgrades (seam 2).
describe.each(["index.html", "resume/index.html"])("the design-system parts in %s", (page) => {
  test("each part is its tag, with its light-DOM text", async () => {
    const parts = (await elementsOn(page, "*")).filter((element) => element.tag.startsWith("acme-"));
    expect(parts.length).toBeGreaterThan(0);
    for (const part of parts) {
      expect(Object.keys(PARTS)).toContain(part.tag);
      for (const text of PARTS[part.tag]!(resume)) expect(part.text).toContain(text);
    }
  });

  test("no page holds a declarative shadow root", async () => {
    const html = await Bun.file(`${staticDir}/${page}`).text();
    expect(html).not.toMatch(/<template[^>]*\sshadowroot(mode)?=/i);
  });

  // A tag that no loaded script defines would never upgrade. A part's module registers its tag as a string, which the
  // minifier writes in any of the three quote marks.
  test("the JavaScript the page loads defines each part the page holds", async () => {
    const tags = new Set(
      (await elementsOn(page, "*")).map((element) => element.tag).filter((tag) => tag.startsWith("acme-")),
    );
    const scripts = await Promise.all(
      (await scriptsLoadedBy(page)).map((script) => Bun.file(`${staticDir}${script}`).text()),
    );
    const named = (tag: string) => new RegExp(`["'\`]${tag}["'\`]`);
    const undefinedTags = [...tags].filter((tag) => !scripts.some((script) => named(tag).test(script)));
    expect(tags.size).toBeGreaterThan(0);
    expect(undefinedTags).toEqual([]);
  });
});

// SPEC-site, Tech Stack: each design-system part is imported from its own wrapper module, not from one bundle. An
// import of the package root makes the build emit files that no page loads, such as the flow diagram's web worker and
// the book's image (seen with @acmelabs/design-system-react 0.3.2), even when the bundler drops the unused wrappers.
describe("the static assets", () => {
  test("each file under assets/ is a script or a stylesheet that a page loads", async () => {
    const loaded = new Set<string>();
    for (const page of await htmlFiles()) {
      for (const script of await scriptsLoadedBy(page)) loaded.add(script);
      new HTMLRewriter()
        .on('link[rel="stylesheet"]', { element: (element) => void loaded.add(element.getAttribute("href")!) })
        .transform(await Bun.file(`${staticDir}/${page}`).text());
    }
    const assets = await Array.fromAsync(new Glob("assets/**").scan({ cwd: staticDir }));
    expect(assets.map((asset) => `/${asset}`).filter((asset) => !loaded.has(asset))).toEqual([]);
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
