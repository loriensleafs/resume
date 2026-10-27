# Plan

Follows the [capability map](../spec/README.md). Each module gets its spec approved before its tasks start. Checkpoints end each phase with a full build, the tests and Peter's review.

## Phase 1: content (spec approved)

Built: the resume source, the build, and the PDF, Word and text documents. Remaining: the tests at the two approved seams, `build()` and the renderer unit tests. The tests need Chrome and poppler.

Checkpoint A: `bun run build` and `bun test` pass. The private PDF is pixel-identical to the PDF built from the hand-written `resume.html`. Peter approves the history rewrite, and the work is pushed.

## Phase 2: agents (alongside every phase)

`AGENTS.md`, `CLAUDE.md`, the `edit-resume` skill and the README describe the repository as it is. Each later module updates them when it lands.

## Phase 3: knowledge and site (specs to write)

- knowledge: the knowledge-file format (entries with ids), its build from the resume source, deep dives and logistics answers, and the interviews that fill them.
- site: TanStack Start app on Bun, prerendered resume and deep-dive pages, design-system theme, PWA offline cache, document downloads.

These two can run in parallel once their specs are approved; site pages for deep dives wait for the knowledge format.

## Phase 4: chat (spec to write)

TanStack AI server route, chat UI with design-system parts, citations, refusals, TanStack DB history and the offline queue, and the trick-question eval suite.

## Phase 5: deploy (spec to write)

Host, rate limit, spend cap, domain, CI that builds the public variant and runs the evals. Making the repository public happens here at the latest.

## Risks

| Risk | Mitigation |
|---|---|
| The design system renames parts during its systematization pass | Pin exact versions; upgrade deliberately |
| The design system's React package does not server-render | Prerender resume text as plain HTML; design-system parts render client-side |
| The chat states a wrong fact | Knowledge file only, citations, trick-question evals in CI |
| Abuse runs up the API bill | Rate limit per visitor and a hard spend cap at the provider |
