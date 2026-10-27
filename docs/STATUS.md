# Status

Updated 2026-10-26. This file is the one current handoff. A fresh session resumes from here without the conversation.

## Where we are

- **Phase:** knowledge module. [SPEC-knowledge.md](../spec/SPEC-knowledge.md) is approved, and its format and tests are built (43 tests pass). The deep dives and logistics answers wait on interviews with Peter.
- **Done:** `resume.yaml` and `private.yaml` replace the hand-written `resume.html`. `bun run build` makes the public and private PDF, Word and text files. The private PDF is pixel-identical to the PDF built from the hand-written `resume.html`, and the public PDF differs only on the contact line. `bun test` passes 26 tests at the two approved seams. Brain's setup ran (local issue tracker). Agent files, decision records, research notes, the glossary and the interview record are written. History was rewritten on 2026-10-26 so that no commit holds a private detail.
- **Next:** the deep-dive interviews, one at a time, starting with `highspot-mcp-server` (task 7 in [tasks/todo.md](../tasks/todo.md)). Then the logistics answers, then SPEC-site.md.

## Waiting on Peter

- Add `.mcp.json` and `.claude/settings.json` for Claude Code, from the README section "Working with AI agents" ([decision 0014](decisions/0014-library-skills-and-docs-mcp.md)). An agent's safety check blocks agents from writing their own configuration.
- Run `bun install` in `~/Dev/resume`, so Intent and the docs MCP server work there.
- Vercel Pro sign-up and an Anthropic API key with a workspace spend limit, when the deploy module starts ([0012](decisions/0012-vercel-pro-host.md), [0013](decisions/0013-claude-sonnet-model.md)). Peter signs up and pays; agents never do.
- Logistics answers and deep-dive interviews, during the knowledge module.

## Working state

- Repository: github.com/loriensleafs/resume, public since 2026-10-26, branch `main`.
- Peter's local clone: `git clone https://github.com/loriensleafs/resume ~/Dev/resume`, then create `private.yaml` there (see README).
- Nothing red. CI does not exist yet; it arrives with the deploy module.
