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

## Still open

- Hosting and the model provider, with a rate limit and a spend cap (research in progress).
- The logistics answers: remote or on-site, location, availability, target roles.
- The deep dives: which highlights get one, and the interview for each.
- A domain name, if Peter wants one (Peter buys it; agents never buy).
