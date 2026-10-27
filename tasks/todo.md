# Tasks

Current phase: 3 (knowledge and site). Each task ends with its verification.

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
- [ ] 7. Interview Peter and approve the nine deep dives, one at a time (4 of 9 approved: highspot-mcp-server, highspot-agent-workflow, highspot-ai-standards, highspot-streaming-markdown)
  - Acceptance: each file in `knowledge/deep-dives/` has `status: approved` with Peter's date, and every statement traces to his answers.
  - Verify: `bun run knowledge` lists `deep:<id>` for all nine; `bun test`
- [ ] 8. Interview Peter and approve the four logistics answers
  - Verify: `bun run knowledge` lists the four `logistics:` entries
- [ ] 9. Write SPEC-site.md for Peter's review
