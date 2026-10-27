// Seam 3 of SPEC-content: the committed public documents in documents/, which the website
// serves because Vercel's build has no Chrome (SPEC-deploy, Documents).

import { describe, expect, test } from "bun:test";
import { changedInputs, committedManifest, inputsManifest } from "../documents";

describe("the committed documents", () => {
  test("were built from the current inputs", async () => {
    expect(
      changedInputs(await committedManifest(), await inputsManifest()),
      "documents/ is out of date: the inputs below changed since the last build. Run `bun run documents` and commit documents/ with the change.",
    ).toEqual([]);
  });
});
