# Status

Updated 2026-10-26. This file is the one current handoff. A fresh session resumes from here without the conversation.

## Where we are

- **Phase:** content module complete (Checkpoint A). Next phase: the knowledge and site specs.
- **Done:** `resume.yaml` and `private.yaml` replace the hand-written `resume.html`. `bun run build` makes the public and private PDF, Word and text files. The private PDF is pixel-identical to the PDF built from the hand-written `resume.html`, and the public PDF differs only on the contact line. `bun test` passes 26 tests at the two approved seams. Brain's setup ran (local issue tracker). Agent files, decision records, research notes, the glossary and the interview record are written. History was rewritten on 2026-10-26 so that no commit holds a private detail.
- **Next:** write [SPEC-knowledge.md](../spec/README.md) and SPEC-site.md for Peter's review (task 5 in [tasks/todo.md](../tasks/todo.md)).

## Waiting on Peter

- When to make the repository public ([decision 0006](decisions/0006-public-repo-private-details.md)).
- Hosting and model choice, after the hosting research note lands as `docs/research/07-…`.
- Logistics answers and deep-dive interviews, during the knowledge module.

## Working state

- Repository: github.com/loriensleafs/resume, private, branch `main`.
- Peter's local clone: `git clone https://github.com/loriensleafs/resume ~/Dev/resume`, then create `private.yaml` there (see README).
- Nothing red. CI does not exist yet; it arrives with the deploy module.
