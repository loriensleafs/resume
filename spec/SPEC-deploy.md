# Spec: deploy

Draft for Peter's review, 2026-10-27. Peter's answers are rows 107 to 125 of the [interview record](../docs/design/interview-2026-10-26.md); the facts are in [research 12](../docs/research/12-deploy-platform.md). Two adversarial reviews found 18 and then 16 issues; this draft answers all of them (rows 118 and 124).

## Objective

Put the site and the chat on the internet at `https://peterkloss.dev`, and keep them safe, cheap and observable without Peter watching them. The site serves recruiters, hiring managers and engineers during Peter's job search, when traffic is higher than usual (row 114), so a quiet failure or a spent limit must reach Peter at once.

This module owns:

- the Vercel project's configuration in code, the domains and the redirects;
- the security and cache headers, and the rate limits;
- the spend limits and the daily cap;
- the question log's store, the daily totals, the limit alerts and the status route;
- the smoke check, the two health checks and CI;
- the setup list Peter follows in the dashboards, and the runbooks.

It implements SPEC-chat's `QuestionLog`, receives its turn telemetry, and gives it the daily budget.

Acceptance criteria:

- A push of site changes to `main` goes live on peterkloss.dev only after CI and the smoke check on the new deployment pass (row 107). A push with no site changes builds nothing and changes nothing live.
- Previews use the fake model, hold no API key and write nothing to the store (row 108). Code enforces this, not only the dashboard.
- pkloss.dev, pwk.dev, www.peterkloss.dev and the project's public `.vercel.app` address answer with a 308 to the same path and query on peterkloss.dev ([decision 0018](../docs/decisions/0018-domains.md)).
- Every HTML page enforces the Content Security Policy below, with no `'unsafe-inline'` and no `'unsafe-eval'`. Chrome reports no violation on the real deployment, online and offline, the not-found page included.
- One internet address can send about 20 chat questions in 10 minutes (row 112). A burst at a window's edge can pass up to 40, and counters are kept per region.
- One chat request sends at most 10,000 characters of new question, 40,000 characters of earlier turns and 256 KB in total (row 125).
- The chat stops at $8 of estimated cost a day until 00:00 UTC (row 121), and at Anthropic's $20 a month (row 113). Each turn reserves its worst-case cost first, so parallel requests cannot pass the cap by more than one turn each. At either limit, visitors see a "limit reached" state, not a retry (row 114).
- The store itself deletes question-log entries and daily totals, at the latest 90 days after their day ([decision 0022](../docs/decisions/0022-question-log-store.md)).
- Peter's phone gets an urgent push (rows 115, 121, 122) when:
  - the month's estimated chat cost passes 75% of the limit;
  - the daily cap or the monthly limit is reached;
  - the store fails;
  - a health check fails, or finds that the other did not run.
- The documents visitors download are byte for byte the committed, tested files, and the PDF has exactly 2 pages (row 119).
- `bun test` passes with no account, key or network beyond the tests' own servers.

## What runs where

| Part | Where it runs | Set in code | Set by Peter in a dashboard |
|---|---|---|---|
| Prerendered pages, assets, documents, service worker | Vercel's CDN | `vercel.json`, the Vite and Nitro config | — |
| `/api/chat`, `/api/status`, `/api/cron/health` | Vercel Functions on the Bun runtime, region `iad1` | Nitro `vercel.functionRules`, `vercel.json` `crons` | Environment variables |
| Domains and redirects | Vercel | `vercel.json` `redirects` | Adding the domains to the project |
| Security and cache headers | Vercel, and a policy tag in each page | `vercel.json` `headers`, the build output | — |
| Rate limits | Vercel WAF | — (rate-limit rules cannot live in `vercel.json`) | Two WAF rules |
| Question log, daily totals, costs, reservations, alert markers, health records | Upstash Redis (Marketplace) | `src/ops/` | The integration, its budget |
| Limit alerts | ntfy.sh, a secret topic | `src/ops/alerts.ts` | The ntfy app on his phone |
| CI, deployment checks, the outside health check | GitHub Actions | `.github/workflows/` | Actions secrets, Deployment Checks |
| Spend limits | Anthropic Console, Vercel, Upstash | The daily cap, the monthly limit's value and the prices in `src/ops/limits.ts` | The limits themselves |

Agents never sign in to Vercel, Anthropic, Upstash, ntfy or GitHub's settings. Everything an agent can put in the repository lives there; the rest is the setup list.

## Releases

Gated auto-deploy (row 107):

1. A push to `main` reaches Vercel. The ignore step, `scripts/ignore-build.sh`, decides whether to build:
   - It is a short shell script, because it runs before Bun is installed.
   - It compares `HEAD` with `VERCEL_GIT_PREVIOUS_SHA`, the commit of the last successful deployment, fetching that one commit by its SHA because Vercel's clone is shallow.
   - It builds (exit 1) on the first deployment, when the variable is empty, and when a path in `scripts/site-files.txt` changed.
   - Every other result and every error path exits 0, so nothing builds.
   - A skipped site change cannot go unseen: the outside health check fails when the live commit lags the newest site change on `main`. The runbook's fix is Redeploy with "Use project's Ignore Build Step" unchecked.
2. Vercel builds a production deployment on its own URL. Deployment Checks hold it off the domains.
3. Three required checks must pass:
   - The jobs `ci / test` (the build, the document check and `bun test`) and `ci / audit` (`bun audit --audit-level=high`) run on the pushed commit.
   - The status `deploy-check (production)` is posted on the deployment's own commit by `.github/workflows/deploy-check.yml`. That workflow starts on Vercel's `vercel.deployment.ready` event, checks out the deployment's commit from the event, and runs the smoke check with `--browser` against the deployment's URL. It fails when the deployment's commit is no longer the newest site change on `main`, so a superseded deployment can never take the domains from a newer one. It reports through Vercel's status helper, which ties the status to that commit.
4. When all three pass, Vercel moves the domains to the deployment.
5. If any fails, the deployment never serves visitors, and the site stays on the last good deployment. Peter can force-promote from the dashboard, for example during a registry outage that fails `ci / audit`; agents never do.

Because a push of site changes is a release, agents ask Peter before pushing site changes to `main`. [AGENTS.md](../AGENTS.md) changes to say so and points to `scripts/site-files.txt` for what counts (SPEC-agents).

Rollback: Instant Rollback in the dashboard moves the domains back in seconds. A rollback turns domain auto-assignment off, and Deployment Checks need it on, so after the fix Peter turns it on again (Settings, Environments, Production). Until then, passing deployments do not go live, and the outside health check reports the lag. `docs/runbooks/rollback.md` has the steps.

Previews: every other branch builds a preview behind Vercel Authentication. Code decides from `VERCEL_ENV`: outside production, the chat always uses the fake model and the ops module always uses its in-memory parts, whatever variables are set (row 108).

## Documents

The PDF build drives Chrome, and Vercel's build image (Amazon Linux 2023) has none, so the public documents are committed (row 119):

- `bun run documents` builds the public variant and writes `documents/Peter-Kloss-Resume.pdf`, `.docx` and `.txt`, the names SPEC-site serves. A change to `resume.yaml` and the three files go in the same commit; the edit-resume skill runs the command.
- `bun run build:site` copies `documents/` into the site; it builds no document and needs no Chrome.
- `ci / test` rebuilds the documents into a temporary folder. It fails when the PDF does not have exactly 2 pages, or when the text of the text file, of the PDF (`pdftotext`) or of the Word file differs from the committed one, spacing ignored, because Chrome on the runner is not pinned. The private-detail test also covers `documents/`.
- The smoke check, when it runs with a checkout (in `deploy-check` and the GitHub health check), compares each served document byte for byte with the committed file.
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
      "destination": "https://peterkloss.dev/:path*", "permanent": true },
    // the same for pwk.dev and www.peterkloss.dev;
    // the project's .vercel.app address redirects every path except /api/, so Vercel Cron is never sent away
    { "source": "/((?!api/).*)", "has": [{ "type": "host", "value": "<project>.vercel.app" }],
      "destination": "https://peterkloss.dev/$1", "permanent": true }
  ],
  "crons": [{ "path": "/api/cron/health", "schedule": "17 15 * * *" }],
  "headers": [ /* the security headers and the header policy on "/(.*)"; cache rules by path */ ]
}
```

```ts
// vite.config.ts (part): the chat function's duration and region
nitro({ vercel: { functionRules: { "/api/chat": { maxDuration: 90, regions: ["iad1"] } } } });
```

- The chat's maximum duration is 90 s: above SPEC-chat's 60 s deadline, below Vercel's 300 s default, so a stuck function stops early.
- Every tool in the build runs under Bun 1.4.2 (`bun --bun` for a tool with a Node shebang). `bunVersion` covers the functions. The plan checks which Bun runs the build; if Vercel does not honor `packageManager: "bun@1.4.2"`, the install command installs 1.4.2 with Bun's official installer.
- Only `/api/chat`, `/api/status` and `/api/cron/health` run as functions. No page renders at request time. An unknown path gets the prerendered not-found page with status 404. That page shows the first view, as SPEC-site wants for an unknown source.

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
| `Content-Security-Policy` (the header policy) | `style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` |

`/sw.js` and the Workbox files also get `Content-Security-Policy: script-src 'self'`.

Each HTML page, the not-found page included, starts its `<head>` with its own policy tag, with `<hashes>` the SHA-256 hashes of that page's inline scripts:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' <hashes>">
```

- The browser enforces both policies, so a page gets the header's rules and the tag's script rule. `frame-ancestors` lives in the header, because a tag cannot carry it.
- Why a tag and not a per-path header: Vercel chooses headers by request path, and an unknown path would get a header without the not-found page's hashes. A tag travels with its page, also from the service worker's cache.
- TanStack Start's per-request nonce does not fit static pages. `buildSite()` writes each tag after prerendering.
- The probe on `prototype/csp-probe` ran prerendered pages, the design system and the service worker under the same rules with no violation, online and offline (research 12). It was a small spike on a local server, so `deploy-check` and the outside health check also load the real deployment in Chrome.
- Prerendered HTML holds no `style="…"` attribute, because `style-src 'self'` blocks it and hashes cannot allow it. A style a page needs, such as a role's width on the career timeline, comes from a stylesheet file the build writes. A test fails on any `style=` in the built pages. Allowing inline style attributes (`style-src-attr 'unsafe-inline'`) is an ask-first change.
- The policies enforce SPEC-site's rule of no third-party requests: fonts, scripts, images and connections come only from the site's own address.

Caching:

| Path | `Cache-Control` |
|---|---|
| `/assets/*` (hashed names) | `public, max-age=31536000, immutable` |
| HTML pages, `/sw.js`, `/manifest.webmanifest`, `/device-index.json`, the three documents, the icons | `public, max-age=0, must-revalidate` (Vercel's default) |
| `/api/*` | `no-store`, set by the function |

## Rate limits

Two Vercel WAF rules, counted per IP address, answering 429:

| Rule | Matches | Allows |
|---|---|---|
| "chat rate limit" | Request path starts with `/api/chat` (so `/api/chat/` too), method `POST` | 20 per 10 minutes (row 112) |
| "status rate limit" | Request path starts with `/api/status` | 30 per 10 minutes |

Denied requests cost nothing and do not run the function. SPEC-chat already maps a 429 to its alert; its text changes to "Try again in a few minutes", for Peter's approval with the other wordings. `/api/cron/health` answers 401 at once without the right `CRON_SECRET`, before it reads anything.

The rate limits slow one address; they do not cap spend. The daily cap below does.

## Spend limits

| Limit | Value | Warning | At the limit |
|---|---|---|---|
| Request size, in code | 10,000 characters of new question, 40,000 characters of earlier turns (oldest dropped first), 256 KB per request (row 125) | — | Over 256 KB: 413 `REQUEST_TOO_LARGE` |
| Daily cap, in code | $8 of estimated cost a UTC day (row 121) | — | New turns are refused until 00:00 UTC (4 pm Pacific in winter, 5 pm in summer) with the "limit reached" state; one push |
| Anthropic, workspace `resume-chat` | $20 a month (row 113) | Anthropic emails at $10; the server pushes at 75% | Anthropic rejects calls; the chat shows "limit reached" and pushes once a day |
| Vercel | $20 on-demand budget beyond the $20 monthly credit (row 116) | Email and the webhook to the ntfy push at 50%, 75% and 100% | Notify only; production never pauses |
| Upstash | $1 a month, pay as you go ([decision 0022](../docs/decisions/0022-question-log-store.md)) | — | The database slows; see "The store fails" below |

- The evals use a second workspace, `resume-evals`, with its own key and a $5 monthly limit, so eval runs never spend the visitors' budget and the estimates stay about visitors.
- The chat's API key is a service-account key scoped to `resume-chat`, kept only in Vercel's Production environment as a Secret variable.

**Prompt caching.** The chat route sets TanStack AI's `promptCache` to `"short"`, its default: a 5-minute cache. The Anthropic adapter then marks the tools, the system prompt with the core, and the conversation up to the newest question. Repeated text costs $0.10 per million tokens instead of $2 on a turn's later model calls and on a question within 5 minutes of the last (row 125). A 1-hour cache is a later choice, once the totals show how far apart visitors' questions are.

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

**The daily cap.** Before a turn's first model call, the handler calls `budget.reserve()`:

1. It adds the worst-case cost of one turn under the size caps and SPEC-chat's limits, $0.40 (6 model calls, 2,000 answer tokens), to the day's total in one atomic step.
2. If the total would pass $8, it takes the reservation back and refuses with `DAILY_LIMIT`.
3. After the turn, `telemetry.record()` replaces the reservation with the real cost.
4. A reservation that is never settled (a crashed function) stays counted for the day, which errs toward pausing.

Twenty parallel requests therefore reserve $8 before any of them runs, and the cap holds.

**The monthly limit.** The handler reads the Anthropic error's status and body, not its message text, because Anthropic's SDK puts the reason only in the body:

- HTTP 400 with `error.type` `invalid_request_error` and an `error.message` that starts "You have reached your specified";
- HTTP 429 with `error.details.error_code` `enforced_spend_limit_reached`.

Either gives `errorCode: "SPEND_LIMIT"` and marks the day. For the rest of that UTC day, `budget.reserve()` refuses with `SPEND_LIMIT` before calling the model, so visitors get the state at once and no call is wasted. A test builds the SDK's real error class with the documented bodies.

**How the limit state reaches the browser.**

- A refusal before the model call (`DAILY_LIMIT`, or `SPEND_LIMIT` once the day is marked) is an HTTP 503 with SPEC-chat's `ChatError` shape and that code. Its telemetry outcome is `rejected`.
- A `SPEND_LIMIT` met during a turn arrives as the stream's error event with that code. Its outcome is `error`.
- The browser shows the "limit reached" state for both, with Peter's email, a link that opens the resume, and no Try again. The input stays for the next day or month.
- The saved answer keeps the outcome `limit`, so a reload shows the same state.
- The words come to Peter with the other wordings. These are amendments to SPEC-chat (below).

## The question log, daily totals, alerts and status

One module, `src/ops/`, behind a small interface. The routes build it from the environment; tests build it with fake servers.

```ts
export type OpsEnv = {
  VERCEL_ENV?: string;          // the store and alerts are used only in "production"
  KV_REST_API_URL?: string;     // set by the Upstash integration, Production only
  KV_REST_API_TOKEN?: string;
  NTFY_TOPIC_URL?: string;      // https://ntfy.sh/<secret topic>
  ANTHROPIC_API_KEY?: string;   // only whether it is set is read, for status()
};

export type Ops = {
  log: QuestionLog;                                     // SPEC-chat's interface
  budget: { reserve(): Promise<{ ok: true; reservation: string } | { ok: false; errorCode: "DAILY_LIMIT" | "SPEND_LIMIT" }> };
  telemetry: { record(event: ChatTurnEvent, reservation?: string): Promise<void> };
  totals(days: number): Promise<DailyTotals[]>;
  health: {
    save(run: HealthRun): Promise<void>;                // the Vercel health job's result
    heartbeat(): Promise<void>;                         // the GitHub health check ran
    last(): Promise<{ vercel: HealthRun | null; githubAt: string | null }>;
  };
  status(): Promise<OpsStatus>;                         // for GET /api/status, no secrets
};

/** In-memory parts outside production; in production, a missing variable is reported, never hidden. */
export function createOps(env: OpsEnv, io?: { fetch?: typeof fetch; now?: () => Date; print?: (line: string) => void }): Ops;

/** For `bun run questions` on Peter's laptop, with the read-only token. */
export function createOpsReader(env: { KV_REST_API_URL: string; KV_REST_API_READ_ONLY_TOKEN: string }, io?: { fetch?: typeof fetch }): {
  entries(days: number): Promise<QuestionLogEntry[]>;
  totals(days: number): Promise<DailyTotals[]>;
};
```

- All store calls go through Upstash's REST API with `fetch` and `Authorization: Bearer`. Each turn makes one pipeline request after it ends, plus the atomic reservation before it. No package is added.
- **The store fails.** A store error never breaks an answer. `reserve()` then allows the turn: Anthropic's $20 is still the hard cap, and refusing every visitor during a store outage is worse. `record()` and `append()` resolve, and an `ops_error` line is printed. A `storefail` push goes out, at most once a day.
- **A setting is missing in production.** A missing store or ntfy variable keeps answers working, prints `ops_error` with `missing_config` on every turn, and shows as `false` in `/api/status`, so the health checks fail. The setup list puts the API key in last, after the store and the rate limits, so the chat never runs in production without its guards.

| Key | Holds | Expires |
|---|---|---|
| `qlog:<YYYY-MM-DD>` | A list of `QuestionLogEntry` JSON, appended | 00:00 UTC on the 90th day after its day (`EXPIREAT`) |
| `qstats:<YYYY-MM-DD>` | A hash: turns by outcome, model calls, reads, citations, removed markers, the five token counts, errors by code, the summed duration | The same |
| `qslow:<YYYY-MM-DD>` | A sorted set with one member, the day's longest duration (`ZADD GT`) | The same |
| `qcost:<YYYY-MM-DD>`, `qcost:<YYYY-MM>` | The day's cost with open reservations, and the month's settled cost, in millionths of a dollar | The day's with `qstats`; the month's 90 days after the month ends |
| `limit:spend:<YYYY-MM-DD>` | The day has met Anthropic's limit | At the end of its day |
| `alert:<kind>:<period>` | A marker that an alert went out | After its period |
| `health:vercel`, `health:github` | The last Vercel health run and its result; when the GitHub check last ran | 7 days |

- `telemetry.record()` prints SPEC-chat's `chat_turn` line to the function log, adds the turn to `qstats` and `qslow`, settles its reservation, adds to the month, and checks the alerts. It holds no question text, `threadId` or IP address.
- Writes made after the last chunk: the handler test proves the response ends only after them. Whether they also finish on Vercel when the visitor stops a turn is a plan check.

**Limit alerts** (rows 115 and 121) are ntfy pushes with priority `urgent`, a title and one line naming the next step:

| Kind | When | At most |
|---|---|---|
| `spend75` | The month's estimate passes 75% of the limit. Example: "Chat at 75% of its $20 limit for October. Raise it in the Anthropic Console, then in src/ops/limits.ts." | Once a month |
| `daycap` | A turn is refused with `DAILY_LIMIT` | Once a day |
| `spendlimit` | A turn meets Anthropic's limit | Once a day |
| `storefail` | A store call fails | Once a day |
| `health` | A health check fails, or finds that the other did not run | Once a day from the Vercel job; once per run from GitHub, which holds no store token. On a failing day Peter can get one of each |

- In the server, the marker is claimed with `SET NX` just before the push and deleted if the push fails, so a failed push is tried again on the next turn instead of being lost.
- Vercel's spend webhook posts to the same topic.
- An alert holds no visitor text. The topic name is a secret: anyone who knows it can read and send to it.

**The status route.**

- `GET /api/status` returns, with `no-store` and no secrets:
  - the live commit (`VERCEL_GIT_COMMIT_SHA`);
  - whether the store, the alerts and the real model are configured;
  - when the Vercel health job last ran, with its result;
  - when the GitHub check last ran.
  The answer is cached in the function for 60 s, so repeated calls do not read the store. The commit is public anyway; the repository is public.
- `POST /api/status` with `Authorization: Bearer $HEALTH_SECRET` records the GitHub check's heartbeat. Any other `POST` gets 401.

`bun run questions` reads the last 7 days with the read-only token. It prints:
- the entries, newest first;
- a count per outcome and the most read sources;
- the daily totals, with the day's and the month's cost against the cap and the limit.

## Smoke check and health checks

`src/ops/smoke.ts` holds the checks. `bun run smoke <origin> [--browser] [--production] [--documents <dir>]` and the Vercel health job both run them. They ask the model nothing, so they cost nothing.

- **Pages.**
  - `/`, `/resume` and one source page return 200 with HTML, a title and the canonical address.
  - `/sources/does-not-exist` returns 404 with the not-found page.
- **Headers.**
  - Each HTML page carries every header above and its own policy tag, and neither policy has `'unsafe-inline'` or `'unsafe-eval'`.
  - An `/assets/` file is immutable; `/sw.js` revalidates.
- **Chat requests.**
  - `POST /api/chat` with a malformed body and no `Origin` header returns 400 with SPEC-chat's `ChatError` shape.
  - The same with `Origin: https://example.com` returns 403 `FORBIDDEN_ORIGIN`.
- **Status.** `GET /api/status` reports the store, the alerts and the real model as configured, in production.
- **With `--documents <dir>`:** each served document is byte for byte the file in that folder, and the PDF has 2 pages (`pdfinfo`, on the runner).
- **With `--browser`:**
  - Chrome loads `/`, `/resume` and `/sources/does-not-exist`, records `securitypolicyviolation` events and page errors, and fails on any.
  - The chat input becomes usable after hydration.
  - A reload with the network off still shows `/`.
- **With `--production`:**
  - The three other hosts and the project's `.vercel.app` address return 308 for `/resume?x=1` to `https://peterkloss.dev/resume?x=1`.
  - Then malformed chat requests are sent until one gets 429, which must happen by the 41st.
- **On a protected deployment URL:** requests carry `x-vercel-protection-bypass` from `VERCEL_AUTOMATION_BYPASS_SECRET`, and the browser also sends `x-vercel-set-bypass-cookie: true`, so the service worker's own requests pass too.

The two health checks watch each other (row 122):

| Check | Runs | Checks | On failure |
|---|---|---|---|
| Vercel health job: `GET /api/cron/health` with `Authorization: Bearer $CRON_SECRET` | Vercel Cron, daily at 15:17 UTC | The smoke check without `--browser`, `--production` or `--documents`, against peterkloss.dev. Yesterday's totals, which fail when at least 5 turns reached the model and 1 in 5 or more ended in `error`, or when any turn met Anthropic's limit. That the GitHub check's heartbeat is less than 26 hours old | One ntfy push a day; the run is saved in `health:vercel` |
| GitHub health check: `.github/workflows/health.yml` | GitHub schedule, daily at 21:17 UTC, and by hand | The smoke check with `--browser --production --documents documents/` from outside Vercel. That `/api/status` shows a passing Vercel run less than 26 hours old. That the live commit equals the newest commit on `main` that changed a path in `scripts/site-files.txt`, or that this newest commit is less than 2 hours old. It posts its heartbeat at the end, pass or fail | An ntfy push from the workflow |

- The error share counts only turns that reached the model: `answered`, the refusals, `stopped` and `error`. The health checks' malformed requests and the cap's refusals are `rejected` and do not count.
- GitHub stops a schedule after 60 days with no repository activity; the Vercel job then reports the missing heartbeat. If Vercel itself is down, the GitHub check reports it. The runbook covers turning a schedule back on.

## CI

`.github/workflows/ci.yml` runs on every push and pull request, on `ubuntu-24.04` (pinned: `ubuntu-latest` moves to 26.04 in November 2026). Every helper is pinned to an exact commit, and each workflow grants only the permissions it needs (row 120).

- **Job `test`:**
  1. `actions/checkout`, then `oven-sh/setup-bun` with `bun-version: 1.4.2`.
  2. `sudo apt-get update && sudo apt-get install -y poppler-utils`.
  3. `bun ci`, then the document check.
  4. `bun run build:site`.
  5. `bun test`, with `CHROME_PATH=/usr/bin/google-chrome` for the browser test.
- **Job `audit`:** `bun audit --audit-level=high`, as its own job, so a registry outage shows as its own failure.

There is no `private.yaml` in CI, so only public documents are built, and the private-detail test skips. The evals never run in CI: each run costs money and needs Peter's approval (SPEC-chat). This replaces the plan's line "CI that … runs the evals".

`.github/workflows/deploy-check.yml` (`permissions: contents: read, statuses: write`) and `.github/workflows/health.yml` are described above. GitHub's helpers run on GitHub's own Node.js; no code in this repository does (row 120).

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

- Bun loads a file named `.env` into every run on its own, tests included. So the local file is `.secrets/local.env`, which Bun loads only when told: `bun run questions` and `bun run evals` pass `--env-file=.secrets/local.env`, and nothing else does. A file named `.env` is never created. `.gitignore` gains `.secrets/` and `.env*`.
- GitHub holds no store token.
- Agents never read, print or store a value from this table.

## Setup list

Peter does these steps once, in this order, so that the chat never runs in production before its guards. The plan turns them into `docs/runbooks/setup.md` with links, and each step names how to check it.

1. Buy peterkloss.dev, pkloss.dev and pwk.dev (decision 0018).
2. ntfy: install the app on his phone; subscribe to a long random topic name; send a test push.
3. Anthropic Console: workspaces `resume-chat` ($20 a month, email at $10) and `resume-evals` ($5); a service-account key for each, kept aside for now.
4. Vercel: sign up for Pro, and import `loriensleafs/resume` with the variables `NTFY_TOPIC_URL`, `CRON_SECRET` and `HEALTH_SECRET` (Production), and `CHAT_FAKE=1` (Preview). There is no Anthropic key yet, so the first deployment cannot call the model. Keep Fluid compute on.
5. Vercel, Deployment Protection: Standard Protection with Vercel Authentication; create an automation bypass secret.
6. Vercel, Marketplace: add Upstash Redis, pay as you go, with a $1 budget; attach its variables to Production only.
7. Vercel, Firewall: the two rate-limit rules.
8. Vercel, Spend Management: a $20 budget, notify only, with the webhook set to the ntfy topic URL.
9. GitHub, Actions secrets: the Actions rows of the table above.
10. Vercel, Deployment Checks: require `ci / test`, `ci / audit` and `deploy-check (production)`; check that domain auto-assignment is on.
11. Vercel, Domains: add peterkloss.dev, www.peterkloss.dev, pkloss.dev and pwk.dev, all served by the project. An agent writes the project's `.vercel.app` address into `vercel.json`, with Peter's approval of that release.
12. Vercel, Environment Variables: add `ANTHROPIC_API_KEY` (Production, Secret), then redeploy production.
13. Check: `/api/status` reports everything configured; run both health checks by hand once; ask the live chat one question.

## Runbooks

`docs/runbooks/` has one file per alert, each with what it means, the first thing to check and the fix:

- **`spend-75.md`:** `bun run questions` shows which days spent. Raise the limit in the Anthropic Console and in `src/ops/limits.ts`, or leave it.
- **`day-cap.md`:** the chat is paused until 00:00 UTC. `bun run questions` shows whether the spend looks real or scripted. Raise the cap in `src/ops/limits.ts` (a release) only if it is real.
- **`spend-limit.md`:** the chat is paused for the month. Raise the limit in the Console, where it takes effect at once, then update `src/ops/limits.ts`. The day's marker clears at 00:00 UTC.
- **`store-failed.md`:** the Upstash console shows whether the budget or an outage caused it. The chat keeps answering, with Anthropic's limit as the cap.
- **`health-failed.md`:** which check failed:
  - a page, header or policy failure points at the last release: roll back;
  - `missing_config` points at the environment variables;
  - an error share points at `bun run questions` and its errors by code;
  - a lagging live commit points at a skipped build (Redeploy without the ignore step) or at domain auto-assignment;
  - a missing heartbeat points at the other schedule, and how to turn it back on.
- **`vercel-spend.md`:** the usage page shows the cost; the WAF's traffic view shows abuse.
- **`rollback.md`:** the rollback steps above, ending with domain auto-assignment back on.

## Changes to other specs

Approving this spec approves these amendments:

- **SPEC-chat.**
  1. `ChatDeps` gains `budget` and `telemetry`. The handler:
     - calls `budget.reserve()` before the first model call, and on refusal answers 503 with the code;
     - hands each `ChatTurnEvent` and its reservation to `telemetry.record()` instead of printing them.
     Tests pass in-memory ones.
  2. `turnLimits` gains `historyCharacters: 40_000` (earlier turns, oldest dropped first) and `requestBytes: 262_144` (413 `REQUEST_TOO_LARGE`); `questionCharacters` stays 10,000 (row 125).
  3. `ChatError.code` gains `REQUEST_TOO_LARGE`, `FORBIDDEN_ORIGIN`, `DAILY_LIMIT` and `SPEND_LIMIT`.
  4. Error codes:
     - `ChatTurnEvent.errorCode` gains `DAILY_LIMIT` and `SPEND_LIMIT`;
     - the handler finds `SPEND_LIMIT` from the Anthropic error's status and body, as above;
     - the saved answer's outcome gains `limit`, and the views gain the "limit reached" state.
  5. `ChatTurnEvent` gains `cacheWriteTokens` and `cacheWrite1hTokens`, and `inputTokens` means uncached input only.
  6. The route sets `promptCache: "short"` explicitly.
  7. The 429 text becomes "Try again in a few minutes".
  8. `bun run questions` also prints the daily totals and the day's and the month's cost.
  9. Origin: the handler rejects a request whose `Origin` header differs from the request's own origin with 403 `FORBIDDEN_ORIGIN`, so other sites' pages cannot spend the chat's budget through their visitors' browsers. A request with no `Origin` header passes this check; the rate limits and the cap still apply to it.
  10. The handler test proves the response ends only after the log and telemetry writes.
  11. Outside production, the route always uses the fake model; in production, it ignores `CHAT_FAKE`.
  12. The evals key lives in `.secrets/local.env`, not `.env`.
- **SPEC-site.**
  1. `buildSite()` writes each page's policy tag with its script hashes, and copies `documents/` instead of building documents.
  2. Prerendered HTML holds no `style` attribute.
  3. Unknown paths get the prerendered not-found page, which shows the first view, with status 404.
  4. `bun run preview` serves the headers and cache rules of `vercel.json`, as Vercel does.
  5. The service worker's registration moves from an inline script to a file.
  6. The site's font files are committed.
- **SPEC-content.** `bun run documents` writes the public documents to `documents/`; a test checks that they match a fresh build and that the PDF has 2 pages.
- **SPEC-agents.**
  - AGENTS.md: a push that changes a path in `scripts/site-files.txt` is a release and needs Peter's approval.
  - `bun run smoke`, `bun run documents` and the runbooks join the commands.
  - The edit-resume skill runs `bun run documents`.

## Tech Stack

- Vercel Pro, Bun runtime `1.4.x` (Beta), Fluid compute, Vercel Cron, Nitro's Vercel output from TanStack Start ([decision 0012](../docs/decisions/0012-vercel-pro-host.md), research 12).
- Upstash Redis through its REST API with `fetch` ([decision 0022](../docs/decisions/0022-question-log-store.md)).
- ntfy.sh, called with `fetch`.
- GitHub Actions, each pinned to an exact commit: `actions/checkout`, `oven-sh/setup-bun`, `vercel/repository-dispatch/actions/status`.
- Playwright, already in the stack for the browser test, drives the smoke check's `--browser` part.

No npm package is added. Approving this spec approves the three GitHub helpers and the two outside services.

## Commands

```sh
bun run documents                        # rebuilds documents/ from resume.yaml (needs Chrome)
bun run build:site                       # copies documents/, writes each page's policy tag
bun run preview                          # serves dist/ with production's headers
bun run smoke http://localhost:4173 --browser --documents documents/   # against the preview
bun run smoke https://peterkloss.dev --browser --production --documents documents/   # the outside check by hand
bun run questions                        # entries, daily totals and costs; loads .secrets/local.env
bun test tests/ops                       # seam 2
bun test                                 # every test
```

## Project Structure

```text
vercel.json                        bunVersion, build commands, ignore step, redirects, crons, headers
documents/                         Peter-Kloss-Resume.pdf, .docx, .txt: the committed public documents
scripts/site-files.txt             the paths whose change makes a push a release
scripts/ignore-build.sh            exit 1 only when a listed path changed since the last deployment
scripts/documents.ts               `bun run documents`
scripts/smoke.ts                   `bun run smoke`
scripts/questions.ts               `bun run questions` (from SPEC-chat), extended with the totals
src/ops/ops.ts                     createOps(), createOpsReader()
src/ops/upstash.ts                 the REST calls, the key layout, the reservation and the expiry rules
src/ops/alerts.ts                  the alert rules, the markers and the ntfy push
src/ops/limits.ts                  the size caps' worst-case turn, the daily cap, the monthly limit, the 75% threshold, the prices
src/ops/smoke.ts                   the checks shared by `bun run smoke` and the Vercel health job
src/site/routes/api.chat.ts        builds createOps(process.env) and passes log, budget and telemetry to handleChat()
src/site/routes/api.status.ts      GET and POST /api/status
src/site/routes/api.cron.health.ts the Vercel health job
.github/workflows/ci.yml           jobs test and audit
.github/workflows/deploy-check.yml the status "deploy-check (production)"
.github/workflows/health.yml       the outside health check
docs/runbooks/                     setup, rollback and one file per alert
tests/ops/ops.test.ts              seam 2
tests/ops/fake-upstash.ts          an in-test Upstash REST server for the commands the module uses
tests/ops/fake-ntfy.ts             an in-test ntfy server that records pushes
tests/site/config.test.ts          vercel.json, the policy tags and the ignore step (seam 1)
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
const tickets = await Promise.all(Array.from({ length: 25 }, () => ops.budget.reserve()));
expect(tickets.filter((t) => t.ok)).toHaveLength(20); // 20 × $0.40 reaches the $8 cap
```

## Testing Strategy

`bun test`, at the three seams Peter confirmed on 2026-10-27 (row 117). No test calls Upstash, ntfy, Anthropic, GitHub or Vercel.

1. **The site seam, extended** ([SPEC-site](SPEC-site.md) seams 1 and 2):
   - `tests/site/config.test.ts` reads `vercel.json` and the build output:
     - `bunVersion` is `1.4.x`;
     - the four hosts redirect permanently to peterkloss.dev with the path, and the `.vercel.app` rule leaves `/api/` alone;
     - every header in the tables is present for its paths;
     - each HTML page, the not-found page included, starts with a policy tag that lists exactly the hashes of its own inline scripts;
     - no built page holds a `style=` attribute;
     - the chat route's maximum duration is 90 s, and the cron entry calls `/api/cron/health`.
   - `scripts/ignore-build.sh`, run in a temporary git repository with a shallow clone:
     - it builds for a change to a listed path, also when the previous deployment is more than 10 commits back;
     - it skips a docs-only change across several commits;
     - it builds on an empty previous commit;
     - it exits 0 on an unknown commit and on a failing git command.
   - The browser test, against `bun run preview` with production's headers, fails on any `securitypolicyviolation` event on every page it visits, online and offline.
   - `tests/content/documents.test.ts`: the committed documents match a fresh build, spacing ignored, and the PDF has 2 pages.
2. **The ops module**, `tests/ops/ops.test.ts`, through `createOps()` and `createOpsReader()`, against the in-test Upstash and ntfy servers and a fixed clock:
   - **Log and contract.**
     - An appended entry comes back from `entries(7)`; entries from 8 days ago are not listed.
     - A day's keys expire at 00:00 UTC on the 90th day after it.
     - The QuestionLog contract tests from SPEC-chat pass against both the in-memory log and the Upstash one.
   - **Totals and cost.**
     - `record()` adds a turn to the day's totals; `totals(1)` shows the outcome counts, the five token counts and the longest duration.
     - A turn with known token counts, 1-hour writes among them, adds the worked example's cost from `limits.ts`, counted by hand.
   - **Daily cap.**
     - 25 parallel `reserve()` calls on an empty day: 20 succeed and 5 refuse with `DAILY_LIMIT`.
     - Settling a reservation with a smaller real cost frees room for another turn.
     - One `daycap` push that day; the next UTC day allows turns again.
   - **Monthly limit.**
     - After a `SPEND_LIMIT` turn, `reserve()` refuses with `SPEND_LIMIT` for the rest of that day.
     - One `spendlimit` push.
   - **Alerts.**
     - The month's estimate crosses 75%: one `spend75` push, and none again that month.
     - A push that fails is tried again on the next turn.
     - A push body holds no question text.
   - **Store failures.**
     - With the Upstash server returning 500: `reserve()` allows the turn, `record()` and `append()` resolve, an `ops_error` line is printed, and one `storefail` push goes out that day.
   - **Health and status.**
     - `health.heartbeat()` and `health.save()` show in `health.last()` and in `status()`.
     - `status()` reports a missing ntfy variable as `false`, and prints `missing_config`.
   - **Guards.**
     - With `VERCEL_ENV` `preview` and store variables present: no server is called.
     - The reader with the read-only token makes no write command.
3. **The smoke check**, `tests/site/smoke.test.ts`:
   - `bun run smoke --browser --documents documents/` against `bun run preview` passes.
   - It fails, naming the cause:
     - when one header is removed;
     - when a page has an unhashed inline script;
     - when a served document differs from the committed one.
   - The Vercel health job's checks fail and name the error share when run against the preview and the fake Upstash holding a day of 10 turns with 3 errors and 30 rejected requests.
   - A GitHub heartbeat older than 26 hours fails the job.

The real platform is checked by `deploy-check`, by the two health checks and by step 13 of the setup list.

## Boundaries

- **Always:**
  - keep every setting that Vercel reads from the repository in the repository;
  - keep previews and local runs on the fake model and the in-memory store, by code;
  - commit a resume change together with its rebuilt documents;
  - treat a failed store or push call as a printed `ops_error`, never as a failed answer;
  - run `bun run build`, `bun run build:site` and `bun test` before a commit.
- **Ask first:**
  - pushing a change to a path in `scripts/site-files.txt` (a release), or changing that list;
  - a change to a limit, the cap, a size cap, a header, the policy, a redirect, a rate-limit rule or a cache rule;
  - a new outside service, GitHub helper or package;
  - a change to the key layout or to what an alert says;
  - allowing inline style attributes.
- **Never:**
  - sign in to a dashboard; buy, upgrade or change a plan;
  - read, print or commit a key, token, secret or topic name; create a `.env` file;
  - force-promote a deployment, or turn off a Deployment Check or domain auto-assignment;
  - put visitor text, an IP address or a `threadId` in an alert, a total, a status or a log line;
  - add `'unsafe-inline'` or `'unsafe-eval'` to a policy;
  - let a preview reach the real model or the real store;
  - add Node or Python tooling to this repository.

## User Stories

1. As a recruiter, I want peterkloss.dev to load fast and safely over HTTPS, so that the link I was sent looks trustworthy.
2. As a visitor who types pkloss.dev or pwk.dev, I want to land on the same page at peterkloss.dev, so that a short address works.
3. As a visitor with a shared link to a source page, I want the redirect to keep the path, so that I see the page I was sent.
4. As a visitor on a slow connection, I want hashed files cached for a year and pages revalidated, so that repeat visits are fast and never stale.
5. As a visitor who asks many questions, I want the rate limit high enough that I never see it, so that a long conversation is not cut off.
6. As a visitor in a busy office on one network, I want the limit to be generous, so that colleagues do not block each other.
7. As a hiring manager, I want to paste a whole job description and ask follow-ups about it, so that the fit check sees the full posting.
8. As a visitor when the day's or the month's budget is spent, I want a clear message with Peter's email and the resume, also after a reload, so that I can still reach him.
9. As a visitor, I want the site to load no third-party code, so that my visit is private and an injected script cannot run.
10. As a visitor, I want the site never shown inside another site's frame, so that nobody can dress it up as something else.
11. As a visitor downloading the PDF, I want the same 2-page file that was tested, so that it prints as Peter intended.
12. As Peter, I want every release to pass CI, the audit and a smoke check in Chrome on the real deployment before it goes live, so that a broken build never reaches a recruiter.
13. As Peter, I want an older deployment never to replace a newer one, so that two quick pushes cannot roll the site back.
14. As Peter, I want docs-only pushes to build nothing, so that writing specs never touches the live site.
15. As Peter, I want a one-click rollback with written steps, so that I recover in seconds.
16. As Peter, I want previews that cost nothing and cannot expose the key, enforced in code, so that branches are safe to push.
17. As Peter, I want a daily cap that holds under parallel requests, so that one script cannot spend the whole month in an hour during my job search.
18. As Peter, I want a cap on how much text one request can send, so that a forged conversation cannot cost dollars.
19. As Peter, I want prompt caching on, so that the core and a pasted posting cost full price only once.
20. As Peter, I want a push when the daily cap is reached, so that I can tell a real busy day from abuse.
21. As Peter, I want a push on my phone when the chat passes 75% of its monthly budget, so that I can raise it before visitors hit the limit.
22. As Peter, I want a push when the monthly limit is reached, and the chat to stop calling Anthropic for the rest of that day, so that I know and no call is wasted.
23. As Peter, I want a push when the store fails, so that I know the totals and the cap are blind.
24. As Peter, I want two health checks that watch each other, so that neither can stop quietly.
25. As Peter, I want a health check to fail when a setting is missing, so that a misconfigured production does not run for days.
26. As Peter, I want a health check to fail when the live site lags `main`, so that a skipped build or a rollback I forgot is caught.
27. As Peter, I want alerts at most once a day for each kind, and a failed push tried again, so that my phone is not flooded and no alert is lost.
28. As Peter, I want daily totals of outcomes, tokens and errors for 90 days, so that I see trends in cost and failures.
29. As Peter, I want a cost estimate that counts cache writes, so that the 75% push and the daily cap fire on time.
30. As Peter, I want `bun run questions` to show the day's and the month's cost against the cap and the limit, so that I can plan.
31. As Peter, I want the question log deleted by the store itself, so that the 90-day promise to visitors holds without a job to maintain.
32. As Peter, I want only my laptop to hold a store token outside Vercel, and only the read-only one, so that a leak cannot change or delete the log.
33. As Peter, I want my local keys in a file Bun never loads on its own, so that tests never reach a real service.
34. As Peter, I want the store and the alerts to cost cents a month, so that the site stays cheap.
35. As Peter, I want a hard $20 cap on the model bill, so that abuse cannot cost more.
36. As Peter, I want Vercel's spend to notify me and never take the site down, so that a recruiter never finds it paused.
37. As Peter, I want the evals on their own workspace and limit, so that my testing never spends the visitors' budget.
38. As Peter, I want a numbered setup list that adds the key last, so that the chat never runs in production without its guards.
39. As Peter, I want a runbook for every alert, so that I know the first thing to do when my phone buzzes.
40. As Peter, I want CI on a pinned image with Bun 1.4.2, Chrome and poppler, and pinned helpers, so that nothing changes under me.
41. As Peter, I want no Node or Python tooling in this repository, so that it stays pure Bun.
42. As an engineer reviewing the repository, I want the platform settings in `vercel.json` and the workflows, so that I can read how the site is run.
43. As an engineer reviewing the repository, I want the strict policy, its probe and its checks on the real deployment on record, so that I see the security work.
44. As an attacker, I should not be able to embed the chat in another site and spend its budget through visitors' browsers.
45. As an attacker with a script, I should be slowed at about 20 questions per 10 minutes per address, held to the size caps, stopped at $8 a day, and capped at $20 a month.
46. As an attacker hammering the status route, I should hit its rate limit, and never reach the store more than once a minute.
47. As an attacker who learns the ntfy topic, I should find no visitor data in the alerts.
48. As a future agent, I want tests that name the broken header, alert rule, expiry, reservation or document, so that I fix the cause.
49. As a future agent, I want the release rule in AGENTS.md and one list of site files, so that I know which pushes need Peter's approval.

## Out of scope

- Buying the domains, signing up and paying: Peter does these (setup list).
- Rolling Releases: the traffic is too low to compare a canary (row 107).
- A real text message (Twilio), log drains, outside log or uptime services, and Vercel's anomaly alerts (rows 110, 115, 121).
- A 1-hour prompt cache, until the totals show it would save money.
- A second region, a staging environment, Terraform for the WAF rules, bot protection rules, and HSTS preload submission.
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
  - both health checks pass by hand;
  - `/api/status` reports everything configured.
- A health run against a failing target reaches Peter's phone.
- Peter reviews the setup list and the runbooks and approves them.

## Open Questions

None for this spec. For the plan:

- Which Bun runs Vercel's build, and whether `packageManager` pins it.
- Whether Upstash's read-only token allows `LRANGE`, `HGETALL` and `ZRANGE` (documented only as "read commands"), and how the reservation's atomic step is written (a pipeline with `INCRBY` and a compare, or a short script).
- Whether Vercel's redirect `source` accepts the negative lookahead `/((?!api/).*)`.
- Whether the Nitro function rule matches TanStack Start's chat route in `.vercel/output`, and how an unknown path reaches the static not-found page with status 404.
- Whether Vercel Cron reaches `/api/cron/health` under Standard Protection, and which host it calls.
- Whether writes made after the last chunk finish on Vercel when the visitor stops a turn. If not, Vercel's `waitUntil` needs `@vercel/functions`, a new package for Peter's approval.
- For Peter, with the other wordings: the "limit reached" texts (day and month) and the new 429 text.
