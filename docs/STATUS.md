# Status

Updated 2026-10-27. This file is the one current handoff. A fresh session resumes from here without the conversation.

## Where we are

- **Phase:** the knowledge module is being reworked for a much larger knowledge base, and the mockups are being updated. SPEC-site.md (task 9 in [tasks/todo.md](../tasks/todo.md)) waits for both.
- **Done:** `resume.yaml` and `private.yaml` build the public and private PDF, Word and text files; `bun test` passes 43 tests. The first knowledge module is built: nine approved deep dives and four approved logistics answers, 46 entries, 31,275 characters.
- **Decided 2026-10-26 and 2026-10-27:** deep dives become sources the chat opens on demand ([0015](decisions/0015-sources-on-demand.md)); two layers, a cached core in every request and full sources read through a server tool ([0016](decisions/0016-two-layer-knowledge.md)); the visitor's session is saved on their device with a "New chat" control ([0017](decisions/0017-saved-visitor-session.md)); the site lives at peterkloss.dev, with pkloss.dev and pwk.dev redirecting to it ([0018](decisions/0018-domains.md)). Also recorded (interview rows 29 and 30): the site offers to install itself and opens as a standalone app, and it needs an app icon. Research: [11](research/11-knowledge-tooling.md) (TanStack AI and Vercel's AI tools).
- **Interview answers:** the chat history keeps no question-dialog answers. Peter supplied his own copy of the 2026-10-26 interview on 2026-10-27; it is kept word for word on this chat's private workspace branch (claude-sessions, `.scratch/resume/`), never in this repository, because it holds an internal Highspot link. His answers there come to about 2,560 words; the nine deep dives (3,924 words) keep nearly every fact from them, so more depth needs new material.
- **Gathering method (Peter, 2026-10-27):** long-form interviews, one topic at a time, in normal chat messages (typed or spoken), never the question dialog. Each answer is saved word for word as a source file before anything is written from it.
- **Mockups:** the "Merged" page of the private Design canvas "Resume site mockups" was updated on 2026-10-27 for decisions 0015 to 0019: the source view with a marked passage, the visible source read, Start over, a restored session, the install offer, the installed app and four app icon options ([site concepts](design/site-concepts-2026-10-26.md)). Later the same day Peter chose the timeline as a full-width band (phones scroll it), "New chat" at the top of the chat column, and the send button's states; the "Merged, dark" page shows every view in dark mode. His latest changes (interview rows 46 to 59, canvas version 36; rows 56 to 59 cover the send button as an end add-on, the error alert, and queued questions): design-system alerts for notices, secondary buttons for New chat and Install app, a plain × in the source tab, the heading "Career timeline", a blue "Peter Kloss" box in the app bar, "PK" as the installed app's icon, the send button inside the input, and light and dark views side by side on one page.
- **Spec:** the updated [SPEC-knowledge](../spec/SPEC-knowledge.md) is approved (2026-10-27): the core with a catalog, sources split into cited passages, the interview rules and six subjects. Decision [0019](decisions/0019-wider-chat-scope.md) widens the chat to career, working style, stories, opinions, side projects and skills.
- **Next:** Peter's final look at the mockups (task 12), then task 11 (move the deep dives, build the sources and `readPassages()`), then task 13 (the interviews), then SPEC-site.md. SPEC-chat, SPEC-deploy and SPEC-agents follow ([plan](../tasks/plan.md)).
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
