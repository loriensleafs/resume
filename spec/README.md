# Capability map

The resume project has six modules. Each module has one spec in this folder, named by its id. This map is the index of what exists; a module id never changes.

| Module id | Responsibility | Depends on | Spec |
|---|---|---|---|
| content | `resume.yaml`, and the PDF, Word and text files built from it | none | [SPEC-content.md](SPEC-content.md) |
| knowledge | The chat's approved knowledge base: the core (resume, logistics answers, catalog) and the sources (deep dives, interviews), with an id for every entry and passage | content | [SPEC-knowledge.md](SPEC-knowledge.md) |
| site | The TanStack Start PWA: the chat beside the resume, sources opened on demand, saved sessions, install, offline cache, downloads | content, knowledge | [SPEC-site.md](SPEC-site.md) |
| chat | The `/api/chat` route, chat UI, history in TanStack DB, offline queue, guardrails, evals | knowledge, site | SPEC-chat.md |
| deploy | Hosting, rate limit, spend cap, domain, CI | site, chat | SPEC-deploy.md |
| agents | `AGENTS.md`, `CLAUDE.md` and the repo skills | all; updated as each module lands | SPEC-agents.md |

Build order: content → knowledge and site → chat → deploy. The agents module is written first and updated as each module lands.

Approved by Peter on 2026-10-26. The knowledge and site rows were reworded on 2026-10-27 to follow decisions 0015 to 0019; the modules and the build order are unchanged.
