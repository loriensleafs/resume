# Agent instruction files and skills across coding agents

Researched 2026-10-26.

## Findings

- **Claude Code** reads `AGENTS.md` as project instructions when no `CLAUDE.md` exists (v2.1.277 and later). When both exist, it reads `CLAUDE.md` only, by default. A `CLAUDE.md` containing `@AGENTS.md` imports it, and Claude Code never reads it twice. Anthropic documents this import as the way to share one file with other coding tools, and some sessions can read `AGENTS.md` only through it. https://code.claude.com/docs/en/glossary.md, https://code.claude.com/docs/en/memory.md
- **Claude Code skills** load from `.claude/skills/<name>/SKILL.md`. A `<name>` entry there can be a symlink to a directory elsewhere; Claude Code reads the target. https://code.claude.com/docs/en/skills.md
- **Codex, Cursor, Gemini CLI, GitHub Copilot and OpenCode** read project skills from `.agents/skills/`. https://mintlify.wiki/vercel-labs/skills/resources/compatibility
- **Antigravity CLI** reads `AGENTS.md` for project instructions (it replaces Gemini CLI's `GEMINI.md`), and skills from `.agents/skills/`. https://blog.buildfastwithai.com/google-antigravity-2-0-developer-guide-2026, https://codelabs.developers.google.com/getting-started-with-antigravity-skills

## Outcome

- `AGENTS.md` is the one shared instruction file. `CLAUDE.md` imports it with `@AGENTS.md` and adds Claude command spellings.
- Repo skills live in `.agents/skills/<name>/`. `.claude/skills/<name>` is a symlink to the same folder, so every agent reads one copy.
