# Capability map

The resume project has six modules. Each module has one spec in this folder, named by its id. This map is the index of what exists; a module id never changes.

| Module id | Responsibility | Depends on | Spec |
|---|---|---|---|
| content | `resume.yaml`, and the PDF, Word and text files built from it | none | [SPEC-content.md](SPEC-content.md) |
| knowledge | The chat's approved knowledge file: resume, deep dives and logistics answers, one id per entry | content | [SPEC-knowledge.md](SPEC-knowledge.md) |
| site | The TanStack Start PWA: prerendered resume and deep-dive pages, offline cache, downloads | content, knowledge | SPEC-site.md |
| chat | The `/api/chat` route, chat UI, history in TanStack DB, offline queue, guardrails, evals | knowledge, site | SPEC-chat.md |
| deploy | Hosting, rate limit, spend cap, domain, CI | site, chat | SPEC-deploy.md |
| agents | `AGENTS.md`, `CLAUDE.md` and the repo skills | all; updated as each module lands | SPEC-agents.md |

Build order: content → knowledge and site → chat → deploy. The agents module is written first and updated as each module lands.

Approved by Peter on 2026-10-26.
