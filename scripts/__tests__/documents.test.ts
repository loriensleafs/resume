// Seam 3 of SPEC-content: the committed public documents in documents/, which the website
// serves because Vercel's build has no Chrome (SPEC-deploy, Documents), and the command
// that writes them.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { changedInputs, committedInputsHash, inputsHash, updateDocuments } from "../documents";

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
