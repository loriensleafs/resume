// Seam 3 of SPEC-content: the committed public documents in documents/, which the website
// serves because Vercel's build has no Chrome (SPEC-deploy, Documents), and the command
// that writes them.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { BASENAME } from "../../src/build";
import { loadResume } from "../../src/content";
import { LOCKED_PACKAGES, changedInputs, committedInputsHash, inputFiles, inputsHash, updateDocuments } from "../documents";

const REPO = Bun.fileURLToPath(new URL("../../", import.meta.url));
const COMMITTED = `${REPO}documents`;
const PDF = `${BASENAME}.pdf`;

// The phone number as the private build prints it. CI and fresh clones have no private.yaml,
// so they have no phone number to look for, and the check on it skips.
const phone = (await Bun.file(`${REPO}private.yaml`).exists())
  ? (await loadResume("private", REPO)).basics.phone
  : undefined;

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

// The text of each document, read the way hiring software reads it, with spacing ignored: Chrome
// stamps the date into the PDF and docx into the Word file, so only the text can match a fresh
// build. These helpers stay in this file, because a helper outside a test file is a site file.
const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
const TEXT_OF: Record<string, (path: string) => Promise<string>> = {
  [`${BASENAME}.txt`]: async (txt) => normalize(await Bun.file(txt).text()),
  [PDF]: async (pdf) => normalize(await $`pdftotext -raw ${pdf} -`.text()),
  [`${BASENAME}.docx`]: async (docx) => {
    const xml = await $`unzip -p ${docx} word/document.xml`.text();
    const runs = [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]!);
    return normalize(
      runs
        .join(" ")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"')
        .replaceAll("&apos;", "'")
        .replaceAll("&amp;", "&"),
    );
  },
};

/** The first word where two texts differ, with the words around it; null when the texts are equal. */
function firstDifference(committed: string, fresh: string) {
  if (committed === fresh) return null;
  const [a, b] = [committed.split(" "), fresh.split(" ")];
  let i = 0;
  while (i < Math.max(a.length, b.length) && a[i] === b[i]) i++;
  const around = (words: string[]) => words.slice(Math.max(0, i - 6), i + 6).join(" ");
  return { word: i + 1, committed: around(a), fresh: around(b) };
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
        `documents/${name} does not hold the text that a fresh build writes. If it was edited by hand, delete it and run \`bun run documents\`, which rebuilds a missing document.`,
      ).toBeNull();
    });
  }

  test.skipIf(!phone)("hold no phone number from private.yaml in their extracted text", async () => {
    const holding: string[] = [];
    for (const [name, textOf] of Object.entries(TEXT_OF)) {
      if ((await textOf(`${COMMITTED}/${name}`)).includes(normalize(phone!))) holding.push(`documents/${name}`);
    }
    expect(holding, "These committed documents hold the phone number from private.yaml.").toEqual([]);
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
