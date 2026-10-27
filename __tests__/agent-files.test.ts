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
const glob = (pattern: string, cwd = REPO) => [...new Bun.Glob(pattern).scanSync({ cwd })].sort();
// The agent files in Markdown outside the repo skills: the shared instructions, Claude Code's entry file, the README
// and brain's record layout.
const AGENT_DOCS = ["AGENTS.md", "CLAUDE.md", "README.md", ...glob("docs/agents/*.md")];

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
    const files = [...AGENT_DOCS, ...list(SKILLS).map((name) => `.agents/skills/${name}/SKILL.md`)];
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

// The agent files (CONTEXT.md): the Markdown above, every file of every repo skill, and each agent's settings.
// The test only reads Peter's .mcp.json and .claude/settings.json.
const AGENT_FILES = [
  ...AGENT_DOCS,
  ...glob("**/*", SKILLS).map((path) => `.agents/skills/${path}`),
  ".claude/settings.json",
  ".codex/config.toml",
  ".cursor/mcp.json",
  ".vscode/mcp.json",
  ".gemini/settings.json",
  ".mcp.json",
];

// `path:line finding` for each finding that `find` returns for a line of an agent file. A private-detail check
// returns the kind of detail it found, never the matched text, so a failure cannot print a private detail.
async function agentFileFindings(find: (line: string) => string[]): Promise<string[]> {
  const findings: string[] = [];
  for (const path of AGENT_FILES) {
    (await read(path)).split("\n").forEach((line, i) => {
      for (const finding of find(line)) findings.push(`${path}:${i + 1} ${finding}`);
    });
  }
  return findings;
}

// The script that each `bun run` in `text` names: the first word that is not a flag. A `bun run` of a file path,
// such as `export.ts` or `scripts/build.ts`, runs that file and names no script.
function scriptsRun(text: string): string[] {
  const scripts: string[] = [];
  // Each match ends at its script, so a second `bun run` on the same line is found too.
  for (const [, word] of text.matchAll(/\bbun run(?:[ \t]+-[^\s`]*)*[ \t]+([^\s`-][^\s`]*)/g)) {
    const target = word!.replace(/[.,;:)]+$/, "");
    if (target && !target.includes("/") && !/\.[cm]?[jt]sx?$/.test(target)) scripts.push(target);
  }
  return scripts;
}

// The scripts in package.json, and those that a spec's Commands section names before its module builds them.
async function knownScripts(): Promise<Set<string>> {
  const known = new Set(Object.keys(JSON.parse(await read("package.json")).scripts ?? {}));
  for (const spec of glob("spec/*.md")) {
    const text = await read(spec);
    const start = text.indexOf("\n## Commands\n");
    if (start < 0) continue;
    const end = text.indexOf("\n## ", start + 1);
    for (const script of scriptsRun(text.slice(start, end < 0 ? undefined : end))) known.add(script);
  }
  return known;
}

describe("the agent files' commands", () => {
  test("every bun run names a script in package.json or in a spec's Commands section", async () => {
    expect(scriptsRun(await read("AGENTS.md"))).toContain("build"); // control: Verify's `bun run build` was read
    const known = await knownScripts();
    const unknown = (line: string) => scriptsRun(line).filter((script) => !known.has(script)).map((script) => `bun run ${script}`);
    expect(await agentFileFindings(unknown)).toEqual([]);
  });
});

// Up to three characters between the digits of a phone number that are neither letters nor digits: spaces, dots,
// hyphens, dashes, slashes, parentheses.
const SEPARATOR = String.raw`[^\w\n]{0,3}`;
// A North American number, with or without +1: (212) 555-0123, 212-555-0123, 212 / 555 / 0123, 2125550123. Its area
// code and its exchange start with 2 to 9, so a timestamp such as 1700000000 is no phone number.
const NORTH_AMERICAN_PHONE = new RegExp(
  String.raw`(?<![\w+])(?:\+?1${SEPARATOR})?[2-9]\d\d${SEPARATOR}([2-9]\d\d)${SEPARATOR}(\d{4})(?!\d)`,
  "g",
);
// A number in international form for any other country: + or 00, then 8 to 15 digits.
const INTERNATIONAL_PHONE = new RegExp(String.raw`(?<![\w+])(?:\+|00${SEPARATOR})[2-9](?:${SEPARATOR}\d){7,14}(?!\d)`);
// NANPA reserves 555-0100 to 555-0199 for fiction in every area code; README's private.yaml example uses one.
const isFictionalNumber = (exchange: string, subscriber: string) =>
  exchange === "555" && subscriber >= "0100" && subscriber <= "0199";
const holdsPhoneNumber = (line: string) =>
  INTERNATIONAL_PHONE.test(line) ||
  [...line.matchAll(NORTH_AMERICAN_PHONE)].some(([, exchange, subscriber]) => !isFictionalNumber(exchange!, subscriber!));

// A link to a Highspot address. A pattern cannot tell Highspot's public pages from its internal ones, and no agent
// file needs either. Only the host decides, so a slug such as peterkloss.dev/sources/highspot-mcp-server passes.
// Each pattern starts only at a word boundary, so a long line costs linear time.
const HIGHSPOT_ADDRESSES = [
  /(?<![\w+.-])[a-z][\w+.-]*:\/\/[^\s/?#)\]>"'`]*highspot/i, // a URL whose host names highspot
  /(?<![\w./-])(?:[\w-]+\.)*highspot\.[a-z]/i, // a host name or an email address on a highspot domain
  /github\.com\/highspot(?![\w-])/i, // Highspot's GitHub organization
];
const holdsHighspotAddress = (line: string) => HIGHSPOT_ADDRESSES.some((address) => address.test(line));

// The phone number in private.yaml, as digits without the country code 1. It is "" when no private number exists:
// CI and a fresh clone have no private.yaml, a private.yaml may hold no phone (src/content.ts rejects any other key,
// so a moved phone fails the build), and README's made-up example is not private. A private.yaml that does not
// parse gives a fixed problem, never the parser's message, which could quote the file.
async function privatePhone(): Promise<{ digits: string; problem?: string }> {
  const file = Bun.file(`${REPO}/private.yaml`);
  if (!(await file.exists())) return { digits: "" };
  let phone: unknown;
  try {
    phone = Bun.YAML.parse(await file.text())?.basics?.phone;
  } catch {
    return { digits: "", problem: "private.yaml does not parse" };
  }
  const digits = String(phone ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return { digits: isFictionalNumber(digits.slice(3, 6), digits.slice(6)) ? "" : digits };
}
// Read at load, because test.skipIf needs the answer before any test runs.
const PRIVATE_PHONE = await privatePhone();
// The private number in any format: up to three separators between any two of its digits.
const inAnyFormat = (digits: string) => new RegExp(String.raw`(?<!\d)${[...digits].join(SEPARATOR)}(?!\d)`);

describe("private details in the agent files", () => {
  test("no agent file holds a phone number, except the made-up 555-0100 to 555-0199", async () => {
    // control: the pattern sees README's made-up private.yaml example
    const readme = [...(await read("README.md")).matchAll(NORTH_AMERICAN_PHONE)];
    expect(readme.some(([, exchange, subscriber]) => isFictionalNumber(exchange!, subscriber!))).toBe(true);
    expect(await agentFileFindings((line) => (holdsPhoneNumber(line) ? ["a phone number"] : []))).toEqual([]);
  });

  test("no agent file holds a link to a Highspot address", async () => {
    expect(await agentFileFindings((line) => (holdsHighspotAddress(line) ? ["a Highspot address"] : []))).toEqual([]);
  });

  // Skipped where no private number exists (CI, a fresh clone): there is nothing private there to leak, and the
  // pattern check above runs everywhere. Where private.yaml holds Peter's number, this check also catches that
  // number in a format the pattern misses, such as `212 555 01 23`.
  test.skipIf(!PRIVATE_PHONE.digits && !PRIVATE_PHONE.problem)(
    "no agent file holds the phone number from private.yaml, in any format",
    async () => {
      expect(PRIVATE_PHONE.problem).toBeUndefined();
      const privateNumber = inAnyFormat(PRIVATE_PHONE.digits);
      const found = (line: string) => (privateNumber.test(line) ? ["the private phone number"] : []);
      expect(await agentFileFindings(found)).toEqual([]);
    },
  );
});
