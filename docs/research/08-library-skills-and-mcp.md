# Library skills and the design system's docs MCP

Checked 2026-10-26.

## The design system's consumer tooling

- `@acmelabs/design-system` 0.3.2 ships seven consumer skills under `skills/`: choose-and-compose, data-layouts, forms-and-accessibility, html-artifacts, lit-integration, migration-between-releases, react-integration. Their references are generated from the same release record as the website and the MCP server. (Package README; design-system decision 0019.)
- `@acmelabs/design-system-mcp` 0.3.2 is a local, read-only Bun stdio server with four tools: `resolve_version`, `search_docs`, `get_component`, `get_recipe`. Each needs an exact version and a framework (`html`, `lit` or `react`). It reads only its packaged `documentation.json`. (Package README.)
- Smoke test in this repo: `bun run --silent design-system-mcp`, started from `docs/research/`, answered `initialize` as `acme-design-system-docs` 0.3.2 and listed the four tools, with nothing on stderr.

## TanStack Intent 0.5.6

- Consumers allow skills in `package.json` `intent.skills` (`"*"`, a package, a scope such as `"@tanstack/*"`, or `package#skill`); `intent.exclude` wins. `intent install` writes a guidance block into `AGENTS.md`; `intent load <package>#<skill>` prints a skill. https://github.com/TanStack/intent/blob/main/docs/getting-started/quick-start-consumers.md
- `intent list` in this repo found 5 packages and 33 skills: the design system (7) and TanStack Markdown, Highlight, Devtools Event Client and Charts, which come with the design system. TanStack AI, Start, Router, Query and DB skills appear when the site installs them.
- `intent install --dry-run` generates commands of the form `bunx --no-install --package @tanstack/intent intent …`.
- Bun runs a package binary whose shebang is `#!/usr/bin/env node` with Node through `bunx`, even with `[run] bun = true` in `bunfig.toml`. Tested with a probe package: both runs printed "ran on Node". `bun --bun <file>` runs it on Bun.
- `node_modules/.bin/intent` links to `@tanstack/devtools-event-client`'s binary, not Intent's, so `bunx intent` runs the wrong program.

## MCP configuration by agent

- Claude Code: `.mcp.json` at the repository root; `enabledMcpjsonServers` in `.claude/settings.json` pre-approves a server.
- Codex: project `.codex/config.toml`, loaded only when the project is trusted; servers under `[mcp_servers.<id>]`. https://codex.danielvaughan.com/2026/04/08/codex-cli-configuration-reference/
- Cursor: `.cursor/mcp.json`. VS Code: `.vscode/mcp.json` with a `servers` key.
- Antigravity CLI and IDE: `~/.gemini/config/mcp_config.json`, with no project-level file documented. https://medium.com/google-cloud/configuring-mcp-servers-and-skills-for-antigravity-cli-and-ide-a938c7eebb78
