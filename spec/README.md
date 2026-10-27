# Capability map

The resume project has six modules. Each module has one spec in this folder, named by its id. This map is the index of what exists; a module id never changes.

| Module id | Responsibility | Depends on | Spec | Status |
|---|---|---|---|---|
| content | `resume.yaml`, and the PDF, Word and text documents built from it, public and private; the committed public documents in `documents/` | none | [SPEC-content.md](SPEC-content.md) | Approved 2026-10-26; built. Amended 2026-10-27 (`documents/`, the roles' `x-short`), approved with the review fixes (row 139), waiting to be built |
| knowledge | The chat's approved knowledge base: the core (resume entries, logistics answers, catalog) and the sources (deep dives, interviews), with an id for every entry and passage, and `readPassages()` | content | [SPEC-knowledge.md](SPEC-knowledge.md) | Approved 2026-10-26; two-layer update approved 2026-10-27; review fixes approved 2026-10-27 (row 139); waiting to be built (task 11) |
| site | The TanStack Start progressive web app: the workspace (app bar, career timeline, the chat column's first view, document panel with the resume and sources), the resume and source pages, saved views, install, offline cache and document downloads; the workspace contract the chat uses | content, knowledge | [SPEC-site.md](SPEC-site.md) | Approved 2026-10-27; amendments and review fixes approved 2026-10-27 (row 139) |
| chat | The `/api/chat` route: each turn a fixed workflow with one bounded read loop, the citation check, refusals, the fit check and the open tools. The chat column's views, the saved conversation and queued questions in TanStack DB, device matches, the question log's entries, and the evals | knowledge, site | [SPEC-chat.md](SPEC-chat.md) | Approved 2026-10-27; amendments and review fixes approved 2026-10-27 (row 139) |
| deploy | Hosting on Vercel Pro, the domains and redirects, the headers and the rate limits, the spend limits and the daily cap, the question log's store and its 90-day deletion, the alerts and health checks, the build script `bun run build:site`, `bun run questions`, and CI | content, site, chat | [SPEC-deploy.md](SPEC-deploy.md) | Approved 2026-10-27; corrected 2026-10-27 after the reviews of the other specs and approved (row 139); the deploy spike is the plan's first task |
| agents | The agent files: `AGENTS.md`, `CLAUDE.md`, each agent's settings, and the repo skills | content, knowledge, site, chat, deploy: it documents them, and no module depends on it | [SPEC-agents.md](SPEC-agents.md) | Approved 2026-10-27 (row 142); built with the plan's agents tasks |

Build order: content → knowledge → site → chat → deploy. Each module comes after every module it depends on. The agents module's spec is written next, and its files change as each module lands.

Spec order (Peter, 2026-10-27): every remaining spec is written and approved before any more building. Then the plan is rewritten for all modules, and building resumes with task 11 ([tasks/todo.md](../tasks/todo.md)).

## Contracts between modules

Each contract lives in the spec of the module that provides it. A change to a contract is an "ask first" change in that spec.

Three kinds of file import several modules: the route files at run time, `vite.config.ts` (it adds the chat's Vite plugin to the site's build and holds the deploy module's Nitro `vercel` settings), and `scripts/build-site.ts` at build time. They are composition roots. A module's tests may run `scripts/build-site.ts` to check its own part of the built output. No module imports a module that depends on it.

| Provider | Contract | Used by | Defined in |
|---|---|---|---|
| content | `loadResume(variant, root)` and `build({ root, outDir, variants })` | knowledge and site (`loadResume()`); deploy's CI (`bun run build`) | [SPEC-content](SPEC-content.md) |
| content | The committed public documents in `documents/`, with `documents/inputs.sha256` (`bun run documents`) | site (`buildSite()` copies them); deploy (the smoke check compares them) | [SPEC-content](SPEC-content.md) |
| knowledge | `buildKnowledge({ root })`, `publicKnowledge(knowledge)` (the public shape, without `Not public`), `readPassages(knowledge, ids)` with `readLimits`, `renderCore()` and `renderSource()`, the id rules | site (`buildKnowledge()` then `publicKnowledge()` at build time, the id rules); chat (`buildKnowledge()` and `renderCore()` on the server, `readPassages()` and `readLimits` in the read tool, `publicKnowledge()` for the device index, the id rules) | [SPEC-knowledge](SPEC-knowledge.md) |
| site | The workspace contract (amended, row 134), through `useWorkspace()`: `scope` and `setScope()`, `openCitation()`, `openResume()`, `setCited()`, `askRequest` and `clearAskRequest()`, `suggestedQuestion` and `clearSuggestedQuestion()`, `setConversationActive()`, `answerFinished()`, `reset()`; the app bar's end slot | chat | [SPEC-site](SPEC-site.md) |
| site | `buildSite({ root, outDir })` and `writeServiceWorker(staticDir)` | deploy (`scripts/build-site.ts`, steps 1 and 4) | [SPEC-site](SPEC-site.md) |
| chat | `handleChat(request, deps)` and `ChatDeps`; `QuestionLog` with its contract suite (`src/chat/server/__tests__/question-log-contract.ts`); `Budget`; `Telemetry`; their in-memory versions `inMemoryQuestionLog(now)`, `inMemoryBudget(refuse?)` and `inMemoryTelemetry()`; `ChatTurnEvent`; `ChatError`; `turnLimits` | deploy (its ops module implements `QuestionLog`, `Budget` and `Telemetry`, and its `createOps()` gives the in-memory versions outside production; the smoke check reads `ChatError`; the worst-case turn uses `turnLimits`). `handleChat()` itself runs only in the chat's route file and its evals | [SPEC-chat](SPEC-chat.md) |
| chat | Its Vite plugin: `virtual:knowledge` for the chat route, and `device-index.json` in `.vercel/output/static/` | deploy (`scripts/build-site.ts`, step 2). The service worker precaches `device-index.json` because it lies in `static/`; site code does not import the chat | [SPEC-chat](SPEC-chat.md) |
| deploy | `scripts/build-site.ts` (`bun run build:site`), with `addPolicyTags(staticDir)` and `writeVercelConfig(outputDir)`; `createOps(env, io)`; `createOpsReader(env, io)` (`bun run questions`) | the route files (`createOps()`); no other module | [SPEC-deploy](SPEC-deploy.md) |

## History

- 2026-10-26: Peter approved the map.
- 2026-10-27: the knowledge and site rows were reworded to follow decisions 0015 to 0019.
- 2026-10-27: the site, chat and deploy rows were reworded to follow the approved SPEC-site and SPEC-chat; the status column and the contracts were added. The modules, their dependencies and the build order are unchanged.
- 2026-10-27: after the spec reviews (decision record rows 128 to 136), the "Depends on" column, the build order and the contracts table were rebuilt from the names in the specs. Deploy now depends on content too, and the build order is content → knowledge → site → chat → deploy. The content, deploy and agents rows were corrected.
- 2026-10-27: the chat's contract lists its in-memory log, budget and telemetry, which deploy's `createOps()` gives outside production, so one copy of the day-window logic exists (main's decision from the C2 review, for Peter's end review).
