# Spec: content

Amended on 2026-10-27 by the approval of [SPEC-deploy](SPEC-deploy.md) (decision record row 127): the committed public documents in `documents/`.

Amended on 2026-10-27 after the spec reviews (decision record rows 128 to 136): the documents' files and test seam, the narrower documents hash, the one before-commit rule, and each role's `x-short` field. Approved by Peter with the updated mockups on 2026-10-27 (decision record row 139); the scope label and the texts follow rows 137 and 138.

## Objective

Keep Peter's resume in one file, `resume.yaml`, and build every document from it. A recruiter gets a designed PDF, an editable Word file and a plain-text file. Hiring software (ATS) reads all three in order. The public files never contain the phone number.

Acceptance criteria:

- `bun run build` writes `dist/public/` and, when `private.yaml` exists, `dist/private/`. Each folder holds `Peter-Kloss-Resume.pdf`, `.docx`, `.txt` and the print preview `resume.html`.
- The PDF is US Letter, exactly 2 pages, tagged, and every font is embedded as CID TrueType.
- The text extracted from the PDF contains every sentence of `resume.yaml` with no joined or split words.
- The Word file presents the same content, in the same order, with Word headings, bullets and right-aligned dates.
- The text file has no hard line wraps and uses `-` bullets.
- No file in `dist/public/` contains the phone number. `resume.yaml` cannot hold a phone number; the build rejects it.
- An invalid `resume.yaml` stops the build with a message that names the file and the field.
- Each role has an `x-short` field, an extension: the short label the site's career timeline shows for that role ([SPEC-site](SPEC-site.md)). Its values are the labels of the approved mockups, and Peter approves each one. No document prints it.
- `bun run documents` writes the public documents to `documents/`, with `documents/inputs.sha256`, a hash of the inputs. The inputs are `resume.yaml`, this module's source files, `fonts/`, and the locked versions of this module's own packages, read from `bun.lock`. The hash does not cover the whole of `bun.lock`, so a change to another module's packages needs no rebuild. It writes nothing when the hash is unchanged. The website serves these committed files, because Vercel's build has no Chrome ([SPEC-deploy](SPEC-deploy.md)). `scripts/__tests__/documents.test.ts` checks the hash, the page count, the fonts and the text of a fresh build, and, where `private.yaml` exists, that no committed document's extracted text holds the phone number.
- `documents/inputs.sha256` holds one line per input in `sha256sum` form, `<sha256>  <name>`, sorted by name: a file's name is its path from the repo root, and a locked package is `bun.lock#<package>`, hashed from its `bun.lock` entry. When the lines differ, the documents test names each input that changed.

## Tech Stack

- Bun 1.4.2 and TypeScript; Bun APIs only (`Bun.file`, `Bun.write`, `Bun.YAML`, `Bun.spawn`, `$`). No Node tooling, no Python.
- `zod` 4.6.7 for the schema. `docx` 9.14.0 for the Word file. `harfbuzzjs` 1.6.4 (dev) for cutting fonts.
- Google Chrome or Chromium, driven over the DevTools protocol, prints the PDF.
- Tests use `pdftotext` and `pdffonts` from poppler (`brew install poppler` on macOS; `poppler-utils` on Ubuntu).

## Commands

```sh
bun install                 # first time
bun run build               # public files, plus private files when private.yaml exists
bun run build --public      # public files only; CI runs `bun run build` to check that the documents still build
bun run documents           # rebuilds the committed public documents in documents/ when their inputs changed
bun test                    # all tests
bun test src/__tests__ scripts/__tests__/documents  # this module's tests
bun test --update-snapshots # after a deliberate content change; review the snapshot diff
bun run fonts               # only to change a font weight or add characters
```

## Project Structure

```text
resume.yaml               content, JSON Resume shape plus marked extensions
private.yaml              phone number; ignored by git
src/content.ts            schema, loadResume(variant, root), date and title formatting
src/private-details.ts    the one rule for private details: loadPrivateValues(root), holds(text, value), findPhoneNumbers(text)
src/build.ts              build({ root, outDir, variants }): the module's one entry point
src/print/                print HTML template, its CSS, the hyphen script, Chrome printing
src/export/docx.ts        Word renderer
src/export/text.ts        text renderer
scripts/build.ts          `bun run build`: a thin wrapper around build()
scripts/documents.ts      `bun run documents`: builds the public variant and writes documents/ when the inputs' hash changed
scripts/make-fonts.ts     cuts fonts/ from the Google Sans Flex variable font
fonts/                    fixed-weight Google Sans Flex and its license
documents/                the committed public documents (Peter-Kloss-Resume.pdf, .docx, .txt) and inputs.sha256
src/__tests__/            seams 1 and 2: build() and the renderers, with their snapshot
scripts/__tests__/documents.test.ts  seam 3: the committed documents
dist/                     build output; ignored by git
```

## Code Style

Small pure functions from content to output; formatting rules live in one place in `src/content.ts`:

```ts
/** "Dec 2024 – Aug 2026", with an en dash; no end date means "Present". */
export function formatRange(job: Pick<Job, "startDate" | "endDate">): string {
  return `${formatDate(job.startDate)} – ${job.endDate ? formatDate(job.endDate) : "Present"}`;
}
```

- Real typographic characters in content: en dash in ranges, curly apostrophes.
- One schema field per fact. Extensions to JSON Resume are marked `# extension` in `resume.yaml`.
- A role's `x-short` is an extension that only the site reads. A document prints it only when this spec says so, and this spec does not.
- Comments say why, not what.

## Testing Strategy

`bun test`, at two seams Peter confirmed on 2026-10-26, and a third that came with SPEC-deploy's seams (rows 117 and 127):

1. **`build()`**: tests run it into a temporary folder and check the real files.
   - On the real `resume.yaml`: the PDF has 2 pages and only CID TrueType fonts. Every summary, highlight and skill line appears in the extracted text, whitespace-normalised. The Word body text appears in reading order. The text file matches its snapshot. No public file contains the phone number.
   - On fixtures: a missing field, a bad date and a phone number in `resume.yaml` each fail with a message that names the field. A job without `endDate` prints "Present".
2. **Renderer unit tests**: `renderText`, `renderPrintHtml` and `renderDocx` on a small fixture. They check HTML escaping, the earlier-roles block, optional fields and the date formats, and that no renderer prints a role's `x-short`. Beside them, `src/__tests__/private-details.test.ts` checks the one rule for private details: each format in which `holds` finds a private value, the phone numbers `findPhoneNumbers` finds and the made-up 555-0100 to 555-0199 it lets pass, and each reason for which `loadPrivateValues` cannot check.
3. **The committed documents**: `scripts/__tests__/documents.test.ts` reads `documents/` and a fresh build in a temporary folder. It runs in CI and locally:
   - The hash of the current inputs equals `documents/inputs.sha256`, so a resume change without rebuilt documents fails.
   - The committed PDF has exactly 2 pages, is US Letter and tagged, and embeds every font.
   - A fresh build's text equals the committed files' text, spacing ignored: the text file, the PDF's text (`pdftotext`) and the Word file's text.
   - Where `private.yaml` exists, the phone number appears in none of the committed documents' extracted text.

A content edit changes the snapshots. Run `bun test --update-snapshots` and review the diff before committing.

## Boundaries

- **Always:** take every fact from Peter or his records. Run `bun run build`, `bun run build:site` and `bun test` before a commit. Commit a change to `resume.yaml` together with the documents `bun run documents` rebuilt. Keep the PDF at 2 pages.
- **Ask first:** adding a dependency; changing fonts, colors or layout; changing the shape of `resume.yaml`.
- **Never:** put the phone number or other private details in a tracked file or a public output. Invent, round up or upgrade a fact. Add Node or Python tooling. Commit `dist/`.

## User Stories

1. As Peter, I want to edit my resume in one file, so that every document stays the same.
2. As Peter, I want one command to rebuild every document, so that updating takes seconds.
3. As Peter, I want the build to stop on a typo in a field name, so that a mistake never reaches a document.
4. As Peter, I want my phone number on the files I send but not on the public website, so that scrapers cannot collect it.
5. As Peter, I want the PDF to stay exactly 2 pages, so that it matches what recruiters expect at my level.
6. As Peter, I want a preview I can open in a browser, so that I can check the layout before printing.
7. As a recruiter, I want a designed PDF, so that the resume is easy to scan.
8. As a recruiter, I want a Word file, so that I can upload it to portals that prefer Word or edit it for a client.
9. As Peter filling in an application form, I want plain text, so that I can paste my resume into a text box without stray symbols.
10. As hiring software, I want text in reading order with real letters, so that I parse titles, dates and skills correctly.
11. As hiring software, I want no words joined at line breaks, so that keyword matches work.
12. As a screen-reader user, I want a tagged PDF, so that headings and lists are announced.
13. As a hiring manager, I want exact titles and dates, so that they match the background check.
14. As the website, I want the public files, so that visitors can download them.
15. As the chat, I want the same content in a typed form, so that my answers match the documents.
16. As a future agent, I want the build and tests to show what broke, so that I fix the cause and not a symptom.

## Out of scope

- Per-job tailored versions of the resume.
- Cover letters.
- A4 paper and languages other than English.
- Syncing to LinkedIn.
- Embedding Google Sans Flex in the Word file; it uses Arial.

## Prior-art tests

None in this repo yet. Peter's design system uses `bun test` with tests beside each component, for example `src/components/markdown/__tests__/` in acmelabs-15/design-system.

## Success Criteria

- `bun test src/__tests__ scripts/__tests__/documents` passes on a clean checkout with Chrome and poppler installed.
- The private PDF is pixel-identical to the PDF built from the hand-written `resume.html` it replaced (verified 2026-10-26).
- The public PDF differs from it only on the contact line.

## Open Questions

None.
