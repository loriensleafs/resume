# Spec: knowledge

## Objective

Give the chat one approved knowledge file to answer from: the resume source, deep dives in Peter's words, and his logistics answers. Every entry has a stable id, so the chat can cite the entry it used. Nothing ships until Peter approves it, and the whole file fits in one model request ([decision 0008](../docs/decisions/0008-grounded-knowledge-file.md)).

Acceptance criteria:

- `buildKnowledge()` returns the entries the chat sees, in a fixed order: resume entries, then approved deep dives, then approved logistics answers.
- Resume entries come from `resume.yaml` through the content module's loader, `public` variant. No private details.
- A deep dive or logistics answer with `status: draft` never appears in the output.
- Every entry id is unique and follows the id rules below; a broken rule stops the build with a message that names the file and the field.
- Every approved deep dive has the required sections, and its `role` names a role in `resume.yaml`.
- The rendered knowledge text stays under 100,000 characters (about 25,000 tokens).

## Ids

| Entry | Id | Example |
|---|---|---|
| Headline, lead, location, links | `basics` | `basics` |
| A role's title, dates and location | `role:<role id>` | `role:fednow` |
| A highlight, numbered from 1 | `highlight:<role id>.<n>` | `highlight:highspot.3` |
| A skills group | `skills:<slug>` | `skills:ai-platform` |
| Education | `education` | `education` |
| A deep dive | `deep:<deep dive id>` | `deep:fednow-bundle-size` |
| A logistics answer | `logistics:<topic>` | `logistics:work-arrangement` |

Highlight numbers follow the order in `resume.yaml`, so reordering highlights changes their ids. Citations live only inside a conversation, so this is acceptable.

## Deep dives

One Markdown file per deep dive in `knowledge/deep-dives/<id>.md`:

```markdown
---
id: fednow-bundle-size
title: Cutting FedNow's initial bundle from over 15 MB to under 1 MB
role: fednow
highlights: [2]
status: draft            # draft | approved
approved:                # date Peter approved it, e.g. 2026-10-27
source: Interview with Peter, 2026-10-27
---

## Problem
## What Peter did
## How it worked
## Result
## Tools
## Not public
```

- Written in the third person ("Peter led …"), because the chat speaks about Peter.
- Every statement comes from Peter's interview answers or his records. Peter's scope words stay ([decision 0001](../docs/decisions/0001-facts-from-records.md)).
- **Not public** lists what the chat must decline to describe: internal code, customer names, security details, and figures his employers have not made public. It may be empty.

Planned deep dives (Peter chose these areas on 2026-10-26):

| Id | Role | Subject |
|---|---|---|
| `highspot-mcp-server` | highspot | The polar-ui MCP server |
| `highspot-agent-workflow` | highspot | The agent workflow system |
| `highspot-ai-standards` | highspot | The AI development standards |
| `highspot-streaming-markdown` | highspot | The streaming Markdown component |
| `highspot-data-table` | highspot | The data table |
| `fednow-architecture` | fednow | Front-end architecture across FedNow applications |
| `fednow-bundle-size` | fednow | The bundle cut from over 15 MB to under 1 MB |
| `fednow-design-system` | fednow | The design system and shared packages |
| `fednow-standards-mentoring` | fednow | Front-end standards, the testing harness and mentoring |

## Logistics answers

`knowledge/logistics.yaml`, one entry per topic: `topic`, `answer`, `status`, `approved`. Planned topics: `work-arrangement`, `location`, `availability`, `target-roles`. Peter decides the wording of each answer.

## Tech Stack

Bun 1.4.2 and TypeScript; `Bun.YAML` for front matter and `logistics.yaml`; `zod` 4.6.7 for the schemas. The Markdown parser is a small section splitter written here (headings and their text); no new dependency.

## Commands

```sh
bun test tests/knowledge
bun run knowledge          # prints the rendered knowledge text and its size
```

## Project Structure

```text
knowledge/deep-dives/      one Markdown file per deep dive
knowledge/logistics.yaml   logistics answers
src/knowledge/parse.ts     front matter and section parser for a deep dive
src/knowledge/build.ts     buildKnowledge({ root }): entries in order, ids checked
src/knowledge/render.ts    renders entries as text with [id] markers for the system prompt
scripts/knowledge.ts       `bun run knowledge`
tests/knowledge/           tests, fixtures and snapshots
```

## Code Style

The same as [SPEC-content](SPEC-content.md): small pure functions, zod schemas with `strictObject`, errors that name the file and the field, and Bun APIs only.

```ts
export type Entry = { id: string; kind: "resume" | "deep-dive" | "logistics"; title: string; text: string };
```

## Testing Strategy

`bun test`, at two seams Peter confirmed on 2026-10-26:

1. **`buildKnowledge()`**, on fixtures and on the real files. It checks that ids are unique and well formed, that drafts never ship, that required sections are present, that resume entries match `resume.yaml`, that no private detail appears (a fixture `private.yaml` with a fake phone number), and that the size stays under the budget. The rendered text has a snapshot.
2. **Unit tests** on the deep-dive parser (front matter, section order, missing and unknown sections) and on the id rules.

## Boundaries

- **Always:** take every deep-dive statement from Peter's interview answers. Keep `status: draft` until Peter approves the entry in chat, then set `status: approved` and the date.
- **Ask first:** a new topic or deep dive; any wording that goes beyond what Peter said.
- **Never:** approve an entry on Peter's behalf. Include internal code, customer names, security details or non-public figures. Include private details.

## User Stories

1. As Peter, I want to write a deep dive as a plain Markdown file, so that it is easy to read and edit.
2. As Peter, I want nothing to reach the chat until I approve it, so that the chat never says something I have not seen.
3. As Peter, I want a "Not public" list per deep dive, so that the chat declines what I cannot share.
4. As Peter, I want the build to stop on a missing section or a bad id, so that a broken entry never ships.
5. As Peter, I want one command that prints the knowledge and its size, so that I can review exactly what the chat sees.
6. As the chat, I want every fact as an entry with an id, so that I can cite where an answer came from.
7. As the chat, I want the resume entries built from `resume.yaml`, so that my answers match the PDF.
8. As the chat, I want the whole knowledge file in one request, so that I never miss an entry.
9. As a recruiter, I want follow-up answers about Peter's key projects, so that I understand his work beyond one bullet.
10. As a recruiter, I want answers about remote work, location, availability and target roles, so that I can tell quickly whether the role fits.
11. As a hiring manager, I want each answer to show its source entry, so that I can check it against the resume.
12. As an employer whose work is described, I want confidential details kept out, so that nothing internal becomes public.
13. As a future agent, I want the id rules and section rules enforced by tests, so that I can add a deep dive without breaking the chat.

## Out of scope

- Search or retrieval (embeddings, a vector index). The whole file goes into each request; a lookup tool comes only if the file outgrows the budget.
- Deep dives for earlier roles (Pippin, LinkSquares, Sheridan, Jack Morton).
- Per-visitor or per-job tailoring of the knowledge.
- The chat itself, its prompt and its evals ([SPEC-chat](README.md), next).

## Prior-art tests

`tests/content/build.test.ts` and `tests/content/render.test.ts`: fixtures written in the test, a temporary folder, a fake phone number for the private-details checks, and one snapshot.

## Success Criteria

- `bun test tests/knowledge` passes on a clean checkout.
- With every planned deep dive and logistics answer approved, `bun run knowledge` prints text under 100,000 characters that contains every id in the table above.

## Open Questions

None for the spec. The content comes from interviews, one deep dive and one logistics topic at a time (tasks in [tasks/todo.md](../tasks/todo.md)).
