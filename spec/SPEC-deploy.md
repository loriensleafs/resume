# Spec: deploy

Draft for Peter's review, 2026-10-27. Peter's answers are rows 107 to 117 of the [interview record](../docs/design/interview-2026-10-26.md); the facts are in [research 12](../docs/research/12-deploy-platform.md).

## Objective

Put the site and the chat on the internet at `https://peterkloss.dev`, and keep them safe, cheap and observable without Peter watching them. The site serves recruiters, hiring managers and engineers during Peter's job search, when traffic is higher than usual (row 114), so a quiet failure or a spent limit must reach Peter at once.

This module owns: the Vercel project's configuration in code, the domains and redirects, the security and cache headers, the rate limit, the spend limits, the question log's store, the daily totals, the limit alerts, the smoke check, the health check, CI, the setup list Peter follows in the dashboards, and the runbooks. It implements SPEC-chat's `QuestionLog` and receives its turn telemetry.

Acceptance criteria:

- A push of site changes to `main` goes live on peterkloss.dev only after CI and the smoke check on the new deployment pass (row 107). A push with no site changes builds nothing.
- Previews use the fake model and hold no API key (row 108).
- pkloss.dev, pwk.dev and www.peterkloss.dev answer with a 308 to the same path and query on peterkloss.dev ([decision 0018](../docs/decisions/0018-domains.md)).
- Every HTML response enforces the Content Security Policy below, with no `'unsafe-inline'` and no `'unsafe-eval'`, and the browser reports no violation online or offline.
- One internet address can send at most 20 chat questions in 10 minutes (row 112).
- The chat's Anthropic workspace stops at $20 a month (row 113). At the limit, visitors see a "limit reached" state, not a retry (row 114).
- Question-log entries and daily totals are deleted after 90 days by the store itself ([decision 0022](../docs/decisions/0022-question-log-store.md)).
- Peter's phone gets an urgent push when the month's estimated chat cost passes 75% of the limit, when the limit is reached, and when the daily health check fails (rows 111 and 115).
- `bun test` passes with no account, key or network beyond the test's own servers.

## What runs where

| Part | Where it runs | Set in code | Set by Peter in a dashboard |
|---|---|---|---|
| Prerendered pages, assets, documents, service worker | Vercel's CDN | `vercel.json`, the Vite and Nitro config | — |
| `/api/chat` | A Vercel Function on the Bun runtime, region `iad1` | Nitro `vercel.functionRules` | Environment variables |
| Domains and redirects | Vercel | `vercel.json` `redirects` | Adding the three domains to the project |
| Security and cache headers | Vercel | `vercel.json` `headers`, the build output | — |
| Rate limit | Vercel WAF | — (rate-limit rules cannot live in `vercel.json`) | One WAF rule |
| Question log, daily totals, alert dedupe | Upstash Redis (Marketplace) | `src/ops/` | The integration, its budget |
| Limit alerts | ntfy.sh, a secret topic | `src/ops/alerts.ts` | The ntfy app on his phone |
| CI, deployment checks, health check | GitHub Actions | `.github/workflows/` | Actions secrets, Deployment Checks |
| Spend limits | Anthropic Console, Vercel, Upstash | The limit's value in `src/ops/limits.ts` | The limits themselves |

Agents never sign in to Vercel, Anthropic, Upstash, ntfy or GitHub's settings. Everything an agent can put in the repository lives there; the rest is the setup list.

## Releases

Gated auto-deploy (row 107):

1. A push to `main` reaches Vercel. The ignore command checks whether the push changes site files: `src/`, `knowledge/`, `resume.yaml`, `fonts/`, `public/`, `scripts/`, `package.json`, `bun.lock`, `vite.config.ts`, `tsconfig.json` or `vercel.json`. If not, Vercel builds nothing. The comparison is against the commit of the last deployment, not only the previous commit, so a push of several commits is judged as a whole.
2. Vercel builds a production deployment on its own URL. Deployment Checks hold it off the domains.
3. Two required checks run in GitHub Actions: `ci` (the build, `bun test` and `bun audit` on the pushed commit) and `deploy-check` (the smoke check against the new deployment's URL, sent with the automation bypass header). `deploy-check` starts on Vercel's `vercel.deployment.ready` event for production and reports its status with `vercel/repository-dispatch/actions/status@v1`.
4. When both pass, Vercel moves peterkloss.dev and the other domains to the deployment.
5. If either fails, the deployment never serves visitors, and the site stays on the last good deployment. Peter can force-promote from the dashboard; agents never do.

Because a push of site changes is the release, agents ask Peter before pushing site changes to `main`. Pushes with no site changes need no approval for deploy reasons. [AGENTS.md](../AGENTS.md) changes to say so when this module is built (SPEC-agents).

Rollback: Instant Rollback in the dashboard (Deployments, the earlier deployment, Instant Rollback) moves the domains back in seconds. A rollback turns domain auto-assignment off; after the fix, Peter turns it on again (Settings, Environments, Production). The runbook `docs/runbooks/rollback.md` has the steps.

Previews: every other branch builds a preview behind Vercel Authentication, with `CHAT_FAKE=1`, no `ANTHROPIC_API_KEY` and no store credentials (row 108). A preview writes nothing to the question log.

## Configuration in code

```jsonc
// vercel.json (shape; the plan fills the header list from the table below)
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "bunVersion": "1.4.x",                   // "1.x" would be Bun 1.3.14
  "framework": "tanstack-start",
  "installCommand": "bun ci",
  "buildCommand": "bun run build:site",
  "ignoreCommand": "bun scripts/ignore-build.ts",   // exit 0 skips the build
  "redirects": [
    { "source": "/:path*", "has": [{ "type": "host", "value": "pkloss.dev" }],
      "destination": "https://peterkloss.dev/:path*", "permanent": true }
    // the same for pwk.dev and www.peterkloss.dev
  ],
  "headers": [ /* security headers on "/(.*)"; cache rules by path */ ]
}
```

```ts
// vite.config.ts (part): the chat function's duration and region
nitro({ vercel: { functionRules: { "/api/chat": { maxDuration: 90, regions: ["iad1"] } } } });
```

The maximum duration is 90 s: above SPEC-chat's 60 s deadline, below Vercel's 300 s default, so a stuck function stops early. The plan checks that the rule matches TanStack Start's chat route in `.vercel/output`.

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

- The probe on `prototype/csp-probe` ran the prerendered pages, the design system and the service worker under this policy with no violation, online and offline (research 12). TanStack Start's per-request nonce does not fit static pages, so each page carries its own hashes.
- `buildSite()` computes the hashes after prerendering. The plan chooses how they reach the browser: a per-path header written into the build output, or a `<meta http-equiv="Content-Security-Policy">` first in each page's `<head>` with the header policy left without `default-src` and `script-src`. Either way, the browser test decides.
- The policy enforces SPEC-site's rule of no third-party requests: fonts, scripts, images and connections come only from the site's own address.

Caching:

| Path | `Cache-Control` |
|---|---|
| `/assets/*` (hashed names) | `public, max-age=31536000, immutable` |
| HTML pages, `/sw.js`, `/manifest.webmanifest`, `/device-index.json`, the three documents, the icons | `public, max-age=0, must-revalidate` (Vercel's default) |
| `/api/chat` | `no-store`, set by the function |

## Rate limit

One Vercel WAF rule, "chat rate limit": if the path is `/api/chat` and the method is `POST`, allow 20 requests per 10 minutes per IP address, then answer 429 (row 112). Denied requests cost nothing and do not run the function. Counters are per region. SPEC-chat already maps a 429 to its alert; its text changes to "Try again in a few minutes", for Peter's approval with the other wordings.

## Spend limits

| Service | Limit | Warning | At the limit |
|---|---|---|---|
| Anthropic, workspace `resume-chat` | $20 a month (row 113) | Anthropic emails at $10; the server's push at 75% | Requests fail with 400 `invalid_request_error`; the chat shows "limit reached" and pushes once a day |
| Vercel | $20 on-demand budget beyond the $20 monthly credit (row 116) | Email and the webhook to the ntfy push at 50%, 75% and 100% | Notify only; production never pauses |
| Upstash | $1 monthly budget, pay as you go ([decision 0022](../docs/decisions/0022-question-log-store.md)) | — | The database slows; a failed write never breaks an answer |

- The evals use a second workspace, `resume-evals`, with its own key and a $5 monthly limit, so eval runs never spend the visitors' $20 and the 75% estimate stays about visitors.
- The chat's API key is a service-account key scoped to `resume-chat`, kept only in Vercel's Production environment as a Secret variable.

**The spend-limit error.** When Anthropic answers 400 with a message that starts "You have reached your specified", or 429 with `error_code` `enforced_spend_limit_reached`, the handler reports `errorCode: "SPEND_LIMIT"`. The browser shows the "limit reached" state: the chat has reached its limit for this month, with Peter's email and a link that opens the resume; no Try again; the input stays, for the next month (row 114). The words come to Peter with the other wordings. This is an amendment to SPEC-chat (below).

## The question log, daily totals and alerts

One module, `src/ops/`, behind a small interface. The chat route builds it from the environment; tests build it with fake servers.

```ts
export type OpsEnv = {
  KV_REST_API_URL: string;      // set by the Upstash integration, Production only
  KV_REST_API_TOKEN: string;
  NTFY_TOPIC_URL: string;       // https://ntfy.sh/<secret topic>
};

export type Ops = {
  log: QuestionLog;             // SPEC-chat's interface
  telemetry: TurnTelemetry;     // receives SPEC-chat's ChatTurnEvent
};
export type TurnTelemetry = { record(event: ChatTurnEvent): Promise<void> };

/** Returns in-memory parts when env has no store, as in previews and tests. */
export function createOps(env: Partial<OpsEnv>, io?: { fetch?: typeof fetch; now?: () => Date; print?: (line: string) => void }): Ops;

/** For `bun run questions` and the health check, with the read-only token. */
export function createOpsReader(env: { KV_REST_API_URL: string; KV_REST_API_READ_ONLY_TOKEN: string }, io?: { fetch?: typeof fetch }): {
  entries(days: number): Promise<QuestionLogEntry[]>;
  totals(days: number): Promise<DailyTotals[]>;
};
```

All store calls go through Upstash's REST API with `fetch` and `Authorization: Bearer`, one pipeline request per turn. No package is added.

| Key | Holds | Expires |
|---|---|---|
| `qlog:<YYYY-MM-DD>` | A list of `QuestionLogEntry` JSON, appended | At the start of the 91st day after its day (`EXPIREAT`) |
| `qstats:<YYYY-MM-DD>` | A hash: turns by outcome, model calls, reads, citations, removed markers, input, cached and output tokens, errors by code, the summed duration | The same |
| `qslow:<YYYY-MM-DD>` | A sorted set with one member, the day's longest duration (`ZADD GT`) | The same |
| `qcost:<YYYY-MM>` | The month's estimated cost in millionths of a dollar (`INCRBY`) | 90 days after the month ends |
| `alert:<kind>:<period>` | A marker that an alert went out (`SET NX`) | After its period |

- `telemetry.record()` prints SPEC-chat's `chat_turn` line to the function log, adds the turn to `qstats`, `qslow` and `qcost`, and checks the alerts. It holds no question text, `threadId` or IP address. A failed store or push call prints an `ops_error` line with a code, and never breaks the answer.
- **Cost estimate.** Each turn adds input tokens × $2, cached input tokens × $0.10 and output tokens × $10 per million, Sonnet 5.5's prices ([research 11](../docs/research/11-knowledge-tooling.md)), in `src/ops/limits.ts` with the $20 limit. Cache writes cost more than plain input and the event does not count them, so the estimate runs a little low; Anthropic's own email at $10 is the exact one.
- **Limit alerts** (row 115), each an ntfy push with priority `urgent`, a title and one line that names the next step; at most one a day for each kind:
  - `spend75`: the month's estimate passes 75% of the limit. "Chat at 75% of its $20 limit for October. Raise it in the Anthropic Console, then in src/ops/limits.ts."
  - `spendlimit`: a turn ends with `SPEND_LIMIT`.
  - `health`: the health check failed (sent by the workflow).
  - Vercel's spend webhook posts to the same topic.
- An alert holds no visitor text. The topic name is a secret: anyone who knows it can read and send to it.

`bun run questions` reads the last 7 days with the read-only token: the entries newest first, a count per outcome, the most read sources, and the daily totals with the month's cost estimate against the limit.

## Smoke check and health check

`bun run smoke <origin> [--production] [--totals]` sends a short list of requests and prints one line per check. It asks the model nothing, so it costs nothing.

- `/`, `/resume` and one source page return 200 with HTML, a title and the canonical address.
- Each HTML response carries every header above, and its policy has no `'unsafe-inline'` or `'unsafe-eval'`. An `/assets/` file is immutable; `/sw.js` revalidates.
- `POST /api/chat` with a malformed body returns 400 with SPEC-chat's `ChatError` shape.
- With `--production`: `https://pkloss.dev/resume?x=1`, `https://pwk.dev/resume?x=1` and `https://www.peterkloss.dev/resume?x=1` return 308 to `https://peterkloss.dev/resume?x=1`; then malformed chat requests are sent until one gets 429, which must happen by the 41st (the window is fixed, so a burst can straddle two windows).
- With `--totals`: yesterday's daily totals, read with the read-only token. The check fails when yesterday had at least 5 turns and 1 in 5 or more ended in `error`, or when any turn ended in `SPEND_LIMIT`.
- Requests carry `x-vercel-protection-bypass` when `VERCEL_AUTOMATION_BYPASS_SECRET` is set, for a protected deployment URL.

Where it runs:

| Run | Target | Flags | On failure |
|---|---|---|---|
| `bun test` | `bun run preview` | none | The test fails |
| `deploy-check` workflow | The new deployment's URL | none | The deployment stays off the domains |
| `health` workflow, daily at 15:17 UTC and by hand | `https://peterkloss.dev` | `--production --totals` | ntfy push and GitHub's email (row 111) |

GitHub turns off a scheduled workflow after 60 days with no repository activity, and sends its notices to the user who last changed the cron line. The ntfy push does not depend on either; the runbook covers turning the schedule back on.

## CI

`.github/workflows/ci.yml`, on every push and pull request, on `ubuntu-24.04` (pinned: `ubuntu-latest` moves to 26.04 in November 2026):

1. `oven-sh/setup-bun@v2` with `bun-version: 1.4.2`; `sudo apt-get install -y poppler-utils`.
2. `bun ci` (the frozen lockfile; Bun runs no dependency scripts outside its allow list).
3. `bun run build --public`, then `bun run build:site`.
4. `bun test`, with `CHROME_PATH=/usr/bin/google-chrome` for the PDF build and the browser test.
5. `bun audit --audit-level=high`, as its own job, so a registry outage shows as its own failure.

There is no `private.yaml` in CI, so the build makes only public documents, and the private-detail test skips. The evals never run in CI: each run costs money and needs Peter's approval (SPEC-chat). This replaces the plan's line "CI that … runs the evals".

`.github/workflows/deploy-check.yml` and `.github/workflows/health.yml` are described above. Actions are pinned to a major version, and the workflows have `permissions: contents: read` (plus `statuses: write` for `deploy-check`).

## Secrets and settings

| Name | Where | Value from |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel, Production, Secret | Anthropic service-account key for `resume-chat` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel, Production only | The Upstash integration |
| `NTFY_TOPIC_URL` | Vercel, Production, Secret; Actions secret | `https://ntfy.sh/` plus a random topic name |
| `CHAT_FAKE` | Vercel, Preview: `1` | — |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Actions secret | Vercel, Deployment Protection |
| `KV_REST_API_URL`, `KV_REST_API_READ_ONLY_TOKEN` | Actions secrets; Peter's untracked `.env` | The Upstash console |
| `ANTHROPIC_API_KEY` (evals) | Peter's untracked `.env` | Anthropic key for `resume-evals` |

Agents never read, print or store a value from this table. `.gitignore` gains `.env` and `.env.*`.

## Setup list

Peter does these steps once, in order. The plan turns them into `docs/runbooks/setup.md` with links, and each step names how to check it worked.

1. Buy peterkloss.dev, pkloss.dev and pwk.dev (decision 0018).
2. Vercel: sign up for Pro; import `loriensleafs/resume`; keep Fluid compute on.
3. Vercel, Domains: add peterkloss.dev, www.peterkloss.dev, pkloss.dev and pwk.dev to the project, all served by the project (the redirects come from `vercel.json`, not the dashboard's "Redirect to").
4. Vercel, Deployment Protection: Standard Protection with Vercel Authentication; create an automation bypass secret.
5. Anthropic Console: workspaces `resume-chat` ($20 a month, email at $10) and `resume-evals` ($5); a service-account key for each.
6. Vercel, Marketplace: add Upstash Redis, pay as you go, with a $1 budget; attach its variables to Production only.
7. ntfy: install the app on his phone; subscribe to a long random topic name; send a test push.
8. Vercel, Environment Variables: the Vercel rows of the table above.
9. GitHub, Actions secrets: the Actions rows of the table above.
10. Vercel, Firewall: the "chat rate limit" rule above.
11. Vercel, Spend Management: a $20 budget, notify only, with the webhook set to the ntfy topic URL.
12. Vercel, Deployment Checks: require the `ci` and `deploy-check` checks from GitHub.
13. Push a site change; watch the checks pass and the domains move; run the health check by hand once.

## Runbooks

`docs/runbooks/`, one file per alert, each with what it means, the first thing to check and the fix:

- `spend-75.md`: `bun run questions` shows which days spent; raise the limit in the Anthropic Console and in `src/ops/limits.ts`, or leave it.
- `spend-limit.md`: the chat is paused for visitors; raise the limit in the Console (it takes effect at once), then update `src/ops/limits.ts`.
- `health-failed.md`: open the failed run; a page or header failure points at the last release (roll back); an error share points at `bun run questions` and its errors by code; turning the schedule back on.
- `vercel-spend.md`: the usage page shows the cost; the WAF's traffic view shows abuse.
- `rollback.md`: the rollback steps above.

## Changes to other specs

Approving this spec approves these amendments:

- **SPEC-chat.** (1) `ChatDeps` gains `telemetry: TurnTelemetry`; the handler hands each `ChatTurnEvent` to it instead of printing, and tests pass an in-memory one. (2) `errorCode` gains `"SPEND_LIMIT"`, and the views gain the "limit reached" state. (3) The 429 text becomes "Try again in a few minutes". (4) `bun run questions` also prints the daily totals and the month's cost estimate. (5) The handler rejects a request whose `Origin` header names another site with 403 `FORBIDDEN_ORIGIN`, so other pages cannot spend the chat's budget through their visitors' browsers.
- **SPEC-site.** (1) `buildSite()` writes each page's script hashes into the output. (2) `bun run preview` serves the headers and cache rules of `vercel.json` and the per-page policy, as Vercel does, so the browser test sees production's policy. (3) The service worker's registration moves from an inline script to a file, which leaves one hash fewer per page.
- **SPEC-agents.** AGENTS.md: a push of site changes to `main` is a release and needs Peter's approval; `bun run smoke` and the runbooks join the commands.

## Tech Stack

- Vercel Pro, Bun runtime `1.4.x` (Beta), Fluid compute, Nitro's Vercel output from TanStack Start ([decision 0012](../docs/decisions/0012-vercel-pro-host.md), research 12).
- Upstash Redis through its REST API with `fetch` ([decision 0022](../docs/decisions/0022-question-log-store.md)).
- ntfy.sh, called with `fetch`.
- GitHub Actions: `actions/checkout`, `oven-sh/setup-bun@v2`, `vercel/repository-dispatch/actions/status@v1`.

No npm package is added. Approving this spec approves the three GitHub Actions and the two outside services.

## Commands

```sh
bun run build:site                       # also writes the per-page script hashes
bun run preview                          # serves dist/ with production's headers and policy
bun run smoke http://localhost:4173      # the smoke check against the preview
bun run smoke https://peterkloss.dev --production --totals   # the health check by hand
bun run questions                        # entries, daily totals and the month's cost; needs .env
bun test tests/ops                       # seam 2
bun test                                 # every test
```

## Project Structure

```text
vercel.json                        bunVersion, build commands, ignore command, redirects, headers
scripts/ignore-build.ts            exit 0 when a push changes no site files
scripts/smoke.ts                   `bun run smoke`
scripts/questions.ts               `bun run questions` (from SPEC-chat), extended with the totals
src/ops/ops.ts                     createOps(), createOpsReader()
src/ops/upstash.ts                 the REST pipeline, the key layout and the expiry rules
src/ops/alerts.ts                  the alert rules and the ntfy push
src/ops/limits.ts                  the spend limit, the 75% threshold and Sonnet 5.5's prices
src/site/routes/api.chat.ts        builds createOps(process.env) and passes log and telemetry to handleChat()
.github/workflows/ci.yml           build, test, audit
.github/workflows/deploy-check.yml the smoke check on each production deployment
.github/workflows/health.yml       the daily health check
docs/runbooks/                     setup, rollback and one file per alert
tests/ops/ops.test.ts              seam 2
tests/ops/fake-upstash.ts          an in-test Upstash REST server for the commands the module uses
tests/ops/fake-ntfy.ts             an in-test ntfy server that records pushes
tests/site/config.test.ts          vercel.json and the build output's headers (seam 1)
tests/site/smoke.test.ts           the smoke check against the preview (seam 3)
```

## Code Style

The same as [SPEC-site](SPEC-site.md). Everything outside the process comes in through arguments, so tests pass fake servers and a fixed clock:

```ts
const ops = createOps(
  { KV_REST_API_URL: upstash.url, KV_REST_API_TOKEN: "test", NTFY_TOPIC_URL: `${ntfy.url}/t` },
  { now: () => new Date("2026-10-27T12:00:00Z") },
);
await ops.telemetry.record({ ...turn, outcome: "error", errorCode: "SPEND_LIMIT" });
await ops.telemetry.record({ ...turn, outcome: "error", errorCode: "SPEND_LIMIT" });
expect(ntfy.pushes).toHaveLength(1); // one spend-limit push a day
```

## Testing Strategy

`bun test`, at the three seams Peter confirmed on 2026-10-27 (row 117). No test calls Upstash, ntfy, Anthropic or Vercel.

1. **The site seam, extended** ([SPEC-site](SPEC-site.md) seams 1 and 2):
   - `tests/site/config.test.ts` reads `vercel.json` and the build output: `bunVersion` is `1.4.x`; the three hosts redirect permanently to peterkloss.dev with the path; every header in the tables is present for its paths; each HTML page's policy lists exactly the hashes of its own inline scripts; the chat route's maximum duration is 90 s.
   - The browser test, against `bun run preview` with production's headers, records `securitypolicyviolation` events and fails on any, on every page it visits, online and offline.
2. **The ops module**, `tests/ops/ops.test.ts`, through `createOps()` and `createOpsReader()`, against the in-test Upstash and ntfy servers and a fixed clock:
   - An appended entry comes back from `entries(7)`; a day's list expires at the start of its 91st day; entries from 8 days ago are not listed.
   - The QuestionLog contract tests from SPEC-chat pass against both the in-memory log and the Upstash one.
   - `record()` adds a turn to the day's totals; `totals(1)` shows the outcome counts, the tokens and the longest duration.
   - The month's estimate crosses 75% of $20: one `spend75` push; more turns that month send no second one.
   - Two `SPEND_LIMIT` turns on one day send one push; another on the next day sends another.
   - A push body holds no question text.
   - The Upstash server returns 500: `record()` and `append()` resolve, and an `ops_error` line is printed.
   - With no store variables, `createOps()` returns in-memory parts and calls no server.
   - The reader with the read-only token makes no write command.
3. **The smoke check**, `tests/site/smoke.test.ts`: `bun run smoke` against `bun run preview` passes; against a preview server with one header removed, it fails and names that header; with `--totals` against the fake Upstash holding a day of 10 turns with 3 errors, it fails and names the error share.

The real platform is checked by the `deploy-check` and `health` workflows and by step 13 of the setup list.

## Boundaries

- **Always:** keep every setting that Vercel reads from the repository in the repository. Keep previews on the fake model with no key. Treat a failed store or push call as a printed `ops_error`, never as a failed answer. Run `bun run build`, `bun run build:site` and `bun test` before a commit.
- **Ask first:** pushing site changes to `main` (a release); a change to a limit, a header, the policy, a redirect or a cache rule; a new outside service, GitHub Action or package; a change to the key layout or to what an alert says; running the health check's rate-limit part more than once a day.
- **Never:** sign in to a dashboard, buy, upgrade or change a plan; read, print or commit a key, token or topic name; force-promote a deployment or turn off a Deployment Check; put visitor text, an IP address or a `threadId` in an alert, a total or a log line; add `'unsafe-inline'` or `'unsafe-eval'` to the policy; let a preview reach the real model or the real store; add Node or Python tooling.

## User Stories

1. As a recruiter, I want peterkloss.dev to load fast and safely over HTTPS, so that the link I was sent looks trustworthy.
2. As a visitor who types pkloss.dev or pwk.dev, I want to land on the same page at peterkloss.dev, so that a short address works.
3. As a visitor with a shared link to a source page, I want the redirect to keep the path, so that I see the page I was sent.
4. As a visitor on a slow connection, I want hashed files cached for a year and pages revalidated, so that repeat visits are fast and never stale.
5. As a visitor who asks many questions, I want the limit high enough that I never see it, so that a long conversation is not cut off.
6. As a visitor in a busy office on one network, I want the limit to be generous, so that colleagues do not block each other.
7. As a visitor when the month's budget is spent, I want a clear message with Peter's email and the resume, so that I can still reach him.
8. As a visitor, I want the site to load no third-party code, so that my visit is private and an injected script cannot run.
9. As a visitor, I want the site never shown inside another site's frame, so that nobody can dress it up as something else.
10. As Peter, I want every release to pass CI and a smoke check on the real deployment before it goes live, so that a broken build never reaches a recruiter.
11. As Peter, I want docs-only pushes to build nothing, so that writing specs does not touch the live site.
12. As Peter, I want a one-click rollback with written steps, so that I recover in seconds.
13. As Peter, I want previews that cost nothing and cannot expose the key, so that branches are safe to push.
14. As Peter, I want a push on my phone when the chat passes 75% of its budget, so that I can raise it before visitors hit the limit during my job search.
15. As Peter, I want a push when the limit is reached, so that I know the chat is paused.
16. As Peter, I want a push when the daily health check fails, so that a quiet failure does not last for days.
17. As Peter, I want alerts at most once a day for each kind, so that my phone is not flooded.
18. As Peter, I want daily totals of outcomes, tokens and errors for 90 days, so that I see trends in cost and failures.
19. As Peter, I want `bun run questions` to show the month's estimated cost against the limit, so that I can plan.
20. As Peter, I want the question log deleted after 90 days by the store itself, so that the promise to visitors holds without a job to maintain.
21. As Peter, I want the store's read-only token on my laptop and in the health check, so that a leaked copy cannot change or delete the log.
22. As Peter, I want the store and the alerts to cost cents a month, so that the site stays cheap.
23. As Peter, I want a hard $20 cap on the model bill, so that abuse cannot cost more.
24. As Peter, I want Vercel's spend to notify me and never take the site down, so that a recruiter never finds it paused.
25. As Peter, I want the evals on their own workspace and limit, so that my testing never spends the visitors' budget.
26. As Peter, I want a numbered setup list with a check for each step, so that I configure the dashboards once without guessing.
27. As Peter, I want a runbook for every alert, so that I know the first thing to do when my phone buzzes.
28. As Peter, I want CI on a pinned image with Bun 1.4.2, Chrome and poppler, so that the runner does not change under me.
29. As Peter, I want a dependency audit on every push, so that a known high-severity advisory blocks a release.
30. As Peter, I want no Node or Python anywhere in the pipeline, so that the repository stays pure Bun.
31. As an engineer reviewing the repository, I want the platform settings in `vercel.json` and the workflows, so that I can read how the site is run.
32. As an engineer reviewing the repository, I want the strict policy and its probe on record, so that I see the security work.
33. As an attacker, I should not be able to embed the chat in another site and spend its budget through visitors' browsers.
34. As an attacker with a script, I should be stopped at 20 questions per 10 minutes per address, and by the monthly cap overall.
35. As an attacker who learns the ntfy topic, I should find no visitor data in the alerts.
36. As a future agent, I want tests that name the broken header, alert rule or expiry, so that I fix the cause.
37. As a future agent, I want the release rule in AGENTS.md, so that I ask before pushing site changes.

## Out of scope

- Buying the domains, signing up and paying: Peter does these (setup list).
- Rolling Releases: the traffic is too low to compare a canary (row 107).
- A real text message (Twilio), log drains, outside log services, uptime services and Vercel's anomaly alerts (rows 110, 111, 115).
- A second region, a staging environment, Terraform for the WAF rule, bot protection rules, and HSTS preload submission.
- Evals in CI (SPEC-chat).
- What one question-log entry holds and how the chat writes it: [SPEC-chat](SPEC-chat.md).
- The pages, the service worker's precache and the offline behavior: [SPEC-site](SPEC-site.md).

## Prior-art tests

- `tests/content/build.test.ts`: runs the real entry point into a temporary folder and checks the real files. `tests/site/config.test.ts` reads the real `vercel.json` and build output the same way.
- `tests/site/browser.test.ts` from SPEC-site: Playwright under Bun against the preview. Seam 1 adds the policy-violation check to it.
- The probe `prototypes/csp-probe/csp-test.ts` on the branch `prototype/csp-probe`: the `securitypolicyviolation` listener and the per-page hash computation.
- SPEC-chat's handler test, which uses the in-memory `QuestionLog`. Seam 2 runs the same contract against the Upstash one.

## Success Criteria

- `bun test` passes on a clean checkout with Chrome and poppler installed, no `.env` and no network beyond the tests' own servers.
- After the setup list: a push of a site change goes live only after `ci` and `deploy-check` pass; a docs-only push builds nothing; `bun run smoke https://peterkloss.dev --production --totals` passes.
- A test push from the health workflow, run by hand with a failing target, reaches Peter's phone.
- Peter reviews the setup list and the runbooks and approves them.

## Open Questions

None for this spec. For the plan:

- How the per-page hashes reach the browser: a header in the build output or a meta tag (both meet the test).
- Whether Vercel's ignore step can compare against the last deployment's commit (`VERCEL_GIT_PREVIOUS_SHA` is not confirmed); if not, the ignore command builds whenever it cannot tell.
- Whether Upstash's read-only token allows `LRANGE`, `HGETALL` and `ZRANGE` (documented only as "read commands").
- Whether the Nitro function rule matches TanStack Start's chat route in `.vercel/output`.
- For Peter, with the other wordings: the "limit reached" text and the new 429 text.
