// Seam 3 of SPEC-content: the committed public documents in documents/, which the website
// serves because Vercel's build has no Chrome (SPEC-deploy, Documents), and the command
// that writes them.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { LOCKED_PACKAGES, changedInputs, committedInputsHash, inputFiles, inputsHash, updateDocuments } from "../documents";

const REPO = Bun.fileURLToPath(new URL("../../", import.meta.url));

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
});

describe("bun run documents", () => {
  const tmp = `${Bun.env.TMPDIR ?? "/tmp"}/resume-documents-test-${crypto.randomUUID()}`;
  const built = `${tmp}/built`;
  const files = ["Peter-Kloss-Resume.pdf", "Peter-Kloss-Resume.docx", "Peter-Kloss-Resume.txt", "inputs.sha256"];

  beforeAll(async () => {
    await updateDocuments(built);
  }, 60_000);

  afterAll(async () => {
    await $`rm -rf ${tmp}`.quiet().nothrow();
  });

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
