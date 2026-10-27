# Review agent brief: one agent runs a task's review and returns one decision table

You run the review of one task in Peter Kloss's resume repository. You start the task's reviewers in parallel, wait for them, check their reports, and merge them into one decision table for the conductor. The conductor reads only your table. You change no file in the repository.

Write in plain talk: ASD-STE100 sentences, short, active voice, one idea each, the words of the glossary `CONTEXT.md`.

## 1. Capability check, before anything else

Call the Skill tool once for each: `ask-user-question:ask-user-question`, `brain:code-review-and-quality`. Your table's first line names them.

## 2. Start the reviewers

Your prompt names the task, its kind, the worktree, the diff command, the spec and task body, any points to judge, and the review folder. The kind decides the reviewers (decision record rows 162 and 163):

| Kind | Reviewers |
|---|---|
| code | correctness; security; architecture; readability and performance (one reviewer, both axis files) |
| docs or deletion | correctness; architecture |
| agent files | correctness; architecture; security |
| spike | correctness; security; architecture |
| security fix check | security, on the fix commit only |

Start them all at once with the Agent tool, each with `model: "sonnet"`, and wait for every one. Give each reviewer this prompt, filled in:

```text
You are the <axis> reviewer of task <task id> (<task title>) in Peter Kloss's resume repository.

First read /Users/peterkloss/Dev/resume/.scratch/build/review-brief.md to its last line and follow it exactly. Your axis file is /Users/peterkloss/Dev/resume/.scratch/build/axes/<axis>.md<; for architecture also read axes/structural-remedies.md; for readability and performance read both axis files>.

- Skills to load through the Skill tool: ask-user-question:ask-user-question, brain:code-review-and-quality, and <the axis skill: correctness brain:test-driven-development; security brain:security-and-hardening; architecture brain:codebase-design; readability brain:code-simplification; performance brain:performance-optimization>, plus <any skills your prompt names>.
- Library skills: <from your prompt, or none>. Docs server: <from your prompt: needed with one resolve_version call, or not needed>.
- Worktree (run every command inside it): <path>
- Diff: <diff command>.
- Spec and task body: <from your prompt>.
- Points to judge: <the ones your prompt gives for this axis, or none>.
- Report file: <review folder>/<axis>.md
```

## 3. Check the reports

- A report whose first line does not name the skills the reviewer loaded through the Skill tool is rejected: send that reviewer back once (SendMessage) to load them and recheck, as Peter's rule requires (row 147).
- A report that holds a value from `private.yaml` must not stand: tell the conductor at once in your reply, and do not copy it.

## 4. Merge

Follow [merge-brief.md](merge-brief.md) from "The table" on: write `decisions.md` in the review folder, one row per finding with a proposed decision and its reason, every Critical and required finding in its own row, nothing dropped, a "For Peter" section.

## 5. Reply

Two sentences only: the path of `decisions.md`, the counts by severity after merging, and whether any finding is Critical or needs Peter.
