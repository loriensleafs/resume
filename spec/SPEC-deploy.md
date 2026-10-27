# Spec: deploy

Draft for Peter's review, 2026-10-27. Peter's answers are rows 107 to 122 of the [interview record](../docs/design/interview-2026-10-26.md); the facts are in [research 12](../docs/research/12-deploy-platform.md). An adversarial review of the first draft found 18 issues; this draft answers all of them (row 118).

## Objective

Put the site and the chat on the internet at `https://peterkloss.dev`, and keep them safe, cheap and observable without Peter watching them. The site serves recruiters, hiring managers and engineers during Peter's job search, when traffic is higher than usual (row 114), so a quiet failure or a spent limit must reach Peter at once.

This module owns: the Vercel project's configuration in code, the domains and redirects, the security and cache headers, the rate limit, the spend limits and the daily cap, the question log's store, the daily totals, the limit alerts, the status route, the smoke check, the two health checks, CI, the setup list Peter follows in the dashboards, and the runbooks. It implements SPEC-chat's `QuestionLog` and receives its turn telemetry.

Acceptance criteria:

- A push of site changes to `main` goes live on peterkloss.dev only after CI and the smoke check on the new deployment pass (row 107). A push with no site changes builds nothing and changes nothing live.
- Previews use the fake model, hold no API key and write nothing to the store (row 108), and code enforces it, not only the dashboard.
- pkloss.dev, pwk.dev, www.peterkloss.dev and the project's public `.vercel.app` address answer with a 308 to the same path and query on peterkloss.dev ([decision 0018](../docs/decisions/0018-domains.md)).
- Every HTML response enforces the Content Security Policy below, with no `'unsafe-inline'` and no `'unsafe-eval'`, and Chrome reports no violation on the real deployment, online and offline.
- One internet address can send about 20 chat questions in 10 minutes (row 112). A burst at a window's edge can pass up to 40, and counters are kept per region.
- The chat stops at $8 of estimated cost a day until 00:00 UTC (row 121), and at Anthropic's $20 a month (row 113). At either limit, visitors see a "limit reached" state, not a retry (row 114).
- Question-log entries and daily totals are deleted by the store itself, at the latest 90 days after their day ([decision 0022](../docs/decisions/0022-question-log-store.md)).
- Peter's phone gets an urgent push when the month's estimated chat cost passes 75% of the limit, when the daily cap or the monthly limit is reached, when a health check fails, and when one health check finds that the other did not run (rows 115, 121, 122).
- The documents visitors download are the committed, tested files, and the PDF has exactly 2 pages (row 119).
- `bun test` passes with no account, key or network beyond the tests' own servers.

## What runs where

| Part | Where it runs | Set in code | Set by Peter in a dashboard |
|---|---|---|---|
| Prerendered pages, assets, documents, service worker | Vercel's CDN | `vercel.json`, the Vite and Nitro config | — |
| `/api/chat`, `/api/status`, `/api/cron/health` | Vercel Functions on the Bun runtime, region `iad1` | Nitro `vercel.functionRules`, `vercel.json` `crons` | Environment variables |
| Domains and redirects | Vercel | `vercel.json` `redirects` | Adding the domains to the project |
| Security and cache headers | Vercel | `vercel.json` `headers`, the build output | — |
| Rate limit | Vercel WAF | — (rate-limit rules cannot live in `vercel.json`) | One WAF rule |
| Question log, daily totals, cost, alert markers | Upstash Redis (Marketplace) | `src/ops/` | The integration, its budget |
| Limit alerts | ntfy.sh, a secret topic | `src/ops/alerts.ts` | The ntfy app on his phone |
| CI, deployment checks, the outside health check | GitHub Actions | `.github/workflows/` | Actions secrets, Deployment Checks |
| Spend limits | Anthropic Console, Vercel, Upstash | The daily cap and the monthly limit's value in `src/ops/limits.ts` | The limits themselves |

Agents never sign in to Vercel, Anthropic, Upstash, ntfy or GitHub's settings. Everything an agent can put in the repository lives there; the rest is the setup list.

## Releases

Gated auto-deploy (row 107):

1. A push to `main` reaches Vercel. The ignore step (`scripts/ignore-build.sh`, a short shell script, because it runs before Bun is installed) compares `HEAD` with `VERCEL_GIT_PREVIOUS_SHA`, the commit of the last successful deployment. It fetches that commit if the shallow clone lacks it. It builds when site files changed: `src/`, `knowledge/`, `resume.yaml`, `documents/`, `fonts/`, `public/`, `scripts/`, `package.json`, `bun.lock`, `vite.config.ts`, `tsconfig.json` or `vercel.json`. It builds on the first deployment, when the variable is empty. In every other case, including any error, it builds nothing. A skipped site change cannot go unseen: the outside health check fails when the live commit lags the newest site change on `main`.
2. Vercel builds a production deployment on its own URL. Deployment Checks hold it off the domains.
3. Three required checks run in GitHub Actions, each a job with a fixed name: `ci / test` (the build, the document check and `bun test` on the pushed commit), `ci / audit` (`bun audit --audit-level=high`) and `deploy-check / smoke`. `deploy-check` starts on Vercel's `vercel.deployment.ready` event for production, checks out the deployment's own commit from the event, runs the smoke check with `--browser` against the deployment's URL with the automation bypass header, and reports its status with Vercel's status helper.
4. When all three pass, Vercel moves the domains to the deployment.
5. If any fails, the deployment never serves visitors, and the site stays on the last good deployment. Peter can force-promote from the dashboard, for example during a registry outage that fails `ci / audit`; agents never do.

Because a push of site changes is a release, agents ask Peter before pushing site changes to `main`. [AGENTS.md](../AGENTS.md) changes to say so when this module is built (SPEC-agents).

Rollback: Instant Rollback in the dashboard moves the domains back in seconds. A rollback turns domain auto-assignment off, and Deployment Checks need it on, so after the fix Peter turns it on again (Settings, Environments, Production). Until then, passing deployments do not go live, and the outside health check reports the lag. `docs/runbooks/rollback.md` has the steps.

Previews: every other branch builds a preview behind Vercel Authentication. Code decides from `VERCEL_ENV`: outside production, the chat always uses the fake model and the ops module always uses its in-memory parts, whatever variables are set (row 108).

## Documents

The PDF build drives Chrome, and Vercel's build image (Amazon Linux 2023) has none, so the public documents are committed (row 119):

- `bun run documents` builds the public variant and writes `documents/resume.pdf`, `documents/resume.docx` and `documents/resume.txt`. A change to `resume.yaml` and the three files go in the same commit; the edit-resume skill runs the command.
- `bun run build:site` copies `documents/` into the site; it builds no document and needs no Chrome.
- `ci / test` rebuilds the documents into a temporary folder and fails if the text file differs, if the PDF's text (`pdftotext`) or the Word file's text differs, or if the PDF does not have exactly 2 pages. The private-detail test also covers `documents/`.
- The smoke check fetches `/resume.pdf` and checks that it has 2 pages.
- The site's own font files are committed too, so the Vercel build downloads nothing.

## Configuration in code

```jsonc
// vercel.json (shape; the plan fills the lists from the tables below)
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "bunVersion": "1.4.x",                    // "1.x" would be Bun 1.3.14
  "framework": "tanstack-start",
  "installCommand": "bun ci",
  "buildCommand": "bun run build:site",
  "ignoreCommand": "sh scripts/ignore-build.sh",   // exit 0 skips the build
  "redirects": [
    { "source": "/:path*", "has": [{ "type": "host", "value": "pkloss.dev" }],
      "destination": "https://peterkloss.dev/:path*", "permanent": true }
    // the same for pwk.dev, www.peterkloss.dev and the project's .vercel.app address
  ],
  "crons": [{ "path": "/api/cron/health", "schedule": "17 15 * * *" }],
  "headers": [ /* security headers on "/(.*)"; cache rules by path */ ]
}
```

```ts
// vite.config.ts (part): the chat function's duration and region
nitro({ vercel: { functionRules: { "/api/chat": { maxDuration: 90, regions: ["iad1"] } } } });
```

- The chat's maximum duration is 90 s: above SPEC-chat's 60 s deadline, below Vercel's 300 s default, so a stuck function stops early.
- Every tool in the build runs under Bun 1.4.2 (`bun --bun` for a tool with a Node shebang). `bunVersion` covers the functions; the plan checks which Bun runs the build, and if Vercel does not honor `packageManager: "bun@1.4.2"`, the install command installs 1.4.2 with Bun's official installer.
- Only `/api/chat`, `/api/status` and `/api/cron/health` run as functions. No page renders at request time: an unknown path gets the prerendered not-found page with status 404, under the same policy.

## Headers

On every response:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` (.dev is already on the browsers' preload list, so no `preload`) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `X-Frame-Options` | `DENY` (for browsers without `frame-ancestors`) |

On every HTML response, this policy, with `<hashes>` the SHA-256 hashes of that page's inline scripts:

```text
default-src 'self'; script-src 'self' <hashes>; style-src 'self'; img-src 'self' data:;
font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-src 'none';
object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
```

- The probe on `prototype/csp-probe` ran prerendered pages, the design system and the service worker under this policy with no violation, online and offline (research 12). It was a small spike on a local server, so the real deployment is checked in Chrome by `deploy-check` and by the outside health check.
- TanStack Start's per-request nonce does not fit static pages, so each page carries its own hashes. `buildSite()` computes them after prerendering. The plan chooses how they reach the browser: a per-path header in the build output, or a `<meta http-equiv="Content-Security-Policy">` first in each page's `<head>`, with the header policy then left without `default-src` and `script-src`.
- Prerendered HTML holds no `style="…"` attribute, because `style-src 'self'` blocks it and hashes cannot allow it. A style a page needs, such as a role's width on the career timeline, comes from a stylesheet file the build writes. A test fails on any `style=` in the built pages. Allowing inline style attributes (`style-src-attr 'unsafe-inline'`) is an ask-first change.
- The policy enforces SPEC-site's rule of no third-party requests: fonts, scripts, images and connections come only from the site's own address.

Caching:

| Path | `Cache-Control` |
|---|---|
| `/assets/*` (hashed names) | `public, max-age=31536000, immutable` |
| HTML pages, `/sw.js`, `/manifest.webmanifest`, `/device-index.json`, the three documents, the icons | `public, max-age=0, must-revalidate` (Vercel's default) |
| `/api/*` | `no-store`, set by the function |

## Rate limit

One Vercel WAF rule, "chat rate limit": if the request path starts with `/api/chat` and the method is `POST`, allow 20 requests per 10 minutes per IP address, then answer 429 (row 112). "Starts with" also covers `/api/chat/`. Denied requests cost nothing and do not run the function. SPEC-chat already maps a 429 to its alert; its text changes to "Try again in a few minutes", for Peter's approval with the other wordings.

The rate limit slows one address; it does not cap spend. The daily cap below does.

## Spend limits

| Limit | Value | Warning | At the limit |
|---|---|---|---|
| Daily cap, in code | $8 of estimated cost a UTC day (row 121) | — | The chat refuses new turns until 00:00 UTC (5 pm Pacific) with the "limit reached" state, and pushes once |
| Anthropic, workspace `resume-chat` | $20 a month (row 113) | Anthropic emails at $10; the server pushes at 75% | Anthropic answers 400; the chat shows "limit reached" and pushes once a day |
| Vercel | $20 on-demand budget beyond the $20 monthly credit (row 116) | Email and the webhook to the ntfy push at 50%, 75% and 100% | Notify only; production never pauses |
| Upstash | $1 a month, pay as you go ([decision 0022](../docs/decisions/0022-question-log-store.md)) | — | The database slows; a failed write never breaks an answer |

- The evals use a second workspace, `resume-evals`, with its own key and a $5 monthly limit, so eval runs never spend the visitors' budget and the estimates stay about visitors.
- The chat's API key is a service-account key scoped to `resume-chat`, kept only in Vercel's Production environment as a Secret variable.

**Cost estimate.** Each turn adds its cost to the day and the month, at Sonnet 5.5's prices per million tokens ([research 11](../docs/research/11-knowledge-tooling.md)): uncached input $2, cache reads $0.10, 5-minute cache writes $2.50, 1-hour cache writes $4, output $10. TanStack AI's Anthropic adapter reports `promptTokens` as uncached plus cache reads plus cache writes, with `cachedTokens`, `cacheWriteTokens` and `cacheWrite1hTokens` as details, so the estimate is close to Anthropic's bill. The prices and both limits live in `src/ops/limits.ts`. A test checks the estimate against a worked example.

**The daily cap.** Before a turn calls the model, the handler asks the ops module whether today's estimate is under $8. If not, it answers at once with `errorCode: "DAILY_LIMIT"`, no model call and no question-log entry. A turn already running can pass the cap by its own cost.

**The monthly limit.** When Anthropic answers 400 with a message that starts "You have reached your specified", or 429 with `error_code` `enforced_spend_limit_reached`, the handler reports `errorCode: "SPEND_LIMIT"`.

Both show the "limit reached" state: the chat has reached its limit for today or for this month, with Peter's email and a link that opens the resume; no Try again; the input stays. The words come to Peter with the other wordings. These are amendments to SPEC-chat (below).

## The question log, daily totals, alerts and status

One module, `src/ops/`, behind a small interface. The routes build it from the environment; tests build it with fake servers.

```ts
export type OpsEnv = {
  VERCEL_ENV?: string;          // the store and alerts are used only in "production"
  KV_REST_API_URL?: string;     // set by the Upstash integration, Production only
  KV_REST_API_TOKEN?: string;
  NTFY_TOPIC_URL?: string;      // https://ntfy.sh/<secret topic>
};

export type Ops = {
  log: QuestionLog;                      // SPEC-chat's interface
  telemetry: TurnTelemetry;              // receives SPEC-chat's ChatTurnEvent
  budget: { allowTurn(): Promise<{ ok: true } | { ok: false; errorCode: "DAILY_LIMIT" }> };
  status(): Promise<OpsStatus>;          // for /api/status, no secrets
};
export type TurnTelemetry = { record(event: ChatTurnEvent): Promise<void> };

/** In-memory parts outside production; in production, a missing variable is reported, never hidden. */
export function createOps(env: OpsEnv, io?: { fetch?: typeof fetch; now?: () => Date; print?: (line: string) => void }): Ops;

/** For `bun run questions`, with the read-only token. */
export function createOpsReader(env: { KV_REST_API_URL: string; KV_REST_API_READ_ONLY_TOKEN: string }, io?: { fetch?: typeof fetch }): {
  entries(days: number): Promise<QuestionLogEntry[]>;
  totals(days: number): Promise<DailyTotals[]>;
};
```

- All store calls go through Upstash's REST API with `fetch` and `Authorization: Bearer`, one pipeline request per turn. No package is added.
- In production, a missing store or ntfy variable keeps answers working, prints `ops_error` with the code `missing_config` on every turn, and shows as `false` in `/api/status`, so the health checks fail.

| Key | Holds | Expires |
|---|---|---|
| `qlog:<YYYY-MM-DD>` | A list of `QuestionLogEntry` JSON, appended | 00:00 UTC on the 90th day after its day (`EXPIREAT`) |
| `qstats:<YYYY-MM-DD>` | A hash: turns by outcome, model calls, reads, citations, removed markers, the four token counts, errors by code, the summed duration | The same |
| `qslow:<YYYY-MM-DD>` | A sorted set with one member, the day's longest duration (`ZADD GT`) | The same |
| `qcost:<YYYY-MM-DD>`, `qcost:<YYYY-MM>` | The day's and the month's estimated cost in millionths of a dollar (`INCRBY`) | The day's with `qstats`; the month's 90 days after the month ends |
| `alert:<kind>:<period>` | A marker that an alert went out | After its period |
| `health:last` | When the Vercel health job last ran, and its result | 7 days |

- `telemetry.record()` prints SPEC-chat's `chat_turn` line to the function log, adds the turn to `qstats`, `qslow` and both `qcost` keys, and checks the alerts. It holds no question text, `threadId` or IP address.
- A failed store or push call prints an `ops_error` line with a code, and never breaks the answer. The plan checks that writes made after the last chunk finish on Vercel: the handler test proves the response ends only after them, and a turn the visitor stops is the case to verify there.
- **Limit alerts** (rows 115 and 121), each an ntfy push with priority `urgent`, a title and one line naming the next step:

  | Kind | When | At most |
  |---|---|---|
  | `spend75` | The month's estimate passes 75% of the limit. "Chat at 75% of its $20 limit for October. Raise it in the Anthropic Console, then in src/ops/limits.ts." | Once a month |
  | `daycap` | A turn is refused with `DAILY_LIMIT` | Once a day |
  | `spendlimit` | A turn ends with `SPEND_LIMIT` | Once a day |
  | `health` | A health check fails, or finds that the other did not run | Once per failed run |

  The marker is claimed with `SET NX` just before the push and deleted if the push fails, so a failed push is tried again on the next turn instead of being lost. Vercel's spend webhook posts to the same topic.
- An alert holds no visitor text. The topic name is a secret: anyone who knows it can read and send to it.
- **The status route.** `GET /api/status` returns, with `no-store` and no secrets: the live commit (`VERCEL_GIT_COMMIT_SHA`), whether the store, the alerts and the real model are configured, and when the Vercel health job last ran with its result. The commit is public anyway; the repository is public.

`bun run questions` reads the last 7 days with the read-only token: the entries newest first, a count per outcome, the most read sources, and the daily totals with the day's and the month's cost against the cap and the limit.

## Smoke check and health checks

`src/ops/smoke.ts` holds the checks; `bun run smoke <origin> [--browser] [--production]` and the Vercel health job both run them. They ask the model nothing, so they cost nothing.

- `/`, `/resume` and one source page return 200 with HTML, a title and the canonical address; `/sources/does-not-exist` returns 404 under the same policy.
- Each HTML response carries every header above, and its policy has no `'unsafe-inline'` or `'unsafe-eval'`. An `/assets/` file is immutable; `/sw.js` revalidates.
- `/resume.pdf` has exactly 2 pages.
- `POST /api/chat` with a malformed body returns 400 with SPEC-chat's `ChatError` shape.
- `GET /api/status` reports the store, the alerts and the real model as configured, in production.
- With `--browser`: Chrome loads `/` and `/resume`, records `securitypolicyviolation` events and page errors, and fails on any; the chat input becomes usable after hydration; a reload with the network off still shows `/`.
- With `--production`: `https://pkloss.dev/resume?x=1`, `https://pwk.dev/resume?x=1`, `https://www.peterkloss.dev/resume?x=1` and the project's `.vercel.app` address return 308 to `https://peterkloss.dev/resume?x=1`; then malformed chat requests are sent until one gets 429, which must happen by the 41st.
- Requests carry `x-vercel-protection-bypass` when `VERCEL_AUTOMATION_BYPASS_SECRET` is set, for a protected deployment URL.

The two health checks watch each other (row 122):

| Check | Runs | Checks | On failure |
|---|---|---|---|
| Vercel health job, `GET /api/cron/health` with `Authorization: Bearer $CRON_SECRET` | Vercel Cron, daily at 15:17 UTC | The smoke check without `--browser` against peterkloss.dev; yesterday's totals (fails when at least 5 turns reached the model and 1 in 5 or more ended in `error`, or any ended in `SPEND_LIMIT`); that the GitHub health check ran in the last 26 hours, from GitHub's public API | ntfy push; result kept in `health:last` |
| GitHub health check, `.github/workflows/health.yml` | GitHub schedule, daily at 21:17 UTC, and by hand | The smoke check with `--browser --production` from outside Vercel; that `/api/status` shows a Vercel health run in the last 26 hours that passed; that the live commit equals the newest commit on `main` that changed site files, or is less than 2 hours older | ntfy push from the workflow |

- The error share counts only turns that reached the model (`answered`, the refusals, `stopped` and `error`). The health checks' own malformed requests are `rejected` and do not count.
- GitHub stops a schedule after 60 days with no repository activity; the Vercel job then reports it. If Vercel itself is down, the GitHub check reports it. The runbook covers turning a schedule back on.

## CI

`.github/workflows/ci.yml`, on every push and pull request, on `ubuntu-24.04` (pinned: `ubuntu-latest` moves to 26.04 in November 2026). Every helper is pinned to an exact commit, and each workflow grants only the permissions it needs (row 120):

- Job `test`: `actions/checkout`; `oven-sh/setup-bun` with `bun-version: 1.4.2`; `sudo apt-get install -y poppler-utils`; `bun ci`; the document check; `bun run build:site`; `bun test` with `CHROME_PATH=/usr/bin/google-chrome` for the browser test.
- Job `audit`: `bun audit --audit-level=high`, as its own job, so a registry outage shows as its own failure.

There is no `private.yaml` in CI, so only public documents are built, and the private-detail test skips. The evals never run in CI: each run costs money and needs Peter's approval (SPEC-chat). This replaces the plan's line "CI that … runs the evals".

`.github/workflows/deploy-check.yml` (job `smoke`, `permissions: contents: read, statuses: write`) and `.github/workflows/health.yml` are described above. GitHub's helpers run on GitHub's own Node.js; no code in this repository does (row 120).

## Secrets and settings

| Name | Where | Value from |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel, Production, Secret | Service-account key for `resume-chat` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel, Production only | The Upstash integration |
| `NTFY_TOPIC_URL` | Vercel, Production, Secret; Actions secret | `https://ntfy.sh/` plus a long random topic name |
| `CRON_SECRET` | Vercel, Production, Secret | A long random value |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Actions secret | Vercel, Deployment Protection |
| `KV_REST_API_URL`, `KV_REST_API_READ_ONLY_TOKEN`, `ANTHROPIC_API_KEY` (evals) | Peter's untracked `.secrets/local.env` | The Upstash console; the `resume-evals` key |

- Bun loads a file named `.env` into every run automatically, tests included. So the local file is `.secrets/local.env`, which Bun loads only when told: `bun run questions` and `bun run evals` pass `--env-file=.secrets/local.env`, and nothing else does. A file named `.env` is never created. `.gitignore` gains `.secrets/` and `.env*`.
- GitHub holds no store token.
- Agents never read, print or store a value from this table.

## Setup list

Peter does these steps once, in order, so that nothing is public before its guards are in place. The plan turns them into `docs/runbooks/setup.md` with links, and each step names how to check it.

1. Buy peterkloss.dev, pkloss.dev and pwk.dev (decision 0018).
2. Anthropic Console: workspaces `resume-chat` ($20 a month, email at $10) and `resume-evals` ($5); a service-account key for each.
3. ntfy: install the app on his phone; subscribe to a long random topic name; send a test push.
4. Vercel: sign up for Pro; import `loriensleafs/resume` with the Production variables from the table above already entered; keep Fluid compute on.
5. Vercel, Deployment Protection: Standard Protection with Vercel Authentication; create an automation bypass secret.
6. Vercel, Marketplace: add Upstash Redis, pay as you go, with a $1 budget; attach its variables to Production only.
7. Vercel, Firewall: the "chat rate limit" rule.
8. Vercel, Spend Management: a $20 budget, notify only, with the webhook set to the ntfy topic URL.
9. GitHub, Actions secrets: the Actions rows of the table above.
10. Vercel, Deployment Checks: require `ci / test`, `ci / audit` and `deploy-check / smoke`; check that domain auto-assignment is on.
11. Vercel, Domains: add peterkloss.dev, www.peterkloss.dev, pkloss.dev and pwk.dev, all served by the project; write the project's `.vercel.app` address into the redirect list in `vercel.json` (an agent commits it, with Peter's approval).
12. Push a site change; watch the three checks pass and the domains move; run both health checks by hand once; check `/api/status`.

## Runbooks

`docs/runbooks/`, one file per alert, each with what it means, the first thing to check and the fix:

- `spend-75.md`: `bun run questions` shows which days spent; raise the limit in the Anthropic Console and in `src/ops/limits.ts`, or leave it.
- `day-cap.md`: the chat is paused until 5 pm Pacific; `bun run questions` shows whether the spend looks real or scripted; raise the cap in `src/ops/limits.ts` (a release) only if real.
- `spend-limit.md`: the chat is paused for the month; raise the limit in the Console (it takes effect at once), then update `src/ops/limits.ts`.
- `health-failed.md`: which check failed; a page, header or policy failure points at the last release (roll back); `missing_config` points at the environment variables; an error share points at `bun run questions` and its errors by code; a lagging live commit points at a skipped build or domain auto-assignment; a missing run points at the other schedule, and how to turn it back on.
- `vercel-spend.md`: the usage page shows the cost; the WAF's traffic view shows abuse.
- `rollback.md`: the rollback steps above, ending with domain auto-assignment back on.

## Changes to other specs

Approving this spec approves these amendments:

- **SPEC-chat.**
  1. `ChatDeps` gains `telemetry: TurnTelemetry` and `budget`. The handler hands each `ChatTurnEvent` to `telemetry` instead of printing it, and asks `budget.allowTurn()` before the first model call. Tests pass in-memory ones.
  2. `ChatTurnEvent` gains `cacheWriteTokens` and `cacheWrite1hTokens`, and `inputTokens` means uncached input only.
  3. `errorCode` gains `"DAILY_LIMIT"` and `"SPEND_LIMIT"`, and the views gain the "limit reached" state.
  4. The 429 text becomes "Try again in a few minutes".
  5. `bun run questions` also prints the daily totals and the day's and the month's cost.
  6. The handler rejects a request whose `Origin` header differs from the request's own origin with 403 `FORBIDDEN_ORIGIN`, so other sites' pages cannot spend the chat's budget through their visitors' browsers.
  7. The handler test proves the response ends only after the log and telemetry writes.
  8. Outside production the route always uses the fake model, and in production it ignores `CHAT_FAKE`.
  9. The evals key lives in `.secrets/local.env`, not `.env`.
- **SPEC-site.**
  1. `buildSite()` writes each page's script hashes into the output, and copies `documents/` instead of building documents.
  2. Prerendered HTML holds no `style` attribute.
  3. Unknown paths get the prerendered not-found page with status 404.
  4. `bun run preview` serves the headers and cache rules of `vercel.json` and the per-page policy, as Vercel does.
  5. The service worker's registration moves from an inline script to a file.
  6. The site's font files are committed.
- **SPEC-content.** `bun run documents` writes the public documents to `documents/`; a test checks that they match a fresh build and that the PDF has 2 pages.
- **SPEC-agents.**
  - AGENTS.md: a push of site changes to `main` is a release and needs Peter's approval; `bun run smoke`, `bun run documents` and the runbooks join the commands.
  - The edit-resume skill runs `bun run documents`.

## Tech Stack

- Vercel Pro, Bun runtime `1.4.x` (Beta), Fluid compute, Vercel Cron, Nitro's Vercel output from TanStack Start ([decision 0012](../docs/decisions/0012-vercel-pro-host.md), research 12).
- Upstash Redis through its REST API with `fetch` ([decision 0022](../docs/decisions/0022-question-log-store.md)).
- ntfy.sh and GitHub's public API, called with `fetch`.
- GitHub Actions, each pinned to an exact commit: `actions/checkout`, `oven-sh/setup-bun`, `vercel/repository-dispatch/actions/status`.
- Playwright, already in the stack for the browser test, drives the smoke check's `--browser` part.

No npm package is added. Approving this spec approves the three GitHub helpers and the two outside services.

## Commands

```sh
bun run documents                        # rebuilds documents/ from resume.yaml (needs Chrome)
bun run build:site                       # copies documents/, writes the per-page script hashes
bun run preview                          # serves dist/ with production's headers and policy
bun run smoke http://localhost:4173 --browser   # the smoke check against the preview
bun run smoke https://peterkloss.dev --browser --production   # the outside health check by hand
bun run questions                        # entries, daily totals and costs; loads .secrets/local.env
bun test tests/ops                       # seam 2
bun test                                 # every test
```

## Project Structure

```text
vercel.json                        bunVersion, build commands, ignore step, redirects, crons, headers
documents/                         resume.pdf, resume.docx, resume.txt: the committed public documents
scripts/ignore-build.sh            exit 0 unless site files changed since the last deployment
scripts/documents.ts               `bun run documents`
scripts/smoke.ts                   `bun run smoke`
scripts/questions.ts               `bun run questions` (from SPEC-chat), extended with the totals
src/ops/ops.ts                     createOps(), createOpsReader()
src/ops/upstash.ts                 the REST pipeline, the key layout and the expiry rules
src/ops/alerts.ts                  the alert rules, the markers and the ntfy push
src/ops/limits.ts                  the daily cap, the monthly limit, the 75% threshold and the prices
src/ops/smoke.ts                   the checks shared by `bun run smoke` and the Vercel health job
src/site/routes/api.chat.ts        builds createOps(process.env) and passes log, telemetry and budget to handleChat()
src/site/routes/api.status.ts      GET /api/status
src/site/routes/api.cron.health.ts the Vercel health job
.github/workflows/ci.yml           jobs test and audit
.github/workflows/deploy-check.yml job smoke, on each production deployment
.github/workflows/health.yml       the outside health check
docs/runbooks/                     setup, rollback and one file per alert
tests/ops/ops.test.ts              seam 2
tests/ops/fake-upstash.ts          an in-test Upstash REST server for the commands the module uses
tests/ops/fake-ntfy.ts             an in-test ntfy server that records pushes
tests/site/config.test.ts          vercel.json, the build output's headers and hashes (seam 1)
tests/site/smoke.test.ts           the smoke check against the preview (seam 3)
tests/content/documents.test.ts    the committed documents match a fresh build
```

## Code Style

The same as [SPEC-site](SPEC-site.md). Everything outside the process comes in through arguments, so tests pass fake servers and a fixed clock:

```ts
const ops = createOps(
  { VERCEL_ENV: "production", KV_REST_API_URL: upstash.url, KV_REST_API_TOKEN: "test", NTFY_TOPIC_URL: `${ntfy.url}/t` },
  { now: () => new Date("2026-10-27T12:00:00Z") },
);
await ops.telemetry.record({ ...turn, outcome: "error", errorCode: "SPEND_LIMIT" });
await ops.telemetry.record({ ...turn, outcome: "error", errorCode: "SPEND_LIMIT" });
expect(ntfy.pushes).toHaveLength(1); // one spend-limit push a day
```

## Testing Strategy

`bun test`, at the three seams Peter confirmed on 2026-10-27 (row 117). No test calls Upstash, ntfy, Anthropic, GitHub or Vercel.

1. **The site seam, extended** ([SPEC-site](SPEC-site.md) seams 1 and 2):
   - `tests/site/config.test.ts` reads `vercel.json` and the build output:
     - `bunVersion` is `1.4.x`;
     - the four hosts redirect permanently to peterkloss.dev with the path;
     - every header in the tables is present for its paths;
     - each HTML page's policy lists exactly the hashes of its own inline scripts;
     - no built page holds a `style=` attribute;
     - the chat route's maximum duration is 90 s;
     - the cron entry calls `/api/cron/health`.
   - `scripts/ignore-build.sh`, run in a temporary git repository: it builds for a site change, skips a docs-only change across several commits, builds on an empty previous commit, and skips on an unknown one.
   - The browser test, against `bun run preview` with production's headers, fails on any `securitypolicyviolation` event on every page it visits, online and offline.
   - `tests/content/documents.test.ts`: the committed documents match a fresh build, and the PDF has 2 pages.
2. **The ops module**, `tests/ops/ops.test.ts`, through `createOps()` and `createOpsReader()`, against the in-test Upstash and ntfy servers and a fixed clock:
   - Log and contract:
     - an appended entry comes back from `entries(7)`;
     - a day's keys expire at 00:00 UTC on the 90th day after it;
     - entries from 8 days ago are not listed;
     - the QuestionLog contract tests from SPEC-chat pass against both the in-memory log and the Upstash one.
   - Totals and cost:
     - `record()` adds a turn to the day's totals, and `totals(1)` shows the outcome counts, the four token counts and the longest duration;
     - a turn with known token counts adds the cost of the worked example in `limits.ts`, counted by hand.
   - Daily cap:
     - with today's estimate at $8, `budget.allowTurn()` refuses with `DAILY_LIMIT`;
     - one `daycap` push that day;
     - the next UTC day allows turns again.
   - Alerts:
     - the month's estimate crosses 75%: one `spend75` push, and none again that month;
     - two `SPEND_LIMIT` turns on one day send one push, and another on the next day sends another;
     - a push that fails is tried again on the next turn;
     - a push body holds no question text.
   - Failures and guards:
     - the Upstash server returns 500: `record()` and `append()` resolve, and an `ops_error` line is printed;
     - with `VERCEL_ENV` `preview`, store variables present: no server is called;
     - with `VERCEL_ENV` `production` and no ntfy variable: answers still work, `missing_config` is printed, and `status()` reports alerts as `false`;
     - the reader with the read-only token makes no write command.
3. **The smoke check**, `tests/site/smoke.test.ts`:
   - `bun run smoke --browser` against `bun run preview` passes;
   - against a preview server with one header removed, it fails and names that header;
   - against a preview page with an unhashed inline script, it fails and names the policy violation;
   - the Vercel health job's checks, run against the preview and the fake Upstash holding a day of 10 turns with 3 errors and 30 rejected requests, fail and name the error share.

The real platform is checked by the `deploy-check` and health runs and by step 12 of the setup list.

## Boundaries

- **Always:**
  - keep every setting that Vercel reads from the repository in the repository;
  - keep previews and local runs on the fake model and the in-memory store, by code;
  - commit a resume change together with its rebuilt documents;
  - treat a failed store or push call as a printed `ops_error`, never as a failed answer;
  - run `bun run build`, `bun run build:site` and `bun test` before a commit.
- **Ask first:**
  - pushing site changes to `main` (a release);
  - a change to a limit, the cap, a header, the policy, a redirect or a cache rule;
  - a new outside service, GitHub helper or package;
  - a change to the key layout or to what an alert says;
  - allowing inline style attributes.
- **Never:**
  - sign in to a dashboard; buy, upgrade or change a plan;
  - read, print or commit a key, token, secret or topic name; create a `.env` file;
  - force-promote a deployment, or turn off a Deployment Check or domain auto-assignment;
  - put visitor text, an IP address or a `threadId` in an alert, a total, a status or a log line;
  - add `'unsafe-inline'` or `'unsafe-eval'` to the policy;
  - let a preview reach the real model or the real store;
  - add Node or Python tooling to this repository.

## User Stories

1. As a recruiter, I want peterkloss.dev to load fast and safely over HTTPS, so that the link I was sent looks trustworthy.
2. As a visitor who types pkloss.dev or pwk.dev, I want to land on the same page at peterkloss.dev, so that a short address works.
3. As a visitor with a shared link to a source page, I want the redirect to keep the path, so that I see the page I was sent.
4. As a visitor on a slow connection, I want hashed files cached for a year and pages revalidated, so that repeat visits are fast and never stale.
5. As a visitor who asks many questions, I want the rate limit high enough that I never see it, so that a long conversation is not cut off.
6. As a visitor in a busy office on one network, I want the limit to be generous, so that colleagues do not block each other.
7. As a visitor when the day's or the month's budget is spent, I want a clear message with Peter's email and the resume, so that I can still reach him.
8. As a visitor, I want the site to load no third-party code, so that my visit is private and an injected script cannot run.
9. As a visitor, I want the site never shown inside another site's frame, so that nobody can dress it up as something else.
10. As a visitor downloading the PDF, I want the same 2-page file that was tested, so that it prints as Peter intended.
11. As Peter, I want every release to pass CI, the audit and a smoke check in Chrome on the real deployment before it goes live, so that a broken build never reaches a recruiter.
12. As Peter, I want docs-only pushes to build nothing, so that writing specs never touches the live site.
13. As Peter, I want a one-click rollback with written steps, so that I recover in seconds.
14. As Peter, I want previews that cost nothing and cannot expose the key, enforced in code, so that branches are safe to push.
15. As Peter, I want a daily cap, so that one script cannot spend the whole month in an hour during my job search.
16. As Peter, I want a push when the daily cap is reached, so that I can tell a real busy day from abuse.
17. As Peter, I want a push on my phone when the chat passes 75% of its monthly budget, so that I can raise it before visitors hit the limit.
18. As Peter, I want a push when the monthly limit is reached, so that I know the chat is paused.
19. As Peter, I want two health checks that watch each other, so that neither can stop quietly.
20. As Peter, I want a health check to fail when a setting is missing, so that a misconfigured production does not run for days.
21. As Peter, I want a health check to fail when the live site lags `main`, so that a skipped build or a rollback I forgot is caught.
22. As Peter, I want alerts at most once a day for each kind, and a failed push tried again, so that my phone is not flooded and no alert is lost.
23. As Peter, I want daily totals of outcomes, tokens and errors for 90 days, so that I see trends in cost and failures.
24. As Peter, I want a cost estimate that counts cache writes, so that the 75% push and the daily cap fire on time.
25. As Peter, I want `bun run questions` to show the day's and the month's cost against the cap and the limit, so that I can plan.
26. As Peter, I want the question log deleted by the store itself, so that the 90-day promise to visitors holds without a job to maintain.
27. As Peter, I want only my laptop to hold a store token outside Vercel, and only the read-only one, so that a leak cannot change or delete the log.
28. As Peter, I want my local keys in a file Bun never loads on its own, so that tests never reach a real service.
29. As Peter, I want the store and the alerts to cost cents a month, so that the site stays cheap.
30. As Peter, I want a hard $20 cap on the model bill, so that abuse cannot cost more.
31. As Peter, I want Vercel's spend to notify me and never take the site down, so that a recruiter never finds it paused.
32. As Peter, I want the evals on their own workspace and limit, so that my testing never spends the visitors' budget.
33. As Peter, I want a numbered setup list that leaves nothing public before its guards, so that I configure the dashboards once without guessing.
34. As Peter, I want a runbook for every alert, so that I know the first thing to do when my phone buzzes.
35. As Peter, I want CI on a pinned image with Bun 1.4.2, Chrome and poppler, and pinned helpers, so that nothing changes under me.
36. As Peter, I want no Node or Python tooling in this repository, so that it stays pure Bun.
37. As an engineer reviewing the repository, I want the platform settings in `vercel.json` and the workflows, so that I can read how the site is run.
38. As an engineer reviewing the repository, I want the strict policy, its probe and its checks on the real deployment on record, so that I see the security work.
39. As an attacker, I should not be able to embed the chat in another site and spend its budget through visitors' browsers.
40. As an attacker with a script, I should be slowed at about 20 questions per 10 minutes per address, stopped at $8 a day, and capped at $20 a month.
41. As an attacker who learns the ntfy topic, I should find no visitor data in the alerts.
42. As a future agent, I want tests that name the broken header, alert rule, expiry or document, so that I fix the cause.
43. As a future agent, I want the release rule in AGENTS.md, so that I ask before pushing site changes.

## Out of scope

- Buying the domains, signing up and paying: Peter does these (setup list).
- Rolling Releases: the traffic is too low to compare a canary (row 107).
- A real text message (Twilio), log drains, outside log or uptime services, and Vercel's anomaly alerts (rows 110, 115, 121).
- A second region, a staging environment, Terraform for the WAF rule, bot protection rules, and HSTS preload submission.
- Building documents on Vercel (row 119), and evals in CI (SPEC-chat).
- What one question-log entry holds and how the chat writes it: [SPEC-chat](SPEC-chat.md).
- The pages, the service worker's precache and the offline behavior: [SPEC-site](SPEC-site.md).

## Prior-art tests

- `tests/content/build.test.ts`: runs the real entry point into a temporary folder and checks the real files, the PDF's text and its fonts. `tests/site/config.test.ts` and `tests/content/documents.test.ts` work the same way.
- `tests/site/browser.test.ts` from SPEC-site: Playwright under Bun against the preview. Seam 1 adds the policy-violation check, and the smoke check's `--browser` part reuses it.
- The probe `prototypes/csp-probe/csp-test.ts` on the branch `prototype/csp-probe`: the `securitypolicyviolation` listener and the per-page hash computation.
- SPEC-chat's handler test, which uses the in-memory `QuestionLog`. Seam 2 runs the same contract against the Upstash one.

## Success Criteria

- `bun test` passes on a clean checkout with Chrome and poppler installed, no `.secrets/` and no network beyond the tests' own servers.
- After the setup list:
  - a push of a site change goes live only after the three checks pass;
  - a docs-only push builds nothing;
  - both health checks pass by hand, and `/api/status` reports everything configured.
- A health run against a failing target reaches Peter's phone.
- Peter reviews the setup list and the runbooks and approves them.

## Open Questions

None for this spec. For the plan:

- How the per-page hashes reach the browser: a header in the build output or a meta tag (both meet the tests).
- Which Bun runs Vercel's build, and whether `packageManager` pins it.
- Whether Upstash's read-only token allows `LRANGE`, `HGETALL` and `ZRANGE` (documented only as "read commands").
- Whether the Nitro function rule matches TanStack Start's chat route in `.vercel/output`, and how an unknown path reaches the static 404.
- Whether Vercel Cron reaches `/api/cron/health` under Standard Protection.
- Whether writes made after the last chunk finish on Vercel when the visitor stops a turn. If not, Vercel's `waitUntil` needs `@vercel/functions`, a new package for Peter's approval.
- For Peter, with the other wordings: the "limit reached" texts (day and month) and the new 429 text.
