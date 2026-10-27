# Spec: content

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

## Tech Stack

- Bun 1.4.2 and TypeScript; Bun APIs only (`Bun.file`, `Bun.write`, `Bun.YAML`, `Bun.spawn`, `$`). No Node tooling, no Python.
- `zod` 4.6.7 for the schema. `docx` 9.14.0 for the Word file. `harfbuzzjs` 1.6.4 (dev) for cutting fonts.
- Google Chrome or Chromium, driven over the DevTools protocol, prints the PDF.
- Tests use `pdftotext` and `pdffonts` from poppler (`brew install poppler` on macOS; `poppler-utils` on Ubuntu).

## Commands

```sh
bun install                 # first time
bun run build               # public files, plus private files when private.yaml exists
bun run build --public      # public files only (the website and CI use this)
bun test                    # all tests
bun test tests/content      # this module's tests
bun test --update-snapshots # after a deliberate content change; review the snapshot diff
bun run fonts               # only to change a font weight or add characters
```

## Project Structure

```text
resume.yaml               content, JSON Resume shape plus marked extensions
private.yaml              phone number; ignored by git
src/content.ts            schema, loader, date and title formatting
src/build.ts              build({ root, outDir, variants }): the module's one entry point
src/print/                print HTML template, its CSS, the hyphen script, Chrome printing
src/export/docx.ts        Word renderer
src/export/text.ts        text renderer
scripts/build.ts          `bun run build`: a thin wrapper around build()
scripts/make-fonts.ts     cuts fonts/ from the Google Sans Flex variable font
fonts/                    fixed-weight Google Sans Flex and its license
tests/content/            this module's tests, fixtures and snapshots
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
- Comments say why, not what.

## Testing Strategy

`bun test`, at two seams Peter confirmed on 2026-10-26:

1. **`build()`**: tests run it into a temporary folder and check the real files.
   - On the real `resume.yaml`: the PDF has 2 pages and only CID TrueType fonts. Every summary, highlight and skill line appears in the extracted text, whitespace-normalised. The Word body text appears in reading order. The text file matches its snapshot. No public file contains the phone number.
   - On fixtures: a missing field, a bad date and a phone number in `resume.yaml` each fail with a message that names the field. A job without `endDate` prints "Present".
2. **Renderer unit tests**: `renderText`, `renderPrintHtml` and `renderDocx` on a small fixture. They check HTML escaping, the earlier-roles block, optional fields and the date formats.

A content edit changes the snapshots. Run `bun test --update-snapshots` and review the diff before committing.

## Boundaries

- **Always:** take every fact from Peter or his records. Run `bun run build` and `bun test` before a commit. Keep the PDF at 2 pages.
- **Ask first:** adding a dependency; changing fonts, colors or layout; changing the shape of `resume.yaml`.
- **Never:** put the phone number or other private details in a tracked file or a public output. Invent, round up or upgrade a fact. Add Node or Python tooling. Commit `dist/`.

## User Stories

1. As Peter, I want to edit my resume in one file, so that every document stays the same.
2. As Peter, I want one command to rebuild every document, so that updating takes seconds.
3. As Peter, I want the build to stop on a typo in a field name, so that a mistake never ships.
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

- `bun test tests/content` passes on a clean checkout with Chrome and poppler installed.
- The private PDF is pixel-identical to the PDF built from the hand-written `resume.html` it replaced (verified 2026-10-26).
- The public PDF differs from it only on the contact line.

## Open Questions

None.
