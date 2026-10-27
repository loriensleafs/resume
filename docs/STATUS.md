# Status

Updated 2026-10-27, during the second `/brain:build auto` session. This file is the one current handoff. A fresh session resumes from here without the conversation.

## Where we are

- **Phase:** build. All six specs are approved, and Peter approved the plan on 2026-10-27 (decision record row 143): the tasks are in [tasks/todo.md](../tasks/todo.md), each task's body in `tasks/modules/<module>.md`, the phases and order rules in [tasks/plan.md](../tasks/plan.md).
- **How the build runs (rows 149 to 154):** `/brain:build auto` gives each task to a fresh sub-agent in its own git worktree, up to 3 lanes at once. After each task, five reviewers (one per axis) check its diff; the conductor session decides the findings that are not Peter's, has them fixed, merges with a merge commit, and runs `bun run build` and `bun test` on `main`. Peter's standing approval covers every push (row 151), through the `release` skill's private-detail guard and approval check. The run stops for Peter only for a set-up item only he can do, source work, a critical review finding, or an approval row 151 keeps; checkpoint reviews do not stop it. Wordings are drafted per task and Peter approves them in one sitting before D37 (row 153). The method and the notes each later task needs are in [.scratch/build/conductor-notes.md](../.scratch/build/conductor-notes.md); the reviewer brief and the axis checklists are beside it.
- **Done in the second session (merged into `main` after a five-axis review and its fixes):**
  - **Agents:** A9 (`bun run typecheck` before every commit and in CI, Bun 1.4.4, the `zod` override; CI run 40581851481 green); A5 (`edit-resume` covers the short labels and the committed documents). Checkpoint "agents: checks complete" passed.
  - **Content:** T1 (each role's `x-short`; its wording draft is written); T4 (the module lands built; research 12 holds the fixed-date verdict). The content module is built; checkpoint "content: lands" passed its checks.
  - **Site:** S2 (`buildSite()` prerenders `/` and `/resume` into a chosen output folder; `/` loads 110.1 KB gzip).
  - **Deploy:** D16 (`bun run build:site` with `--out` and `--root`; `addPolicyTags()` refuses a page whose tag would not come first in `<head>`; CI run 40587168580 green); D3 (spike checks 4, 5 and 10 pass, 10 by Peter in Chrome, row 160; check 11 passes for the production setting, the header's own effect is a gap for D6).
  - **Knowledge:** K4 (one parser; the old contract is gone). Checkpoint "knowledge: old contract gone" passed its checks.
  - **Upstream:** S2 found a TanStack Start prerender bug; Peter filed it as TanStack/router#8824 (row 161), with the public reproduction `loriensleafs/tanstack-start-prerender-root-repro`.
- **Building now:** D4 (spike part 4, on `prototype/deploy-spike`), D5 (spike part 5, on its own throwaway branch `prototype/d5-waf`, so its pushes never replace D4's production deployment), K5 (the rules on approved sources).
- **Done in the first session (all merged into `main`, each after a five-axis review and its fixes):**
  - **Chat:** C1 (TanStack AI 1.0.0 and `@tanstack/markdown` installed; every SPEC-chat name checked; SPEC-chat amended by rows 155 and 156: thinking events stay on the server, the browser shows the thinking summary in the answer steps, `SERVER_ERROR` for a thrown stream, an event allowlist, a 20,000-character thinking cap); C2 (the question log, budget and telemetry contracts and the contract suite).
  - **Content:** T2 (`bun run documents` writes the committed public documents and a per-file inputs manifest); T3 (the documents test compares the committed files with a fresh build); A4's shared rule for private details, `src/private-details.ts`.
  - **Knowledge:** K2 (the source parser; `Not public` text can never enter a passage); K3 (the core with its catalog from approved sources; the nine deep dives leave the core until K11 to K13 move them).
  - **Site:** S1 (the TanStack Start app on Bun with Nitro's Vercel output; first-load JavaScript on `/` is 107.6 KB gzip before any view).
  - **Deploy:** D7 (CI: `test`, `audit`, `audit-all`); D9 (`createOps()` with the chat's in-memory parts outside production); D1 and D2 (spike checks 1 to 3 pass on `prototype/deploy-spike`, tip `54a410e`).
  - **Agents:** A3 (every agent reaches the docs server; Gemini CLI reads `AGENTS.md`); A4 (the agent files' checks: links, scripts, phone numbers and Highspot links in every tracked text file); A6 (the `update-mockups` skill; the mockups branch, tip `e87a267`, renders again); the push rules of rows 151 to 159 with the tested guards in `.agents/skills/release/scripts/`.
- **Decided this session (decision record rows 149 to 159):** the full review per task and 3 lanes (149, 150); the standing approval for pushes (151); when the build stops (152, 154); wording drafts (153); thinking stays on the server and the browser shows the thinking summary (155, 156); Bun's own type checker with a minimum of Bun 1.4.4, a new task A9 before C3 (157); a `zod` override for the docs-server package, with Peter's fixed release tracked in `acmelabs-15/design-system#9` (158); React's type packages (159). The conductor's own decisions are listed for Peter's end review in [build decisions](design/build-decisions.md).
- **Earlier decisions and facts that still hold:** deep dives become sources the chat opens on demand ([0015](decisions/0015-sources-on-demand.md)); two layers, a cached core and sources read through a server tool ([0016](decisions/0016-two-layer-knowledge.md)); the saved session on the visitor's device ([0017](decisions/0017-saved-visitor-session.md)); peterkloss.dev with pkloss.dev and pwk.dev redirecting ([0018](decisions/0018-domains.md)). Interview answers live word for word in the private repo `loriensleafs/resume-private` ([0024](decisions/0024-private-interview-repo.md)); new material comes from long-form interviews in normal chat messages, one subject at a time. The mockups are approved (row 75): images in [docs/design/mockups/](design/mockups/README.md), sources on `prototype/site-mockups`, the private Design canvas "Resume site mockups" as the working copy.
- **Next:** the run goes on. The frontier, in todo order: K9 (after K5, same files), C3 (A9 has landed), S3, then K6 after K5, D6 after D4 and D5, and the tasks they unblock. Every task now runs `bun run typecheck`, `bun run build`, `bun run build:site` and `bun test` before its commit.
- **The fresh-session check for the content landing (T4):** see "Fresh-session checks" below.
- **Open issues:** [01](../.scratch/knowledge/issues/01-markdown-parsers.md) names the streaming Markdown parsers once Peter hears from his former boss; [02](../.scratch/knowledge/issues/02-testing-harness-details.md) confirms the FedNow testing harness with a former colleague.

## Waiting on Peter

- **Now:** close the duplicate TanStack issue: `gh issue close 8825 --repo TanStack/router --comment "Duplicate of #8824, filed twice by mistake."`
- **Checkpoint reviews, when you can (they do not stop the run):** "agents: before the first release" (read `AGENTS.md`'s Modules and Releases and approvals sections); "content: lands" (look at the committed `documents/`); "knowledge: old contract gone" (review before the rules and reads); and the fresh-session result below.
- **Row 158:** release a `@acmelabs/design-system-mcp` that uses `zod` 4.6.6 or later ([issue #9](https://github.com/acmelabs-15/design-system/issues/9)); a short follow-up task then removes the override.
- **Before D37:** approve the wording drafts in one sitting ([wording drafts](design/wording-drafts.md)), and go over the [build decisions](design/build-decisions.md) at the end of the run.
- The rest of the setup list in [SPEC-deploy](../spec/SPEC-deploy.md#setup-list), when the deploy module reaches it: ntfy (step 2, then the budget's webhook), the Anthropic workspaces and keys (step 3), the real project's import (step 4), its Upstash database (step 6) and WAF rules (step 7), and steps 9 to 13. You sign up and pay; agents never do.
- Delete the spike project and its Upstash database before D32.

## Working state

- Repository: github.com/loriensleafs/resume, public, branch `main`.
- Setup done with Peter (2026-10-27): the Vercel Pro team Peter Kloss; peterkloss.dev, pkloss.dev and pwk.dev bought in that team (each renews on Oct 27, 2027); the team's Vercel Toolbar off for production; a $20 spend budget with pause off; Vercel's GitHub app limited to `loriensleafs/resume`; the spike project `resume-deploy-spike` (production branch `prototype/deploy-spike`, root `prototypes/deploy-spike`, protected, Upstash database, three WAF rules).
- Nothing red. `bun run typecheck`, `bun run build:site` and `bun test` (358) pass on `main`. CI (`.github/workflows/ci.yml`) runs on every push: `test` (with the type check and `bun run build:site`), `audit` and `audit-all`, all green on `4460190`.
- Pushes: everything up to this STATUS commit is on `origin/main`, pushed through the `release` skill under Peter's standing approval. No deploy of `main` exists yet, so nothing live changed.
- Throwaway branches: `prototype/d3-preview` (D3's preview attempt) stays for D6; it and `prototype/d5-waf` go when the spike project goes, before D32.
- Finished worktrees under `.claude/worktrees/` are merged; they can be removed with `git worktree remove`.

## Fresh-session checks

- **Content lands (T4), 2026-10-27:** pending; the result goes here.
