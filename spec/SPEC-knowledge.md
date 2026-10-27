# Spec: knowledge

## Objective

Give the chat a knowledge base in two layers ([decision 0016](../docs/decisions/0016-two-layer-knowledge.md)): the core, sent with every question, and sources, which the chat reads only when a question needs them ([decision 0015](../docs/decisions/0015-sources-on-demand.md)). The sources hold the depth: the nine deep dives, and interviews in Peter's own words about his career, working style, stories, opinions, side projects and skills ([decision 0019](../docs/decisions/0019-wider-chat-scope.md)). Every statement comes from Peter or his records, and nothing reaches the chat until he approves it ([decision 0001](../docs/decisions/0001-facts-from-records.md)).

Acceptance criteria:

- `buildKnowledge()` returns the core and the approved sources. The core entries come in a fixed order: resume entries, then approved logistics answers, then one catalog entry per approved source.
- Resume entries come from `resume.yaml` through the content module's loader, `public` variant. No private details anywhere in the knowledge base.
- A source or logistics answer with `status: draft` appears nowhere: not in the catalog, not in the sources.
- Every id is unique and follows the id rules below. A broken rule stops the build with a message that names the file and the field.
- Every source has the required front matter and its passages in the required shape. A deep dive keeps its six sections; an interview's passages are its questions and answers.
- The rendered core stays under 80,000 characters (about 20,000 tokens). Each rendered source stays under 24,000 characters (about 6,000 tokens), and each passage under 3,000 characters.
- `readPassages()` returns the rendered text of the sources or passages asked for, only from approved sources, at most 24,000 characters per call. It names any id it does not know and any id it left out because of the limit.

## Ids

| Entry | Id | Example |
|---|---|---|
| Headline, lead, location, links | `basics` | `basics` |
| A role's title, dates and location | `role:<role id>` | `role:fednow` |
| A highlight, numbered from 1 | `highlight:<role id>.<n>` | `highlight:highspot.3` |
| A skills group | `skills:<slug>` | `skills:ai-platform` |
| Education | `education` | `education` |
| A logistics answer | `logistics:<topic>` | `logistics:work-arrangement` |
| A source, and its catalog entry | `<source id>` | `fednow-architecture` |
| A passage, numbered from 1 in file order | `<source id>.<n>` | `fednow-architecture.3` |

A citation is a passage id or a resume entry id. Highlight and passage numbers follow the file order, so reordering changes their ids. A saved session can hold a citation to an id that no longer exists; the site shows it as plain text ([decision 0017](../docs/decisions/0017-saved-visitor-session.md)).

## Sources

One Markdown file per source in `knowledge/sources/<id>.md`. The nine deep dives move there from `knowledge/deep-dives/`.

```markdown
---
id: fednow-architecture
title: Front-end architecture across FedNow applications
kind: deep-dive          # deep-dive | interview
subject: project         # project | career | working-style | story | opinion | side-project | skill
roles: [fednow]          # role ids in resume.yaml; may be empty
highlights: [1]          # deep dives only: the highlights it explains
summary: How Peter's team replaced FedNow's ad hoc front ends with one routing-based architecture and shared packages.
links: []                # public URLs only, for side projects
status: draft            # draft | approved
approved:                # the date Peter approved it, e.g. 2026-10-27
source: Interview with Peter, 2026-10-26
---

## Problem
...
## Not public
...
```

- **Passages:** every `## ` section is one passage, except `## Not public`, which comes last in every source. It lists what the chat must decline to describe and may be empty. The chat receives it with the source but never cites it.
- **Deep dive:** the sections are, in order, Problem, What Peter did, How it worked, Result, Tools, Not public. Written in the third person ("Peter led …"). All nine existing deep dives get `kind: deep-dive`, `subject: project` and a one-line summary; Peter approves the nine summaries.
- **Interview:** each passage heading is the question as asked, and its text is Peter's answer in his own words, in the first person. An answer longer than one passage continues under the follow-up question that drew it out.
- **Summary:** one line, at most 200 characters, written from the source and approved with it. The catalog shows it, so the chat can choose what to read.
- **Not public** lists internal code, customer names, security details, colleague names, internal links and figures employers have not made public.

## How interviews are gathered

Peter chose long-form interviews, one topic at a time ([interview record](../docs/design/interview-2026-10-26.md), questions 32 to 34).

1. Questions go in normal chat messages, typed or spoken, never through the question dialog: the chat history does not keep dialog answers.
2. Each answer is saved word for word to Peter's private workspace before anything is written from it. The raw record never enters this repository.
3. The interview source is written from the raw answers with transcription errors fixed and filler and false starts smoothed. The meaning and Peter's scope words stay ("helped" stays "helped").
4. The source stays `status: draft` until Peter approves the whole file in chat.

Planned subjects (Peter chose them on 2026-10-27):

| Subject | What it answers |
|---|---|
| `career` | Why front-end platform work; how each role led to the next, earlier roles included |
| `working-style` | How he leads, reviews code, mentors, and works with design, product and leadership |
| `story` | Concrete situations: a conflict, a failure, a hard call, a deadline, a decision he would change |
| `opinion` | His views on design systems, front-end architecture and AI adoption, stated as his views |
| `side-project` | Brain, his design system, his agent tooling and this site, with public links |
| `skill` | How deep each skill goes and where he used it |

## Logistics answers

Unchanged: `knowledge/logistics.yaml`, one entry per topic, with `topic`, `answer`, `status` and `approved`. The four approved answers are part of the core.

## Tech Stack

Bun 1.4.2 and TypeScript; `Bun.YAML` for front matter and `logistics.yaml`; `zod` 4.6.7 for the schemas. The parser is the existing section splitter. No new dependency.

## Commands

```sh
bun test tests/knowledge
bun run knowledge               # prints the core as the chat sees it, its size, and each source's size
bun run knowledge <source id>   # prints one source as readPassages() returns it
```

## Project Structure

```text
knowledge/sources/         one Markdown file per source (deep dives and interviews)
knowledge/logistics.yaml   logistics answers
src/knowledge/parse.ts     front matter and passage parser for a source
src/knowledge/build.ts     buildKnowledge({ root }): the core and the approved sources, ids checked
src/knowledge/render.ts    renders the core and a source as text with [id] markers
src/knowledge/read.ts      readPassages(knowledge, ids): what the chat's read tool returns
scripts/knowledge.ts       `bun run knowledge`
tests/knowledge/           tests, fixtures and snapshots
```

## Code Style

The same as [SPEC-content](SPEC-content.md): small pure functions, zod schemas with `strictObject`, errors that name the file and the field, and Bun APIs only.

```ts
export type Entry = { id: string; kind: "resume" | "logistics" | "catalog"; title: string; text: string };
export type Passage = { id: string; heading: string; text: string };
export type Source = {
  id: string; title: string; kind: "deep-dive" | "interview"; subject: Subject;
  roles: string[]; summary: string; links: string[]; notPublic: string; passages: Passage[];
};
export type Knowledge = { core: Entry[]; sources: Source[] };

export function readPassages(knowledge: Knowledge, ids: string[]): { text: string; read: string[]; unknown: string[]; skipped: string[] };
```

## Testing Strategy

`bun test`, at the same two seams Peter confirmed on 2026-10-26, extended on 2026-10-27:

1. **`buildKnowledge()`**, on fixtures and on the real files, and **`readPassages()`** on its output. The tests check: the core's order; that drafts never reach the catalog or the sources; the id rules and passage numbering; that `roles` and `highlights` exist in `resume.yaml`; that no private detail appears in the core or in any source (a fixture `private.yaml` with a fake phone number); the core, source and passage budgets; one catalog entry per approved source; that `readPassages()` returns only approved text, accepts source and passage ids, reports unknown ids, and stops at its limit. The rendered core and one rendered source have snapshots.
2. **Unit tests on the source parser:** front matter for both kinds, deep-dive section order, interview passages, `Not public` last, passage size, and missing or unknown sections.

## Boundaries

- **Always:** take every statement from Peter's answers or his records. Save each raw interview answer privately before writing from it. Keep `status: draft` until Peter approves the file in chat, then set `status: approved` and the date.
- **Ask first:** a new subject or source; any wording that goes beyond what Peter said; a smoothing edit that could change what he meant.
- **Never:** approve a source on Peter's behalf. Ask interview questions through the question dialog. Put internal code, customer names, security details, colleague names, internal links or non-public figures in a source. Put private details or the raw interview record in this repository.

## User Stories

1. As Peter, I want to answer interview questions in normal messages, typed or spoken, so that every word I give is kept.
2. As Peter, I want my raw answers saved privately before anything is written from them, so that nothing I said is lost again.
3. As Peter, I want interview sources in my own words, with only errors fixed and filler smoothed, so that the chat sounds like what I actually said.
4. As Peter, I want nothing to reach the chat until I approve it, so that the chat never says something I have not seen.
5. As Peter, I want each source to say what is not public, so that the chat declines what I cannot share.
6. As Peter, I want to see one source exactly as the chat reads it, so that I can review it before approval.
7. As Peter, I want the build to stop on a bad id, a missing section or an oversized passage, so that a broken source never ships.
8. As Peter, I want the nine deep dives kept as sources, so that their approved work is not lost.
9. As Peter, I want side projects described with public links only, so that nothing private is exposed.
10. As the chat, I want a catalog of every source in each request, so that I know what exists before I read anything.
11. As the chat, I want to read whole sources or single passages by id, so that I read only what a question needs.
12. As the chat, I want each read to stay within a fixed size, so that answers stay fast and cheap.
13. As the chat, I want unknown ids reported, not thrown, so that I can correct a request and continue.
14. As the chat, I want every passage to have an id, so that I can cite exactly where a detail came from.
15. As the chat, I want to know whether a source is a deep dive or Peter's own words, so that I quote only his words as his.
16. As the chat, I want the resume entries built from `resume.yaml`, so that my answers match the PDF.
17. As the site, I want passage ids in citations, so that I can open the source and mark the passage.
18. As a recruiter, I want to know why Peter chose platform work and how his roles connect, so that I understand his career beyond the dates.
19. As a hiring manager, I want concrete stories about conflict, failure and hard calls, so that I can judge how Peter works.
20. As a hiring manager, I want Peter's views on design systems and AI adoption, so that I can see whether we think alike.
21. As an engineer, I want to know how deep each skill goes and where Peter used it, so that I can trust the skills list.
22. As an engineer, I want to read about his side projects with links, so that I can see his work myself.
23. As any visitor, I want each answer to show the passage it came from, so that I can check it.
24. As an employer whose work is described, I want confidential details kept out, so that nothing internal becomes public.
25. As a future agent, I want the source rules enforced by tests, so that I can add an interview without breaking the chat.

## Out of scope

- Search or retrieval (embeddings, a vector index). The chat chooses from the catalog. A keyword search in the Bun server comes only if the catalog outgrows the core budget.
- The read tool's definition, the system prompt and the evals ([SPEC-chat](README.md)); the source view on the site (SPEC-site).
- Interests outside work and personal life ([decision 0019](../docs/decisions/0019-wider-chat-scope.md)).
- Turning the 2026-10-26 interview transcript into a source: the deep dives already carry its facts.
- Per-visitor or per-job tailoring of the knowledge.

## Prior-art tests

`tests/knowledge/build.test.ts`, `tests/knowledge/parse.test.ts` and `tests/knowledge/fixtures.ts`: fixtures written in the test, a temporary folder, a fake phone number for the private-details checks, and one snapshot.

## Success Criteria

- `bun test tests/knowledge` passes on a clean checkout.
- With the nine deep dives moved and their summaries approved, `bun run knowledge` prints a core under 80,000 characters with a catalog entry for each of the nine, and every source is under 24,000 characters.
- After the interviews, each of the six planned subjects has at least one approved source.

## Open Questions

None for the spec. The interview order and the sources per subject are planned in [tasks/plan.md](../tasks/plan.md) after this spec is approved.
