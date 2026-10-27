# Spec: agents

Approved by Peter on 2026-10-27 (decision record row 142). Peter's answers for this spec are [decision record](../docs/design/interview-2026-10-26.md) Intent paragraph and rows 140 and 141, and his confirmation of the intent on 2026-10-27. Amended on 2026-10-27 with the capability check (row 147), and with Peter's standing approval for every push (row 151). The `update-mockups` steps put Peter's approval before the new images reach `main` (a conductor decision for his review, [build decisions](../docs/design/build-decisions.md)).

## Objective

Every coding agent that works on this project starts from the same agent files and finds the right spec, rule and procedure for its work without Peter repeating them. The agents are Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI and Antigravity (the decision record's Intent paragraph: "every AI agent supported in this repository").

This module owns the agent files:

- `AGENTS.md`, the shared instructions, and `CLAUDE.md`, which imports them for Claude Code;
- the repo skills in `.agents/skills/`, and their links in `.claude/skills/`;
- each agent's project settings for the design system's docs server and for reading `AGENTS.md`;
- the README section "Working with AI agents";
- brain's record layout in `docs/agents/`.

It documents the other five modules; no module depends on it ([capability map](README.md)). It changes no module's behavior. A rule that a spec hands to the agent files keeps its home in that spec; `AGENTS.md` names the rule and points to it.

Acceptance criteria:

- `AGENTS.md` routes by module: one table names each module's spec, its folders, its test command and whether it is built. It repeats no spec. It stays at 120 lines or fewer.
- `AGENTS.md` carries the rules the specs hand to the agent files: a push that changes a site file is a release, and Peter's standing approval with its exceptions (row 151; [SPEC-deploy](SPEC-deploy.md)); the before-commit checks; `bun run evals` only with Peter's approval ([SPEC-chat](SPEC-chat.md)); an approved source changes only after Peter approves the change ([SPEC-knowledge](SPEC-knowledge.md), row 130).
- `AGENTS.md` carries Peter's capability check (row 147), and it is the check's only home: which skills and the docs server each piece of work confirms, when to check again, what to do when one is missing, and what every sub-agent brief names.
- Four repo skills exist, each as `.agents/skills/<name>/SKILL.md` with a `.claude/skills/<name>` link: `edit-resume` (updated), `write-source`, `release` and `update-mockups` (row 140).
- Gemini CLI reads `AGENTS.md` through `.gemini/settings.json`. Codex, Cursor, Copilot and Antigravity read it directly; Claude Code reads it through `CLAUDE.md`.
- Every agent that takes project settings reaches the design system's docs server with the same command.
- `bun test ./__tests__` passes (row 141; the folder follows row 144 and [decision 0025](../docs/decisions/0025-tests-beside-code.md)); it also holds the tests of the `release` skill's two checks.
- When each module lands, a fresh agent session told only "continue" reports the phase, the last step, the next step, anything red and the pending decisions, as `AGENTS.md` step 4 asks, and names the right spec for the next task (row 141).

## Tech Stack

Markdown for the agent files and skills; TOML and JSON for the agents' settings. Bun 1.4.2 and TypeScript for the test, with `Bun.YAML` for skill front matter and `Bun.TOML` for Codex's settings. No new dependency.

How each agent reads the files ([research 03](../docs/research/03-agent-instruction-files.md)):

| Agent | Instructions | Repo skills | Docs server settings |
|---|---|---|---|
| Claude Code | `CLAUDE.md`, which starts with `@AGENTS.md` | `.claude/skills/<name>` → `.agents/skills/<name>` | `.mcp.json` and `.claude/settings.json`, added by Peter |
| Codex | `AGENTS.md` | `.agents/skills/` | `.codex/config.toml` (trusted projects only) |
| Cursor | `AGENTS.md` | `.agents/skills/` | `.cursor/mcp.json` |
| GitHub Copilot in VS Code | `AGENTS.md` | `.agents/skills/` | `.vscode/mcp.json` |
| Gemini CLI | `AGENTS.md`, through `.gemini/settings.json` `context.fileName` | `.agents/skills/` | `.gemini/settings.json` `mcpServers` |
| Antigravity | `AGENTS.md` | `.agents/skills/` | `~/.gemini/config/mcp_config.json`, global; the README gives the entry |

Gemini CLI reads its own context file name by default, so `.gemini/settings.json` sets `"context": { "fileName": ["AGENTS.md"] }` ([agents.md compatibility note](https://mintlify.wiki/agentsmd/agents.md/compatibility/gemini-cli)). The plan checks the exact key against Gemini CLI's settings reference before it writes the file.

## Commands

```sh
bun test ./__tests__           # the agent files' checks, and the tests of the release skill's two checks
bun test                       # all tests, the agent files' checks included
bun .agents/skills/release/scripts/private-detail-check.ts origin/main..main   # prints one number, never a value
bun .agents/skills/release/scripts/approval-check.ts origin/main..main         # prints each change that needs Peter
```

The skills name the commands of the modules they work in, such as `bun run knowledge --draft <source id>` and `bun run build:site`. The test checks that each named command exists (Testing Strategy).

## Project Structure

```text
AGENTS.md                              shared instructions for every coding agent
CLAUDE.md                              @AGENTS.md, then the Claude command spellings
README.md                              section "Working with AI agents": the files Peter adds
docs/agents/domain.md                  how brain's skills read CONTEXT.md and the decisions
docs/agents/workflow.md                which file owns which record
docs/agents/issue-tracker.md           where issues and wayfinder records live
docs/agents/triage-labels.md           brain's triage labels
.agents/skills/edit-resume/SKILL.md    change resume.yaml and rebuild the documents
.agents/skills/write-source/SKILL.md   interview Peter on one subject and write a source for his approval
.agents/skills/release/SKILL.md        push site changes to main as a release, under Peter's standing approval
.agents/skills/update-mockups/SKILL.md change the mockups and keep the canvas, the images and the sources in step
.claude/skills/<name>                  one link per repo skill, to ../../.agents/skills/<name>
.codex/config.toml                     the docs server for Codex
.cursor/mcp.json                       the docs server for Cursor
.vscode/mcp.json                       the docs server for VS Code and Copilot
.gemini/settings.json                  AGENTS.md as Gemini CLI's context file, and the docs server (new)
__tests__/agent-files.test.ts          the agent files' checks (new)
.agents/skills/release/scripts/        the release skill's checks: private-detail-check.ts, approval-check.ts and git.ts (new)
__tests__/private-detail-check.test.ts their tests, here because Bun's test runner skips folders that start with a dot (new)
__tests__/approval-check.test.ts
```

Peter adds `.mcp.json` and `.claude/settings.json` from the README section, because an agent's safety check blocks an agent from writing its own settings ([decision 0014](../docs/decisions/0014-library-skills-and-docs-mcp.md)).

## Code Style

Agent files follow brain's writing rules (`brain:writing-for-agents`): plain ASD-STE100 sentences, the glossary's words, the positive instruction rather than a ban where one exists, one source of truth per rule. `AGENTS.md` is always loaded, so each line earns its place: it states a step or a rule an agent cannot find by looking, and points to the spec for the rest.

**`AGENTS.md`** keeps its sections, in this order: the one-paragraph description; Session start; Work through brain; Modules (new); Facts; Libraries; Code; Verify; Releases and approvals (new); Task end. The Modules table:

```markdown
## Modules

| Module | Spec | Folders | Tests | State |
|---|---|---|---|---|
| content | [SPEC-content](spec/SPEC-content.md) | `resume.yaml`, `src/content.ts`, `src/build.ts`, `documents/` | `bun test src/__tests__ scripts/__tests__/documents` | built |
| knowledge | [SPEC-knowledge](spec/SPEC-knowledge.md) | `knowledge/`, `src/knowledge/` | `bun test src/knowledge` | first version built; two-layer update is task 11 |
| site | [SPEC-site](spec/SPEC-site.md) | `src/site/`, `public/` | `bun test src/site` | spec approved |
| chat | [SPEC-chat](spec/SPEC-chat.md) | `src/chat/`, `evals/` | `bun test src/chat` | spec approved |
| deploy | [SPEC-deploy](spec/SPEC-deploy.md) | `src/deploy/`, `src/ops/`, `scripts/build-site.ts`, `.github/` | `bun test src/ops src/deploy scripts/__tests__/docs-only scripts/__tests__/smoke` | spec approved |
| agents | [SPEC-agents](spec/SPEC-agents.md) | the agent files | `bun test ./__tests__` | spec in review |

Before you change a module, read its spec to the last line and the decisions it links.
```

The task that builds a module updates its row: the folders and the test command as built, and the state.

**Work through brain** keeps `brain:ask-user-question` loaded at all times and holds the capability check (Peter, row 147). The check confirms the brain skills for the work's phase, the library and design-system skills, `brain:ask-user-question`, and the docs server through one real read-only call when the work needs it. It runs at the start of a task, at each phase change, before a sub-agent starts, after a compaction or a long run of tool calls, and before a guess at a convention. A missing skill is loaded; a docs server that does not answer stops the work that depends on it, and Peter hears what failed. Each sub-agent brief names the skills the sub-agent loads and whether it needs the docs server, tells it to run the same check, to confirm the result in its first report and to stop when a required part fails, and brings its questions back in its report.

**Libraries** names the design-system skills that views need (`choose-and-compose` always; `react-integration`, `forms-and-accessibility` or `data-layouts` as a view needs; `migration-between-releases` for an upgrade), and the docs server's first call, `resolve_version` with the installed version from `package.json` and the framework `react`. Work with no UI needs neither.

**Verify** says: run `bun run build` and `bun test` before every commit; once `package.json` has the `build:site` script (task D16), also `bun run build:site` ([SPEC-deploy](SPEC-deploy.md)). The PDF stays exactly 2 pages. The tests need Google Chrome (or `CHROME_PATH`) and poppler.

**Releases and approvals** says, each rule with its spec:

- A push to `main` that changes a site file is a release. A site file is any tracked path not in `scripts/docs-only.txt`. Peter's standing approval covers every push (row 151), apart from the approvals below and a new dependency (Code): push the rest once the before-commit checks pass. Follow the `release` skill for every push: on `main` all its steps, on any other branch its step 1 ([SPEC-deploy](SPEC-deploy.md)).
- An approved knowledge source changes only after Peter approves the change in the question dialog; the change waits on a branch until then (row 130).
- `bun run evals` costs money: run it only after Peter approves that run ([SPEC-chat](SPEC-chat.md)).
- Force-push, changing a repository's visibility, changing `scripts/docs-only.txt` (it decides which pushes are releases), deploying by hand, and anything that costs money need Peter's approval each time. Agents never sign in to a dashboard and never buy anything.

**Repo skills.** Each `SKILL.md` has front matter with `name` (the folder's name, kebab-case, 64 characters at most) and `description` (1,024 characters at most), which says what the skill does, then each case that should start it. The body is numbered steps; each step ends on a "Done when" line that an agent can check. A skill stops at each of Peter's approvals and puts the question through `brain:ask-user-question`. A skill longer than about 150 lines moves its reference material to a file beside `SKILL.md` and points to it.

The four skills, by step:

**`edit-resume`** (updated). Steps as today: trace every fact, edit `resume.yaml`, build and look, test, report ([SPEC-content](SPEC-content.md)). It adds:

- each role's `x-short`, the short name on the career timeline. Peter approves each value; no document prints it;
- after a content change, `bun run documents` rebuilds the committed public documents in `documents/`, and they are committed with the change;
- a commit of `resume.yaml` changes a site file, so the push is a release (the `release` skill).

**`write-source`** (new; [SPEC-knowledge](SPEC-knowledge.md), "How interviews are gathered" and "Drafts and approval").

1. Attach the private repo `loriensleafs/resume-private`. Done when its `interviews/` folder is readable and writable in this session.
2. Agree the one subject with Peter (`career`, `working-style`, `story`, `opinion`, `side-project` or `skill`). Done when Peter named it.
3. Interview: ask in normal chat messages, one question at a time, never through the question tool. Done when Peter says the subject is covered.
4. Save every answer word for word to `interviews/<date>-<subject>.md` in the private repo, commit and push it there, before anything is written from it. Done when the private repo's remote has the file.
5. Write the draft source `knowledge/sources/<id>.md` (`status: draft`), and the redaction list beside the raw answers in the private repo. Done when `bun run knowledge --draft <id>` names no broken rule.
6. Put the source and its redaction list to Peter for approval in the question tool, after he read it with `bun run knowledge --draft <id>`. Done when he approved, or named changes; changes go back to step 5.
7. Set `status: approved` and the date, add the decision record row, run the before-commit checks, commit. A source is read by the site build, so the push is a release (the `release` skill). Done when the commit exists and the `release` skill has pushed it.

A change to an approved source follows the edit rule: it waits on a branch until Peter approves it.

**`release`** (new; [SPEC-deploy](SPEC-deploy.md), "Releases"). While `scripts/site-changed.sh` is missing, step 1 tells Peter that the deploy module is not built. The skill then runs steps 2, 3, 4 and 6, and step 3 records every file the commits change ([plan](../tasks/plan.md), order rule 2).

1. Check what the push sends, on every push; a push of another branch, such as `prototype/deploy-spike`, runs this step only. Two scripts in `.agents/skills/release/scripts/` read the push range: the private-detail check, which exits 1 when the range holds a value of `private.yaml` and never prints one, and the approval check, which prints each change that needs Peter (AGENTS.md, "Releases and approvals"). Exit 0 lets the push go on; any other exit code stops it, and an approval goes on only with a decision record row that quotes Peter's answer. On `main`, then the site changes: `scripts/site-changed.sh origin/main main`. Exit 0 means no site file changed: the push is not a release, and steps 2, 3 and 5 are left out. Done when both checks let the push go on, and on `main` the exit code is known.
2. Run `bun run build`, `bun run build:site` and `bun test`. Done when all pass.
3. Record the push: the commit to push, the commits and the site files they change. Done when the record names the commit to push.
4. Push to `main`, after a check that `main` is still the commit that passed steps 1 and 2. Done when the push is on GitHub.
5. Watch `ci / test`, `ci / audit` and the release check on the commit with `gh`, as background commands, for at most 90 minutes from the push for the whole wait; find the CI run in at most 10 tries. Done when all three passed, one failed, no CI run appeared, or the 90 minutes are up.
6. Report, with step 3's record: live (the live commit from `/api/status` equals the pushed one), or which check failed and the limit alert Peter got. On a failure, never promote or roll back by hand; point Peter to `docs/runbooks/rollback.md`.

**`update-mockups`** (new). Only a session with the Artifact tool can change the Design canvas; any other agent stops after step 1 and tells Peter.

1. Read the design request against the approved specs. A change of product behavior needs Peter's decision first. Done when the change is settled.
2. Read the canvas "Resume site mockups" with its type's instructions, edit only the boards the change needs, and publish them in one call. Done when the canvas has a new version.
3. Copy the changed boards and `canvas.json` to `prototypes/site-mockups/boards/` on the branch `prototype/site-mockups`, render their images with its `export.ts` into a folder outside both checkouts, and commit and push the branch. Done when the branch is pushed.
4. Look at each new image for the change and for private details, then put the changed boards and their images to Peter for approval. Done when he approved, or named changes; changes go back to step 2.
5. Replace the changed images in `docs/design/mockups/`, update its README, run the before-commit checks, and commit and push `main` with Peter's approval row. Board sources never go to `main`. Done when `main` is pushed.

**Settings.** Every docs-server entry runs the same command: `bun run --silent design-system-mcp`, with the server name `acme-design-system`. `.gemini/settings.json`:

```json
{
  "context": { "fileName": ["AGENTS.md"] },
  "mcpServers": {
    "acme-design-system": { "command": "bun", "args": ["run", "--silent", "design-system-mcp"] }
  }
}
```

## Testing Strategy

Two seams (row 141), and a third for the two checks that the `release` skill runs (row 151's reviews).

1. **The agent files on disk**, `__tests__/agent-files.test.ts`, under `bun test`. It checks:
   - Every relative link in the agent files' Markdown (`AGENTS.md`, `CLAUDE.md`, `README.md`, every file in `docs/agents/` and every Markdown file of a repo skill) points to a file or folder that exists. A `#section` part is ignored. The checks read the files that `git ls-files` lists, new ones included, and a failure names the file, the line and the rule, never the file's text.
   - `CLAUDE.md` starts with `@AGENTS.md`. `AGENTS.md` has 120 lines or fewer, and its Modules table has one row for each module in the [capability map](README.md).
   - Each folder in `.agents/skills/` has a `SKILL.md` whose front matter parses, whose `name` equals the folder's name and is kebab-case with 64 characters or fewer, and whose `description` is not empty and has 1,024 characters or fewer.
   - `.claude/skills/` holds exactly one entry per repo skill, and each is a link that resolves to `.agents/skills/<name>`.
   - Every `bun run <script>` in the agent files names a script in `package.json`, or a script that a spec's Commands section names (so a skill can name a module's command before that module is built).
   - The docs server entries in `.codex/config.toml`, `.cursor/mcp.json`, `.vscode/mcp.json`, `.gemini/settings.json` and the README's `.mcp.json` block all name `acme-design-system` with `bun run --silent design-system-mcp`, and `package.json` has the `design-system-mcp` script.
   - `.gemini/settings.json` names `AGENTS.md` as a context file.
   - No agent file holds a phone number, matched by pattern (`findPhoneNumbers()` in `src/private-details.ts`; the made-up 555-0100 to 555-0199 pass). No tracked text file holds a link to a Highspot address, matched by host (decision 0024); this project's own pages and slugs pass.
2. **A fresh agent session**, by hand, when each module lands. A new session in a fresh clone is told only "continue". It passes when it reports the phase, the last completed step, the next step, anything red and the pending decisions in five lines or fewer, and names the spec of the next task. The task that lands the module records the result.
3. **The `release` skill's two checks**, `__tests__/private-detail-check.test.ts` and `__tests__/approval-check.test.ts`, under `bun test`. Each test makes a temporary repository with fake commits, and runs a script on a range.
   - The private-detail check, with a fixture `private.yaml`, prints `0` for clean commits. It counts a value in a changed file, a commit message, the committer, a commit that a later one undoes, a merge's conflict resolution, a PDF's compressed text, a Word file's text, a binary file's bytes and a file that `.gitattributes` marks as binary; an email in any letter case; and a phone number split by dashes, up to 4 separators, underscores, a zero-width space, a blank line or indentation, or written in other digits. It finds each value through the one rule for private details, `src/private-details.ts` ([SPEC-content](SPEC-content.md)). It counts a `private.yaml` that the range or an earlier commit tracks. It exits 2 with "cannot check" for a missing, empty or broken `private.yaml`, a number in it with fewer than 7 digits, an unknown range and an argument that is not a range, and it never prints a value.
   - The approval check lists a change to a docs-only list that the base holds; a change to or a move of an approved knowledge source, with `status` read as YAML (quoted, or with a comment); a new approved source and a draft that becomes approved; a change to approved logistics answers; in every `package.json` the range adds or changes, a nested one such as a prototype's included, a package that the range adds, overrides included; a package whose spec changes to anything but an exact version (a git URL, a GitHub reference, a range, `file:`, `npm:`); and a newly trusted package. It passes a new docs-only list, a draft source, a new draft source and a new exact version of a package, and exits 2 for a `package.json` that does not parse and for an argument that is not a range.

## Boundaries

- **Always:** keep each rule in its spec or decision, and point to it from `AGENTS.md`. Update a module's row when its task lands. Keep `AGENTS.md` at 120 lines or fewer. Use the glossary's words. Run `bun run build` and `bun test` (and `bun run build:site` once `package.json` has it) before a commit.
- **Ask first:** a new repo skill; a change to an approval rule in `AGENTS.md`; settings for a new agent; a new section in `AGENTS.md`.
- **Never:** an agent writes `.mcp.json` or `.claude/settings.json`; Peter adds them. Never put raw interview answers, the redaction list, the phone number or an internal link in an agent file; they live in the private repo or in `private.yaml`.

## User Stories

1. As a coding agent in a fresh session, I want one file that tells me how to start, so that I resume the right task without Peter repeating himself.
2. As a coding agent about to change a module, I want a table that names its spec, folders and tests, so that I read the right rules first.
3. As a coding agent, I want the approval rules in one short section, so that I never force-push, change an approved source or run the evals without asking.
4. As Peter, I want every agent I use to read the same instructions, so that switching tools does not change how the work is done.
5. As a Gemini CLI user, I want the project's AGENTS.md read as context, so that Gemini follows the same rules.
6. As an agent writing UI code, I want the design system's docs server in my settings, so that I use the installed release's components.
7. As Peter, I want the files I must add myself named with their exact content, so that setting up Claude Code takes one copy.
8. As a coding agent editing the resume, I want `edit-resume` to cover the short timeline names and the committed documents, so that a content change is complete in one commit.
9. As Peter, I want each interview saved word for word to my private repo before anything is written, so that my raw answers are never lost or published.
10. As a coding agent running an interview, I want the subjects, the save step and the approval step in order, so that a source never goes live unapproved.
11. As Peter, I want to see a draft source exactly as the chat will read it before I approve it, so that I approve what visitors get.
12. As Peter, I want the redaction list kept beside the raw answers, so that I can check what was removed without it ever becoming public.
13. As a coding agent about to push, I want to know whether the push is a release, so that I watch the release check only when it is.
14. As Peter, I want the checks to pass on the agent's machine before it pushes, so that every release already builds.
15. As Peter, I want the agent to watch the release check and tell me the outcome, so that I know whether the site is live.
16. As Peter, I want agents never to promote or roll back by hand, so that the live site changes only through checks or through me.
17. As a coding agent changing the mockups, I want the canvas, the images and the branch sources updated together, so that none of them falls behind.
18. As a coding agent without the Artifact tool, I want `update-mockups` to stop and tell Peter, so that I do not fake a canvas change.
19. As Peter, I want a broken link or a missing skill link caught by `bun test`, so that agent files do not rot silently.
20. As Peter, I want a skill to name only commands that exist or that a spec defines, so that a skill never sends an agent to a missing script.
21. As Peter, I want every docs server entry to run the same command, so that every agent reads the same design system release.
22. As Peter, I want a fresh session tested when each module lands, so that I know the agent files still lead to the next task.
23. As a future reader, I want the agent files to repeat no spec, so that a rule changes in one place.
24. As Peter, I want no private detail in any agent file, so that the public repo stays clean.
25. As Peter, I want every agent and every sub-agent to load the skills and reach the docs server its work needs, at its start and at each phase change, so that no convention is guessed.
26. As Peter, I want each sub-agent brief to name its skills and the same check, so that a task in a clean context works to the same rules.
27. As Peter, I want every push checked for my private details before it leaves the machine, so that a push I do not see never publishes them.

## Out of scope

- The `review-questions` skill. It waits until there is a question log to read (row 140).
- Agent evals: a headless agent run on fixed prompts (row 141).
- Git hooks and Claude Code hooks; CI already runs the checks ([SPEC-deploy](SPEC-deploy.md)).
- Changes to the other modules' behavior. This spec only moves the rules they hand to the agent files into `AGENTS.md`.
- Settings for GitHub Copilot's cloud agent, which live in the repository's GitHub settings, not in files.

## Prior-art tests

- `src/__tests__/build.test.ts`: reads real files from the repository and checks them with plain assertions; the agent files' test follows its style.
- `src/knowledge/__tests__/build.test.ts`: parses front matter with `Bun.YAML` and checks each rule with a named assertion, as the skill checks do.

## Changes to other specs

- **SPEC-deploy**, Releases: `scripts/docs-only.txt` adds `.codex/`, `.cursor/`, `.vscode/` and `.gemini/`, so a change to an agent's settings is not a release; `.mcp.json` joins the list once Peter adds it, because an entry that matches no tracked file fails the docs-only test. The line "SPEC-agents, which is not written yet, puts this rule in AGENTS.md" becomes "AGENTS.md carries this rule ([SPEC-agents](SPEC-agents.md))".
- **SPEC-deploy**, "Changes to SPEC-agents": done by this spec.
- **SPEC-knowledge**, "How interviews are gathered", step 2: the private repo exists (Peter asked for it on 2026-10-27, and it was created in his browser). The `write-source` skill runs the steps.

## Success Criteria

- `bun test ./__tests__` passes, and `bun test` passes with it.
- `AGENTS.md` has the Modules table and the Releases and approvals section, at 120 lines or fewer.
- The four repo skills exist with their links, and their steps match the specs they cite.
- `.gemini/settings.json` exists, and every docs server entry runs the same command.
- A fresh agent session passes the "continue" check at the next module landing.
- Peter approved this spec.

## Open Questions

None for Peter. For the plan: confirm Gemini CLI's `context.fileName` key in its own settings reference before writing `.gemini/settings.json`.
