# Workflow records

Brain owns the workflow. This table adapts its records to this repository; each fact has one owner.

| Record | Owner |
| --- | --- |
| Current phase, next action, pending approvals | [docs/STATUS.md](../STATUS.md) |
| Capability map and module specs | [spec/](../../spec/README.md) |
| Approved current plan and task list | [tasks/plan.md](../../tasks/plan.md) and [tasks/todo.md](../../tasks/todo.md) |
| Completed plans and task snapshots | tasks/done/ |
| Wording drafts that wait for Peter's one review before D37 (row 153) | [docs/design/wording-drafts.md](../design/wording-drafts.md), the index; each task's own file in `docs/design/wording-drafts/` |
| Review findings the conductor decided, for Peter's review at the end of the run (row 154) | [docs/design/build-decisions.md](../design/build-decisions.md); STATUS points there |
| Intent and Peter's decisions (the decision record) | [docs/design/](../design/). Raw knowledge-interview answers never go here: they live in the private repo `loriensleafs/resume-private`, folder `interviews/` ([decision 0024](../decisions/0024-private-interview-repo.md)) |
| Approved mockups, as images | [docs/design/mockups/](../design/mockups/README.md); prototype sources on a `prototype/<name>` branch, never on `main` |
| Selected decisions and their reasons | [docs/decisions/](../decisions/README.md), `NNNN-slug.md` |
| Research and its index | [docs/research/](../research/README.md), `NN-slug.md` |
| Open issues and wayfinder records | [.scratch/](issue-tracker.md) |
| Glossary | [CONTEXT.md](../../CONTEXT.md) |

When a skill names an intent or an interview's decisions, write them under `docs/design/`. A knowledge interview's raw answers go to the private repo (the row above). Research updates its existing subject note; a new subject gets the next number and an index entry.

A later decision can supersede an earlier one. Keep the earlier record, its date and its reasons, and link the new record from it.

A new request does not overwrite an incomplete plan. Record the interruption in STATUS and keep the plan.
