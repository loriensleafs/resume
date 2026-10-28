// Seam 1 of SPEC-site: the build script, `bun run build:site`, writes the real build output once, with every step that
// Vercel's build runs, and these tests read its files. The fixture root (fixture-root.ts) holds the project's files.
// Seam 2 (browser.test.ts) serves the same build output (build-output.ts).

import { beforeAll, describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { Face, Blob as HarfBuzzBlob } from "harfbuzzjs";
import { formatRange, formatTitle, loadResume, type Resume } from "../../content";
import { buildKnowledge, publicKnowledge } from "../../knowledge/build";
import { holds } from "../../private-details";
import { buildOutput, seam1 } from "./build-output";
import {
  FAKE_PHONE,
  FIXTURE_DEEP_DIVE,
  FIXTURE_DRAFT,
  FIXTURE_DRAFT_LOGISTICS_ANSWER,
  FIXTURE_HEADLINE,
  FIXTURE_INTERVIEW,
  FIXTURE_INTERVIEW_LINK,
  FIXTURE_LEAD,
  FIXTURE_LINK,
  FIXTURE_LOGISTICS_ANSWER,
  FIXTURE_NAME,
} from "./fixture-root";
import { iconSizes, pngSize } from "./image-sizes";

const REPO = `${import.meta.dir}/../../..`;
const { root, outDir, staticDir } = seam1;

/** The fixture root's resume, as the content module's loader reads it: what the pages must show. */
let resume: Resume;
/** What the build script wrote to standard output, TanStack Start's prerender log among it. */
let buildLog = "";

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
  // One build per test run, with all its steps, in its own process (SPEC-deploy, "The build script").
  buildLog = await buildOutput();
  resume = await loadResume("public", root);
}, 120_000);

describe("the HTML files", () => {
  // The not-found page is not a prerendered page: buildSite() writes it outside the route tree (SPEC-site, Project
  // Structure), so it is in no sitemap. The fixture root's draft source gets no page (SPEC-site, Testing 1).
  test("are the prerendered pages /, /resume and one per approved source, and the not-found page 404.html", async () => {
    expect(await htmlFiles()).toEqual([
      "404.html",
      "index.html",
      "resume/index.html",
      `sources/${FIXTURE_DEEP_DIVE}/index.html`,
      `sources/${FIXTURE_INTERVIEW}/index.html`,
    ]);
  });
});

// SPEC-site, Tech Stack: each source page links /?source=<id>, and the crawler drops a page's query from its output
// path, so a crawled /?source=<id> would be written over index.html. The prerender filter rejects every path with "?".
// The written index.html would differ from the workspace's only once / reads ?source= (task S18), so the proof is
// TanStack Start's own list of the pages it prerendered, one "[prerender] - <path>" line each
// (@tanstack/start-plugin-core 1.171.55, prerender.js). The sitemap tests prove the filter's other half.
describe("the prerender", () => {
  test("renders /, /resume and each approved source's page, and no address with a query", async () => {
    const rendered = [...buildLog.matchAll(/^\[prerender\] - (.+)$/gm)].map(([, path]) => path!.trim()).sort();
    expect(rendered).toEqual(["/", "/resume", `/sources/${FIXTURE_DEEP_DIVE}`, `/sources/${FIXTURE_INTERVIEW}`]);
  });
});

// SPEC-site, Views: Source view, and Standalone pages; Testing 1. Each approved source of the fixture root has its
// page at /sources/<id>, with every passage of publicKnowledge(knowledge) and its anchor #<source id>.<n>.
describe.each([
  [
    FIXTURE_DEEP_DIVE,
    "The fixture root’s deep dive",
    // SPEC-site's own example of the kind line: a deep dive about FedNow, 2021 – 2024, with five passages.
    "Deep dive, written from Peter’s answers and approved by him. FedNow, 2021 – 2024. 5 passages.",
  ],
  [
    FIXTURE_INTERVIEW,
    "The fixture root’s interview",
    // The interview's line and the two roles' form are S16's wording draft (docs/design/wording-drafts/S16.md).
    "Interview, in Peter’s own words and approved by him. Highspot, 2024 – 2026; FedNow, 2021 – 2024. 3 passages.",
  ],
])("the source page of %s", (id, title, kindLine) => {
  const page = `sources/${id}/index.html`;

  /** The source as publicKnowledge() gives it to the site: what the page must show. */
  const publicSource = async () => {
    const source = publicKnowledge(await buildKnowledge({ root })).sources.find((source) => source.id === id);
    if (!source) throw new Error(`the fixture root has no approved source ${id}`);
    return source;
  };

  test("opens with the app bar: the fixture root's name in the name box, then its headline", async () => {
    const [first] = await elementsOn(page, "body > *");
    expect(first?.tag).toBe("acme-app-bar");
    const texts = (await elementsOn(page, "acme-app-bar *")).map((element) => element.text);
    expect(texts.indexOf(FIXTURE_HEADLINE)).toBeGreaterThan(texts.indexOf(FIXTURE_NAME));
    expect(texts.indexOf(FIXTURE_NAME)).toBeGreaterThanOrEqual(0);
  });

  test("has one h1, the source's title, and then the kind line", async () => {
    expect(await elementsOn(page, "h1")).toEqual([{ tag: "h1", text: title }]);
    expect(await elementsOn(page, "main article > header > *")).toEqual([
      { tag: "h1", text: title },
      { tag: "p", text: kindLine },
    ]);
  });

  test("shows every passage in file order, each with its anchor <source id>.<n>, its number and its heading", async () => {
    const { passages } = await publicSource();
    expect(await attributeOn(page, "main article section", "id")).toEqual(passages.map((passage) => passage.id));
    expect((await elementsOn(page, "main article section h2")).map((heading) => heading.text)).toEqual(
      passages.map((passage, i) => `${i + 1} ${passage.heading}`),
    );
  });

  test("shows each passage's text, every paragraph of it, in the passage's own section", async () => {
    const { passages } = await publicSource();
    const sections = await elementsOn(page, "main article section");
    expect(sections).toHaveLength(passages.length);
    passages.forEach((passage, i) => {
      for (const paragraph of passage.text.split(/\n\s*\n/)) {
        expect(sections[i]!.text).toContain(paragraph.replace(/\s+/g, " ").trim());
      }
    });
  });

  test('links "Ask the chat about this" to the workspace with the source open, /?source=<id>', async () => {
    expect(await elementsOn(page, `main a[href="/?source=${id}"]`)).toEqual([
      { tag: "a", text: "Ask the chat about this" },
    ]);
  });

  // SPEC-site, Standalone pages and Testing 1: the head names the page for search engines and share previews. The
  // description is the source's summary, which Peter approves with the source.
  test("has one title, the source's title and then the fixture root's name", async () => {
    expect(await elementsOn(page, "head title")).toEqual([{ tag: "title", text: `${title} — ${FIXTURE_NAME}` }]);
  });

  test("has one description, the source's summary, and one canonical address on peterkloss.dev", async () => {
    const { summary } = await publicSource();
    expect(await attributeOn(page, 'meta[name="description"]', "content")).toEqual([summary]);
    expect(await attributeOn(page, 'link[rel="canonical"]', "href")).toEqual([`https://peterkloss.dev/sources/${id}`]);
  });

  test("has a share preview's Open Graph tags: type, canonical address, title, description, image", async () => {
    const { summary } = await publicSource();
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
      "og:url": [`https://peterkloss.dev/sources/${id}`],
      "og:title": [`${title} — ${FIXTURE_NAME}`],
      "og:description": [summary],
      // Row 173's reason holds for a source page too: without an image, a pasted link shows a text-only preview.
      "og:image": ["https://peterkloss.dev/icons/icon-512.png"],
      "og:image:width": ["512"],
      "og:image:height": ["512"],
    });
  });
});

// SPEC-site, Acceptance criteria and Testing 1: the build-time module holds each approved source's id, title and roles
// only. Each source's passages are a separate JSON file that Vite emits under /assets/ with a hashed name, which a view
// fetches only when it shows that source, so the JavaScript that / loads does not grow with the sources.
describe("the source JSON files", () => {
  // Rolldown's [hash] is eight characters of base64url (https://rolldown.rs/reference/OutputOptions.assetFileNames).
  test("are one JSON file per approved source under assets/, named <id>-<hash>.json, and none for the draft", async () => {
    const files = (await Array.fromAsync(new Glob("assets/**/*.json").scan({ cwd: staticDir }))).sort();
    expect(files.map((file) => file.replace(/-[\w-]{8}\.json$/, ".json"))).toEqual([
      `assets/${FIXTURE_DEEP_DIVE}.json`,
      `assets/${FIXTURE_INTERVIEW}.json`,
    ]);
  });

  test("each holds its source's passages, as publicKnowledge(knowledge) gives them", async () => {
    const { sources } = publicKnowledge(await buildKnowledge({ root }));
    for (const source of sources) {
      const [file, ...others] = await Array.fromAsync(new Glob(`assets/${source.id}-*.json`).scan({ cwd: staticDir }));
      expect(others).toEqual([]);
      const { passages } = await Bun.file(`${staticDir}/${file}`).json();
      expect(passages).toEqual(source.passages);
    }
  });

  // The titles are the control: the module holds them, so the search finds a text with "’" as the bundle writes it.
  // Headings stay out of the search: a deep dive's are words such as "Result", which any bundle can hold.
  test("the JavaScript that / loads holds each source's title, and no summary or passage text", async () => {
    const { sources } = publicKnowledge(await buildKnowledge({ root }));
    const scripts = await Promise.all(
      (await scriptsLoadedBy("index.html")).map((script) => Bun.file(`${staticDir}${script}`).text()),
    );
    const inScripts = (text: string) => scripts.some((script) => script.includes(text));
    const texts = sources.flatMap((source) => [source.summary, ...source.passages.map((passage) => passage.text)]);
    expect(sources.map((source) => source.title).filter((title) => !inScripts(title))).toEqual([]);
    expect(texts.filter(inScripts)).toEqual([]);
  });
});

// SPEC-site, Acceptance criteria and Boundaries: a source's Not public section names kinds of material for the chat on
// the server; publicKnowledge() leaves it out, so no file a browser can load holds it. A draft source reaches no output.
describe("the static folder", () => {
  /** Each file under the static folder whose text holds `text`, by its path there. */
  async function filesHolding(text: string): Promise<string[]> {
    const holding: string[] = [];
    for await (const path of new Glob("**/*").scan({ cwd: staticDir, dot: true })) {
      if ((await Bun.file(`${staticDir}/${path}`).text()).includes(text)) holding.push(path);
    }
    return holding;
  }

  // The summaries are the control: each source's page and file hold it, so the search finds a text with "’".
  test("holds no approved source's Not public text", async () => {
    const { sources } = await buildKnowledge({ root });
    expect(sources).toHaveLength(2);
    for (const source of sources) {
      expect((await filesHolding(source.summary)).length).toBeGreaterThan(0);
      expect(source.notPublic.length).toBeGreaterThan(0);
      expect(await filesHolding(source.notPublic)).toEqual([]);
    }
  });

  test("holds no text of the draft source: not its id, its title, its summary or its passage", async () => {
    for (const text of [FIXTURE_DRAFT, "draft source", "fixture draft"]) expect(await filesHolding(text)).toEqual([]);
  });

  // The approved answer is the control: the device index holds it (C16).
  test("holds the approved logistics answer and no draft one", async () => {
    expect(await filesHolding(FIXTURE_LOGISTICS_ANSWER)).toEqual(["device-index.json"]);
    expect(await filesHolding(FIXTURE_DRAFT_LOGISTICS_ANSWER)).toEqual([]);
  });
});

/**
 * device-index.json as a browser fetches it (SPEC-chat, "The build"): one row per resume entry, logistics answer and
 * passage, by knowledge id, with the label and the text a browser shows, and the approved sources' links. The test
 * states the file's shape itself, so it checks the file, not the chat module's type.
 */
type DeviceIndexFile = { entries: { id: string; label: string; text: string }[]; links: string[] };

// SPEC-chat, The build, Citations card and Device matches: the chat's Vite plugin writes the device index into the
// static folder during the site's Vite build, from publicKnowledge(knowledge) of the root that the build names.
describe("the device index", () => {
  const deviceIndex = async (): Promise<DeviceIndexFile> => Bun.file(`${staticDir}/device-index.json`).json();

  // The fixture root's resume.yaml is the repository's, so its roles are FedNow and the others, with their x-short
  // labels; its basics.name is the fixture's own, so the basics label shows that the plugin read the fixture root.
  test('labels each resume entry once: "Resume: FedNow" for a role, "Resume: FedNow, highlight 2" for a highlight', async () => {
    const { core } = await buildKnowledge({ root });
    const resumeEntries = core.filter((entry) => entry.kind === "resume");
    const { entries } = await deviceIndex();
    const resumeRows = entries.filter((row) => resumeEntries.some((entry) => entry.id === row.id));
    // Each resume entry once, in resume order, with the core's public text.
    expect(resumeRows.map(({ id, text }) => ({ id, text }))).toEqual(resumeEntries.map(({ id, text }) => ({ id, text })));
    const labelOf = new Map(resumeRows.map((row) => [row.id, row.label]));
    expect(labelOf.get("role:fednow")).toBe("Resume: FedNow");
    expect(labelOf.get("highlight:fednow.2")).toBe("Resume: FedNow, highlight 2");
    expect(labelOf.get("role:sheridan")).toBe("Resume: Sheridan");
    expect(labelOf.get("basics")).toBe(`Resume: ${FIXTURE_NAME}`);
    expect(labelOf.get("skills:ai-platform")).toBe("Resume: Skills, AI platform");
    expect(labelOf.get("education")).toBe("Resume: Education");
  });

  // SPEC-chat, Markers: a logistics citation reads "Logistics: work arrangement".
  test('holds each approved logistics answer, labelled "Logistics: <topic>", with its text', async () => {
    const { entries } = await deviceIndex();
    expect(entries.filter((row) => row.id.startsWith("logistics:"))).toEqual([
      { id: "logistics:work-arrangement", label: "Logistics: work arrangement", text: FIXTURE_LOGISTICS_ANSWER },
    ]);
  });

  // SPEC-chat, Citations card: a passage's row reads "<source title>: <passage heading>".
  test('holds each passage of each approved source, labelled "<source title>: <passage heading>", with its text', async () => {
    const { sources } = publicKnowledge(await buildKnowledge({ root }));
    const passages = sources.flatMap((source) => source.passages);
    const { entries } = await deviceIndex();
    const passageRows = entries.filter((row) => passages.some((passage) => passage.id === row.id));
    expect(passageRows.map(({ id, text }) => ({ id, text }))).toEqual(passages.map(({ id, text }) => ({ id, text })));
    expect(passageRows).toContainEqual({
      id: `${FIXTURE_DEEP_DIVE}.2`,
      label: "The fixture root’s deep dive: What Peter did",
      text: "The fixture deep dive’s account of what Peter did.",
    });
    expect(passageRows).toContainEqual({
      id: `${FIXTURE_INTERVIEW}.3`,
      label: "The fixture root’s interview: How did you help with the fixture?",
      text: "The fixture interview’s second answer.",
    });
  });

  // SPEC-chat, Rendering answers: an answer may link to the exact https addresses in the approved sources' links. The
  // draft's link names the draft, so the test of the draft's text shows that it is in no file.
  test("holds the approved sources' links, each once, in source-id order", async () => {
    expect((await deviceIndex()).links).toEqual([FIXTURE_LINK, FIXTURE_INTERVIEW_LINK]);
  });

  // SPEC-chat, The build: the browser fetches the device index on demand, so neither the file nor its loader is part of
  // the JavaScript that / loads first (SPEC-site's 200 KB budget). No page uses it before task C36; this guards C36.
  test("is not part of the JavaScript that / loads before any interaction", async () => {
    const scripts = await Promise.all(
      (await scriptsLoadedBy("index.html")).map((script) => Bun.file(`${staticDir}${script}`).text()),
    );
    expect(scripts.filter((script) => script.includes("device-index.json"))).toEqual([]);
  });

  // A whole source is never a citation (SPEC-chat, Markers), and a draft is not in the knowledge base.
  test("holds the resume entries, then the logistics answers, then the passages, and nothing else", async () => {
    const knowledge = publicKnowledge(await buildKnowledge({ root }));
    const { entries } = await deviceIndex();
    expect(entries.map((row) => row.id)).toEqual([
      ...knowledge.core.filter((entry) => entry.kind === "resume").map((entry) => entry.id),
      "logistics:work-arrangement",
      ...knowledge.sources.flatMap((source) => source.passages.map((passage) => passage.id)),
    ]);
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
  // route gives it any yet; the workspace route puts New chat there on phones, which seam 2 checks. "Install app" shows
  // there only after the browser offers the install, so no prerendered page holds it (seam 2 checks it too).
  test("holds no end-slot element while the page's route gives the slot no content", async () => {
    expect(await elementsOn(page, 'acme-app-bar [slot="end"]')).toEqual([]);
  });
});

/**
 * The years of a role as SPEC-site writes them ("FedNow", "2021 – 2024"): the start year, an en dash and the end year,
 * one year alone when the role starts and ends in it, and "Present" with no end date.
 */
function yearsOf({ startDate, endDate }: Resume["work"][number]): string {
  const [start, end] = [startDate.slice(0, 4), endDate?.slice(0, 4) ?? "Present"];
  return start === end ? start : `${start} – ${end}`;
}

/** The fixture root's roles and earlier roles, earliest first: the career timeline's order from left to right. */
const rolesByStart = () => resume.work.toSorted((a, b) => a.startDate.localeCompare(b.startDate));

/**
 * The value of a property in the rule for one selector, in a stylesheet's text, or undefined. A minifier may join two
 * rules with the same declarations into one selector list, so the selector is one item of the rule's list.
 */
function declarationOf(css: string, selector: string, property: string): string | undefined {
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors!.split(",").some((item) => item.trim() === selector)) continue;
    const value = body!.match(new RegExp(`(?:^|;)\\s*${property}\\s*:([^;]*)`))?.[1];
    if (value !== undefined) return value.trim();
  }
  return undefined;
}

/** The grid lines of a timeline span or year label from its class's rule, `grid-column: <start> / <end>`. */
function gridColumnOf(css: string, className: string): [number, number] | undefined {
  const value = declarationOf(css, `.${className}`, "grid-column");
  const lines = value?.match(/^(\d+)\s*\/\s*(\d+)$/);
  return lines ? [Number(lines[1]), Number(lines[2])] : undefined;
}

// SPEC-site, Views: Career timeline band; Testing 1. The workspace shows every role and earlier role as a span at its
// true length on a year axis, as the first-view and career-timeline-states boards draw it.
describe("the career timeline in index.html", () => {
  const page = "index.html";

  test('comes first in main, under the app bar, as a group named by its heading "Career timeline"', async () => {
    const [first] = await attributeOn(page, "main > *", "role");
    const [labelledBy] = await attributeOn(page, "main > *", "aria-labelledby");
    expect(first).toBe("group");
    expect(await elementsOn(page, `#${labelledBy}`)).toEqual([{ tag: "h2", text: "Career timeline" }]);
  });

  // Decision record row 50: the instruction follows the heading. The stylesheet shows it on wide screens only (seam 2).
  test('has the line "Select a role to read it and scope the chat" after its heading', async () => {
    expect(await elementsOn(page, ".career-timeline-header > *")).toEqual([
      { tag: "h2", text: "Career timeline" },
      { tag: "p", text: "Select a role to read it and scope the chat" },
    ]);
  });

  test("has one span for each role and earlier role, earliest first, labelled with the role's x-short value", async () => {
    const labels = (await elementsOn(page, ".career-timeline-label")).map((label) => label.text);
    expect(labels).toEqual(rolesByStart().map((role) => role["x-short"]));
  });

  // Testing 1: each span's button name holds the full employer name and the years. It also holds the span's visible
  // label, as WCAG 2.2's 2.5.3 Label in Name asks, so a visitor who speaks "HBS" reaches Harvard Business School. Text
  // in parentheses does not count for that (axe-core 4.14, after ACT rule 2ee8b8), so "(FedNow)" in the employer name
  // does not hold the label "FedNow".
  test("each span is a real button whose name holds the full employer name, the years and its label", async () => {
    const buttons = await elementsOn(page, ".career-timeline-span button");
    const types = await attributeOn(page, ".career-timeline-span button", "type");
    const names = await attributeOn(page, ".career-timeline-span button", "aria-label");
    expect(buttons.map((button) => button.tag)).toEqual(rolesByStart().map(() => "button"));
    expect(types).toEqual(rolesByStart().map(() => "button"));
    rolesByStart().forEach((role, i) => {
      for (const part of [role.name, yearsOf(role)]) expect(names[i]).toContain(part);
      expect(names[i]!.replace(/\([^()]*\)/g, "")).toContain(role["x-short"]);
    });
    // SPEC-site's own example, and a label that the employer name does not hold.
    expect(names).toContain("Jack Morton Worldwide, 2016 – 2017");
    expect(names).toContain("HBS, Harvard Business School, 2015 – 2016");
  });

  // The tooltip's text is its description of the button (acme-tooltip 0.3.3: the content slot's text).
  test("each span's acme-tooltip holds the full employer name, then the title and the years", async () => {
    const texts = (await elementsOn(page, '.career-timeline-span acme-tooltip > [slot="content"]')).map(({ text }) => text);
    expect(texts).toEqual(rolesByStart().flatMap((role) => [role.name, `${role.position}, ${yearsOf(role)}`]));
    // SPEC-site's own example.
    expect(texts).toContain("Senior Front-End Engineer, 2016 – 2017");
  });

  test("labels its year axis with every second year from the first, and the last year at its end", async () => {
    const years = (await elementsOn(page, ".career-timeline-axis > *")).map((label) => label.text);
    // The first-view board's axis for resume.yaml's roles, 2009 to Aug 2026.
    expect(years).toEqual(["2009", "2011", "2013", "2015", "2017", "2019", "2021", "2023", "2026"]);
  });

  // SPEC-deploy, Headers: no style attribute, so each span's place on the axis is a class in a stylesheet the build
  // writes. The axis has one grid column per month; a span covers the months of its role. A role's dates name a year
  // or a month: it starts at the first month its start date names, and ends after the month that its end date names,
  // or, for a year alone, as that year begins, so "2019 – 2020" and "2020 – 2021" meet and do not overlap.
  test("the stylesheets / links give each span its true length on a year axis of one column per month", async () => {
    const css = await cssOf(page);
    const columns = Object.fromEntries(
      rolesByStart().map((role) => [role.id, gridColumnOf(css, `career-timeline-span-${role.id}`)]),
    );
    const months = (id: string) => columns[id]![1] - columns[id]![0];
    // Jan 2009 to the end of Aug 2026, the first-view board's axis: 17 years and 8 months.
    expect(declarationOf(css, ".career-timeline", "--career-timeline-months")).toBe("212");
    expect(columns.brigham).toEqual([1, 37]); // 2009 – 2012: from the axis's first column, 36 months
    expect(months("jack-morton")).toBe(12); // 2016 – 2017
    expect(months("highspot")).toBe(21); // Dec 2024 – Aug 2026, August included
    expect(columns.highspot![1]).toBe(213); // the latest role ends the axis
    // The career-timeline-states board: "the gap from 2012 to 2013 shows as space".
    expect(columns["six-red-marbles"]![0] - columns.brigham![1]).toBe(12);
    // Left to right, earliest first, and no two spans overlap.
    const ordered = rolesByStart().map((role) => columns[role.id]!);
    ordered.slice(1).forEach(([start], i) => expect(start).toBeGreaterThanOrEqual(ordered[i]![1]));
  });

  test("the stylesheets / links place each year label at its January, and the last at the axis's end", async () => {
    const css = await cssOf(page);
    const years = ["2009", "2011", "2013", "2015", "2017", "2019", "2021", "2023"];
    expect(years.map((year) => gridColumnOf(css, `career-timeline-year-${year}`)?.[0])).toEqual(
      years.map((year) => (Number(year) - 2009) * 12 + 1),
    );
    expect(gridColumnOf(css, "career-timeline-year-2026")?.[1]).toBe(213);
  });

  // A class with no rule in a linked stylesheet would leave the band unstyled until a script ran, or for ever.
  test("has a rule for each class it uses in the stylesheets / links", async () => {
    const classes = new Set<string>();
    new HTMLRewriter()
      .on(".career-timeline, .career-timeline [class]", {
        element: (element) => element.getAttribute("class")!.split(/\s+/).forEach((name) => classes.add(name)),
      })
      .transform(await Bun.file(`${staticDir}/${page}`).text());
    const css = await cssOf(page);
    const unstyled = [...classes].filter((name) => !new RegExp(`\\.${name}(?![-\\w])`).test(css));
    expect(classes.size).toBeGreaterThan(0);
    expect(unstyled).toEqual([]);
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

  // The Open Graph protocol (https://ogp.me): what a share preview shows, each tag once. The image is the 512 px app
  // icon, with its width and height (Peter, decision record row 173).
  test("has a share preview's Open Graph tags: type, canonical address, title, description, image", async () => {
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
      "og:image": ["https://peterkloss.dev/icons/icon-512.png"],
      "og:image:width": ["512"],
      "og:image:height": ["512"],
    });
  });
});

// Decision record row 173: the share preview of / and /resume shows the approved 512 px app icon. A preview reads the
// image from its address on the site, so the file must be in the static folder at the width and height the tags give.
describe.each(["index.html", "resume/index.html"])("the share image of %s", (page) => {
  test("is a committed icon in the static folder, at the width and height its tags give", async () => {
    const [image] = await attributeOn(page, 'meta[property="og:image"]', "content");
    const [width] = await attributeOn(page, 'meta[property="og:image:width"]', "content");
    const [height] = await attributeOn(page, 'meta[property="og:image:height"]', "content");
    const { origin, pathname } = new URL(image ?? "", "https://invalid.invalid");
    expect(origin).toBe("https://peterkloss.dev");
    const served = await Bun.file(`${staticDir}${pathname}`).bytes();
    expect(Buffer.compare(served, await Bun.file(`${REPO}/public${pathname}`).bytes())).toBe(0);
    expect(pngSize(served)).toEqual({ width: Number(width), height: Number(height) });
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
  // Each career timeline span's tooltip holds its own role's text; the career timeline tests check each one.
  "acme-tooltip": () => [],
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
    // A source's JSON file is fetched by a view, not loaded by a page; the source JSON file tests check each one.
    const assets = (await Array.fromAsync(new Glob("assets/**").scan({ cwd: staticDir }))).filter(
      (asset) => !asset.endsWith(".json"),
    );
    expect(assets.map((asset) => `/${asset}`).filter((asset) => !loaded.has(asset))).toEqual([]);
  });
});

/**
 * The site's font files, at their addresses on the site (scripts/site-fonts.ts cuts them into public/fonts/), each with
 * the token that names its family and the families that the token names before it. The design system's mono stack
 * names the Nerd Font build first, a font only a device can have (its Typeface page, 0.3.3).
 */
const FONTS = [
  { family: "Google Sans Flex", token: "--acme-font-sans", before: [], address: "/fonts/google-sans-flex-latin.woff" },
  {
    family: "Google Sans Code",
    token: "--acme-font-mono",
    before: ["GoogleSansCode Nerd Font Mono"],
    address: "/fonts/google-sans-code-latin.woff",
  },
];

/** The families a token's font stack names, in order, with their quote marks dropped; a var() stays as written. */
function stackOf(css: string, token: string): string[] {
  const value = css.match(new RegExp(`${token}:([^;}]*)`))?.[1] ?? "";
  return value.split(",").map((family) => family.trim().replace(/^["']|["']$/g, ""));
}

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

/** The font in a file under the static folder, as HarfBuzz reads it after a browser's WOFF decoding. */
async function faceOf(address: string): Promise<Face> {
  return new Face(new HarfBuzzBlob(await sfntOf(await Bun.file(`${staticDir}${address}`).bytes())), 0);
}

// SPEC-site, Tech Stack, and SPEC-deploy, Documents: the site serves Google Sans Flex and Google Sans Code from its own
// address. The cut font files are committed in public/fonts/, so the build copies them and downloads nothing.
describe("the site's fonts", () => {
  test("the static folder holds each committed file of public/fonts/, byte for byte: the fonts and their license", async () => {
    const committed = (await Array.fromAsync(new Glob("*").scan({ cwd: `${REPO}/public/fonts` }))).sort();
    expect(committed).toEqual(["OFL.txt", ...FONTS.map(({ address }) => address.slice("/fonts/".length))].sort());
    for (const file of committed) {
      const copy = Bun.file(`${staticDir}/fonts/${file}`);
      expect(await copy.exists()).toBe(true);
      expect(Buffer.compare(await copy.bytes(), await Bun.file(`${REPO}/public/fonts/${file}`).bytes())).toBe(0);
    }
  });

  // The design system's weights, 400 to 700, on the variable font's weight axis: its Typeface page (0.3.3) loads both
  // families at wght@400..700, and its weight tokens run from 400 to 700.
  test.each(FONTS)(
    "$address is a WOFF file of $family with one variation axis, weight, from 400 to 700",
    async ({ family, address }) => {
      const face = await faceOf(address);
      const axes = Object.values(face.getAxisInfos()).map(({ tag, min, default: start, max }) => {
        return { tag, min, start, max };
      });
      expect(axes).toEqual([{ tag: "wght", min: 400, start: 400, max: 700 }]);
      expect(face.getName(1, "en")).toBe(family);
    },
  );

  // OFL 1.1, condition 2: each copy of the font holds its copyright notice and the license. The license file beside the
  // fonts holds the notice of each family, as the OFL.txt of that family in google/fonts states it.
  test("OFL.txt holds the copyright notice of each family and the SIL Open Font License 1.1", async () => {
    const license = await Bun.file(`${staticDir}/fonts/OFL.txt`).text();
    const notices = [
      "Copyright 2015 The Google Sans Flex Authors (https://github.com/googlefonts/googlesans-flex)",
      "Copyright 2025 The Google Sans Code Project Authors (github.com/googlefonts/googlesans-code)",
    ];
    expect(notices.filter((notice) => !license.includes(notice))).toEqual([]);
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007");
  });

  // The token stylesheet names each family in its stack and holds no @font-face of its own: the page gives the family
  // its file. font-display swap is the design system's own (its Typeface page loads the families with display=swap),
  // so the text shows at once in the fallback font.
  test.each(["index.html", "resume/index.html", "404.html"])(
    "the stylesheets of %s give each token's family one @font-face: weights 400 to 700, from the site's WOFF file",
    async (page) => {
      const css = await cssOf(page);
      const stacks: Record<string, string[]> = {};
      const faces: Record<string, Record<string, string | undefined>[]> = {};
      const expectedStacks: typeof stacks = {};
      const expectedFaces: typeof faces = {};
      for (const { family, token, before, address } of FONTS) {
        const stack = stackOf(css, token);
        stacks[token] = stack.slice(0, stack.indexOf(family) + 1);
        expectedStacks[token] = [...before, family];
        faces[family] = fontFaces(css)
          .filter((face) => face["font-family"] === family)
          .map(({ src, ...descriptors }) => ({
            ...descriptors,
            // The file's address on the site, and its format. The minifier may drop the space between the two.
            src: src?.match(/^url\((.+)\)\s*format\((.+)\)$/)?.slice(1).join(" as "),
          }));
        expectedFaces[family] = [
          {
            "font-family": family,
            "font-style": "normal",
            "font-weight": "400 700",
            "font-display": "swap",
            src: `${address} as woff`,
          },
        ];
      }
      expect(stacks).toEqual(expectedStacks);
      expect(faces).toEqual(expectedFaces);
      expect(fontFaces(css)).toHaveLength(FONTS.length);
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

  // A character the font lacks would show in the fallback font, the next one in the token's stack. Any text can take
  // the mono family (labels, numbers and code), so each font covers every character the pages show.
  test.each(FONTS)("$address has a glyph for each character that the pages show", async ({ address }) => {
    const inFont = new Set((await faceOf(address)).collectUnicodes());
    const missing = new Set<string>();
    for (const page of await htmlFiles()) {
      for (const codePoint of await charactersShownBy(page)) {
        if (!inFont.has(codePoint)) missing.add(`U+${codePoint.toString(16).toUpperCase().padStart(4, "0")} in ${page}`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});

/**
 * The site's icons, as `bun run icons` renders them into public/icons/ (SPEC-site, Views: App icon), each file with the
 * size of each square image it holds: the rounded square at 192 and 512 px, the maskable version at 512 px, and the
 * favicon with the app-icon board's three small sizes.
 */
const ICONS: Record<string, number[]> = {
  "favicon.ico": [16, 32, 48],
  "icon-192.png": [192],
  "icon-512.png": [512],
  "icon-maskable-512.png": [512],
};

// SPEC-site, Views: App icon, and Testing 1. Vercel's build has no Chrome, so the icon files are committed, as the
// documents are, and the build copies them; it renders none.
describe("the site's icons", () => {
  test("the static folder holds each committed file of public/icons/, byte for byte", async () => {
    const committed = (await Array.fromAsync(new Glob("*").scan({ cwd: `${REPO}/public/icons` }))).sort();
    expect(committed).toEqual(Object.keys(ICONS));
    for (const file of committed) {
      const copy = Bun.file(`${staticDir}/icons/${file}`);
      expect(await copy.exists()).toBe(true);
      expect(Buffer.compare(await copy.bytes(), await Bun.file(`${REPO}/public/icons/${file}`).bytes())).toBe(0);
    }
  });

  test.each(Object.entries(ICONS))("icons/%s holds square images of %p px", async (file, sizes) => {
    expect(iconSizes(await Bun.file(`${staticDir}/icons/${file}`).bytes())).toEqual(sizes);
  });
});

/** The web manifest's address on the site, as SPEC-deploy's cache table names it (Headers). */
const WEB_MANIFEST = "/manifest.webmanifest";

// SPEC-site, Acceptance criteria and Testing 1: the site installs as a standalone app, named after Peter, with the PK
// icon, and its start address and scope are the site's root. buildSite() makes the web manifest from resume.yaml's
// name, so the fixture root's name shows that the manifest read that file.
describe("the web manifest", () => {
  const webManifest = () => Bun.file(`${staticDir}${WEB_MANIFEST}`).json();

  // The id is the start address, as a browser would derive it; written out, it keeps the installed app the same app
  // if the start address ever changes (https://www.w3.org/TR/appmanifest/#id-member).
  test("has the fixture root's name, id /, start_url /, scope / and display standalone", async () => {
    const { id, name, start_url, scope, display } = await webManifest();
    expect({ id, name, start_url, scope, display }).toEqual({
      id: "/",
      name: FIXTURE_NAME,
      start_url: "/",
      scope: "/",
      display: "standalone",
    });
  });

  test("lists PNG icons of 192 px, 512 px and a maskable 512 px", async () => {
    const { icons } = await webManifest();
    expect(icons.map(({ sizes, type, purpose }: Record<string, string>) => ({ sizes, type, purpose }))).toEqual([
      { sizes: "192x192", type: "image/png", purpose: undefined },
      { sizes: "512x512", type: "image/png", purpose: undefined },
      { sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });

  // A browser reads each icon from its address, resolved against the manifest's own address.
  test("each icon it lists is a committed file of public/icons/, at the size it gives", async () => {
    const { icons } = await webManifest();
    for (const { src, sizes } of icons as Record<string, string>[]) {
      const { pathname } = new URL(src!, `https://peterkloss.dev${WEB_MANIFEST}`);
      expect(pathname).toStartWith("/icons/");
      const served = await Bun.file(`${staticDir}${pathname}`).bytes();
      expect(Buffer.compare(served, await Bun.file(`${REPO}/public${pathname}`).bytes())).toBe(0);
      const { width, height } = pngSize(served);
      expect(`${width}x${height}`).toBe(sizes!);
    }
  });

  // Every page links the manifest, so the browser can offer the install from any page, and the favicon, so a tab
  // shows the PK icon. Without the link a browser asks for /favicon.ico, which is no file of the site.
  test("every HTML file, 404.html included, links the web manifest and the favicon, once each", async () => {
    const links: Record<string, { manifest: (string | null)[]; favicon: (string | null)[] }> = {};
    const expected: typeof links = {};
    for (const page of await htmlFiles()) {
      links[page] = {
        manifest: await attributeOn(page, 'link[rel="manifest"]', "href"),
        favicon: await attributeOn(page, 'link[rel="icon"]', "href"),
      };
      expected[page] = { manifest: [WEB_MANIFEST], favicon: ["/icons/favicon.ico"] };
    }
    expect(links).toEqual(expected);
  });
});

describe("the sitemap", () => {
  // A crawled /?source= or /?role= link would otherwise be listed here (SPEC-site, Tech Stack). Each source page links
  // /?source=<id>, so the crawler finds such a link.
  test("lists /, /resume and each approved source's page on peterkloss.dev, and no address with a query", async () => {
    expect(await sitemapAddresses()).toEqual([
      "https://peterkloss.dev/",
      "https://peterkloss.dev/resume",
      `https://peterkloss.dev/sources/${FIXTURE_DEEP_DIVE}`,
      `https://peterkloss.dev/sources/${FIXTURE_INTERVIEW}`,
    ]);
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

/**
 * A file's content as the private-detail scan reads it, by the rule of the push guard
 * (.agents/skills/release/scripts/private-detail-check.ts): a NUL byte in the first 8,000 bytes makes a file binary
 * (Git's own rule), and each byte of a binary file is one character, so the ASCII text inside it, such as a PNG's text
 * chunk, stays readable. Read as UTF-8, a binary file's stray bytes would become U+FFFD, which holds() takes as a
 * separator between two digits. Any other file is UTF-8 text.
 */
function scannedText(bytes: Uint8Array): string {
  return bytes.subarray(0, 8000).includes(0) ? Buffer.from(bytes).toString("latin1") : new TextDecoder().decode(bytes);
}

describe("private details", () => {
  // holds() also finds the number in any other format (src/private-details.ts). The failure names files only.
  test("no file under the output holds the fixture root's phone number", async () => {
    const leaks: string[] = [];
    for await (const path of new Glob("**/*").scan({ cwd: outDir, dot: true })) {
      if (holds(scannedText(await Bun.file(`${outDir}/${path}`).bytes()), FAKE_PHONE)) leaks.push(path);
    }
    expect(leaks).toEqual([]);
  });
});

/** The text of each inline script of a page (a script element with no src attribute), in page order, as written. */
async function inlineScriptsOf(page: string): Promise<string[]> {
  const scripts: string[] = [];
  new HTMLRewriter()
    .on("script:not([src])", {
      element: () => void scripts.push(""),
      // A script's text arrives in chunks after its start tag, so each chunk belongs to the last script.
      text: (chunk) => void (scripts[scripts.length - 1] += chunk.text),
    })
    .transform(await Bun.file(`${staticDir}/${page}`).text());
  return scripts;
}

/**
 * The hash source that allows an inline script, as the browser computes it: SHA-256 over the script's text in UTF-8,
 * in base64 (https://www.w3.org/TR/CSP3/#match-element-to-source-list). The browser hashes the text its parser read,
 * in which CR LF and a lone CR are LF
 * (https://html.spec.whatwg.org/multipage/parsing.html#preprocessing-the-input-stream).
 */
async function hashSourceOf(script: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(script.replace(/\r\n?/g, "\n")));
  return `'sha256-${Buffer.from(digest).toString("base64")}'`;
}

/** A page's policy tags, by the http-equiv value that the browser matches without regard to case. */
const POLICY_TAG = 'meta[http-equiv="Content-Security-Policy" i]';

/** The content of a policy tag: SPEC-deploy's form, `default-src 'self'; script-src 'self'` and then the hashes. */
const POLICY_TAG_CONTENT = /^default-src 'self'; script-src 'self'((?: 'sha256-[A-Za-z0-9+/]+={0,2}')*)$/;

/** The hash sources that a page's first policy tag allows, sorted, or what keeps the tag from listing any. */
async function hashesAllowedBy(page: string): Promise<string[] | string> {
  const [content] = await attributeOn(page, POLICY_TAG, "content");
  if (content === undefined) return "no policy tag";
  const hashes = POLICY_TAG_CONTENT.exec(content ?? "")?.[1];
  if (hashes === undefined) return `not SPEC-deploy's form: ${content}`;
  return hashes.split(" ").filter(Boolean).sort();
}

describe("the Content Security Policy", () => {
  // SPEC-deploy, Headers: a policy tag protects only what comes after it, and the browser enforces it only inside
  // <head>. So each page's tag is the first element in its <head>, and it is the page's only one: the browser enforces
  // every policy it finds, and a second tag without the page's hashes would block its scripts.
  test("each HTML file, 404.html included, opens its <head> with its one policy tag", async () => {
    const opening: Record<string, { first: string[]; policyTags: number }> = {};
    const expected: typeof opening = {};
    for (const page of await htmlFiles()) {
      const tags = (await elementsOn(page, "*")).map((element) => element.tag);
      const httpEquiv = (await attributeOn(page, "*", "http-equiv")).map((value) => value?.toLowerCase());
      opening[page] = {
        first: tags.slice(0, 3).map((tag, i) => (httpEquiv[i] ? `${tag} http-equiv=${httpEquiv[i]}` : tag)),
        policyTags: (await attributeOn(page, POLICY_TAG, "content")).length,
      };
      expected[page] = { first: ["html", "head", "meta http-equiv=content-security-policy"], policyTags: 1 };
    }
    expect(opening).toEqual(expected);
  });

  // SPEC-site, Acceptance criteria and Testing 1: the tag lists exactly the hashes of the page's own inline scripts,
  // each once. A missing hash blocks a script; an extra one allows a script the page does not hold. A page with no
  // inline script, such as 404.html, gets `script-src 'self'` alone.
  test("each policy tag allows by hash exactly its own page's inline scripts, each hash once", async () => {
    const allowed: Record<string, string[] | string> = {};
    const expected: Record<string, string[]> = {};
    for (const page of await htmlFiles()) {
      allowed[page] = await hashesAllowedBy(page);
      expected[page] = [...new Set(await Promise.all((await inlineScriptsOf(page)).map(hashSourceOf)))].sort();
    }
    expect(allowed).toEqual(expected);
    // The pages hold TanStack Start's inline scripts, so the check above compares real hashes.
    expect(Object.values(expected).flat().length).toBeGreaterThan(0);
  });

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
