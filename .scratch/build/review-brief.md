<!-- brain:plain-talk:start -->
## Talk plain

Every reply is read once, cold, by a reader who was thinking about something else a moment ago. Write for that reader, always in ASD-STE100 Simplified Technical English.

## Shape of a reply

1. Open with one line that names the subject: what this reply is about and where things stand, before any detail.
2. Give the answer or the outcome.
3. Add only what the reader needs in order to act. Leave the rest out.

## Sentences

Write ASD-STE100 Simplified Technical English:

- One idea per sentence, about 20 words at most.
- Active voice. Simple present tense where the fact is current.
- One word per concept, and the same word every time. Take each domain word from `CONTEXT.md`, the project's glossary. When `CONTEXT-MAP.md` exists at the root, the repo has several contexts and the map points to the `CONTEXT.md` for each. A word the glossary marks _Avoid_ stays out. A concept the glossary lacks is a gap to note for the domain-modeling skill, not a synonym to coin.
- Plain words. A technical term appears only when the reader has to search for it, and it is expanded the first time.

## Structure

- A table for a choice. A list for a sequence or for parallel items. Prose for a single line of argument.
- One or two sentences per bullet.
- Code, commands, paths and error text go in fenced blocks, not inside sentences.
- Headers only past about 300 words, and at most three.

## Before you send

Read the draft as that reader and check:

1. The first line says what this is about.
2. Every paragraph is four sentences or fewer.
3. Parallel items are a list, and a choice is a table.
4. Every term is one the reader already uses.

Where a check fails, re-pitch the draft: give a little context, in ASD-STE100 Simplified Technical English, in the glossary's words. Then check again. The reader's repair for a message that still does not land is the wait-what skill; a message that earns it failed one of these checks.

The sentence rules also apply to the text of a question put to the reader through the host's user-question tool. The layout of that call follows the ask-user-question skill. Load it before you compose the call.
<!-- brain:plain-talk:end -->

# Review brief: one axis of the five-axis review

You review one task's diff in Peter Kloss's resume repository, from one angle (your axis). Four other reviewers check the same diff from the other four angles at the same time. You read and report; you change no file in the repository.

## Capability check (AGENTS.md, "Work through brain") — your first action

- Before you read any file, call the Skill tool once for each skill: `brain:ask-user-question`, and every skill your prompt names for your axis. This is Peter's rule (decision record row 147). A report whose first line does not name the skills you loaded through the Skill tool is rejected and the review runs again.
- Library skills: load the ones your prompt names, with `bun run intent load <package>#<skill>` run inside the worktree. Use `bun run intent`, never `bunx intent`.
- The design system's docs server: only when your prompt says the diff has UI. Then prove it with one `resolve_version` call (version from `package.json`, framework `react`).
- If a required skill or the server fails, stop and write that into your report file. Your report's first line says what you loaded and whether the server answered (or "not needed").

## What to read

1. Your axis section: the file your prompt names. It is your checklist, from brain's `code-review-and-quality` skill. Architecture reviewers also read `.scratch/build/axes/structural-remedies.md`.
2. The standards files, inside the worktree: `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md` (the glossary), `docs/agents/domain.md`, and the "Code Style" and "Boundaries" sections of the spec your prompt names.
3. The diff: run the diff command from your prompt inside the worktree, and `git log --oneline` for the commit list. Read every changed file in full where a hunk needs its context.
4. Correctness reviewers only: the task body and the spec your prompt names, each to its last line, and the decision records the spec links that touch the diff.

## Standing rules

- A documented repo standard overrides the skill's baseline. Where the repo endorses what the baseline would flag, drop the finding.
- Skip anything tooling already enforces (formatter, linter, type checker).
- Use the glossary's words. A word the glossary marks _Avoid_ in the code is a readability finding.
- Never write a value from `private.yaml` (Peter's phone number) anywhere: not in your report, not in your reply, not when you quote test output that shows it. Write `[private number]` instead. Print counts, never values.
- Run commands only to read: `git diff`, `git log`, `git show`, `bun test <path>`, `grep`. Never edit, stage, commit, push or merge.

## Report

Write your report to the file your prompt names, in plain talk (ASD-STE100: short sentences, active voice, one idea each), under 400 words. Then reply with one line: the path and the count of findings by severity.

- Line 1: the capability check (skills loaded; server answered or not needed).
- Report per file and hunk where relevant. For each finding give the severity label, the tag, the quoted hunk, `file:line` and the fix.
- Severity labels: no prefix (required change), **Critical:** (blocks merge), **Nit:**, **Optional:** or **Consider:**, **FYI**.
- Tag a finding **hard** when it breaks a documented standard, and cite the file and the rule: `[hard: <file>, <rule>]`. Tag everything else `[judgement]`.
- When you find nothing on your axis, say so in one line, with what you checked.
- A question only Peter can answer goes last, with its options and your recommendation.
