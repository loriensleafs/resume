// Seam 1 of SPEC-agents: the agent files on disk.

import { describe, expect, test } from "bun:test";
import { $ } from "bun";

const REPO = `${import.meta.dir}/..`;
const SKILLS = `${REPO}/.agents/skills`;
const LINKS = `${REPO}/.claude/skills`;
const read = (path: string) => Bun.file(`${REPO}/${path}`).text();
// Bun.file().exists() is false for a folder; stat() sees both.
const exists = (path: string) => Bun.file(path).stat().then(() => true, () => false);
const list = (cwd: string) => [...new Bun.Glob("*").scanSync({ cwd, onlyFiles: false })].sort();

// The first cell of each body row in the first table at or after the line that starts with `from`.
function firstColumn(markdown: string, from: string): string[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.startsWith(from));
  const top = lines.findIndex((line, i) => start >= 0 && i >= start && line.startsWith("|"));
  if (top < 0) return [];
  const end = lines.findIndex((line, i) => i > top && !line.startsWith("|"));
  return lines.slice(top + 2, end < 0 ? undefined : end).map((row) => row.split("|")[1]!.trim());
}

async function frontMatter(path: string): Promise<{ name?: unknown; description?: unknown }> {
  const text = await read(path);
  const end = text.indexOf("\n---\n");
  if (!text.startsWith("---\n") || end < 0) throw new Error(`${path} has no front matter`);
  return Bun.YAML.parse(text.slice(4, end)) ?? {};
}

// The fenced JSON block that follows the line `label` in a Markdown file.
function jsonBlockAfter(markdown: string, label: string) {
  const lines = markdown.split("\n");
  const at = lines.indexOf(label);
  const open = lines.findIndex((line, i) => at >= 0 && i > at && line === "```json");
  const close = lines.findIndex((line, i) => open >= 0 && i > open && line === "```");
  if (close < 0) throw new Error(`no JSON block after the line ${label}`);
  return JSON.parse(lines.slice(open + 1, close).join("\n"));
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
    const files = ["AGENTS.md", "CLAUDE.md", ...list(SKILLS).map((name) => `.agents/skills/${name}/SKILL.md`)];
    const broken: string[] = [];
    for (const path of files) {
      const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".";
      for (const [, target] of (await read(path)).matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^[a-z]+:/.test(target!) || target!.startsWith("#")) continue;
        if (!(await exists(`${REPO}/${dir}/${target!.split("#")[0]}`))) broken.push(`${path} -> ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe("the repo skills", () => {
  test(".claude/skills holds one entry for each repo skill and nothing else", () => {
    expect(list(SKILLS)).toContain("edit-resume"); // control: the skills folder was read
    expect(list(LINKS)).toEqual(list(SKILLS));
  });

  describe.each(list(SKILLS))("%s", (name) => {
    const path = `.agents/skills/${name}/SKILL.md`;

    test("its front matter names the folder, in kebab-case, in 64 characters or fewer", async () => {
      expect((await frontMatter(path)).name).toBe(name);
      expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(name.length).toBeLessThanOrEqual(64);
    });

    test("its description has 1 to 1,024 characters", async () => {
      const { description } = await frontMatter(path);
      expect(typeof description).toBe("string");
      expect((description as string).trim().length).toBeGreaterThan(0);
      expect((description as string).length).toBeLessThanOrEqual(1024);
    });

    test("its .claude/skills entry is a link that resolves to it", async () => {
      expect((await $`readlink ${LINKS}/${name}`.nothrow().text()).trim()).toBe(`../../.agents/skills/${name}`);
      expect(await exists(`${LINKS}/${name}/SKILL.md`)).toBe(true);
    });
  });
});

// SPEC-agents, Settings: every agent's project settings start the docs server the same way.
const DOCS_SERVER = "acme-design-system";
type ServerEntry = { command?: unknown; args?: unknown } | undefined;
type CodexConfig = { mcp_servers?: Record<string, ServerEntry> };
const docsServerEntries: [string, () => Promise<ServerEntry>][] = [
  [".codex/config.toml", async () => (Bun.TOML.parse(await read(".codex/config.toml")) as CodexConfig).mcp_servers?.[DOCS_SERVER]],
  [".cursor/mcp.json", async () => JSON.parse(await read(".cursor/mcp.json")).mcpServers?.[DOCS_SERVER]],
  [".vscode/mcp.json", async () => JSON.parse(await read(".vscode/mcp.json")).servers?.[DOCS_SERVER]],
  [".gemini/settings.json", async () => JSON.parse(await read(".gemini/settings.json")).mcpServers?.[DOCS_SERVER]],
  ["README's .mcp.json block", async () => jsonBlockAfter(await read("README.md"), "`.mcp.json`").mcpServers?.[DOCS_SERVER]],
];

describe("the docs server settings", () => {
  test.each(docsServerEntries)("%s starts acme-design-system with bun run --silent design-system-mcp", async (_, serverEntry) => {
    const entry = await serverEntry();
    expect({ command: entry?.command, args: entry?.args }).toEqual({
      command: "bun",
      args: ["run", "--silent", "design-system-mcp"],
    });
  });

  test("package.json has the design-system-mcp script", async () => {
    const { scripts } = JSON.parse(await read("package.json"));
    expect(typeof scripts?.["design-system-mcp"]).toBe("string");
  });
});

describe("Gemini CLI's settings", () => {
  test(".gemini/settings.json names AGENTS.md as a context file", async () => {
    const { context } = JSON.parse(await read(".gemini/settings.json"));
    // context.fileName is a string or a list of strings: https://geminicli.com/docs/reference/configuration/#context
    expect([context?.fileName].flat()).toContain("AGENTS.md");
  });
});
