# Deploy: Vercel, the question log's store, spend limits, CI and the Content Security Policy

Researched 2026-10-27 for SPEC-deploy, from official docs, changelogs and pricing pages only. The main claims were checked a second time against the pages linked below. One probe ran in Chromium.

## Vercel runtime and functions

- **Bun runtime: Beta on all plans.** `bunVersion` in `vercel.json` takes `"1.4.x"` or `"1.x"`. `"1.x"` selects "the previous latest Bun version (currently `1.3.14`)", so this repository (Bun 1.4.2 when this was researched; CI now pins 1.4.4) needs `"1.4.x"`. https://vercel.com/docs/functions/runtimes/bun#configuring-the-runtime. The deploy spike refined this (checks 1 and 2, in "Deploy spike verdicts" below): `bunVersion` or the lockfile decides the build's Bun, and each function's own runtime value decides that function's Bun.
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
| Upstash Redis (Marketplace) | 500,000 commands and 250 MB a month | Per-key `EXPIRE` deletes the key on time | REST with `fetch` and `Authorization: Bearer` | Billing through Vercel. A free database is archived after at least 30 days with no use (warning emails first; data backed up); a paid plan avoids it. Upstash's docs say a read-only token cannot run `SCAN` or `KEYS`. Corrected by the deploy spike (check 9): the read-only token ran `SCAN`, so it can list every key; it was refused `KEYS`. |
| Neon Postgres (Marketplace) | 100 CU-hours and 1 GB a project | None; needs a scheduled `DELETE` | `Bun.sql` over TCP (pooled URL unverified); HTTP needs the `@neondatabase/serverless` driver | `pg_cron` runs only while the compute is awake |
| Vercel Blob | Usage-based from the $20 credit | None; needs a scheduled delete | `@vercel/blob` SDK (a public REST API is unverified) | Lists by prefix |

Vercel KV and Vercel Postgres are retired (moved to Upstash and Neon), and Global Config (the old Edge Config) is not for frequent writes. https://upstash.com/docs/redis/overall/billing#free-tier, https://upstash.com/docs/redis/commands/generic/expire, https://upstash.com/docs/redis/features/restapi, https://upstash.com/docs/redis/help/faq, https://neon.com/docs/introduction/plans, https://vercel.com/docs/vercel-blob/usage-and-pricing, https://vercel.com/docs/redis

Upstash recommends its REST API over TCP clients on Vercel. Bun's own Redis client speaks TLS (`rediss://`) but reads `REDIS_URL`. https://upstash.com/docs/redis/howto/redis-cli#tcp-or-http, https://bun.com/docs/runtime/redis

At a few thousand entries a month the store costs nothing on any of the three. Whether the read-only token allows `LRANGE` is not documented. The deploy spike's check 9 found that it does, with `HGETALL`, `ZRANGE` and `GET`.

## Anthropic spend limits

- A workspace spend limit is set in the Console (Workspaces, the workspace, Spend limits), below the organization limit, and not on the Default Workspace. It can email at chosen amounts. https://platform.claude.com/docs/en/manage-claude/workspaces#set-workspace-limits
- At a limit Peter sets, the API returns **HTTP 400 `invalid_request_error`**, "You have reached your specified workspace API usage limits", with the date access resumes. https://platform.claude.com/docs/en/api/rate-limits#setting-your-own-spend-limit
- At the usage tier's cap it returns **HTTP 429 `rate_limit_error`** with `error_code` `enforced_spend_limit_reached` and no `retry-after`. New organizations may start in an Evaluation tier with lower limits. https://platform.claude.com/docs/en/api/rate-limits#spend-limits
- An API key can belong to one workspace; per-workspace rate limits are set in the Console. https://platform.claude.com/docs/en/manage-claude/authentication#key-types

## CI on GitHub Actions

- Actions minutes are free for public repositories on standard runners. https://docs.github.com/en/billing/concepts/product-billing/github-actions
- `oven-sh/setup-bun@v2` (v2.2.0) pins `bun-version: 1.4.2` (the version when this was researched; SPEC-deploy's CI pins 1.4.4) or reads `packageManager`. https://github.com/oven-sh/setup-bun#inputs
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
- **TanStack AI usage (installed 1.0.0):** the Anthropic adapter sets `promptTokens` to uncached input plus cache reads plus cache writes, with `cachedTokens`, `cacheWriteTokens` and `cacheWrite1hTokens` in `promptTokensDetails` (`@tanstack/ai-anthropic/dist/esm/usage.js`). Middleware `ctx.defer()` promises "do not block streaming and are awaited after the terminal hook" (`@tanstack/ai` middleware types). Nitro's Vercel page says nothing about `waitUntil`. https://nitro.build/deploy/providers/vercel. Nitro's Vercel entry still puts Vercel's `waitUntil` on the request (spike check 7, below).

- **Anthropic SDK errors (installed `@anthropic-ai/sdk` 0.135.0):** an API error's message is `${status} ${JSON.stringify(body)}` when the body has no top-level `message`, and TanStack AI's error code is the HTTP status, so a spend-limit check must read the error's `status` and body fields, not its message text (found by the second review in `core/error.js` and `@tanstack/ai-anthropic` `text.js`).
- **Prompt caching (installed `@tanstack/ai` 1.0.0):** `chat()` resolves `promptCache` with `retention ?? "short"`, a 5-minute cache. The Anthropic adapter (`prompt-cache.js`) then adds up to 4 markers: the last tool, the last block of the last user message, and the system blocks from the end. `"long"` uses `ttl: "1h"`.
- **Vercel Cron** calls the production deployment URL and does not follow redirects. https://vercel.com/docs/cron-jobs. The deploy spike saw it call each production deployment's own generated URL, not the project's production address (check 6, below).
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
- `status` "Can be used in tandem with Location: header to implement redirects"; the example is `{ "src": "/redirect", "status": 308, "headers": { "Location": "https://example.com/" } }`. The page does not say whether a query string is added to `Location`. The deploy spike found that Vercel adds it (check 5, below).
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
- The Vercel Toolbar loads a script from `vercel.live`; automated tests can skip it with the header `x-vercel-skip-toolbar: 1` (https://vercel.com/docs/vercel-toolbar). The deploy spike could not prove the header's effect (check 11, below).
- Bun loads `.env`, `.env.<NODE_ENV>` and `.env.local` into a run on its own (https://bun.com/docs/runtime/environment-variables). `bun audit --prod` leaves development packages out (https://bun.com/docs/pm/cli/audit).
- Nitro's Bun runtime (installed `nitro` 3.0.260903-beta, `_presets.mjs` `resolveVercelRuntime` and its Vercel page): the value comes from `vercel.functions.runtime`; without it, Nitro writes `"bun1.x"` when `vercel.json` has `bunVersion` or the build runs in Bun. Nitro's docs show only `"bun1.x"`, so whether a function can name `"bun1.4.x"` is a spike check. It can: such a function runs Bun 1.4.1 (spike check 2, below).

## Deploy spike verdicts (2026-10-27)

SPEC-deploy's deploy spike ran on Peter's throwaway Vercel project `resume-deploy-spike` (Pro, Standard Protection, no domains, no Anthropic key). Its code is on the branch `prototype/deploy-spike`, tip `bc119a7`. That branch's `prototypes/deploy-spike/README.md` holds every run's verdict lines word for word, the controls and the scope of each verdict. Two throwaway branches hold the parts that only their runs used: `prototype/d3-preview` (check 11 on a preview) and `prototype/d5-waf` (check 8 on previews). No branch is merged.

The verdicts below are copied from that README. A run id is a GitHub Actions run of the branch's check workflow.

| # | Check | Verdict |
|---|---|---|
| 1 | Which Bun runs the build, and whether `bunVersion` decides it | Pass (run 40567813019). Bun 1.4.4 (`/bun1.4/bun`) runs the build. `bunVersion` decides it together with the lockfile: the build gets Bun 1.4 when `bunVersion` is `"1.4.x"` or `bun.lock` has `lockfileVersion: 2`, else Vercel's default Bun 1.3.14 (runs 40567318435, 40567115524, 40567495810 and 40567647834, one deployment each). The "If it fails" installer is not needed. |
| 2 | The post-build routes, the `overrides`, the cron, and the functions' Bun | Routes, overrides and the functions' Bun: pass (run 40572167592). Vercel serves the routes and overrides that the spike's post-build step writes. A function with `runtime: "bun1.4.x"` runs Bun 1.4.1; one with `"bun1.x"` runs Bun 1.3.14, also with `bunVersion` `"1.4.x"` (control run 40571893452). Vercel also serves `<path>/index.html` at `<path>` with no override (control run 40571589174). The cron: check 6 saw Vercel Cron call a second cron on the same path that the build wrote (runs 40589291781 and 40591039392), so the project runs the crons in `config.json`. SPEC-deploy's own `17 15 * * *` had not fired by the last run. |
| 3 | Unknown paths, `/API/chat` and `/sources/x` get `/404.html` with status 404 | Pass (run 40572167592), after one change to the routes: Nitro's `__server.func` answered at `/__server` (run 40570467882) until a route before the filesystem sent that path to `/404.html`. `caseSensitive: true` keeps `/API/spike` off its function (control run 40571744659). |
| 4 | How route headers merge | Pass (runs 40583006081 and 40581693149). For one header from two routes, the last matching route wins: the worker files get exactly one policy, the worker policy, and with the worker route first they get the header policy (control run 40582697904). The PDF gets no policy. The six headers and the header policy reach a function response and the not-found page from both its routes; the route's HSTS replaces Vercel's own. |
| 5 | A host redirect keeps the query string | Pass (runs 40583006081, 40581693149 and 40582697904). On the production `.vercel.app` address the route answers 308, and Vercel adds the request's query to the route's `Location`; `/api/` is not redirected. The route needs no query of its own. Vercel writes the query again (`+` becomes `%20`), and the 308 carries the header routes' headers. Seen on that one host only. |
| 6 | Vercel Cron reaches `/api/cron/health` under Standard Protection | Pass (runs 40589291781 and 40591039392). Vercel Cron called the deployment's own URL, `resume-deploy-spike-<hash>-peterkloss.vercel.app`, a protected host, and passed Standard Protection with no bypass. It did not call the project's production address. The call came 6 s and 14 s into the probe's minute, with the user agent `vercel-cron/…` and the probe's `x-vercel-cron-schedule`, and reached `/__server` through the API route after the filesystem phase. The README's rule that follows: the host redirects must match exact hosts, never `*.vercel.app`, or the cron gets a 308. D6's reading below ("Exact hosts in the redirects") qualifies the reason: the `.vercel.app` route's `/api/` exception lets the cron's path pass, and a pattern would still redirect the pages on each deployment's own URL. The project has no `CRON_SECRET`, so the call carried no `Authorization`. |
| 7 | Store writes finish after a stopped stream | Pass for SPEC-deploy's setup (runs 40589291781 and 40591039392), but not for the reason the spec expects. Without `supportsCancellation` the function never sees a visitor's Stop: it sends all 40 chunks, then writes, and both writes land about 9 s and 11 s after the stop. So the turn is logged `answered`, and `stopped` never occurs on Vercel. With `supportsCancellation`, Vercel ends the function on the stop, and its writes are lost; inside `request.waitUntil` they land, and the function still runs to its end. A write after the response's end lands only with `request.waitUntil`, which Nitro passes on from Vercel with no package, so `@vercel/functions` is not needed. Scope: a 10 s stream with no model; that the model keeps generating is inferred; the 150 s case was not run. |
| 8 | The WAF rules' case handling and content-type condition | Pass on previews (runs 40587839966, attempts 1 and 2, 40588287129 and 40588744616, on `prototype/d5-waf`) and on production (run 40596354489, `VERCEL_ENV production`). A chat `POST` with `Content-Type: text/plain` gets the WAF's 403; malformed JSON chat `POST`s get the not-found page until the 21st, which gets the WAF's 429. The path condition matched `/API/chat`, on production also `/Api/Chat`, and it decodes `%63`. Both WAF answers carry `x-vercel-mitigated: deny`. |
| 9 | What the Upstash tokens can run | Pass (runs 40589291781 and 40591039392). `/multi-exec` with the standard token runs the key table's writes and the reservation with `EXPIREAT` (each answers 1, and `PTTL` shows the expiry). The read-only token runs `LRANGE`, `HGETALL`, `ZRANGE … WITHSCORES` and `GET`, one by one and as `/pipeline`; it is refused `SET`, `EXPIREAT` and `/multi-exec` (HTTP 403 `NOPERM`), even for reads. It ran `SCAN` (HTTP 200), so it can list every key in the database. Run 40594002369 also saw it refused a `SET` through `/pipeline`, `DEL`, an `EVAL` of a `SET` and `KEYS`, with no key made and none deleted. |
| 10 | Chrome's PDF viewer with the site's headers | Pass, Peter's check by hand (decision record row 160): Chrome's own PDF viewer showed both pages of the PDF on run 40583006081's deployment. Check 4 shows that PDF served byte for byte with the six headers, no policy, `content-type: application/pdf` and `content-disposition: inline`. One browser, signed in to Vercel, on one deployment URL. |
| 11 | The Vercel Toolbar stays off | Pass for the production setting; the header's own effect is not proven. Runs 40583006081, 40581693149 and 40582697904 on production deployments: with the toolbar off for production, Chrome on the deployment URL makes no request to `vercel.live`, has no toolbar element and no policy violation, and receives the built file byte for byte; a plain request without `x-vercel-skip-toolbar` also gets the built file; planted controls prove the listener and both policies work. Preview run 40584951645 (toolbar on by default, on `prototype/d3-preview`): a plain request without the header got other bytes, so check 11 goes red there. But headless Chrome got the built file with and without the header, so the header's effect was not seen. |
| 12 | The status helper's name, and that Deployment Checks hold the domains until it passes | Not run on the spike: it needs a workflow on `main`, because a `repository_dispatch` event starts only workflows on the default branch. It runs at task D32 and setup step 10, where the release check's first production run shows the status helper's name. This note records its verdict then. |

### Facts the spike adds

- **Function folders.** In the filesystem phase, Vercel serves each function folder at its own path, before any route after that phase (check 3: `/__server`). Vercel's docs give the nested form: "a directory located at `.vercel/output/functions/api/posts.func` will be accessible at the URL path `/api/posts`" (https://vercel.com/docs/build-output-api/primitives#functions). Nitro writes a `.func` link to `__server.func` for each of its routes when its compatibility date is 2025-07-15 or later (`getObservabilityRoutes`, `nitro` 3.0.260903-beta). A folder scan that follows links finds them; that was a local test, and no Vercel run had a link.
- **A route reaches a function, and the function sees the asked path**, not the route's `dest` (check 2). Routes before and after the filesystem phase both reach `/__server` (checks 2 and 6).
- **Static files.** Vercel sends `content-disposition: inline; filename="<name>"` with each static file (`inline` alone for `/`), and its default `cache-control: public, max-age=0, must-revalidate` on a 308 (checks 4 and 5).
- **The lockfile versions.** The spike README cites only Bun PR #31539, Bun issue #28792 and the `@vercel/build-utils` changelog; the D6 builder added Bun PR #38333 and the two third-party pull requests, and the D6 fix checked each one at its source on 2026-10-27.
  - Bun 1.4 writes a new `bun.lock` with `lockfileVersion: 2` (PR #31539, in the README). It keeps an existing version-1 lockfile at version 1.
  - It writes `lockfileVersion: 3` only for nested or version-scoped overrides: "Rules persist inside the `overrides` section and the file is stamped `lockfileVersion: 3` **only when such rules exist**" (https://github.com/oven-sh/bun/pull/38333, merged 2026-08-14). This repository's override `"@acmelabs/design-system-mcp>zod"` is nested.
  - Older Bun reads neither: "Older Bun versions cannot read v2 lockfiles" (issue #28792, in the README), and version-3 lockfiles are "unreadable by older Bun" (PR #38333). Dependabot's pull request says the same of Bun 1.3.14, which "reads only v1" (https://github.com/dependabot/dependabot-core/pull/16071, closed unmerged). Nx's merged pull request makes Nx's own lockfile parser accept versions 2 and 3 (https://github.com/nrwl/nx/pull/36666).
  - Vercel's `@vercel/build-utils` 14.10.1 "selects the Bun 1.4 binary whenever the lockfile requires it" (https://unpkg.com/@vercel/build-utils@14.12.0/CHANGELOG.md, quoted in the README).
- **Vercel freezes a function between requests.** With no `waitUntil`, a write planned 2 s after the stream's end landed when the next request reached the function, 15 s later (check 7). Nitro's Vercel entry sets `req.waitUntil = context?.waitUntil` (`nitro/dist/presets/vercel/runtime/vercel.web.mjs`); that is Nitro's code, not a documented API.
- **`supportsCancellation`** is documented for Node.js only (https://vercel.com/docs/functions/functions-api-reference#cancel-requests). On the Bun runtime it ended the function when the client stopped reading, but `request.signal` did not abort, also in the function that `waitUntil` kept alive (check 7).
- **The WAF's place.** "Vercel's platform-wide firewall is the first line of defense […]. Once a request passes this layer, deployment protection checks whether it can continue […]. If allowed to go through, the request is subject to the rules that you configured with the Web Application Firewall (WAF)" (https://vercel.com/docs/vercel-firewall/firewall-concepts). So on a protected host a request meets the project's rules only with the bypass.
- **WAF rules apply to previews and to production.** A rule can test "Environment", and a rule without that condition applies to both (https://vercel.com/docs/vercel-firewall/vercel-waf/rule-configuration#parameters); the check 8 runs agree.
- **The WAF's answers.** The 403 and the 429 both carry `x-vercel-mitigated: deny`; the status tells a deny from a limit. The 403's body is `text/plain`, 59 bytes. After a 403 or the 429, the next request got its normal answer, and `GET /build-info.json` got 200: the rules had no persistent action (check 8).
- **Denied posts did not count toward the limit.** Three `text/plain` chat posts that "chat content type" denied came first, and the 429 still came at the 21st JSON post. A deny "blocks the request and no further rules are evaluated" (rule-configuration page, "Actions"). Seen for that pair of rules only.
- **The Request Path field** matched other spellings of `/api/chat` ("All operators are case insensitive", rule-configuration page) and decoded `%63`, as the routes decoded `%69` (check 8). "Raw Path" was not tested.
- **Persistent actions.** A deny or rate-limit action can carry a time-based block; the dashboard's "for" field "defaults to 1 minute", and then the address is blocked before any rule runs (https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules#persistent-actions). The dashboard shows that timeframe dropdown beside the action ("Then"); to set no block, "Remove the timeframe (If you don't want to enable persistent actions)" (same page, "Enable persistent actions", read 2026-10-27). SPEC-deploy's setup step 7 does that (Peter, row 169).
- **Deployment Protection.** Without the bypass, the Git branch URL and a deployment's own URL answer 302 to Vercel's sign-in; the production address answers 200.
- **Exact hosts in the redirects** (D6's reading of check 6). A pattern host would send the cron a 308 only in a route without the `.vercel.app` route's `/api/` exception. With the exception, the cron's path passes, but the pattern still redirects the pages on every deployment's own URL, which the release check's smoke check loads. Either way the redirects match exact hosts.

### A Stop on other hosts

Peter asked whether another host would deliver a visitor's Stop to the chat function (row 168). These are docs and one local run; no other host was tested. Sources read 2026-10-27.

- **Bun's own server**, as an always-on Bun process runs it, aborts `request.signal` when the client disconnects. The spike's local harness saw every stopped stream end as `abort` (spike README, checks 6, 7 and 9, "Local run").
- **Cloudflare Workers** fire `request.signal` "when the request to your Worker is canceled by the client", once the `enable_request_signal` compatibility flag is set (https://developers.cloudflare.com/changelog/post/2025-05-22-handle-request-cancellation/).
- **Vercel** documents cancellation for its Node.js runtime only: with `supportsCancellation`, "When the client disconnects, the signal fires and the function is terminated", and "Any work not wrapped in waitUntil or after will be lost on cancellation" (https://vercel.com/docs/functions/functions-api-reference#cancel-requests). On the Bun runtime the spike saw no abort (check 7).
- **A host's proxy.** Whether a host's proxy passes the client's disconnect on to the app is untested here. On Fly.io's forum, a reply that speaks for Fly ("We've had some weird routing issues") says that its proxy "closed the request to your app" after the client ended the connection before it sent the whole request. That case is an upload, not a streamed answer, and the forum does not mark the author as staff (https://community.fly.io/t/any-issues-with-proxy/17650, post 2).

### Open points

- **The version-3 lockfile.** `main`'s `bun.lock` has `lockfileVersion: 3` since the scoped `zod` override in `package.json` (task A9). No spike deployment built from a version-3 lockfile. With `bunVersion` `"1.4.x"` the build got Bun 1.4.4 also from a version-1 lockfile, and Bun 1.4 reads version 3. Unverified: whether Vercel's install step accepts version 3, and which of its two Bun 1.4 rules applies then. Open for D8.
- **`CRON_SECRET`.** Vercel documents that a cron call carries `Authorization: Bearer <CRON_SECRET>` once the project sets it (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs). The spike project set none, so no run saw it. Setup step 13 proves it on the real project.
- **The toolbar header.** No run proves that `x-vercel-skip-toolbar` keeps an enabled toolbar off. A second attempt would load a preview in Chrome with a user agent without `Headless`, make a plain request with and without the header, and print booleans about the changed bytes (whether they hold `vercel.live`).
- **Not tested:** a chat turn of up to 120 s under the 150 s `maxDuration` (check 7); the "api rate limit" rule, which never fired (check 8); the host redirects of pkloss.dev, pwk.dev and www.peterkloss.dev, which had no domain on the project (check 5); one header name in two spellings (check 4); a pattern host in a redirect (check 6).
