---
name: edit-resume
description: Change Peter's resume content in resume.yaml and rebuild its PDF, Word and text documents. Use when adding, changing or removing a role, highlight, skill, headline, lead or contact detail, or when asked whether the resume still builds at 2 pages.
---

# Edit the resume

`resume.yaml` is the one resume source. The PDF, Word and text documents, the site and the chat all read it, so an edit here is the whole edit.

## 1. Trace every fact

For each fact you add or change, name where it came from: Peter's own words in this conversation, or one of his records (an offer letter, an HR notice, a performance review in his email).

Done when every new or changed fact has a source. A fact with no source goes to Peter as a question; it never goes into the file as a plausible value.

Keep Peter's scope words. "Helped" stays "helped". "Led" appears only where he led. A number appears only when Peter gave it.

## 2. Edit `resume.yaml`

- Keep JSON Resume field names. A field JSON Resume lacks is marked `# extension`, and the schema in `src/content.ts` must accept it.
- Dates are `YYYY` or `YYYY-MM`. Titles and dates match HR records exactly.
- A highlight states what Peter did, then its scale or result: "Cut initial bundle size from over 15 MB to under 1 MB across multiple applications …".
- Use real typographic characters: ’ for apostrophes, – in ranges.
- The phone number and any other private detail go in `private.yaml`, never in `resume.yaml`.

## 3. Build and look

```sh
bun run build
pdfinfo dist/private/Peter-Kloss-Resume.pdf | grep Pages
```

Open `dist/private/resume.html` in a browser, or render the PDF pages, and look at every page you changed.

Done when the PDF is exactly 2 pages and no line breaks badly. When an edit adds a third page, shorten wording; the spacing scale stays fixed. Ask Peter which line to cut when the choice changes meaning.

## 4. Test

```sh
bun test
```

A content edit changes the snapshots. Read the snapshot diff: it must show your edit and nothing else. Then run `bun test --update-snapshots` and `bun test` again.

Done when `bun test` passes and the snapshot diff matches the edit.

## 5. Report

Show Peter each changed line, before and after, with its source. Commit only when he asks; stage files by name.
