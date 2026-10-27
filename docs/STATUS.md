# Status

Updated 2026-10-26. This file is the one current handoff. A fresh session resumes from here without the conversation.

## Where we are

- **Phase:** content module complete (Checkpoint A). Next phase: the knowledge and site specs.
- **Done:** `resume.yaml` and `private.yaml` replace the hand-written `resume.html`. `bun run build` makes the public and private PDF, Word and text files. The private PDF is pixel-identical to the PDF built from the hand-written `resume.html`, and the public PDF differs only on the contact line. `bun test` passes 26 tests at the two approved seams. Brain's setup ran (local issue tracker). Agent files, decision records, research notes, the glossary and the interview record are written. History was rewritten on 2026-10-26 so that no commit holds a private detail.
- **Next:** write [SPEC-knowledge.md](../spec/README.md) and SPEC-site.md for Peter's review (task 5 in [tasks/todo.md](../tasks/todo.md)).

## Waiting on Peter

- Vercel Pro sign-up and an Anthropic API key with a workspace spend limit, when the deploy module starts ([0012](decisions/0012-vercel-pro-host.md), [0013](decisions/0013-claude-sonnet-model.md)). Peter signs up and pays; agents never do.
- Logistics answers and deep-dive interviews, during the knowledge module.

## Working state

- Repository: github.com/loriensleafs/resume, public since 2026-10-26, branch `main`.
- Peter's local clone: `git clone https://github.com/loriensleafs/resume ~/Dev/resume`, then create `private.yaml` there (see README).
- Nothing red. CI does not exist yet; it arrives with the deploy module.
