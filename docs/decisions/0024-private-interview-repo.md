# Raw interview answers live in a private GitHub repo, never in this public one

Peter's answers in the knowledge interviews are saved word for word before any source is written from them ([SPEC-knowledge](../../spec/SPEC-knowledge.md)). These raw answers can hold colleague names or internal links, and this repository is public ([decision 0006](0006-public-repo-private-details.md)). The workflow guide sent interview answers to the public `docs/design/`. Later sessions must still read the raw answers to write a source or to check one.

Decided 2026-10-27 by Peter ([interview record](../design/interview-2026-10-26.md), row 129).

- Peter creates a private GitHub repo for the raw answers. Its default name is `loriensleafs/resume-private`, and the answers go in its folder `interviews/`.
- Each answer is saved there word for word before anything is written from it.
- A later session attaches the private repo to read the answers. The raw answers never enter this repository.
- Only Peter's decisions stay in the public decision record under `docs/design/` ([workflow records](../agents/workflow.md)).

Considered:

- An untracked folder in this repository: it stays off GitHub, but it exists on one machine only, so a session on a fresh clone cannot read it. One wrong commit would publish it on the next push.
- A Google Drive folder: private, but outside git, so sessions would read and write it through a separate connector, not as a repository.
- The per-chat claude-sessions branch: private, but each branch belongs to one conversation, and a session works only on its own conversation's branch.

Evidence: the review of SPEC-knowledge on 2026-10-27 found that the [workflow records](../agents/workflow.md) sent interview answers to the public `docs/design/`; [decision 0006](0006-public-repo-private-details.md) keeps private material out of git.
