# Deploy: Vercel, the question log's store, spend limits, CI and the Content Security Policy

Researched 2026-10-27 for SPEC-deploy, from official docs, changelogs and pricing pages only. The main claims were checked a second time against the pages linked below. One probe ran in Chromium.

## Vercel runtime and functions

- **Bun runtime: Beta on all plans.** `bunVersion` in `vercel.json` takes `"1.4.x"` or `"1.x"`. `"1.x"` selects "the previous latest Bun version (currently `1.3.14`)", so this repository (Bun 1.4.2) needs `"1.4.x"`. https://vercel.com/docs/functions/runtimes/bun#configuring-the-runtime
- The Bun runtime has no automatic source maps, no bytecode caching and no request metrics on `node:http`. Streaming, Fluid compute and logs work. https://vercel.com/docs/functions/runtimes/bun#feature-support
- **Nitro on Vercel** picks the runtime from, in order: `vercel.functions.runtime` in the Nitro config, `engines` in `package.json`, `bunVersion` in `vercel.json`, then the build's runtime. `1.4.x` maps to `bun1.4.x`. Bun's guide says not to use Nitro's `bun` preset on Vercel. https://nitro.build/deploy/providers/vercel#runtime, https://bun.com/docs/guides/ecosystem/tanstack-start#hosting
- **Maximum duration on Pro:** 300 s by default, 800 s at most, with Fluid compute on by default for new projects. A streamed response counts toward the limit; a timeout returns 504 `FUNCTION_INVOCATION_TIMEOUT`. One route sets its own value through Nitro's `vercel.functionRules`. https://vercel.com/docs/functions/limitations#max-duration, https://nitro.build/deploy/providers/vercel#per-route-function-configuration
- **Region:** `iad1` by default; set in the dashboard, `vercel.json` `regions` or per function. https://vercel.com/docs/functions/configuring-functions/region#setting-your-default-region

## Deploys

- By default a push to the production branch deploys and assigns the custom domains at once. https://vercel.com/docs/deployments/promoting-a-deployment
- **Staged production:** with "Auto-assign Custom Production Domains" off (Settings, Environments, Production, Branch Tracking), a push to `main` makes a **Staged** deployment. A person promotes it from the dashboard ("Promote") or with `vercel promote`, and "it doesn't require a rebuild". Same page, section "Staging and promoting a production deployment".
- **Instant Rollback** on Pro returns to any deployment that served production before, by moving the domains. A rollback turns domain auto-assignment off. https://vercel.com/docs/instant-rollback
- Previews are made per branch and per pull request. Standard Deployment Protection (Vercel Authentication) is on all plans. Previews get `x-robots-tag: noindex`. https://vercel.com/docs/deployment-protection#standard-protection, https://vercel.com/docs/headers/response-headers
- **The Vercel CLI needs Node.js:** the Bun install "still requires Node.js to run its launcher, even when you use native execution". Git deploys and the dashboard need no CLI. https://vercel.com/docs/cli#experimental-native-cli-binaries

## Edge: rate limit, redirects, headers, caching

- **WAF rate limiting on Pro:** 40 rules a project; fixed window from 10 s to 10 min; keyed by IP or JA4 digest; conditions on path and method; actions 429 (default), log, deny (403) or challenge. Counters are per region. Rules change without a redeploy. https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting#limits
- Price on Pro: $0.50 per million allowed requests (iad1); denied and rate-limited traffic costs nothing. https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing
- Rate-limit rules cannot be written in `vercel.json` (its `mitigate` takes only `challenge` and `deny`). They live in the dashboard, the REST API, Terraform or `vercel firewall`. https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules#configuration-in-vercel.json
- **Domain redirects in `vercel.json`:** a `redirects` entry with a `has` host condition and `"permanent": true` returns 308, and the path and query pass through. The dashboard's "Redirect to" does not document its status code or path handling. https://vercel.com/docs/project-configuration/vercel-json#redirects, https://vercel.com/docs/routing/redirects
- **Headers:** `vercel.json` `headers` applies to static files and functions. A function's own `Cache-Control` wins over `vercel.json`. Vercel adds `strict-transport-security: max-age=63072000` (no `includeSubDomains`, no `preload`) and no CSP, Referrer-Policy, Permissions-Policy or X-Content-Type-Options. https://vercel.com/docs/project-configuration/vercel-json#headers, https://vercel.com/docs/headers/response-headers#strict-transport-security
- **Caching:** the default is `public, max-age=0, must-revalidate`. Static files stay on the CDN for the life of a deployment. Hashed files should get `max-age=31536000, immutable`; the docs' example keeps the service worker at `max-age=0, must-revalidate`. https://vercel.com/docs/caching/cache-control-headers#default-cache-control-value

## Cron, logs, alerts, spend, settings

- **Cron on Pro:** `vercel.json` `crons`, up to 100 a project, as often as once a minute, production only. Vercel sends a GET with `Authorization: Bearer $CRON_SECRET`, with no retry. https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
- **Runtime logs** stay 1 day on Pro, 30 days with Observability Plus. Search covers only `message` and `requestPath`. Log Drains: $0.50 per GB. https://vercel.com/docs/logs/runtime#limits, https://vercel.com/docs/drains#usage-and-pricing
- **Alerts** "are available on Enterprise and Pro plans with Observability Plus": error anomaly (a route's five-minute 5xx count against its 24-hour baseline) and usage anomaly, by email, Slack or webhook. Observability Plus costs $1.20 per million events and is on by default for teams that became Pro on or after 2026-04-03. https://vercel.com/docs/alerts, https://vercel.com/docs/observability/observability-plus#pricing
- **Spend management:** an on-demand budget per billing cycle, notices at 50, 75 and 100 percent, a webhook, and an optional pause of every project's production deployments (503 `DEPLOYMENT_PAUSED`), checked every few minutes. Pro includes $20 of monthly credit. https://vercel.com/docs/spend-management, https://vercel.com/docs/plans/pro-plan#monthly-credit
- **Environment variables:** a Secret value is write-only after saving. Each variable applies to the environments chosen (Production, Preview, Development); a promoted preview cannot keep its preview values. https://vercel.com/docs/environment-variables/sensitive-environment-variables

## The question log's store

| Store | Free allowance | Expiry | From Bun | Notes |
|---|---|---|---|---|
| Upstash Redis (Marketplace) | 500,000 commands and 250 MB a month | Per-key `EXPIRE` deletes the key on time | REST with `fetch` and `Authorization: Bearer` | Billing through Vercel. A free database is archived after at least 30 days with no use (warning emails first; data backed up); a paid plan avoids it. A read-only token cannot run `SCAN` or `KEYS`. |
| Neon Postgres (Marketplace) | 100 CU-hours and 1 GB a project | None; needs a scheduled `DELETE` | `Bun.sql` over TCP (pooled URL unverified); HTTP needs the `@neondatabase/serverless` driver | `pg_cron` runs only while the compute is awake |
| Vercel Blob | Usage-based from the $20 credit | None; needs a scheduled delete | `@vercel/blob` SDK (a public REST API is unverified) | Lists by prefix |

Vercel KV and Vercel Postgres are retired (moved to Upstash and Neon), and Global Config (the old Edge Config) is not for frequent writes. https://upstash.com/docs/redis/overall/billing#free-tier, https://upstash.com/docs/redis/commands/generic/expire, https://upstash.com/docs/redis/features/restapi, https://upstash.com/docs/redis/help/faq, https://neon.com/docs/introduction/plans, https://vercel.com/docs/vercel-blob/usage-and-pricing, https://vercel.com/docs/redis

Upstash recommends its REST API over TCP clients on Vercel. Bun's own Redis client speaks TLS (`rediss://`) but reads `REDIS_URL`. https://upstash.com/docs/redis/howto/redis-cli#tcp-or-http, https://bun.com/docs/runtime/redis

At a few thousand entries a month the store costs nothing on any of the three. Whether the read-only token allows `LRANGE` is not documented.

## Anthropic spend limits

- A workspace spend limit is set in the Console (Workspaces, the workspace, Spend limits), below the organization limit, and not on the Default Workspace. It can email at chosen amounts. https://platform.claude.com/docs/en/manage-claude/workspaces#set-workspace-limits
- At a limit Peter sets, the API returns **HTTP 400 `invalid_request_error`**, "You have reached your specified workspace API usage limits", with the date access resumes. https://platform.claude.com/docs/en/api/rate-limits#setting-your-own-spend-limit
- At the usage tier's cap it returns **HTTP 429 `rate_limit_error`** with `error_code` `enforced_spend_limit_reached` and no `retry-after`. New organizations may start in an Evaluation tier with lower limits. https://platform.claude.com/docs/en/api/rate-limits#spend-limits
- An API key can belong to one workspace; per-workspace rate limits are set in the Console. https://platform.claude.com/docs/en/manage-claude/authentication#key-types

## CI on GitHub Actions

- Actions minutes are free for public repositories on standard runners. https://docs.github.com/en/billing/concepts/product-billing/github-actions
- `oven-sh/setup-bun@v2` (v2.2.0) pins `bun-version: 1.4.2` or reads `packageManager`. https://github.com/oven-sh/setup-bun#inputs
- `ubuntu-24.04` has Google Chrome at `/usr/bin/google-chrome`; poppler is not installed (`apt-get install poppler-utils`). `ubuntu-latest` moves to 26.04 between 2026-10-19 and 2026-11-19, so a pinned image avoids a silent change. https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md, https://github.com/actions/runner-images/issues/14748
- `bun ci` equals `bun install --frozen-lockfile`. Bun runs no dependency lifecycle scripts outside its allow list; `trustedDependencies: []` blocks all. `bun audit` checks `bun.lock` against npm advisories and exits 1 on findings or when the registry is unreachable. https://bun.com/docs/pm/cli/install, https://bun.com/docs/pm/lifecycle#trusteddependencies, https://bun.com/docs/pm/cli/audit

## Facts behind the review fixes (2026-10-27)

- **Build image:** Amazon Linux 2023, with Node.js 24 and 22, Python and Ruby; packages install with `dnf install -y` in the install command. The docs list no Chrome. https://vercel.com/docs/builds/build-image
- **Standard Protection** "protects all domains except production domains"; the production generated deployment URL becomes restricted. https://vercel.com/docs/deployment-protection#standard-protection
- **`VERCEL_GIT_PREVIOUS_SHA`** (build time): "The git SHA of the last successful deployment for the project and branch", empty on a branch's first deployment, "only exposed when an Ignored Build Step is provided". `VERCEL_ENV` and `VERCEL_GIT_COMMIT_SHA` are available at build and run time. https://vercel.com/docs/environment-variables/system-environment-variables
- **Ignored Build Step:** exit 1 builds, exit 0 cancels; the command can read the system variables. https://vercel.com/docs/project-configuration/project-settings#ignored-build-step
- **Deployment Checks** hold each production deployment until the required checks pass, then assign the domains; GitHub checks are matched by job name; they need production auto-aliasing on; Force Promote bypasses them. https://vercel.com/docs/deployment-checks
- **Repository dispatch:** Vercel sends `vercel.deployment.ready` (and other events) to GitHub Actions with the deployment's `url` and `environment` in `client_payload`; the workflow file must be on the default branch. https://vercel.com/docs/git/vercel-for-github#repository-dispatch-events
- **Protection Bypass for Automation** (all plans): send `x-vercel-protection-bypass: <secret>`; Vercel also sets `VERCEL_AUTOMATION_BYPASS_SECRET`. https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
- **Ignore command example:** `"ignoreCommand": "git diff --quiet HEAD^ HEAD ./"`. https://vercel.com/docs/project-configuration/vercel-json#ignorecommand
- **Rolling Releases** are on Pro for one project; a fraction of visitors gets the new deployment first. https://vercel.com/docs/rolling-releases
- **GitHub schedules:** "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days"; they run only on the default branch; notices go "to the user who last modified the cron syntax". https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
- **TanStack AI usage (installed 1.0.0):** the Anthropic adapter sets `promptTokens` to uncached input plus cache reads plus cache writes, with `cachedTokens`, `cacheWriteTokens` and `cacheWrite1hTokens` in `promptTokensDetails` (`@tanstack/ai-anthropic/dist/esm/usage.js`). Middleware `ctx.defer()` promises "do not block streaming and are awaited after the terminal hook" (`@tanstack/ai` middleware types). Nitro's Vercel page says nothing about `waitUntil`. https://nitro.build/deploy/providers/vercel

- **Anthropic SDK errors (installed `@anthropic-ai/sdk` 0.135.0):** an API error's message is `${status} ${JSON.stringify(body)}` when the body has no top-level `message`, and TanStack AI's error code is the HTTP status, so a spend-limit check must read the error's `status` and body fields, not its message text (found by the second review in `core/error.js` and `@tanstack/ai-anthropic` `text.js`).
- **Prompt caching (installed `@tanstack/ai` 1.0.0):** `chat()` resolves `promptCache` with `retention ?? "short"`, a 5-minute cache. The Anthropic adapter (`prompt-cache.js`) then adds up to 4 markers: the last tool, the last block of the last user message, and the system blocks from the end. `"long"` uses `ttl: "1h"`.
- **Vercel Cron** calls the production deployment URL and does not follow redirects. https://vercel.com/docs/cron-jobs
- **Protection bypass in a browser:** also send `x-vercel-set-bypass-cookie: true`, so follow-up requests carry the bypass. https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation

## The committed documents: fixed dates (2026-10-27)

The build image has no Chrome (above). So the site serves the public documents that are committed in `documents/` ([SPEC-deploy](../../spec/SPEC-deploy.md), Documents). SPEC-deploy asked the plan to check whether the Word library or Chrome accepts a fixed date.

**Verdict.** Neither accepts a fixed date. Two builds of the same inputs never match byte for byte. The inputs hash alone keeps the committed documents stable. `bun run documents` writes nothing while `documents/inputs.sha256` matches the inputs.

SPEC-content needs no change. SPEC-deploy's Documents section states this verdict and links here.

**The Word file** (`docx` 9.14.0). Three parts change on each build. The line numbers are in `node_modules/docx/dist/index.mjs`.

| Part | What changes | Why | Lines |
|---|---|---|---|
| `docProps/core.xml`, the document properties | `dcterms:created` and `dcterms:modified`, the created and modified dates. `dcterms` is the Dublin Core vocabulary that Office files use for them. | `docx` writes `new Date()`. No option sets a date. | 19304 to 19326 |
| `word/document.xml` and `word/_rels/document.xml.rels` | The relationship id of each link. The id joins the link in the text to its address. | `docx` makes each id with `uniqueId()`. `uniqueId()` calls nanoid, a small random-id library that `docx` bundles. nanoid uses `Math.random()`. | 13528 to 13537, 4846, 4663 |
| The zip itself | The date of each zip entry | `docx` adds each part with `zip.file(path, data)` and no date. So JSZip, the zip library that `docx` bundles, stamps the build time. | 35224 to 35234 |

T1's builder found the random link ids.

**The PDF.** Chrome writes the print time into the PDF's `/CreationDate` and `/ModDate`. `Page.printToPDF` is the DevTools call that prints the PDF. It has 17 parameters, and none of them sets a date or metadata. Two sources list the same 17 parameters:

- The official protocol page, https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-printToPDF, read 2026-10-27. Its `tot` (tip of tree) is the newest protocol.
- The protocol of the installed Chrome, 156.0.8078.48 on macOS. These commands print the version, then the count:

```sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --version   # Google Chrome 156.0.8078.48
"$CHROME" --headless=new --remote-debugging-port=9333 --user-data-dir="$(mktemp -d)" about:blank 2>/dev/null &
sleep 2
curl -s http://127.0.0.1:9333/json/protocol | bun -e 'const p = await Bun.stdin.json(); console.log(p.domains.find((d) => d.domain === "Page").commands.find((c) => c.name === "printToPDF").parameters.length)'   # 17
kill %1
```

**Two public builds, one after the other** (`bun run build --public`, 2026-10-27). The text file and the print preview were identical. The two PDFs had the same size. They differed only in `/CreationDate` and `/ModDate`. The two Word files differed only in the two `dcterms` dates, the 3 link ids and the zip entry dates.

## Alert channels

- **Twilio SMS:** about $0.0083 a text plus carrier fees (about $0.012 to $0.013 in total), $1.15 a month for a local number; "Anyone sending SMS/MMS messages over a 10DLC number from an application to the US must register for A2P 10DLC", hobbyists included. https://www.twilio.com/en-us/sms/pricing/us, https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
- **Carrier email-to-text gateways** are no longer reliable; AT&T has shut its gateway down (third-party reports, not an official source).
- **ntfy.sh:** free with no sign-up; publish with an HTTP POST to `ntfy.sh/<topic>`, with `Title` and `Priority` headers (1 to 5); "the topic is essentially a password"; apps on Android and iOS; paid plans add reserved topics. https://docs.ntfy.sh/publish/, https://ntfy.sh/

## Probe: a strict Content Security Policy

The earlier site spike ([research 09](09-site-feasibility.md)) was served with `default-src 'self'`, `script-src 'self'` plus each page's inline-script hashes, `style-src 'self'`, `object-src 'none'`, `base-uri 'none'` and `frame-ancestors 'none'`. Chromium reported no violation on a first visit, a second visit, a deep-dive page and an offline visit through the service worker. The probe, its verdict and what it did not test are on the branch `prototype/csp-probe`.

- A prerendered page has four inline scripts, one of them TanStack Router's hydration bootstrap with per-page data, so each page has its own hashes. TanStack Start's per-request `ssr.nonce` does not fit pages served as static files.
- The design system adds its styles as constructable stylesheets; it uses `<style>` elements with `window.litNonce` only where a browser lacks them. So `style-src 'self'` is enough.

## Local checks and facts after the third review (2026-10-27)

The third review found 39 issues (interview row 126). These are the facts behind draft four of SPEC-deploy, and the local checks run for it. What only a real deployment can show is the spec's deploy spike.

**Nitro's Vercel output** (local build of the site spike, Nitro `3.0.260903-beta`, `preset: "vercel"`, Bun 1.4.2; kept on `prototype/csp-probe` in `prototypes/nitro-vercel-output/`):

- `.vercel/output/config.json` has four routes: `/assets/(.*)` with `cache-control: public, max-age=31536000, immutable`; `{ "handle": "filesystem" }`; `/api/chat` to its own function; and `/(.*)` to `/__server`. So every path that is not a file is rendered by a function at request time, with no policy tag.
- `config.json` has `"overrides": {}`. Prerendered pages are stored as `static/<path>/index.html`.
- Each function's `.vc-config.json` has `"runtime": "bun1.x"` when nothing sets a version, `"launcherType": "Nodejs"` and `"supportsResponseStreaming": true`. A `functionRules` entry for `/api/chat` gives that function its own folder and `"maxDuration": 90`.

**Build Output API** (https://vercel.com/docs/build-output-api/configuration):

- A route has `src` ("A PCRE-compatible regular expression that matches each incoming pathname (excluding querystring)"), `dest`, `headers` (a map, so one value per header name), `methods`, `continue`, `caseSensitive`, `status`, `has`, `missing`, `mitigate` and `transforms`. A `transforms` entry can `append`, `set` or `delete` a response header.
- A `has` host condition takes a string or a matcher such as `{ "eq": "pkloss.dev" }`.
- `status` "Can be used in tandem with Location: header to implement redirects"; the example is `{ "src": "/redirect", "status": 308, "headers": { "Location": "https://example.com/" } }`. The page does not say whether a query string is added to `Location`.
- The `handle` phases include `filesystem` ("check matches after the filesystem misses"), `miss` and `error`.
- `overrides` maps a static file to another URL path: `"blog.html": { "path": "blog" }`.
- `crons` lists `{ path, schedule }` "for the production deployment of a project".
- vercel.json reference (https://vercel.com/docs/project-configuration/vercel-json#routes): "With `routes`, the `src` property is case-insensitive"; `redirects` and `headers` sources are case-sensitive. The `bunVersion` example is `"1.4.x"`.

**Client navigation needs a server function** (`prototypes/csp-probe-2/nav-check.ts`): during a client-side navigation, the spike's route loader called `GET /_serverFn/<hash>`. A static server answered 404 and the page had no `<h1>`. TanStack Start's own skill says the same: "Route loaders run on BOTH server (during SSR) AND client (during navigation)" (`@tanstack/start-client-core` skill `start-core/execution-model`). So a site with no request-time server gives its loaders build-time data.

**The split policy** (`prototypes/csp-probe-2/`): the header policy without `default-src` or `script-src`, a policy tag in each page, one full policy for the worker files, and a static not-found page with no script. Chrome reported no violation, page error or service-worker console message on first and second visits, a deep-dive page, client navigation, and an unknown path online and offline.

**Workbox's `navigateFallback`** (same probe): with `navigateFallback: "/404.html"`, the worker served the not-found page with status 200 for an unknown path also online. It answers every navigation it has not precached, so after a release adds a page, an old worker would show "not found" for it until the worker updates.

**TanStack AI 1.0.0** (installed packages, read by the third review):

- `onUsage` runs only when a run finishes (`RUN_FINISHED`). A run that ends in `RUN_ERROR` (abort, `max_tokens`, a stream error) carries its usage on that event.
- The browser client's `assertResponseOk` throws "HTTP error! status: <n>" on a response that is not OK, without reading its body (it reads only a 401 body). A refusal must therefore arrive as a 200 stream to show its code.
- The Anthropic adapter's cache markers include the last tool, so a change to the tool list changes the cached prefix. Anthropic's prompt-caching guide lists tool-definition changes among those that invalidate the whole cache (https://docs.claude.com/en/docs/build-with-claude/prompt-caching).

**Other services:**

- Upstash REST: a pipeline runs commands in order but is not atomic; `/multi-exec` runs them as one transaction (https://upstash.com/docs/redis/features/restapi).
- ntfy.sh limits each visitor's address to 250 messages a day (https://docs.ntfy.sh/publish/#limitations). Vercel's and GitHub's outgoing addresses are shared.
- Vercel Spend Management: "Setting a spend amount does not automatically stop usage"; to pause, "you must enable the option" (https://vercel.com/docs/spend-management). The third review read a changelog as saying the pause can start on, so the setup list checks the switch.
- Instant Rollback turns domain auto-assignment off; "Undo Rollback" chooses a deployment to make live and turns it back on (https://vercel.com/docs/instant-rollback).
- A Redeploy runs the Ignored Build Step again unless "Use project's Ignore Build Step" is unchecked, so a redeploy of an unchanged commit is skipped (https://vercel.com/docs/project-configuration/project-settings#ignored-build-step).
- The Vercel Toolbar loads a script from `vercel.live`; automated tests can skip it with the header `x-vercel-skip-toolbar: 1` (https://vercel.com/docs/vercel-toolbar).
- Bun loads `.env`, `.env.<NODE_ENV>` and `.env.local` into a run on its own (https://bun.com/docs/runtime/environment-variables). `bun audit --prod` leaves development packages out (https://bun.com/docs/pm/cli/audit).
- Nitro's Bun runtime (installed `nitro` 3.0.260903-beta, `_presets.mjs` `resolveVercelRuntime` and its Vercel page): the value comes from `vercel.functions.runtime`; without it, Nitro writes `"bun1.x"` when `vercel.json` has `bunVersion` or the build runs in Bun. Nitro's docs show only `"bun1.x"`, so whether a function can name `"bun1.4.x"` is a spike check.
