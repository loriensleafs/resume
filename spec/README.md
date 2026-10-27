# Capability map

The resume project has six modules. Each module has one spec in this folder, named by its id. This map is the index of what exists; a module id never changes.

| Module id | Responsibility | Depends on | Spec | Status |
|---|---|---|---|---|
| content | `resume.yaml`, and the PDF, Word and text documents built from it, public and private | none | [SPEC-content.md](SPEC-content.md) | Approved 2026-10-26; built |
| knowledge | The chat's approved knowledge base: the core (resume entries, logistics answers, catalog) and the sources (deep dives, interviews), with an id for every entry and passage, and `readPassages()` | content | [SPEC-knowledge.md](SPEC-knowledge.md) | Approved 2026-10-26; two-layer update approved 2026-10-27, waiting to be built (task 11) |
| site | The TanStack Start progressive web app: the workspace (app bar, career timeline, the chat column's first view, document panel with the resume and sources), the resume and source pages, saved views, install, offline cache and document downloads; the workspace contract the chat uses | content, knowledge | [SPEC-site.md](SPEC-site.md) | Approved 2026-10-27; amendments approved 2026-10-27 |
| chat | The `/api/chat` route: each turn a fixed workflow with one bounded read loop, the citation check, refusals, the fit check and the open tools. The chat column's views, the saved conversation and queued questions in TanStack DB, device matches, the question log's entries, and the evals | knowledge, site | [SPEC-chat.md](SPEC-chat.md) | Approved 2026-10-27; amendments approved 2026-10-27 |
| deploy | Hosting on Vercel Pro, the domains and redirects, the rate limit, the spend limit, the API key's setting, the function's duration, the question log's store and its 90-day deletion, and CI | site, chat | SPEC-deploy.md | Next to write |
| agents | `AGENTS.md`, `CLAUDE.md` and the repo skills | all; updated as each module lands | SPEC-agents.md | To write after SPEC-deploy |

Build order: content → knowledge and site → chat → deploy. The agents module is written first and updated as each module lands.

Spec order (Peter, 2026-10-27): every remaining spec is written and approved before any more building. Then the plan is rewritten for all modules, and building resumes with task 11 ([tasks/todo.md](../tasks/todo.md)).

## Contracts between modules

Each contract lives in the spec of the module that provides it. A change to a contract is an "ask first" change in that spec.

| Provider | Contract | Used by | Defined in |
|---|---|---|---|
| content | `loadResume(variant)` and `build({ root, outDir, variants })` | knowledge, site | [SPEC-content](SPEC-content.md) |
| knowledge | `buildKnowledge({ root })`, `readPassages(knowledge, ids)`, the id rules | site, chat | [SPEC-knowledge](SPEC-knowledge.md) |
| site | `useWorkspace()`: scope, `openCitation()`, `openResume()`, `setCited()`, the "Ask about this" request, `reset()`; the app bar's end slot | chat | [SPEC-site](SPEC-site.md) |
| chat | `handleChat(request, deps)`, and the `QuestionLog` interface that deploy's store implements | deploy | [SPEC-chat](SPEC-chat.md) |

## History

- 2026-10-26: Peter approved the map.
- 2026-10-27: the knowledge and site rows were reworded to follow decisions 0015 to 0019.
- 2026-10-27: the site, chat and deploy rows were reworded to follow the approved SPEC-site and SPEC-chat; the status column and the contracts were added. The modules, their dependencies and the build order are unchanged.
