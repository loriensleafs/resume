# Agents tasks

Spec: [SPEC-agents](../../spec/SPEC-agents.md). The order is in [todo.md](../todo.md); read these notes and your task's body only.

## Notes

- **Gemini CLI's key** (SPEC-agents, Open Questions), confirmed 2026-10-27 in geminicli.com/docs/reference/configuration: `context.fileName` (string or string[]) inside the `context` object of the project file `.gemini/settings.json`. The spec's JSON is correct. The same page says Gemini CLI was replaced by Antigravity CLI on 2026-06-18; Antigravity already reads `AGENTS.md`. The spec (row 142) keeps `.gemini/settings.json`, and the file is cheap, so A3 stands as written.
- **Agent files today.** A scratch run of the link and `bun run` checks over `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/agents/*.md` and `edit-resume` found no broken link and no unknown script. The only phone-pattern match is README's made-up example `(555) 555-0100` in the `private.yaml` block. `AGENTS.md` has 48 lines.
- **Releases.** Every agents task changes only paths on SPEC-deploy's docs-only list (`AGENTS.md`, `README.md`, `.agents/`, `.claude/`, `.gemini/`, `docs/`, `**/__tests__/**/*.test.ts`); none is a release.
- **Order inside the module.** A1 first: every build session reads `AGENTS.md`, and the Modules table and the Releases and approvals section must be in place before any other module's task runs. A2 next: `AGENTS.md` sends agents to the `release` skill before every site-change push, and T1 is the first such push. A3 and A4 extend the same test file, so they run one after the other; A3 comes before deploy's docs-only test (D30).
- **Noticed, not tasked.** SPEC-agents' Objective cites "row 7" for "every AI agent supported in this repository"; that quote is the decision record's Intent paragraph, and row 7 is about offline chat. README's "Edit the content" names `bun run build` and `bun test`; after T2 it should also name `bun run documents`. Both are outside the tasks' spec text.

## Tasks

### A1: `AGENTS.md` routes by module and carries the approval rules

Delivers: an agent in a fresh session finds the spec, folders, tests and state of each module in one table, and the approval rules in one section.
Blocked by: none
Acceptance:
- `AGENTS.md` keeps SPEC-agents' section order. It adds Modules (one row for each module in `spec/README.md`, with its spec link, folders, test command and state) and Releases and approvals (the four rules, each pointing to the spec that owns it). Verify names `bun run build:site` once the site is built. It has 120 lines or fewer (SPEC-agents, Code Style).
- It repeats no spec. Today's "Outward actions…" line in Task end moves into Releases and approvals. Today's "Before you change an area, read its spec…" line in Work through brain merges into the line under the Modules table. No rule is written twice.
- The new `__tests__/agent-files.test.ts` passes. `CLAUDE.md` starts with `@AGENTS.md`. `AGENTS.md` has 120 lines or fewer. Its Modules table has one row for each module in the capability map. Every relative link in `AGENTS.md` and `CLAUDE.md` resolves, with any `#section` part ignored.
Verify: `bun test ./__tests__`; `bun test`; `wc -l AGENTS.md`; a read-through against SPEC-agents' Code Style
Files: `AGENTS.md`, `__tests__/agent-files.test.ts`
Size: M
Needs Peter: no. The approved spec (row 142) gives both new sections and their rules. Any wording beyond those rules is an "ask first" change (SPEC-agents, Boundaries).
Notes: `scripts/docs-only.txt` and the `release` skill appear as code spans until they exist. Links to them would fail the link check. A2 turns the skill into a link. The state column gives the plan's state: content built with its amendments in T1 to T4, knowledge's first version built, site, chat and deploy with approved specs, agents being built.

### A2: The `release` repo skill

Delivers: an agent about to push follows one procedure: it finds whether the push is a release, runs the checks, records Peter's standing approval, pushes, watches the checks and reports. Before the deploy module is built, the skill stops at step 1 and says so.
Blocked by: A1
Acceptance:
- `.agents/skills/release/SKILL.md` has SPEC-agents' six steps, each ending on a "Done when" line. Step 3 records Peter's standing approval, with no question (row 151; before row 151 it asked Peter through `brain:ask-user-question`). Step 6 never promotes or rolls back by hand and points to `docs/runbooks/rollback.md` (a code span until deploy writes it). While `scripts/site-changed.sh` does not exist, step 1 stops and tells Peter that the deploy module is not built.
- `.claude/skills/release` links to `../../.agents/skills/release`. The `AGENTS.md` release rule links to the skill.
- The test also checks every repo skill. Its front matter parses. Its `name` equals the folder's name, is kebab-case and has 64 characters or fewer. Its `description` has 1 to 1,024 characters. `.claude/skills/` holds exactly one link for each skill, and each link resolves to `.agents/skills/<name>`. Every relative link in each `SKILL.md` resolves.
Verify: `bun test ./__tests__`; `ls -l .claude/skills`
Files: `.agents/skills/release/SKILL.md`, `.claude/skills/release` (link), `__tests__/agent-files.test.ts`, `AGENTS.md`
Size: M
Needs Peter: no (row 140 approved the skill)
Depends on deploy: steps 1, 2 and 5 name deploy's `scripts/site-changed.sh`, `bun run build:site`, `ci / test`, `ci / audit` and the release check. The test accepts `bun run build:site` because SPEC-deploy's Commands names it. The first real end-to-end run waits on deploy's release scripts and checks (D7, D16, D30, D32) and is D37's release (Checkpoint agents: the first release follows the release skill).

### A3: Every agent reaches the docs server, and Gemini CLI reads `AGENTS.md`

Delivers: Gemini CLI loads `AGENTS.md` as its context, and every agent's project settings start the design system's docs server with the same command.
Blocked by: A1
Acceptance:
- `.gemini/settings.json` holds `"context": { "fileName": ["AGENTS.md"] }` and the `acme-design-system` entry, as in SPEC-agents' Settings (key confirmed; see "Settled").
- The test checks the docs server entries in `.codex/config.toml` (read with `Bun.TOML`), `.cursor/mcp.json`, `.vscode/mcp.json`, `.gemini/settings.json` and README's `.mcp.json` block. Each must name `acme-design-system` with `bun run --silent design-system-mcp`, and `package.json` must have the `design-system-mcp` script. It also checks that `.gemini/settings.json` names `AGENTS.md` as a context file.
- README's "Working with AI agents" names Gemini CLI with `.gemini/settings.json`. Today it lists Codex, Cursor and VS Code only.
Verify: `bun test ./__tests__`. Optional by hand, if Peter has Gemini CLI: it lists `AGENTS.md` as loaded context in this repo.
Files: `.gemini/settings.json`, `__tests__/agent-files.test.ts`, `README.md`, `docs/research/03-agent-instruction-files.md` (the confirmed key and its date)
Size: S
Needs Peter: no

### A4: The agent files' checks cover links, scripts and private details everywhere

Delivers: `bun test` catches a broken link, a missing script or a private detail in any agent file.
Blocked by: A1
Acceptance:
- Every relative link in `README.md` and `docs/agents/*.md` resolves. (`AGENTS.md`, `CLAUDE.md` and each `SKILL.md` are checked in A1 and A2.)
- Every `bun run <script>` in the agent files names a script in `package.json` or one in a spec's Commands section. A `bun run` of a file path, such as `export.ts`, is not a script.
- No agent file holds a phone number or a link to an internal Highspot address, matched by pattern (SPEC-agents, Testing Strategy 1). The made-up 555-0100 to 555-0199 numbers pass, because README's `private.yaml` example uses one.
Verify: `bun test ./__tests__`. By hand, in a scratch copy: a broken link, `bun run nope` and a phone-like number each make the test name the file.
Files: `__tests__/agent-files.test.ts`
Size: S
Needs Peter: no
Notes: the scratch run found that today's files pass the first two checks. The exemption for the made-up range is a small choice that can be reversed. The other way, comparing against `private.yaml`, would not run in CI, and the spec asks for a pattern.

### A5: `edit-resume` covers the short labels and the committed documents

Delivers: an agent editing the resume finishes in one commit: `resume.yaml`, `x-short` where a role changes, the rebuilt `documents/`, and the push handled as a release.
Blocked by: T1, T2, A2
Acceptance:
- The skill keeps its steps and adds three things. Each role's `x-short` is approved by Peter and printed by no document. After a content change, `bun run documents` runs, the committed PDF's page count is checked (`pdfinfo documents/Peter-Kloss-Resume.pdf`), and `documents/` is committed with the change (SPEC-deploy, "Changes to other specs"). A push of `resume.yaml` is a release (the `release` skill).
- Every step ends on a "Done when" line that an agent can check. Today steps 2 and 5 have none (SPEC-agents, Code Style "Repo skills").
- `bun test ./__tests__` passes.
Verify: `bun test ./__tests__`; a read-through against SPEC-content and SPEC-agents; `bun run documents` on the current tree reports no change
Files: `.agents/skills/edit-resume/SKILL.md`
Size: S
Needs Peter: no

### A6: The `update-mockups` repo skill

Delivers: an agent changing the mockups updates the canvas, the branch sources and the images on `main` together. An agent without the Artifact tool stops after step 1 and tells Peter.
Blocked by: A2
Acceptance:
- `.agents/skills/update-mockups/SKILL.md` has SPEC-agents' five steps, each with a "Done when" line. The decision in step 1 and the approval in step 5 go through `brain:ask-user-question`. Board sources never go to `main`.
- Paths that exist only on the branch `prototype/site-mockups` (`prototypes/site-mockups/boards/`, `export.ts`) are code spans, not links.
- `.claude/skills/update-mockups` links to the skill, and `bun test ./__tests__` passes.
Verify: `bun test ./__tests__`; `ls -l .claude/skills`
Files: `.agents/skills/update-mockups/SKILL.md`, `.claude/skills/update-mockups` (link)
Size: S
Needs Peter: no
Depends on: no other module. The canvas and the branch exist today.

### A7: The `write-source` repo skill

Delivers: an agent can run one interview on one subject from start to approval. The raw answers go to the private repo first. Then come a draft source, Peter's approval, and the release.
Blocked by: A2, K10 (`knowledge/sources/` and `bun run knowledge --draft <source id>`)
Acceptance:
- `.agents/skills/write-source/SKILL.md` has SPEC-agents' seven steps in order, each with its "Done when" line. Step 3 asks in normal chat messages, never through the question tool. Step 6 and a change to an approved source (the edit rule, row 130) go through `brain:ask-user-question`.
- It holds no raw answer, no redaction list and no internal link. It names the private repo only as `loriensleafs/resume-private` and its `interviews/` folder (SPEC-agents, Boundaries "Never").
- `.claude/skills/write-source` links to the skill, and `bun test ./__tests__` passes.
Verify: `bun test ./__tests__`. By hand: `bun run knowledge --draft <a draft id>` behaves as step 5's "Done when" line says.
Files: `.agents/skills/write-source/SKILL.md`, `.claude/skills/write-source` (link)
Size: S
Needs Peter: no to write the skill. Running it needs the private repo attached, which is task 13 (the interviews).
Notes: the test would pass earlier, because SPEC-knowledge's Commands names `--draft`. Writing the skill after the command exists lets its step 5 describe the real output.

### A8: The agents module lands

Delivers: the Modules table shows agents as built, and a fresh session told only "continue" passes the check.
Blocked by: A1, A2, A3, A4, A5, A6, A7
Acceptance:
- The agents row in `AGENTS.md` and in `spec/README.md` says built. `bun test ./__tests__` and `bun test` pass (SPEC-agents, Success Criteria).
- The fresh-session check passes: a sub-agent in a fresh clone is told only "continue", Peter reads the result, and `docs/STATUS.md` records it (SPEC-agents, Testing Strategy 2).
Verify: `bun test`; the fresh-session check (a sub-agent in a fresh clone)
Files: `AGENTS.md`, `spec/README.md`, `docs/STATUS.md`
Size: S
Needs Peter: no

## Checkpoints

### Checkpoint agents: before the first release

After A1 and A2. `bun test` passes. Peter reads the new Modules and Releases and approvals sections before T1's push. Every session after this point reads them.

### Checkpoint agents: checks complete

After A3 to A6. `bun test ./__tests__` covers every check in SPEC-agents' Testing Strategy 1. A full `bun test` passes.

### Checkpoint agents: lands

After A7 and A8, once the knowledge module has its draft command (K10). A8 has set the agents rows to built and recorded the fresh-session check.

### Checkpoint agents: the first release follows the release skill

At D37, the deploy module's first release. The release follows the `release` skill end to end: site files found, the checks run locally, Peter's standing approval recorded, the push, the three checks watched with `gh`, and the outcome reported. A step that does not match the built deploy module is fixed in the skill.
