# Agent instruction files and skills across coding agents

Researched 2026-10-26. Gemini CLI's settings keys confirmed 2026-10-27.

## Findings

- **Claude Code** reads `AGENTS.md` as project instructions when no `CLAUDE.md` exists (v2.1.277 and later). When both exist, it reads `CLAUDE.md` only, by default. A `CLAUDE.md` containing `@AGENTS.md` imports it, and Claude Code never reads it twice. Anthropic documents this import as the way to share one file with other coding tools, and some sessions can read `AGENTS.md` only through it. https://code.claude.com/docs/en/glossary.md, https://code.claude.com/docs/en/memory.md
- **Claude Code skills** load from `.claude/skills/<name>/SKILL.md`. A `<name>` entry there can be a symlink to a directory elsewhere; Claude Code reads the target. https://code.claude.com/docs/en/skills.md
- **Codex, Cursor, Gemini CLI, GitHub Copilot and OpenCode** read project skills from `.agents/skills/`. https://mintlify.wiki/vercel-labs/skills/resources/compatibility
- **Gemini CLI** loads `GEMINI.md` as its context file by default. In the project settings file `.gemini/settings.json`, the key `context.fileName` (a string or a list of strings) names the context files instead, and `mcpServers.<name>` starts a stdio server from `command` and `args`. Confirmed 2026-10-27 in the settings reference (last updated Oct 15, 2026). https://geminicli.com/docs/reference/configuration/#context, https://geminicli.com/docs/reference/configuration/#mcpservers
- **Gemini CLI's replacement** is partial. On 2026-06-18 Gemini CLI stopped serving Google AI Pro, Ultra and free users, and Antigravity CLI replaces it for them. Gemini CLI stays available with a Gemini Code Assist Standard or Enterprise licence and with paid Gemini API keys, so `.gemini/settings.json` still reaches it. https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli
- **Antigravity CLI** reads `AGENTS.md` for project instructions (it replaces Gemini CLI's `GEMINI.md`), and skills from `.agents/skills/`. https://blog.buildfastwithai.com/google-antigravity-2-0-developer-guide-2026, https://codelabs.developers.google.com/getting-started-with-antigravity-skills

## Outcome

- `AGENTS.md` is the one shared instruction file. `CLAUDE.md` imports it with `@AGENTS.md` and adds Claude command spellings.
- `.gemini/settings.json` sets `"context": { "fileName": ["AGENTS.md"] }` and the docs server, so Gemini CLI reads the same file (task A3).
- Repo skills live in `.agents/skills/<name>/`. `.claude/skills/<name>` is a symlink to the same folder, so every agent reads one copy.
