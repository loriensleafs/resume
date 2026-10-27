# Plan

All six module specs are approved ([capability map](../spec/README.md)). This plan builds them: 140 tasks from the five planners' proposals, merged on 2026-10-27 into one order with 26 checkpoints. Content gains the roles' short labels and the committed documents (T1 to T4). Knowledge moves to two layers, the core with its catalog and the sources read on demand (K1 to K13, which replace task 11). The site (S1 to S36), the chat (C1 to C41) and the deploy module (D1 to D38) are built from nothing. The agent files gain the Modules table, the approval rules, three repo skills and their tests (A1 to A8). The deploy spike runs first, beside the rest, once Peter has set up its throwaway project. Peter approved this breakdown on 2026-10-27 (decision record row 143): the task size, the order and the task boundaries.

## How to read the task files

- [todo.md](todo.md) is the order: one line per task, checkpoint or Peter step, with what blocks it and what Peter does for it.
- Work the frontier: a task can start when everything that blocks it is done. When several can, take the first in todo.md.
- A task's body is in its module file, `tasks/modules/<module>.md`: Delivers, Blocked by, Acceptance, Verify, Files, Size, Needs Peter. Read the notes at the top of that file and your task's body only.
- A checkpoint's checks are under Checkpoints in its module file. A checkpoint is done when each check holds and Peter has given what it asks.
- A task ends with AGENTS.md's Task end: tick its line in todo.md, rewrite STATUS, stage files by name.
- The **fresh-session check** (SPEC-agents, Testing Strategy 2) closes each module's landing. A sub-agent in a fresh clone is told only "continue". It reports the phase, the last step, the next step, anything red and the pending decisions in 5 lines or fewer, and names the next task's spec. Peter reads the result; STATUS records it.

## Phases

**Phase 0, ready now.** First the test move (row 144, [decision 0025](../docs/decisions/0025-tests-beside-code.md)): the tests go to `__tests__/` folders beside the code they test, and the specs and task files name the new paths. Then A1 puts the Modules table and the approval rules in `AGENTS.md` (not a release); then A2 writes the `release` skill. K1 (the id grammar), C1 (the chat's packages and the TanStack AI names), C2 (the question log contracts), S1 (the TanStack Start app) and D7 (CI) have no blockers. The spike D1 to D6 starts when Peter has set it up. Checkpoints: agents: before the first release; chat: contracts; deploy: the spike.

**Phase 1, foundations.** Knowledge K2 to K13: the source parser, the core with its catalog, the reads, `publicKnowledge()`, the draft preview and the three moves. Content T1 to T4: the short labels and the committed documents. The chat handler C3 to C15 at seam 1, ending with Peter's approval of the system prompt. The site's build output S2 to S8, with deploy's build script D16 and `createOps()` D9. Agents A3 to A8, and task 13 (the interviews) once A7 exists. Checkpoints: agents: checks complete; content: lands; knowledge: old contract gone, contract complete, lands; agents: lands; deploy: createOps ready; chat: the handler; site: the build output.

**Phase 2, the workspace and the chat column.** After the spike: the build settings D8, the routes and headers D17 and D18, and the question log in Upstash D10. The wide workspace S9 to S22: the preview and the browser test, the career timeline, the first view, the head script, the theme, the workspace contract, source pages, saved views and downloads. The chat's build and route C16 and C17, the preview's API routes S31, the functions D20, and the smoke check's first part D21 and D25. The chat column C18 to C30: the first answer, the input, the saved conversation, the chips, "Answers for", Markdown answers, citations, the answer steps and the message actions. Checkpoints: site: the wide workspace; deploy: the Vercel output; chat: the first answer; chat: the answer views.

**Phase 3, phones, offline, limits.** The site on phones, the app icon, the manifest, the service worker, offline and the speed budget S23 to S30, with D19. The daily cap, the daily totals, the limit alerts and the failing store D11 to D15, then D22 and D29. Queued questions, offline, two tabs, the "limit reached" state, New chat, device matches, the keyboard pass and axe C31 to C39. The smoke check in Chrome D26. Checkpoints: site: phones, offline, install; deploy: the ops write side; chat: queue, offline, limits.

**Phase 4, everything wired together.** The effects of the chat's calls on the workspace S32 to S36: citations, sheets, the restore, New chat and the install offer. The evals C40 and Peter's first run C41. The status route, the Vercel health job, the production checks, `bun run questions` and the spend runbooks D23, D24, D27, D28 and D35. The docs-only list D30 and D31. Checkpoints: site: lands; chat: lands; deploy: the smoke check.

**Phase 5, launch.** The release check D32, the GitHub health check D33, the setup list D34 and the runbooks D36; Peter's setup steps 1 to 11, the domains among them; the first release D37; step 12 and production's checks D38. Checkpoints: deploy: the workflows; deploy: setup list and runbooks; agents: the first release follows the release skill; deploy: lands.

## Order rules across modules

1. The test move comes first. A1 comes before any other module's task, and A2 before any push of a site file.
2. A push that changes a site file is a release, and Peter approves each one. Until the deploy module is built, the `release` skill stops at step 1 and the agent asks him. A push of docs-only paths only is not a release.
3. D9 waits only on C2, and C17 waits on D9. D16 waits only on S2, and S8 waits on D16.
4. S9 waits on D17, and D17 on the spike's verdicts (D6). Phase 2 cannot start until Peter has set up the spike and its checks have run.
5. K11 to K13 close Phase 1, because C17's scripted turns cite their ids. They need only K5 to K7 and Peter's approvals, so they can run as soon as those are done.
6. S31 runs right after C17: C18, D21 and every later chat browser test need the preview to answer `/api/chat`.
7. Workspace members exist as no-ops from S14. A chat task checks that it calls a member; the site task that gives the member its behavior checks the effect: S32 for C24, C28 and C36; S34 for C20; S35 for C35; S36 for C18 and C27.
8. In a composition root (`scripts/build-site.ts`, `vite.config.ts`, the route files), the module that provides a step wires it in. S28 adds `writeServiceWorker()` as the build script's step 4 and waits on C16, so its precache check covers `device-index.json`. D19 then checks the step order.
9. The built-output checks (each page's policy tag, no `style=` attribute) live once, in `src/site/__tests__/build.test.ts` (S2, S8). Deploy's tests check `addPolicyTags()` and `writeVercelConfig()` at unit level.
10. D31, the deploy task that adds the docs-only test's check against the site build, makes `buildSite()` return the list of files it read.
11. T1 makes `x-short` required, so the knowledge test fixture's `resume.yaml` needs it: whichever of T1 and the K tasks lands second updates that fixture.
12. A7 waits on K10, and task 13 waits on A7 and K10. A2's first full run waits on deploy's release scripts and checks (D7, D16, D30, D32); it is D37's release.
13. Until D16 exists, tasks verify with `bun run build` and `bun test`; after it, with `bun run build:site` too.
14. Each module's landing sets its rows in `AGENTS.md`'s Modules table and in `spec/README.md` to built, and runs the fresh-session check.

## Waiting on Peter

Each item names the task it blocks; todo.md shows them as "Peter:".

1. Done 2026-10-27: the spike's setup: a Vercel Pro team ($20 a month from then on), the throwaway project from `prototype/deploy-spike` (Standard Protection, no domains, no Anthropic key) and its bypass secret as an Actions secret. It blocked D1; the details are in D1's body.
2. Each push to `prototype/deploy-spike`: D1 to D5.
3. The Vercel Toolbar off for production (done 2026-10-27, at team level), and the PDF check in Chrome: D3.
4. A pay-as-you-go Upstash database on the throwaway project (done 2026-10-27), and `@vercel/functions` only if spike check 7 fails: D4.
5. Done 2026-10-27: the three WAF rules on the throwaway project: D5.
6. Each spec change the spike's verdicts need: D6.
7. Deleting the throwaway project and its Upstash database: D32.
8. The nine `x-short` labels, with a curly or straight apostrophe in "Brigham and Women’s": T1, and through it S10.
9. The nine summaries, three per move, with the moved files: K11, K12 and K13, and through them C17.
10. The interviews, and the kind line for interview sources before the first interview source is approved: task 13.
11. A SPEC-chat amendment, only if a TanStack AI name differs: C1.
12. The system prompt, the five audience lines and the two refusal wordings: C15, and through it C40 and D29.
13. The font format, WOFF2 with an encoder package he approves or WOFF: S7, and through it S26.
14. The overall suggested questions' wording (S11) and each role's (S15, and through it C18).
15. The "Answers for" popover's wording and the anonymous-log line's wording: C22. The decision record approves neither text (row 84 approved the line's place, row 139 the boards); Peter may count row 139.
16. The `resume-evals` workspace and key ($5 limit) in `.secrets/local.env`, each eval run, and the review of its answers: C41.
17. The push texts for the limit alerts: `daycap` (D13), `spendlimit` (D14), `storefail` (D15) and `health` (D24).
18. A decision only if the worst-case turn reaches the $0.90 reservation: D29.
19. The read-only token in `.secrets/local.env`, for the manual check of `bun run questions`: D28.
20. Review and approval of the setup list and the runbooks: D34, D35 and D36.
21. The Actions secrets (setup step 9): D33.
22. Setup steps 1 to 11, with the three domains bought; step 10 also runs spike check 12 for D32. Blocks D37. Done 2026-10-27: step 1 (the three domains, in the Peter Kloss team, each renewing on Oct 27, 2027), step 4's Pro sign-up, step 5's toolbar setting (at team level) and step 8's $20 budget with pause off; its ntfy webhook waits for step 2.
23. The first release, and confirming that its push reaches his phone: D37.
24. Setup step 12 (`ANTHROPIC_API_KEY`, then Redeploy), the Vercel health job run by hand, and one live question: D38.
25. Every push that is a release, and so each checkpoint that ends in one: content: lands; site: the build output, the wide workspace, phones, offline, install, and lands; chat: queue, offline, limits; and the pushes of T1, T2 and K11 to K13.
26. The reviews the checkpoints ask for: the new `AGENTS.md` sections before T1's push; knowledge: old contract gone and contract complete; chat: the first answer and the answer views (suggested); deploy: the workflows.
27. Reading each fresh-session check's result, at each module's landing.

## Risks

| Risk | Mitigation |
|---|---|
| The design system renames parts during its systematization pass | Pin exact versions (0.3.2); upgrade deliberately |
| The design system's React package does not server-render | Pages prerender each part as its tag with its light-DOM text and no declarative shadow root (S4); the parts upgrade in the browser (S9) |
| The chat states a wrong fact | Knowledge base only; the citation check on the server; no `Not public` text on the wire; trick-question evals on Peter's approval (C40, C41) |
| Abuse runs up the API bill | WAF rate limits per address; the $8 daily cap with a $0.90 reservation per turn; the Anthropic workspace spend limit; limit alerts to Peter's phone (D11 to D14) |
| Vercel does not behave as SPEC-deploy assumes: the Bun runtime, post-build routes, header merging, the redirect's query string, Cron under protection, store writes after Stop, the WAF's path match, the Upstash tokens, the PDF viewer, the toolbar | The spike checks each on a throwaway project before a task builds on it; a failed check's change goes into the spec with Peter's approval (D6) |
| Phase 2 waits on the spike, through D17 and S9 | Phase 1 needs no spike; the spike's setup is Peter's first item |
| The spike project's deployments set off the release check once it is on `main` | Peter deletes the spike project before D32 |
| Peter's answers hold up later work: the labels (S10), the moves (C17), the suggested questions (C18), the system prompt (C40) | Each question goes to Peter as soon as its task is reached; the rest of the frontier keeps moving |
| `docx` and Chrome cannot write a fixed date, so each document build differs byte for byte | The inputs hash decides when `bun run documents` rebuilds (T2); T4 records the verdict |

## Open items

- Four placements beyond the proposals, approved by main on 2026-10-27, for Peter to see: the chat tasks C20, C24, C27, C28, C35 and C36 check their calls, and S32 to S36 check the effects; S31 moved from Phase 4 to right after C17; K11 to K13 close Phase 1, though main's phases listed the moves under Phase 4; S28 waits on C16 and holds the `device-index.json` precache check.
- Two task bodies changed with them: D19 now checks the build script's step order, since S28 wires its own call; D31 makes `buildSite()` return the files it read.
- SPEC-chat holds three decisions since commit `1e23638` (the handler sets the prompt cache, `ChatDeps.origins`, and the eval case's `history`, `scope` and `audience`); C4, C12, C17 and C40 follow them.
- SPEC-knowledge: K1 records the id rules' export names. The rule K5 adds (an approved passage holds text; only `Not public` may be empty) is in the spec since `1e23638`.
- Gemini CLI was replaced by Antigravity CLI on 2026-06-18 (geminicli.com). A3 stands, because the spec keeps `.gemini/settings.json`.
- Noticed, not tasked: README's "Edit the content" should name `bun run documents` once T2 lands.
- Open issues [01](../.scratch/knowledge/issues/01-markdown-parsers.md) (the streaming Markdown parsers) and [02](../.scratch/knowledge/issues/02-testing-harness-details.md) (the FedNow testing harness) wait on Peter's former colleagues.
