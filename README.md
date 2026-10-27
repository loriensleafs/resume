# Resume

Peter Kloss's resume, kept as one YAML file and built into a designed PDF, a Word file and a plain-text file. A public site with an AI chat that answers questions about the resume is in progress.

All tooling is Bun and TypeScript.

## Build the documents

You need [Bun](https://bun.sh) and Google Chrome or Chromium.

```sh
bun install
bun run build
```

`dist/public/` gets the PDF, Word and text files without the phone number. When `private.yaml` exists, `dist/private/` gets the same files with it; send those to employers. Open `resume.html` in either folder to preview the PDF layout. Set `CHROME_PATH` to use a different browser.

`private.yaml` is never committed. Create it once on each machine:

```yaml
basics:
  phone: (555) 555-0100
```

## Edit the content

Edit `resume.yaml`, then run `bun run build` and `bun test`. Every fact comes from Peter or his records; see [decision 0001](docs/decisions/0001-facts-from-records.md). AI agents use the [edit-resume skill](.agents/skills/edit-resume/SKILL.md).

## Test

```sh
bun test
```

The tests also need poppler (`brew install poppler` on macOS). A content edit changes the snapshots: review the diff, then run `bun test --update-snapshots`.

## Rebuild the fonts

Only needed to change a weight or add characters. `bun run fonts` downloads Google Sans Flex if it is missing and cuts fixed weights with HarfBuzz. The fonts are under the SIL Open Font License; see `fonts/OFL.txt`.

## Layout

```text
resume.yaml      the resume content (JSON Resume shape)
src/             schema, print template, Chrome printing, Word and text renderers, build()
scripts/         bun run build, bun run fonts
fonts/           fixed-weight Google Sans Flex
spec/            capability map and module specs
tasks/           current plan and task list
docs/            status, decisions, research, interview records, agent routing
CONTEXT.md       glossary
AGENTS.md        instructions for every AI coding agent (CLAUDE.md imports it)
.agents/skills/  repo skills (.claude/skills links to them)
.scratch/        local issue tracker
```

## Working with AI agents

The repository carries its own agent context. An agent starts at [AGENTS.md](AGENTS.md); Claude Code reads it through [CLAUDE.md](CLAUDE.md), and Codex, Cursor, Copilot and Antigravity read it directly. The workflow follows Peter's brain plugin: specs in `spec/`, the plan in `tasks/`, decisions in `docs/decisions/`, research in `docs/research/`, current status in [docs/STATUS.md](docs/STATUS.md).

A good first prompt for a new session: "Read AGENTS.md and follow its session start, then tell me where we are."
