# Spec: knowledge

Approved by Peter on 2026-10-26, and its two-layer update on 2026-10-27 ([decision record](../docs/design/interview-2026-10-26.md) row 36). Amended on 2026-10-27 after the spec reviews (decision record rows 128 to 136). Approved by Peter with the updated mockups on 2026-10-27 (decision record row 139); the scope label and the texts follow rows 137 and 138.

## Objective

Give the chat a knowledge base in two layers ([decision 0016](../docs/decisions/0016-two-layer-knowledge.md)): the core, sent with every question, and sources, which the chat reads only when a question needs them ([decision 0015](../docs/decisions/0015-sources-on-demand.md)). The sources hold the depth: the nine deep dives, and interviews in Peter's own words about his career, working style, stories, opinions, side projects and skills ([decision 0019](../docs/decisions/0019-wider-chat-scope.md)). Every statement comes from Peter or his records, and nothing reaches the chat until he approves it ([decision 0001](../docs/decisions/0001-facts-from-records.md)).

Acceptance criteria:

- `buildKnowledge()` returns the core and the approved sources. The core entries come in a fixed order: resume entries, then approved logistics answers, then one catalog entry per approved source, in source-id order.
- Resume entries come from `resume.yaml` through the content module's loader, `public` variant. No private details anywhere in the knowledge base.
- A draft source file or a draft logistics answer (`status: draft`) appears nowhere: not in the catalog, not in the sources. The build checks a draft source file for shape only (see "Drafts and approval").
- Every id is unique and follows the id rules below. A broken rule stops the build with a message that names the file and the field.
- Every source has the required front matter and its passages in the required shape. A deep dive keeps its six sections; an interview's passages are its questions and answers.
- Passages in an approved source are append-only, so an approved passage id always names the same passage.
- The rendered core stays under 80,000 characters (about 20,000 tokens). Each rendered source stays under 24,000 characters (about 6,000 tokens), and each passage under 3,000 characters.
- `readPassages()` returns the rendered text of the sources or passages asked for, only from approved sources, at most 24,000 characters per call, by the rules in Code Style. It names any id it does not know and any id it left out because of the limit.
- `readPassages()` runs on the server only. Its `text` reaches the model and never a browser; only `{ read, unknown, skipped }` goes on the wire ([SPEC-chat](SPEC-chat.md)).
- A source's `Not public` section names kinds of material only. It reaches the model only on the server, with a read. Everything that reaches a browser comes from `publicKnowledge()`, which leaves it out.

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

The id grammar:

```text
slug        [a-z0-9]+(-[a-z0-9]+)*   at most 60 characters
n           [1-9][0-9]*              numbered from 1, at most Number.MAX_SAFE_INTEGER
source id   a slug, never "basics" or "education"
passage id  <source id>.<n>          at most 64 characters
```

- A source's file is `knowledge/sources/<source id>.md`. A source id has no colon, so it never collides with a prefixed id.
- Role ids come from `resume.yaml`. A skills slug is the group's name in lowercase, with each run of other characters made one hyphen and no hyphen at either end. A logistics topic is written in `logistics.yaml`. Each of the three is a slug; the build stops on one that is not.
- The 64-character cap on a passage id allows a 60-character source id and a passage number up to 999.

A citation is a passage id, a resume entry id or a logistics answer id. Resume entries and logistics answers are in the core, so an answer can cite them without a read; a passage needs a read in the same turn ([decision 0016](../docs/decisions/0016-two-layer-knowledge.md) as amended by Peter in row 84; [SPEC-chat](SPEC-chat.md)). Highlight numbers follow the order in `resume.yaml`, so reordering highlights there changes their ids. Passage numbers never change, because approved passages are append-only (see Sources). A saved session can hold a citation to an id that no longer exists; the site shows it as plain text ([decision 0017](../docs/decisions/0017-saved-visitor-session.md)).

## Sources

One Markdown file per source in `knowledge/sources/<id>.md`. The nine deep dives move there from `knowledge/deep-dives/`. The move changes approved files, so it follows the edit rule below.

```markdown
---
id: fednow-architecture
title: Front-end architecture across FedNow applications
kind: deep-dive          # deep-dive | interview
subject: project         # project | career | working-style | story | opinion | side-project | skill
roles: [fednow]          # role ids in resume.yaml; may be empty
highlights: [highlight:fednow.1]   # deep dives only: the highlight ids it explains
summary: How Peter's team replaced FedNow's ad hoc front ends with one routing-based architecture and shared packages.
links: []                # exact public https URLs, for side projects
status: draft            # draft | approved
approved:                # the date Peter approved this version, e.g. 2026-10-27
source: Interview with Peter, 2026-10-26
---

## Problem
...
## Not public
...
```

- **Passages:** every `## ` section is one passage, except `## Not public`, which comes last in every source. In an approved source every passage holds text; only `Not public` may be empty.
- **Append-only:** passages in an approved source are append-only. A change never removes, moves, splits or merges an approved passage. A new passage goes after the last one, before `Not public`. A correction to a passage's text keeps the passage in its place and follows the edit rule. A deep dive's six sections are fixed, so only their text can change.
- **Deep dive:** the sections are, in order, Problem, What Peter did, How it worked, Result, Tools, Not public. Written in the third person ("Peter led …"). All nine existing deep dives get `kind: deep-dive`, `subject: project` and a one-line summary. Peter approves the nine summaries with the move, under the edit rule.
- **Interview:** each passage heading is the question as asked, and its text is Peter's answer in his own words, in the first person. An answer longer than one passage continues in the next passage, under the same heading with " (continued)" at its end: `## Why front-end platform work? (continued)`. A "(continued)" heading comes directly after the heading it continues.
- **Headings** follow Peter's wording rule, as the text does: a heading never says more than his answer. When a question as asked says more ("How did you lead …?" about work he helped with), the heading uses his word ("How did you help …?").
- **Roles:** the roles the source is about, by role id. When an answer cites one of its passages, the site lights these roles on the career timeline (`setCited()`, [SPEC-site](SPEC-site.md)).
- **Highlights:** deep dives only. Each is a highlight id from the core, such as `highlight:fednow.1`, for a highlight the deep dive explains.
- **Summary:** one line, at most 200 characters, written from the source and approved with it. The catalog shows it, so the chat can choose what to read.
- **Links:** exact public URLs, for side projects. Each is an absolute `https://` URL with no user name or password; the build stops on any other form. The rendered source lists them, so the chat can give them. An answer renders a link only for `https://peterkloss.dev/…`, `https://github.com/loriensleafs/…`, `https://github.com/acmelabs-15/…`, `mailto:` with Peter's email and the exact URLs in approved sources' `links` ([SPEC-chat](SPEC-chat.md)).
- **Not public:** the last section of every source; it may be empty. It names kinds of material only, never the material itself: for example internal code, customer names, security details, colleague names, internal links, or figures an employer has not made public. It holds no URL and no email address. It tells the chat what to decline to describe. The chat receives it with a read, on the server only, and never cites it: it has no passage id.

**Drafts and approval.**

- A draft source file has `status: draft`. The build checks it for shape only: its front matter and its sections. The other rules (ids, roles and highlights in `resume.yaml`, links, sizes) apply once it is approved.
- `bun run knowledge --draft <source id>` prints a draft source file as the chat will read it once approved. It applies every rule now and names each one the draft breaks.
- Peter approves a source in the host's question tool (the question dialog). Before that, he reads it as the chat will: a draft with `bun run knowledge --draft <source id>`, a change on its branch with `bun run knowledge <source id>`. He also sees its redaction list.
- On approval the file gets `status: approved` and the `approved:` date. The decision record gets a row with the source id and that date.
- **The edit rule** (Peter, [decision record](../docs/design/interview-2026-10-26.md) row 130). A change to an approved source waits on a branch until Peter approves it in the host's question tool. It then lands on `main` with a new `approved:` date. The live source never changes unapproved.

## How interviews are gathered

Peter chose long-form interviews, one topic at a time ([decision record](../docs/design/interview-2026-10-26.md), rows 32 to 34).

1. Questions go in normal chat messages, typed or spoken, never through the host's question tool: the chat history does not keep its answers.
2. Each answer is saved word for word to Peter's private repo `loriensleafs/resume-private`, in its folder `interviews/`, before anything is written from it ([decision 0024](../docs/decisions/0024-private-interview-repo.md), row 129). The repo exists since 2026-10-27; later sessions attach it, and the `write-source` repo skill runs these steps ([SPEC-agents](SPEC-agents.md)). The raw answers never enter this repository.
3. The interview source is written from the raw answers as a draft source file, with transcription errors fixed and filler and false starts smoothed. The meaning stays, and so do Peter's words for what he did ("helped" stays "helped").
4. Redaction: material of a kind that is not public (a colleague's name, an internal link) comes out of the text, and the `Not public` section names its kind. Each removal is listed for Peter's approval. The redaction list stays in the private repo beside the raw answers, never in this repository.
5. The source stays a draft until Peter approves it (see "Drafts and approval").

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

Bun 1.4.4 and TypeScript; `Bun.YAML` for front matter and `logistics.yaml`; `zod` 4.6.7 for the schemas. The parser is the existing section splitter. No new dependency.

## Commands

```sh
bun test src/knowledge
bun run knowledge                       # prints the core as the chat sees it, its size, and each source's size
bun run knowledge <source id>           # prints one approved source as readPassages() returns it
bun run knowledge --draft <source id>   # prints a draft source file as the chat will read it once approved, and names every rule it breaks
```

## Project Structure

```text
knowledge/sources/         one Markdown file per source (deep dives and interviews), approved or draft
knowledge/logistics.yaml   logistics answers
src/knowledge/ids.ts       the id grammar, shared by the build and readPassages()
src/knowledge/types.ts     the types in Code Style, and no code: the renderers, the reads, the site and the chat import them without the build
src/knowledge/parse.ts     parseSource(): front matter and passages of one source file
src/knowledge/build.ts     buildKnowledge({ root }), publicKnowledge() and previewDraft(); every rule checked
src/knowledge/render.ts    renderCore() and renderSource(): text with [id] markers
src/knowledge/read.ts      readPassages(knowledge, ids) and readLimits: what the chat's read tool returns
scripts/knowledge.ts       `bun run knowledge`
src/knowledge/__tests__/   tests, fixtures and snapshots
```

## Code Style

The same as [SPEC-content](SPEC-content.md): small pure functions, zod schemas with `strictObject`, errors that name the file and the field, and Bun APIs only.

```ts
export type Entry = { id: string; kind: "resume" | "logistics" | "catalog"; title: string; text: string };
export type Passage = { id: string; heading: string; text: string };
export type Source = {
  id: string; title: string; kind: "deep-dive" | "interview"; subject: Subject;
  roles: string[]; highlights: string[]; summary: string; links: string[];
  notPublic: string; passages: Passage[];
};
/** Server only: the chat's function gets it through virtual:knowledge. */
export type Knowledge = { core: Entry[]; sources: Source[] };
/** Everything that reaches a browser. It holds no Not public text. */
export type PublicKnowledge = { core: Entry[]; sources: Omit<Source, "notPublic">[] };

export const readLimits = { ids: 20, idCharacters: 64, characters: 24_000 } as const;
export type ReadResult = { text: string; read: string[]; unknown: string[]; skipped: string[] };

export function buildKnowledge(options?: { root?: string }): Promise<Knowledge>;
export function publicKnowledge(knowledge: Knowledge): PublicKnowledge;
export function readPassages(knowledge: Knowledge, ids: string[]): ReadResult;
export function renderCore(knowledge: Knowledge): string;
/** The source's header, the passages asked for (all when omitted) in file order, then Not public. */
export function renderSource(source: Source, passageIds?: string[]): string;
/** What `bun run knowledge --draft` prints: the draft rendered as if approved, and each rule it breaks. */
export function previewDraft(options: { root?: string; id: string }): Promise<{ text: string; problems: string[] }>;
```

**The id rules** live in `src/knowledge/ids.ts` (task K1). The build, the reads, the site and the chat's citation check use these exports, and none of them writes an id form by hand:

```ts
/** Every id form, with its parts. */
export type IdForm =
  | { form: "basics" } | { form: "education" }
  | { form: "role"; role: string } | { form: "highlight"; role: string; n: number }
  | { form: "skills"; slug: string } | { form: "logistics"; topic: string }
  | { form: "source"; source: string } | { form: "passage"; source: string; n: number };
/** The form of an id and its parts, or undefined when the id follows no form. */
export function parseId(id: string): IdForm | undefined;
export function isSlug(s: string): boolean;     // at most 60 characters
export function isSourceId(s: string): boolean; // a slug, never "basics" or "education"
export function toSlug(name: string): string;   // a skills group's name as its slug
export function roleId(role: string): string;                // "role:<role id>"
export function highlightId(role: string, n: number): string; // "highlight:<role id>.<n>"
export function skillsId(groupName: string): string;         // "skills:<slug>"
export function logisticsId(topic: string): string;          // "logistics:<topic>"
export function passageId(sourceId: string, n: number): string; // "<source id>.<n>"
/** How a slug is written, for error messages. */
export const SLUG_RULE: string;
```

`parseId()` gives the form only. Whether an id names an entry or a passage that exists is for the caller to check against the built knowledge, with a `Map` or `Object.hasOwn()`: a slug such as `constructor` is also a property of every object.

**Who gets which shape.**

| Consumer | Shape | How |
|---|---|---|
| The chat's server function | `Knowledge`, with `Not public` | `virtual:knowledge`, bundled with the function ([SPEC-chat](SPEC-chat.md)) |
| The site's pages | `PublicKnowledge` | `src/site/data.ts` ([SPEC-site](SPEC-site.md)) |
| The device index | `PublicKnowledge` | `device-index.json` ([SPEC-chat](SPEC-chat.md)) |

So the function bundle holds `Not public` text on purpose, and no file under `.vercel/output/static/` holds it.

**`readPassages()` rules.**

- Each id is a source id, which reads all its passages, or a passage id. Only approved sources count. Any other id goes to `unknown`, a draft's id and a resume entry id included.
- It takes at most 20 ids, each at most 64 characters (`readLimits`). A longer list or a longer id is a programming error, and it throws. The chat's read tool checks its input against the same limits first, so the model gets a tool error instead ([SPEC-chat](SPEC-chat.md)).
- It takes the ids in the order given. The text groups the passages by source, in the order each source first appears. Within a source, passages keep file order.
- Each source in the text has its header once and its `Not public` section once, at its end. This is also true when only one of its passages was asked for.
- An id whose passages are already in the text adds nothing. `read` lists each id whose text is in the result, once, in the order asked. A source id in `read` means that all its passages were read.
- The 24,000 characters count all of `text`: headers, passages and `Not public` sections. When the next id would take `text` past the limit, `readPassages()` stops. That id, and every later id it knows and has not read, go to `skipped` in order.
- `unknown` holds each unknown id once, in the order asked, also after the stop.
- `text` stays on the server. Only `{ read, unknown, skipped }` reaches the browser ([SPEC-chat](SPEC-chat.md)).

**Rendered text.** `renderCore()` gives the core in three parts, and `renderSource()` gives one source. The chat cites by the `[id]` markers. `bun run knowledge` prints the same text.

```text
# Resume

[<id>] <title>: <text>                         one line per resume entry, in resume order

# Job-search logistics

[logistics:<topic>] <topic>: <answer>

# Catalog

[<source id>] <title>: <kind>, roles <role ids>. <summary>
```

```text
# [<source id>] <title>
Deep dive: written from Peter's answers, in the third person.
Roles: <role ids>. Highlights: <highlight ids>. Links: <links>.

## [<source id>.<n>] <heading>
<text>

## Not public: decline to describe these kinds of material
<the section's text, or "Nothing listed.">
```

- The catalog lists the approved sources in source-id order. An entry leaves out "roles" when the source has none.
- The kind line of an interview reads "Interview: Peter's own words, in the first person." It tells the chat whose words a source holds, so the chat quotes only Peter's own words as his.
- The line after the kind line shows only its parts that are not empty, and is left out when all three are empty.

## Testing Strategy

`bun test`, at the two seams Peter confirmed on 2026-10-26, extended on 2026-10-27, and a third seam for the id grammar that he added on 2026-10-27 ([decision record](../docs/design/interview-2026-10-26.md) row 146):

1. **`buildKnowledge()`**, on fixtures and on the real files, with **`readPassages()`**, **`publicKnowledge()`**, **`renderCore()`**, **`renderSource()`** and **`previewDraft()`** on its output. The tests check:
   - the core's order, and the catalog in source-id order with one entry per approved source;
   - that draft source files reach neither the catalog nor the sources; that a draft with an unknown role or an oversized passage still builds; that a draft with broken front matter or sections stops the build;
   - the id grammar: a source id with a capital letter, an underscore, two hyphens together, 61 characters, `basics` or `education` stops the build; passages are numbered from 1;
   - that every role id in `roles` and every highlight id in `highlights` exists in `resume.yaml`;
   - that a link that is not an absolute `https://` URL, or that holds a user name or password, stops the build;
   - that no `Not public` section holds a URL or an email address;
   - that no private detail appears in the core or in any source (a fixture `private.yaml` with a fake phone number);
   - the core, source and passage budgets;
   - `readPassages()`: only approved text; source and passage ids; unknown ids reported, a draft's id and a resume entry id among them; the order and the grouping by source; one header and one `Not public` section per source, also for a single passage; a repeated id read once; the stop at 24,000 characters, with the rest in `skipped`; more than 20 ids, or an id over 64 characters, throws;
   - `publicKnowledge()`: its JSON holds no fixture `Not public` text, and the rest equals the output of `buildKnowledge()`;
   - `previewDraft()`: it names each rule a fixture draft breaks, and its text equals what `renderSource()` gives once the draft is approved.

   The rendered core and one rendered source have snapshots. A third snapshot lists every approved source's passage ids with their headings. A new passage adds lines at the end of its source's list; a reviewer accepts no other change to that snapshot (append-only).
2. **Unit tests on the source parser:** front matter for both kinds, highlight ids, deep-dive section order, interview passages, a "(continued)" heading only directly after the heading it continues, `Not public` last, passage size, and missing or unknown sections.
3. **Unit tests on the id grammar** (`src/knowledge/__tests__/ids.test.ts`): `parseId()` on a table of ids, each with the form it gives or with none. The table holds every form at its length limits, numbers from 1 with no leading zero and none past `Number.MAX_SAFE_INTEGER`, and forms the build never makes, such as `basics.1`, `highlight:acme.0`, `role:acme:two` and an empty id. The id builders give ids that `parseId()` reads back. The site and the chat call `parseId()` with ids from the model and from browsers, and seam 1 never reaches the paths that reject an id.

No test can check three rules: that `Not public` names kinds only, that headings follow Peter's wording rule, and the edit rule. Peter checks them at approval, with the redaction list and the passage-id snapshot in front of him.

## Boundaries

- **Always:** take every statement from Peter's answers or his records. Save each raw interview answer to `loriensleafs/resume-private` before writing from it. Keep a source file a draft until Peter approves it in the host's question tool; then set `status: approved` and the date, and record the approval in the decision record. Make each change to an approved source on a branch, and land it only after Peter approves it, with a new `approved:` date. Add a passage only after the last one. Run `bun run build`, `bun run build:site` and `bun test` before a commit.
- **Ask first:** a new subject or source; any wording that goes beyond what Peter said; a smoothing edit that could change what he meant; each removal on the redaction list.
- **Never:** approve a source on Peter's behalf. Ask interview questions through the host's question tool. Put material of a `Not public` kind in a source: internal code, customer names, security details, colleague names, internal links or non-public figures. The `Not public` section names these kinds only. Put private details, the raw interview answers or a redaction list in this repository. Change an approved source on `main` without Peter's approval. Remove, move or renumber an approved passage.

## User Stories

1. As Peter, I want to answer interview questions in normal messages, typed or spoken, so that every word I give is kept.
2. As Peter, I want my raw answers saved in my private repo before anything is written from them, so that nothing I said is lost and no colleague name or internal link reaches the public repo.
3. As Peter, I want interview sources in my own words, with only errors fixed and filler smoothed, so that the chat sounds like what I actually said.
4. As Peter, I want nothing to reach the chat until I approve it, so that the chat never says something I have not seen.
5. As Peter, I want each source to name the kinds of material that are not public, so that the chat declines them and the source never repeats them.
6. As Peter, I want to see a draft exactly as the chat will read it, with every broken rule named, so that I can review it before approval.
7. As Peter, I want the build to stop on a bad id, a missing section or an oversized passage, so that a broken source never reaches the chat.
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
26. As Peter, I want a change to an approved source to wait on a branch until I approve it, so that the live chat never says something I have not seen.
27. As Peter, I want every redaction listed for my approval, so that I know what came out of my answers and why.
28. As Peter, I want a long answer to continue under its own question, marked "(continued)", so that the source keeps the order I spoke in.
29. As a returning visitor, I want an old citation to point to the same passage after Peter adds to a source, so that my saved session stays true.
30. As the chat, I want each read in a fixed order, naming what it read, did not know and skipped, so that I know what to read next.
31. As the chat, I want a source's public links in its text, so that I can give them to a visitor.
32. As the site, I want a public form of the knowledge base without `Not public`, so that no page and no file in the browser can hold it.
33. As a visitor, I want links in answers only to Peter's own public addresses and the links he approved, so that an answer never sends me where he did not choose.
34. As a future agent, I want one id grammar, so that the build, the reads and the citation check agree.
35. As a future session, I want the raw interview answers in a private repo I can attach, so that I can write or check a source from them later.

## Out of scope

- Search over the knowledge base (embeddings, a vector index). The chat chooses from the catalog. A keyword search in the Bun server comes only if the catalog outgrows the core budget.
- The read tool's definition, the wire form of a read, the link rule in answers, the system prompt and the evals ([SPEC-chat](SPEC-chat.md)); the source view on the site ([SPEC-site](SPEC-site.md)).
- Interests outside work and personal life ([decision 0019](../docs/decisions/0019-wider-chat-scope.md)).
- Turning the raw record of Peter's 2026-10-26 answers into a source: the deep dives already carry its facts.
- Per-visitor or per-job tailoring of the knowledge.
- Creating the private repo: Peter creates `loriensleafs/resume-private` ([decision 0024](../docs/decisions/0024-private-interview-repo.md)).

## Prior-art tests

`src/knowledge/__tests__/build.test.ts`, `src/knowledge/__tests__/parse.test.ts` and `src/knowledge/__tests__/fixtures.ts`: fixtures written in the test, a temporary folder, a fake phone number for the private-details checks, and one snapshot.

These built tests encode the old contract. The build rewrites these assertions for this spec and keeps none of them:

- `build.test.ts`, the order test: it expects `deep:first` after the resume entries and before the logistics answers. The new order is resume entries, logistics answers, then the catalog entry `first`.
- `build.test.ts`, the role and highlight test: it uses one `role:` field and a bare highlight number (`highlights: [3]`). The new test uses `roles` and highlight ids.
- `build.test.ts`, the budget test: it checks `KNOWLEDGE_BUDGET`, 100,000 characters. The new tests check the 80,000, 24,000 and 3,000 budgets.
- `build.test.ts` and `src/knowledge/build.ts`: `ID_PATTERN` allows `deep:<id>`. The id grammar above replaces it.
- `build.test.ts`, the `renderKnowledge()` snapshot: it becomes the `renderCore()` and `renderSource()` snapshots.
- `parse.test.ts` and `fixtures.ts`: `parseDeepDive()` and the fixture front matter (`role: acme`, `highlights: [1]`) become `parseSource()` with `kind`, `subject`, `roles`, `summary` and highlight ids.
- `scripts/knowledge.ts`: it counts deep dives and checks `KNOWLEDGE_BUDGET`. It prints the core, the catalog and each source's size instead.

## Success Criteria

- `bun test src/knowledge` passes on a clean checkout.
- With the nine deep dives moved and the change approved under the edit rule, `bun run knowledge` prints a core under 80,000 characters with a catalog entry for each of the nine, and every source is under 24,000 characters.
- After the interviews, each of the six planned subjects has at least one approved source, and the raw answers behind it are in `interviews/` of `loriensleafs/resume-private`.

## Open Questions

None for the spec. The interview order and the sources per subject are planned in [tasks/plan.md](../tasks/plan.md) after this spec is approved.
