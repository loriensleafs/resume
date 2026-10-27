# Agents load library skills through TanStack Intent and read the design system's docs MCP

The site uses Peter's design system and several TanStack libraries. Those packages ship versioned agent skills, and the design system also ships a read-only documentation MCP server. Agents use them so that UI code follows the installed release instead of guessed APIs.

Decided 2026-10-26 by Peter ("add the MCP and skills that are available for the design system").

- **Skills.** TanStack Intent discovers skills inside installed packages. `package.json` `intent.skills` allows `@acmelabs/design-system` and `@tanstack/*`. Agents run `bun run intent list` and `bun run intent load <package>#<skill>`.
- **Why not `intent install`.** Its generated `AGENTS.md` block runs Intent through `bunx`, and `bunx` hands a script whose shebang names `node` to Node.js; a `bunfig.toml` `[run] bun = true` setting does not change that (tested 2026-10-26). The `intent` script runs Intent's own CLI with `bun --bun`, which keeps it on Bun ([0004](0004-bun-only.md)). `node_modules/.bin/intent` belongs to another package, so the script names Intent's file directly. Do not run `intent install`; it would add a second, Node-based block.
- **Docs MCP.** `bun run design-system-mcp` starts `@acmelabs/design-system-mcp` over stdio. It is configured for Codex (`.codex/config.toml`, loaded only for trusted projects), Cursor (`.cursor/mcp.json`) and VS Code (`.vscode/mcp.json`). Claude Code's project files (`.mcp.json`, and `.claude/settings.json` to enable the brain plugins and pre-approve the server) are added by Peter: an agent's safety check blocks an agent from writing its own configuration. Antigravity reads MCP servers only from its global `~/.gemini/config/mcp_config.json`; see the README.
- **Versions.** The design-system packages are pinned to exact versions, because the design system renames parts during its systematization pass. Its MCP tools need that exact version and the framework (`react`).

Evidence: [research 08](../research/08-library-skills-and-mcp.md).
