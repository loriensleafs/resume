// Seam 3 of SPEC-content: the committed public documents in documents/, which the website
// serves because Vercel's build has no Chrome (SPEC-deploy, Documents), and the command
// that writes them.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { docxText, normalize, pdfText } from "../../src/__tests__/helpers/document-text";
import { BASENAME } from "../../src/build";
import { holds, isMadeUpNumber, loadPrivateValues } from "../../src/private-details";
import { LOCKED_PACKAGES, changedInputs, committedInputsHash, inputFiles, inputsHash, updateDocuments } from "../documents";

const REPO = Bun.fileURLToPath(new URL("../../", import.meta.url));
const COMMITTED = `${REPO}documents`;
const TXT = `${BASENAME}.txt`;
const PDF = `${BASENAME}.pdf`;
const DOCX = `${BASENAME}.docx`;

// The private details no committed document may hold, read by the one rule (src/private-details.ts). CI and a
// fresh clone have no private.yaml, and a made-up number leaves nothing private: then the check skips. A broken
// private.yaml is no reason to skip: the check runs and fails with the reason. test.skipIf needs the answer when
// the test is registered, so it is read here, at the top of the file.
const PRIVATE = await loadPrivateValues(REPO);
const PRIVATE_VALUES = PRIVATE.ok ? PRIVATE.values.filter((value) => !isMadeUpNumber(value)) : [];
const NOTHING_PRIVATE = PRIVATE.ok ? PRIVATE_VALUES.length === 0 : PRIVATE.missing;

// One fresh public build, made by `bun run documents` in an empty temporary folder. The committed
// documents are compared with it, and the command's own tests start from it.
const tmp = `${Bun.env.TMPDIR ?? "/tmp"}/resume-documents-test-${crypto.randomUUID()}`;
const built = `${tmp}/built`;

beforeAll(async () => {
  await updateDocuments(built);
}, 60_000);

afterAll(async () => {
  await $`rm -rf ${tmp}`.quiet().nothrow();
});

// Chrome stamps the date into the PDF and docx into the Word file, so a fresh build matches the committed
// documents in their text only. Each document's text is read the way hiring software reads it.
const textFileText = async (txt: string) => normalize(await Bun.file(txt).text());
const TEXT_OF: Record<string, (path: string) => Promise<string>> = {
  [TXT]: textFileText,
  [PDF]: pdfText,
  [DOCX]: docxText,
};

/**
 * Where a committed text first differs from a fresh build's text, with all whitespace ignored, so a line that
 * breaks elsewhere, even after a hyphen, still matches. It gives the number of the fresh build's word there and
 * that word, and never committed text, which could hold a private detail. Null when the texts match.
 */
function firstDifference(committed: string, fresh: string): { wordNumber: number; freshWord: string } | null {
  const [a, b] = [committed.replace(/\s+/g, ""), fresh.replace(/\s+/g, "")];
  if (a === b) return null;
  let at = 0;
  while (at < Math.max(a.length, b.length) && a[at] === b[at]) at++;
  const words = fresh.split(/\s+/).filter(Boolean);
  let length = 0;
  for (const [i, word] of words.entries()) {
    length += word.length;
    if (length > at) return { wordNumber: i + 1, freshWord: word };
  }
  return { wordNumber: words.length + 1, freshWord: "(the fresh text ends here)" };
}

/**
 * Each part of a committed document that a reader or a program can see, by name: the PDF's text, metadata,
 * links and raw bytes; each part of the Word file's package, its relationships included; the text file.
 * pdfinfo decodes the metadata and the links, which the file may hold as hex or UTF-16 strings; the raw bytes
 * show every other plain string, such as alt text.
 */
async function partsOf(name: string): Promise<[part: string, text: string][]> {
  const path = `${COMMITTED}/${name}`;
  if (name === PDF) {
    return [
      ["text", await pdfText(path)],
      ["metadata", (await $`pdfinfo ${path}`.text()) + (await $`pdfinfo -meta ${path}`.text())],
      ["links", await $`pdfinfo -url ${path}`.text()],
      ["raw bytes", new TextDecoder("latin1").decode(await Bun.file(path).bytes())],
    ];
  }
  if (name === DOCX) {
    const dir = `${tmp}/parts-of-${name}`;
    await $`unzip -q -o ${path} -d ${dir}`;
    const parts = (await Array.fromAsync(new Bun.Glob("**").scan({ cwd: dir, dot: true, onlyFiles: true }))).sort();
    return Promise.all(parts.map(async (part) => [part, await Bun.file(`${dir}/${part}`).text()] as [string, string]));
  }
  return [["text", await Bun.file(path).text()]];
}

// Every file the document build reaches from scripts/documents.ts, with the packages it imports.
// It follows each import with Bun's own resolver, and each `new URL("./…", import.meta.url)`, the
// way the print template reads its CSS and script. Files the build reads by a path it builds
// (resume.yaml, fonts/) are not imports; the input list names them by hand.
async function reachedFromDocumentsScript(): Promise<{ files: string[]; packages: string[] }> {
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [Bun.resolveSync("./scripts/documents.ts", REPO)];
  for (let file = queue.pop(); file; file = queue.pop()) {
    if (files.has(file)) continue;
    files.add(file);
    const dir = file.slice(0, file.lastIndexOf("/"));
    const code = await Bun.file(file).text();
    for (const { path } of transpiler.scanImports(code)) {
      if (path.startsWith(".")) queue.push(Bun.resolveSync(path, dir));
      else if (path !== "bun" && !path.startsWith("bun:") && !path.startsWith("node:")) {
        packages.add(path.split("/").slice(0, path.startsWith("@") ? 2 : 1).join("/"));
      }
    }
    for (const [, asset] of code.matchAll(/new URL\(\s*["'](\.\.?\/[^"']+)["']\s*,\s*import\.meta\.url\s*\)/g)) {
      files.add(Bun.resolveSync(asset!, dir));
    }
  }
  return { files: [...files].map((file) => file.slice(REPO.length)).sort(), packages: [...packages].sort() };
}

describe("the inputs hash", () => {
  test("covers every file and package the document build reaches", async () => {
    const reached = await reachedFromDocumentsScript();
    const inputs = new Set(await inputFiles());
    expect(
      reached.files.filter((file) => !inputs.has(file)),
      "The document build reads these files, but the inputs hash does not cover them. Add them to INPUT_FILES in scripts/documents.ts.",
    ).toEqual([]);
    expect(
      reached.packages.filter((name) => !LOCKED_PACKAGES.includes(name)),
      "The document build imports these packages, but the inputs hash does not cover them. Add them to LOCKED_PACKAGES in scripts/documents.ts.",
    ).toEqual([]);
  });
});

describe("the committed documents", () => {
  test("were built from the current inputs", async () => {
    expect(
      changedInputs(await committedInputsHash(), await inputsHash()),
      "documents/ is out of date: the inputs below changed since the last build. Run `bun run documents` and commit documents/ with the change.",
    ).toEqual([]);
  });

  test(`documents/${PDF} is US Letter, exactly 2 pages, and tagged`, async () => {
    const info = await $`pdfinfo ${COMMITTED}/${PDF}`.text();
    const field = (name: string) => info.match(new RegExp(`^${name}:\\s+(.+)$`, "m"))?.[1];
    expect({ pages: field("Pages"), size: field("Page size"), tagged: field("Tagged") }).toEqual({
      pages: "2",
      size: expect.stringMatching(/^612 x 792 pts/),
      tagged: "yes",
    });
  });

  test(`documents/${PDF} embeds every font as CID TrueType with a Unicode map`, async () => {
    const fonts = (await $`pdffonts ${COMMITTED}/${PDF}`.text()).trim().split("\n").slice(2);
    expect(fonts.length).toBeGreaterThan(0);
    expect(
      fonts.filter((row) => !/CID TrueType\s+Identity-H\s+yes\s+yes\s+yes/.test(row)),
      `These fonts in documents/${PDF} are not embedded as CID TrueType with a Unicode map.`,
    ).toEqual([]);
  });

  for (const [name, textOf] of Object.entries(TEXT_OF)) {
    test(`documents/${name} has the text of a fresh build`, async () => {
      expect(
        firstDifference(await textOf(`${COMMITTED}/${name}`), await textOf(`${built}/${name}`)),
        `documents/${name} does not hold the text that a fresh build writes; below is the fresh build's word where they first differ. If the file was edited by hand, delete it and run \`bun run documents\`, which rebuilds a missing document.`,
      ).toBeNull();
    });
  }

  // The failure names each document and part, never the value (src/private-details.ts).
  test.skipIf(NOTHING_PRIVATE)("hold no private detail in any part a reader or a program can see", async () => {
    expect(PRIVATE.ok ? "" : PRIVATE.reason).toBe("");
    const holding: string[] = [];
    for (const name of [TXT, PDF, DOCX]) {
      for (const [part, text] of await partsOf(name)) {
        if (PRIVATE_VALUES.some((value) => holds(text, value))) holding.push(`documents/${name}: ${part}`);
      }
    }
    expect(holding, "These parts of the committed documents hold a private detail from private.yaml.").toEqual([]);
  });
});

// The comparison behind "has the text of a fresh build", on texts written here. The made-up number is in
// NANPA's range for fiction (src/private-details.ts).
describe("the text comparison", () => {
  test("ignores where lines break, a break after a hyphen included", () => {
    expect(firstDifference("Front-\nEnd   platform\tengineer", "Front-End platform engineer")).toBeNull();
  });

  test("finds a changed word, and gives the fresh build's word", () => {
    expect(firstDifference("design systems, shared libraries and", "design systems, shared packages and")).toEqual({
      wordNumber: 4,
      freshWord: "packages",
    });
  });

  test("finds a dropped word", () => {
    expect(firstDifference("led the MCP server", "led the organization-wide MCP server")).toEqual({
      wordNumber: 3,
      freshWord: "organization-wide",
    });
  });

  test("finds reordered words", () => {
    expect(firstDifference("Skills Education", "Education Skills")).toEqual({ wordNumber: 1, freshWord: "Education" });
  });

  test("finds text that the fresh build does not have", () => {
    expect(firstDifference("one two three", "one two")).toEqual({
      wordNumber: 3,
      freshWord: "(the fresh text ends here)",
    });
  });

  test("never gives committed text, so a committed private detail is not printed", () => {
    const difference = firstDifference(
      "Redmond, WA | (206) 555-0123 | pkloss@gmail.com",
      "Redmond, WA | pkloss@gmail.com",
    );
    expect(difference).toEqual({ wordNumber: 4, freshWord: "pkloss@gmail.com" });
    expect(JSON.stringify(difference)).not.toContain("555");
  });
});

describe("bun run documents", () => {
  const files = ["Peter-Kloss-Resume.pdf", "Peter-Kloss-Resume.docx", "Peter-Kloss-Resume.txt", "inputs.sha256"];

  // Each test changes its own copy of the folder the first run wrote.
  const copyOfBuilt = async (name: string) => {
    await $`cp -R ${built} ${tmp}/${name}`;
    return `${tmp}/${name}`;
  };
  const writeTimes = (dir: string) => Promise.all(files.map(async (f) => [f, Bun.file(`${dir}/${f}`).lastModified]));

  test("writes the public documents and the inputs hash into an empty folder", async () => {
    for (const f of files) expect({ f, exists: await Bun.file(`${built}/${f}`).exists() }).toEqual({ f, exists: true });
    expect(await committedInputsHash(built)).toBe(await inputsHash());
  });

  test("writes nothing on a second run with the same inputs", async () => {
    const dir = await copyOfBuilt("second-run");
    const before = await writeTimes(dir);
    await updateDocuments(dir);
    expect(await writeTimes(dir)).toEqual(before);
  });

  test("rebuilds a missing document although no input changed", async () => {
    const dir = await copyOfBuilt("missing");
    await $`rm ${dir}/Peter-Kloss-Resume.txt`;
    await updateDocuments(dir);
    expect(await Bun.file(`${dir}/Peter-Kloss-Resume.txt`).text()).toBe(
      await Bun.file(`${built}/Peter-Kloss-Resume.txt`).text(),
    );
  }, 60_000);
});
