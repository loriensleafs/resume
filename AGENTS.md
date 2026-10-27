# Resume

Peter Kloss's resume: one content source (`resume.yaml`), the PDF, Word and text documents built from it, and a public site with an AI chat that answers from it. Current work belongs to [docs/STATUS.md](docs/STATUS.md).

## Session start

Complete these steps before the requested work.

1. Read [status](docs/STATUS.md), [domain routing](docs/agents/domain.md) and [the glossary](CONTEXT.md), each to its last line.
2. Read [the capability map](spec/README.md), then the spec, [plan](tasks/plan.md) and [task list](tasks/todo.md) that status names, each to its last line. Read [the record layout](docs/agents/workflow.md).
3. Check `git status` and the branch. Check `bun --version` (1.4.2 or later). Keep work you did not start.
4. Report the phase, the last completed step, the next step, anything red and the pending decisions, in five lines or fewer. Then follow Peter's request. A request to continue resumes the next approved task.

## Work through brain

Load `brain:using-brain` and pick the skill for the work. Keep `brain:ask-user-question` loaded at all times: every decision or permission for Peter goes through it, one question per call, with your recommendation and its reason. Setup, wait-what, handoff, triage and wayfinder start from Peter's prompt; when one is needed, give him the command. [CLAUDE.md](CLAUDE.md) has the Claude spellings.

**The capability check** (Peter, row 147). Confirm that every skill the current work needs is loaded: the brain skills for its phase, the library and design-system skills (see Libraries), and `brain:ask-user-question`. When the work needs the design system's docs server, prove it with one real read-only call; a tool name in your list is no proof. Run the check:

- at the start of a task, and at each phase change (plan, build, test, review, ship);
- before you start a sub-agent;
- after a compaction or a long run of tool calls;
- whenever you are about to guess a convention that a skill or the docs server would give.

A missing skill: load it, then continue. A skill that may apply: load it. A docs server that does not answer: stop the work that depends on it and tell Peter what failed; design-system facts come only from its skills and the server. Say in one line what you loaded or fixed, and nothing when all was in place.

**Sub-agent briefs.** Each brief names the skills the sub-agent loads (its brain skills, the design-system skills its part needs, and `brain:ask-user-question`) and says whether it needs the docs server. It tells the sub-agent to run the capability check at its own start and at its own phase changes, to confirm in its first report what it loaded and whether the server answered, and to stop and report when a required skill or the server fails. A sub-agent has no question tool, so its questions for Peter come back in its report.

## Modules

| Module | Spec | Folders | Tests | State |
|---|---|---|---|---|
| content | [SPEC-content](spec/SPEC-content.md) | `resume.yaml`, `src/content.ts`, `src/build.ts`, `src/print/`, `src/export/`, `documents/` | `bun test src/__tests__ scripts/__tests__/documents` | built; T1 to T4 add its amendments |
| knowledge | [SPEC-knowledge](spec/SPEC-knowledge.md) | `knowledge/`, `src/knowledge/` | `bun test src/knowledge` | first version built; K1 to K13 build the two layers |
| site | [SPEC-site](spec/SPEC-site.md) | `src/site/`, `public/` | `bun test src/site` | spec approved |
| chat | [SPEC-chat](spec/SPEC-chat.md) | `src/chat/`, `evals/` | `bun test src/chat` | spec approved |
| deploy | [SPEC-deploy](spec/SPEC-deploy.md) | `src/deploy/`, `src/ops/`, `scripts/build-site.ts`, `.github/` | `bun test src/ops src/deploy scripts/__tests__/docs-only scripts/__tests__/smoke` | spec approved |
| agents | [SPEC-agents](spec/SPEC-agents.md) | the agent files, `scripts/private-detail-check.ts` | `bun test ./__tests__ scripts/__tests__/private-detail-check.test.ts` | being built (A1 to A9) |

Before you change a module, read its spec to the last line and the decisions it links ([index](docs/decisions/README.md)). Use the glossary's words.

## Facts

Every fact in the resume source comes from Peter or from his records, such as offer letters and HR notices in his email ([decision 0001](docs/decisions/0001-facts-from-records.md)). When a fact is missing, ask Peter. Keep his wording for what he did: "helped" stays "helped", "led" appears only where he led.

Private details (the phone number) live only in the untracked `private.yaml`. Tracked files and `public` outputs hold none of them ([decision 0006](docs/decisions/0006-public-repo-private-details.md)).

For any change to resume content, use the [edit-resume skill](.agents/skills/edit-resume/SKILL.md).

## Libraries

Before you write code that uses a library, load its skill. `bun run intent list` shows the skills of the installed packages; `bun run intent load <package>#<skill>` prints one. Use `bun run intent`, never `bunx intent` or `intent install` ([decision 0014](docs/decisions/0014-library-skills-and-docs-mcp.md)).

Work on the site's or the chat's views uses the design system. Load the `@acmelabs/design-system` skills it needs: `choose-and-compose` always, then `react-integration`, `forms-and-accessibility` or `data-layouts` as the view needs, and `migration-between-releases` for an upgrade. Ask the `acme-design-system` docs server about each component, with the installed version from `package.json` and the framework `react`; its first call, `resolve_version`, proves that it answers. Work with no UI needs neither, and its capability check says so.

## Code

Write all tooling in Bun and TypeScript, with Bun's APIs ([decision 0004](docs/decisions/0004-bun-only.md)). Add a dependency only after Peter approves it. Put each test in a `__tests__/` folder beside the file it tests, named after that file ([decision 0025](docs/decisions/0025-tests-beside-code.md)).

## Verify

Run `bun run build` and `bun test` before every commit. Once `package.json` has the `build:site` script (task D16), also run `bun run build:site` ([SPEC-deploy](spec/SPEC-deploy.md)). The PDF stays exactly 2 pages. The tests need Google Chrome (or `CHROME_PATH`) and poppler (`pdftotext`, `pdffonts`).

## Releases and approvals

- A push to `main` that changes a site file is a release. A site file is any tracked path not in `scripts/docs-only.txt`. Peter's standing approval covers every push (row 151) except a force-push and a push that holds a change listed below: push the rest once the before-commit checks pass. Follow the [release skill](.agents/skills/release/SKILL.md) for every push to `main`; a push of any other branch runs the skill's private-detail check first ([SPEC-deploy](spec/SPEC-deploy.md)).
- An approved knowledge source changes only after Peter approves the change in the question dialog; the change waits on a branch until then ([SPEC-knowledge](spec/SPEC-knowledge.md), row 130).
- `bun run evals` costs money: run it only after Peter approves that run ([SPEC-chat](spec/SPEC-chat.md)).
- Force-push, changing a repository's visibility, changing `scripts/docs-only.txt` (it decides which pushes are releases), deploying by hand, and anything that costs money need Peter's approval each time. Agents never sign in to a dashboard and never buy anything ([SPEC-deploy](spec/SPEC-deploy.md)).

## Task end

1. Tick the task's acceptance in [tasks/todo.md](tasks/todo.md). Update the spec when its facts change. Put research in its note and a decision in its record.
2. Rewrite [status](docs/STATUS.md): the next action, anything red, and what waits on Peter, with the exact command when the next step is his.
3. Record what is committed, pushed or waiting for approval. Stage files by name.
