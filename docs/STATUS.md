# Status

Updated 2026-10-26. This file is the one current handoff. A fresh session resumes from here without the conversation.

## Where we are

- **Phase:** the knowledge module is complete. [SPEC-knowledge.md](../spec/SPEC-knowledge.md) is approved and built. All nine deep dives and all four logistics answers are approved (2026-10-26). `bun run knowledge` lists 46 entries, 31,275 of 100,000 characters.
- **Done:** `resume.yaml` and `private.yaml` replace the hand-written `resume.html`. `bun run build` makes the public and private PDF, Word and text files. The private PDF is pixel-identical to the PDF built from the hand-written `resume.html`, and the public PDF differs only on the contact line. `bun test` passes 43 tests. Brain's setup ran (local issue tracker). Agent files, decision records, research notes, the glossary and the interview record are written. History was rewritten on 2026-10-26 so that no commit holds a private detail.
- **In progress:** SPEC-site.md (task 9 in [tasks/todo.md](../tasks/todo.md)). Peter decided four questions on 2026-10-26 ([interview record](design/interview-2026-10-26.md), questions 21 to 24): a new web design, the chat first, the test seams, and the speed and accessibility targets. Then he asked for mockups before the spec. Six mockups are on the private Design canvas "Resume site mockups": home (desktop, light), home after three questions, an answer streaming (dark), a deep-dive page, home on a phone, and offline on a phone. They use design system 0.3.2 with real resume and knowledge text.
- **Next:** Peter reviews the mockups. Then write SPEC-site.md with the chosen design, and record the chat-first decision as decision 0015. A feasibility check of TanStack Start, prerendering, an offline service worker and the design system's React parts under Bun runs in a throwaway folder; its result goes into a new research note 09. After the site spec: the chat, deploy and agents specs.
- **Open issues:** [01](../.scratch/knowledge/issues/01-markdown-parsers.md) names the streaming Markdown parsers once Peter hears from his former boss; [02](../.scratch/knowledge/issues/02-testing-harness-details.md) confirms the FedNow testing harness with a former colleague.

## Waiting on Peter

- Add `.mcp.json` and `.claude/settings.json` for Claude Code, from the README section "Working with AI agents" ([decision 0014](decisions/0014-library-skills-and-docs-mcp.md)). An agent's safety check blocks agents from writing their own configuration.
- Run `bun install` in `~/Dev/resume`, so Intent and the docs MCP server work there.
- Vercel Pro sign-up and an Anthropic API key with a workspace spend limit, when the deploy module starts ([0012](decisions/0012-vercel-pro-host.md), [0013](decisions/0013-claude-sonnet-model.md)). Peter signs up and pays; agents never do.
- Review of the site mockups on the Design canvas "Resume site mockups", then of SPEC-site.md once it is written.

## Working state

- Repository: github.com/loriensleafs/resume, public since 2026-10-26, branch `main`.
- Peter's local clone: `git clone https://github.com/loriensleafs/resume ~/Dev/resume`, then create `private.yaml` there (see README).
- Nothing red. CI does not exist yet; it arrives with the deploy module.
