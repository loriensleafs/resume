# Plan

Follows the [capability map](../spec/README.md). Each module gets its spec approved before its tasks start. Checkpoints end each phase with a full build, the tests and Peter's review.

## Phase 1: content (spec approved)

Built: the resume source, the build, and the PDF, Word and text documents. Remaining: the tests at the two approved seams, `build()` and the renderer unit tests. The tests need Chrome and poppler.

Checkpoint A: `bun run build` and `bun test` pass. The private PDF is pixel-identical to the PDF built from the hand-written `resume.html`. Peter approves the history rewrite, and the work is pushed.

## Phase 2: agents (alongside every phase)

`AGENTS.md`, `CLAUDE.md`, the `edit-resume` skill and the README describe the repository as it is. Each later module updates them when it lands.

## Phase 3: knowledge and site

- knowledge, first version: built and approved on 2026-10-26 (nine deep dives, four logistics answers).
- knowledge, two layers ([SPEC-knowledge](../spec/SPEC-knowledge.md), approved 2026-10-27): move the nine deep dives to sources with catalog summaries; the source parser, the core with its catalog, and `readPassages()`; then the long-form interviews, one subject at a time (career, working style, stories, opinions, side projects, skills).
- mockups: update the "Merged" page for decisions 0015 to 0019 (source view, the visible source read, passage citations, Start over, a restored session, the install offer, the standalone app, app icon options), for Peter's review before SPEC-site.
- site: SPEC-site.md after the mockup review. TanStack Start app on Bun, the chat beside the resume, sources on demand, saved sessions, install as a standalone app, design-system theme, PWA offline cache, document downloads.

The knowledge build and the mockups can run in parallel. The interviews can start once the source format is built.

## Phase 4: chat (spec to write)

TanStack AI server route, chat UI with design-system parts, citations, refusals, TanStack DB history and the offline queue, and the trick-question eval suite.

## Phase 5: deploy (spec to write)

Vercel Pro with the Bun runtime ([0012](../docs/decisions/0012-vercel-pro-host.md)); WAF rate limit per IP; Anthropic workspace spend limit; the free first-year domain; CI that builds the public variant and runs the evals. The repository is already public.

## Specs still to write

In build order: SPEC-site (approved 2026-10-27), SPEC-chat (approved 2026-10-27), SPEC-deploy, and SPEC-agents (the agent files already exist; the spec records their rules). Peter decided on 2026-10-27 to write and approve all four before any more building: the chat and deploy specs can change how the knowledge module is read and built. Once all four are approved, this plan is rewritten for every module, and building resumes with task 11.

## Risks

| Risk | Mitigation |
|---|---|
| The design system renames parts during its systematization pass | Pin exact versions; upgrade deliberately |
| The design system's React package does not server-render | Prerender resume text as plain HTML; design-system parts render client-side |
| The chat states a wrong fact | Knowledge base only, passage citations, trick-question evals in CI |
| Abuse runs up the API bill | Rate limit per visitor and a hard spend cap at the provider |
