@AGENTS.md

## Claude Code

The imported AGENTS.md is shared with every coding agent. Repo skills live in `.agents/skills/`; `.claude/skills/` links to the same folders.

| Phase | Claude command |
| --- | --- |
| Specification | /brain:spec |
| Planning | /brain:plan |
| Implementation | /brain:build, or /brain:build auto within an approved plan |
| Diagnosis and verification | /brain:test |
| Review | /brain:review |
| Shipping | /brain:ship |

User-started commands: /brain:setup-brain, /brain:wait-what, /brain:handoff, /brain:triage and /brain:wayfinder.
