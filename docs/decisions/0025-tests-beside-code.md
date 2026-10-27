# Tests live in `__tests__/` beside the code they test

Peter's standing rule for his TypeScript projects puts each test in a `__tests__/` folder beside the file it tests, named `<file>.test.ts` and run by `bun:test`. Unit tests stay out of a top-level test folder. The specs had put every test in a top-level `tests/<module>/` folder instead. The rule lives in Peter's own Claude Code instructions, which other coding agents do not read, so this repository states it.

Decided 2026-10-27 by Peter ([decision record](../design/interview-2026-10-26.md), row 144), for the whole repository.

- A test file sits in a `__tests__/` folder beside the file it tests, and takes that file's name: `src/knowledge/build.ts` is tested by `src/knowledge/__tests__/build.test.ts`.
- A test that checks several files of one module, such as the renderers or the browser test, sits in the `__tests__/` folder of the folder that holds them. Its name says what it checks: `src/__tests__/render.test.ts`, `src/site/__tests__/browser.test.ts`.
- Test helpers (fixtures, fakes, a contract suite) sit in the `__tests__/` folder of the tests that use them. Snapshots stay in Bun's `__snapshots__/` folder beside their test.
- The agent files' test sits at the root, beside `AGENTS.md`: `__tests__/agent-files.test.ts`.
- A module's test command names its folders, such as `bun test src/knowledge`. Bun runs each test file whose path contains a filter.
- The docs-only list ([SPEC-deploy](../../spec/SPEC-deploy.md)) names `**/__tests__/**/*.test.ts` in place of `tests/**/*.test.ts`.

The paths, old to new. The first seven files existed and moved with `git mv`; the specs named the rest before they were written.

| Old | New |
| --- | --- |
| `tests/content/build.test.ts` and its snapshot | `src/__tests__/build.test.ts` and its snapshot |
| `tests/content/render.test.ts` | `src/__tests__/render.test.ts` |
| `tests/knowledge/build.test.ts` and its snapshot | `src/knowledge/__tests__/build.test.ts` and its snapshot |
| `tests/knowledge/parse.test.ts` | `src/knowledge/__tests__/parse.test.ts` |
| `tests/knowledge/fixtures.ts` | `src/knowledge/__tests__/fixtures.ts` |
| `tests/knowledge/read.test.ts` | `src/knowledge/__tests__/read.test.ts` |
| `tests/content/documents.test.ts` | `scripts/__tests__/documents.test.ts` |
| `tests/site/build.test.ts`, `browser.test.ts`, `fixture-root.ts` | `src/site/__tests__/` with the same names |
| `tests/site/config.test.ts` | `src/deploy/__tests__/config.test.ts` |
| `tests/site/docs-only.test.ts` | `scripts/__tests__/docs-only.test.ts` |
| `tests/site/smoke.test.ts` | `scripts/__tests__/smoke.test.ts` |
| `tests/chat/handler.test.ts` | `src/chat/server/__tests__/handle-chat.test.ts` |
| `tests/chat/fixtures.ts`, `stub-anthropic.ts`, `question-log-contract.ts` | `src/chat/server/__tests__/` with the same names |
| `tests/ops/ops.test.ts`, `fake-upstash.ts`, `fake-ntfy.ts` | `src/ops/__tests__/` with the same names |
| `tests/agents/agent-files.test.ts` | `__tests__/agent-files.test.ts` |

Considered:

- Keep `tests/<module>/`, the specs' choice (rows 141 and 142). Peter called it the wrong convention.
- `__tests__/` for new tests only: two layouts side by side until each module changes its old tests.
- `__tests__/` for the agent files' test only: two layouts stay in the repository.

Evidence: Peter's correction during task A1 on 2026-10-27. With Bun 1.4.4, `bun test` ran the same 43 tests in 4 files and matched both snapshots before and after the move. `bun test src/__tests__` runs only the content tests, and `bun test src/knowledge` only the knowledge tests.
