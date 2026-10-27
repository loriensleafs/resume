# Tasks

Current phase: 3 (knowledge and site). Each task ends with its verification.

Order (Peter, 2026-10-27): write and approve every remaining spec first (tasks 9 and 14), then rewrite the plan for all of them. Task 11 waits for that plan. Task 13, the interviews, is content and can run at any time.

- [x] 1. Move content to `resume.yaml`; build public and private PDF, Word and text
  - Acceptance: the private PDF is pixel-identical to the PDF built from the hand-written `resume.html`; the public files have no phone number.
  - Verify: `bun run build`; `compare -metric AE` on 100 dpi renders; `grep` for the phone in `dist/public/`.
  - Files: `resume.yaml`, `src/content.ts`, `src/print/*`, `src/export/*`, `scripts/build.ts`
- [x] 2. Tests at the approved seams
  - Acceptance: every check in SPEC-content.md "Testing Strategy" is a passing test.
  - Verify: `bun test tests/content`
  - Files: `src/build.ts`, `tests/content/build.test.ts`, `tests/content/render.test.ts`
- [x] 3. Agent support: `AGENTS.md`, `CLAUDE.md`, `.agents/skills/edit-resume`, `.claude/skills` symlink, README
  - Acceptance: a fresh agent can resume from AGENTS.md and STATUS alone; Claude Code and `.agents/skills` agents both see the skill.
  - Verify: read-through; `ls -l .claude/skills`; skill frontmatter has `name` and `description`
  - Files: `AGENTS.md`, `CLAUDE.md`, `.agents/skills/edit-resume/SKILL.md`, `.claude/skills/edit-resume`, `README.md`
- [x] 4. Checkpoint A: rewrite the first commit without the phone number and push (needs Peter's approval)
  - Acceptance: no commit on `main` contains the phone number.
  - Verify: `git log -p --all | grep -c -F "$(bun -e 'console.log(Bun.YAML.parse(await Bun.file("private.yaml").text()).basics.phone)')"` prints 0
- [x] 5. Write SPEC-knowledge.md for Peter's review (approved 2026-10-26)
- [x] 6. Knowledge format: parser, `buildKnowledge()`, renderer with `[id]` markers, `bun run knowledge`
  - Acceptance: every check in SPEC-knowledge.md "Testing Strategy" is a passing test.
  - Verify: `bun test tests/knowledge`
  - Files: `src/knowledge/*`, `scripts/knowledge.ts`, `knowledge/*`, `tests/knowledge/*`
- [x] 7. Interview Peter and approve the nine deep dives, one at a time (all nine approved 2026-10-26; two follow-ups in .scratch/knowledge/issues/)
  - Acceptance: each file in `knowledge/deep-dives/` has `status: approved` with Peter's date, and every statement traces to his answers.
  - Verify: `bun run knowledge` lists `deep:<id>` for all nine; `bun test`
- [x] 8. Interview Peter and approve the four logistics answers (all four approved 2026-10-26)
  - Verify: `bun run knowledge` lists the four `logistics:` entries
- [x] 9. Write SPEC-site.md for Peter's review, from the approved mockups in `docs/design/mockups/` (approved 2026-10-27)
- [x] 10. Update SPEC-knowledge.md for the two layers (approved 2026-10-27)
- [ ] 11. Move the nine deep dives to `knowledge/sources/` with `kind`, `subject` and a one-line summary; build the source parser, the core with its catalog, and `readPassages()` (waits until every spec is approved and the plan is rewritten)
  - Acceptance: every check in SPEC-knowledge.md "Testing Strategy" is a passing test; Peter approves the nine summaries.
  - Verify: `bun test tests/knowledge`; `bun run knowledge` shows nine catalog entries and a core under 80,000 characters
  - Files: `knowledge/sources/*`, `src/knowledge/*`, `scripts/knowledge.ts`, `tests/knowledge/*`, `knowledge/README.md`
- [x] 12. Update the mockups for decisions 0015 to 0019, for Peter's review (Peter, 2026-10-27: "I think this all looks pretty good")
  - Acceptance: the "Merged" page shows the source view instead of the deep-dive tab, the visible source read and passage citations, New chat with its confirmation, a restored session, the install offer, the installed standalone app, and the chosen app icon. Images of every board are in `docs/design/mockups/`; the board sources are on the branch `prototype/site-mockups`.
  - Verify: Peter's review of the canvas
- [ ] 13. Long-form interviews, one subject at a time: career, working style, stories, opinions, side projects, skills
  - Acceptance: each subject has at least one approved interview source; every raw answer is saved privately first.
  - Verify: `bun run knowledge` lists the sources; `bun test`
- [ ] 14. Write SPEC-chat.md (with the Agent Design plugin), then SPEC-deploy.md and SPEC-agents.md, each for Peter's review
