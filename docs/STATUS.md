# Status

Updated 2026-10-26. This file is the one current handoff. A fresh session resumes from here without the conversation.

## Where we are

- **Phase:** the knowledge module is complete. [SPEC-knowledge.md](../spec/SPEC-knowledge.md) is approved and built. All nine deep dives and all four logistics answers are approved (2026-10-26). `bun run knowledge` lists 46 entries, 31,275 of 100,000 characters.
- **Done:** `resume.yaml` and `private.yaml` replace the hand-written `resume.html`. `bun run build` makes the public and private PDF, Word and text files. The private PDF is pixel-identical to the PDF built from the hand-written `resume.html`, and the public PDF differs only on the contact line. `bun test` passes 43 tests. Brain's setup ran (local issue tracker). Agent files, decision records, research notes, the glossary and the interview record are written. History was rewritten on 2026-10-26 so that no commit holds a private detail.
- **In progress:** SPEC-site.md (task 9 in [tasks/todo.md](../tasks/todo.md)). Peter decided four questions on 2026-10-26 ([interview record](design/interview-2026-10-26.md), questions 21 to 24): a new web design, the chat first, the test seams, and the speed and accessibility targets. Then he asked for mockups before the spec. Six mockups are on the private Design canvas "Resume site mockups": home (desktop, light), home after three questions, an answer streaming (dark), a deep-dive page, home on a phone, and offline on a phone. They use design system 0.3.2 with real resume and knowledge text.
- **Reopened 2026-10-26:** after the mockups, Peter asked for deeper, more dynamic chat answers from a fuller knowledge base about him, and for other ways to present the site. He proposed a chat workspace that opens the resume and deep dives as artifacts beside the chat. Research: [09](research/09-site-feasibility.md) (the stack works offline under Bun, with a post-build service worker), [10](research/10-chat-knowledge-depth.md) (knowledge depth). Concepts: [site concepts](design/site-concepts-2026-10-26.md).
- **Mockups:** all six concepts (A+, A, B, C, D, E) are on the "Concepts" page of the private Design canvas "Resume site mockups", with phone views. A private Design System artifact, "ACME design system", now holds design system 0.3.2: tokens for both themes, 101 components with live previews, and a bundle that canvases can load.
- **Next:** Peter picks a concept and the knowledge-base kinds to add. Then updates to [decision 0009](decisions/0009-chat-scope.md) and SPEC-knowledge if the scope grows, then SPEC-site.md. After the site spec: the chat (use the Agent Design plugin), deploy and agents specs.
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
