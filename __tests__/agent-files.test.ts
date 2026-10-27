// Seam 1 of SPEC-agents: the agent files on disk.

import { describe, expect, test } from "bun:test";

const REPO = `${import.meta.dir}/..`;
const read = (path: string) => Bun.file(`${REPO}/${path}`).text();
// Bun.file().exists() is false for a folder; stat() sees both.
const exists = (path: string) => Bun.file(path).stat().then(() => true, () => false);

// The first cell of each body row in the first table at or after the line that starts with `from`.
function firstColumn(markdown: string, from: string): string[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.startsWith(from));
  const top = lines.findIndex((line, i) => start >= 0 && i >= start && line.startsWith("|"));
  if (top < 0) return [];
  const end = lines.findIndex((line, i) => i > top && !line.startsWith("|"));
  return lines.slice(top + 2, end < 0 ? undefined : end).map((row) => row.split("|")[1]!.trim());
}

describe("the agent files", () => {
  test("CLAUDE.md starts with the AGENTS.md import", async () => {
    expect((await read("CLAUDE.md")).split("\n")[0]).toBe("@AGENTS.md");
  });

  test("AGENTS.md has 120 lines or fewer", async () => {
    expect((await read("AGENTS.md")).trimEnd().split("\n").length).toBeLessThanOrEqual(120);
  });

  test("the Modules table has one row for each module in the capability map", async () => {
    const map = firstColumn(await read("spec/README.md"), "| Module id");
    expect(map).toContain("content"); // control: the capability map parsed
    expect(firstColumn(await read("AGENTS.md"), "## Modules")).toEqual(map);
  });

  test("every relative link resolves", async () => {
    const broken: string[] = [];
    for (const path of ["AGENTS.md", "CLAUDE.md"]) {
      const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".";
      for (const [, target] of (await read(path)).matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^[a-z]+:/.test(target!) || target!.startsWith("#")) continue;
        if (!(await exists(`${REPO}/${dir}/${target!.split("#")[0]}`))) broken.push(`${path} -> ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
