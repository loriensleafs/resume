// Seam 1 of SPEC-agents: the agent files on disk. A failure names the file, the line and the rule it breaks, and
// never quotes the file: CI prints failures in a public log, and a file could hold a private detail.

import { describe, expect, test } from "bun:test";
import { $ } from "bun";
import { findPhoneNumbers } from "../src/private-details";

const REPO = `${import.meta.dir}/..`;
const SKILLS = `${REPO}/.agents/skills`;
const LINKS = `${REPO}/.claude/skills`;
const read = (path: string) => Bun.file(`${REPO}/${path}`).text();
// Bun.file().exists() is false for a folder; stat() sees both.
const exists = (path: string) => Bun.file(path).stat().then(() => true, () => false);
const list = (cwd: string) => [...new Bun.Glob("*").scanSync({ cwd, onlyFiles: false })].sort();

/**
 * The text of every file that git tracks or would track once added, so a new file is checked before its commit.
 * Ignored files, such as private.yaml and node_modules/, stay out, and so do folders, links to folders such as
 * .claude/skills/<name>, and binary files (git's own test: a NUL byte in the first 8,000 bytes).
 */
async function textFiles(): Promise<Map<string, string>> {
  const paths = (await $`git -C ${REPO} ls-files -z --cached --others --exclude-standard`.text()).split("\0").filter(Boolean);
  const texts = new Map<string, string>();
  for (const path of [...new Set(paths)].sort()) {
    const file = Bun.file(`${REPO}/${path}`);
    if (!(await file.stat().then((stat) => stat.isFile(), () => false))) continue;
    const bytes = await file.bytes();
    if (!bytes.subarray(0, 8000).includes(0)) texts.set(path, new TextDecoder().decode(bytes));
  }
  return texts;
}
const TEXT_FILES = await textFiles();

// The agent files (CONTEXT.md): the shared instructions, Claude Code's entry file, the README, brain's record layout
// in docs/agents/, every file of every repo skill, and each agent's settings. The test only reads Peter's .mcp.json
// and .claude/settings.json.
const AGENT_SETTINGS = [".claude/settings.json", ".codex/config.toml", ".cursor/mcp.json", ".vscode/mcp.json", ".gemini/settings.json", ".mcp.json"];
const isAgentFile = (path: string) =>
  ["AGENTS.md", "CLAUDE.md", "README.md", ...AGENT_SETTINGS].includes(path) ||
  path.startsWith("docs/agents/") ||
  path.startsWith(".agents/skills/");
const AGENT_FILES = [...TEXT_FILES.keys()].filter(isAgentFile);

// The lines, from 1, of `text` where `breaks` is true.
const linesWhere = (text: string, breaks: (line: string) => boolean) =>
  text.split("\n").flatMap((line, i) => (breaks(line) ? [i + 1] : []));

/** `path:line breaks "rule"` for each line that `brokenLines` gives for each file. It never quotes the file. */
async function findings(paths: string[], rule: string, brokenLines: (text: string, path: string) => number[] | Promise<number[]>) {
  const found: string[] = [];
  for (const path of paths) {
    for (const line of await brokenLines(TEXT_FILES.get(path)!, path)) found.push(`${path}:${line} breaks "${rule}"`);
  }
  return found;
}

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
  if (at < 0) throw new Error(`no line ${label}`);
  const open = lines.findIndex((line, i) => i > at && line === "```json");
  const close = lines.findIndex((line, i) => open >= 0 && i > open && line === "```");
  if (close < 0) throw new Error(`no JSON block after the line ${label}`);
  return JSON.parse(lines.slice(open + 1, close).join("\n"));
}

const LINK_RULE = "a relative link points to a file or folder that exists";
/** The lines of a Markdown file in `dir` with a relative link whose target does not exist; `#section` is ignored. */
async function brokenLinkLines(text: string, dir: string): Promise<number[]> {
  const lines: number[] = [];
  for (const [i, line] of text.split("\n").entries()) {
    // A Markdown link's target: the text between "](" and ")".
    for (const [, target] of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      // A target with a scheme, such as https: or mailto:, or only a #section, is no relative link.
      if (/^[a-z]+:/.test(target!) || target!.startsWith("#")) continue;
      if (!(await exists(`${REPO}/${dir}/${target!.split("#")[0]}`))) lines.push(i + 1);
    }
  }
  return [...new Set(lines)];
}

const SCRIPT_RULE = "every bun run names a script in package.json or in a spec's Commands section";
/** The script that each `bun run` in `text` names. A `bun run` of a file path, such as `export.ts`, names none. */
function scriptsNamed(text: string): string[] {
  const scripts: string[] = [];
  // "bun run", any flags (words that start with a hyphen), then the script: the first word that does not.
  for (const [, word] of text.matchAll(/\bbun run(?:[ \t]+-[^\s`]*)*[ \t]+([^\s`-][^\s`]*)/g)) {
    const script = word!.replace(/[.,;:)]+$/, ""); // the punctuation of the sentence around it
    const isFilePath = script.includes("/") || /\.[cm]?[jt]sx?$/.test(script); // a folder, or a JavaScript or TypeScript file
    if (script && !isFilePath) scripts.push(script);
  }
  return scripts;
}

/** The scripts in package.json, and those that a spec's Commands section names before its module builds them. */
function knownScripts(): Set<string> {
  const known = new Set(Object.keys(JSON.parse(TEXT_FILES.get("package.json")!).scripts ?? {}));
  for (const [path, text] of TEXT_FILES) {
    if (!/^spec\/[^/]+\.md$/.test(path)) continue; // a spec: a Markdown file directly in spec/
    const start = text.indexOf("\n## Commands\n");
    if (start < 0) continue;
    const end = text.indexOf("\n## ", start + 1);
    for (const script of scriptsNamed(text.slice(start, end < 0 ? undefined : end))) known.add(script);
  }
  return known;
}

const PHONE_RULE = "no phone number, except the made-up 555-0100 to 555-0199";

const HIGHSPOT_RULE = "no link to a Highspot address (decision 0024)";
// A link to a Highspot address. A pattern cannot tell Highspot's public pages from its internal ones, and no file
// needs either. Only the host decides, so this project's own pages and slugs, such as a source page named after a
// Highspot deep dive, pass. Every repeat has a bound, so a line of any length costs linear time.
const HIGHSPOT_ADDRESSES = [
  // A URL, with a scheme or protocol-relative ("//"), whose host names highspot.
  /(?<![\w+.-])(?:[a-z][\w+.-]{0,30}:)?\/\/[^\s/?#)\]>"'`]{0,253}highspot/i,
  // A host name or an email domain with a highspot label, such as a subdomain or an email address there. It starts
  // after a space, an @, a bracket, a quote, an = or "//", never after a single "/", which starts a path.
  /(?<=(?:^|[\s@(<[{"'`=]|\/\/)(?:[\w-]{1,63}\.){0,10})highspot\.[a-z]/i,
  // Highspot's GitHub organization.
  /github\.com\/highspot(?![\w-])/i,
];
const holdsHighspotAddress = (line: string) =>
  line.toLowerCase().includes("highspot") && HIGHSPOT_ADDRESSES.some((address) => address.test(line));

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

  test("the checks read every kind of agent file", () => {
    const kinds = ["AGENTS.md", "CLAUDE.md", "README.md", "docs/agents/domain.md", ".agents/skills/release/SKILL.md", ...AGENT_SETTINGS];
    expect(AGENT_FILES).toEqual(expect.arrayContaining(kinds));
  });

  test("every relative link in the agent files' Markdown resolves", async () => {
    const markdown = AGENT_FILES.filter((path) => path.endsWith(".md"));
    const dirOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".");
    expect(await findings(markdown, LINK_RULE, (text, path) => brokenLinkLines(text, dirOf(path)))).toEqual([]);
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

// SPEC-agents, Settings: every agent's project settings start the docs server with this one command.
const DOCS_SERVER = "acme-design-system";
const DOCS_SERVER_COMMAND = { command: "bun", args: ["run", "--silent", "design-system-mcp"] };
type ServerEntry = { command?: unknown; args?: unknown } | undefined;
type CodexConfig = { mcp_servers?: Record<string, ServerEntry> };
const docsServerEntries: [string, () => Promise<ServerEntry>][] = [
  [".codex/config.toml", async () => (Bun.TOML.parse(await read(".codex/config.toml")) as CodexConfig).mcp_servers?.[DOCS_SERVER]],
  [".cursor/mcp.json", async () => JSON.parse(await read(".cursor/mcp.json")).mcpServers?.[DOCS_SERVER]],
  [".vscode/mcp.json", async () => JSON.parse(await read(".vscode/mcp.json")).servers?.[DOCS_SERVER]],
  [".gemini/settings.json", async () => JSON.parse(await read(".gemini/settings.json")).mcpServers?.[DOCS_SERVER]],
  // Peter adds .mcp.json for Claude Code from the README block (SPEC-agents, Boundaries); the test only reads it.
  [".mcp.json", async () => JSON.parse(await read(".mcp.json")).mcpServers?.[DOCS_SERVER]],
  // `.mcp.json` is the README line just before the block Peter copies.
  ["README's .mcp.json block", async () => jsonBlockAfter(await read("README.md"), "`.mcp.json`").mcpServers?.[DOCS_SERVER]],
];

describe("the docs server settings", () => {
  const command = [DOCS_SERVER_COMMAND.command, ...DOCS_SERVER_COMMAND.args].join(" ");
  test.each(docsServerEntries)(`%s starts ${DOCS_SERVER} with ${command}`, async (_, serverEntry) => {
    const entry = await serverEntry();
    expect({ command: entry?.command, args: entry?.args }).toEqual(DOCS_SERVER_COMMAND);
  });

  test("package.json has the design-system-mcp script", async () => {
    const { scripts } = JSON.parse(await read("package.json"));
    expect(typeof scripts?.["design-system-mcp"]).toBe("string");
  });
});

describe("Gemini CLI's settings", () => {
  test(".gemini/settings.json names AGENTS.md as its only context file", async () => {
    const { context } = JSON.parse(await read(".gemini/settings.json"));
    // context.fileName is a string or a list of strings: https://geminicli.com/docs/reference/configuration/#context
    // Only AGENTS.md: a second entry could load a file from outside the repository.
    expect([context?.fileName].flat()).toEqual(["AGENTS.md"]);
  });
});

describe("the agent files' commands", () => {
  test("every bun run names a script in package.json or in a spec's Commands section", async () => {
    expect(scriptsNamed(TEXT_FILES.get("AGENTS.md")!)).toContain("build"); // control: Verify's `bun run build` was read
    const known = knownScripts();
    const unknownScripts = (line: string) => scriptsNamed(line).some((script) => !known.has(script));
    expect(await findings(AGENT_FILES, SCRIPT_RULE, (text) => linesWhere(text, unknownScripts))).toEqual([]);
  });
});

// The private-detail checks. Where private.yaml exists, the content module's tracked-file test and the release
// skill's push guard also compare every file with it, in any format (src/private-details.ts).
describe("private details", () => {
  test("no agent file holds a phone number, except the made-up 555-0100 to 555-0199", async () => {
    expect(await findings(AGENT_FILES, PHONE_RULE, findPhoneNumbers)).toEqual([]);
  });

  test("no tracked text file holds a link to a Highspot address", async () => {
    expect(TEXT_FILES.size).toBeGreaterThan(AGENT_FILES.length); // control: the scan reads more than the agent files
    expect(await findings([...TEXT_FILES.keys()], HIGHSPOT_RULE, (text) => linesWhere(text, holdsHighspotAddress))).toEqual([]);
  });
});

// The name is built from two parts, so this file holds no Highspot address for the scan above to find.
const HS = ["high", "spot"].join("");

describe("the Highspot rule", () => {
  test.each([
    ["a URL on a highspot host", `https://app.${HS}.com/x`],
    ["a URL whose host is highspot alone", `http://${HS}/wiki`],
    ["a protocol-relative link", `<img src="//cdn.${HS}.com/x.png">`],
    ["a bare host name", `See x.${HS}.com for it.`],
    ["an email address", `Write to someone@${HS}.com.`],
    ["the GitHub organization", `See github.com/${HS}/polar.`],
    ["the GitHub organization at a sentence's end", `See github.com/${HS[0]!.toUpperCase()}${HS.slice(1)}.`],
  ])("finds %s", (_name, line) => {
    expect(holdsHighspotAddress(line)).toBe(true);
  });

  test.each([
    ["this site's page for a deep dive", `https://peterkloss.dev/sources/${HS}-mcp-server`],
    ["this repository's file for a deep dive", `https://github.com/loriensleafs/resume/blob/main/knowledge/deep-dives/${HS}-data-table.md`],
    ["a path whose last part has a dot", `knowledge/deep-dives/${HS}.md`],
    ["a citation id", `[highlight:${HS}.1]`],
    ["the company's name", "Peter worked at Highspot."],
  ])("lets %s pass", (_name, line) => {
    expect(holdsHighspotAddress(line)).toBe(false);
  });

  test("reads a 100,000-character line in under 50 ms", () => {
    const lines = [`https://${"a".repeat(100_000)}${HS}`, `${"a.".repeat(50_000)}${HS}.com`, `//${"a-".repeat(50_000)}${HS}`];
    const start = performance.now();
    for (const line of lines) holdsHighspotAddress(line);
    expect(performance.now() - start).toBeLessThan(50);
  });
});
