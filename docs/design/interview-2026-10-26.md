# Interview record, 2026-10-26

Questions put to Peter in the session that started the site and chat, and his answers. Each answer is quoted or restated as he gave it. The decision records own the reasons.

## Intent

Peter asked for: every AI agent supported in this repository (AGENTS.md, CLAUDE.md, README updates, repo skills); a "docs version" of the resume; a public version of the resume site; and an AI chat that answers questions about his resume and history. Later in the session: "the chat using TanStack AI and for the page itself maybe the personal design system of mine", and "I'd like for this app to be a progressive web app that also functions offline", using TanStack Router, Query and DB. And: "All the artifacts from the brain plug-in should be part of this repository."

## Questions and answers

| # | Question | Answer |
|---|---|---|
| 1 | Which other documents should the build make? | Word file and plain text ([0011](../decisions/0011-word-and-text-documents.md)) |
| 2 | Site scope: page now and chat later, both now, page only, or no site? | Page and chat now |
| 3 | Where should the resume content live? | One YAML data file in the JSON Resume shape ([0005](../decisions/0005-yaml-source.md)) |
| 4 | Should the repository become public? | Public, with the phone number kept out of git ([0006](../decisions/0006-public-repo-private-details.md)) |
| 5 | What may the chat answer? | Resume facts plus approved logistics. Peter added: he wants the chat to give "deeper information on context about certain parts of the resume", and asked whether training the agent or the knowledge file is the way ([0008](../decisions/0008-grounded-knowledge-file.md), [0009](../decisions/0009-chat-scope.md)) |
| 6 | React or Lit, and which app shape? | React, because TanStack AI and DB have no Lit adapters; first "either option one or option two", then TanStack Start once the PWA requirement was added ([0007](../decisions/0007-tanstack-start-pwa.md)) |
| 7 | What does the chat do offline? | Keep history readable and queue new questions ([0010](../decisions/0010-offline-chat.md)) |
| 8 | Approve the capability map? | Approved ([spec/README.md](../../spec/README.md)) |
| 9 | Test seams for the content module? | `build()` plus renderer unit tests |
| 10 | Approve SPEC-content.md? | Approved |
| 11 | Where do open issues live? | Local markdown under `.scratch/` |
| 12 | Rewrite the first commit and force-push? | Yes |
| 13 | Make the repository public now or at launch? | Now |
| 14 | Hosting | Peter: "I’m happy to pay a little bit for the hosting of this." Host: Vercel ([0012](../decisions/0012-vercel-pro-host.md)). The first version of this question mixed host and plan; Peter answered `/wait-what`, and it was split |
| 15 | Vercel plan | Pro, $20/month |
| 16 | Chat model | Claude Sonnet 5.5 ([0013](../decisions/0013-claude-sonnet-model.md)) |
| 17 | Logistics: work arrangement | "Any arrangement nearby". Approved wording in `knowledge/logistics.yaml` |
| 18 | Logistics: location | "I'd consider relocating for the right role" |
| 19 | Logistics: availability | Available now. Peter added: "The only caveat to the being able to start immediately is if I need to relocate, that could change things." |
| 20 | Logistics: target roles | Senior, Staff or Lead roles in front-end platform engineering, design systems, and AI developer tooling and AI platform work. Peter approved all four answers together |
| 21 | Site: the look of the resume page (the PDF's look, the PDF's look plus side navigation, or a new web design) | A new web design. The recommendation was the PDF's look |
| 22 | Site: what a visitor sees first (resume, chat or featured deep dives) | The chat first. The recommendation was the resume first |
| 23 | Site: test seams | The site build output, plus one real-browser test |
| 24 | Site: speed and accessibility targets | No WCAG 2.2 AA violations; main content visible in under 2.5 s and layout shift under 0.1 on a throttled phone profile; first-load JavaScript under 200 KB compressed |
| 25 | Site: are the deep dives still worth having if the chat answers in more depth (deep-dive tabs, sources on demand, or none)? | Sources on demand ([0015](../decisions/0015-sources-on-demand.md)). Peter added that his interview answers were "much more dense" than the deep dives, and asked to recover them, brief them up or add other sources, because "we're going to have to somehow be able to provide this AI with a lot more information" |

After question 24, Peter asked for mockups of the site with his design system before the site spec is written. They are on a private Design canvas, "Resume site mockups", for his review.

## Still open

- The site's visual design: Peter's review of the mockups.
- A domain name, if Peter wants one (Peter buys it; agents never buy).
