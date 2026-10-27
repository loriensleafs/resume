# Conductor notes for `/brain:build auto`

The working method and the carry-forward notes of the conductor session that ran `/brain:build auto` on 2026-10-27 (decision record rows 149 to 159). A new conductor reads this file with [STATUS](../../docs/STATUS.md). The decisions themselves live in the [decision record](../../docs/design/interview-2026-10-26.md) and in [build decisions](../../docs/design/build-decisions.md); this file only says how to run the next lanes and what each later task must remember.

## How the run works

1. **Lanes (row 150).** Up to 3 tasks build at once, each in its own git worktree (the Agent tool's `isolation: "worktree"`), when their blockers are done and their files do not overlap. A worktree starts from GitHub's `main`, so the brief tells the builder to run `git merge --ff-only main` first. A worktree's `node_modules` is a symbolic link to the main checkout's folder: the builder runs `unlink node_modules` and `bun install` before anything else, so no install writes into the main checkout. The builder copies `private.yaml` in and never stages it.
2. **Builder brief.** The plain-talk block at the top; the task's body; the spec to read in full; the skills to load (the brain skills, the library skills through `bun run intent load`, the design-system skills and one real `resolve_version` call for UI work); Peter's standing rule ("the best option, not the easiest or the fastest, even when it means more work"); stage by name; never edit `tasks/todo.md` or `docs/STATUS.md`; one commit ending with the attribution line; no push (except a spike task, which pushes its prototype branch under row 151 after both release checks); questions come back in the report.
3. **Review (row 149).** After each task, five reviewers run in parallel on a different model from the builders (Sonnet), one per axis, each with [review-brief.md](review-brief.md) and its axis file in [axes/](axes/). Each writes its report to a file. Spike tasks (throwaway code) get three axes: correctness, security, architecture.
4. **Fixes.** The conductor merges the five reports into one decision table, decides every finding that is not Peter's (the best option, recorded in [build decisions](../../docs/design/build-decisions.md) when worth his look), and sends the list to the same builder through SendMessage. A builder whose run the harness stops twice is replaced by a fresh agent with the state and the remaining steps.
5. **Merge.** `git merge --no-ff` with a message that says what the review changed; then `bun install` if packages changed, `bun run build` and `bun test` on `main`. Security code that guards pushes gets one extra security check after its fixes.
6. **Stops (rows 152 and 154).** The run stops for Peter only for a set-up item only he can do (a key, a secret, an account, a paid service, a check in his own browser), source work (task 13's interviews, any change to an approved source such as K11 to K13), a critical review finding that needs his decision, and the approvals row 151 keeps (force-push, visibility, a deploy by hand, money such as an eval run, a new dependency, an approved source, `scripts/docs-only.txt`). Checkpoint reviews do not stop the run. Wordings are drafted per task (row 153).
7. **Never** write a value from `private.yaml` anywhere; a reviewer once quoted it from a failing test's output, and the brief now forbids it.
8. **Drain and restart.** When the conductor's context grows large, it starts no new task, merges the lanes in flight, rewrites STATUS, pushes, and Peter runs `/clear` and `/brain:build auto`.

## Carry-forward notes for later tasks

Notes the reviews of finished tasks left for tasks not yet built. Each builder brief for these tasks names its line.

- **A9 (done, `ab4d2bb`):** every later builder runs `bun run typecheck` before its commit. A lane that started before a type-check change merges `main` and runs it before its review ends.
- **D6 and D8:** A9's scoped `zod` override makes Bun write `bun.lock` as `lockfileVersion` 3. Bun's docs say 1.4.0 and later read it; Vercel's build Bun reading it is unverified. D1 found that Vercel picks Bun 1.4 when `bunVersion` is `"1.4.x"` or the lockfile is version 2, so check which rule holds with version 3.
- **S3:** `buildSite({ root })` ignores `root` since S2. S3 passes `root` into the build (a plugin option or a value `vite.config.ts` reads), and makes seam 1's leak test fail first, so the fake phone number really reaches the build.
- **S6:** TanStack Start writes a public `pages.json` beside `sitemap.xml`; it lists filtered pages too. S6 decides whether it stays.
- **S16:** the first page with a `/?source=` link. Its build test proves S2's `?` filter: no `index.html` overwrite, and no sitemap address with `?`.
- **S26:** the first binary files in the output. Seam 1's private-detail scan reads files as text; make it read bytes then.
- **The TanStack issue (S2, for Peter):** TanStack Start's prerender starts its preview server without the build's root (`vite/prerender.js` in `@tanstack/start-plugin-core`); S2 fixed it locally with `root` in `vite.config.ts`. Filing an issue upstream is outward-facing, so Peter decides; ask at the next stop.
- **C3:** replace C2's direct tests of the in-memory budget and telemetry in `handle-chat.test.ts` with handler-level tests (a refusing budget gives one `RUN_ERROR`; one `chat_turn` per turn), then delete the direct ones. Guard `errorCode` so it never holds a message or a stack.
- **C14:** the in-memory telemetry keeps each reservation with its event, so seam 1 checks that `record()` gets the turn's reservation.
- **C17:** `createOps()` is built once at module scope; the review checks it (no third seam).
- **C18, C23, S30:** the first-load JavaScript on `/` is already 107.6 KB gzip before any view (54% of the 200 KB budget; S1's review). The chat's browser code (about 63 to 67 KB gzip) loads on demand.
- **S2:** `buildSite()` sets the output folder through Vite's build API; it makes `vite.config.ts` a factory only if Nitro's output cannot move. Add a gzip size guard for `/` to the site's build test.
- **S5:** the static `404.html` is rendered outside the route tree, so it carries no scripts (`shellComponent` always renders `<Scripts />`).
- **K4:** keep `SECTIONS` (`parseSource()` uses it); remove `parseDeepDive`, `DeepDive`, `Section` and `OPTIONAL`. `ids.test.ts` holds `deep:fednow-architecture` on purpose (a rejection case), so K4's search for `deep:` finds it.
- **K5:** extract one `checkSource()` that returns every problem, for K10 to reuse; K5 already checks that each role id names a role in `resume.yaml`.
- **K9:** `PublicKnowledge` goes in `src/knowledge/types.ts`, not `build.ts`.
- **D3:** ends with Peter's PDF check in Chrome on the protected spike address (a stop, row 152).
- **D4:** check 6 runs the cron on the deployment and so proves the cron exists (D2 left it unverified, by a conductor decision); test the "after the file system" form of the `/__server` route.
- **D5:** each spike run sends about 7 `/api/` requests, which count toward the live WAF limit.
- **D6 (each spec change needs Peter's approval when it changes approved behavior):** a route before the file system that sends any `.func` folder to `404.html` (`/__server` reached the function directly otherwise); the function runtime string `"bun1.4.x"` (it gives Bun 1.4.1; `"bun1.x"` gives 1.3.14); Vercel builds with Bun 1.4 when `bunVersion` is `"1.4.x"` or the lockfile is version 2; overrides are not needed for `<path>/index.html` (D2's review recommends dropping them); `caseSensitive: true` stays; `writeVercelConfig()` follows Nitro's symlinked per-route `.func` folders (seen locally, unverified on Vercel).
- **D10:** clamp `list(days)` to the 90-day retention; the store leaves out entries dated after today (the contract suite checks it); the order of two entries on the same day is not fixed.
- **D10 to D12:** each replaces its part of the production interim (in-memory parts that allow every turn).
- **D17:** turns the spike's `post-build.ts` into `writeVercelConfig(outputDir)` and drops the spike-only routes.
- **D30:** SPEC-deploy counts shared test helpers (such as `src/__tests__/helpers/document-text.ts`, from T3) as site files, because only `**/__tests__/**/*.test.ts` is docs-only. Adding `**/__tests__/helpers/**` to the docs-only list changes `scripts/docs-only.txt`, so it needs Peter's approval (row 151).
- **D32:** a push and a pull request both run `ci` on the same commit; the release check takes the newest run of the push event.
- **Content follow-up (not yet a task):** `src/content.ts` rejects only a `phone` field; a phone-like number typed into a highlight passes. The fix belongs in the schema, through `findPhoneNumbers()` from `src/private-details.ts`.
- **Glossary gap:** "source file" (a draft or an approved file) appears in SPEC-knowledge and the code, but `CONTEXT.md` defines a source as approved only.
- **Mockups:** the Playwright test removed the Chromium build that Playwright 1.63.0 uses from Peter's Mac; the next render needs the mockups branch README's one-time install.
