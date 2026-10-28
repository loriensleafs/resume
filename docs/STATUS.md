# Status

Updated 2026-10-27, during the fourth `/brain:build auto` session, which is draining: no new task starts, and the lanes in flight merge. This file is the one current handoff. A fresh session resumes from here without the conversation.

## Where we are

- **Phase:** build. All six specs are approved, and Peter approved the plan on 2026-10-27 (decision record row 143): the tasks are in [tasks/todo.md](../tasks/todo.md), each task's body in `tasks/modules/<module>.md`, the phases and order rules in [tasks/plan.md](../tasks/plan.md).
- **How the build runs:** `/brain:build auto use a workflow` runs each task as one run of [.scratch/build/build-task.workflow.js](../.scratch/build/build-task.workflow.js): a builder in its own git worktree (it reads [builder-brief.md](../.scratch/build/builder-brief.md); the script puts the plain-talk block at the top of its prompt), then the tiered reviewers in parallel (rows 162 and 163), then one merge agent that writes `decisions.md`. The conductor decides each finding that is not Peter's, starts one fix agent in the builder's worktree, merges with a merge commit, and runs the checks on `main`. Up to 7 lanes run at once (row 177). Lanes that share only a test file, and each add new test blocks to it, may run at once ([build decisions](design/build-decisions.md)). The method and the notes each later task needs are in [conductor-notes.md](../.scratch/build/conductor-notes.md).
- **Done in the fourth session (each merged into `main` after its review and fixes):**
  - **Agents:** A8, the agents module lands. Checkpoint "agents: lands" passed, with its fresh-session check.
  - **Knowledge:** K11, K12 and K13 move the nine deep dives to sources (Peter approved each batch: rows 181, 182 and 183). The knowledge module lands: its rows say built, the core has nine catalog entries in 9,902 of 80,000 characters, each source is under 24,000, and `knowledge/deep-dives/` is gone.
  - **Chat:** C6, the read budget and the last call.
  - **Site:** S37 (Google Sans Code from the site itself, a 24,092-byte WOFF), S9 (`bun run preview` and seam 2: Google Chrome, the policy checks, the parts' upgrade, axe at both sizes).
  - **Deploy:** D18 (security and cache headers), D11 (the daily cap under parallel requests). Checkpoint "deploy: createOps ready" passed.
- **The two fresh-session checks, for Peter to read:**
  - **A8** (`main` at `e80ea1e`): phase build; last step A8's merge; next step C6 (SPEC-chat); nothing red. Its findings were fixed: STATUS names the next task's spec, the lane count in `CONTEXT.md` and `tasks/plan.md`, the knowledge row in `spec/README.md`.
  - **Knowledge** (`main` at `cde4d79`): phase build; last step S9's merge after K13's; next step C7, the "Ask about this" read (SPEC-chat); nothing red. It found STATUS eight tasks stale, because the conductor rewrote it in batches; this rewrite closes that, and the checkpoint "knowledge: lands" passes with it.
- **Lanes in flight at the drain, each in its own worktree under `.claude/worktrees/wf_*`:** S16 (source pages; its fix agent merges `main` into the branch, then fixes), D12 (daily totals; fix agent), C7 (the "Ask about this" read), C8 (markers), S26 (the app icon). The conductor merges each before the handoff, and the next STATUS rewrite records them.
- **Decided this session:** rows 180 to 183 (S9's two dev packages; the three moves). The conductor's own decisions are in [build decisions](design/build-decisions.md).
- **Next, in todo order, for the next session:** the chat lane one at a time: C9 after C8, C10, C13, C14, then C15 (spec: [SPEC-chat](../spec/SPEC-chat.md)). C16 (the chat's Vite plugin) after S16, because both change `vite.config.ts`. S10 (the career timeline) after S16, because both change `src/site/data.ts`; then S11 onward. D13 after D12. S27 after S26. C17 once C14, C16, D9, S9 and K11 to K13 are done.
- **Open issues:** [01](../.scratch/knowledge/issues/01-markdown-parsers.md) and [02](../.scratch/knowledge/issues/02-testing-harness-details.md) wait on Peter's former colleagues. Each change now goes through the `write-source` skill, because the sources are approved.

## Waiting on Peter

- **Read the two fresh-session results** (above).
- **Checkpoint reviews, when you can (they do not stop the run):** "knowledge: contract complete"; "site: the build output" (look at `/` and `/resume` in `bun run dev`); "agents: before the first release", "content: lands", "knowledge: old contract gone".
- **The Anthropic keys (setup step 3):** a `resume-evals` workspace and key ($5 a month) in `.secrets/local.env` before C41; a `resume-chat` workspace and key ($20 a month, email at $10), kept aside until setup step 12. Agents never create keys (AGENTS.md).
- **Before D37:** approve the wording drafts in one sitting ([wording drafts](design/wording-drafts.md)); S7's draft holds a third option for the font format (WOFF2 written with Bun's own Brotli, about 16% smaller, no new package). Go over the [build decisions](design/build-decisions.md) at the end of the run.
- The rest of the setup list in [SPEC-deploy](../spec/SPEC-deploy.md#setup-list), when the deploy module reaches it: ntfy (step 2, then the budget's webhook), the real project's import (step 4), its Upstash database (step 6) and WAF rules with no persistent block (step 7, row 169), and steps 9 to 13. You sign up and pay; agents never do.
- Before D32: delete the spike project, its Upstash database, and the throwaway branches `prototype/d3-preview` and `prototype/d5-waf`; then setup step 9 replaces the Actions secret `VERCEL_AUTOMATION_BYPASS_SECRET` with the real project's value. Close the duplicate TanStack issue: `gh issue close 8825 --repo TanStack/router --comment "Duplicate of #8824, filed twice by mistake."`

## Working state

- Repository: github.com/loriensleafs/resume, public, branch `main`.
- Setup done with Peter (2026-10-27): the Vercel Pro team Peter Kloss; peterkloss.dev, pkloss.dev and pwk.dev bought in that team; the toolbar off for production; a $20 spend budget with pause off; Vercel's GitHub app limited to `loriensleafs/resume`; the spike project `resume-deploy-spike` (kept until D32).
- Nothing red. On `main` after S9's merge (`cde4d79`): `bun run typecheck` (80 files), `bun run build`, `bun run build:site` and `bun test` (728) pass.
- Pushes: `origin/main` is at `a9bd45e` (A8, K11, D18, D11 and C6), pushed through the `release` skill under Peter's standing approval; K11's six approval lines passed with row 181. The commits after it go out at the drain. `scripts/site-changed.sh` does not exist yet, so no release check runs; no deploy of `main` exists, so nothing live changed. `prototype/site-mockups` is at `2f3723b` (A11).
- Peter's settings (row 178): `~/.claude/hooks/block-artifact-reads.ts` lets `read` and `publish` through for the canvas `https://claude.ai/artifact/FhkJiqm2ZKqGPWffcTFfph` only; the other 12 Artifact deny entries stay.
- Finished worktrees under `.claude/worktrees/` are merged; they can be removed with `git worktree remove`. The local branch `d8-deploy-spike` holds an unpushed, unneeded spike commit and can be deleted.
