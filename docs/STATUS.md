# Status

Updated 2026-10-27, during the fifth `/brain:build auto` session. This file is the one current handoff. A fresh session resumes from here without the conversation.

## Where we are

- **Phase:** build. All six specs are approved, and Peter approved the plan on 2026-10-27 (decision record row 143): the tasks are in [tasks/todo.md](../tasks/todo.md), each task's body in `tasks/modules/<module>.md`, the phases and order rules in [tasks/plan.md](../tasks/plan.md).
- **How the build runs:** `/brain:build auto use a workflow` runs each task as one run of [.scratch/build/build-task.workflow.js](../.scratch/build/build-task.workflow.js): a builder in its own git worktree (it reads [builder-brief.md](../.scratch/build/builder-brief.md); the script puts the plain-talk block at the top of its prompt), then the tiered reviewers in parallel (rows 162 and 163), then one merge agent that writes `decisions.md`. The conductor decides each finding that is not Peter's, starts one fix agent in the builder's worktree (it merges `main` into the branch first when `main` moved under it), merges with a merge commit, and runs the checks on `main`. Up to 7 lanes run at once (row 177). A task starts as soon as its blockers are done, even when it shares a source file with a running lane (Peter, fifth session): each such lane gets its own part of the file in its brief. The method and the notes each later task needs are in [conductor-notes.md](../.scratch/build/conductor-notes.md); the conductor's decisions are in [build decisions](design/build-decisions.md).
- **Done in the fifth session (each merged into `main` after its review and fixes; the checks on `main` pass, 899 tests):**
  - **Chat:** C9 (the open tools; `tool-names.ts`; one fixed `open_source` error text on the wire), C13 (the 120-second deadline; `run.ts` and `request-checks.ts` came out of `handle-chat.ts`), C14 (turn telemetry; `finishRejected()`), C16 (the chat's Vite plugin, `virtual:knowledge` and the device index).
  - **Site:** S27 (the web manifest and "Install app"; the browser test's cleanup now has a 30 s limit).
  - **Deploy:** D13 (limit alerts for the month's spend and the daily cap; each push stops after 3 s).
- **In flight when this was written:** S10 (the career timeline; in its fix step), C10 (the conversation sent), C15 (the system prompt), C17 (the route file `api.chat.ts`), D14 (the monthly limit and its probe), D15 (a failing store never breaks an answer). The conductor starts no new task, merges these as they finish, and then drains: it rewrites this file again and pushes.
- **Process fixes this session:** reviewers never build the site (they share one worktree, and their builds collided); the workflow's capability check rejects a report that does not name each library skill (three correctness reviewers had skipped theirs, row 147); a review row that carries a finding to a finished task is changed to "fix now".
- **Decided this session:** no new decision-record row. The conductor's decisions are the fifth session's rows in [build decisions](design/build-decisions.md). Two are for Peter's end review: the passage labels and the 61-character source title (C16 with C7's row), and the first-load budget of `/` (189.2 KB of 200 KB after S10; the task that would pass it loads the overlay parts on first use).
- **Next, after the drain: Peter runs `/clear`, then `/brain:build auto use a workflow`.** The frontier once the lanes in flight merge, in todo order:
  - **Site** (spec: [SPEC-site](../spec/SPEC-site.md)): S11 (the workspace and its first view; after S10), S31 (the preview answers the API routes; right after C17).
  - **Chat** (spec: [SPEC-chat](../spec/SPEC-chat.md)): C40 (the trick questions and `bun run evals`; after C10 and C15). C18 waits on S31, S14 and S15.
  - **Deploy** (spec: [SPEC-deploy](../spec/SPEC-deploy.md)): D20 (the functions on Bun 1.4; after C17), D22 (health runs; after D15), D29 (the reservation covers the worst-case turn; after C15).
- **Open issues:** [01](../.scratch/knowledge/issues/01-markdown-parsers.md) and [02](../.scratch/knowledge/issues/02-testing-harness-details.md) wait on Peter's former colleagues. Each change now goes through the `write-source` skill, because the sources are approved.

## Waiting on Peter

- **Now:** nothing stops the run. When the conductor says the drain is done, run `/clear`, then `/brain:build auto use a workflow`.
- **Checkpoint reviews, when you can (they do not stop the run):** "knowledge: contract complete"; "site: the build output" (look at `/`, `/resume` and a source page such as `/sources/fednow-architecture` in `bun run dev`); "agents: before the first release", "content: lands", "knowledge: old contract gone".
- **The Anthropic keys (setup step 3):** a `resume-evals` workspace and key ($5 a month) in `.secrets/local.env` before C41; a `resume-chat` workspace and key ($20 a month, email at $10), kept aside until setup step 12. Agents never create keys (AGENTS.md).
- **Before D37:** approve the wording drafts in one sitting ([wording drafts](design/wording-drafts.md)); this session added C16's device-index labels and D13's `daycap` push, and C15, D14 and D15 add theirs. S7's draft holds a third option for the font format (WOFF2 written with Bun's own Brotli, about 16% smaller, no new package). Go over the [build decisions](design/build-decisions.md) at the end of the run.
- The rest of the setup list in [SPEC-deploy](../spec/SPEC-deploy.md#setup-list), when the deploy module reaches it: ntfy (step 2, then the budget's webhook), the real project's import (step 4), its Upstash database (step 6) and WAF rules with no persistent block (step 7, row 169), and steps 9 to 13. You sign up and pay; agents never do.
- Before D32: delete the spike project, its Upstash database, and the throwaway branches `prototype/d3-preview` and `prototype/d5-waf`; then setup step 9 replaces the Actions secret `VERCEL_AUTOMATION_BYPASS_SECRET` with the real project's value. Close the duplicate TanStack issue: `gh issue close 8825 --repo TanStack/router --comment "Duplicate of #8824, filed twice by mistake."`

## Working state

- Repository: github.com/loriensleafs/resume, public, branch `main`.
- Setup done with Peter (2026-10-27): the Vercel Pro team Peter Kloss; peterkloss.dev, pkloss.dev and pwk.dev bought in that team; the toolbar off for production; a $20 spend budget with pause off; Vercel's GitHub app limited to `loriensleafs/resume`; the spike project `resume-deploy-spike` (kept until D32).
- Nothing red. On `main` after D13's merge (`1676d0d`): `bun run typecheck` (94 files), `bun run build`, `bun run build:site` and `bun test` (899) pass. With seven lanes the machine's load average reached 87; a check that fails only on a time limit under that load is run again alone before any conclusion.
- Pushes: this session's merges are pushed through the `release` skill under Peter's standing approval (row 151). `scripts/site-changed.sh` does not exist yet, so no release check runs; no deploy of `main` exists, so nothing live changes. `prototype/site-mockups` is at `2f3723b` (A11).
- Peter's settings (row 178): `~/.claude/hooks/block-artifact-reads.ts` lets `read` and `publish` through for the canvas `https://claude.ai/artifact/FhkJiqm2ZKqGPWffcTFfph` only; the other 12 Artifact deny entries stay.
- Finished worktrees under `.claude/worktrees/` are merged; they can be removed with `git worktree remove`. The local branch `d8-deploy-spike` holds an unpushed, unneeded spike commit and can be deleted.
