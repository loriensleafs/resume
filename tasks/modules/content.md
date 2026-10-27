# Content tasks

Spec: [SPEC-content](../../spec/SPEC-content.md), with its 2026-10-27 amendments. The order is in [todo.md](../todo.md); read these notes and your task's body only.

## Notes

- **Fixed dates in the documents** (SPEC-deploy, Documents: "The plan checks whether the Word library and Chrome accept a fixed date"). Settled before the tasks: neither does. `docx` 9.14.0 always writes `dcterms:created` and `dcterms:modified` from `new Date()` and has no option to set them (`node_modules/docx/dist/index.mjs`, lines 19304 to 19326). Chrome's `Page.printToPDF` has no date or metadata parameter. So the hash rule alone keeps rebuilds byte-stable, as the spec says; the spec needs no change. T4 records the verdict in research 12.
- **Releases.** T1 and T2 change site files (`resume.yaml`, `src/content.ts`, `scripts/`, `package.json`, `documents/`), so each push is a release, under Peter's standing approval (row 151). Before the deploy module is built, the `release` skill stops at step 1 and says so (A2). T3 and T4 change only paths on SPEC-deploy's docs-only list; they are not releases.

## Tasks

### T1: Each role has its short label (`x-short`)

Delivers: each of the nine roles in the resume source holds the short label that the career timeline shows, and no document prints it.
Blocked by: none. The nine values are a draft that Peter approves in the list before D37 (row 153).
Acceptance:
- Each role in `resume.yaml` has `x-short`, marked `# extension`, with the drafted value, and `docs/design/wording-drafts.md` holds the draft in T1's row. The mockup labels (SPEC-site, Labels) are "Brigham and Women’s", "Six Red Marbles", "HBS", "Jack Morton", "Sheridan", "LinkSquares", "Pippin", "FedNow" and "Highspot". The schema in `src/content.ts` requires the field, so a role without it stops the build, and the message names the file and the field (SPEC-content, Acceptance).
- The renderer unit tests show that `renderText`, `renderPrintHtml` and `renderDocx` print no role's `x-short` (seam 2). The fixture uses a label that appears nowhere else, such as "ACME-SHORT", so the test can fail.
- `bun run build` still writes a 2-page PDF, and the text file's snapshot does not change (seam 1). This is independent proof that no document prints the field.
Verify: `bun run build`; `bun test src/__tests__ src/knowledge`; `bun test`
Files: `resume.yaml`, `src/content.ts`, `src/__tests__/render.test.ts`, `src/__tests__/build.test.ts` (the `base` fixture gains `x-short`), `docs/design/wording-drafts.md` (T1's row), and the knowledge test fixture's `resume.yaml` (in `src/knowledge/__tests__/build.test.ts`, or in `src/knowledge/__tests__/fixtures.ts` once K1 has moved it), which gains `x-short` or the knowledge tests break. Whichever of T1 and the K tasks lands second updates that fixture.
Size: M
Needs Peter: approval of each value (SPEC-content, Acceptance), in the list before D37 (row 153); the decision record holds it. The draft also settles the apostrophe for his review: SPEC-site writes "Brigham and Women's" with a straight apostrophe, and SPEC-content's Code Style asks for curly apostrophes. The draft takes the curly one, as in "Brigham and Women’s Hospital", because the Code Style rule covers it. The push is a release under his standing approval (row 151).

### T2: `bun run documents` writes the committed public documents and their inputs hash

Delivers: one command fills `documents/` with the public PDF, Word and text files and `inputs.sha256`. A second run changes nothing. A resume change without that command fails `bun test`, and the failure names the command.
Blocked by: none. T1 first is preferred. When T2 runs first, T1 also runs `bun run documents` and commits `documents/`, as the documents test will demand.
Acceptance:
- `bun run documents` builds the public variant in a temporary folder and writes `documents/Peter-Kloss-Resume.pdf`, `.docx`, `.txt` and `inputs.sha256`. When the hash has not changed, it writes nothing and says so (SPEC-content, Acceptance).
- The hash covers `resume.yaml`, the module's source files (`src/content.ts`, `src/build.ts`, `src/print/`, `src/export/` and `scripts/documents.ts`), `fonts/`, and the top-level `bun.lock` entries of `zod`, `docx` and `harfbuzzjs`. It covers nothing else from `bun.lock`.
- `scripts/__tests__/documents.test.ts` (seam 3, first check): the hash of the current inputs equals `documents/inputs.sha256`. On a mismatch, the failure names `bun run documents` (SPEC-content, story 16).
Verify: `bun run documents`; run it again and check that `git status --short documents/` shows no new change; `bun test src/__tests__ scripts/__tests__/documents`. By hand: change one word of `resume.yaml`, see the documents test fail with the command's name, then revert.
Files: `scripts/documents.ts`, `package.json` (script `documents`), `scripts/__tests__/documents.test.ts`, `documents/` (four generated files), `scripts/build.ts` (its `--public` comment: the website uses `documents/`; SPEC-deploy's amendment to SPEC-content)
Size: M
Needs Peter: no decision. `documents/` and the scripts are site files, so the push is a release under his standing approval (row 151).
Notes: the hash function lives in `scripts/documents.ts` behind `import.meta.main`. The test can then import it without running the script, and the files stay where SPEC-content's Project Structure puts them. The source-file list above is the content planner's reading of "this module's source files" in the Project Structure. It is a small choice that can be reversed. A reviewer can trim it.

### T3: The documents test checks the committed files against a fresh build

Delivers: `bun test` fails, and names the file, when a committed document is not 2 pages, misses an embedded font, has text that differs from a fresh build, or holds the phone number.
Blocked by: T2
Acceptance:
- The committed PDF has exactly 2 pages, is US Letter and tagged, and embeds every font (`pdfinfo`, `pdffonts`; SPEC-content, Testing Strategy 3).
- A fresh public build in a temporary folder has the same text as the committed files, with spacing ignored. This covers the text file, the PDF's text from `pdftotext`, and the Word file's `word/document.xml` text.
- Where `private.yaml` exists, the phone number is in none of the committed documents' extracted text. Without `private.yaml` (CI, fresh clones), the check skips.
Verify: `bun test scripts/__tests__/documents.test.ts`; `bun test`. By hand: replace `documents/Peter-Kloss-Resume.txt` with an edited copy, see the test name the text file, then restore it.
Files: `scripts/__tests__/documents.test.ts`
Size: S
Needs Peter: no
Notes: keep the `pdftotext` and Word-text helpers inside the test file. A shared helper outside `*.test.ts` would be a site file under SPEC-deploy's docs-only list, so every change to it would be a release.

### T4: The content module lands

Delivers: `AGENTS.md`, the capability map and STATUS show content as built with its amendments. A fresh session told only "continue" names the next task's spec.
Blocked by: T1, T3, A1
Acceptance:
- In `AGENTS.md`, the content row of the Modules table lists the folders as built (`resume.yaml`, `src/content.ts`, `src/build.ts`, `src/print/`, `src/export/`, `documents/`), `bun test src/__tests__ scripts/__tests__/documents`, and the state "built". In `spec/README.md`, the content row says built (SPEC-agents, Code Style: "The task that builds a module updates its row").
- The fresh-session check passes, and its result is in `docs/STATUS.md`. A sub-agent in a fresh clone is told only "continue", and Peter reads the result. It reports the phase, the last step, the next step, anything red and the pending decisions in 5 lines or fewer, and it names the next task's spec (SPEC-agents, Testing Strategy 2).
- Research 12 records the fixed-date verdict from "Settled before the tasks".
Verify: `bun test`; the fresh-session check (a sub-agent in a fresh clone)
Files: `AGENTS.md`, `spec/README.md`, `docs/STATUS.md`, `docs/research/12-deploy-platform.md`
Size: S
Needs Peter: no

## Checkpoints

### Checkpoint content: lands

After T1 to T4. `bun run build` writes a 2-page PDF. `bun run documents` reports no change. `bun test` passes. Peter looks at the committed `documents/`. The push is a release under his standing approval (row 151). T4 has updated the content rows of `AGENTS.md`'s Modules table and `spec/README.md`, and recorded the fresh-session check.
