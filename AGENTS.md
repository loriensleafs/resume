# Resume

Peter Kloss's resume: one content source (`resume.yaml`), the PDF, Word and text documents built from it, and a public site with an AI chat that answers from it. Current work belongs to [docs/STATUS.md](docs/STATUS.md).

## Session start

Complete these steps before the requested work.

1. Read [status](docs/STATUS.md), [domain routing](docs/agents/domain.md) and [the glossary](CONTEXT.md), each to its last line.
2. Read [the capability map](spec/README.md), then the spec, [plan](tasks/plan.md) and [task list](tasks/todo.md) that status names, each to its last line. Read [the record layout](docs/agents/workflow.md).
3. Check `git status` and the branch. Check `bun --version` (1.4.2 or later). Keep work you did not start.
4. Report the phase, the last completed step, the next step, anything red and the pending decisions, in five lines or fewer. Then follow Peter's request. A request to continue resumes the next approved task.

## Work through brain

Load `brain:using-brain` and pick the skill for the work. Before you put a decision or a permission to Peter, load `brain:ask-user-question`: one question per call, with your recommendation and its reason. Setup, wait-what, handoff, triage and wayfinder start from Peter's prompt; when one is needed, give him the command. [CLAUDE.md](CLAUDE.md) has the Claude spellings.

Before you change an area, read its spec and the decisions that touch it ([index](docs/decisions/README.md)). Use the glossary's words.

## Facts

Every fact in the resume source comes from Peter or from his records, such as offer letters and HR notices in his email ([decision 0001](docs/decisions/0001-facts-from-records.md)). When a fact is missing, ask Peter. Keep his wording for what he did: "helped" stays "helped", "led" appears only where he led.

Private details (the phone number) live only in the untracked `private.yaml`. Tracked files and `public` outputs hold none of them ([decision 0006](docs/decisions/0006-public-repo-private-details.md)).

For any change to resume content, use the [edit-resume skill](.agents/skills/edit-resume/SKILL.md).

## Libraries

Before you write code that uses a library, load its skill. `bun run intent list` shows the skills of the installed packages; `bun run intent load <package>#<skill>` prints one. Use `bun run intent`, never `bunx intent` or `intent install` ([decision 0014](docs/decisions/0014-library-skills-and-docs-mcp.md)).

For design-system components, also ask the `acme-design-system` MCP server. Pass the installed version from `package.json` and the framework `react`.

## Code

Write all tooling in Bun and TypeScript, with Bun's APIs ([decision 0004](docs/decisions/0004-bun-only.md)). Add a dependency only after Peter approves it. Put each test in a `__tests__/` folder beside the file it tests, named after that file ([decision 0025](docs/decisions/0025-tests-beside-code.md)).

## Verify

Run `bun run build` and `bun test` before every commit. The PDF stays exactly 2 pages. The tests need Google Chrome (or `CHROME_PATH`) and poppler (`pdftotext`, `pdffonts`).

## Task end

1. Tick the task's acceptance in [tasks/todo.md](tasks/todo.md). Update the spec when its facts change. Put research in its note and a decision in its record.
2. Rewrite [status](docs/STATUS.md): the next action, anything red, and what waits on Peter, with the exact command when the next step is his.
3. Record what is committed, pushed or waiting for approval. Stage files by name.

Outward actions need Peter's approval each time: force-push, changing repository visibility, deploying, and anything that costs money.
