// Seam 1 of SPEC-site: buildSite() writes the real build output, and these tests read its files.
// The fixture root holds the project's files: the repository's resume.yaml with a name, a lead and a headline of its
// own, and a fake phone number in private.yaml.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $, Glob } from "bun";
import { Face, Blob as HarfBuzzBlob } from "harfbuzzjs";
import { formatRange, formatTitle, loadResume, type Resume } from "../../content";
import { buildKnowledge } from "../../knowledge/build";
import { holds } from "../../private-details";
import { buildSite } from "../build";

const REPO = `${import.meta.dir}/../../..`;
const FAKE_PHONE = "(555) 555-0100";
/** Only the fixture root's resume.yaml holds this name, so a page title that shows it read that resume.yaml. */
const FIXTURE_NAME = "The Fixture Root’s Name";
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

/** React escapes these characters in text and in attribute values; HTMLRewriter hands both over as written. */
const ESCAPES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'" };

/** The text that React wrote, with its escapes read back. */
const unescaped = (written: string) => written.replace(/&(amp|lt|gt|quot|#x27);/g, (escape) => ESCAPES[escape]!);

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
  return entries.map(({ id, text }) => ({ id, text: unescaped(text).replace(/\s+/g, " ").trim() }));
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
  return elements.map(({ tag, text }) => ({ tag, text: unescaped(text).replace(/\s+/g, " ").trim() }));
}

/**
 * One attribute of each element of a page that matches a CSS selector, in page order, with React's escapes read back.
 * An element without the attribute gives null.
 */
async function attributeOn(page: string, selector: string, attribute: string): Promise<(string | null)[]> {
  const values: (string | null)[] = [];
  new HTMLRewriter()
    .on(selector, {
      element(element) {
        const value = element.getAttribute(attribute);
        values.push(value === null ? null : unescaped(value));
      },
    })
    .transform(await Bun.file(`${staticDir}/${page}`).text());
  return values;
}

/** Each address the sitemap lists, sorted. */
async function sitemapAddresses(): Promise<string[]> {
  const sitemap = await Bun.file(`${staticDir}/sitemap.xml`).text();
  return [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map(([, address]) => address!).sort();
}

/** The stylesheets a page links, by address, in page order. */
async function stylesheetsOf(page: string): Promise<string[]> {
  const hrefs: string[] = [];
  new HTMLRewriter()
    .on('link[rel="stylesheet"][href]', { element: (element) => void hrefs.push(element.getAttribute("href")!) })
    .transform(await Bun.file(`${staticDir}/${page}`).text());
  return hrefs;
}

/** The text of the stylesheets a page links, in page order. */
async function cssOf(page: string): Promise<string> {
  const sheets = (await stylesheetsOf(page)).map((href) => Bun.file(`${staticDir}${href}`).text());
  return (await Promise.all(sheets)).join("\n");
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
  const fixtureSource = {
    ...source,
    basics: { ...source.basics, name: FIXTURE_NAME, summary: FIXTURE_LEAD, label: FIXTURE_HEADLINE },
  };
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

describe("the HTML files", () => {
  // The not-found page is not a prerendered page: buildSite() writes it outside the route tree (SPEC-site, Project
  // Structure), so it is in no sitemap.
  test("are the prerendered pages / and /resume, and the not-found page 404.html", async () => {
    expect(await htmlFiles()).toEqual(["404.html", "index.html", "resume/index.html"]);
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

  // The page's route gives the end slot its content (the capability map's contract "the app bar's end slot"). Neither
  // route gives it any yet; the workspace route puts New chat there on phones, which seam 2 checks.
  test("holds no end-slot element while the page's route gives the slot no content", async () => {
    expect(await elementsOn(page, 'acme-app-bar [slot="end"]')).toEqual([]);
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

// SPEC-site, Standalone pages and Testing 1: each page's head names it for search engines and share previews, with its
// canonical address on the site's one address, peterkloss.dev (decision 0018). The title and the description come from
// the fixture root's resume.yaml, so no page copies a fact by hand. The workspace's title is the name alone, as the
// installed-app board draws it in the app's title bar; /resume's is the documents' title, "<name> — Resume".
describe.each([
  ["index.html", FIXTURE_NAME, "https://peterkloss.dev/"],
  ["resume/index.html", `${FIXTURE_NAME} — Resume`, "https://peterkloss.dev/resume"],
])("the head of %s", (page, title, address) => {
  test(`has one title, "${title}"`, async () => {
    expect(await elementsOn(page, "head title")).toEqual([{ tag: "title", text: title }]);
  });

  test("has one description, the fixture root's lead (basics.summary)", async () => {
    expect(await attributeOn(page, 'meta[name="description"]', "content")).toEqual([FIXTURE_LEAD]);
  });

  test(`has one canonical address, ${address}`, async () => {
    expect(await attributeOn(page, 'link[rel="canonical"]', "href")).toEqual([address]);
  });

  // The Open Graph protocol (https://ogp.me): what a share preview shows, each tag once.
  test("has a share preview's Open Graph tags: type, canonical address, title, description", async () => {
    const tags: Record<string, (string | null)[]> = {};
    new HTMLRewriter()
      .on('meta[property^="og:"]', {
        element(element) {
          const content = element.getAttribute("content");
          (tags[element.getAttribute("property")!] ??= []).push(content === null ? null : unescaped(content));
        },
      })
      .transform(await Bun.file(`${staticDir}/${page}`).text());
    expect(tags).toEqual({
      "og:type": ["website"],
      "og:url": [address],
      "og:title": [title],
      "og:description": [FIXTURE_LEAD],
    });
  });
});

// SPEC-site, Workspace addresses: every unknown path gets the not-found page, with status 404. Its wording is Peter's,
// as the not-found boards draw it (decision record row 138), with the curly apostrophe of the boards and of resume.yaml.
describe("the not-found page 404.html", () => {
  test('shows "404", the heading "Page not found" and the line that says why', async () => {
    expect(await elementsOn("404.html", "main p, main h1")).toEqual([
      { tag: "p", text: "404" },
      { tag: "h1", text: "Page not found" },
      { tag: "p", text: "There is no page at this address. The link may be mistyped, or the page may have moved." },
    ]);
  });

  test("links to the chat at / and to the resume at /resume, and nowhere else", async () => {
    expect(await elementsOn("404.html", "main a")).toEqual([
      { tag: "a", text: "Ask the chat about Peter’s work" },
      { tag: "a", text: "Read Peter’s resume" },
    ]);
    expect(await elementsOn("404.html", 'main a[href="/"]')).toEqual([
      { tag: "a", text: "Ask the chat about Peter’s work" },
    ]);
    expect(await elementsOn("404.html", 'main a[href="/resume"]')).toEqual([{ tag: "a", text: "Read Peter’s resume" }]);
  });

  // WCAG 2.2, 2.4.2 Page Titled. The title is the approved heading, so the page adds no wording.
  test('has the title "Page not found"', async () => {
    expect(await elementsOn("404.html", "head title")).toEqual([{ tag: "title", text: "Page not found" }]);
  });

  // SPEC-site, Saved views: the not-found page has no script, so it follows the system's light or dark setting.
  test("holds no script and loads none", async () => {
    expect(await elementsOn("404.html", "script")).toEqual([]);
    expect(await scriptsLoadedBy("404.html")).toEqual([]);
  });

  // The app bar's name box and headline, with the app bar's own rules (layout.css), in a plain header as the not-found
  // boards draw it: with no script, acme-app-bar would never upgrade, and its bar and banner landmark live in its
  // shadow DOM.
  test("opens with a header that holds the app bar's name box, a link to /, and the fixture root's headline", async () => {
    const [first] = await elementsOn("404.html", "body > *");
    expect(first?.tag).toBe("header");
    expect(await elementsOn("404.html", 'header a.app-bar-name[href="/"]')).toEqual([
      { tag: "a", text: resume.basics.name },
    ]);
    expect(await elementsOn("404.html", "header .app-bar-headline")).toEqual([{ tag: "span", text: FIXTURE_HEADLINE }]);
  });

  test("holds no design-system part, because no script would define it", async () => {
    const parts = (await elementsOn("404.html", "*")).filter((element) => element.tag.startsWith("acme-"));
    expect(parts).toEqual([]);
  });

  // One stylesheet for every page: the design system's tokens and the site's own rules, the app bar's among them.
  test("links only stylesheets that / and /resume link too", async () => {
    const pagesLink = [...(await stylesheetsOf("index.html")), ...(await stylesheetsOf("resume/index.html"))];
    const notFoundLinks = await stylesheetsOf("404.html");
    expect(notFoundLinks.length).toBeGreaterThan(0);
    expect(notFoundLinks.filter((href) => !pagesLink.includes(href))).toEqual([]);
  });

  test("has a rule for each class it uses in the stylesheets it links", async () => {
    const classes = new Set<string>();
    new HTMLRewriter()
      .on("[class]", { element: (element) => element.getAttribute("class")!.split(/\s+/).forEach((c) => classes.add(c)) })
      .transform(await Bun.file(`${staticDir}/404.html`).text());
    const css = await cssOf("404.html");
    // A class name is followed by a character that cannot continue it: ".not-found" is not ".not-found-bar".
    const unstyled = [...classes].filter((name) => !new RegExp(`\\.${name}(?![-\\w])`).test(css));
    expect(classes.size).toBeGreaterThan(0);
    expect(unstyled).toEqual([]);
  });

  // SPEC-site, Workspace addresses: with no script to read the stored theme, the page follows the system's setting.
  // The token stylesheet does that with its own media query, before any part or script runs.
  test("follows the system's light or dark setting through the stylesheets it links", async () => {
    expect(await cssOf("404.html")).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)/);
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

/** The site's one font file, at its address on the site (scripts/site-fonts.ts cuts it into public/fonts/). */
const FONT = "/fonts/google-sans-flex-latin.woff";

/**
 * The TrueType font inside a WOFF 1.0 file, rebuilt as a browser rebuilds it (https://www.w3.org/TR/WOFF/). It throws
 * where the specification says a browser must not load the file.
 */
async function sfntOf(woff: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const header = new DataView(woff.buffer, woff.byteOffset, woff.byteLength);
  if (header.getUint32(0) !== 0x774f4646) throw new Error('the file does not start with the signature "wOFF"');
  if (header.getUint32(8) !== woff.byteLength) throw new Error("the header's length is not the file's length");
  const numTables = header.getUint16(12);
  const sfnt = new Uint8Array(header.getUint32(16));
  const out = new DataView(sfnt.buffer);
  out.setUint32(0, header.getUint32(4));
  out.setUint16(4, numTables);
  let offset = 12 + 16 * numTables;
  for (let i = 0; i < numTables; i++) {
    const [tag, start, compLength, origLength, checksum] = [0, 4, 8, 12, 16].map((at) => header.getUint32(44 + i * 20 + at));
    if (i > 0 && tag! <= header.getUint32(44 + (i - 1) * 20)) throw new Error("the tables are not in tag order");
    if (compLength! > origLength!) throw new Error(`table ${i} is longer compressed than its own length`);
    const stored = woff.subarray(start, start! + compLength!);
    const data =
      compLength === origLength
        ? stored
        : new Uint8Array(
            await new Response(new Blob([stored]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer(),
          );
    if (data.byteLength !== origLength) throw new Error(`table ${i} does not inflate to its own length`);
    [tag!, checksum!, offset, origLength!].forEach((value, at) => out.setUint32(12 + i * 16 + at * 4, value));
    sfnt.set(data, offset);
    offset += (origLength! + 3) & ~3;
  }
  return sfnt;
}

/** Each @font-face rule in a stylesheet's text: its descriptors by name, each value with its quote marks dropped. */
function fontFaces(css: string): Record<string, string>[] {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) =>
    Object.fromEntries(
      body!
        .split(";")
        .filter((descriptor) => descriptor.includes(":"))
        .map((descriptor) => {
          const colon = descriptor.indexOf(":");
          const value = descriptor.slice(colon + 1).replace(/["']/g, "").replace(/\s+/g, " ");
          return [descriptor.slice(0, colon).trim(), value.trim()];
        }),
    ),
  );
}

/** Each character that the text of a page's body shows, as a code point; script text stays out. */
async function charactersShownBy(page: string): Promise<Set<number>> {
  const shown = new Set<number>();
  let inScript = false;
  new HTMLRewriter()
    .on("script", {
      element(script) {
        inScript = true;
        script.onEndTag(() => void (inScript = false));
      },
    })
    .on("body", {
      text(chunk) {
        if (inScript) return;
        for (const character of unescaped(chunk.text)) if (character >= " ") shown.add(character.codePointAt(0)!);
      },
    })
    .transform(await Bun.file(`${staticDir}/${page}`).text());
  return shown;
}

// SPEC-site, Tech Stack, and SPEC-deploy, Documents: the site serves Google Sans Flex from its own address. The cut font
// files are committed in public/fonts/, so the build copies them and downloads nothing.
describe("the site's fonts", () => {
  test("the static folder holds each committed file of public/fonts/, byte for byte: the font and its license", async () => {
    const committed = (await Array.fromAsync(new Glob("*").scan({ cwd: `${REPO}/public/fonts` }))).sort();
    expect(committed).toEqual(["OFL.txt", FONT.slice("/fonts/".length)].sort());
    for (const file of committed) {
      const copy = Bun.file(`${staticDir}/fonts/${file}`);
      expect(await copy.exists()).toBe(true);
      expect(Buffer.compare(await copy.bytes(), await Bun.file(`${REPO}/public/fonts/${file}`).bytes())).toBe(0);
    }
  });

  // The design system's weights, 400 to 700, on the variable font's weight axis (its Typeface page, 0.3.3).
  test("the font is a WOFF file of Google Sans Flex with one variation axis, weight, from 400 to 700", async () => {
    const face = new Face(new HarfBuzzBlob(await sfntOf(await Bun.file(`${staticDir}${FONT}`).bytes())), 0);
    const axes = Object.values(face.getAxisInfos()).map(({ tag, min, default: start, max }) => ({ tag, min, start, max }));
    expect(axes).toEqual([{ tag: "wght", min: 400, start: 400, max: 700 }]);
    expect(face.getName(1, "en")).toBe("Google Sans Flex");
  });

  // The token stylesheet names the family first in its text stack, --acme-font-sans, and holds no @font-face of its own:
  // the page gives the family its file. font-display swap is the design system's own (its Typeface page loads the
  // family with display=swap), so the text shows at once in the fallback font.
  test.each(["index.html", "resume/index.html", "404.html"])(
    "the stylesheets of %s give the tokens' text family one @font-face: weights 400 to 700, from the site's WOFF file",
    async (page) => {
      const css = await cssOf(page);
      expect(css.match(/--acme-font-sans:\s*"([^"]+)"/)?.[1]).toBe("Google Sans Flex");
      const [face, ...others] = fontFaces(css);
      expect(others).toEqual([]);
      const { src, ...descriptors } = face ?? {};
      expect(descriptors).toEqual({
        "font-family": "Google Sans Flex",
        "font-style": "normal",
        "font-weight": "400 700",
        "font-display": "swap",
      });
      // The file's address on the site, and its format. The minifier may drop the space between the two.
      expect(src?.match(/^url\((.+)\)\s*format\((.+)\)$/)?.slice(1)).toEqual([FONT, "woff"]);
    },
  );

  // SPEC-site, Boundaries: no request to a third party. The header policy's font-src 'self' would block such a font
  // (SPEC-deploy, Headers); this check finds it at build time, in every file under the output, the functions included.
  test("no file under the output names a font on another host", async () => {
    const fontHost = /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net/;
    const remoteFont = /(?:https?:)?\/\/[^\s"'()<>]+\.(?:woff2?|ttf|otf|eot)\b/i;
    const naming: string[] = [];
    for await (const path of new Glob("**/*").scan({ cwd: outDir, dot: true })) {
      if (path.endsWith(".woff")) continue; // the site's own font file holds no text to read
      const text = await Bun.file(`${outDir}/${path}`).text();
      if (fontHost.test(text) || remoteFont.test(text)) naming.push(path);
    }
    expect(naming).toEqual([]);
  });

  // A character the font lacks would show in the fallback font, the next one in the tokens' stack.
  test("the font has a glyph for each character that the pages show", async () => {
    const face = new Face(new HarfBuzzBlob(await sfntOf(await Bun.file(`${staticDir}${FONT}`).bytes())), 0);
    const inFont = new Set(face.collectUnicodes());
    const missing = new Set<string>();
    for (const page of await htmlFiles()) {
      for (const codePoint of await charactersShownBy(page)) {
        if (!inFont.has(codePoint)) missing.add(`U+${codePoint.toString(16).toUpperCase().padStart(4, "0")} in ${page}`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});

describe("the sitemap", () => {
  // A crawled /?source= or /?role= link would otherwise be listed here (SPEC-site, Tech Stack).
  test("lists / and /resume on peterkloss.dev, and no address with a query", async () => {
    expect(await sitemapAddresses()).toEqual(["https://peterkloss.dev/", "https://peterkloss.dev/resume"]);
  });

  // SPEC-site, Testing 1: the sitemap lists every page. 404.html is no prerendered page: it answers every unknown path,
  // so it has no address of its own and stays out.
  test("lists the canonical address of every prerendered page, and no other address", async () => {
    const pages = (await htmlFiles()).filter((page) => page !== "404.html");
    // One canonical address per page; the head tests above check each page's.
    const perPage = await Promise.all(pages.map((page) => attributeOn(page, 'link[rel="canonical"]', "href")));
    const canonical = perPage.flat();
    expect(canonical).toHaveLength(pages.length);
    expect(canonical.toSorted()).toEqual(await sitemapAddresses());
  });

  // TanStack Start writes pages.json beside the sitemap, and nothing reads it. It would make a second public list of
  // the pages, holding also the addresses with a query that the prerender filter drops and the sitemap leaves out.
  test("has no page list beside it: the static folder holds no pages.json", async () => {
    expect(await Bun.file(`${staticDir}/pages.json`).exists()).toBe(false);
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
