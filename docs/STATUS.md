# Status

Updated 2026-10-27, during the fourth `/brain:build auto` session. This file is the one current handoff. A fresh session resumes from here without the conversation.

## Where we are

- **Phase:** build. All six specs are approved, and Peter approved the plan on 2026-10-27 (decision record row 143): the tasks are in [tasks/todo.md](../tasks/todo.md), each task's body in `tasks/modules/<module>.md`, the phases and order rules in [tasks/plan.md](../tasks/plan.md).
- **How the build runs:** `/brain:build auto use a workflow` runs each task as one run of [.scratch/build/build-task.workflow.js](../.scratch/build/build-task.workflow.js): a builder in its own git worktree (it reads [builder-brief.md](../.scratch/build/builder-brief.md); the script puts the plain-talk block at the top of its prompt), then the tiered reviewers in parallel (rows 162 and 163), then one merge agent that writes `decisions.md`. The conductor decides each finding that is not Peter's, starts one fix agent in the builder's worktree, merges with a merge commit, and runs the checks on `main`. Up to 7 lanes run at once (row 177). Lanes that share only a test file, and each add new test blocks to it, may run at once ([build decisions](design/build-decisions.md)). The method and the notes each later task needs are in [conductor-notes.md](../.scratch/build/conductor-notes.md).
- **Done in the fourth session (merged into `main` after its review):**
  - **Agents:** A8, the agents module lands: the agents rows say built, and the `edit-resume`, `release` and `update-mockups` skills name `ask-user-question:ask-user-question`. Checkpoint "agents: lands" passed.
  - **The fresh-session check for A8 passed** (a sub-agent in a fresh clone of `main` at `e80ea1e`, told only "continue" and to stop after the session-start report). Its report, for Peter to read: phase build, plan approved (row 143), up to 7 lanes; last step A8's merge; next step finish A8, then C6 (spec: SPEC-chat); nothing red; waiting on Peter: this result, the K11 to K13 approvals, the open checkpoint reviews, the Anthropic keys, the wording drafts and build decisions before D37. Its findings were fixed in this STATUS commit: STATUS names the next task's spec, the lane count in `CONTEXT.md` and `tasks/plan.md`, the knowledge row in `spec/README.md`. A fresh clone also needs `bun install` before it builds.
  - **Deploy:** checkpoint "deploy: createOps ready" passed (`bun test` covers `src/ops`; C17 builds its `ChatDeps` from `createOps()`).
- **Building now, each in its own worktree under `.claude/worktrees/wf_*`:** C6 (the read budget), S37 (Google Sans Code), D18 (security and cache headers), D11 (the daily cap), S9 (the preview and the browser test), K11 (the first three moves) and S16 (source pages). A fresh conductor finds each lane's report in its workflow transcript; it merges or resumes those lanes before it starts a new task.
- **Decided this session:** row 180, Peter approved `playwright` 1.64.1 and `axe-core` 4.14.0 for S9. The conductor's own decisions are in [build decisions](design/build-decisions.md).
- **Next task in todo order once a lane is free:** C7 after C6, then C8, C10, C13 and C14, one at a time (they share `handle-chat.ts` and its test; spec: [SPEC-chat](../spec/SPEC-chat.md)). C16 after S16 (they share `vite.config.ts`). K12 and K13 after K11 (the passage-id snapshot). S10 after S9. S26 (the app icon). D12 after D11. Each move K11 to K13 stops for Peter's approval of its three summaries (row 152).
- **Open issues:** [01](../.scratch/knowledge/issues/01-markdown-parsers.md) and [02](../.scratch/knowledge/issues/02-testing-harness-details.md) wait on Peter's former colleagues.

## Waiting on Peter

- **Read the fresh-session result** for A8 (above).
- **The moves K11 to K13:** each stops for your approval of three summaries and the moved files (row 152). K11's question comes when its review is done.
- **Checkpoint reviews, when you can (they do not stop the run):** "knowledge: contract complete" (review before the moves); "site: the build output" (look at `/` and `/resume` in `bun run dev`); and the earlier ones still open: "agents: before the first release", "content: lands", "knowledge: old contract gone".
- **The Anthropic keys (setup step 3):** a `resume-evals` workspace and key ($5 a month) in `.secrets/local.env` before C41; a `resume-chat` workspace and key ($20 a month, email at $10), kept aside until setup step 12. Agents never create keys (AGENTS.md).
- **Before D37:** approve the wording drafts in one sitting ([wording drafts](design/wording-drafts.md)); S7's draft holds a third option for the font format (WOFF2 written with Bun's own Brotli, about 16% smaller, no new package). Go over the [build decisions](design/build-decisions.md) at the end of the run.
- The rest of the setup list in [SPEC-deploy](../spec/SPEC-deploy.md#setup-list), when the deploy module reaches it: ntfy (step 2, then the budget's webhook), the real project's import (step 4), its Upstash database (step 6) and WAF rules with no persistent block (step 7, row 169), and steps 9 to 13. You sign up and pay; agents never do.
- Before D32: delete the spike project, its Upstash database, and the throwaway branches `prototype/d3-preview` and `prototype/d5-waf`; then setup step 9 replaces the Actions secret `VERCEL_AUTOMATION_BYPASS_SECRET` with the real project's value. Close the duplicate TanStack issue: `gh issue close 8825 --repo TanStack/router --comment "Duplicate of #8824, filed twice by mistake."`

## Working state

- Repository: github.com/loriensleafs/resume, public, branch `main`.
- Setup done with Peter (2026-10-27): the Vercel Pro team Peter Kloss; peterkloss.dev, pkloss.dev and pwk.dev bought in that team; the toolbar off for production; a $20 spend budget with pause off; Vercel's GitHub app limited to `loriensleafs/resume`; the spike project `resume-deploy-spike` (kept until D32).
- Nothing red. On `main` after A8's merge (`e80ea1e`): `bun run typecheck` (75 files), `bun run build`, `bun run build:site` and `bun test` (686) pass. CI was green on `6c11b98` (run 40612334894: `test`, `audit` and `audit-all`).
- Pushes: `origin/main` is at `68306a3`. A8's merge, row 180 and this STATUS are committed on `main` and not pushed yet; the conductor pushes through the `release` skill every 2 or 3 merges. `scripts/site-changed.sh` does not exist yet, so no release check runs; no deploy of `main` exists, so nothing live changed. `prototype/site-mockups` is at `2f3723b` (A11).
- Peter's settings (row 178): `~/.claude/hooks/block-artifact-reads.ts` lets `read` and `publish` through for the canvas `https://claude.ai/artifact/FhkJiqm2ZKqGPWffcTFfph` only; the other 12 Artifact deny entries stay.
- Finished worktrees under `.claude/worktrees/` from earlier sessions are merged; they can be removed with `git worktree remove`. The local branch `d8-deploy-spike` holds an unpushed, unneeded spike commit and can be deleted.
