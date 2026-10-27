# Deploy tasks

Spec: [SPEC-deploy](../../spec/SPEC-deploy.md). The order is in [todo.md](../todo.md); read these notes and your task's body only.

## Notes

- **Seams** are the three the spec confirms (row 117): seam 1, the site build output and the docs-only scripts (`src/deploy/__tests__/config.test.ts`, `scripts/__tests__/docs-only.test.ts`); seam 2, the ops module (`src/ops/__tests__/ops.test.ts`); seam 3, the smoke check against the preview (`scripts/__tests__/smoke.test.ts`). The real platform has no local seam; the spike, the release check, the health checks and setup step 13 check it (Testing Strategy, last line).
- **Unit checks only for the build steps.** Deploy's `src/deploy/__tests__/config.test.ts` checks `addPolicyTags()` and `writeVercelConfig()` at unit level; the built-output checks (each page's policy tag, no `style=` attribute) live once, in the site's build test (main's decision, 2026-10-27).
- **The spike** (D1 to D6) is first, because its 12 checks settle rules that later tasks build on. Its branch `prototype/deploy-spike` starts from `prototype/csp-probe` and copies its site spike (`prototypes/csp-probe/`, TanStack Start with Nitro's Vercel preset) and `prototypes/nitro-vercel-output/` into `prototypes/deploy-spike/`. Spike code never reaches `main` (brain's prototype rules); its verdicts go into `prototypes/deploy-spike/README.md` on the branch, then D6 copies them to research 12 and the spec. The checks reach the protected deployment through a push-triggered workflow on the spike branch that holds the bypass secret as an Actions secret and prints verdicts only. Check 12 needs a workflow on `main`, so it runs at D32 and setup step 10.
- **Composition roots.** `scripts/build-site.ts` is deploy's file, but the module that provides a step wires it in: S28 adds the `writeServiceWorker()` call as step 4, and the chat's Vite plugin goes into `vite.config.ts` (C16). `--root` on the build script is the main session's addition to SPEC-deploy, from the site's edges.

## Tasks

### D1: Deploy spike, part 1: the throwaway project builds the spike branch

Delivers: A push to `prototype/deploy-spike` builds on Peter's throwaway Vercel project, and a spike workflow runs `check.ts` against that deployment and prints one verdict line per check, starting with check 1.
Blocked by: Peter: a Vercel Pro team (setup step 4's sign-up, $20 a month, comes before the spike, so the cost starts here); Peter: the throwaway project from `prototype/deploy-spike` with no domains and no Anthropic key (SPEC-deploy "Deploy spike", Setup), its root folder `prototypes/deploy-spike/`, Standard Protection with an automation bypass secret, and that secret as an Actions secret (agents never read it; the spike workflow uses it and prints verdicts only)
Setup done (2026-10-27, Peter with the main session):
- Vercel team Peter Kloss (`vercel.com/peterkloss`), Pro. Project `resume-deploy-spike`; its address stays `project-8ar0o.vercel.app` (a rename keeps the first address). Connected to `loriensleafs/resume`; production branch `prototype/deploy-spike`; root folder `prototypes/deploy-spike`; Ignored Build Step "Only build production" (`VERCEL_ENV` is production), so pushes to `main` and other branches build nothing there. Standard Protection with Vercel Authentication. No deployment exists yet: D1's first push makes the first one.
- The branch exists: `prototype/csp-probe` plus one commit (07aed2b) that copies `prototypes/csp-probe/` to `prototypes/deploy-spike/`. D1 adds the parts of `prototypes/nitro-vercel-output/`, `vercel.json`, `check.ts`, the workflow and the README.
- The Actions secret is `VERCEL_AUTOMATION_BYPASS_SECRET`, SPEC-deploy's name; setup step 9 later replaces its value with the real project's secret.
- Vercel's GitHub app reads `loriensleafs/resume` only. Commit Status is on; the project's `deployment_status` and `repository_dispatch` events are off. If the workflow needs `deployment_status`, Peter turns it on in the project's Git settings.
Acceptance:
- A push to `prototype/deploy-spike` builds a deployment on the throwaway project, and `.github/workflows/spike-check.yml` (push trigger, on the spike branch only) waits for that commit's deployment and runs `check.ts` against it, printing verdicts and no secret.
- Check 1 has a verdict in the README: which Bun runs the build (the build writes `bun --version` into a static file), and whether `bunVersion` decides it ("Deploy spike" table, row 1).
Verify: `gh run list --branch prototype/deploy-spike --workflow spike-check.yml`; `gh run view <run id> --log` shows the check 1 line; the README holds the verdict.
Files: `prototypes/deploy-spike/` (copied from `prototypes/csp-probe/`), `prototypes/deploy-spike/vercel.json`, `prototypes/deploy-spike/check.ts`, `.github/workflows/spike-check.yml` (spike branch only), `prototypes/deploy-spike/README.md`
Size: M
Needs Peter: the Pro team and the throwaway project (account, money); the Actions secret. Each push of `prototype/deploy-spike` follows AGENTS.md, "Releases and approvals", with the `release` skill's step 1 (SPEC-deploy, "Approval").

### D2: Deploy spike, part 2: the post-build routes and the function runtime

Delivers: The throwaway deployment serves the spike's own post-build `config.json`, and the README records which Bun runs its functions and how unknown paths are answered.
Blocked by: D1
Acceptance:
- Check 2: Vercel serves the post-build routes, an `overrides` entry gives a prerendered page its clean address, the `crons` entry shows on the project, and the README records `Bun.version` from a function with `runtime: "bun1.4.x"` and from one with `"bun1.x"` plus `bunVersion: "1.4.x"`.
- Check 3: an unknown path, `/API/chat` and `/sources/x` (no file) get `/404.html` with status 404, and no function runs for them.
- Each failed check names the change from the table's "If it fails" column.
Verify: `gh run view <run id> --log` shows the check 2 and 3 lines; the README holds both verdicts.
Files: `prototypes/deploy-spike/post-build.ts`, `prototypes/deploy-spike/vite.config.ts`, `prototypes/deploy-spike/src/site/routes/api.spike.ts`, `prototypes/deploy-spike/check.ts`, `prototypes/deploy-spike/README.md`
Size: M
Needs Peter: no. Each push to `prototype/deploy-spike` follows AGENTS.md, "Releases and approvals".

### D3: Deploy spike, part 3: headers, the redirect, the PDF and the Vercel Toolbar

Delivers: The README records how route headers merge on Vercel, whether a host redirect keeps the query string, and whether the PDF and the toolbar behave with the site's headers.
Blocked by: D2; Peter: Vercel Toolbar off for production on the throwaway project (as setup step 5). Done 2026-10-27 at team level: the team's Production Deployments setting is Off, and both projects inherit it ("Default (controlled at the team level)").
Acceptance:
- Check 4: the worker files get exactly one policy, the PDF gets none, and the headers reach a function response and the not-found page.
- Check 5: a host redirect route on the project's `.vercel.app` address answers 308 and keeps the query string in `Location`, or the README records that the route must add it.
- Checks 10 and 11: Peter sees the PDF in Chrome's PDF viewer with the site's headers; with the toolbar off for production and `x-vercel-skip-toolbar: 1`, Chrome loads a page on the deployment URL with no request to `vercel.live` and no policy violation.
Verify: `gh run view <run id> --log` shows the check 4, 5 and 11 lines; manual: Peter opens the spike's PDF in Chrome (check 10).
Files: `prototypes/deploy-spike/post-build.ts`, `prototypes/deploy-spike/check.ts`, `prototypes/deploy-spike/public/Peter-Kloss-Resume.pdf` (a copy of the public PDF), `prototypes/deploy-spike/README.md`
Size: M
Needs Peter: the toolbar setting; the manual PDF check

### D4: Deploy spike, part 4: Vercel Cron, store writes after Stop, and the Upstash tokens

Delivers: The README records whether Vercel Cron reaches the health route under Standard Protection, whether store writes finish after a visitor stops a streamed turn, and what the Upstash tokens can run.
Blocked by: D2; Peter: a pay-as-you-go Upstash database attached to the throwaway project (cents). Done 2026-10-27: `resume-deploy-spike-kv`, Upstash for Redis, region iad1, Pay As You Go, Auto Upgrade off. Connected to Production only with the prefix `KV`, so the project has `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL` and `KV_REDIS_URL`, all marked sensitive.
Acceptance:
- Check 6: Vercel Cron reaches the spike's `/api/cron/health` under Standard Protection, and the README names the host it calls.
- Check 7: a streamed response that the client stops still finishes its store writes after the last chunk; if not, the README records the fallback, `waitUntil` from `@vercel/functions`, a new package for Peter's approval.
- Check 9: the read-only token runs `LRANGE`, `HGETALL` and `ZRANGE`, and `/multi-exec` runs the reservation's commands with `EXPIREAT`.
Verify: `gh run view <run id> --log` shows the check 6, 7 and 9 lines (booleans and hosts only, no token); the README holds the verdicts.
Files: `prototypes/deploy-spike/src/site/routes/api.cron.health.ts`, `prototypes/deploy-spike/src/site/routes/api.spike.ts`, `prototypes/deploy-spike/post-build.ts`, `prototypes/deploy-spike/check.ts`, `prototypes/deploy-spike/README.md`
Size: M
Needs Peter: the Upstash database (money); approval of `@vercel/functions` only if check 7 fails

### D5: Deploy spike, part 5: the WAF rules and the status helper

Delivers: The README records how the WAF rules match on Vercel, and that check 12 moved to D32.
Blocked by: D2; Peter: the three WAF rules of "Rate limits" on the throwaway project (as setup step 7). Done 2026-10-27, published in this order: "chat content type" (Deny), "chat rate limit" (fixed window, 600 s, 20, key IP address, 429), "api rate limit" (fixed window, 600 s, 60, key IP address, 429; written as two OR groups: path starts with `/api/` and not `/api/chat`, or path starts with `/api/` and method is not POST). The path conditions use Vercel's "Request Path" field, which Vercel describes as the normalized path; "Raw Path" is the other field, so check 8 tells which one handles `/API/chat`.
Acceptance:
- Check 8: a chat `POST` with `Content-Type: text/plain` gets the WAF's 403, chat posts get 429 by the 41st, and the README says whether the path condition matches `/API/chat` regardless of case.
- Check 12 moves to D32 and setup step 10, because it needs a workflow on `main` (`repository_dispatch` runs only workflows on the default branch, research 12); the README records the move (main's decision, 2026-10-27).
Verify: `gh run view <run id> --log` shows the check 8 line; the README holds both verdicts.
Files: `prototypes/deploy-spike/check.ts`, `prototypes/deploy-spike/README.md`
Size: S
Needs Peter: the WAF rules

### D6: Spike verdicts into research 12 and SPEC-deploy

Delivers: Research 12 holds a verdict for each of spike checks 1 to 11, with check 12 marked as moved to D32, and SPEC-deploy matches them (Success Criteria, second bullet).
Blocked by: D3, D4, D5
Acceptance:
- Research 12 has one verdict for each of checks 1 to 11, copied from the spike README; check 12 is marked as run at D32 and setup step 10.
- For each failed check, the table's "If it fails" change is in SPEC-deploy (and in any other spec it touches), and Peter approves the changed spec in a decision record row.
- The spike branch stays unmerged.
Verify: read research 12 against the README; `git diff main -- spec/` shows only the approved changes.
Files: `docs/research/12-deploy-platform.md`, `spec/SPEC-deploy.md`, `docs/design/interview-2026-10-26.md`, `docs/STATUS.md`
Size: S
Needs Peter: approval of each spec change (a route, header, runtime or WAF rule is "ask first"); afterwards he removes the throwaway project and its Upstash database, which D32 waits for

### D7: CI runs the build, the tests and the audits

Delivers: Every push and pull request runs the workflow `ci` with the jobs `test`, `audit` and `audit-all`, and Peter sees their results on GitHub.
Blocked by: none
Acceptance:
- Job `test` on `ubuntu-24.04`: `actions/checkout`, `oven-sh/setup-bun` with `bun-version: 1.4.2`, `poppler-utils`, `bun ci`, `bun run build`, then `bun test` with `CHROME_PATH=/usr/bin/google-chrome`, and it passes (D16 adds `bun run build:site`).
- Job `audit` runs `bun audit --prod --audit-level=high`; job `audit-all` runs `bun audit --audit-level=high` and is not a required check.
- Every helper is pinned to an exact commit, and the workflow grants only the permissions it needs (row 120).
Verify: push the branch; `gh run watch`; `gh run view <run id> --json jobs` shows `test`, `audit` and `audit-all`.
Files: `.github/workflows/ci.yml`
Size: S
Needs Peter: no (`.github/` is in the docs-only list, so the push is not a release; the helpers are approved with the spec)

### D8: Build settings in code, and no `.env` files

Delivers: `vercel.json` holds the build settings the spike settled, `.gitignore` keeps local keys and build output out of git, and a test fails when any `.env*` file exists in the checkout.
Blocked by: D6
Acceptance:
- `vercel.json` holds only the build settings: `bunVersion` `1.4.x`, `framework: null`, `installCommand` `bun ci` (or the 1.4.2 installer if check 1 failed), `buildCommand` `bun run build:site`, `ignoreCommand` `sh scripts/ignore-build.sh`.
- `.gitignore` gains `.secrets/`, `.env*` and `.vercel/`; a test fails when any `.env*` file exists in the checkout.
- Research 12 records whether `bunfig.toml` can turn Bun's automatic `.env` loading off ("Secrets and settings"); if it can, `bunfig.toml` does.
Verify: `bun test src/deploy/__tests__/config.test.ts`; `bun test`
Files: `vercel.json`, `.gitignore`, `bunfig.toml` (only if supported), `src/deploy/__tests__/config.test.ts`, `docs/research/12-deploy-platform.md`
Size: S
Needs Peter: no

### D9: `createOps()` gives in-memory parts outside production

Delivers: The chat's route file can build its `ChatDeps` from `createOps(process.env)`: outside production the log, budget and telemetry are in memory, and `PREVIEW_LIMIT` lets a preview show the "limit reached" state.
Blocked by: C2 (the `QuestionLog`, `QuestionLogEntry`, `Budget`, `Telemetry` and `ChatTurnEvent` types in `src/chat/server/question-log.ts` and `src/chat/server/telemetry.ts`, with the QuestionLog contract suite `src/chat/server/__tests__/question-log-contract.ts`). D9 waits on nothing else, and C17 waits on D9.
Acceptance:
- Outside production, `createOps()` gives an in-memory log, budget and telemetry; SPEC-chat's QuestionLog contract suite passes against the log, and the budget allows every turn.
- With `PREVIEW_LIMIT` `day` or `month` outside production, `budget.reserve()` refuses every turn with `DAILY_LIMIT` or `SPEND_LIMIT`; in production the variable is ignored.
- With `VERCEL_ENV` `preview` and the store variables set, no server is called (Testing Strategy, "Guards").
Verify: `bun test src/ops`
Files: `src/ops/ops.ts`, `src/ops/__tests__/ops.test.ts`, `src/ops/__tests__/fake-upstash.ts`
Size: M
Needs Peter: no

### D10: The question log in Upstash, deleted by the store after 90 days

Delivers: In production, `log.append()` writes each turn's entry to Upstash in one transaction, and the store itself deletes it at the latest 90 days after its day.
Blocked by: D9, D6 (spike check 9)
Acceptance:
- In production, the QuestionLog contract suite passes against the Upstash log on the in-test Upstash server, through the REST API with `fetch` and `Authorization: Bearer` and no package.
- A day's `qlog:<day>` key expires at 00:00 UTC on the 90th day after its day, and each write's commands arrive as one `/multi-exec` transaction.
Verify: `bun test src/ops`
Files: `src/ops/upstash.ts`, `src/ops/ops.ts`, `src/ops/__tests__/fake-upstash.ts`, `src/ops/__tests__/ops.test.ts`
Size: M
Needs Peter: no

### D11: The daily cap holds under parallel requests

Delivers: Each turn reserves $0.90 before its first model call, and the chat stops at $8 of estimated cost a UTC day, also under parallel requests.
Blocked by: D10
Acceptance:
- 25 parallel `reserve()` calls on an empty day: 8 succeed and 17 refuse with `DAILY_LIMIT`; the reservation and the cap live in `src/ops/limits.ts`.
- After the first refusal, the same function instance refuses that day with no store call; the next UTC day allows turns again.
Verify: `bun test src/ops`
Files: `src/ops/limits.ts`, `src/ops/upstash.ts`, `src/ops/ops.ts`, `src/ops/__tests__/ops.test.ts`
Size: M
Needs Peter: no (the values are the approved ones, rows 121 and 131)

### D12: Daily totals and the cost estimate

Delivers: Each turn's `chat_turn` line is printed and added to the daily totals, and its reservation is replaced with its estimated cost or kept, as "Which usage a turn settles with" says.
Blocked by: D11
Acceptance:
- `telemetry.record()` prints the `chat_turn` line and adds the turn to `qstats`, `qslow` and the month; `totals(1)` shows the outcome counts, the five token counts and the longest duration.
- A turn with known token counts, 1-hour writes among them, adds the worked example's cost from `limits.ts`, counted by hand; settling a smaller real cost frees room for another turn; a turn with `null` counts, or whose last model call did not finish (a stopped turn, a `DEADLINE` turn), keeps its whole reservation, and the totals show the finished call's tokens only.
- A rejected turn and a limit refusal write nothing to the store.
Verify: `bun test src/ops`
Files: `src/ops/limits.ts`, `src/ops/upstash.ts`, `src/ops/ops.ts`, `src/ops/__tests__/ops.test.ts`
Size: M
Needs Peter: no

### D13: Limit alerts for the month's spend and the daily cap

Delivers: Peter's phone gets one urgent push when the month's estimate passes 75% of the limit, and one when the daily cap refuses a turn, and a failed push is tried again by a later event.
Blocked by: D12
Acceptance:
- The month's estimate crossing 75% pushes one `spend75` with priority `urgent` and the spec's text, and none again that month; a `DAILY_LIMIT` refusal pushes one `daycap` that day.
- A push first claims `alert:<kind>:<period>` with `SET NX` and a 10-minute expiry; after a failed push a later event pushes again; after a success the marker lasts to the end of its period.
- No push body holds question text.
Verify: `bun test src/ops`
Files: `src/ops/alerts.ts`, `src/ops/ops.ts`, `src/ops/upstash.ts`, `src/ops/__tests__/fake-ntfy.ts`, `src/ops/__tests__/ops.test.ts`, `docs/design/wording-drafts/D13.md`
Size: M
Needs Peter: approval of the `daycap` push text (the spec writes only the `spend75` and `release` texts), in his one review before D37 (row 153). The task finishes on the wording draft in `docs/design/wording-drafts/D13.md`.

### D14: The monthly limit pauses the chat, and one probe an hour

Delivers: After a turn meets Anthropic's monthly limit, the chat refuses at once for an hour, then lets one probe turn through each hour, and works again after Peter raises the limit.
Blocked by: D13
Acceptance:
- After a `SPEND_LIMIT` turn, `reserve()` refuses with `SPEND_LIMIT` for an hour, then lets exactly one probe through (`limit:probe:<hour>` with `SET NX`).
- A probe that reaches the model deletes `limit:spend`; a probe that meets the limit resets its time.
- One `spendlimit` push that day.
Verify: `bun test src/ops`
Files: `src/ops/ops.ts`, `src/ops/upstash.ts`, `src/ops/__tests__/ops.test.ts`, `docs/design/wording-drafts/D14.md`
Size: S
Needs Peter: approval of the `spendlimit` push text, in his one review before D37 (row 153). The task finishes on the wording draft in `docs/design/wording-drafts/D14.md`.

### D15: A failing or slow store never breaks an answer

Delivers: When Upstash fails or hangs, answers go on, an `ops_error` line is printed, and the instance pushes `storefail` once a day.
Blocked by: D13
Acceptance:
- With the Upstash server returning 500: `reserve()` allows the turn, `record()` and `append()` resolve, an `ops_error` line is printed, and the instance pushes `storefail` once that day.
- With the Upstash server holding every response: `reserve()` allows the turn within about 1 s and `record()` resolves within about 2 s; a push stops after 3 s ("Store calls").
Verify: `bun test src/ops`
Files: `src/ops/ops.ts`, `src/ops/upstash.ts`, `src/ops/alerts.ts`, `src/ops/__tests__/fake-upstash.ts`, `src/ops/__tests__/ops.test.ts`, `docs/design/wording-drafts/D15.md`
Size: M
Needs Peter: approval of the `storefail` push text, in his one review before D37 (row 153). The task finishes on the wording draft in `docs/design/wording-drafts/D15.md`.

### D16: The build script writes pages with their policy tags

Delivers: `bun run build:site` builds the site and gives every HTML file its own policy tag, into `.vercel/output/` or into `<folder>/.vercel/output/` with `--out`, from the repo root or from a fixture root with `--root`, so the site's seam-1 tests can run.
Blocked by: S2 (`buildSite({ root, outDir })`). D16 waits on nothing else (main's decision), and S8 waits on D16.
Acceptance:
- `bun run build:site` runs `buildSite()`, then `addPolicyTags(staticDir)`; with `--out <folder>` it writes `<folder>/.vercel/output/` and passes that folder to every step; with `--root <folder>` it passes that root to `buildSite({ root, outDir })` and to every step that reads repo files (`resume.yaml`, `private.yaml`, `knowledge/`, `documents/`). (`--root` is the main session's addition to SPEC-deploy, from the site's edges.)
- On a fixture static folder, `addPolicyTags()` starts each HTML file's `<head>` with a policy tag that lists exactly the SHA-256 hashes of its own inline scripts (`script-src 'self'` alone when it has none). This is a unit check: the built-output checks (each built page's own tag, no `style=` attribute) live once, in the site's build test (S2, S8; main's decision).
- CI's job `test` runs `bun run build:site` after `bun run build`.
Verify: `bun run build:site`; `bun test src/deploy/__tests__/config.test.ts`
Files: `scripts/build-site.ts`, `src/deploy/policy.ts`, `package.json`, `src/deploy/__tests__/config.test.ts`, `.github/workflows/ci.yml`
Size: M
Needs Peter: no

### D17: The routes: redirects, clean addresses, three API routes and the not-found page

Delivers: `writeVercelConfig(outputDir)` replaces Nitro's routes, so only the three API paths run as functions and every other path is a file or the not-found page with status 404.
Blocked by: D16, D6
Acceptance:
- pkloss.dev, pwk.dev and www.peterkloss.dev redirect with 308 to `https://peterkloss.dev/$1` (query per spike check 5); the `.vercel.app` route leaves `/api/` alone (its address is written in D37).
- After `{ "handle": "filesystem" }`, every prerendered page has an override for its clean address; the three API routes are case-sensitive; the last route sends every other path to `/404.html` with status 404, and no route sends a page or `/_serverFn/` to `/__server`.
- Nitro's other fields stay, and `crons` calls `/api/cron/health` at `17 15 * * *`.
Verify: `bun run build:site`; `bun test src/deploy/__tests__/config.test.ts`
Files: `src/deploy/routes.ts`, `scripts/build-site.ts`, `src/deploy/__tests__/config.test.ts`
Size: M
Needs Peter: no (the routes are approved; a later change is "ask first")

### D18: Security and cache headers

Delivers: Every response carries the security headers, each path gets exactly one Content Security Policy header (or none for the documents), and each path gets its cache rule.
Blocked by: D17
Acceptance:
- A route on `/(.*)` with `continue: true` sets `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` and `X-Frame-Options` with the table's values.
- Every path gets the header policy, except `/sw.js` and `/workbox-<hash>.js`, which get the worker policy, and the three documents, which get none; no policy has `'unsafe-inline'` or `'unsafe-eval'`.
- `/assets/*` and the Workbox file are `public, max-age=31536000, immutable`; pages, `/sw.js`, the manifest, `device-index.json`, the documents and the icons revalidate.
Verify: `bun run build:site`; `bun test src/deploy/__tests__/config.test.ts`
Files: `src/deploy/routes.ts`, `src/deploy/__tests__/config.test.ts`
Size: M
Needs Peter: no

### D19: The service worker precaches the tagged pages

Delivers: A check that the build script runs the site's service-worker step after the policy tags, so a page served from the precache keeps its tag. S28 wires the `writeServiceWorker()` call into `scripts/build-site.ts` as step 4 (main's decision); this task checks the order.
Blocked by: S28 (the step-4 call), D17 (`writeVercelConfig()`, the last step)
Acceptance:
- `bun run build:site` runs `buildSite()`, `addPolicyTags()`, `writeServiceWorker()`, `writeVercelConfig()` in that order, and each precached page's revision matches its tagged file.
Verify: `bun run build:site`; `bun test src/deploy/__tests__/config.test.ts`
Files: `src/deploy/__tests__/config.test.ts`, and `scripts/build-site.ts` only when the order is wrong
Size: S
Needs Peter: no

### D20: The functions run on Bun 1.4 with the chat's limits

Delivers: Each function's `.vc-config.json` names the runtime the spike settled, and the chat function stops at 150 s in `iad1`.
Blocked by: D6, D17, S1 (`vite.config.ts` with Nitro's Vercel preset), C17 (the route file `src/site/routes/api.chat.ts`)
Acceptance:
- Every function's `.vc-config.json` has the runtime value from spike check 2.
- The chat function's `.vc-config.json` has `maxDuration: 150` and region `iad1` (Nitro's `vercel.functionRules`).
Verify: `bun run build:site`; `bun test src/deploy/__tests__/config.test.ts`
Files: `vite.config.ts`, `src/deploy/__tests__/config.test.ts`
Size: S
Needs Peter: no

### D21: The smoke check: pages, headers and the chat's request checks

Delivers: `bun run smoke <origin>` checks a running copy of the site without asking the model anything, and names what broke.
Blocked by: D18, S16 (the pages `/`, `/resume`, a source page and `404.html`), S31 (`bun run preview --dir <folder>`, answering the API routes), C17 (the handler's request checks behind `api.chat.ts`: 400 and 403 `ChatError`)
Acceptance:
- Against the preview of the seam-1 build, it passes: `/`, `/resume` and a source page return 200 with HTML, a title and the canonical address; `/sources/does-not-exist` and `/API/chat` return 404 with the not-found page; each page carries every header and its own policy tag; the asset, worker and document headers match "Headers"; a malformed chat `POST` gets 400 and one with `Origin: https://example.com` gets 403 `FORBIDDEN_ORIGIN`.
- Every request sends `x-vercel-skip-toolbar: 1`.
- It fails, naming the cause, when one header is removed, when a page has an unhashed inline script, and when an HTML file has no policy tag.
Verify: `bun test scripts/__tests__/smoke.test.ts`
Files: `src/ops/smoke.ts`, `scripts/smoke.ts`, `package.json`, `scripts/__tests__/smoke.test.ts`
Size: M
Needs Peter: no

### D22: Health runs and the status in the ops module

Delivers: The ops module records the two health checks' runs and gives a status of booleans and times only.
Blocked by: D15
Acceptance:
- `health.save()` and `health.markGithubRun()` show in `health.last()` and in `status()`, which holds the live commit, booleans and times only.
- `status()` reports a missing ntfy variable as `false` and prints `missing_config`.
Verify: `bun test src/ops`
Files: `src/ops/ops.ts`, `src/ops/upstash.ts`, `src/ops/__tests__/ops.test.ts`
Size: S
Needs Peter: no

### D23: The status route

Delivers: `GET /api/status` shows whether production is configured and when the health checks last ran, and `POST /api/status` records the GitHub check's run.
Blocked by: D21, D22 (the route files folder `src/site/routes/` exists since S1)
Acceptance:
- `GET /api/status` answers `status()` with `no-store`, kept 60 s per function instance.
- `POST /api/status` with `Authorization: Bearer $HEALTH_SECRET` records the GitHub run; any other `POST` gets 401.
- The smoke check reads `/api/status`, and in production fails unless it reports the store and the alerts as configured.
Verify: `bun test scripts/__tests__/smoke.test.ts`
Files: `src/site/routes/api.status.ts`, `src/ops/smoke.ts`, `scripts/__tests__/smoke.test.ts`
Size: S
Needs Peter: no

### D24: The Vercel health job

Delivers: Once a day, Vercel Cron runs the smoke check against peterkloss.dev, checks yesterday's daily totals and the GitHub check's last run, and pushes Peter once on a failure.
Blocked by: D23, D12
Acceptance:
- `/api/cron/health` answers 401 at once without the right `CRON_SECRET`, before it reads anything.
- Against the preview and the fake Upstash, the job fails and names the error share for a day of 10 turns with 3 errors; a day with 3 `MAX_TOKENS` turns and no other error passes; a GitHub run 50 hours old or older fails it, and one 30 hours old passes.
- On a failure, one `health` push a day, tried 3 times; each run is saved in `health:vercel`.
Verify: `bun test scripts/__tests__/smoke.test.ts`; `bun test src/ops`
Files: `src/site/routes/api.cron.health.ts`, `src/ops/smoke.ts`, `scripts/__tests__/smoke.test.ts`, `src/ops/__tests__/fake-upstash.ts`, `docs/design/wording-drafts/D24.md`
Size: M
Needs Peter: approval of the `health` push text, in his one review before D37 (row 153). The task finishes on the wording draft in `docs/design/wording-drafts/D24.md`.

### D25: The smoke check compares the served documents

Delivers: With `--documents <dir>`, the smoke check proves that visitors download the committed, tested documents.
Blocked by: D21, T2 (`bun run documents` and the committed `documents/`)
Acceptance:
- Each served document is byte for byte the file in `<dir>`, and the PDF has 2 pages (`pdfinfo`).
- It fails, naming the document, when a served document differs from the committed one.
Verify: `bun test scripts/__tests__/smoke.test.ts`
Files: `src/ops/smoke.ts`, `scripts/__tests__/smoke.test.ts`
Size: S
Needs Peter: no

### D26: The smoke check in Chrome, online and offline

Delivers: With `--browser`, the smoke check loads the site in Chrome and fails on any policy violation, page error, service-worker error or server-function request, online and offline.
Blocked by: D21, S29 (the service worker and its offline behavior), C19 (the chat column's input)
Acceptance:
- Chrome loads `/`, `/resume`, a source page and `/sources/does-not-exist`, and fails on any policy violation, page error, service-worker console error or request to `/_serverFn/`.
- A click from the source page to `/` shows the first view's heading; the chat input becomes usable; a `fetch` from the page that posts a malformed body to `/api/chat` gets 400.
- With the network off, a reload of `/` and of the source page shows them, and an unknown path shows the not-found page; `bun run smoke <preview origin> --browser --documents documents/` passes, and fails naming the cause when a page requests `/_serverFn/`.
Verify: `bun test scripts/__tests__/smoke.test.ts`
Files: `src/ops/smoke.ts`, `scripts/__tests__/smoke.test.ts`
Size: M
Needs Peter: no

### D27: The smoke check's production checks and the protection bypass

Delivers: With `--production`, the smoke check also checks the real model's setting, the host redirects and the WAF rules, and it passes Deployment Protection on a deployment URL.
Blocked by: D21, D23, D6
Acceptance:
- With `--production`: `/api/status` also reports the real model as configured; the three other hosts and the `.vercel.app` address return 308 for `/resume?x=1` to `https://peterkloss.dev/resume?x=1`; a chat `POST` with `Content-Type: text/plain` gets the WAF's 403; malformed chat requests get 429 by the 41st.
- On a protected deployment URL, requests carry `x-vercel-protection-bypass` from `VERCEL_AUTOMATION_BYPASS_SECRET`, and the browser also sends `x-vercel-set-bypass-cookie: true`.
Verify: `bun test scripts/__tests__/smoke.test.ts` stays green; the production part first runs in D37 (no local seam: Testing Strategy, last line).
Files: `src/ops/smoke.ts`, `scripts/smoke.ts`
Size: S
Needs Peter: no

### D28: `bun run questions` reads the question log and the daily totals

Delivers: On Peter's laptop, `bun run questions` prints the last 7 days' entries, counts and costs through the read-only token.
Blocked by: D12, D6 (spike check 9)
Acceptance:
- An entry appended through `log.append()` comes back from `createOpsReader().list(7)`, and the reader makes no write command.
- `bun run questions` loads `.secrets/local.env` with `--env-file` and prints the entries newest first, a count per outcome, the most read sources, and the daily totals with the day's and the month's cost against the cap and the limit.
Verify: `bun test src/ops`; manual after setup: Peter runs `bun run questions` (the read-only token is his; agents never read it).
Files: `src/ops/ops.ts`, `src/ops/upstash.ts`, `scripts/questions.ts`, `package.json`, `src/ops/__tests__/ops.test.ts`
Size: M
Needs Peter: the read-only token in his `.secrets/local.env`, for the manual check

### D29: The reservation covers the worst-case turn

Delivers: `limits.ts` holds the worked worst-case turn, measured from the real system prompt and core, and a test fails if it reaches the $0.90 reservation.
Blocked by: D11, C15 (the system prompt's wording draft in `src/chat/server/prompt.ts`; row 153), K3 (`renderCore()`)
Acceptance:
- The worked worst case (6 model calls of 8,000 output tokens at effort `medium`, the first call's cache write of the whole prompt and the later calls' cache reads, the writes of 3 reads of 24,000 characters) uses the measured size of the system prompt and the core, and costs less than the reservation.
Verify: `bun test src/ops`
Files: `src/ops/limits.ts`, `src/ops/__tests__/ops.test.ts`
Size: S
Needs Peter: a decision only if the worst case reaches $0.90 (a change to the reservation is "ask first")

### D30: The docs-only list and the three shell scripts

Delivers: One list says which paths never change the live site, and `scripts/site-changed.sh` and the ignore step read it, so a docs-only push builds nothing and an error always builds.
Blocked by: D7 (`.github/` tracked), A3 (`.gemini/settings.json`), C40 (`evals/trick-questions.yaml`)
Acceptance:
- `scripts/docs-only.txt` holds the spec's list, and every entry matches a tracked file.
- `scripts/site-changed.sh <from> <to>` exits 1 when a site file differs, 0 when none does, and 128 on an error.
- In a temporary git repository with a shallow clone, `scripts/ignore-build.sh` builds for a change to a site file (also when the previous deployment is more than 10 commits back), skips a docs-only change across several commits, and builds on an empty previous commit, an unknown commit and a failing git command.
Verify: `bun test scripts/__tests__/docs-only.test.ts`
Files: `scripts/docs-only.txt`, `scripts/site-changed.sh`, `scripts/ignore-build.sh`, `scripts/__tests__/docs-only.test.ts`
Size: M
Needs Peter: no (the list is approved; a later change is "ask first")

### D31: No docs-only entry covers a file the site build reads

Delivers: The docs-only test fails when an entry matches a file the site build reads, so a docs-only push can never hide a site change.
Blocked by: D30, D16
Acceptance:
- `buildSite()` returns the list of repo files it read: the files in Vite's module graph and the files it opens (main's decision: the deploy task that writes this docs-only check adds the recording).
- No entry of `scripts/docs-only.txt` matches a file in that list; the test builds the real root once into a temporary folder to get it.
Verify: `bun test scripts/__tests__/docs-only.test.ts`
Files: `scripts/__tests__/docs-only.test.ts`, `src/site/build.ts` (a site file, so the push is a release)
Size: S
Needs Peter: no

### D32: The release check holds a deployment until the smoke check passes in Chrome

Delivers: A new production deployment stays off peterkloss.dev until CI, the audit and the smoke check on that deployment pass, and a failed release pushes Peter.
Blocked by: D30, D25, D26; Peter: delete the throwaway spike project and its Upstash database (once `release-check.yml` is on `main`, the spike project's production deployments would send `vercel.deployment.ready`, fail the ancestor check and push "Release failed")
Acceptance:
- It starts on `vercel.deployment.ready`, stops unless `client_payload.environment` is `production`, has the permissions `contents: read`, `statuses: write` and `checks: read`, and fails before running any code when the deployment's commit is not an ancestor of `main`.
- It waits up to 20 minutes for `test` and `audit` on that commit, runs `bun ci` and `bun run smoke <deployment URL> --browser --documents documents/`, applies the superseded rule last (`scripts/site-changed.sh <commit> origin/main`), and reports through Vercel's status helper. Spike check 12 runs here (moved from D5): at setup step 10 the first run shows the status helper's name, Deployment Checks hold the deployment until the status passes, and research 12 records the verdict.
- On a failure it pushes "Release <short commit> failed: <step>" to Peter's phone, with 3 tries.
Verify: manual at setup step 10: the first production deployment shows the release check's status, and Deployment Checks hold it until the status passes.
Files: `.github/workflows/release-check.yml`, `docs/research/12-deploy-platform.md` (check 12's verdict)
Size: M
Needs Peter: setup steps 9 and 10 (Actions secrets; Deployment Checks with the status name its first run shows)
Noticed (A2 review, 2026-10-27, read in the source of `vercel/repository-dispatch` `actions/status` at commit `bad8e8a`, not yet seen in a run): the status helper posts `failure` only when a step concluded `failure`, and `success` otherwise. A cancelled step, such as a job-level `timeout-minutes` on the 20-minute CI wait, would post `success`. End the wait with a failing step, and check this in the first run.

### D33: The GitHub health check

Delivers: Once a day from outside Vercel, the GitHub health check runs the live commit's smoke check in Chrome with the production checks, checks that the Vercel job ran and that the live site does not lag `main`, and pushes Peter on a failure.
Blocked by: D23, D25, D26, D27, D30, D32
Acceptance:
- It runs daily at 21:17 UTC and by hand; it reads the live commit from `/api/status`, checks that it is an ancestor of `main`, checks it out, and runs `bun run smoke https://peterkloss.dev --browser --production --documents documents/`.
- It fails unless `/api/status` shows a passing Vercel run less than 50 hours old, and unless `scripts/site-changed.sh <live commit> origin/main` exits 0 or the newest site change on `main` is less than 2 hours old; at the end, pass or fail, it posts its run to `/api/status`.
- On a failure it pushes Peter's phone, with 3 tries.
Verify: manual after setup: `gh workflow run health.yml`, then `gh run watch`; before setup step 12 the run fails on the real model, and the push reaches Peter's phone (Success Criteria).
Files: `.github/workflows/health.yml`
Size: M
Needs Peter: the Actions secrets (setup step 9)

### D34: The setup list and the rollback runbook

Delivers: Peter has `docs/runbooks/setup.md`, the 13 setup steps in order with links and a check for each, and `docs/runbooks/rollback.md`.
Blocked by: D6, D32
Acceptance:
- `setup.md` lists the spec's 13 steps in its order, each with its dashboard link and how to check it; the API key comes last, in step 12.
- `rollback.md` gives Instant Rollback, then "Undo Rollback" on the fix's deployment, and ends with a check that the next release goes live without help.
Verify: Peter reads both.
Files: `docs/runbooks/setup.md`, `docs/runbooks/rollback.md`
Size: S
Needs Peter: review and approval (Success Criteria, last bullet)

### D35: Runbooks for the spend alerts

Delivers: Each spend alert has a runbook that says what it means, the first thing to check and the fix.
Blocked by: D28 (the runbooks use `bun run questions`)
Acceptance:
- `spend-75.md`, `day-cap.md`, `spend-limit.md` and `vercel-spend.md` hold what the spec's "Runbooks" section says for each.
Verify: Peter reads them.
Files: `docs/runbooks/spend-75.md`, `docs/runbooks/day-cap.md`, `docs/runbooks/spend-limit.md`, `docs/runbooks/vercel-spend.md`
Size: S
Needs Peter: review and approval

### D36: Runbooks for the store, health and release alerts

Delivers: The store, health and release alerts each have a runbook with the first thing to check and the fix.
Blocked by: D32, D33
Acceptance:
- `store-failed.md`, `health-failed.md` (with its five cases) and `release-failed.md` hold what the spec's "Runbooks" section says for each.
Verify: Peter reads them.
Files: `docs/runbooks/store-failed.md`, `docs/runbooks/health-failed.md`, `docs/runbooks/release-failed.md`
Size: S
Needs Peter: review and approval

### D37: Setup step 11: the `.vercel.app` address, the first release

Delivers: The project's `.vercel.app` address redirects to peterkloss.dev, and this first release goes live only after its three checks pass.
Blocked by: D17, D32, D33, D34, A2 (the `release` repo skill); Peter: his one review before D37, of the wording drafts in `docs/design/wording-drafts.md` and any checkpoint review still open (row 153; plan, "Running the plan"); Peter: setup steps 1 to 11 (the domains bought, ntfy, the Anthropic workspaces, Vercel Pro and the import, the toolbar and protection, Upstash, the WAF rules, the spend budget, the Actions secrets, Deployment Checks, the domains added)
Acceptance:
- `src/deploy/routes.ts` holds the project's `.vercel.app` address, and the config test checks that its route redirects with 308 and leaves `/api/` alone.
- The push goes live on peterkloss.dev only after `ci / test`, `ci / audit` and the release check pass.
- Before setup step 12, the GitHub health check run by hand fails on the real model, and the push reaches Peter's phone.
Verify: `bun test src/deploy/__tests__/config.test.ts`; `gh run watch` on `ci` and the release check; `gh workflow run health.yml`
Files: `src/deploy/routes.ts`, `src/deploy/__tests__/config.test.ts`, `docs/STATUS.md`
Size: S
Needs Peter: confirming the push on his phone. The release follows AGENTS.md, "Releases and approvals".

### D38: Setup step 13: production passes its checks

Delivers: After Peter adds the API key, production reports everything configured, both health checks pass by hand, and a docs-only push builds nothing.
Blocked by: D37; Peter: setup step 12 (`ANTHROPIC_API_KEY`, then Redeploy with "Use project's Ignore Build Step" unchecked)
Acceptance:
- `/api/status` reports everything configured; the GitHub health check (`gh workflow run health.yml`) and the Vercel health job (Peter runs it from the dashboard) pass by hand.
- A docs-only push builds nothing, and Peter's one question to the live chat gets an answer.
- The deploy rows of `AGENTS.md`'s Modules table and `spec/README.md` show the module as built, and STATUS records the results; the fresh-session check passes (a sub-agent in a fresh clone; Peter reads the result).
Verify: `curl -s https://peterkloss.dev/api/status`; `gh run watch`; Vercel shows the docs-only push's build as ignored (Peter).
Files: `AGENTS.md`, `spec/README.md`, `docs/STATUS.md`
Size: S
Needs Peter: setup step 12; running the Vercel job by hand; the live question (costs cents)

## Checkpoints

### Checkpoint deploy: the spike

After D6. Every spike check has a verdict in research 12 (check 12 runs at D32); Peter approved any spec change; `prototype/deploy-spike` is not merged. Peter deletes the throwaway project and its Upstash database before D32 lands.

### Checkpoint deploy: createOps ready

After D9. `bun test src/ops` passes; the chat's route file (C17) can build its `ChatDeps` from `createOps()`.

### Checkpoint deploy: the ops write side

After D9 to D15. `bun test src/ops` and `bun test` pass with no network beyond the in-test servers.

### Checkpoint deploy: the Vercel output

After D16, D17, D18 and D20 (D19 follows S28 in phase 3). `bun run build`, `bun run build:site` and `bun test` pass; the site's seam-1 and browser tests run on this output.

### Checkpoint deploy: the smoke check

After D21 to D27. `bun run smoke http://localhost:4173 --browser --documents documents/` passes against `bun run preview`; the full suite passes.

### Checkpoint deploy: the workflows

After D30 to D33. `ci` is green on `main`; Peter reviews the workflows before setup.

### Checkpoint deploy: setup list and runbooks

After D34 to D36. Peter reviews and approves the setup list and the runbooks (Success Criteria).

### Checkpoint deploy: lands

After D38. Every Success Criteria bullet holds; D38 has set the deploy rows to built, and the fresh-session check passes.
