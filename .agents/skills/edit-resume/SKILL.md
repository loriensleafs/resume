---
name: edit-resume
description: Change Peter's resume content in resume.yaml and rebuild its PDF, Word and text documents in documents/. One commit holds resume.yaml and the rebuilt documents/, and the release skill pushes it. Use when adding, changing or removing a role, a role's short label on the career timeline (x-short), a highlight, skill, headline, lead or contact detail, or when asked whether the resume still builds at 2 pages.
---

# Edit the resume

`resume.yaml` is the one resume source. The PDF, Word and text documents, the site and the chat all read it.

## 1. Trace every fact

For each fact you add or change, name where it came from: Peter's own words in this conversation, or one of his records (an offer letter, an HR notice, a performance review in his email).

Keep Peter's scope words. "Helped" stays "helped". "Led" appears only where he led. A number appears only when Peter gave it.

A fact with no source goes to Peter as a question through `ask-user-question:ask-user-question`; it never goes into the file as a plausible value.

Done when every new or changed fact has a source.

## 2. Edit `resume.yaml`

- Keep JSON Resume field names. A field JSON Resume lacks is marked `# extension`, and the schema in `src/content.ts` must accept it.
- Dates are `YYYY` or `YYYY-MM`. Titles and dates match HR records exactly.
- A highlight states what Peter did, then its scale or result: "Cut initial bundle size from over 15 MB to under 1 MB across multiple applications …".
- Use real typographic characters: ’ for apostrophes, – in ranges.
- A private contact detail, such as the phone number, goes only in the untracked `private.yaml`, never in `resume.yaml` ([decision 0006](../../../docs/decisions/0006-public-repo-private-details.md)).

Each role has `x-short`, its short label on the career timeline:

- Only the site reads it. No document prints it.
- The schema requires it, so a new role needs one.
- A short value fits the role's span; [SPEC-site](../../../spec/SPEC-site.md), Views, "Labels", says how a longer one shows.
- While [T1's wording draft](../../../docs/design/wording-drafts/T1.md) has the status `wording draft`, write each new or changed value into its table, and keep that status. Peter approves the draft in his one review before D37 (row 153).
- Once that draft is approved, ask Peter about each new or changed value through `ask-user-question:ask-user-question`. Record his answer, quoted, in a new row of the decision record, `docs/design/interview-<date>.md`.

Done when `git diff resume.yaml` shows each traced change and nothing else, and each new or changed `x-short` value is in T1's wording draft or quoted in a new decision record row.

## 3. Build and look

```sh
bun run build
pdfinfo dist/private/Peter-Kloss-Resume.pdf | grep Pages
```

Open `dist/private/resume.html` in a browser, or render the PDF pages, and look at every page you changed. When an edit adds a third page, shorten wording; the spacing scale stays fixed. When the line to cut changes meaning, ask Peter through `ask-user-question:ask-user-question`.

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

Put the edit to Peter through `ask-user-question:ask-user-question`: each changed line of `resume.yaml`, before and after, with its source. Recommend the commit.

Done when Peter approved the commit, or named changes; changes go back to step 1.

## 7. Commit and push

Run the before-commit checks ([AGENTS.md](../../../AGENTS.md), "Verify"). Make one commit, with each file staged by name:

- `resume.yaml`;
- the files in `documents/` that step 4 changed;
- any snapshot that step 5 updated;
- from step 2, T1's wording draft, or the new row in the decision record, `docs/design/interview-<date>.md`.

`resume.yaml` and `documents/` are site files, so the push to `main` is a release. Push with the [release skill](../release/SKILL.md).

Done when `git show --stat HEAD` lists `resume.yaml` and `documents/inputs.sha256`, and the release skill has given Peter its outcome.
