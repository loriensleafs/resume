---
name: edit-resume
description: Change Peter's resume content in resume.yaml, rebuild its PDF, Word and text documents in documents/, and push both in one commit as a release. Use when adding, changing or removing a role, a role's short label on the career timeline (x-short), a highlight, skill, headline, lead or contact detail, or when asked whether the resume still builds at 2 pages.
---

# Edit the resume

`resume.yaml` is the one resume source. The PDF, Word and text documents, the site and the chat all read it. One commit carries the whole edit: `resume.yaml`, the documents rebuilt in `documents/`, and any snapshot the edit changes.

## 1. Trace every fact

For each fact you add or change, name where it came from: Peter's own words in this conversation, or one of his records (an offer letter, an HR notice, a performance review in his email).

Keep Peter's scope words. "Helped" stays "helped". "Led" appears only where he led. A number appears only when Peter gave it.

A fact with no source goes to Peter as a question through `brain:ask-user-question`; it never goes into the file as a plausible value.

Done when every new or changed fact has a source.

## 2. Edit `resume.yaml`

- Keep JSON Resume field names. A field JSON Resume lacks is marked `# extension`, and the schema in `src/content.ts` must accept it.
- Dates are `YYYY` or `YYYY-MM`. Titles and dates match HR records exactly.
- A highlight states what Peter did, then its scale or result: "Cut initial bundle size from over 15 MB to under 1 MB across multiple applications …".
- Use real typographic characters: ’ for apostrophes, – in ranges.
- The phone number and any other private detail go in `private.yaml`, never in `resume.yaml`.
- Each role has `x-short`, its short label on the career timeline. Only the site reads it; no document prints it. The schema requires it, so a new role needs one.

Peter approves each new or changed `x-short` value ([SPEC-content](../../../spec/SPEC-content.md), Acceptance). Ask him through `brain:ask-user-question`, and recommend a short name: the label stays on one line, and a label longer than its role's span ends in an ellipsis ([SPEC-site](../../../spec/SPEC-site.md), Views, "Labels"). Record his answer, quoted, in a new row of the decision record (`docs/design/interview-*.md`).

Done when `git diff resume.yaml` shows each traced change and nothing else, and a decision record row quotes Peter's approval of each new or changed `x-short`.

## 3. Build and look

```sh
bun run build
pdfinfo dist/private/Peter-Kloss-Resume.pdf | grep Pages
```

Open `dist/private/resume.html` in a browser, or render the PDF pages, and look at every page you changed. When an edit adds a third page, shorten wording; the spacing scale stays fixed. When the line to cut changes meaning, ask Peter through `brain:ask-user-question`.

Done when the PDF is exactly 2 pages and no line breaks badly.

## 4. Rebuild the committed documents

The site serves the public documents committed in `documents/`, because Vercel's build has no Chrome ([SPEC-deploy](../../../spec/SPEC-deploy.md), "Documents"). `resume.yaml` is one of their inputs, so every edit to it needs a rebuild:

```sh
bun run documents
pdfinfo documents/Peter-Kloss-Resume.pdf | grep Pages
git status --short documents/
```

Done when `pdfinfo` prints `Pages: 2` and `git status` lists `documents/inputs.sha256` as changed.

## 5. Test

```sh
bun test
```

A content edit changes the snapshots. Read the snapshot diff: it must show your edit and nothing else. A change to `x-short` alone changes no snapshot, because no document prints it. Then run `bun test --update-snapshots` and `bun test` again.

Done when `bun test` passes and the snapshot diff matches the edit.

## 6. Report

Put the edit to Peter through `brain:ask-user-question`: each changed line of `resume.yaml`, before and after, with its source. Recommend the commit.

Done when Peter approved the commit, or named changes; changes go back to step 1.

## 7. Commit and push

Run the before-commit checks ([AGENTS.md](../../../AGENTS.md), "Verify"). Make one commit, with each file staged by name: `resume.yaml`, the files in `documents/` that step 4 changed, any snapshot that step 5 updated, and the decision record rows of step 2.

`resume.yaml` and `documents/` are site files, so the push to `main` is a release. Push with the [release skill](../release/SKILL.md).

Done when `git show --stat HEAD` lists `resume.yaml` and `documents/inputs.sha256`, and the release skill has given Peter its outcome.
