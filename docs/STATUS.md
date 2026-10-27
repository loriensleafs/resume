# Status

Updated 2026-10-26. This file is the one current handoff. A fresh session resumes from here without the conversation.

## Where we are

- **Phase:** knowledge module. [SPEC-knowledge.md](../spec/SPEC-knowledge.md) is approved, and its format and tests are built (43 tests pass). All nine deep dives are approved (2026-10-26). The four logistics answers are next.
- **Done:** `resume.yaml` and `private.yaml` replace the hand-written `resume.html`. `bun run build` makes the public and private PDF, Word and text files. The private PDF is pixel-identical to the PDF built from the hand-written `resume.html`, and the public PDF differs only on the contact line. `bun test` passes 26 tests at the two approved seams. Brain's setup ran (local issue tracker). Agent files, decision records, research notes, the glossary and the interview record are written. History was rewritten on 2026-10-26 so that no commit holds a private detail.
- **Next:** the logistics answers (task 8 in [tasks/todo.md](../tasks/todo.md)), then SPEC-site.md.
- **Open issues:** [01](../.scratch/knowledge/issues/01-markdown-parsers.md) names the streaming Markdown parsers once Peter hears from his former boss; [02](../.scratch/knowledge/issues/02-testing-harness-details.md) confirms the FedNow testing harness with a former colleague.

## Waiting on Peter

- Add `.mcp.json` and `.claude/settings.json` for Claude Code, from the README section "Working with AI agents" ([decision 0014](decisions/0014-library-skills-and-docs-mcp.md)). An agent's safety check blocks agents from writing their own configuration.
- Run `bun install` in `~/Dev/resume`, so Intent and the docs MCP server work there.
- Vercel Pro sign-up and an Anthropic API key with a workspace spend limit, when the deploy module starts ([0012](decisions/0012-vercel-pro-host.md), [0013](decisions/0013-claude-sonnet-model.md)). Peter signs up and pays; agents never do.
- The four logistics answers: work arrangement, location, availability, target roles.

## Working state

- Repository: github.com/loriensleafs/resume, public since 2026-10-26, branch `main`.
- Peter's local clone: `git clone https://github.com/loriensleafs/resume ~/Dev/resume`, then create `private.yaml` there (see README).
- Nothing red. CI does not exist yet; it arrives with the deploy module.
