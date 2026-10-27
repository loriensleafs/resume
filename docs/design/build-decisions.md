# Build decisions

The decisions the conductor made during the build, which Peter goes over with the conductor at the end of the run ([decision record](interview-2026-10-26.md) row 154). A critical finding that needs Peter's decision never waits for this list: the run stops for it.

| Date | Task | Finding (source) | Decision | Reason |
|---|---|---|---|---|
| 2026-10-27 | C2 | The tests of the in-memory budget and telemetry sit in `handle-chat.test.ts`, not in a file named after `question-log.ts` (architecture review, tagged hard; [decision 0025](../decisions/0025-tests-beside-code.md)) | Kept in the seam-1 file; C3's handler tests replace them | Row 83 allows seam 1 only for the chat; a new test file is a new seam |
| 2026-10-27 | C2 | SPEC-deploy says the ops module "imports only the chat module's types", but D9's `createOps()` needs the chat's in-memory log, budget and telemetry outside production (architecture review) | D9 lets ops import the chat's in-memory parts and amends SPEC-deploy's two lines | One copy of the day-window logic; the import runs in the allowed direction, from deploy to chat |
| 2026-10-27 | C2 | `list(days)` has no upper bound, and a real store could return the whole log (performance review) | D10 clamps `days` to the 90-day retention | The bound belongs to the store; the chat's contract stays as the spec writes it |
| 2026-10-27 | All tasks | The reviewers run on a different model (Sonnet) from the builders (Opus) (process) | Kept | brain's review skill advises another model, because different models miss different things |
