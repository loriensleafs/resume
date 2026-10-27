# Workflow records

Brain owns the workflow. This table adapts its records to this repository; each fact has one owner.

| Record | Owner |
| --- | --- |
| Current phase, next action, pending approvals | [docs/STATUS.md](../STATUS.md) |
| Capability map and module specs | [spec/](../../spec/README.md) |
| Approved current plan and task list | [tasks/plan.md](../../tasks/plan.md) and [tasks/todo.md](../../tasks/todo.md) |
| Completed plans and task snapshots | tasks/done/ |
| Intent and interview answers | [docs/design/](../design/) |
| Approved mockups, as images | [docs/design/mockups/](../design/mockups/README.md); prototype sources on a `prototype/<name>` branch, never on `main` |
| Selected decisions and their reasons | [docs/decisions/](../decisions/README.md), `NNNN-slug.md` |
| Research and its index | [docs/research/](../research/README.md), `NN-slug.md` |
| Open issues and wayfinder records | [.scratch/](issue-tracker.md) |
| Glossary | [CONTEXT.md](../../CONTEXT.md) |

When a skill names an intent or interview output, write it under `docs/design/`. Research updates its existing subject note; a new subject gets the next number and an index entry.

A later decision can supersede an earlier one. Keep the earlier record, its date and its reasons, and link the new record from it.

A new request does not overwrite an incomplete plan. Record the interruption in STATUS and keep the plan.
