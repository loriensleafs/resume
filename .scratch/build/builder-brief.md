# Builder brief: one task of a `/brain:build auto` run

You build one plan task in Peter Kloss's resume repository, in your own git worktree. Your prompt gives the task, its spec, the skills to load and its carry-forward notes. The conductor reads only your structured result and your report file.

## 1. Set up the worktree, before anything else

1. `git rev-parse --show-toplevel` shows your worktree. Run every command inside it. Never edit a file in `/Users/peterkloss/Dev/resume` itself; read from there only the briefs your prompt names.
2. Run `git merge --ff-only main`. Your base is `git rev-parse HEAD` after it.
3. If `node_modules` is a symbolic link, run `unlink node_modules`. Then run `bun install`, so no install writes into the main checkout.
4. Run `cp /Users/peterkloss/Dev/resume/private.yaml .`. The file is untracked: never stage it, never print its values.

## 2. Capability check (AGENTS.md, "Work through brain"; row 147)

- Load through the Skill tool: `ask-user-question:ask-user-question`, `brain:incremental-implementation`, `brain:test-driven-development`, and each skill your prompt names.
- Library skills: run `bun run intent load <package>#<skill>` inside the worktree for each one your prompt names. Never `bunx intent`.
- UI work: load the design-system skills your prompt names. Prove the `acme-design-system` docs server with one `resolve_version` call (version 0.3.3, framework `react`; the pin in `package.json`), then ask it about each part you use.
- Run the check again at each phase change (tests, code, verification, commit) and after a long run of tool calls.
- When a required skill or the docs server fails, stop: set `stopped: true` and write what failed in your report.
- Your report's first line names what you loaded and whether the server answered (or "not needed").

## 3. Read

1. `AGENTS.md`, `CONTEXT.md` and `docs/agents/domain.md` in the worktree, each to its last line. The harness's copy of `AGENTS.md` can be older than the file; the file wins.
2. Your task's module file in `tasks/modules/`: its notes or conventions section, and your task's body.
3. The spec your prompt names, to its last line, and the decision records it links that touch your task.
4. The carry-forward notes in your prompt.

## 4. Build

- Peter's standing rule: the best option, not the easiest or the fastest, even when it means more work. Fix the cause, not the symptom.
- Test first: one failing test at a seam the spec names, then the code that makes it pass, then the next test. Write no test at a seam the spec does not name. A docs-only task checks its text against its sources instead.
- Use the glossary's words in names, tests and messages. A concept the glossary lacks is a gap: note it in your report.
- Touch only your task's files (its Files line). Note anything else you see in your report.
- Never edit `tasks/todo.md` or `docs/STATUS.md`. The conductor updates them after the merge.
- A task with a wording draft writes it into its own file in `docs/design/wording-drafts/` and adds its line to `docs/design/wording-drafts.md` (row 153).
- Add no package that is not in `package.json`, unless your prompt says Peter approved it. A need for one is a question.
- Never write a value from `private.yaml` (Peter's phone number), a secret or a token anywhere: write `[private number]`. Print counts, never values.

## 5. Verify, then commit

1. Before your commit, run `bun run typecheck`, `bun run build`, `bun run build:site` and `bun test`. Each passes. The PDF stays exactly 2 pages.
2. Stage files by name (`git add <path>`), never `git add -A` or `git add .`. Check with `git status` that nothing of yours stays unstaged and that `private.yaml` is not staged.
3. Make one commit with a conventional message (`feat(site): …`). Its last line is:

   ```text
   Are you pondering what I am pondering? — 🧠
   ```

4. Do not push. A spike task pushes its prototype branch only when its prompt says so.

## 6. Questions for Peter

You have no question tool. A decision that the spec and the task body do not settle, and that is Peter's (two defensible paths that change what gets built), comes back as a question: the context, the options with their costs, and your recommendation with its reason. Decide a small reversible choice yourself and say what decided it. When a question blocks your task, stop before the commit and set `stopped: true`.

## 7. Report

Write your full report to the report path in your prompt, in plain talk, under 600 words:

- Line 1: the capability check.
- What you built, slice by slice, and the commit.
- Each check's result with its counts (type-check files; tests pass, fail, skip).
- Your decisions and their reasons; what you noticed and did not touch; glossary gaps.
- The questions for Peter, each with its options and your recommendation.

Then return the structured result. Its `questions` repeats each question in full.
