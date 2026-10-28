# Status

Updated 2026-10-27, at the end of the third `/brain:build auto` session (a drain). This file is the one current handoff. A fresh session resumes from here without the conversation.

## Where we are

- **Phase:** build. All six specs are approved, and Peter approved the plan on 2026-10-27 (decision record row 143): the tasks are in [tasks/todo.md](../tasks/todo.md), each task's body in `tasks/modules/<module>.md`, the phases and order rules in [tasks/plan.md](../tasks/plan.md).
- **How the build runs:** `/brain:build auto use a workflow` runs each task as one run of [.scratch/build/build-task.workflow.js](../.scratch/build/build-task.workflow.js): a builder in its own git worktree (it reads [builder-brief.md](../.scratch/build/builder-brief.md)), then the tiered reviewers in parallel (rows 162 and 163), then one merge agent that writes `decisions.md`. The conductor decides each finding that is not Peter's, starts one fix agent in the builder's worktree, merges with a merge commit, and runs the checks on `main`. Up to 7 lanes run at once (row 177). The method and the notes each later task needs are in [conductor-notes.md](../.scratch/build/conductor-notes.md). A workflow agent has no Agent tool, so the script starts the reviewers itself (found on the first run).
- **Done in the third session (all merged into `main` after their reviews and fixes):**
  - **Deploy:** D6 (the spike's verdicts; Peter's rows 167 to 170), D8 (build settings in code, no `.env` files; no spike push, because `bun.lock` is version 2 again), D10 (the question log in Upstash, 90-day expiry), D17 (the routes; the named-folder check moves to D20). Checkpoint "deploy: the spike" passed its checks.
  - **Knowledge:** K6, K7, K8, K9, K10 and K14 (seam 4 for `bun run knowledge`, row 176). Checkpoint "knowledge: contract complete" passed its checks.
  - **Chat:** C4 (request checks), C5 (the read tool), C11 (stream errors and Stop; its fix check found and fixed an already-stopped turn that never ended), C12 (the stub Anthropic client; its review fixes are the last merge of this session).
  - **Site:** S4 (the app bar), S5 (the not-found page), S6 (titles and share previews), S7 (Google Sans Flex from the site itself), S8 (seam 1 runs the build script). Checkpoint "site: the build output" passed its checks.
  - **Agents:** A7 (the `write-source` skill; its review fixes are the last merge of this session), A10 (all three design-system packages at 0.3.3, no `zod` override; rows 158 and 172), A11 (the mockup boards at 0.3.3), A12 (the `update-mockups` skill opens the canvas by its address).
- **Decided this session:** rows 166 to 179 in the [decision record](design/interview-2026-10-26.md): the React wrappers package (166); D6's spike changes (167 to 170); the name box keeps the board's colors (171); every design-system package at 0.3.3 (172); the PK icon as the share image (173); C12 after C5 (174); the canvas allowed in Peter's hook and settings (175, 178); seam 4 (176); 7 lanes (177); Google Sans Code served (179). The conductor's own decisions are in [build decisions](design/build-decisions.md).
- **Peter's settings changed (row 178, with his permission prompts):** `~/.claude/hooks/block-artifact-reads.ts` lets `read` and `publish` through for the canvas `https://claude.ai/artifact/FhkJiqm2ZKqGPWffcTFfph` only; `Artifact(action:read)` left the deny list in `~/.claude/settings.json`; the Artifact hook has `onFailure: "block"`. The other 12 Artifact deny entries stay.
- **Next:** Peter runs `/clear`, then `/brain:build auto use a workflow`. The frontier, in todo order: A8 (the agents module lands, after A7), C6, C8, C10 and C13 (they share `handle-chat.ts` and `wire.ts`: one at a time), C14, C16 (the chat's Vite plugin; K9 and S8 are done), S9 (the preview and the browser test; S8 and D17 are done), S16 (source pages), S37 (Google Sans Code), D11 (the daily cap), D18 (security and cache headers). Then the moves K11 to K13, which stop for Peter's approval of each summary (row 152). The conductor notes hold a carry-forward line for each.
- **Open issues:** [01](../.scratch/knowledge/issues/01-markdown-parsers.md) and [02](../.scratch/knowledge/issues/02-testing-harness-details.md) wait on Peter's former colleagues.

## Waiting on Peter

- **Now:** run `/clear`, then `/brain:build auto use a workflow`.
- **Checkpoint reviews, when you can (they do not stop the run):** "knowledge: contract complete" (review before the moves); "site: the build output" (look at `/` and `/resume` in `bun run dev`); and the earlier ones still open: "agents: before the first release", "content: lands", "knowledge: old contract gone".
- **The moves K11 to K13:** each stops for your approval of three summaries and the moved files (row 152).
- **The Anthropic keys (setup step 3):** a `resume-evals` workspace and key ($5 a month) in `.secrets/local.env` before C41; a `resume-chat` workspace and key ($20 a month, email at $10), kept aside until setup step 12. Agents never create keys (AGENTS.md).
- **Before D37:** approve the wording drafts in one sitting ([wording drafts](design/wording-drafts.md)); S7's draft now holds a third option for the font format (WOFF2 written with Bun's own Brotli, about 16% smaller, no new package). Go over the [build decisions](design/build-decisions.md) at the end of the run.
- The rest of the setup list in [SPEC-deploy](../spec/SPEC-deploy.md#setup-list), when the deploy module reaches it: ntfy (step 2, then the budget's webhook), the real project's import (step 4), its Upstash database (step 6) and WAF rules with no persistent block (step 7, row 169), and steps 9 to 13. You sign up and pay; agents never do.
- Before D32: delete the spike project, its Upstash database, and the throwaway branches `prototype/d3-preview` and `prototype/d5-waf`; then setup step 9 replaces the Actions secret `VERCEL_AUTOMATION_BYPASS_SECRET` with the real project's value. Close the duplicate TanStack issue: `gh issue close 8825 --repo TanStack/router --comment "Duplicate of #8824, filed twice by mistake."`

## Working state

- Repository: github.com/loriensleafs/resume, public, branch `main`.
- Setup done with Peter (2026-10-27): the Vercel Pro team Peter Kloss; peterkloss.dev, pkloss.dev and pwk.dev bought in that team; the toolbar off for production; a $20 spend budget with pause off; Vercel's GitHub app limited to `loriensleafs/resume`; the spike project `resume-deploy-spike` (kept until D32).
- Nothing red. On `main`: `bun run typecheck` (75 files), `bun run build`, `bun run build:site` and `bun test` (686) pass. CI was green on `6c11b98` (run 40612334894: `test`, `audit` and `audit-all`).
- Pushes: everything up to this STATUS commit is on `origin/main`, pushed through the `release` skill under Peter's standing approval. `scripts/site-changed.sh` does not exist yet, so no release check runs; no deploy of `main` exists, so nothing live changed. `prototype/site-mockups` is at `2f3723b` (A11).
- Finished worktrees under `.claude/worktrees/` are merged; they can be removed with `git worktree remove`. The local branch `d8-deploy-spike` holds an unpushed, unneeded spike commit and can be deleted.
