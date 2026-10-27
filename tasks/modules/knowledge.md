# Knowledge tasks

Spec: [SPEC-knowledge](../../spec/SPEC-knowledge.md), approved with decisions 0001, 0015, 0016, 0017, 0019, 0023, 0024 and decision record rows 32 to 36, 84 and 128 to 142. The order is in [todo.md](../todo.md); read these notes and your task's body only.

## Notes

- **These tasks replace task 11.** The id rules are K1 and K5; the source parser K2 and K4; the core with its catalog K3, K5 and K6; `readPassages()` K7 and K8; `publicKnowledge()` K9; `previewDraft()` and `bun run knowledge --draft` K10; the move of the nine deep dives and Peter's approval of the nine summaries K11 to K13. Task 11's verify (nine catalog entries, a core under 80,000 characters) is the landing checkpoint. `knowledge/README.md` for the move is K10.
- **Verify on every task.** Each task ends with `bun run build` and `bun test` before its commit (AGENTS.md, Verify); the Verify lines give the focused checks. SPEC-knowledge's Boundaries also name `bun run build:site` before a commit; it exists only after D16, and until then knowledge tasks run `bun run build` and `bun test`.
- **Files** lists leave out `tasks/todo.md` and `docs/STATUS.md`, which every task updates at its end.
- **The window with an empty catalog.** From K3 until K11 lands, `bun run knowledge` on `main` shows no catalog entries: the nine deep dives stay in `knowledge/deep-dives/`, in the old front matter, unread, until Peter approves their move (edit rule). Nothing live reads the knowledge base yet. The tasks land on `main`, so site and chat can build against the knowledge contract.
- **Three move batches, not one.** The five-file rule splits the move into three tasks of three deep dives, so Peter answers three approval questions.
- **K5 and K10 share the checks.** K5 writes the rules on approved sources so that they return every problem, and the build stops with them; K10 reuses them, so `previewDraft()` names each broken rule.
- **K10 finds a draft among the files in `knowledge/sources/`** instead of joining the id into a path, so `--draft <id>` cannot read a file outside that folder. K7 looks ids up in the built knowledge only (a `Map`), so an id such as `__proto__` is unknown, not a crash.
- K5 and K6 both edit `src/knowledge/build.ts` and `src/knowledge/__tests__/build.test.ts`; run them one after the other.
- **The `x-short` fixture.** Content's T1 makes each role's `x-short` required, so the knowledge test fixture's `resume.yaml` needs it too. Whichever of T1 and the K tasks lands second updates that fixture.

## Tasks

### K1: The id grammar in one module

Delivers: every id the build makes is checked by the one id grammar in `src/knowledge/ids.ts`, and a role id or logistics topic that is not a slug stops the build.
Blocked by: none
Acceptance:
- `src/knowledge/ids.ts` holds the grammar: slug `[a-z0-9]+(-[a-z0-9]+)*` of at most 60 characters, `n` from 1, a source id (a slug, never `basics` or `education`), a passage id of at most 64 characters, and the resume entry and logistics id forms; `toSlug()` moves there and `ID_PATTERN` is gone (Ids; Prior-art tests).
- A fixture role id or logistics topic that is not a slug, or a skills group whose name gives no slug, stops `buildKnowledge()` with a message that names the file and the field (Ids: "the build stops on one that is not").
- K1 picks the export names of `src/knowledge/ids.ts` and records them in SPEC-knowledge, so the site and chat tasks can cite them (main's decision, 2026-10-27). The fixture's `resume.yaml` keeps each role's `x-short` if T1 has landed first; otherwise T1 adds it.
Verify: `bun test src/knowledge`; the existing core snapshot passes unchanged and `bun run knowledge` prints the same text as before.
Files: `src/knowledge/ids.ts`, `src/knowledge/build.ts`, `src/knowledge/__tests__/build.test.ts`, `src/knowledge/__tests__/fixtures.ts` (the fixture folder helper moves here, so later tests and content's `x-short` change edit one place), `spec/SPEC-knowledge.md` (the export names), `src/knowledge/__tests__/ids.test.ts` (seam 3, added by Peter during the review, decision record row 146)
Size: S
Needs Peter: no

### K2: The source parser reads deep dives and interviews

Delivers: `parseSource()` turns one source file into a source with numbered passages and its `Not public` text, and stops on a broken shape with a message that names the file and the field.
Blocked by: K1
Acceptance:
- Front matter for both kinds is read with a strict schema (`id`, `title`, `kind`, `subject`, `roles`, `highlights`, `summary`, `links`, `status`, `approved`, `source`); the file name is `<id>.md`; highlight ids have the form `highlight:<role id>.<n>` and only a deep dive may have them; an approved source needs its `approved:` date (Sources).
- Every `## ` section except `Not public` is a passage `<id>.<n>`, numbered from 1 in file order; `Not public` comes last and has no passage id; a deep dive has its six sections in order; an interview's "(continued)" heading comes directly after the heading it continues; text before the first section, a missing section or an unknown deep-dive section stops it (Sources; Testing Strategy 2).
- In an approved source a passage over 3,000 characters, or a summary that is not one line of at most 200 characters, stops it; a draft passes both (Objective; Sources, "Summary"; Drafts and approval).
Verify: `bun test src/knowledge/__tests__/parse.test.ts`
Files: `src/knowledge/parse.ts`, `src/knowledge/__tests__/parse.test.ts`, `src/knowledge/__tests__/fixtures.ts`
Size: M
Needs Peter: no

### K3: The core with its catalog, from approved sources

Delivers: `buildKnowledge()` returns `{ core, sources }` from `knowledge/sources/`, and `renderCore()` and `bun run knowledge` print the core in its three parts with its size.
Blocked by: K2
Acceptance:
- On fixtures the core comes in a fixed order: resume entries, approved logistics answers, then one catalog entry per approved source in source-id order; a draft source file reaches neither the catalog nor `sources` (Objective; Testing Strategy 1; replaces the old order and draft tests).
- `renderCore()` prints `# Resume`, `# Job-search logistics` and `# Catalog`; a catalog line reads `[<source id>] <title>: <kind>, roles <role ids>. <summary>`, without "roles" when the source has none (Rendered text; replaces the `renderKnowledge()` snapshot with a `renderCore()` snapshot of the real files).
- The rendered core of the real files stays under 80,000 characters, and `bun run knowledge` prints the core and its size against that budget; the `deep:` form, `renderKnowledge()` and `KNOWLEDGE_BUDGET` are gone (Objective; Prior-art tests).
Verify: `bun test src/knowledge`; `bun run knowledge` (an empty catalog until K11, see the notes)
Files: `src/knowledge/build.ts`, `src/knowledge/render.ts`, `scripts/knowledge.ts`, `src/knowledge/__tests__/build.test.ts`
Size: M
Needs Peter: no

### K4: Remove the deep-dive parser

Delivers: the knowledge module has one parser, and none of the old contract's assertions remain.
Blocked by: K3
Acceptance:
- `parseDeepDive()`, its tests and the old fixture front matter (`role: acme`, `highlights: [1]`) are removed; the fixtures build `parseSource()` files only (Prior-art tests: "keeps none of them").
- `bun test src/knowledge` passes with none of the old contract's assertions left (Prior-art tests).
Verify: `bun test src/knowledge`; `grep -rn "parseDeepDive\|deep:" src scripts` finds nothing
Files: `src/knowledge/parse.ts`, `src/knowledge/__tests__/parse.test.ts`, `src/knowledge/__tests__/fixtures.ts`, `knowledge/deep-dives/.gitkeep` (removed; the folder empties as K11 to K13 move its nine files)
Size: S
Needs Peter: no

### K5: The rules on approved sources stop the build

Delivers: an approved source with a bad id, an unknown role or highlight, a bad link, an empty passage or a URL in `Not public` stops `buildKnowledge()` with a message that names the file and the field, and a draft is checked for shape only.
Blocked by: K3
Acceptance:
- A source id with a capital letter, an underscore, two hyphens together, 61 characters, `basics` or `education` stops the build; every id in the knowledge base is unique (Ids; Testing Strategy 1).
- A role id in `roles` or a highlight id in `highlights` that `resume.yaml` does not have, a link that is not an absolute `https://` URL or that holds a user name or password, a URL or email address in `Not public`, and a passage with no text each stop the build: an approved passage holds text, and only `Not public` may be empty (Sources; main's decision 2026-10-27, the old parser's rule; replaces the old role and highlight test).
- A draft with an unknown role or an oversized passage still builds; a draft with broken front matter or sections stops it (Drafts and approval; Testing Strategy 1).
Verify: `bun test src/knowledge`
Files: `src/knowledge/build.ts`, `src/knowledge/ids.ts`, `src/knowledge/__tests__/build.test.ts`
Size: M
Needs Peter: no

### K6: Rendered sources and the passage-id snapshot

Delivers: `renderSource()` gives a source as the chat reads it, each approved source stays under 24,000 characters, and a snapshot guards every approved passage id.
Blocked by: K3
Acceptance:
- `renderSource()` gives `# [<id>] <title>`, the kind line of a deep dive or an interview, the Roles, Highlights and Links line with only its parts that are not empty (left out when all three are empty), `## [<id>.<n>] <heading>` for each passage asked for (all when omitted) in file order, then `## Not public: decline to describe these kinds of material` with its text or "Nothing listed." (Rendered text; checked against literal text on fixtures).
- A rendered approved source over 24,000 characters stops the build; the fixture `private.yaml`'s fake phone number appears in neither the core nor any rendered source; `bun run knowledge` prints each source's size (Objective; Testing Strategy 1; Prior-art tests).
- A fixture source's rendered text has a snapshot, and a snapshot of the real files lists every approved source's passage ids with their headings, which may only grow at the end of a source's list (Testing Strategy 1, append-only).
Verify: `bun test src/knowledge`; `bun run knowledge`
Files: `src/knowledge/render.ts`, `src/knowledge/build.ts`, `scripts/knowledge.ts`, `src/knowledge/__tests__/build.test.ts`
Size: M
Needs Peter: no

### K7: `readPassages()` reads approved sources by id

Delivers: `readPassages(knowledge, ids)` returns the text of the sources and passages asked for, from approved sources only, names the ids it does not know, and `bun run knowledge <source id>` prints a source as it returns it.
Blocked by: K6
Acceptance:
- A source id reads all its passages and a passage id reads one; a draft's id, a resume entry id and any other id (`__proto__` among them) go to `unknown`, each once, in the order asked (`readPassages()` rules).
- The text groups passages by source, in the order each source first appears, in file order within a source, with one header and one `Not public` section per source, also for a single passage; an id whose passages are already in the text adds nothing; `read` lists each id whose text is in the result once, in the order asked (`readPassages()` rules).
- `bun run knowledge <source id>` prints the `text` of `readPassages(knowledge, [<source id>])`, and its `unknown` ids (Commands).
Verify: `bun test src/knowledge/__tests__/read.test.ts` (seam 1, in its own file); `bun run knowledge no-such-source` names the id as unknown (real sources exist only after K11)
Files: `src/knowledge/read.ts`, `src/knowledge/__tests__/read.test.ts`, `src/knowledge/__tests__/fixtures.ts`, `scripts/knowledge.ts`
Size: M
Needs Peter: no

### K8: `readLimits` bound every read

Delivers: a read stops at 24,000 characters and names what it skipped, too many ids or too long an id throws, and `readLimits` is exported for the chat's read tool.
Blocked by: K7
Acceptance:
- `readLimits` is `{ ids: 20, idCharacters: 64, characters: 24_000 }`; more than 20 ids, or an id over 64 characters, throws (Code Style; `readPassages()` rules).
- The 24,000 characters count all of `text`; when the next id would take `text` past them, the read stops, that id and every later id it knows and has not read go to `skipped` in order, and `unknown` still lists each later unknown id once (`readPassages()` rules).
Verify: `bun test src/knowledge/__tests__/read.test.ts`
Files: `src/knowledge/read.ts`, `src/knowledge/__tests__/read.test.ts`
Size: S
Needs Peter: no

### K9: `publicKnowledge()` leaves out every `Not public` section

Delivers: `publicKnowledge(knowledge)` gives the `PublicKnowledge` shape that the site's pages and the device index use, with no `Not public` text.
Blocked by: K3
Acceptance:
- Its JSON holds no fixture `Not public` text, and the rest equals the output of `buildKnowledge()` (Testing Strategy 1).
- Its type is `{ core: Entry[]; sources: Omit<Source, "notPublic">[] }` (Code Style, "Who gets which shape").
Verify: `bun test src/knowledge`
Files: `src/knowledge/build.ts`, `src/knowledge/__tests__/build.test.ts`
Size: S
Needs Peter: no

### K10: `bun run knowledge --draft` shows a draft as the chat will read it

Delivers: Peter reads a draft source file as the chat will read it once approved, with every rule it breaks named.
Blocked by: K5, K6
Acceptance:
- `previewDraft({ root, id })` applies every rule now and names each rule a fixture draft breaks (Drafts and approval; Testing Strategy 1).
- Its text equals what `renderSource()` gives once the draft is approved (Testing Strategy 1).
- `bun run knowledge --draft <source id>` prints the text and then each broken rule; `knowledge/README.md` describes `knowledge/sources/` (deep dives and interviews), `logistics.yaml` and the three commands (Commands; STATUS "Next").
Verify: `bun test src/knowledge`; with a temporary, uncommitted draft file in `knowledge/sources/`, `bun run knowledge --draft <its id>` prints its text and each broken rule
Files: `src/knowledge/build.ts`, `scripts/knowledge.ts`, `src/knowledge/__tests__/build.test.ts`, `knowledge/README.md`
Size: M
Needs Peter: no

### K11: Move three deep dives to sources: `fednow-architecture`, `fednow-bundle-size`, `fednow-design-system`

Delivers: these three deep dives are sources in `knowledge/sources/`, with summaries Peter approved, and their catalog entries are in the core.
Blocked by: K5, K6, K7; Peter: approve the three summaries and the moved files
Acceptance:
- Each file moves with `git mv` and only its front matter changes: `kind: deep-dive`, `subject: project`, `roles: [<role id>]`, `highlights` as highlight ids, `links: []`, and a one-line summary of at most 200 characters written from the source; no passage text changes (Sources, "Deep dive").
- The change waits on a branch until Peter approves it in the question tool, after he reads each with `bun run knowledge <source id>` on the branch and sees the passage-id snapshot diff; it lands on `main` with the new `approved:` date, and the decision record gets a row with the source ids and that date (Drafts and approval; the edit rule, row 130).
- On `main`, `bun run knowledge` shows the three catalog entries, and the passage-id snapshot gained exactly their three lists (append-only).
Verify: on the branch `bun test src/knowledge` and `bun run knowledge <source id>` for each; after landing `bun run knowledge`
Files: `knowledge/sources/fednow-architecture.md`, `knowledge/sources/fednow-bundle-size.md`, `knowledge/sources/fednow-design-system.md`, `src/knowledge/__tests__/__snapshots__/build.test.ts.snap`, `docs/design/interview-2026-10-26.md`
Size: S
Needs Peter: yes. Approval in the question tool of the three summaries and the moved files (edit rule, row 130). The push changes site files (the site build reads `knowledge/`), so it is also a release, which Peter approves.

### K12: Move three deep dives to sources: `fednow-standards-mentoring`, `highspot-agent-workflow`, `highspot-ai-standards`

Delivers: these three deep dives are sources in `knowledge/sources/`, with summaries Peter approved, and their catalog entries are in the core.
Blocked by: K5, K6, K7; Peter: approve the three summaries and the moved files
Acceptance:
- As K11, first bullet, for these three files (`fednow-standards-mentoring` gets `highlights: [highlight:fednow.4, highlight:fednow.5]`, `highspot-agent-workflow` gets `[highlight:highspot.3, highlight:highspot.4]`).
- As K11, second bullet: on a branch, Peter's approval in the question tool, a new `approved:` date and a decision record row.
- As K11, third bullet, for these three.
Verify: as K11
Files: `knowledge/sources/fednow-standards-mentoring.md`, `knowledge/sources/highspot-agent-workflow.md`, `knowledge/sources/highspot-ai-standards.md`, `src/knowledge/__tests__/__snapshots__/build.test.ts.snap`, `docs/design/interview-2026-10-26.md`
Size: S
Needs Peter: yes, as K11.

### K13: Move three deep dives to sources: `highspot-data-table`, `highspot-mcp-server`, `highspot-streaming-markdown`

Delivers: these three deep dives are sources in `knowledge/sources/`, with summaries Peter approved, and their catalog entries are in the core.
Blocked by: K5, K6, K7; Peter: approve the three summaries and the moved files
Acceptance:
- As K11, first bullet, for these three files.
- As K11, second bullet: on a branch, Peter's approval in the question tool, a new `approved:` date and a decision record row.
- As K11, third bullet, for these three.
Verify: as K11
Files: `knowledge/sources/highspot-data-table.md`, `knowledge/sources/highspot-mcp-server.md`, `knowledge/sources/highspot-streaming-markdown.md`, `src/knowledge/__tests__/__snapshots__/build.test.ts.snap`, `docs/design/interview-2026-10-26.md`
Size: S
Needs Peter: yes, as K11.

### Task 13: Long-form interviews, one subject at a time: career, working style, stories, opinions, side projects, skills

Delivers: approved interview sources for the six subjects, from Peter's own words.
Blocked by: A7 (the `write-source` repo skill), K10 (`bun run knowledge --draft <source id>`)
Acceptance:
- Each subject has at least one approved interview source; every raw answer is saved privately first, word for word, in `loriensleafs/resume-private`, folder `interviews/` (decision 0024).
- The interview itself runs in normal chat messages, never the question dialog; a first draft source can be written once K3 lands, checked with `bun run knowledge --draft <source id>` once K10 lands, and approved by Peter after that read.
Verify: `bun run knowledge` lists the sources; `bun test`
Files: `knowledge/sources/<id>.md` per interview source
Size: S per source
Needs Peter: yes. The interviews themselves; the kind line for interview sources (SPEC-site gives only the deep-dive wording) before the first interview source is approved; each source's approval; each push of a source is a release.

## Checkpoints

### Checkpoint knowledge: old contract gone

After K4. `bun run build` and `bun test` pass; `grep` finds no `parseDeepDive`, `deep:`, `renderKnowledge` or `KNOWLEDGE_BUDGET`; `bun run knowledge` prints the core in three parts (catalog empty). Review with Peter before the rules and reads.

### Checkpoint knowledge: contract complete

After K5 to K10. The knowledge contract in the capability map (`spec/README.md`, contracts table) is complete: `buildKnowledge()`, `publicKnowledge()`, `readPassages()` with `readLimits`, `renderCore()`, `renderSource()`, `previewDraft()` and the id rules, with their export names in SPEC-knowledge (K1). Every check in SPEC-knowledge's Testing Strategy that needs no real source passes. The site and chat tasks that use the contract can start. Review with Peter before the moves.

### Checkpoint knowledge: lands

After K11 to K13. SPEC-knowledge's success criteria: `bun test src/knowledge` passes on a clean checkout; `bun run knowledge` prints a core under 80,000 characters with nine catalog entries, and every source is under 24,000 characters; `knowledge/deep-dives/` no longer exists; three decision record rows hold the approvals. The knowledge rows of `AGENTS.md`'s Modules table and `spec/README.md` say built, the fresh-session check passes, and STATUS is rewritten.
