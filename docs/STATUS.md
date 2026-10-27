# Status

Updated 2026-10-27. This file is the one current handoff. A fresh session resumes from here without the conversation.

## Where we are

- **Phase:** the mockups are approved (task 12). The knowledge module is being reworked for a much larger knowledge base. SPEC-site.md (task 9 in [tasks/todo.md](../tasks/todo.md)) can now be written from the mockups.
- **Done:** `resume.yaml` and `private.yaml` build the public and private PDF, Word and text files; `bun test` passes 43 tests. The first knowledge module is built: nine approved deep dives and four approved logistics answers, 46 entries, 31,275 characters.
- **Decided 2026-10-26 and 2026-10-27:** deep dives become sources the chat opens on demand ([0015](decisions/0015-sources-on-demand.md)); two layers, a cached core in every request and full sources read through a server tool ([0016](decisions/0016-two-layer-knowledge.md)); the visitor's session is saved on their device with a "New chat" control ([0017](decisions/0017-saved-visitor-session.md)); the site lives at peterkloss.dev, with pkloss.dev and pwk.dev redirecting to it ([0018](decisions/0018-domains.md)). Also recorded (interview rows 29 and 30): the site offers to install itself and opens as a standalone app, and it needs an app icon. Research: [11](research/11-knowledge-tooling.md) (TanStack AI and Vercel's AI tools).
- **Interview answers:** the chat history keeps no question-dialog answers. Peter supplied his own copy of the 2026-10-26 interview on 2026-10-27; it is kept word for word on this chat's private workspace branch (claude-sessions, `.scratch/resume/`), never in this repository, because it holds an internal Highspot link. His answers there come to about 2,560 words; the nine deep dives (3,924 words) keep nearly every fact from them, so more depth needs new material.
- **Gathering method (Peter, 2026-10-27):** long-form interviews, one topic at a time, in normal chat messages (typed or spoken), never the question dialog. Each answer is saved word for word as a source file before anything is written from it.
- **Mockups:** approved by Peter on 2026-10-27 ("I think this all looks pretty good"; interview row 75). Images of every board, light and dark, are in [docs/design/mockups/](design/mockups/README.md); the board sources and the export script are on the branch `prototype/site-mockups`. The private Design canvas "Resume site mockups" (version 42) stays the working copy. The choices behind the views are in the [interview record](design/interview-2026-10-26.md), rows 21 to 75, and the [site concepts](design/site-concepts-2026-10-26.md). Row 63, artifact cards in the chat, is still open.
- **Spec:** the updated [SPEC-knowledge](../spec/SPEC-knowledge.md) is approved (2026-10-27): the core with a catalog, sources split into cited passages, the interview rules and six subjects. Decision [0019](decisions/0019-wider-chat-scope.md) widens the chat to career, working style, stories, opinions, side projects and skills.
- **SPEC-chat in progress (task 14):** the process map is done with the Agent Design plugin. Peter's choices for it: an anonymous question log ([0020](decisions/0020-anonymous-question-log.md)), a fit check for pasted job descriptions, and, when a visitor asks for the resume, the whole resume opens beside the chat (interview rows 79 to 81). SPEC-site gained the resume view's ⋯ download menu and the workspace's `openResume()` for that.
- **Next:** all remaining specs before any more building (Peter, 2026-10-27). [SPEC-site](../spec/SPEC-site.md) is approved (task 9, 2026-10-27). Next is the SPEC-chat architecture decision and the spec itself, then SPEC-deploy and SPEC-agents (task 14). Then the plan is rewritten for every module, and building resumes with task 11. The interviews (task 13) can run at any time. SPEC-chat, SPEC-deploy and SPEC-agents follow ([plan](../tasks/plan.md)).
- **Open issues:** [01](../.scratch/knowledge/issues/01-markdown-parsers.md) names the streaming Markdown parsers once Peter hears from his former boss; [02](../.scratch/knowledge/issues/02-testing-harness-details.md) confirms the FedNow testing harness with a former colleague.

## Waiting on Peter

- Buy peterkloss.dev, pkloss.dev and pwk.dev when ready, at a registrar or through Vercel ([0018](decisions/0018-domains.md)). Agents never buy.
- Add `.mcp.json` and `.claude/settings.json` for Claude Code, from the README section "Working with AI agents" ([decision 0014](decisions/0014-library-skills-and-docs-mcp.md)). An agent's safety check blocks agents from writing their own configuration.
- Run `bun install` in `~/Dev/resume`, so Intent and the docs MCP server work there.
- Vercel Pro sign-up and an Anthropic API key with a workspace spend limit, when the deploy module starts ([0012](decisions/0012-vercel-pro-host.md), [0013](decisions/0013-claude-sonnet-model.md)). Peter signs up and pays; agents never do.

## Working state

- Repository: github.com/loriensleafs/resume, public since 2026-10-26, branch `main`.
- Peter's local clone: `git clone https://github.com/loriensleafs/resume ~/Dev/resume`, then create `private.yaml` there (see README).
- Nothing red. CI does not exist yet; it arrives with the deploy module.
