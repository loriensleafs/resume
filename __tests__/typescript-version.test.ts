// The type check's two TypeScripts agree (research 13, "Risks", version drift). `bun check` reports the errors of
// the TypeScript built into Bun, and an editor runs the `typescript` package. A Bun upgrade can move the first one
// alone, so this test fails until package.json pins the same version again.

import { expect, test } from "bun:test";

test("Bun's TypeScript equals the typescript version that package.json pins", async () => {
  const { devDependencies } = await Bun.file(`${import.meta.dir}/../package.json`).json();
  expect(process.versions.typescript).toBe(devDependencies?.typescript);
});
