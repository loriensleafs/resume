# Spec: deploy

Approved by Peter on 2026-10-27 (decision record row 127), with the amendments to other specs below. Peter's answers are rows 107 to 127 of the [decision record](../docs/design/interview-2026-10-26.md); the facts are in [research 12](../docs/research/12-deploy-platform.md); the static site with build-time data is [decision 0023](../docs/decisions/0023-static-site-build-time-data.md). Three adversarial reviews found 18, 16 and 39 issues. This version answers all of them, with the local checks that the third review asked for (row 126). What only a real Vercel deployment can settle is the plan's first task, the [deploy spike](#deploy-spike).

Corrected on 2026-10-27 after the reviews of the other specs (decision record rows 128 to 136). Approved by Peter with the updated mockups on 2026-10-27 (decision record row 139); the scope label and the texts follow rows 137 and 138. Amended on 2026-10-27 after C1 (row 155): the error share and the `errorCode` list name `SERVER_ERROR`.

Amended on 2026-10-27 for Peter's standing approval (decision record row 151): which pushes need him is in [AGENTS.md](../AGENTS.md), "Releases and approvals".

## Objective

Put the site and the chat on the internet at `https://peterkloss.dev`, and keep them safe, cheap and observable without Peter watching them. The site serves recruiters, hiring managers and engineers during Peter's job search, when traffic is higher than usual (row 114), so a quiet failure or a spent limit must reach Peter at once.

This module owns:

- the Vercel project's configuration in code: the build settings, the routes, the domains and the redirects;
- the security and cache headers, and the rate limits;
- the spend limits and the daily cap;
- the question log's store, the daily totals, the limit alerts and the status route;
- `bun run questions`, which reads the question log and the daily totals on Peter's laptop;
- `bun run build:site`, the script that runs the site's, the chat's and this module's build steps in order;
- the smoke check, the two health checks and CI;
- the setup list Peter follows in the dashboards, and the runbooks.

It implements three interfaces that SPEC-chat defines: `QuestionLog`, `Budget` and `Telemetry`. The chat module does not import this module.

Acceptance criteria:

- A push that changes a site file goes live on peterkloss.dev only after CI and the smoke check on the new deployment pass (row 107). A site file is any tracked path that `scripts/docs-only.txt` does not list. A push that changes only listed paths builds nothing and changes nothing live.
- A deployment never takes the domains while `main` holds a newer site change.
- Previews use the fake model, hold no API key and write nothing to the store (row 108). Code enforces this, not only the dashboard.
- pkloss.dev, pwk.dev, www.peterkloss.dev and the project's public `.vercel.app` address answer with a 308 to the same path and query on peterkloss.dev ([decision 0018](../docs/decisions/0018-domains.md)). On the `.vercel.app` address, `/api/` paths are not redirected, so Vercel Cron reaches the health job.
- No page and no server function runs at request time. Only `/api/chat`, `/api/status` and `/api/cron/health` run as functions. Every other path is a file, or the static not-found page with status 404.
- Every HTML response enforces the Content Security Policy below, with no `'unsafe-inline'` and no `'unsafe-eval'`. Chrome reports no violation on the real deployment, online and offline, the not-found page included.
- One internet address can send about 20 chat questions in 10 minutes (row 112). A burst at a window's edge can pass up to 40, and counters are kept per region. Every other `/api/` path allows 60 requests in 10 minutes.
- One chat request sends at most 10,000 characters of new question, 40,000 characters of earlier turns and 256 KB in total (row 125).
- The chat stops at $8 of estimated cost a day until 00:00 UTC (row 121), and at Anthropic's $20 a month (row 113). Each turn reserves $0.90 (row 131), more than its worst case, before its first model call, so parallel requests cannot pass the cap. At either limit, visitors see a "limit reached" state, not a retry, also after a reload (row 114).
- The store itself deletes question-log entries and daily totals, at the latest 90 days after their day ([decision 0022](../docs/decisions/0022-question-log-store.md)).
- Peter's phone gets an urgent push (rows 115, 121, 122) when:
  - the month's estimated chat cost passes 75% of the limit;
  - the daily cap or the monthly limit is reached;
  - the store fails;
  - a health check fails, or finds that the other did not run;
  - a release fails its checks.
- The documents visitors download are byte for byte the committed, tested files, and the PDF has exactly 2 pages (row 119). A build with unchanged sources leaves those files unchanged.
- `bun test` passes with no account, key or network beyond the tests' own servers.

## What runs where

| Part | Where it runs | Set in code | Set by Peter in a dashboard |
|---|---|---|---|
| Prerendered pages, assets, documents, service worker, the not-found page | Vercel's CDN | The routes in `.vercel/output/config.json`, written by the build | — |
| `/api/chat`, `/api/status`, `/api/cron/health` | Vercel Functions on the Bun runtime, region `iad1` | Nitro's `vercel.functionRules`, the routes | Environment variables |
| Domains and redirects | Vercel | The routes | Adding the domains to the project |
| Security and cache headers | Vercel, and a policy tag in each page | The routes, the build output | — |
| Rate limits | Vercel WAF | — (WAF rules cannot live in the repository) | Three WAF rules |
| Question log, daily totals, costs, reservations, alert markers, health records | Upstash Redis (Marketplace) | `src/ops/` | The integration, its budget |
| Limit alerts | ntfy.sh, a secret topic | `src/ops/alerts.ts`, the workflows | The ntfy app on his phone |
| CI, the release check, the outside health check | GitHub Actions | `.github/workflows/` | Actions secrets, Deployment Checks |
| Spend limits | Anthropic Console, Vercel, Upstash | The daily cap, the monthly limit's value and the prices in `src/ops/limits.ts` | The limits themselves |

Agents never sign in to Vercel, Anthropic, Upstash, ntfy or GitHub's settings. Everything an agent can put in the repository lives there; the rest is the setup list.

## Releases

Gated auto-deploy (row 107).

**What counts as a site change.** `scripts/docs-only.txt` lists the paths that never change the live site, as git pathspecs:

```text
docs/
spec/
tasks/
.scratch/
evals/
.agents/
.claude/
.codex/
.cursor/
.gemini/
.github/
.vscode/
**/__tests__/**/*.test.ts
AGENTS.md
CLAUDE.md
CONTEXT.md
README.md
```

- Every other tracked path is a site file. A missing entry makes an extra release, never a skipped one.
- `.gemini/` matches a tracked file once the agents task writes `.gemini/settings.json`, which comes before the docs-only test. `.mcp.json` joins the list once Peter adds it ([SPEC-agents](SPEC-agents.md)); until then it would match no tracked file.
- The list has no `prototypes/` entry. Prototypes stay on their own branches, so no file on `main` matches it, and an entry that matches no tracked file fails the docs-only test.
- Shared test helpers, such as `src/chat/server/__tests__/fixtures.ts`, are site files: the preview's fake model bundles them with the chat function.
- `scripts/site-changed.sh <from> <to>` exits 1 when a site file differs between two commits, 0 when none does, and 128 on an error. It runs `git diff --quiet <from> <to> -- . ':(exclude,glob)<entry>'…` for each entry. The ignore step, the release check and the GitHub health check all use it, so the list is read in one place.
- `scripts/__tests__/docs-only.test.ts` fails when an entry matches no tracked file, or when an entry matches a file that the site build reads. `buildSite()` returns the files it read: Vite's module graph and the files it opens. The task that writes the docs-only test adds that return value. The built-output checks (each page's policy tag, no `style=` attribute) live once, in the site's build test; this module's tests check `addPolicyTags()` and `writeVercelConfig()` at unit level.

**The steps of a release.**

1. A push to `main` reaches Vercel. The ignore step, `scripts/ignore-build.sh`, decides whether to build:
   - It is a short shell script, because it runs before Bun is installed.
   - It compares `HEAD` with `VERCEL_GIT_PREVIOUS_SHA`, the commit of the last successful deployment. Vercel's clone holds 10 commits, so the script first fetches that one commit by its SHA when it is missing.
   - It skips the build (exit 0) only when `scripts/site-changed.sh` exits 0.
   - It builds on the first deployment, when the variable is empty, and on every error, such as a failed fetch. An extra build costs a minute; a skipped release would hide a change. The release check still holds an extra build's deployment to the same rules.
2. Vercel builds a production deployment on its own URL. Deployment Checks hold it off the domains.
3. Three required checks must pass:
   - The jobs `test` and `audit` of the workflow `ci` (GitHub shows them as `ci / test` and `ci / audit`) run on the pushed commit. `test` holds the build, the document checks and `bun test`. `audit` runs `bun audit --prod --audit-level=high`.
   - The release check, `.github/workflows/release-check.yml`, posts its status on the deployment's commit. It is described below.
4. When all three pass, Vercel moves the domains to the deployment.
5. If any fails, the deployment never serves visitors, the site stays on the last good deployment, and Peter's phone gets a push. Peter can promote a deployment by hand from the dashboard, for example during a registry outage that fails `audit`; agents never do.

**The release check.** The workflow starts on Vercel's `vercel.deployment.ready` event. Its permissions are `contents: read`, `statuses: write` and `checks: read`.

1. It runs only when `client_payload.environment` is `production`. Preview deployments start it too, and it stops there.
2. It checks out `main` with its full history. Before it runs any code from the deployment's commit (`client_payload.git.sha`), it checks that this commit is an ancestor of `main`. Otherwise it fails. So it never runs code from a fork or an unmerged branch with the repository's secrets.
3. It waits up to 20 minutes for `test` and `audit` to finish on the same commit, and fails if either fails or does not finish. The release check's status then means the whole release passed, even if a required check is missing from the dashboard.
4. It checks out the deployment's commit, runs `bun ci`, and runs `bun run smoke <deployment URL> --browser --documents documents/`.
5. Last, right before it reports, it applies the superseded rule: it fails when `scripts/site-changed.sh <deployment's commit> origin/main` exits 1. Then `main` holds a newer site change, whose own deployment takes over. A docs-only push after the deployment's commit does not fail it.
6. It reports through Vercel's status helper, which posts the status on the deployment's commit. The status name is the helper's default, which includes the environment. Setup step 10 requires the name the first run shows.
7. On failure, it pushes "Release <short commit> failed: <step>" to Peter's phone, with 3 tries.

A small window remains: a site change pushed during step 5 can let the older deployment take the domains after the newer one. The GitHub health check then finds the live commit behind `main` and fails.

A push of site changes to `main` is a release. [AGENTS.md](../AGENTS.md), "Releases and approvals", says which pushes need Peter (row 151), sends every push to `main` through the `release` skill, and points to `scripts/docs-only.txt` ([SPEC-agents](SPEC-agents.md)).

**Rollback.** Instant Rollback in the dashboard moves the domains back in seconds, and turns domain auto-assignment off. While it is off, passing deployments do not go live, and the GitHub health check reports the lag. After the fix's deployment passes its checks, Peter selects "Undo Rollback" and chooses that deployment. That makes it live and turns auto-assignment on again. `docs/runbooks/rollback.md` has the steps and ends with a check that the next release goes live without help.

**Previews.** Every other branch builds a preview behind Vercel Authentication. Code decides from `VERCEL_ENV`: outside production, the chat always uses the fake model, and the ops module always uses its in-memory parts, whatever variables are set (row 108).

## Documents

The PDF build drives Chrome, and Vercel's build image (Amazon Linux 2023) has none, so the public documents are committed (row 119).

- `bun run documents` builds the public variant into a temporary folder and writes `documents/Peter-Kloss-Resume.pdf`, `.docx` and `.txt`, the names SPEC-site serves.
- `documents/inputs.sha256` holds a hash of the document build's inputs: `resume.yaml`, the content module's source files, `fonts/`, and the locked versions of the content module's own packages, read from `bun.lock`. The hash does not cover the whole of `bun.lock`, so a change to another module's packages needs no `bun run documents`. [SPEC-content](SPEC-content.md) owns this rule. `bun run documents` writes nothing when the hash is unchanged. So a rebuild with the same sources never changes the files, although Chrome and the Word library stamp the date into them. Neither the Word library nor Chrome accepts a fixed date, and the Word library also gives each link a random id. So the hash rule alone keeps rebuilds byte-stable ([research 12](../docs/research/12-deploy-platform.md#the-committed-documents-fixed-dates-2026-10-27)).
- A change to `resume.yaml` and the rebuilt documents go in the same commit. The edit-resume skill runs `bun run documents`.
- `bun run build:site` copies `documents/` into the site. It builds no document and needs no Chrome.
- `scripts/__tests__/documents.test.ts`, run in CI and locally:
  - The hash of the current inputs equals `documents/inputs.sha256`, so a resume change without rebuilt documents fails.
  - The committed PDF has exactly 2 pages, is US Letter and tagged, and embeds every font, as the content module's build test checks its own output.
  - A fresh build's text equals the committed files' text, spacing ignored: the text file, the PDF's text (`pdftotext`) and the Word file's text (`unzip -p … word/document.xml`). The PDF bytes are not compared, because Chrome on the runner is not pinned.
  - Where `private.yaml` exists, the phone number appears in none of the committed documents' extracted text. The existing private-detail test reads raw bytes, and a PDF or a Word file holds compressed text, so it cannot see the number there.
- The smoke check, when it runs with a checkout (in the release check and the GitHub health check), compares each served document byte for byte with that checkout's file.
- The site's own font files are committed too, so the Vercel build downloads nothing.

## Configuration in code

```jsonc
// vercel.json: the build settings only
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "bunVersion": "1.4.x",                          // "1.x" would be Bun 1.3.14; Vercel picks the 1.4 patch
  "framework": null,                              // the build writes .vercel/output itself
  "installCommand": "bun ci",
  "buildCommand": "bun run build:site",
  "ignoreCommand": "sh scripts/ignore-build.sh"   // exit 0 skips the build
}
```

```ts
// vite.config.ts (part): Nitro writes Vercel's output in every environment
nitro({
  preset: "vercel",
  vercel: {
    functions: { runtime: "bun1.4.x" },           // Nitro writes "bun1.x" when nothing is set; spike check 2
    functionRules: { "/api/chat": { maxDuration: 150, regions: ["iad1"] } },
  },
});
```

**The build script.** `bun run build:site` runs `scripts/build-site.ts`, which this module owns. It runs five steps in this order:

1. Site: `buildSite({ root, outDir })`. The Vite build prerenders the pages into Nitro's Vercel output, copies `documents/` and the committed icons, and writes `404.html`, with no script.
2. Chat: during that Vite build, the chat's Vite plugin, the one that gives `virtual:knowledge`, also writes `device-index.json` into `.vercel/output/static/`.
3. Deploy: `addPolicyTags(staticDir)` from `src/deploy/policy.ts` writes each HTML file's policy tag, `404.html` included.
4. Site: `writeServiceWorker(staticDir)` (Workbox `generateSW`). Its precache includes `device-index.json` and `404.html`.
5. Deploy: `writeVercelConfig(outputDir)` from `src/deploy/routes.ts`.

- The script writes `.vercel/output/` under the repo root. With `--out <folder>`, it writes `<folder>/.vercel/output/` instead and passes that folder to every step; the tests' seam-1 folder is made this way. With `--root <folder>`, every step reads the project's files (`resume.yaml`, `private.yaml`, `knowledge/`, `documents/`) from that folder; the tests pass a fixture root whose `private.yaml` holds a fake phone number.
- A module whose step the script runs wires its own call into the script, as the site's `writeServiceWorker()` task does for step 4.
- The script is the composition root at build time, as the route files are at run time. The site's code imports neither this module nor the chat module.
- The policy tags come before the service worker, so the precache holds each page with its tag.

**Routes.** A local build of TanStack Start with Nitro's Vercel preset (research 12) showed what Nitro writes to `.vercel/output/config.json`: the immutable cache rule for `/assets/`, the filesystem, `/api/chat`, and last `/(.*)` to `/__server`. That last route renders every unknown path in a function at request time, with no policy tag. So the build script's last step, `writeVercelConfig(outputDir)`, replaces Nitro's `routes` with its own list and keeps Nitro's other fields. In order:

1. **Host redirects.** For each of pkloss.dev, pwk.dev, www.peterkloss.dev and the project's `.vercel.app` address, a route whose `has` matches that host exactly (`{ "type": "host", "value": { "eq": "pkloss.dev" } }`), with a status of 308 and `Location: https://peterkloss.dev/$1`. The `.vercel.app` route's `src` leaves `/api/` out. The syntax follows Vercel's Build Output API documentation; whether Vercel adds the query string to `Location` is a spike check.
2. **Headers**, with `continue: true` (see Headers).
3. `{ "handle": "filesystem" }`. An `overrides` entry for each prerendered page serves `<path>/index.html` at its clean address, `<path>`.
4. **The three API routes**, each with `caseSensitive: true`, because routes otherwise match without regard to case. `/API/chat` is then a miss, not a way around a case-sensitive WAF rule.
5. **Every other path** gets `/404.html` with status 404.

- Nitro's `/__server` function stays only as the destination of `/api/status` and `/api/cron/health`. No route sends a page or `/_serverFn/` to it.
- The routes also hold the cron: `crons: [{ path: "/api/cron/health", schedule: "17 15 * * *" }]`.
- The chat's maximum duration is 150 s (row 132): above SPEC-chat's 120 s turn deadline (`deadlineMs: 120_000`), below Vercel's 300 s default, so a stuck function stops early.
- Every tool in the build runs under Bun 1.4 (`bun --bun` for a tool with a Node shebang). The deploy spike checks which Bun runs the build. If it is not 1.4, the install command installs 1.4.2 with Bun's official installer, and the build command calls it by its absolute path, `$HOME/.bun/bin/bun`.
- Pages get their data at build time, not from a server function at request time. A local check showed why: during client-side navigation, a route's loader runs in the browser and calls its server function as `GET /_serverFn/<id>`. With no server, that request gets a 404 and the page comes up empty, online and offline. This is an amendment to SPEC-site (below).

## Headers

On every response, from a route on `/(.*)`:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` (.dev is already on the browsers' preload list, so no `preload`) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `X-Frame-Options` | `DENY` (for browsers without `frame-ancestors`) |

The Content Security Policy:

| Paths | `Content-Security-Policy` header |
|---|---|
| Every path except the three documents and the worker files: the header policy | `style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` |
| `/sw.js` and `/workbox-<hash>.js`: the worker policy | The header policy plus `; script-src 'self'` |
| `/Peter-Kloss-Resume.pdf`, `.docx`, `.txt` | None. `object-src 'none'` on a PDF can blank it in a browser's PDF viewer. A document runs no script. |

- A route's `headers` is an object, so two routes that set the same header on one path do not give two policies. The worker files therefore get one full policy, from the last matching route. The spike checks this merge on Vercel.
- Each HTML file in the output, the not-found page included, starts its `<head>` with its own policy tag. `<hashes>` are the SHA-256 hashes of that page's inline scripts; a page with none gets `script-src 'self'` alone:

  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' <hashes>">
  ```

- The browser enforces both policies, so a page gets the header's rules and the tag's script rule. `frame-ancestors` lives in the header, because a tag cannot carry it.
- Why a tag and not a per-path header: a tag travels with its page, also from the service worker's cache, and every HTML response is now a file with a tag.
- TanStack Start's per-request nonce does not fit static pages. `addPolicyTags(staticDir)` writes each tag after prerendering (step 3 of the build script), and a build test fails on any HTML file without one.
- The second probe on `prototype/csp-probe` ran this split policy, the static not-found page and the service worker with no violation: on first and second visits, a source page, client navigation, and an unknown path online and offline (research 12). It was a local server, so the release check and the GitHub health check also load the real deployment in Chrome.
- Prerendered HTML holds no `style="…"` attribute, because `style-src 'self'` blocks it and hashes cannot allow it. A style a page needs, such as a role's width on the career timeline, or a Markdown table column's alignment, comes from a class in a stylesheet file the build writes. A test fails on any `style=` in the built pages. The chat's answers set styles through the DOM after load, which the policy allows. Allowing inline style attributes (`style-src-attr 'unsafe-inline'`) is an ask-first change.
- The policies enforce SPEC-site's rule of no third-party requests: fonts, scripts, images and connections come only from the site's own address.
- The Vercel Toolbar injects a script from `vercel.live`, which the policy blocks. Setup step 5 turns the toolbar off for production, and the checks send `x-vercel-skip-toolbar: 1`.

Caching:

| Path | `Cache-Control` |
|---|---|
| `/assets/*` and `/workbox-<hash>.js` (hashed names) | `public, max-age=31536000, immutable` |
| HTML pages, `/sw.js`, `/manifest.webmanifest`, `/device-index.json`, the three documents, the icons | `public, max-age=0, must-revalidate` (Vercel's default) |
| `/api/*` | `no-store`, set by the function |

## Rate limits

Three Vercel WAF rules, per IP address:

| Rule | Matches | Action |
|---|---|---|
| "chat content type" | Path starts with `/api/chat`, method `POST`, and the `Content-Type` header does not start with `application/json` | Deny (403) |
| "chat rate limit" | Path starts with `/api/chat`, method `POST` | 429 after 20 per 10 minutes (row 112) |
| "api rate limit" | Path starts with `/api/`, and it is not a chat `POST` | 429 after 60 per 10 minutes |

- The content-type rule stops the cheapest cross-site attack before the function runs: a page on another site can post a form, but a form cannot send `application/json` without the browser first asking the server's permission, which the site never gives. The handler's Origin check (SPEC-chat amendment 9) is the second guard.
- Denied requests cost nothing and do not run the function.
- SPEC-chat already maps a 429 to its alert. Its text changes to "Too many questions in a short time." and "Try again in a few minutes.", approved by Peter (row 138).
- `/api/cron/health` answers 401 at once without the right `CRON_SECRET`, before it reads anything.
- Whether a WAF path condition matches without regard to case, and whether the content-type condition works as written, are spike checks. The case-sensitive API routes already send `/API/chat` to the not-found page.

The rate limits slow one address; they do not cap spend. The daily cap below does.

## Spend limits

| Limit | Value | Warning | At the limit |
|---|---|---|---|
| Request size, in code | 10,000 characters of new question, 40,000 characters of earlier turns (oldest dropped first), 256 KB per request (row 125) | — | Over 256 KB: 413 `REQUEST_TOO_LARGE` |
| Daily cap, in code | $8 of estimated cost a UTC day (row 121) | — | New turns get the "limit reached" state until 00:00 UTC (4 pm Pacific in winter, 5 pm in summer); one push |
| Anthropic, workspace `resume-chat` | $20 a month (row 113) | Anthropic emails at $10; the server pushes at 75% | Anthropic rejects calls; the chat shows "limit reached" and pushes once a day |
| Vercel | $20 on-demand budget beyond the $20 monthly credit (row 116) | Email and the webhook to the ntfy push at 50%, 75% and 100% | Notify only; production never pauses |
| Upstash | $1 a month, pay as you go ([decision 0022](../docs/decisions/0022-question-log-store.md)) | — | The database is rate-limited; see "The store fails" below |

- The evals use a second workspace, `resume-evals`, with its own key and a $5 monthly limit, so eval runs never spend the visitors' budget and the estimates stay about visitors.
- The chat's API key is a service-account key scoped to `resume-chat`, kept only in Vercel's Production environment as a Secret variable.

**Prompt caching.** The chat route sets TanStack AI's `promptCache` to `"short"`, its default: a 5-minute cache. The Anthropic adapter then marks the tools, the system prompt with the core, and the conversation up to the newest question. Repeated text costs $0.10 per million tokens instead of $2 on a turn's later model calls and on a question within 5 minutes of the last (row 125).

- The tools come first in the cached text, so a change to the tool list rewrites the whole cache. SPEC-chat therefore keeps `read_sources` listed after the third read and skips a fourth call (amendment 13), instead of removing the tool.
- A 1-hour cache is a later choice, once the totals show how far apart visitors' questions are.

**Cost estimate.** Each turn adds its cost to the day and the month, at Sonnet 5.5's prices per million tokens ([research 11](../docs/research/11-knowledge-tooling.md)):

| Tokens | Price per million |
|---|---|
| Uncached input | $2 |
| Cache reads | $0.10 |
| 5-minute cache writes | $2.50 |
| 1-hour cache writes | $4 |
| Output | $10 |

TanStack AI's Anthropic adapter reports `promptTokens` as uncached input plus cache reads plus cache writes, with `cachedTokens`, `cacheWriteTokens` and `cacheWrite1hTokens` as details. `cacheWriteTokens` includes the 1-hour part. So the five counts are:

- uncached input = `promptTokens − cachedTokens − cacheWriteTokens`;
- cache reads = `cachedTokens`;
- 5-minute writes = `cacheWriteTokens − cacheWrite1hTokens`;
- 1-hour writes = `cacheWrite1hTokens`;
- output = `completionTokens`.

The prices and both limits live in `src/ops/limits.ts`. A test checks the estimate against a worked example counted by hand.

**Which usage a turn settles with.** TanStack AI calls `onUsage` once for each model call that finishes. A call that does not finish reports no usage: the abort event carries none.

- SPEC-chat's telemetry sums `onUsage` across the turn's finished model calls (amendment 5). The token counts in the daily totals are that sum, so they stay true.
- One rule settles the cost: a turn whose last model call did not finish keeps its whole $0.90 reservation. This covers a stopped turn, a turn cut off by the deadline (`DEADLINE`), a turn whose answer reached `max_tokens` (`MAX_TOKENS`) and a turn whose stream broke. Its real cost is not known, because TanStack AI reports usage only for a call that finishes (SPEC-chat).
- A turn with no usage at all, for example after a crash, also keeps its whole reservation.
- A turn whose model calls all finished settles with the cost of its summed usage.

**The daily cap.** Before a turn's first model call, the handler calls `budget.reserve()`:

1. In one transaction, it adds $0.90 to the day's total and reads the spend-limit marker.
2. If the new total passes $8, it takes the $0.90 back and refuses with `DAILY_LIMIT`. The function instance then remembers the capped day and refuses later turns that day without a store call.
3. After the turn, `telemetry.record()` replaces the reservation with the turn's cost, or keeps it, as "Which usage a turn settles with" says.
4. A reservation that is never settled stays counted for the day, which errs toward pausing.

$0.90 is above the worst case of one turn under the size caps and SPEC-chat's limits (rows 131 and 132):

- 6 model calls with 8,000 output tokens each, at effort `medium`, thinking included ($0.48);
- the first call's cache write of the whole prompt, and the later calls' cache reads;
- the writes of 3 reads of 24,000 characters.

`limits.ts` holds that worked worst case, from the measured size of the system prompt and the core, and a test fails if it reaches the reservation. So 25 parallel requests on an empty day give 8 turns and 17 refusals, and the cap holds.

**The monthly limit.** The handler reads the Anthropic error's status and body, not its message text, because Anthropic's SDK puts the reason only in the body:

- HTTP 400 with `error.type` `invalid_request_error` and an `error.message` that starts "You have reached your specified";
- HTTP 429 with `error.details.error_code` `enforced_spend_limit_reached`.

Either gives `errorCode: "SPEND_LIMIT"` and sets the marker `limit:spend` with the time. A test builds the SDK's real error class with the documented bodies.

- While the marker is less than an hour old, `budget.reserve()` refuses with `SPEND_LIMIT` before calling the model, so visitors get the state at once and no call is wasted.
- After an hour, one turn goes through as a probe; the others still refuse. A probe claims `limit:probe:<hour>` with `SET NX`, so only one goes through each hour.
- If the probe reaches the model, `record()` deletes the marker, and the chat works again. That happens when Peter raises the limit in the Console. If the probe meets the limit again, the marker's time is reset.

**How the limit state reaches the browser.** TanStack AI's browser client throws on a response that is not 200 without reading its body, so a refusal must arrive as a stream:

- A refusal before the model call is an HTTP 200 server-sent-event stream with one `RUN_ERROR` event and the code `DAILY_LIMIT` or `SPEND_LIMIT`. The browser then makes an answer message, as it does for any stream.
- A turn that meets Anthropic's limit during the run ends with `RUN_ERROR` and the code `SPEND_LIMIT`.
- In both cases the telemetry outcome is `limit`, and the saved answer keeps the outcome `limit`, so a reload shows the same state.
- The browser shows the "limit reached" state, with Peter's email, a link that opens the resume, and no Try again. The question goes back into the input only when the input is empty, and the question queue pauses until the visitor sends again (SPEC-chat).
- Peter approved the words (row 138); SPEC-chat holds them. These are amendments to SPEC-chat (below).

## The question log, daily totals, alerts and status

One module, `src/ops/`, behind a small interface. The routes build it from the environment; tests build it with fake servers.

```ts
// Budget, Telemetry, QuestionLog, QuestionLogEntry and ChatTurnEvent are the chat module's types (SPEC-chat).
// This module imports the chat module's types and its in-memory versions, and implements the types.

export type OpsEnv = {
  VERCEL_ENV?: string;          // the store and alerts are used only in "production"
  KV_REST_API_URL?: string;     // set by the Upstash integration, Production only
  KV_REST_API_TOKEN?: string;
  NTFY_TOPIC_URL?: string;      // https://ntfy.sh/<secret topic>
  ANTHROPIC_API_KEY?: string;   // only whether it is set is read, for status()
  PREVIEW_LIMIT?: string;       // Outside production only. With "day", the in-memory budget refuses every turn
                                // with DAILY_LIMIT. With "month", it refuses with SPEND_LIMIT. So a preview and
                                // the browser tests can show the "limit reached" state. An empty value counts
                                // as unset. Any other value throws, and the error shows at most 32 characters
                                // of it. Production ignores this variable, whatever its value.
};

export type Ops = {
  log: QuestionLog;                                     // append(entry) and list(days)
  budget: Budget;                                       // reserve()
  telemetry: Telemetry;                                 // record(event, reservation?)
  totals(days: number): Promise<DailyTotals[]>;
  health: {
    save(run: HealthRun): Promise<void>;                // the Vercel health job's result
    markGithubRun(): Promise<void>;                     // the GitHub health check ran
    last(): Promise<{ vercel: HealthRun | null; githubAt: string | null }>;
  };
  status(): Promise<OpsStatus>;                         // for GET /api/status: booleans and times only
};

/** In-memory parts outside production; in production, a missing variable is reported, never hidden. */
export function createOps(env: OpsEnv, io?: { fetch?: typeof fetch; now?: () => Date; print?: (line: string) => void }): Ops;

/** For `bun run questions` on Peter's laptop, with the read-only token. `list(days)` is QuestionLog's read. */
export function createOpsReader(env: { KV_REST_API_URL: string; KV_REST_API_READ_ONLY_TOKEN: string }, io?: { fetch?: typeof fetch }): {
  list(days: number): Promise<QuestionLogEntry[]>;
  totals(days: number): Promise<DailyTotals[]>;
};
```

- This module describes two route files, `src/site/routes/api.status.ts` and `src/site/routes/api.cron.health.ts`. SPEC-chat describes `api.chat.ts`, which builds `createOps(process.env)` and passes its `log`, `budget` and `telemetry` to `handleChat()` as `ChatDeps`. The route files are composition roots: they import both modules. This module imports the chat module's types and its in-memory versions, and the chat module never imports this one.
- `createOps()` gives new, empty parts on each call. So each route file builds it once per function instance, at module scope, and every request of that instance uses the same `Ops`. The instance holds the in-memory log outside production; in production it holds the capped day and the once-a-day `storefail` push.

**Store calls.**

- All store calls go through Upstash's REST API with `fetch` and `Authorization: Bearer`. No package is added.
- Each call that writes runs its commands as one transaction, through Upstash's `/multi-exec` endpoint, so a key never exists without its expiry. A pipeline is not atomic: one failed command could leave a key that never expires.
- Per turn: the reservation's transaction before the run, then `log.append()` and `telemetry.record()`, one transaction each, after the last chunk.
- Each store call has a time limit of 2 s, and `reserve()` 1 s; each push, 3 s. A slow service never holds a visitor's answer longer than that.
- Turns that never reach the model write nothing to the store: a rejected request, and a refusal at the cap or the monthly limit. They print their `chat_turn` line only. So a flood of bad requests cannot spend the store's budget.

**The store fails.** A store error never breaks an answer.

- `reserve()` then allows the turn: Anthropic's $20 is still the hard cap, and refusing every visitor during a store outage is worse.
- `record()` and `append()` resolve, and an `ops_error` line is printed.
- A `storefail` push goes out. Its marker cannot live in a failing store, so each function instance pushes at most once a day.

**A setting is missing in production.** A missing store or ntfy variable keeps answers working, prints `ops_error` with `missing_config` on every turn, and shows as `false` in `/api/status`, so the health checks fail. The setup list puts the API key in last, after the store and the rate limits, so the chat never runs in production without its guards.

| Key | Holds | Expires |
|---|---|---|
| `qlog:<YYYY-MM-DD>` | A list of `QuestionLogEntry` JSON, appended | 00:00 UTC on the 90th day after its day (`EXPIREAT`) |
| `qstats:<YYYY-MM-DD>` | A hash: turns by outcome, model calls, reads, citations, removed markers, the five token counts, errors by code, the summed duration | The same |
| `qslow:<YYYY-MM-DD>` | A sorted set with one member, the day's longest duration (`ZADD GT`) | The same |
| `qcost:<YYYY-MM-DD>`, `qcost:<YYYY-MM>` | The day's cost with open reservations, and the month's settled cost, in millionths of a dollar | The day's with `qstats`; the month's 90 days after the month ends |
| `limit:spend` | When a turn last met Anthropic's limit | 00:00 UTC on the first day of the next month |
| `limit:probe:<YYYY-MM-DDTHH>` | The hour's probe turn is taken | After 2 hours |
| `alert:<kind>:<period>` | An alert went out, or is going out | 10 minutes after it is claimed; the end of its period after a successful push |
| `health:vercel`, `health:github` | The last Vercel health run and its result; when the GitHub check last ran | 7 days |

- `telemetry.record()` prints SPEC-chat's `chat_turn` line to the function log, adds the turn to `qstats` and `qslow`, settles its reservation, adds to the month, and checks the alerts. It holds no question text, `threadId` or IP address.
- The handler test proves the response ends only after these writes. Whether they also finish on Vercel when the visitor stops a turn is a spike check.

**Limit alerts** (rows 115 and 121) are ntfy pushes with priority `urgent`, a title and one line naming the next step:

| Kind | When | At most |
|---|---|---|
| `spend75` | The month's estimate passes 75% of the limit. Example: "Chat at 75% of its $20 limit for October. Raise it in the Anthropic Console, then in src/ops/limits.ts." | Once a month |
| `daycap` | A turn is refused with `DAILY_LIMIT` | Once a day |
| `spendlimit` | A turn meets Anthropic's limit | Once a day |
| `storefail` | A store call fails | Once a day per function instance |
| `health` | A health check fails, or finds that the other did not run | Once a day from the Vercel job; once per run from GitHub, which holds no store token. On a failing day Peter can get one of each |
| `release` | The release check fails | Once per failed release, from GitHub |

- In the server, a push first claims its marker with `SET NX` and a 10-minute expiry. After a successful push, the marker's expiry moves to the end of its period. If the push fails, or the function stops before it finishes, the marker expires in 10 minutes and a later event tries again.
- The Vercel health job tries its push 3 times in the same run, because no later turn retries it. The workflows' push steps also try 3 times.
- Vercel's spend webhook posts to the same topic.
- An alert holds no visitor text. The topic name is a secret: anyone who knows it can read and send to it.
- ntfy.sh allows 250 messages a day from one address, and Vercel's and GitHub's addresses are shared with other users. The alerts are few, so this is an accepted risk; a refused push prints `ops_error`, and the runbooks list where else each signal shows.

**The status route.**

- `GET /api/status` returns, with `no-store`, booleans and times only:
  - the live commit (`VERCEL_GIT_COMMIT_SHA`);
  - whether the store, the alerts and the real model are configured;
  - when the Vercel health job last ran, and whether it passed;
  - when the GitHub check last ran.
- It holds no error text and no totals. The commit is public anyway; the repository is public.
- Each function instance keeps the answer for 60 s, so repeated calls do not read the store, and the "api rate limit" rule slows one address.
- `POST /api/status` with `Authorization: Bearer $HEALTH_SECRET` records that the GitHub check ran. Any other `POST` gets 401.

`bun run questions` runs `scripts/questions.ts`, which this module owns. It loads `.secrets/local.env` and reads the last 7 days through `createOpsReader()` with the read-only token. It prints:
- the entries, newest first;
- a count per outcome and the most read sources;
- the daily totals, with the day's and the month's cost against the cap and the limit.

## Smoke check and health checks

`src/ops/smoke.ts` holds the checks. `bun run smoke <origin> [--browser] [--production] [--documents <dir>]` and the Vercel health job both run them. They ask the model nothing, so they cost nothing. Every request sends `x-vercel-skip-toolbar: 1`.

- **Pages.**
  - `/`, `/resume` and one source page return 200 with HTML, a title and the canonical address.
  - `/sources/does-not-exist` and `/API/chat` return 404 with the not-found page.
- **Headers.**
  - Each HTML page carries every header above and its own policy tag, and neither policy has `'unsafe-inline'` or `'unsafe-eval'`.
  - An `/assets/` file and the Workbox file are immutable; `/sw.js` revalidates and has the worker policy; a document has no `Content-Security-Policy`.
- **Chat requests.**
  - `POST /api/chat` with a malformed JSON body and no `Origin` header returns 400 with SPEC-chat's `ChatError` shape.
  - The same with `Origin: https://example.com` returns 403 `FORBIDDEN_ORIGIN`.
- **Status.** `GET /api/status` reports the store and the alerts as configured, in production. The real model is checked only with `--production`, so the release check passes before setup step 12 adds the key.
- **With `--documents <dir>`:** each served document is byte for byte the file in that folder, and the PDF has 2 pages (`pdfinfo`, on the runner).
- **With `--browser`:**
  - Chrome loads `/`, `/resume`, a source page and `/sources/does-not-exist`. It records policy violations, page errors and the service worker's console errors, and fails on any.
  - It fails on any request to `/_serverFn/`.
  - A click from the source page to `/` shows the first view's heading.
  - The chat input becomes usable after hydration.
  - A `fetch` from the page posts a malformed body to `/api/chat` and gets 400. This proves that the page's own origin passes the Origin check.
  - With the network off, a reload of `/` and of the source page still shows them, and an unknown path shows the not-found page.
- **With `--production`:**
  - `GET /api/status` also reports the real model as configured.
  - The three other hosts and the project's `.vercel.app` address return 308 for `/resume?x=1` to `https://peterkloss.dev/resume?x=1`.
  - A chat `POST` with `Content-Type: text/plain` gets the WAF's 403, not the handler's.
  - Then malformed chat requests are sent until one gets 429, which must happen by the 41st.
- **On a protected deployment URL:** requests carry `x-vercel-protection-bypass` from `VERCEL_AUTOMATION_BYPASS_SECRET`, and the browser also sends `x-vercel-set-bypass-cookie: true`, so the service worker's own requests pass too.

The two health checks watch each other (row 122). Vercel Cron and GitHub's schedules are both best effort, so each check allows the other 50 hours, two daily runs:

| Check | Runs | Checks | On failure |
|---|---|---|---|
| Vercel health job: `GET /api/cron/health` with `Authorization: Bearer $CRON_SECRET` | Vercel Cron, daily at 15:17 UTC | The smoke check without `--browser`, `--production` or `--documents`, against peterkloss.dev. Yesterday's totals, which fail when at least 5 turns reached the model and 1 in 5 or more ended in `error`, or when any turn ended in `limit`. That the GitHub check last ran less than 50 hours ago | One ntfy push a day, tried 3 times; the run is saved in `health:vercel` |
| GitHub health check: `.github/workflows/health.yml` | GitHub schedule, daily at 21:17 UTC, and by hand | It reads the live commit from `/api/status`, checks that it is an ancestor of `main`, and checks it out. Then it runs that commit's smoke check with `--browser --production --documents documents/` from outside Vercel. That `/api/status` shows a passing Vercel run less than 50 hours old. That `scripts/site-changed.sh <live commit> origin/main` exits 0, or that the newest site change on `main` is less than 2 hours old. At the end, pass or fail, it records that it ran | An ntfy push from the workflow, tried 3 times |

- The GitHub check uses the live commit's documents and smoke check, so a release still in its checks never makes it fail.
- The error share counts only turns that reached the model: `answered`, the refusals, `stopped` and `error`. A turn stopped by `max_tokens` (`errorCode: "MAX_TOKENS"`) does not count as an error there, because it is not an outage; the totals still show it. A thrown run (`errorCode: "SERVER_ERROR"`, SPEC-chat row 155) counts as an error, because it is a fault in the server's own code. Rejected requests and limit refusals are not in the totals.
- GitHub stops a schedule after 60 days with no repository activity; the Vercel job then reports that the GitHub check has not run. If Vercel itself is down, the GitHub check reports it. The runbook covers turning a schedule back on.

## CI

`.github/workflows/ci.yml` runs on every push and pull request, on `ubuntu-24.04` (pinned: `ubuntu-latest` moves to 26.04 in November 2026). Every helper is pinned to an exact commit, and each workflow grants only the permissions it needs (row 120).

- **Job `test`:**
  1. `actions/checkout`, then `oven-sh/setup-bun` with `bun-version: 1.4.4`. Every job uses this Bun.
  2. `sudo apt-get update && sudo apt-get install -y poppler-utils`.
  3. `bun ci`, then `bun run typecheck` (row 157).
  4. `bun run build` (the content module's documents, public only), then `bun run build:site`.
  5. `bun test`, with `CHROME_PATH=/usr/bin/google-chrome`. This includes the document checks.
- **Job `audit`:** `bun audit --prod --audit-level=high`, as its own job, so a registry outage shows as its own failure. Only the production packages decide a release.
- **Job `audit-all`:** `bun audit --audit-level=high` over every package, development tools included. It is not a required check, so an advisory in a test tool shows but does not hold a release.

There is no `private.yaml` in CI, so only public documents are built, and the private-detail tests skip there. They run on Peter's laptop and in agents' sessions, where `private.yaml` exists. The evals never run in CI: each run costs money and needs Peter's approval (SPEC-chat). This replaces the plan's line "CI that … runs the evals".

`.github/workflows/release-check.yml` and `.github/workflows/health.yml` are described above. GitHub's helpers run on GitHub's own Node.js; no code in this repository does (row 120).

## Secrets and settings

| Name | Where | Value from |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel, Production, Secret | Service-account key for `resume-chat`; added last |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel, Production only | The Upstash integration |
| `NTFY_TOPIC_URL` | Vercel, Production, Secret; Actions secret | `https://ntfy.sh/` plus a long random topic name |
| `CRON_SECRET` | Vercel, Production, Secret | A long random value |
| `HEALTH_SECRET` | Vercel, Production, Secret; Actions secret | A long random value |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Actions secret | Vercel, Deployment Protection |
| `KV_REST_API_URL`, `KV_REST_API_READ_ONLY_TOKEN`, `ANTHROPIC_API_KEY` (evals) | Peter's untracked `.secrets/local.env` | The Upstash console; the `resume-evals` key |

- Bun loads `.env`, `.env.local` and `.env.<NODE_ENV>` (`.env.test` under `bun test`) into a run on its own. So the local file is `.secrets/local.env`, which Bun loads only when told: `bun run questions` and `bun run evals` pass `--env-file=.secrets/local.env`, and nothing else does.
- No file named `.env` or `.env.*` is ever created. `.gitignore` gains `.secrets/`, `.env*` and `.vercel/`. A test fails when any `.env*` file exists in the checkout. The plan checks whether `bunfig.toml` can also turn the automatic loading off.
- GitHub holds no store token.
- Agents never read, print or store a value from this table.

## Setup list

Peter does these steps once, in this order, so that the chat never runs in production before its guards. The plan turns them into `docs/runbooks/setup.md` with links, and each step names how to check it.

1. Buy peterkloss.dev, pkloss.dev and pwk.dev (decision 0018).
2. ntfy: install the app on his phone; subscribe to a long random topic name; send a test push.
3. Anthropic Console: workspaces `resume-chat` ($20 a month, email at $10) and `resume-evals` ($5); a service-account key for each, kept aside for now.
4. Vercel: sign up for Pro, and import `loriensleafs/resume` with the variables `NTFY_TOPIC_URL`, `CRON_SECRET` and `HEALTH_SECRET` (Production). Previews need no variable: `VERCEL_ENV` picks the fake model. There is no Anthropic key yet, so the first deployment cannot call the model. Keep Fluid compute on.
5. Vercel, project settings: turn the Vercel Toolbar off for production. Deployment Protection: Standard Protection with Vercel Authentication; create an automation bypass secret.
6. Vercel, Marketplace: add Upstash Redis, pay as you go, with a $1 budget; attach its variables to Production only.
7. Vercel, Firewall: the three WAF rules.
8. Vercel, Spend Management: a $20 budget with the webhook set to the ntfy topic URL. Check that the "Pause production deployment" switch is off. Vercel's docs say production pauses only when that switch is on; the third review read a changelog as saying it can start on, so the step checks it.
9. GitHub, Actions secrets: the Actions rows of the table above.
10. Vercel, Deployment Checks: require `ci / test`, `ci / audit` and the release check's status, by the name its first run shows. Check that domain auto-assignment is on.
11. Vercel, Domains: add peterkloss.dev, www.peterkloss.dev, pkloss.dev and pwk.dev, all served by the project. An agent writes the project's `.vercel.app` address into `src/deploy/routes.ts`; its push is a release.
12. Vercel, Environment Variables: add `ANTHROPIC_API_KEY` (Production, Secret). Then Redeploy the newest production deployment with "Use project's Ignore Build Step" unchecked. With the box checked, the ignore step sees no change and the redeploy does nothing.
13. Check: `/api/status` reports everything configured; run both health checks by hand once; ask the live chat one question.

## Runbooks

`docs/runbooks/` has one file per alert, each with what it means, the first thing to check and the fix:

- **`spend-75.md`:** `bun run questions` shows which days spent. Raise the limit in the Anthropic Console and in `src/ops/limits.ts`, or leave it.
- **`day-cap.md`:** the chat is paused until 00:00 UTC. `bun run questions` shows whether the spend looks real or scripted. Raise the cap in `src/ops/limits.ts` (a release) only if it is real.
- **`spend-limit.md`:** the chat is paused for the month. Raise the limit in the Console, where it takes effect at once; the chat tries again within an hour. Then update `src/ops/limits.ts`.
- **`store-failed.md`:** the Upstash console shows whether the budget or an outage caused it. The chat keeps answering, with Anthropic's limit as the cap.
- **`health-failed.md`:** which check failed:
  - a page, header or policy failure points at the last release: roll back;
  - `missing_config` points at the environment variables;
  - an error share points at `bun run questions` and its errors by code;
  - a lagging live commit points at a skipped build (Redeploy without the ignore step) or at domain auto-assignment;
  - a check that has not run points at its schedule, and how to turn it back on.
- **`release-failed.md`:** the workflow run names the failed step: CI, the audit, the smoke check or the superseded rule. A superseded deployment needs nothing.
- **`vercel-spend.md`:** the usage page shows the cost; the WAF's traffic view shows abuse.
- **`rollback.md`:** the rollback steps above, ending with "Undo Rollback" on the fix's deployment.

## Deploy spike

The plan's first task, before any production code. A local build cannot answer these questions; a throwaway deployment can.

- **Setup.** Peter creates a second Vercel project in his Pro team from the branch `prototype/deploy-spike`, with no domains and no Anthropic key, and a pay-as-you-go Upstash database for it. The spike costs cents beyond the Pro plan.
- **Approval.** Each push to that project deploys. Its pushes follow [AGENTS.md](../AGENTS.md), "Releases and approvals" (row 151), and each runs the `release` skill's step 1 first.
- **Throwaway.** The spike code stays on its branch (brain's prototype rules); its verdicts go into research 12 and, where they change a rule, into this spec. Peter removes the project afterwards.

| # | Check | If it fails |
|---|---|---|
| 1 | Which Bun runs the build, and whether `bunVersion` decides it | The install command installs 1.4.2 (see Configuration in code) |
| 2 | Vercel serves the `.vercel/output` the build wrote: the post-build routes, the `overrides` for clean addresses and the cron. Which Bun runs the functions (`Bun.version`): with `runtime: "bun1.4.x"`, or with Nitro's documented `"bun1.x"` and `bunVersion: "1.4.x"` | The routes move to the form Vercel accepts; the runtime value is the one that gives Bun 1.4 |
| 3 | An unknown path and `/API/chat` get `/404.html` with status 404; `/sources/x` with no file is not rendered by a function | As 2 |
| 4 | How route headers merge: the worker files get one policy; the documents get no policy; headers reach function responses and the not-found page | The header routes change, so each path gets exactly one policy |
| 5 | A host redirect route keeps the query string in `Location` | The route adds the query itself |
| 6 | Vercel Cron reaches `/api/cron/health` under Standard Protection, and which host it calls | The health job's host rule changes |
| 7 | The store writes after the last chunk finish when the visitor stops a turn | Use Vercel's `waitUntil` from `@vercel/functions`, a new package for Peter's approval |
| 8 | The WAF path condition's case handling, and the content-type condition | The rules change |
| 9 | Upstash: the read-only token runs `LRANGE`, `HGETALL` and `ZRANGE`; `/multi-exec` runs the reservation with `EXPIREAT` | The reader or the transaction changes |
| 10 | Chrome's PDF viewer shows the PDF with the site's headers | The documents' headers change |
| 11 | The Vercel Toolbar is off for production, and `x-vercel-skip-toolbar` keeps it off on deployment URLs | The policy allows nothing more; the checks fail instead |
| 12 | The status helper's name, and that Deployment Checks hold the domains until it passes | Setup step 10 changes |

## Changes to other specs

Approving this spec approves these amendments:

- **SPEC-chat.**
  1. `ChatDeps` gains `budget: Budget` and `telemetry: Telemetry`. SPEC-chat defines both types next to `QuestionLog`, and this module implements them. The handler:
     - calls `budget.reserve()` before the first model call, and on refusal answers with the limit stream (below);
     - hands each `ChatTurnEvent` and its reservation to `telemetry.record()` instead of printing them.
     Tests pass in-memory ones.
  2. `turnLimits` gains `historyCharacters: 40_000` (earlier turns, oldest dropped first) and `requestBytes: 262_144` (413 `REQUEST_TOO_LARGE`); `questionCharacters` stays 10,000 (row 125).
  3. `ChatError.code` gains `REQUEST_TOO_LARGE` and `FORBIDDEN_ORIGIN`.
  4. Limits:
     - a refusal by `budget.reserve()` is an HTTP 200 stream with one `RUN_ERROR` event and the code `DAILY_LIMIT` or `SPEND_LIMIT`;
     - the handler finds `SPEND_LIMIT` from the Anthropic error's status and body, as above, and ends the stream with that code;
     - `ChatTurnEvent.outcome` gains `limit`, and `errorCode` gains `DAILY_LIMIT`, `SPEND_LIMIT` and `MAX_TOKENS` (SPEC-chat's row 155 later added `SERVER_ERROR`, for a thrown run);
     - the saved answer's outcome and `QuestionLogEntry.outcome` gain `limit`; a turn refused before the model call writes no question-log entry;
     - the views gain the "limit reached" state, and the question queue pauses on it.
  5. Usage:
     - `ChatTurnEvent` gains `cacheWriteTokens` and `cacheWrite1hTokens`, and `inputTokens` means uncached input only;
     - telemetry sums `onUsage` across the turn's finished model calls; the token counts are `null` when no call finished;
     - a turn whose last model call did not finish (stopped, `DEADLINE`, `MAX_TOKENS` or a broken stream), and a turn with no usage, keep their whole reservation.
  6. The route sets `promptCache: "short"` explicitly.
  7. The 429 text becomes "Try again in a few minutes".
  8. `bun run questions` (`scripts/questions.ts`) moves to this spec, which owns `createOpsReader()`. It also prints the daily totals and the day's and the month's cost. `QuestionLog` keeps `append(entry)` and `list(days)`, and the reader also uses `list(days)`.
  9. Origin: in production, the handler accepts a request whose `Origin` header is `https://peterkloss.dev` or the deployment's own address (`https://$VERCEL_URL`); elsewhere, the request's own origin. Any other origin gets 403 `FORBIDDEN_ORIGIN`, so other sites' pages cannot spend the chat's budget through their visitors' browsers. A request with no `Origin` header passes this check; the rate limits and the cap still apply to it.
  10. The handler test proves the response ends only after the log and telemetry writes.
  11. `VERCEL_ENV` alone picks the model: when it is not `production`, the route always uses the fake model. No other variable switches it.
  12. The evals key lives in `.secrets/local.env`, not `.env`.
  13. The read budget keeps `read_sources` in the tool list after the third read and skips a fourth call with an error result, so the cached tool list never changes within a turn. The handler test "the next model call has no `read_sources` tool" becomes "the next model call has the same tools, and a fourth read is skipped".
- **SPEC-site.**
  1. `bun run build:site` writes Nitro's Vercel output, `.vercel/output/`, in every environment. The pages land in `.vercel/output/static/`, which replaces `dist/client/`.
  2. Loaders get their data at build time, not from a server function at request time, so a click between pages needs no server, online or offline. A Vite module made at build time holds the public data the pages need, never `Not public` text, as the device index does. The browser test fails on any request to `/_serverFn/`, and it clicks between pages with the network off.
  3. `buildSite()` writes the static not-found page `404.html`, with no script, and copies `documents/` instead of building documents. It writes no policy tag and no routes: `scripts/build-site.ts`, which this module owns, runs `buildSite()`, then this module's `addPolicyTags(staticDir)`, then the site's `writeServiceWorker(staticDir)`, then this module's `writeVercelConfig(outputDir)` (see "The build script").
  4. Prerendered HTML holds no `style` attribute. Prerendered Markdown renders with `@tanstack/markdown/react`, and its `components` option for `th` and `td` turns a column's alignment into a class.
  5. `/sources/<unknown id>` gets the not-found page with status 404. It shows "Page not found" with links to the chat and to the resume, and has no script. An unknown id in a query (`?source=`, `?role=`) still gives the first view.
  6. The service worker tries the network first for a navigation that is not precached, and shows the not-found page only when the network fails. Workbox's `navigateFallback` alone would show the not-found page for such a navigation also online, for example for a source page that a release has just added (research 12). `/api/` is never a navigation fallback. The worker's registration moves from an inline script to a file.
  7. `bun run preview` serves a built `.vercel/output/`, and `bun run preview --dir <folder>` serves the one in that folder. It serves the static files with the routes, headers, overrides and status codes of that output's `config.json`, as Vercel does, and answers the API routes as SPEC-chat's preview does. The browser test and the smoke test build first into the seam-1 folder and serve it with `--dir`.
  8. The site's font files are committed.
- **SPEC-content.**
  - `bun run documents` (`scripts/documents.ts`) writes the public documents to `documents/`, with `documents/inputs.sha256`; the document test above checks them. SPEC-content lists the script, the folder and the test, and defines the hash's inputs.
  - The line "`bun run build --public` (the website and CI use this)" changes: the website uses the committed `documents/`, and CI runs `bun run build` to check that the documents still build.
- **SPEC-agents** (approved 2026-10-27, row 142) carries these into `AGENTS.md`:
  - AGENTS.md: a push that changes a site file (a path not in `scripts/docs-only.txt`) is a release, and its "Releases and approvals" says which pushes need Peter (row 151).
  - AGENTS.md, Verify: `bun run typecheck`, `bun run build`, `bun run build:site` and `bun test` before every commit.
  - `bun run smoke`, `bun run documents` and the runbooks join the commands.
  - The edit-resume skill runs `bun run documents` and checks the committed PDF's page count.

## Tech Stack

- Vercel Pro, Bun runtime `1.4.x` (Beta), Fluid compute, Vercel Cron, and Nitro's Vercel output from TanStack Start, with the routes written by `writeVercelConfig()` ([decision 0012](../docs/decisions/0012-vercel-pro-host.md), research 12).
- Upstash Redis through its REST API with `fetch` ([decision 0022](../docs/decisions/0022-question-log-store.md)).
- ntfy.sh, called with `fetch`.
- GitHub Actions, each pinned to an exact commit: `actions/checkout`, `oven-sh/setup-bun`, `vercel/repository-dispatch/actions/status`.
- Playwright, already in the stack for the browser test, drives the smoke check's `--browser` part.

No npm package is added. Approving this spec approves the three GitHub helpers and the two outside services.

## Commands

```sh
bun run documents                        # rebuilds documents/ when its inputs changed (needs Chrome)
bun run build:site                       # scripts/build-site.ts: .vercel/output/ with pages and functions, the device index, policy tags, service worker, routes
bun run preview                          # serves .vercel/output/ as Vercel does
bun run build:site --out <folder>        # the same build into <folder>/.vercel/output/; the tests' seam-1 folder
bun run preview --dir <folder>           # serves the .vercel/output/ in <folder>; the tests pass the seam-1 folder
bun run smoke http://localhost:4173 --browser --documents documents/   # against the preview
bun run smoke https://peterkloss.dev --browser --production --documents documents/   # the outside check by hand
bun run questions                        # entries, daily totals and costs; loads .secrets/local.env
bun test src/ops                       # seam 2
bun test                                 # every test
```

## Project Structure

```text
vercel.json                        bunVersion, install, build and ignore commands
documents/                         Peter-Kloss-Resume.pdf, .docx, .txt and inputs.sha256: the committed public documents (SPEC-content's)
scripts/docs-only.txt              the paths that never change the live site
scripts/site-changed.sh            exit 1 when a site file differs between two commits
scripts/ignore-build.sh            Vercel's ignore step: skips only when no site file changed
scripts/documents.ts               `bun run documents` (SPEC-content's)
scripts/smoke.ts                   `bun run smoke`
scripts/questions.ts               `bun run questions`: the question log, the daily totals and the costs, through createOpsReader()
scripts/build-site.ts              `bun run build:site`: the build script, the composition root of the five build steps
src/deploy/routes.ts               writeVercelConfig(outputDir): the redirects, headers, policies, cache rules, API routes, the not-found route, the cron
src/deploy/policy.ts               addPolicyTags(staticDir): each HTML file's policy tag and its script hashes
src/ops/ops.ts                     createOps(), createOpsReader()
src/ops/upstash.ts                 the REST calls, the transactions, the key layout and the expiry rules
src/ops/alerts.ts                  the alert rules, the markers and the ntfy push
src/ops/limits.ts                  the size caps' worst-case turn, the reservation, the daily cap, the monthly limit, the 75% threshold, the prices
src/ops/smoke.ts                   the checks shared by `bun run smoke` and the Vercel health job
src/site/routes/api.status.ts      GET and POST /api/status
src/site/routes/api.cron.health.ts the Vercel health job
.github/workflows/ci.yml           jobs test, audit and audit-all
.github/workflows/release-check.yml the release check
.github/workflows/health.yml       the outside health check
docs/runbooks/                     setup, rollback and one file per alert
src/ops/__tests__/ops.test.ts      seam 2
src/ops/__tests__/fake-upstash.ts  an in-test Upstash REST server for the commands and the transactions the module uses
src/ops/__tests__/fake-ntfy.ts     an in-test ntfy server that records pushes
src/deploy/__tests__/config.test.ts  vercel.json, the Vercel output, the policy tags (seam 1)
scripts/__tests__/docs-only.test.ts  the docs-only list and the three shell scripts (seam 1)
scripts/__tests__/smoke.test.ts    the smoke check against the preview (seam 3)
scripts/__tests__/documents.test.ts  the committed documents (SPEC-content's)
```

## Code Style

The same as [SPEC-site](SPEC-site.md). Everything outside the process comes in through arguments, so tests pass fake servers and a fixed clock:

```ts
const ops = createOps(
  { VERCEL_ENV: "production", KV_REST_API_URL: upstash.url, KV_REST_API_TOKEN: "test", NTFY_TOPIC_URL: `${ntfy.url}/t` },
  { now: () => new Date("2026-10-27T12:00:00Z") },
);
const tickets = await Promise.all(Array.from({ length: 25 }, () => ops.budget.reserve()));
expect(tickets.filter((t) => t.ok)).toHaveLength(8); // 8 × $0.90 = $7.20; a ninth would pass the $8 cap
```

## Testing Strategy

`bun test`, at the three seams Peter confirmed on 2026-10-27 (row 117). No test calls Upstash, ntfy, Anthropic, GitHub or Vercel.

1. **The site seam, extended** ([SPEC-site](SPEC-site.md) seams 1 and 2):
   - `src/deploy/__tests__/config.test.ts` reads `vercel.json` and the build's `.vercel/output/`:
     - `vercel.json` holds only the build settings, and `bunVersion` is `1.4.x`;
     - every function's `.vc-config.json` has the runtime value that spike check 2 settled; the chat's has `maxDuration: 150` and region `iad1`;
     - only the three API paths reach a function, each route is case-sensitive, and no route sends anything else to `/__server`;
     - the four hosts redirect with 308 to peterkloss.dev with the path, and the `.vercel.app` route leaves `/api/` alone;
     - every header in the tables is set for its paths; the worker files get the worker policy; the documents get no policy;
     - every prerendered page has an override for its clean address, and the last route sends every other path to `/404.html` with status 404;
     - the cron calls `/api/cron/health`;
     - each HTML file, the not-found page included, starts with a policy tag that lists exactly the hashes of its own inline scripts;
     - no built page holds a `style=` attribute.
   - `scripts/__tests__/docs-only.test.ts`:
     - every entry matches a tracked file, and no entry matches a file the site build reads;
     - `scripts/site-changed.sh` and `scripts/ignore-build.sh`, run in a temporary git repository with a shallow clone:
       - they build for a change to a site file, also when the previous deployment is more than 10 commits back;
       - they skip a docs-only change across several commits;
       - they build on an empty previous commit, on an unknown commit and on a failing git command.
   - The browser test builds first into the seam-1 folder and runs against `bun run preview --dir <folder>`. It fails on any policy violation, page error or service-worker console error, and on any request to `/_serverFn/`, on every page it visits. It clicks between pages online and offline, and loads an unknown path offline.
   - `scripts/__tests__/documents.test.ts`: the checks in "Documents".
   - A test fails when any `.env*` file exists in the checkout.
2. **The ops module**, `src/ops/__tests__/ops.test.ts`, through `createOps()` and `createOpsReader()`, against the in-test Upstash and ntfy servers and a fixed clock:
   - **Log and contract.**
     - SPEC-chat's QuestionLog contract suite, `src/chat/server/__tests__/question-log-contract.ts`, passes against both the in-memory log and the Upstash one. The suite fixes the day window of `list(days)`.
     - An entry appended through `log.append()` comes back from the reader's `list(7)`.
     - A day's keys expire at 00:00 UTC on the 90th day after it, and each write's commands arrive as one transaction.
   - **Totals and cost.**
     - `record()` adds a turn to the day's totals; `totals(1)` shows the outcome counts, the five token counts and the longest duration.
     - A turn with known token counts, 1-hour writes among them, adds the worked example's cost from `limits.ts`, counted by hand.
     - A turn with `null` token counts keeps its whole reservation.
     - A turn with one finished model call and a second one that did not finish keeps its whole reservation, and the totals show the first call's tokens only. The test runs this for a stopped turn and for a `DEADLINE` turn.
     - A rejected turn and a limit refusal write nothing to the store.
   - **Daily cap.**
     - 25 parallel `reserve()` calls on an empty day: 8 succeed and 17 refuse with `DAILY_LIMIT`.
     - After the first refusal, the same instance refuses that day with no store call.
     - Settling a reservation with a smaller real cost frees room for another turn.
     - One `daycap` push that day; the next UTC day allows turns again.
     - The worked worst-case turn in `limits.ts` costs less than the reservation.
   - **Monthly limit.**
     - After a `SPEND_LIMIT` turn, `reserve()` refuses with `SPEND_LIMIT` for an hour, then lets exactly one probe through.
     - A probe that reaches the model clears the marker; one that meets the limit resets its time.
     - One `spendlimit` push that day.
   - **Alerts.**
     - The month's estimate crosses 75%: one `spend75` push, and none again that month.
     - A push that fails leaves a marker that expires in 10 minutes; a later event pushes again.
     - A push body holds no question text.
   - **Store failures.**
     - With the Upstash server returning 500: `reserve()` allows the turn, `record()` and `append()` resolve, an `ops_error` line is printed, and the instance pushes `storefail` once that day.
     - With the Upstash server holding every response: `reserve()` allows the turn within about 1 s, and `record()` resolves within about 2 s.
   - **Health and status.**
     - `health.markGithubRun()` and `health.save()` show in `health.last()` and in `status()`, which holds booleans and times only.
     - `status()` reports a missing ntfy variable as `false`, and prints `missing_config`.
   - **Guards.**
     - With `VERCEL_ENV` `preview` and store variables present: no server is called.
     - The reader with the read-only token makes no write command.
3. **The smoke check**, `scripts/__tests__/smoke.test.ts`:
   - The test builds first into the seam-1 folder and serves it with `bun run preview --dir <folder>`. `bun run smoke <preview origin> --browser --documents documents/` against it passes.
   - It fails, naming the cause:
     - when one header is removed;
     - when a page has an unhashed inline script;
     - when an HTML file has no policy tag;
     - when a page requests `/_serverFn/`;
     - when a served document differs from the committed one.
   - The Vercel health job's checks fail and name the error share when run against the preview and the fake Upstash holding a day of 10 turns with 3 errors; a day with 3 `MAX_TOKENS` turns and no other error passes.
   - A GitHub run 50 hours old or older fails the job; one 30 hours old passes.

The real platform is checked by the deploy spike, by the release check, by the two health checks and by step 13 of the setup list.

## Boundaries

- **Always:**
  - keep every setting that Vercel reads from the repository in the repository;
  - keep previews and local runs on the fake model and the in-memory store, by code;
  - commit a resume change together with its rebuilt documents;
  - treat a failed store or push call as a printed `ops_error`, never as a failed answer;
  - run `bun run typecheck`, `bun run build`, `bun run build:site` and `bun test` before a commit.
- **Ask first:**
  - changing `scripts/docs-only.txt`;
  - a change to a limit, the cap, the reservation, a size cap, a header, the policy, a route, a redirect, a WAF rule or a cache rule;
  - a new outside service, GitHub helper or package;
  - a change to the key layout or to what an alert says;
  - allowing inline style attributes.
- **Never:**
  - sign in to a dashboard; buy, upgrade or change a plan;
  - read, print or commit a key, token, secret or topic name; create a `.env` file;
  - promote a deployment by hand, or turn off a Deployment Check or domain auto-assignment;
  - put visitor text, an IP address or a `threadId` in an alert, a total, a status or a log line;
  - add `'unsafe-inline'` or `'unsafe-eval'` to a policy;
  - route a page or a server function to a function at request time;
  - let a preview reach the real model or the real store;
  - add Node or Python tooling to this repository.

## User Stories

1. As a recruiter, I want peterkloss.dev to load fast and safely over HTTPS, so that the link I was sent looks trustworthy.
2. As a visitor who types pkloss.dev or pwk.dev, I want to land on the same page at peterkloss.dev, so that a short address works.
3. As a visitor with a shared link to a source page, I want the redirect to keep the path and query, so that I see the page I was sent.
4. As a visitor on a slow connection, I want hashed files cached for a year and pages revalidated, so that repeat visits are fast and never stale.
5. As a visitor clicking from page to page, online or offline, I want every page to show its content, so that no click leads to an empty page.
6. As a visitor with a mistyped link, I want a clear "Page not found" with links to the chat and the resume, so that I can go on.
7. As a visitor who asks many questions, I want the rate limit high enough that I never see it, so that a long conversation is not cut off.
8. As a visitor in a busy office on one network, I want the limit to be generous, so that colleagues do not block each other.
9. As a hiring manager, I want to paste a whole job description and ask follow-ups about it, so that the fit check sees the full posting.
10. As a visitor when the day's or the month's budget is spent, I want a clear message with Peter's email and the resume, also after a reload, so that I can still reach him.
11. As a visitor, I want the site to load no third-party code, so that my visit is private and an injected script cannot run.
12. As a visitor, I want the site never shown inside another site's frame, so that nobody can dress it up as something else.
13. As a visitor downloading the PDF, I want the same 2-page file that was tested, opening in my browser's viewer, so that it prints as Peter intended.
14. As Peter, I want every release to pass CI, the audit and a smoke check in Chrome on the real deployment before it goes live, so that a broken build never reaches a recruiter.
15. As Peter, I want a push when a release fails its checks, so that I know the site did not change.
16. As Peter, I want an older deployment never to replace a newer one, so that two quick pushes cannot roll the site back.
17. As Peter, I want docs-only pushes to build nothing, and one list that says what counts, so that writing specs never touches the live site.
18. As Peter, I want an error in the ignore step to build rather than skip, so that a release is never lost quietly.
19. As Peter, I want a one-click rollback with written steps, so that I recover in seconds.
20. As Peter, I want previews that cost nothing and cannot expose the key, enforced in code, so that branches are safe to push.
21. As Peter, I want a daily cap that holds under parallel requests, so that one script cannot spend the whole month in an hour during my job search.
22. As Peter, I want a cap on how much text one request can send, so that a forged conversation cannot cost dollars.
23. As Peter, I want prompt caching on, and a tool list that never changes within a turn, so that the core and a pasted posting cost full price only once.
24. As Peter, I want a stopped or cut-off answer to keep its whole reservation, so that the cap and the estimates are never too low.
25. As Peter, I want a push when the daily cap is reached, so that I can tell a real busy day from abuse.
26. As Peter, I want a push on my phone when the chat passes 75% of its monthly budget, so that I can raise it before visitors hit the limit.
27. As Peter, I want a push when the monthly limit is reached, the chat to stop calling Anthropic, and the chat to work again within an hour after I raise the limit, so that I know, no call is wasted, and recovery needs no release.
28. As Peter, I want a push when the store fails, so that I know the totals and the cap are blind.
29. As Peter, I want a slow store or push service never to delay an answer by more than a few seconds, so that visitors do not wait on my monitoring.
30. As Peter, I want two health checks that watch each other, and that allow one missed run, so that neither can stop quietly and a late run does not wake me.
31. As Peter, I want a health check to fail when a setting is missing, so that a misconfigured production does not run for days.
32. As Peter, I want a health check to fail when the live site lags `main`'s site changes, so that a skipped build or a rollback I forgot is caught.
33. As Peter, I want alerts at most once a day for each kind, and a failed push tried again, so that my phone is not flooded and no alert is lost.
34. As Peter, I want daily totals of outcomes, tokens and errors for 90 days, so that I see trends in cost and failures.
35. As Peter, I want a cost estimate that counts cache writes, so that the 75% push and the daily cap fire on time.
36. As Peter, I want `bun run questions` to show the day's and the month's cost against the cap and the limit, so that I can plan.
37. As Peter, I want the question log deleted by the store itself, so that the 90-day promise to visitors holds without a job to maintain.
38. As Peter, I want only my laptop to hold a store token outside Vercel, and only the read-only one, so that a leak cannot change or delete the log.
39. As Peter, I want my local keys in a file Bun never loads on its own, so that tests never reach a real service.
40. As Peter, I want the store and the alerts to cost cents a month, and bad requests to write nothing to the store, so that the site stays cheap.
41. As Peter, I want a hard $20 cap on the model bill, so that abuse cannot cost more.
42. As Peter, I want Vercel's spend to notify me and never take the site down, so that a recruiter never finds it paused.
43. As Peter, I want the evals on their own workspace and limit, so that my testing never spends the visitors' budget.
44. As Peter, I want a numbered setup list that adds the key last, so that the chat never runs in production without its guards.
45. As Peter, I want a runbook for every alert, so that I know the first thing to do when my phone buzzes.
46. As Peter, I want the platform questions answered by a throwaway deployment first, so that the real one is built on facts.
47. As Peter, I want CI on a pinned image with Bun 1.4.4, Chrome and poppler, and pinned helpers, so that nothing changes under me.
48. As Peter, I want no Node or Python tooling in this repository, so that it stays pure Bun.
49. As an engineer reviewing the repository, I want the platform settings, the routes and the workflows in code, so that I can read how the site is run.
50. As an engineer reviewing the repository, I want the strict policy, its probes and its checks on the real deployment on record, so that I see the security work.
51. As an attacker, I should not be able to post to the chat from another site's page and spend its budget through visitors' browsers.
52. As an attacker with a script, I should be slowed at about 20 questions per 10 minutes per address, held to the size caps, stopped at $8 a day, and capped at $20 a month, also when I change the case of the path.
53. As an attacker hammering the status route, I should hit its rate limit, and never reach the store more than once a minute per function instance.
54. As an attacker who learns the ntfy topic, I should find no visitor data in the alerts.
55. As a future agent, I want tests that name the broken header, route, alert rule, expiry, reservation or document, so that I fix the cause.
56. As a future agent, I want the release rule in AGENTS.md and one list of docs-only paths, so that I know which pushes are releases.

## Out of scope

- Buying the domains, signing up and paying: Peter does these (setup list).
- Rolling Releases: the traffic is too low to compare a canary (row 107).
- A real text message (Twilio), log drains, outside log or uptime services, and Vercel's anomaly alerts (rows 110, 115, 121).
- A 1-hour prompt cache, until the totals show it would save money.
- A second region, a staging environment, Terraform for the WAF rules, bot protection rules, and HSTS preload submission.
- Building documents on Vercel (row 119), and evals in CI (SPEC-chat).
- What one question-log entry holds and how the chat writes it: [SPEC-chat](SPEC-chat.md).
- The pages, their data, the service worker's precache and the offline behavior: [SPEC-site](SPEC-site.md), with the amendments above.

## Prior-art tests

- `src/__tests__/build.test.ts`: runs the real entry point into a temporary folder and checks the real files, the PDF's text (`pdftotext`), the Word file's text (`unzip -p`) and the fonts. `src/deploy/__tests__/config.test.ts` and `scripts/__tests__/documents.test.ts` work the same way.
- `src/site/__tests__/browser.test.ts` from SPEC-site: Playwright under Bun against the preview. Seam 1 adds the policy-violation and `/_serverFn/` checks, and the smoke check's `--browser` part reuses them.
- The probes on the branch `prototype/csp-probe`: `prototypes/csp-probe/csp-test.ts` (the `securitypolicyviolation` listener and the per-page hashes), `prototypes/csp-probe-2/` (the split policy, the not-found page, the offline fallback and the client-navigation check), and `prototypes/nitro-vercel-output/` (what Nitro's Vercel preset writes).
- SPEC-chat's QuestionLog contract suite, `src/chat/server/__tests__/question-log-contract.ts`, with its exact day window. Seam 2 runs it against the in-memory log and the Upstash one.

## Success Criteria

- `bun test` passes on a clean checkout with Chrome and poppler installed, no `.secrets/` and no network beyond the tests' own servers.
- The deploy spike's 12 checks have verdicts in research 12, and this spec matches them.
- After the setup list:
  - a push of a site change goes live only after the three checks pass;
  - a docs-only push builds nothing;
  - both health checks pass by hand;
  - `/api/status` reports everything configured.
- A health run against a failing target reaches Peter's phone.
- Peter reviews the setup list and the runbooks and approves them.

## Open Questions

None for this spec. The platform questions are the deploy spike's checks. The "limit reached" texts, the 429 text and the not-found page's text are approved (row 138).
