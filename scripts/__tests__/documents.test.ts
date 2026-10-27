// Seam 3 of SPEC-content: the committed public documents in documents/, which the website
// serves because Vercel's build has no Chrome (SPEC-deploy, Documents).

import { describe, expect, test } from "bun:test";
import { inputsHash } from "../documents";

const REPO = `${import.meta.dir}/../..`;

describe("the committed documents", () => {
  test("were built from the current inputs", async () => {
    const file = Bun.file(`${REPO}/documents/inputs.sha256`);
    const committed = (await file.exists()) ? (await file.text()).trim() : "(no documents/inputs.sha256)";
    expect(
      committed,
      "documents/ is out of date: its inputs changed since the last build. Run `bun run documents` and commit documents/ with the change.",
    ).toBe(await inputsHash());
  });
});
