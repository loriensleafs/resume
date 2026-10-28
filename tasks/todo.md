# Tasks

The order of the open work. [plan.md](plan.md) explains the phases and the order rules. Each line links to its body in `tasks/modules/<module>.md`: read that module file's notes and the one body, not the whole file.

A task line reads: ID and title — what blocks it; what Peter does for it. Work the frontier: a task can start when everything that blocks it is done; when several can, take the first in this list. A checkpoint line names the tasks it checks. A line that starts with "Peter:" is his step. Each task ends with its verification and AGENTS.md's Task end.

## Done

- [x] 1. Move content to `resume.yaml`; build public and private PDF, Word and text
- [x] 2. Tests at the approved seams
- [x] 3. Agent support: `AGENTS.md`, `CLAUDE.md`, `.agents/skills/edit-resume`, `.claude/skills` symlink, README
- [x] 4. Checkpoint A: rewrite the first commit without the phone number and push (needs Peter's approval)
- [x] 5. Write SPEC-knowledge.md for Peter's review (approved 2026-10-26)
- [x] 6. Knowledge format: parser, `buildKnowledge()`, renderer with `[id]` markers, `bun run knowledge`
- [x] 7. Interview Peter and approve the nine deep dives, one at a time (all nine approved 2026-10-26; two follow-ups in .scratch/knowledge/issues/)
- [x] 8. Interview Peter and approve the four logistics answers (all four approved 2026-10-26)
- [x] 9. Write SPEC-site.md for Peter's review, from the approved mockups in `docs/design/mockups/` (approved 2026-10-27)
- [x] 10. Update SPEC-knowledge.md for the two layers (approved 2026-10-27)
- [x] 11. Split into K1 to K13 (plan of 2026-10-27): the move of the nine deep dives, the source parser, the core with its catalog, and `readPassages()`
- [x] 12. Update the mockups for decisions 0015 to 0019, for Peter's review (Peter, 2026-10-27: "I think this all looks pretty good")
- [x] 14. Write SPEC-chat.md (with the Agent Design plugin), then SPEC-deploy.md and SPEC-agents.md, each for Peter's review

## Phase 0: ready now

- [x] The test move: tests go to `__tests__/` folders beside the code they test ([decision 0025](../docs/decisions/0025-tests-beside-code.md), row 144). The existing test files and snapshots move with `git mv`; the specs, the plan and the task files name the new paths; `AGENTS.md`'s Code section names the rule; `bun test` runs the same 43 tests — blocked by none; Peter: approve the amended specs, plan and task files (approved 2026-10-27, row 145)
- [x] [A1](modules/agents.md#a1-agentsmd-routes-by-module-and-carries-the-approval-rules) `AGENTS.md` routes by module and carries the approval rules — blocked by the test move
- [x] [A2](modules/agents.md#a2-the-release-repo-skill) The `release` repo skill — blocked by A1
- [ ] [Checkpoint agents: before the first release](modules/agents.md#checkpoint-agents-before-the-first-release) — after A1, A2; Peter: read the new Modules and Releases and approvals sections; no task waits for it ([plan](plan.md), "Running the plan")
- [x] [K1](modules/knowledge.md#k1-the-id-grammar-in-one-module) The id grammar in one module — blocked by none (done 2026-10-27; Peter added the id grammar's own test seam, row 146)
- [x] [C1](modules/chat.md#c1-install-the-chats-packages-and-check-spec-chats-tanstack-ai-names) Install the chat's packages and check SPEC-chat's TanStack AI names — blocked by none; Peter: approve a SPEC-chat amendment, only if a TanStack AI name differs (done 2026-10-27; SPEC-chat amended, rows 155 and 156)
- [x] [C2](modules/chat.md#c2-the-question-log-budget-and-telemetry-contracts-with-the-contract-suite) The question log, budget and telemetry contracts, with the contract suite — blocked by none (done 2026-10-27)
- [x] [Checkpoint chat: contracts](modules/chat.md#checkpoint-chat-contracts) — after C2 (passed 2026-10-27: `bun test src/chat` passes; D9 can start)
- [x] [S1](modules/site.md#s1-the-tanstack-start-app-on-bun-with-nitros-vercel-output) The TanStack Start app on Bun, with Nitro's Vercel output — blocked by none (done 2026-10-27; the server function exports fetch(req, context) and runs on bun1.x until D20 sets 1.4)
- [x] [D7](modules/deploy.md#d7-ci-runs-the-build-the-tests-and-the-audits) CI runs the build, the tests and the audits — blocked by none (done 2026-10-27; first run 40576866231: test and audit pass, audit-all fails on the zod advisory until A9)
- [x] Peter: the spike's setup: a Vercel Pro team ($20 a month from here on), the throwaway project from `prototype/deploy-spike` (root `prototypes/deploy-spike/`, Standard Protection, no domains, no Anthropic key) and its automation bypass secret as an Actions secret — blocks D1 (done 2026-10-27: team Peter Kloss, project `resume-deploy-spike`, secret `VERCEL_AUTOMATION_BYPASS_SECRET`; details in D1's body)
- [x] [D1](modules/deploy.md#d1-deploy-spike-part-1-the-throwaway-project-builds-the-spike-branch) Deploy spike, part 1: the throwaway project builds the spike branch — blocked by Peter's spike setup (done 2026-10-27; check 1 passes: Vercel builds with Bun 1.4 when bunVersion is "1.4.x" or the lockfile is version 2)
- [x] [D2](modules/deploy.md#d2-deploy-spike-part-2-the-post-build-routes-and-the-function-runtime) Deploy spike, part 2: the post-build routes and the function runtime — blocked by D1 (done 2026-10-27; checks 2 and 3 pass; the cron is verified by D4 check 6)
- [x] [D3](modules/deploy.md#d3-deploy-spike-part-3-headers-the-redirect-the-pdf-and-the-vercel-toolbar) Deploy spike, part 3: headers, the redirect, the PDF and the Vercel Toolbar — blocked by D2 and Peter turning the Vercel Toolbar off for production on the throwaway project (done 2026-10-27, at team level); Peter: open the spike's PDF in Chrome (check 10) (done 2026-10-27, tip `235c0e0`: checks 4, 5 and 10 pass (10 is Peter's, row 160); check 11 passes for the production setting, and the header's own effect is a gap for D6)
- [x] [D4](modules/deploy.md#d4-deploy-spike-part-4-vercel-cron-store-writes-after-stop-and-the-upstash-tokens) Deploy spike, part 4: Vercel Cron, store writes after Stop, and the Upstash tokens — blocked by D2 and Peter's pay-as-you-go Upstash database on the throwaway project (done 2026-10-27); Peter: approve `@vercel/functions` only if check 7 fails (done 2026-10-27, tip `e279f84`: checks 6, 7 and 9 pass; check 7 shows a function never sees a visitor's Stop without `supportsCancellation`, a spec question for D6; `@vercel/functions` is not needed)
- [x] [D5](modules/deploy.md#d5-deploy-spike-part-5-the-waf-rules-and-the-status-helper) Deploy spike, part 5: the WAF rules and the status helper — blocked by D2 and Peter's three WAF rules on the throwaway project (done 2026-10-27) (done 2026-10-27, spike tip `bc119a7`: check 8 passes on previews and on production; check 12 moved to D32 and setup step 10)
- [x] [D6](modules/deploy.md#d6-spike-verdicts-into-research-12-and-spec-deploy) Spike verdicts into research 12 and SPEC-deploy — blocked by D3 to D5; Peter: approve each spec change the verdicts need (done 2026-10-27; Peter approved rows 167 to 170: the 10 corrections, Stop logged only where it reaches the handler, no persistent WAF block, one plain request without the toolbar header; `overrides` stay)
- [ ] [Checkpoint deploy: the spike](modules/deploy.md#checkpoint-deploy-the-spike) — after D1 to D6; Peter: delete the throwaway project and its Upstash database before D32 (checks passed 2026-10-27: every check has its verdict in research 12, the spike branch is unmerged; D8 uses the project once before Peter deletes it)

## Phase 1: foundations

- [x] [A3](modules/agents.md#a3-every-agent-reaches-the-docs-server-and-gemini-cli-reads-agentsmd) Every agent reaches the docs server, and Gemini CLI reads `AGENTS.md` — blocked by A1 (done 2026-10-27)
- [x] [A4](modules/agents.md#a4-the-agent-files-checks-cover-links-scripts-and-private-details-everywhere) The agent files' checks cover links, scripts and private details everywhere — blocked by A1 (runs after A3: same test file) (done 2026-10-27; the shared rule src/private-details.ts)
- [x] [A6](modules/agents.md#a6-the-update-mockups-repo-skill) The `update-mockups` repo skill — blocked by A2 (done 2026-10-27; the mockups branch renders again)
- [x] [T1](modules/content.md#t1-each-role-has-its-short-label-x-short) Each role has its short label (`x-short`) — blocked by none; Peter: its wording draft goes to his one review before D37 (row 153) (done 2026-10-27; the wording draft is written; the knowledge fixture has the field)
- [x] [T2](modules/content.md#t2-bun-run-documents-writes-the-committed-public-documents-and-their-inputs-hash) `bun run documents` writes the committed public documents and their inputs hash — blocked by none (T1 first is preferred) (done 2026-10-27)
- [x] [T3](modules/content.md#t3-the-documents-test-checks-the-committed-files-against-a-fresh-build) The documents test checks the committed files against a fresh build — blocked by T2 (done 2026-10-27)
- [x] [A5](modules/agents.md#a5-edit-resume-covers-the-short-labels-and-the-committed-documents) `edit-resume` covers the short labels and the committed documents — blocked by T1, T2, A2 (done 2026-10-27; label changes go to T1's wording draft until Peter approves it)
- [x] [Checkpoint agents: checks complete](modules/agents.md#checkpoint-agents-checks-complete) — after A3 to A6 (passed 2026-10-27: each check of SPEC-agents' Testing Strategy 1 has a test in `__tests__/agent-files.test.ts`; `bun test` passes, 353)
- [x] [T4](modules/content.md#t4-the-content-module-lands) The content module lands — blocked by T1, T3, A1; Peter: read the fresh-session result (done 2026-10-27; the fresh-session result is in STATUS)
- [x] [Checkpoint content: lands](modules/content.md#checkpoint-content-lands) — after T1 to T4; Peter: look at the committed `documents/` (checks passed 2026-10-27: 2-page PDF, `bun run documents` reports no change, `bun test` passes; Peter's look is open and does not stop the run)
- [x] [S2](modules/site.md#s2-buildsite-prerenders--and-resume-and-no-other-page) `buildSite()` prerenders `/` and `/resume`, and no other page — blocked by S1 (done 2026-10-27; `/` loads 110.1 KB gzip; one build per checkout at a time)
- [x] [D16](modules/deploy.md#d16-the-build-script-writes-pages-with-their-policy-tags) The build script writes pages with their policy tags — blocked by S2 (done 2026-10-27; `addPolicyTags()` refuses a page whose tag would not come first in `<head>`; from here every task also runs `bun run build:site`)
- [x] [K2](modules/knowledge.md#k2-the-source-parser-reads-deep-dives-and-interviews) The source parser reads deep dives and interviews — blocked by K1 (done 2026-10-27)
- [x] [K3](modules/knowledge.md#k3-the-core-with-its-catalog-from-approved-sources) The core with its catalog, from approved sources — blocked by K2 (done 2026-10-27)
- [x] [K4](modules/knowledge.md#k4-remove-the-deep-dive-parser) Remove the deep-dive parser — blocked by K3 (done 2026-10-27; the only `deep:` match left is the id grammar's rejection case)
- [x] [Checkpoint knowledge: old contract gone](modules/knowledge.md#checkpoint-knowledge-old-contract-gone) — after K1 to K4; Peter: review before the rules and reads (checks passed 2026-10-27: build and tests pass, the search finds only `ids.test.ts`'s rejection case, `bun run knowledge` prints the core in three parts with an empty catalog; Peter's review is open and does not stop the run)
- [x] [K5](modules/knowledge.md#k5-the-rules-on-approved-sources-stop-the-build) The rules on approved sources stop the build — blocked by K3 (done 2026-10-27; one `checkSource()` returns every problem, for K10 to reuse)
- [x] [K6](modules/knowledge.md#k6-rendered-sources-and-the-passage-id-snapshot) Rendered sources and the passage-id snapshot — blocked by K3 (runs after K5: same files) (done 2026-10-27; the 24,000-character budget sits in `checkSource()`; the real-files snapshot is empty until K11)
- [x] [K7](modules/knowledge.md#k7-readpassages-reads-approved-sources-by-id) `readPassages()` reads approved sources by id — blocked by K6 (done 2026-10-27; ids looked up in a `Map`; `skipped` waits for K8)
- [x] [K8](modules/knowledge.md#k8-readlimits-bound-every-read) `readLimits` bound every read — blocked by K7 (done 2026-10-27; 20 ids, 64 characters an id, 24,000 characters)
- [x] [K9](modules/knowledge.md#k9-publicknowledge-leaves-out-every-not-public-section) `publicKnowledge()` leaves out every `Not public` section — blocked by K3 (runs after K5: same files) (done 2026-10-27; `PublicKnowledge` in `types.ts`)
- [x] [K10](modules/knowledge.md#k10-bun-run-knowledge---draft-shows-a-draft-as-the-chat-will-read-it) `bun run knowledge --draft` shows a draft as the chat will read it — blocked by K5, K6 (done 2026-10-27; every broken rule named; no error quotes line text)
- [x] [Checkpoint knowledge: contract complete](modules/knowledge.md#checkpoint-knowledge-contract-complete) — after K5 to K10; Peter: review before the moves (checks passed 2026-10-27: every contract function exists under its spec name, `bun test` passes (588), `bun run knowledge` prints 37 core entries in 7,202 of 80,000 characters; Peter's review is open and does not stop the run)
- [x] [A7](modules/agents.md#a7-the-write-source-repo-skill) The `write-source` repo skill — blocked by A2, K10 (done 2026-10-27; step 1 proves the private repo is private)
- [ ] [13](modules/knowledge.md#task-13-long-form-interviews-one-subject-at-a-time-career-working-style-stories-opinions-side-projects-skills) Long-form interviews, one subject at a time: career, working style, stories, opinions, side projects, skills — blocked by A7, K10 (ongoing); Peter: the interviews; the kind line for interview sources, before the first interview source is approved; each source's approval
- [x] [A8](modules/agents.md#a8-the-agents-module-lands) The agents module lands — blocked by A1 to A7 and A9; Peter: read the fresh-session result (done 2026-10-27; the fresh-session check passed, its result is in STATUS)
- [x] [Checkpoint agents: lands](modules/agents.md#checkpoint-agents-lands) — after A7, A8 (passed 2026-10-27: the agents rows say built; the fresh-session check passed)
- [x] [D9](modules/deploy.md#d9-createops-gives-in-memory-parts-outside-production) `createOps()` gives in-memory parts outside production — blocked by C2 (done 2026-10-27)
- [x] [Checkpoint deploy: createOps ready](modules/deploy.md#checkpoint-deploy-createops-ready) — after D9 (passed 2026-10-27: `bun test` covers `src/ops`; C17 builds its `ChatDeps` from `createOps()`)
- [x] [A9](modules/agents.md#a9-the-type-check) The type check — blocked by C1 (done 2026-10-27; 44 files, the release skill's scripts included; CI run 40581851481 on `8e312cf`: `test`, `audit` and `audit-all` pass)
- [x] Peter: release a `@acmelabs/design-system-mcp` with `zod` 4.6.6 or later (acmelabs-15/design-system#9); then a follow-up task removes the `zod` override (row 158) — after A9; blocks nothing (done 2026-10-27: 0.3.3, issue 9 closed)
- [x] [A10](modules/agents.md#a10-the-design-system-packages-at-033-with-no-zod-override) The design system packages at 0.3.3, with no `zod` override — blocked by Peter's 0.3.3 release (done) (done 2026-10-27; `bun.lock` is version 2 again; the docs server answers 0.3.3 after Peter reconnected it)
- [x] [A11](modules/agents.md#a11-the-mockup-boards-and-the-update-mockups-skill-at-033) The mockup boards and the `update-mockups` skill at 0.3.3 — blocked by A10 (done 2026-10-27; the bundle is byte-identical, so the images stay and the canvas keeps version 46)
- [x] Peter: allow the canvas in `~/.claude/hooks/block-artifact-reads.ts` and give the conductor the canvas address (row 175) — blocks A12 (done 2026-10-27: the conductor found the address in the browser, `https://claude.ai/artifact/FhkJiqm2ZKqGPWffcTFfph`, and Peter approved the hook edit; seven sample calls behave as intended)
- [x] [A12](modules/agents.md#a12-the-update-mockups-skill-opens-the-canvas-by-its-address) The `update-mockups` skill opens the canvas by its address — blocked by A11 and Peter's hook edit (done 2026-10-27; read on the canvas only; the canvas bundle matched)
- [x] [C3](modules/chat.md#c3-one-turn-through-handlechat-a-resume-citation-kept-and-one-log-entry) One turn through `handleChat()`: a resume citation kept and one log entry — blocked by A9, C1, C2, K3 (done 2026-10-27; `finishTurn()`, the `Turn` state, a pure marker scanner and one error-code guard came with it)
- [x] [C4](modules/chat.md#c4-request-checks-with-the-chaterror-shape-and-turnlimits) Request checks with the `ChatError` shape and `turnLimits` — blocked by C3 (done 2026-10-27; a request needs a question with text; `CheckedRequest` carries only what `chat()` may use)
- [x] [C5](modules/chat.md#c5-the-read-tool-passages-read-on-the-server-ids-only-on-the-wire) The read tool: passages read on the server, ids only on the wire — blocked by C3, K7, K8 (done 2026-10-27; ids only on the wire; bounds from `readLimits`)
- [x] [C6](modules/chat.md#c6-the-read-budget-and-the-last-call) The read budget and the last call — blocked by C5 (done 2026-10-27; `readBudget(turn)` in `limits.ts`; `recordRead()` in `turn.ts`)
- [ ] [C7](modules/chat.md#c7-the-ask-about-this-read-and-request-line) The "Ask about this" read and request line — blocked by C6
- [ ] [C8](modules/chat.md#c8-markers-refusals-follow-up-questions-and-the-citation-forms) Markers: refusals, follow-up questions and the citation forms — blocked by C5
- [ ] [C9](modules/chat.md#c9-the-open-tools-open_resume-and-open_source) The open tools: `open_resume` and `open_source` — blocked by C8
- [ ] [C10](modules/chat.md#c10-the-conversation-sent-20-turns-40000-characters-earlier-reads-as-ids) The conversation sent: 20 turns, 40,000 characters, earlier reads as ids — blocked by C5
- [x] [C11](modules/chat.md#c11-the-limit-stream-stream-errors-model-errors-and-stop) The limit stream, stream errors, model errors and Stop — blocked by C3 (done 2026-10-27; the response has its own controller; a Stop that reaches the handler logs `stopped`)
- [x] [C12](modules/chat.md#c12-the-stub-anthropic-client-anthropics-limit-max_tokens-and-the-thinking-settings) The stub Anthropic client: Anthropic's limit, `max_tokens` and the thinking settings — blocked by C11 (done 2026-10-27; one wire table; unknown tool results fail closed)
- [ ] [C13](modules/chat.md#c13-the-120-second-deadline) The 120-second deadline — blocked by C12
- [ ] [C14](modules/chat.md#c14-turn-telemetry-summed-usage-and-one-chat_turn-event-per-turn) Turn telemetry: summed usage and one `chat_turn` event per turn — blocked by C4, C12
- [ ] [C15](modules/chat.md#c15-the-system-prompt-the-scope-and-audience-lines-and-the-refusal-wordings) The system prompt, the scope and audience lines, and the refusal wordings — blocked by C7 to C9; Peter: its wording draft goes to his one review before D37 (row 153)
- [ ] [Checkpoint chat: the handler](modules/chat.md#checkpoint-chat-the-handler) — after C3 to C15
- [x] [S3](modules/site.md#s3-the-resume-view-from-build-time-data-with-knowledge-ids) The resume view from build-time data, with knowledge ids — blocked by S2, K1 (done 2026-10-27; each entry carries its id in `data-knowledge-id`; `root` reaches the data)
- [x] [S4](modules/site.md#s4-the-app-bar-and-design-system-parts-in-prerendered-pages) The app bar, and design-system parts in prerendered pages — blocked by S3 (done 2026-10-27; `@acmelabs/design-system-react` 0.3.2, row 166; the name box keeps the board's colors, row 171; `/` loads 134.3 KB gzip)
- [x] [S5](modules/site.md#s5-the-static-not-found-page) The static not-found page — blocked by S4 (done 2026-10-27; no script; the build script tags it)
- [x] [S6](modules/site.md#s6-page-titles-descriptions-canonical-addresses-and-share-previews) Page titles, descriptions, canonical addresses and share previews — blocked by S3 (done 2026-10-27; `pageHead()`; no public `pages.json`; the share image comes in S26, row 173)
- [x] [S7](modules/site.md#s7-google-sans-flex-served-from-the-site-itself) Google Sans Flex served from the site itself — blocked by S4; Peter: its wording draft goes to his one review before D37 (row 153) (done 2026-10-27; one 45.2 KB WOFF; WOFF2 with Bun's Brotli is in the draft)
- [x] [S8](modules/site.md#s8-seam-1-runs-the-build-script) Seam 1 runs the build script — blocked by S2 to S7, D16 (done 2026-10-27; one build per test run; exact policy-tag check)
- [x] [S37](modules/site.md#s37-google-sans-code-served-from-the-site-itself) Google Sans Code served from the site itself — blocked by S7 (row 179) (done 2026-10-27; a 24,092-byte WOFF subset; `/` first load unchanged)
- [x] [Checkpoint site: the build output](modules/site.md#checkpoint-site-the-build-output) — after S1 to S8, D16; Peter: look at `/` and `/resume` in `bun run dev` (checks passed 2026-10-27: S1 to S8 and D16 merged, `bun test` passes; Peter's look is open and does not stop the run)
- [x] [K14](modules/knowledge.md#k14-the-knowledge-scripts-own-test-seam) The knowledge script's own test seam — blocked by K10 (row 176; before K11, because every move runs the script) (done 2026-10-27; `--root`; seam 4 in `scripts/__tests__/knowledge.test.ts`)
- [x] [K11](modules/knowledge.md#k11-move-three-deep-dives-to-sources-fednow-architecture-fednow-bundle-size-fednow-design-system) Move three deep dives to sources: `fednow-architecture`, `fednow-bundle-size`, `fednow-design-system` — blocked by K5 to K7 and Peter's approval; Peter: approve the three summaries and the moved files (done 2026-10-27; Peter approved the three summaries, row 181)
- [x] [K12](modules/knowledge.md#k12-move-three-deep-dives-to-sources-fednow-standards-mentoring-highspot-agent-workflow-highspot-ai-standards) Move three deep dives to sources: `fednow-standards-mentoring`, `highspot-agent-workflow`, `highspot-ai-standards` — blocked by K5 to K7 and Peter's approval; Peter: approve the three summaries and the moved files (done 2026-10-27; Peter approved the three summaries, row 182)
- [ ] [K13](modules/knowledge.md#k13-move-three-deep-dives-to-sources-highspot-data-table-highspot-mcp-server-highspot-streaming-markdown) Move three deep dives to sources: `highspot-data-table`, `highspot-mcp-server`, `highspot-streaming-markdown` — blocked by K5 to K7 and Peter's approval; Peter: approve the three summaries and the moved files
- [ ] [Checkpoint knowledge: lands](modules/knowledge.md#checkpoint-knowledge-lands) — after K11 to K13; Peter: read the fresh-session result

## Phase 2: the workspace and the chat column

- [x] [D8](modules/deploy.md#d8-build-settings-in-code-and-no-env-files) Build settings in code, and no `.env` files — blocked by D6 (done 2026-10-27; no spike push: `bun.lock` is version 2 again since A10)
- [x] [D17](modules/deploy.md#d17-the-routes-redirects-clean-addresses-three-api-routes-and-the-not-found-page) The routes: redirects, clean addresses, three API routes and the not-found page — blocked by D16, D6 (done 2026-10-27; `findFunctionFolders()`; the named-folder check moves to D20)
- [x] [D18](modules/deploy.md#d18-security-and-cache-headers) Security and cache headers — blocked by D17 (done 2026-10-27; one policy header per path, the worker policy route last; a 404 under `/assets/` stays immutable as the spec writes it)
- [x] [D10](modules/deploy.md#d10-the-question-log-in-upstash-deleted-by-the-store-after-90-days) The question log in Upstash, deleted by the store after 90 days — blocked by D9, D6 (done 2026-10-27; REST with `fetch`, one `/multi-exec` per write)
- [ ] [S9](modules/site.md#s9-the-preview-and-the-real-browser-test) The preview and the real-browser test — blocked by S8, D17
- [ ] [S10](modules/site.md#s10-the-career-timeline-band) The career timeline band — blocked by S9, T1
- [ ] [S11](modules/site.md#s11-the-workspace-and-its-first-view-on-wide-screens) The workspace and its first view on wide screens — blocked by S10; Peter: its wording draft goes to his one review before D37 (row 153)
- [ ] [S12](modules/site.md#s12-the-head-script) The head script — blocked by S11, D16
- [ ] [S13](modules/site.md#s13-the-theme-switch) The theme switch — blocked by S12
- [ ] [S14](modules/site.md#s14-the-workspace-contract-and-the-scope-from-the-career-timeline) The workspace contract, and the scope from the career timeline — blocked by S11
- [ ] [S15](modules/site.md#s15-the-first-view-names-the-selected-role) The first view names the selected role — blocked by S14; Peter: its wording draft goes to his one review before D37 (row 153)
- [ ] [S16](modules/site.md#s16-source-pages) Source pages — blocked by S6, S8, K3, K5, K9
- [ ] [S17](modules/site.md#s17-passage-text-as-markdown) Passage text as Markdown — blocked by S16, S13
- [ ] [S18](modules/site.md#s18-a-source-opens-in-the-document-panel-from-its-address) A source opens in the document panel from its address — blocked by S14, S16
- [ ] [S19](modules/site.md#s19-close-the-source-tab) Close the source tab — blocked by S18
- [ ] [S20](modules/site.md#s20-ask-about-this-on-resume-highlights) "Ask about this" on resume highlights — blocked by S14
- [ ] [S21](modules/site.md#s21-saved-views-in-peterkloss-views) Saved views in `peterkloss-views` — blocked by S19
- [ ] [S22](modules/site.md#s22-document-downloads-from-the-resume-view-and-the-app-bar) Document downloads from the resume view and the app bar — blocked by S11, T2
- [ ] [Checkpoint site: the wide workspace](modules/site.md#checkpoint-site-the-wide-workspace) — after S9 to S22, D17; Peter: review the preview at 1440 × 900, light and dark
- [ ] [C16](modules/chat.md#c16-the-chats-vite-plugin-virtualknowledge-and-the-device-index) The chat's Vite plugin: `virtual:knowledge` and the device index — blocked by K9, S8
- [ ] [C17](modules/chat.md#c17-the-route-file-apichatts-with-the-fake-model-outside-production) The route file `api.chat.ts`, with the fake model outside production — blocked by C14, C16, D9, S9, K11 to K13
- [ ] [S31](modules/site.md#s31-the-preview-answers-the-api-routes) The preview answers the API routes — blocked by S9, C17
- [ ] [D20](modules/deploy.md#d20-the-functions-run-on-bun-14-with-the-chats-limits) The functions run on Bun 1.4 with the chat's limits — blocked by D6, D17, S1, C17
- [ ] [Checkpoint deploy: the Vercel output](modules/deploy.md#checkpoint-deploy-the-vercel-output) — after D16 to D18, D20
- [ ] [D21](modules/deploy.md#d21-the-smoke-check-pages-headers-and-the-chats-request-checks) The smoke check: pages, headers and the chat's request checks — blocked by D18, S16, S31, C17
- [ ] [D25](modules/deploy.md#d25-the-smoke-check-compares-the-served-documents) The smoke check compares the served documents — blocked by D21, T2
- [ ] [C18](modules/chat.md#c18-a-suggested-question-sends-once-and-its-answer-streams-into-the-chat-column) A suggested question sends once, and its answer streams into the chat column — blocked by C17, S31, S14, S15
- [ ] [C19](modules/chat.md#c19-the-chat-input-send-enter-and-shiftenter-focus) The chat input: send, Enter and Shift+Enter, focus — blocked by C18
- [ ] [Checkpoint chat: the first answer](modules/chat.md#checkpoint-chat-the-first-answer) — after C16 to C19, S31; Peter: try the first answer in the preview
- [ ] [C20](modules/chat.md#c20-the-saved-conversation-one-row-per-message-restored-before-the-first-render) The saved conversation: one row per message, restored before the first render — blocked by C19, S12, S14, S21
- [ ] [C21](modules/chat.md#c21-the-scope-and-about-chips-each-question-keeps-its-own-request) The scope and About chips; each question keeps its own request — blocked by C20, S14, S18, S20
- [ ] [C22](modules/chat.md#c22-answers-for-the-popover-on-wide-columns-the-select-on-phones-and-the-anonymous-log-line) "Answers for": the popover on wide columns, the select on phones, and the anonymous-log line — blocked by C21; Peter: its wording draft goes to his one review before D37 (row 153)
- [ ] [C23](modules/chat.md#c23-answers-render-as-untrusted-markdown-with-the-link-and-image-rules) Answers render as untrusted Markdown, with the link and image rules — blocked by C18, C16
- [ ] [C24](modules/chat.md#c24-kept-citations-as-numbered-buttons-numbered-per-answer) Kept citations as numbered buttons, numbered per answer — blocked by C23, S14, S18
- [ ] [C25](modules/chat.md#c25-the-citations-card) The citations card — blocked by C24
- [ ] [C26](modules/chat.md#c26-the-answer-steps) The answer steps — blocked by C23, C12; Peter: its wording draft goes to his one review before D37 (row 153)
- [ ] [C27](modules/chat.md#c27-copy-retry-and-follow-up-questions-on-an-answer) Copy, Retry and follow-up questions on an answer — blocked by C25, C22
- [ ] [C28](modules/chat.md#c28-the-resume-card-and-the-open-tools-in-a-live-stream) The resume card, and the open tools in a live stream — blocked by C24, S3, S14
- [ ] [C29](modules/chat.md#c29-question-actions-and-long-questions) Question actions and long questions — blocked by C27
- [ ] [C30](modules/chat.md#c30-stop-answer-stopped-the-error-alert-and-the-announcements) Stop, "Answer stopped.", the error alert, and the announcements — blocked by C27
- [ ] [Checkpoint chat: the answer views](modules/chat.md#checkpoint-chat-the-answer-views) — after C20 to C30; Peter: a short look (suggested)

## Phase 3: phones, offline, limits

- [ ] [S23](modules/site.md#s23-the-workspace-on-phones) The workspace on phones — blocked by S15, S22
- [ ] [S24](modules/site.md#s24-the-resume-sheet-on-phones) The resume sheet on phones — blocked by S23
- [ ] [S25](modules/site.md#s25-the-source-sheet-on-phones) The source sheet on phones — blocked by S24, S18
- [ ] [S26](modules/site.md#s26-the-app-icon) The app icon — blocked by S7, S8
- [ ] [S27](modules/site.md#s27-the-web-manifest-and-the-install-app-button) The web manifest and the "Install app" button — blocked by S26
- [ ] [S28](modules/site.md#s28-the-service-worker-and-its-precache) The service worker and its precache — blocked by S16, S22, S27, C16
- [ ] [D19](modules/deploy.md#d19-the-service-worker-precaches-the-tagged-pages) The service worker precaches the tagged pages — blocked by S28, D17
- [ ] [S29](modules/site.md#s29-offline-after-one-visit-and-installable) Offline after one visit, and installable — blocked by S28, S21, S25
- [ ] [S30](modules/site.md#s30-the-speed-budget) The speed budget — blocked by S29
- [ ] [Checkpoint site: phones, offline, install](modules/site.md#checkpoint-site-phones-offline-install) — after S23 to S30; Peter: review the preview at 390 × 844
- [x] [D11](modules/deploy.md#d11-the-daily-cap-holds-under-parallel-requests) The daily cap holds under parallel requests — blocked by D10 (done 2026-10-27; one store transaction per reservation; https only; D12 and D15 close the interim gaps)
- [ ] [D12](modules/deploy.md#d12-daily-totals-and-the-cost-estimate) Daily totals and the cost estimate — blocked by D11
- [ ] [D13](modules/deploy.md#d13-limit-alerts-for-the-months-spend-and-the-daily-cap) Limit alerts for the month's spend and the daily cap — blocked by D12; Peter: its wording draft goes to his one review before D37 (row 153)
- [ ] [D14](modules/deploy.md#d14-the-monthly-limit-pauses-the-chat-and-one-probe-an-hour) The monthly limit pauses the chat, and one probe an hour — blocked by D13; Peter: its wording draft goes to his one review before D37 (row 153)
- [ ] [D15](modules/deploy.md#d15-a-failing-or-slow-store-never-breaks-an-answer) A failing or slow store never breaks an answer — blocked by D13; Peter: its wording draft goes to his one review before D37 (row 153)
- [ ] [Checkpoint deploy: the ops write side](modules/deploy.md#checkpoint-deploy-the-ops-write-side) — after D9 to D15
- [ ] [D22](modules/deploy.md#d22-health-runs-and-the-status-in-the-ops-module) Health runs and the status in the ops module — blocked by D15
- [ ] [D29](modules/deploy.md#d29-the-reservation-covers-the-worst-case-turn) The reservation covers the worst-case turn — blocked by D11, C15, K3; Peter: decide only if the worst case reaches $0.90
- [ ] [C31](modules/chat.md#c31-queued-questions-while-an-answer-streams-with-send-now) Queued questions while an answer streams, with Send now — blocked by C30
- [ ] [C32](modules/chat.md#c32-offline-questions-queue-survive-a-reload-and-send-when-the-network-returns) Offline: questions queue, survive a reload and send when the network returns — blocked by C31
- [ ] [C33](modules/chat.md#c33-two-tabs-one-sender-through-the-web-lock) Two tabs: one sender, through the Web Lock — blocked by C31
- [ ] [C34](modules/chat.md#c34-the-limit-reached-state-for-the-day-and-the-month) The "limit reached" state for the day and the month — blocked by C31, C17, D9
- [ ] [C35](modules/chat.md#c35-new-chat) New chat — blocked by C31, S14, S23
- [ ] [C36](modules/chat.md#c36-device-matches) Device matches — blocked by C19, C16
- [ ] [C37](modules/chat.md#c37-scroll-to-the-latest-message) Scroll to the latest message — blocked by C19
- [ ] [C38](modules/chat.md#c38-a-keyboard-only-pass) A keyboard-only pass — blocked by C26, C29, C31, C35
- [ ] [C39](modules/chat.md#c39-axe-across-the-chat-states-at-both-sizes-and-in-both-themes) axe across the chat states, at both sizes and in both themes — blocked by C22, C26, C30, C32, C34 to C36, C38
- [ ] [Checkpoint chat: queue, offline, limits](modules/chat.md#checkpoint-chat-queue-offline-limits) — after C31 to C39; Peter: review the running chat against the mockups and approve it
- [ ] [D26](modules/deploy.md#d26-the-smoke-check-in-chrome-online-and-offline) The smoke check in Chrome, online and offline — blocked by D21, S29, C19

## Phase 4: everything wired together

- [ ] [S32](modules/site.md#s32-citations-open-the-resume-and-sources-on-wide-screens) Citations open the resume and sources on wide screens — blocked by S18, S20, S31, C24, C25, C28
- [ ] [S33](modules/site.md#s33-citations-open-sheets-on-phones) Citations open sheets on phones — blocked by S32, S24, S25
- [ ] [S34](modules/site.md#s34-a-restored-conversation-never-shows-the-first-view) A restored conversation never shows the first view — blocked by S12, S23, S31, C20, C35
- [ ] [S35](modules/site.md#s35-new-chat-clears-the-saved-views) New chat clears the saved views — blocked by S21, S34, C35
- [ ] [S36](modules/site.md#s36-the-install-offer-on-phones) The install offer on phones — blocked by S24, S27, S31, C27
- [ ] [Checkpoint site: lands](modules/site.md#checkpoint-site-lands) — after S31 to S36; Peter: review the running preview against the mockups and approve it; read the fresh-session result
- [ ] [C40](modules/chat.md#c40-the-trick-questions-and-bun-run-evals) The trick questions and `bun run evals` — blocked by C10, C13 to C15
- [ ] [C41](modules/chat.md#c41-the-first-approved-eval-run-and-peters-review) The first approved eval run, and Peter's review — blocked by C40, D8 and Peter's `resume-evals` key in `.secrets/local.env`; Peter: approve each eval run (it costs money) and review its answers
- [ ] [Checkpoint chat: lands](modules/chat.md#checkpoint-chat-lands) — after C40, C41, S32 to S36; Peter: read the fresh-session result
- [ ] [D23](modules/deploy.md#d23-the-status-route) The status route — blocked by D21, D22
- [ ] [D24](modules/deploy.md#d24-the-vercel-health-job) The Vercel health job — blocked by D23, D12; Peter: its wording draft goes to his one review before D37 (row 153)
- [ ] [D27](modules/deploy.md#d27-the-smoke-checks-production-checks-and-the-protection-bypass) The smoke check's production checks and the protection bypass — blocked by D21, D23, D6
- [ ] [Checkpoint deploy: the smoke check](modules/deploy.md#checkpoint-deploy-the-smoke-check) — after D21 to D27
- [ ] [D28](modules/deploy.md#d28-bun-run-questions-reads-the-question-log-and-the-daily-totals) `bun run questions` reads the question log and the daily totals — blocked by D12, D6; Peter: put the read-only token in `.secrets/local.env` for the manual check
- [ ] [D35](modules/deploy.md#d35-runbooks-for-the-spend-alerts) Runbooks for the spend alerts — blocked by D28; Peter: review and approve the spend runbooks
- [ ] [D30](modules/deploy.md#d30-the-docs-only-list-and-the-three-shell-scripts) The docs-only list and the three shell scripts — blocked by D7, A3, C40
- [ ] [D31](modules/deploy.md#d31-no-docs-only-entry-covers-a-file-the-site-build-reads) No docs-only entry covers a file the site build reads — blocked by D30, D16

## Phase 5: launch

- [ ] [D32](modules/deploy.md#d32-the-release-check-holds-a-deployment-until-the-smoke-check-passes-in-chrome) The release check holds a deployment until the smoke check passes in Chrome — blocked by D30, D25, D26 and Peter deleting the spike project and its Upstash database; Peter: setup step 10 runs its check (spike check 12)
- [ ] [D33](modules/deploy.md#d33-the-github-health-check) The GitHub health check — blocked by D23, D25 to D27, D30, D32; Peter: the Actions secrets (setup step 9)
- [ ] [Checkpoint deploy: the workflows](modules/deploy.md#checkpoint-deploy-the-workflows) — after D30 to D33; Peter: review the workflows before setup
- [ ] [D34](modules/deploy.md#d34-the-setup-list-and-the-rollback-runbook) The setup list and the rollback runbook — blocked by D6, D32; Peter: review and approve the setup list and the rollback runbook
- [ ] [D36](modules/deploy.md#d36-runbooks-for-the-store-health-and-release-alerts) Runbooks for the store, health and release alerts — blocked by D32, D33; Peter: review and approve the runbooks
- [ ] [Checkpoint deploy: setup list and runbooks](modules/deploy.md#checkpoint-deploy-setup-list-and-runbooks) — after D34 to D36; Peter: approve them
- [ ] Peter: setup steps 1 to 11 of `docs/runbooks/setup.md`, in order: the domains bought, ntfy, the Anthropic workspaces, Vercel Pro and the import, the toolbar and protection, Upstash, the WAF rules, the spend budget, the Actions secrets, Deployment Checks (spike check 12), the domains added — after D34; blocks D37 (done 2026-10-27: step 1, the three domains bought; step 4's Pro sign-up; step 5's toolbar setting; step 8's budget)
- [ ] Peter: one review before D37: the wording drafts that `docs/design/wording-drafts.md` lists (row 153), and any checkpoint review still open ([plan](plan.md), "Running the plan") — after every task in that index has written its wording draft; blocks D37
- [ ] [D37](modules/deploy.md#d37-setup-step-11-the-vercelapp-address-the-first-release) Setup step 11: the `.vercel.app` address, the first release — blocked by D17, D32 to D34, A2, Peter's setup steps 1 to 11 and his one review before D37; Peter: confirm that the release's push reaches his phone
- [ ] [Checkpoint agents: the first release follows the release skill](modules/agents.md#checkpoint-agents-the-first-release-follows-the-release-skill) — after D37
- [ ] Peter: setup step 12: `ANTHROPIC_API_KEY`, then Redeploy with "Use project's Ignore Build Step" unchecked — after D37; blocks D38
- [ ] [D38](modules/deploy.md#d38-setup-step-13-production-passes-its-checks) Setup step 13: production passes its checks — blocked by D37 and Peter's setup step 12; Peter: run the Vercel health job by hand; ask the live chat one question; read the fresh-session result
- [ ] [Checkpoint deploy: lands](modules/deploy.md#checkpoint-deploy-lands) — after D38
- [ ] Peter: go over `docs/design/build-decisions.md` with the conductor (row 154) — at the end of the run, after every other line
