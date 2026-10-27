# PROTOTYPE: deploy spike

Throwaway code for SPEC-deploy's "Deploy spike". It lives on the branch `prototype/deploy-spike` and is never merged into `main`. Task D6 copies the verdicts below into research 12 and, where a rule changes, into SPEC-deploy.

## Question

What does a real Vercel deployment do with the site's build output? A local build cannot answer the spike's 12 checks (SPEC-deploy, "Deploy spike"); a throwaway deployment can.

## Setup

- Peter's throwaway project `resume-deploy-spike` in the team `peterkloss` (Pro). Its production branch is `prototype/deploy-spike`, its root folder `prototypes/deploy-spike/`. Its Ignored Build Step builds production only, so pushes to other branches build nothing there.
- Standard Protection with Vercel Authentication. The Actions secret `VERCEL_AUTOMATION_BYPASS_SECRET` lets the workflow through.
- No domains and no Anthropic key.

## What is here

- The site spike from `prototypes/csp-probe/` (its own verdict is in that folder's README), built with Nitro's Vercel preset as in `prototypes/nitro-vercel-output/`. Nitro writes `.vercel/output/`; the pages land in `.vercel/output/static/`.
- `vercel.json`: `bunVersion`, `framework: null`, the install command `bun ci` and the build command `bun run build`. The Ignored Build Step stays the project's own setting.
- `bun run build` runs four steps: `bun --bun vite build`, `post-build.ts`, `gen-sw.ts` (the Workbox service worker over `.vercel/output/static/`), then `build-info.ts`.
- `vite.config.ts` gives Nitro three functions, each a copy of Nitro's server with its own `.vc-config.json`:
  - `__server`, with SPEC-deploy's `vercel.functions.runtime: "bun1.4.x"`;
  - `/api/spike`, its own function through `vercel.functionRules`, as SPEC-deploy gives `/api/chat`: `bun1.4.x`, `maxDuration` 150, region `iad1`;
  - the probe `/api/spike-bun1x`, with Nitro's documented runtime value `"bun1.x"`.
  Each function's `environment` sets `SPIKE_FUNCTION` to its name, so the function can say which one answered.
- `src/site/routes/api.spike.ts`: `GET /api/spike` answers with `SPIKE_FUNCTION`, `Bun.version`, `Bun.revision`, the path the function saw, `VERCEL_REGION` and `VERCEL_ENV`. A query picks the function: none for `/api/spike`, `?function=server` for `/__server`, `?function=bun1x` for the probe.
- `post-build.ts`, the spike's twin of SPEC-deploy's `writeVercelConfig()` and `addPolicyTags()`: it writes `static/404.html` (no script), gives each HTML file its policy tag (D3), replaces Nitro's `routes` in `config.json` with the list in "Checks 2 and 3" below and the redirect and header routes in "Checks 4, 5, 10 and 11", keeps Nitro's other fields, and adds an override for each prerendered page and the cron `/api/cron/health` at `17 15 * * *`. The tags come before `gen-sw.ts`, as SPEC-deploy's build step 3 comes before step 4. It exports its route, header, policy and cron values, and `check.ts` imports them, so the two cannot drift apart. The build runs only when the file is the entry point (`import.meta.main`, https://bun.com/docs/guides/util/entrypoint), so the import writes nothing.
- `public/Peter-Kloss-Resume.pdf`: `main`'s `documents/Peter-Kloss-Resume.pdf`, blob `a83144c` (2 pages, US Letter, tagged). Vite copies `public/` into `.vercel/output/static/`, so the deployment serves it at `/Peter-Kloss-Resume.pdf` (check 10).
- `build-info.ts` writes `build-info.json` into the static output, at `/build-info.json` and again at `/api/build-info.json`. It holds:
  - the commit, `VERCEL_ENV`, and three addresses: the deployment's own (`VERCEL_URL`), the Git branch URL and the production address (`VERCEL_PROJECT_PRODUCTION_URL`);
  - `vercel.json`'s `bunVersion` and `bun.lock`'s `lockfileVersion`;
  - the output of `bun --version`, with the binary's path and revision;
  - each function's `runtime` and `maxDuration`, read from the built `.vc-config.json` files;
  - from `config.json`: the number of routes and the crons;
  - each prerendered page except `/`, read from the files, with its file's SHA-256 and the path its override names, and the SHA-256 of `404.html`;
  - the SHA-256 of `index.html`, the PDF and `sw.js`, the names of the `workbox-<hash>.js` files and one file in `assets/` (D3).
- It writes named fields only, because the build environment also holds the bypass secret. Checks take their expected values from this file, not from constants in `check.ts`.
- The prerender crawler skips the links to `.pdf`, `.docx` and `.txt`: they are files, not pages, and this branch commits none. Without the filter the build fails with "Failed to fetch /resume.pdf: Not Found".
- `check.ts` and `.github/workflows/spike-check.yml` (below).
- `local-checks.ts`: checks 4, 5 and 11 against local servers that answer as the D3 routes should, with two controls (see "Checks 4, 5, 10 and 11"). It tests the check code, not Vercel.

## How the checks reach the deployment

Each push to the branch starts `spike-check`, which runs on `ubuntu-24.04` with Bun 1.4.2:

1. `bun check.ts wait` reads the commit's statuses through GitHub's API and waits for Vercel's status for this project. A `failure` or `error` ends the run with Vercel's description and its dashboard link.
2. After `success`, it reads `/build-info.json` from the project's Git branch URL, `resume-deploy-spike-git-prototype-deploy-spike-peterkloss.vercel.app`, until the file names this commit. The file's `VERCEL_URL` is the deployment's own address.
3. It then reads `/api/build-info.json` from the production address, `project-8ar0o.vercel.app`, until that address serves the same commit, because the production address can lag the commit status. The `/api/` copy stays reachable after D3 adds the host redirect there, because SPEC-deploy's redirect leaves `/api/` alone. The polling on the protected hosts uses `/build-info.json`, so it does not count against the WAF's `/api/` rule.
4. `bun check.ts run` runs every check in `CHECKS`, in order, and prints one line per check: `check <n> (<name>): pass|FAIL: <what it saw>`, and for a failure the change from the spec's "If it fails" column. A check that throws gets a FAIL line, and the next check still runs. Then it prints `check 10 (PDF in Chrome's viewer): manual, Peter's: <the PDF on the deployment URL>`, the address for Peter's check.

The wait and the checks share one bound: 15 minutes from the start of the wait. The job's own timeout is 17 minutes, which adds room for setup. A newer push cancels the run, and only the newest run is worth a rerun: an older one waits for a commit that the branch URL no longer serves.

**Adding a check (D2 to D5).** Append a `Check` to `CHECKS` in `check.ts`. Its `run(ctx)` gets:

| Field | What it is |
|---|---|
| `deployment`, `production` | The deployment's own host (protected) and the production address (public) |
| `info` | This deployment's `build-info.json`, the source of expected values: each function's `runtime`, the prerendered pages with their hashes and overrides, the hash of `404.html`, and the crons |
| `deadline` | The end of the run's 15 minutes |
| `deploymentFetch(path, init, options)` | A request to the deployment, with the bypass and `x-vercel-skip-toolbar: 1` (`{ skipToolbar: false }` leaves that header out); redirects are not followed |
| `productionFetch(path, init)` | A request to the production address, with `x-vercel-skip-toolbar: 1` and never the bypass; redirects are not followed (check 5 reads the 308's `Location`) |
| `report(path)` | A flat JSON object that a spike function on the deployment reports: booleans, hosts and times. The store checks (7 and 9) run inside the function, which holds the `KV_*` variables, so the runner needs no new secret |
| `poll(label, maxMs, attempt)` | Calls `attempt` every 10 s until it returns a value, or until `maxMs` or the run's deadline passes. Check 6 polls a function's record of the cron's calls this way |
| `chrome(paths)` | Loads each path on the deployment in the runner's Chrome (`/usr/bin/google-chrome`, or `CHROME_PATH`), each in a fresh browser context, through the DevTools protocol over Bun's `WebSocket`, so the spike adds no package. Only requests to the deployment's host get the bypass and `x-vercel-skip-toolbar: 1`; the first also sends `x-vercel-set-bypass-cookie: true`, so the service worker's own requests pass. It reports, per page: the document's status and SHA-256, the page's policy violations, requests to `vercel.live` and to other hosts (the page's and its service worker's), a toolbar element, whether a service worker controls the page, console errors, and the violations of two planted controls (check 11) |

The bypass secret is read in one place, and it goes only to hosts that match this project's protected `*.vercel.app` names. The production address must equal the workflow's `SPIKE_PRODUCTION_HOST`.

Notes for later checks:
- Check 6: Vercel Cron calls on its own schedule, so the check waits inside the run's bound. A newer push cancels the run (`concurrency`), and with it the wait.
- Check 8: the WAF rules count per IP address over 10 minutes. A rerun within 10 minutes meets the old count, so check 8 runs last.

Why this route. With the project's settings, Vercel posts only a commit status, whose link is the dashboard, not the deployment's address; `deployment_status` and `repository_dispatch` are off, and `repository_dispatch` reaches only workflows on `main` anyway.

| Route to the deployment | Exact for the commit | Needs Peter | Effect on later checks |
|---|---|---|---|
| GitHub Deployments, with `deployment_status` turned on | Yes | Yes, a project setting | None |
| The production `.vercel.app` address and `build-info.json` | Yes | No | Breaks at D3: check 5 redirects that host to peterkloss.dev |
| Vercel's commit status, then the Git branch URL's `build-info.json` (chosen) | Yes | No | None |

## Verdicts

| # | Check | Task | Verdict |
|---|---|---|---|
| 1 | Which Bun runs the build, and whether `bunVersion` decides it | D1 | Pass, 2026-10-27 (run 40567813019). Bun 1.4.4 (`/bun1.4/bun`) runs the build. `bunVersion` decides it together with the lockfile: the build gets Bun 1.4 when `bunVersion` is `"1.4.x"` or `bun.lock` has `lockfileVersion: 2`, else Vercel's default Bun 1.3.14. SPEC-deploy's setup has both. See "Check 1" below |
| 2 | The post-build routes, the `overrides`, the cron, and the functions' Bun | D2 | Routes, overrides and the functions' Bun: pass, 2026-10-27 (run 40572167592). Vercel serves the routes and overrides that `post-build.ts` writes. A function with `runtime: "bun1.4.x"` runs Bun 1.4.1; one with `"bun1.x"` runs Bun 1.3.14, also with `bunVersion` `"1.4.x"`. Vercel also serves `<path>/index.html` at `<path>` with no override. The cron: not verified. The build's own `config.json` holds the cron entry, and Vercel built the deployment with it; that the project runs the cron stays unverified until D4's check 6 sees Vercel Cron call it. See "Checks 2 and 3" |
| 3 | Unknown paths, `/API/chat` and `/sources/x` get `/404.html` with status 404 | D2 | Pass, 2026-10-27 (run 40572167592), after one change to the routes: Nitro's `__server.func` answered at `/__server` (run 40570467882) until a route before the filesystem sent that path to `/404.html`. `caseSensitive: true` keeps `/API/spike` off its function. See "Checks 2 and 3" |
| 4 | How route headers merge | D3 | Pass, 2026-10-27 (run 40583006081, and 40581693149). For one header from two routes, the last matching route wins: the worker files get exactly one policy, the worker policy, and with the worker route first they get the header policy (control run 40582697904). The PDF gets no policy. The six headers and the header policy reach a function response and the not-found page from both its routes; the route's HSTS replaces Vercel's own. See "Checks 4, 5, 10 and 11" |
| 5 | A host redirect keeps the query string | D3 | Pass, 2026-10-27 (run 40583006081, and 40581693149, 40582697904). On the production `.vercel.app` address the route answers 308, and Vercel adds the request's query to the route's `Location`; `/api/` is not redirected. The route needs no query of its own. Vercel writes the query again (`+` becomes `%20`), and the 308 carries the header routes' headers |
| 6 | Vercel Cron reaches `/api/cron/health` under Standard Protection | D4 | Pending |
| 7 | Store writes finish after a stopped stream | D4 | Pending |
| 8 | The WAF rules' case handling and content-type condition | D5 | Pending |
| 9 | What the Upstash tokens can run | D4 | Pending |
| 10 | Chrome's PDF viewer with the site's headers | D3 | Pending: Peter's check by hand, at https://resume-deploy-spike-26t9pe7rk-peterkloss.vercel.app/Peter-Kloss-Resume.pdf. The runs show the PDF served byte for byte with the six headers, no policy, `content-type: application/pdf` and `content-disposition: inline` (check 4) |
| 11 | The Vercel Toolbar stays off | D3 | Pass, 2026-10-27 (run 40583006081, and 40581693149, 40582697904). In Chrome on the deployment URL, with the toolbar off for production and `x-vercel-skip-toolbar: 1`: no request to `vercel.live`, no toolbar element, no policy violation, and the built file byte for byte; without the header the page is the built file too. Planted controls prove the listener and both policies work. No run saw the toolbar on |
| 12 | The status helper's name and Deployment Checks | D5 | Pending |

## Check 1: the build's Bun

The build's Bun for each `bun.lock` version and `bunVersion` value. Each cell is one deployment, checked by its own `spike-check` run:

| `bun.lock` | `bunVersion` `"1.4.x"` | `bunVersion` `"1.x"` | no `bunVersion` |
|---|---|---|---|
| `lockfileVersion: 2` | Bun 1.4.4 (runs 40564053962, 40564612136, 40565038755, 40566878173, 40567813019) | Bun 1.4.4 (run 40564247218) | Bun 1.4.4 (run 40567115524) |
| `lockfileVersion: 1` | Bun 1.4.4 (run 40567318435) | Bun 1.3.14 (run 40567647834) | Bun 1.3.14 (run 40567495810) |

The verdict lines, word for word:

| Run | Commit | Lockfile, `bunVersion` | Verdict line |
|---|---|---|---|
| 40564053962 | `0ebfce2` | 2, `"1.4.x"` | `check 1 (build Bun): pass: the build ran Bun 1.4.4 (/bun1.4/bun, revision 38afee6c8), the line that vercel.json bunVersion "1.4.x" names` |
| 40564247218 | `e17572a` | 2, `"1.x"` | `check 1 (build Bun): FAIL: the build ran Bun 1.4.4 (/bun1.4/bun, revision 38afee6c8), but vercel.json bunVersion "1.x" names 1.3; if it fails: the install command installs Bun 1.4.2 and the build command calls $HOME/.bun/bin/bun` |
| 40567115524 | `aa97b86` | 2, none | `check 1 (build Bun): pass: the build ran Bun 1.4.4 (/bun1.4/bun, revision 38afee6c8); vercel.json bunVersion absent; bun.lock lockfileVersion 2` |
| 40567318435 | `9ee5945` | 1, `"1.4.x"` | `check 1 (build Bun): pass: the build ran Bun 1.4.4 (/bun1.4/bun, revision 38afee6c8); vercel.json bunVersion "1.4.x"; bun.lock lockfileVersion 1` |
| 40567495810 | `a10ae59` | 1, none | `check 1 (build Bun): FAIL: the build ran Bun 1.3.14 (/bun1/bun, revision 0d9b296af); vercel.json bunVersion absent; bun.lock lockfileVersion 1; SPEC-deploy needs Bun 1.4; if it fails: the install command installs Bun 1.4.2 and the build command calls $HOME/.bun/bin/bun` |
| 40567647834 | `b73d117` | 1, `"1.x"` | `check 1 (build Bun): FAIL: the build ran Bun 1.3.14 (/bun1/bun, revision 0d9b296af); vercel.json bunVersion "1.x"; bun.lock lockfileVersion 1; SPEC-deploy needs Bun 1.4; if it fails: the install command installs Bun 1.4.2 and the build command calls $HOME/.bun/bin/bun` |
| 40567813019 | `c4e7187` | 2, `"1.4.x"` (the final code) | `check 1 (build Bun): pass: the build ran Bun 1.4.4 (/bun1.4/bun, revision 38afee6c8); vercel.json bunVersion "1.4.x"; bun.lock lockfileVersion 2` |

Runs 40564053962 and 40564247218 used the first rule, which compared the build's Bun with the line `bunVersion` names. From `57ee1fd` on, check 1 passes when the build runs the 1.4 line, which is what SPEC-deploy needs. Runs 40567495810 and 40567647834 show the final rule going red on a real deployment, and naming the "If it fails" change.

- **Which Bun.** Bun 1.4.4, revision `38afee6c8`, at `/bun1.4/bun`. Vercel picks the patch; CI pins 1.4.2.
- **What decides it.** Either setting alone gives Bun 1.4: `bunVersion` `"1.4.x"` (with a version-1 lockfile) or `lockfileVersion: 2` (with `"1.x"` or no `bunVersion`). With neither, Vercel builds with its default, Bun 1.3.14 at `/bun1/bun`. This matches two lines of Vercel's `@vercel/build-utils` changelog (https://unpkg.com/@vercel/build-utils@14.12.0/CHANGELOG.md):
  - 14.1.1: "Support selecting Bun 1.4.x as an explicit runtime and build-time package manager".
  - 14.10.1: "The install step now selects the Bun 1.4 binary whenever the lockfile requires it, […] instead of always running the container's default Bun 1.3.x install."
- **My first verdict was wrong.** After run 40564247218 this README said that `bunVersion` does not decide the build's Bun. That held only with a version-2 lockfile, which picks Bun 1.4 whatever `bunVersion` says.
- **The version-1 lockfile.** It is the spike's `bun.lock` with `"lockfileVersion": 1`, and no other change. Bun's PR #31539 says version 2 only "gates two parse-time checks" (integrity for npm tarballs outside the registry, and unsafe git tags) "so that older lockfiles keep loading". Bun's list of 1.4 breaking changes (issue #28792) says: "Existing v0/v1 lockfiles continue to load. Older Bun versions cannot read v2 lockfiles." The spike's lockfile has no tarball, git, `file:` or `link:` entry. Bun 1.4.4 installed from it with `bun ci` and kept it at version 1, and Vercel's Bun 1.3.14 installed and built from it.
- **Vercel's docs on `"1.x"`**, quoted from https://vercel.com/docs/functions/runtimes/bun#configuring-the-runtime: "`"1.x"` selects the previous latest Bun version (currently `1.3.14`)." The runs agree for the build, but only with a version-1 lockfile.
- **For D6** (nothing in the spec changes here):
  - The "If it fails" change, the 1.4.2 installer, is not needed. SPEC-deploy sets `bunVersion` `"1.4.x"`, and `main`'s `bun.lock` has `lockfileVersion: 2`, so the build gets Bun 1.4 twice over.
  - SPEC-deploy's comment "`"1.x"` would be Bun 1.3.14" holds for the build only with a version-1 lockfile. For the functions, check 2 tells.
  - Vercel's guide to pin an exact build Bun, quoted from https://vercel.com/kb/guide/how-to-pin-a-specific-bun-version-for-vercel-builds: "In Project Settings or vercel.json, use `bunx bun@x.x.x install` as the Install Command." The spec's fallback names Bun's installer instead.

## Checks 2 and 3: the post-build routes and the not-found paths

**The routes `post-build.ts` writes**, in order. The steps in parentheses are SPEC-deploy's ("Routes"):

1. `^/assets/(.*)$`: `cache-control: public, max-age=31536000, immutable`, with `continue: true`. This is Nitro's rule, kept. D3 adds Workbox's file to it and the rest of step 2, the headers, and puts the host redirect before it (see "Checks 4, 5, 10 and 11").
2. Spike only: `^/api/spike$` with the query `function=server` goes to `/__server`, and with `function=bun1x` to `/api/spike-bun1x`. Both are case-sensitive and come before the filesystem, because the filesystem phase matches `/api/spike` to its own function first.
3. New to the spec's list: each function folder that no API route names gets `/404.html` with status 404, by its own path: `^/__server(?:/.*)?$` and `^/api/spike-bun1x(?:/.*)?$`. `post-build.ts` finds the folders in the output and follows symlinks.
4. `{ "handle": "filesystem" }` (step 3), with an override for each deep-dive page.
5. The API routes (step 4), each with `caseSensitive: true`: `^/api/spike$` to `/api/spike`, and `^/api/cron/health$` to `/__server`. D4 adds the health route's handler.
6. `^/(.*)$` to `/404.html` with status 404 (step 5).

**What the checks ask.**

- Check 2:
  - Each of the three `/api/spike` requests reaches the function it names (the answer's `SPIKE_FUNCTION`), and the function sees the path `/api/spike`.
  - `/api/spike` and `/__server`, which stand for SPEC-deploy's functions, run Bun 1.4. The probe's Bun is recorded, not judged.
  - Each prerendered page has an override, and its clean address serves its file byte for byte (the SHA-256 in `build-info.json`). The page list comes from the files, so a run without overrides still asks each clean address.
  - The build's own `config.json` holds the cron. This shows nothing about the project's cron, which D4's check 6 tests.
- Check 3: eight paths get HTTP 404 and `static/404.html` byte for byte. A function in this spike answers with TanStack's page or Nitro's JSON error, never that file, so the bytes show that no function answered. The control run with Nitro's own routes shows those other bodies.

FYI: `/API/spike` is the real case-sensitivity test, because the spike has no `/api/chat` route in any case, so `/API/chat` passes in every run. Each run sends about 7 requests to `/api/` paths, and they count toward the live WAF limit: 3 from check 2, `/API/chat`, `/API/spike` and `/api/spike-bun1x` from check 3 (whether the WAF counts `/API/` in capitals is check 8's question), and at least 1 from the wait step's read of `/api/build-info.json` on the production address.

**The runs.** Each row is one deployment, checked by its own `spike-check` run. Each control commit makes one change to the passing code before it: `7e915fa` for the first control, `db77a0b` for the other three. The final code is `db77a0b` with a folder scan that follows symlinks, and new comments.

| Run | Commit | What the commit changed | Check 2 | Check 3 |
|---|---|---|---|---|
| 40570467882 | `7c97f87` | The first D2 code, without route 3 | Pass | FAIL: `/__server` |
| 40570825406 | `5fc33ba` | Route 3 added | Pass | Pass |
| 40571090773 | `7e915fa` | Check 2 reads the pages from the files | Pass | Pass |
| 40571252827 | `6a321e2` | Control: `config.json` as Nitro wrote it | FAIL | FAIL |
| 40571589174 | `2aec137` | Control: no overrides (on top of `db77a0b`, which restored `config.json` and fixed check 2's runtime label) | FAIL: the overrides | Pass |
| 40571744659 | `2176dcc` | Control: the API routes without `caseSensitive` | Pass | FAIL: `/API/spike` |
| 40571893452 | `199f8cb` | Control: no `vercel.functions.runtime`, so Nitro writes `"bun1.x"` | FAIL: Bun 1.3.14 | Pass |
| 40572167592 | `077e03f` | The final code | Pass | Pass |

The verdict lines, word for word. In run 40571252827, check 2 printed the runtime of the function a route should reach, not of the one that answered; commit `db77a0b` fixed that label.

Run 40570467882 (`7c97f87`, the first D2 code, without route 3):

```text
check 2 (post-build routes): pass: config.json has 7 routes; /api/spike reached /api/spike (runtime "bun1.4.x"): Bun 1.4.1, path /api/spike; /api/spike?function=server reached /__server (runtime "bun1.4.x"): Bun 1.4.1, path /api/spike; /api/spike?function=bun1x reached /api/spike-bun1x (runtime "bun1.x"): Bun 1.3.14, path /api/spike; /deep-dives/agent-workflows: HTTP 200, the file deep-dives/agent-workflows/index.html; /deep-dives/design-system-mcp: HTTP 200, the file deep-dives/design-system-mcp/index.html; config.json has the cron /api/cron/health "17 15 * * *"
check 3 (not-found paths): FAIL: /__server answered HTTP 404 with another body (text/html; charset=utf-8); the others got 404.html with status 404; if it fails: as check 2: the routes move to the form Vercel accepts
```

Run 40570825406 (`5fc33ba`, route 3 added):

```text
check 2 (post-build routes): pass: config.json has 9 routes; /api/spike reached /api/spike (runtime "bun1.4.x"): Bun 1.4.1, path /api/spike; /api/spike?function=server reached /__server (runtime "bun1.4.x"): Bun 1.4.1, path /api/spike; /api/spike?function=bun1x reached /api/spike-bun1x (runtime "bun1.x"): Bun 1.3.14, path /api/spike; /deep-dives/design-system-mcp: HTTP 200, the file deep-dives/design-system-mcp/index.html; /deep-dives/agent-workflows: HTTP 200, the file deep-dives/agent-workflows/index.html; config.json has the cron /api/cron/health "17 15 * * *"
check 3 (not-found paths): pass: /no-such-page, /API/chat, /API/spike, /sources/x, /deep-dives/x, /__server, /api/spike-bun1x, /_serverFn/x: HTTP 404 with static/404.html byte for byte, so no function rendered them
```

Run 40571090773 (`7e915fa`, check 2 reads the pages from the files):

```text
check 2 (post-build routes): pass: config.json has 9 routes; /api/spike reached /api/spike (runtime "bun1.4.x"): Bun 1.4.1, path /api/spike; /api/spike?function=server reached /__server (runtime "bun1.4.x"): Bun 1.4.1, path /api/spike; /api/spike?function=bun1x reached /api/spike-bun1x (runtime "bun1.x"): Bun 1.3.14, path /api/spike; /deep-dives/agent-workflows (override): HTTP 200, the file deep-dives/agent-workflows/index.html; /deep-dives/design-system-mcp (override): HTTP 200, the file deep-dives/design-system-mcp/index.html; config.json has the cron /api/cron/health "17 15 * * *"
check 3 (not-found paths): pass: /no-such-page, /API/chat, /API/spike, /sources/x, /deep-dives/x, /__server, /api/spike-bun1x, /_serverFn/x: HTTP 404 with static/404.html byte for byte, so no function rendered them
```

Run 40571252827 (`6a321e2`, control: `config.json` as Nitro wrote it):

```text
check 2 (post-build routes): FAIL: /api/spike?function=server reached /api/spike, not /__server; /api/spike?function=bun1x reached /api/spike, not /api/spike-bun1x; config.json has no override for deep-dives/agent-workflows/index.html; config.json has no override for deep-dives/design-system-mcp/index.html; config.json has no cron /api/cron/health "17 15 * * *"; seen: config.json has 6 routes; /api/spike reached /api/spike (runtime "bun1.4.x"): Bun 1.4.1, path /api/spike; /api/spike?function=server reached /api/spike (runtime "bun1.4.x"): Bun 1.4.1, path /api/spike; /api/spike?function=bun1x reached /api/spike (runtime "bun1.x"): Bun 1.4.1, path /api/spike; /deep-dives/agent-workflows (no override): HTTP 200, the file deep-dives/agent-workflows/index.html; /deep-dives/design-system-mcp (no override): HTTP 200, the file deep-dives/design-system-mcp/index.html; config.json has no cron; if it fails: the routes move to the form Vercel accepts; the runtime value is the one that gives Bun 1.4
check 3 (not-found paths): FAIL: /no-such-page answered HTTP 404 with another body (text/html; charset=utf-8); /API/chat answered HTTP 404 with another body (text/html; charset=utf-8); /API/spike answered HTTP 200 with another body (application/json;charset=utf-8); /sources/x answered HTTP 404 with another body (text/html; charset=utf-8); /deep-dives/x answered HTTP 500 with another body (text/html; charset=utf-8); /__server answered HTTP 404 with another body (text/html; charset=utf-8); /api/spike-bun1x answered HTTP 404 with another body (text/html; charset=utf-8); /_serverFn/x answered HTTP 403 with another body (null); the others got 404.html with status 404; if it fails: as check 2: the routes move to the form Vercel accepts
```

Run 40571589174 (`2aec137`, control: no overrides):

```text
check 2 (post-build routes): FAIL: config.json has no override for deep-dives/agent-workflows/index.html; config.json has no override for deep-dives/design-system-mcp/index.html; seen: config.json has 9 routes; /api/spike reached /api/spike (runtime "bun1.4.x"): Bun 1.4.1, path /api/spike; /api/spike?function=server reached /__server (runtime "bun1.4.x"): Bun 1.4.1, path /api/spike; /api/spike?function=bun1x reached /api/spike-bun1x (runtime "bun1.x"): Bun 1.3.14, path /api/spike; /deep-dives/agent-workflows (no override): HTTP 200, the file deep-dives/agent-workflows/index.html; /deep-dives/design-system-mcp (no override): HTTP 200, the file deep-dives/design-system-mcp/index.html; config.json has the cron /api/cron/health "17 15 * * *"; if it fails: the routes move to the form Vercel accepts; the runtime value is the one that gives Bun 1.4
check 3 (not-found paths): pass: /no-such-page, /API/chat, /API/spike, /sources/x, /deep-dives/x, /__server, /api/spike-bun1x, /_serverFn/x: HTTP 404 with static/404.html byte for byte, so no function rendered them
```

Run 40571744659 (`2176dcc`, control: the API routes without `caseSensitive`):

```text
check 2 (post-build routes): pass: config.json has 9 routes; /api/spike reached /api/spike (runtime "bun1.4.x"): Bun 1.4.1, path /api/spike; /api/spike?function=server reached /__server (runtime "bun1.4.x"): Bun 1.4.1, path /api/spike; /api/spike?function=bun1x reached /api/spike-bun1x (runtime "bun1.x"): Bun 1.3.14, path /api/spike; /deep-dives/agent-workflows (override): HTTP 200, the file deep-dives/agent-workflows/index.html; /deep-dives/design-system-mcp (override): HTTP 200, the file deep-dives/design-system-mcp/index.html; config.json has the cron /api/cron/health "17 15 * * *"
check 3 (not-found paths): FAIL: /API/spike answered HTTP 200 with another body (application/json;charset=utf-8); the others got 404.html with status 404; if it fails: as check 2: the routes move to the form Vercel accepts
```

Run 40571893452 (`199f8cb`, control: no `vercel.functions.runtime`):

```text
check 2 (post-build routes): FAIL: /api/spike (runtime "bun1.x") runs Bun 1.3.14; SPEC-deploy needs 1.4; /__server (runtime "bun1.x") runs Bun 1.3.14; SPEC-deploy needs 1.4; seen: config.json has 9 routes; /api/spike reached /api/spike (runtime "bun1.x"): Bun 1.3.14, path /api/spike; /api/spike?function=server reached /__server (runtime "bun1.x"): Bun 1.3.14, path /api/spike; /api/spike?function=bun1x reached /api/spike-bun1x (runtime "bun1.x"): Bun 1.3.14, path /api/spike; /deep-dives/agent-workflows (override): HTTP 200, the file deep-dives/agent-workflows/index.html; /deep-dives/design-system-mcp (override): HTTP 200, the file deep-dives/design-system-mcp/index.html; config.json has the cron /api/cron/health "17 15 * * *"; if it fails: the routes move to the form Vercel accepts; the runtime value is the one that gives Bun 1.4
check 3 (not-found paths): pass: /no-such-page, /API/chat, /API/spike, /sources/x, /deep-dives/x, /__server, /api/spike-bun1x, /_serverFn/x: HTTP 404 with static/404.html byte for byte, so no function rendered them
```

Run 40572167592 (`077e03f`, the final code):

```text
check 2 (post-build routes): pass: config.json has 9 routes; /api/spike reached /api/spike (runtime "bun1.4.x"): Bun 1.4.1, path /api/spike; /api/spike?function=server reached /__server (runtime "bun1.4.x"): Bun 1.4.1, path /api/spike; /api/spike?function=bun1x reached /api/spike-bun1x (runtime "bun1.x"): Bun 1.3.14, path /api/spike; /deep-dives/agent-workflows (override): HTTP 200, the file deep-dives/agent-workflows/index.html; /deep-dives/design-system-mcp (override): HTTP 200, the file deep-dives/design-system-mcp/index.html; config.json has the cron /api/cron/health "17 15 * * *"
check 3 (not-found paths): pass: /no-such-page, /API/chat, /API/spike, /sources/x, /deep-dives/x, /__server, /api/spike-bun1x, /_serverFn/x: HTTP 404 with static/404.html byte for byte, so no function rendered them
```

**What the runs show.**

- **The functions' Bun.** A function whose `.vc-config.json` says `"bun1.4.x"` runs Bun 1.4.1, and one that says `"bun1.x"` runs Bun 1.3.14, also with `bunVersion` `"1.4.x"` in `vercel.json`. So `bunVersion` and the lockfile decide the build's Bun (check 1), and the function's own runtime value decides the function's. Without `vercel.functions.runtime`, Nitro writes `"bun1.x"` for every function, and both of the spec's functions run Bun 1.3.14 (run 40571893452). A function can name `"bun1.4.x"`, which research 12 left open. Vercel picks the patch: the functions run 1.4.1 and the build 1.4.4, and CI pins 1.4.2.
- **A route reaches a function, and the function sees the asked path.** `?function=server` reached `/__server`, and the function saw `/api/spike`, not `/__server`. So SPEC-deploy's `/api/status` and `/api/cron/health` to `/__server` can work. These runs tested the form before the filesystem; the spec's form after it, `/api/cron/health`, is D4's (check 6). Vercel's docs agree: the `request.path` transform "overrides the path the runtime observes (`req.url`)", so without one the runtime sees the request's path (https://vercel.com/docs/build-output-api/configuration#routes).
- **A function folder answers at its own path: seen for `/__server` only.** In run 40570467882, `/__server` got HTTP 404 with TanStack's page from Nitro's function. The filesystem phase found the folder before any route after it, so SPEC-deploy's last route never saw `/__server`. Route 3 fixes it, and a route's `dest` still reaches the folder (runs 40570825406 and later). The nested form, a folder such as `api/posts.func` at `/api/posts`, comes from Vercel's docs, not from a run: "a directory located at `.vercel/output/functions/api/posts.func` will be accessible at the URL path `/api/posts`" (https://vercel.com/docs/build-output-api/primitives#functions). `/api/spike-bun1x` joined check 3 only after route 3 existed, so no run asked it without the route.
- **Symlinked function folders: from Nitro's source and a local test, not from a Vercel run.** Nitro writes a `.func` symlink to `__server.func` for each of its routes when its compatibility date is 2025-07-15 or later (`getObservabilityRoutes` in `nitro` 3.0.260903-beta, `dist/_presets.mjs`), page routes included. This build writes none, so no run on Vercel had one. Such a folder would answer at its own path too, by the rule above, so `post-build.ts` follows symlinks when it finds the folders. A local test with a link showed the scan finds it.
- **Case.** The filesystem phase matches a function's folder with case: `/API/spike` got `404.html` in every run with `caseSensitive: true`. Without it, the API route matched `/API/spike`, and the function answered HTTP 200 (run 40571744659). So `caseSensitive: true` is what keeps an API path in another case off its function. `/API/chat` passes in every run, because the spike has no `/api/chat` route in any case; `/API/spike` is the real test.
- **Overrides.** Vercel serves `<path>/index.html` at `<path>` with no override. In run 40571589174 (no overrides, and no route that sends a page to a function), `/deep-dives/<id>` answered HTTP 200 with its file byte for byte. Nitro agrees: it writes no override for a file whose path, without `index.html`, is the route (`getPrerenderOverrides`, same file). So the overrides do not give the pages their clean addresses. Check 2 still asks for them, because SPEC-deploy names them.
- **Nitro's own routes** (run 40571252827). `/(.*)` to `/__server` sends every path that is not a file to the function: TanStack's page with HTTP 404 for `/no-such-page`, `/sources/x` and `/__server`, HTTP 500 for `/deep-dives/x`, HTTP 403 for `/_serverFn/x`, and HTTP 200 from `/api/spike`'s function for `/API/spike`, because routes match without regard to case. Nitro's `config.json` has no overrides and no cron. On Vercel it had 6 routes, one more than a local build writes; these runs do not show which route Vercel's build added.
- **The cron: not verified.** The build's own `config.json` holds `{ "path": "/api/cron/health", "schedule": "17 15 * * *" }`, and Vercel built and served each deployment with it. Check 2's cron line shows only that: it reads `build-info.json`, which the same build writes. That the project runs the cron stays unverified until D4's check 6 sees Vercel Cron call the route. The workflow has no Vercel token, and agents do not sign in. Until D4 adds the handler, a cron call gets TanStack's 404 page from `__server`.

**For D6** (nothing in the spec changes here; each item is a spec change for Peter's approval, as a route is "ask first"):

- Routes: add route 3 before the filesystem. Each function folder that no API route names, Nitro's `/__server` and any symlinked folder, gets `/404.html` with status 404. `writeVercelConfig()` finds the folders in the output, symlinks included, and `config.test.ts` checks the route. SPEC-site's `bun run preview` (amendment 7) answers `/__server` the same way. Only `/__server` was seen on Vercel; the nested folders come from Vercel's docs, and the symlinked ones from Nitro's source and a local test.
- Cron: check 2's verdict for the cron is "not verified" until D4's check 6. Copy it so, not as a pass.
- Overrides: not needed for `<path>/index.html`. Keeping them costs nothing, and the runs pass with them; dropping them makes step 3 a plain `handle: filesystem`. Either way, `bun run preview` serves `<path>/index.html` at `<path>`.
- Runtime: keep `functions: { runtime: "bun1.4.x" }`. The spec's comment "Nitro writes "bun1.x" when nothing is set; spike check 2" can say that `"bun1.x"` runs Bun 1.3.14. Research 12's last line ("whether a function can name `"bun1.4.x"` is a spike check") is answered: it can.
- `caseSensitive: true` stays: the spec needs it.

**For D3 to D5.**

- D3: the header routes go in step 2, before route 2 here. Route 3 and route 6 answer with `/404.html` and status 404, so check 4 asks whether headers reach both.
- D4: route 5 sends `/api/cron/health` to `/__server`; D4 adds the handler file. Vercel sends `x-vercel-cron-schedule` with each cron call (https://vercel.com/docs/cron-jobs/manage-cron-jobs#reading-the-cron-schedule-header).
- D5: each run sends about 7 requests to `/api/` paths (see the FYI under "What the checks ask"), and they count toward the "api rate limit" rule (60 in 10 minutes per address).

## Checks 4, 5, 10 and 11: the headers, the redirect, the PDF and the toolbar

**What D3 adds to the build.** The steps in parentheses are SPEC-deploy's ("Routes", "Headers", "The build script").

1. The host redirect (step 1), first of all routes: `^/(?!api/)(.*)$` with `has` host `{ "eq": "project-8ar0o.vercel.app" }`, `status: 308` and `Location: https://peterkloss.dev/$1`. `$1` is the path without its leading slash, and the route names no query. The spike has this one host route: pkloss.dev, pwk.dev and www.peterkloss.dev have no domain on this project, so no request reaches them.
2. The header routes (step 2), each with `continue: true`, in this order:
   1. `^/(?:assets/.*|workbox-[0-9a-f]+\.js)$`: `cache-control: public, max-age=31536000, immutable` (Nitro's rule, plus Workbox's file).
   2. `^/(.*)$`: the six headers of SPEC-deploy's table.
   3. `^/(?!(?:Peter-Kloss-Resume\.pdf|Peter-Kloss-Resume\.docx|Peter-Kloss-Resume\.txt)$).*$`: the header policy.
   4. `^/(?:sw\.js|workbox-[0-9a-f]+\.js)$`: the worker policy. The worker files match routes 3 and 4, so they get the policy header from two routes: this is the merge that check 4 asks about.
   Every route writes each header name in lower case, so no two routes set one header under two spellings.
3. The policy tags (step 3): each HTML file, `404.html` included, starts its `<head>` with `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' <hashes>">`. The three prerendered pages have 4 inline scripts each; `404.html` has none and gets `script-src 'self'` alone. The tags come before `gen-sw.ts`, so the precache holds the tagged pages.
4. The PDF: `public/Peter-Kloss-Resume.pdf`, `main`'s committed public PDF.

**What the checks ask.**

- Check 4: nine paths on the deployment, each against the six headers (exact values), the policy header (exact value, so two policies would arrive joined by ", " and fail) and the cache rule where SPEC-deploy names one: `/`, a deep dive, `/sw.js`, `/workbox-<hash>.js`, an `/assets/` file, the PDF (also `application/pdf`, byte for byte), the function `/api/spike`, and the not-found page from the last route (`/no-such-page`) and from the route before the filesystem (`/__server`).
- Check 5: on the production address, `/resume?x=1`, `/?a=1&b=two` and a deep dive with no query must answer 308 with exactly that path and query on peterkloss.dev, and `/api/build-info.json` must answer 200 with this commit. A path with encoded characters, and the headers on the 308, are recorded, not judged.
- Check 11: Chrome loads `/`, a deep dive and `/no-such-page` on the deployment URL, each in a fresh browser context, with `x-vercel-skip-toolbar: 1` and the bypass on its requests to that host only. Each load must show no request to `vercel.live`, no toolbar element, no policy violation, the right status, and the built file byte for byte as Chrome received it, so Vercel injected nothing. After that, two planted controls must each give a violation: an image from `example.invalid` (the header's `img-src`) and an inline script (the tag's `script-src`). They prove that the listener works and that both policies are enforced on the real deployment. Last, a plain request for `/` without `x-vercel-skip-toolbar` must get the built file too, which shows that the production setting alone keeps the toolbar out.
- Check 10 is Peter's, by hand. The run prints the PDF's address on the deployment URL.

`local-checks.ts` runs checks 4, 5 and 11 against two local servers that answer as these routes should. All three pass; with `merge-first` check 4 fails on the worker files, and with `style-none` check 11 fails on the pages' own violations. It tests the check code and Chrome's part, not Vercel.

**The runs.**

| Run | Commit | What the commit changed | Check 4 | Check 5 | Check 11 |
|---|---|---|---|---|---|
| 40581693149 | `d092eb6` | The D3 routes, tags, PDF and checks | Pass | Pass | Pass |
| 40582697904 | `82ba906` | Control: the worker policy route before the header policy route (on top of `3ad148b`, which records the 308's headers and adds `local-checks.ts`) | FAIL: the worker files get the header policy | Pass | Pass |
| 40583006081 | `4929a15` | The final code: the control reverted | Pass | Pass | Pass |

Checks 1 to 3 passed in all three runs, as in D2.

The verdict lines, word for word.

Run 40581693149 (`d092eb6`, the D3 code):

```text
check 4 (route headers): pass: / (a page): HTTP 200, the six headers, the header policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline"; /deep-dives/agent-workflows (a deep dive): HTTP 200, the six headers, the header policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline; filename=\"agent-workflows\""; /sw.js (the service worker): HTTP 200, the six headers, the worker policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline; filename=\"sw.js\""; /workbox-1ce433d4.js (Workbox): HTTP 200, the six headers, the worker policy, cache-control "public, max-age=31536000, immutable", content-disposition "inline; filename=\"workbox-1ce433d4.js\""; /assets/_id-CtqVfDmn.js (a hashed asset): HTTP 200, the six headers, the header policy, cache-control "public, max-age=31536000, immutable", content-disposition "inline; filename=\"_id-CtqVfDmn.js\""; /Peter-Kloss-Resume.pdf (the PDF): HTTP 200, the six headers, no policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline; filename=\"Peter-Kloss-Resume.pdf\""; /api/spike (a function): HTTP 200, the six headers, the header policy, cache-control "no-store"; /no-such-page (the not-found page, last route): HTTP 404, the six headers, the header policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline; filename=\"404.html\""; /__server (the not-found page, route before the filesystem): HTTP 404, the six headers, the header policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline; filename=\"404.html\""
check 5 (host redirect): pass: /resume?x=1: HTTP 308 to https://peterkloss.dev/resume?x=1; /?a=1&b=two: HTTP 308 to https://peterkloss.dev/?a=1&b=two; /deep-dives/agent-workflows: HTTP 308 to https://peterkloss.dev/deep-dives/agent-workflows; /a%20b/%C3%A9?q=%2F&r=a+b: HTTP 308 to https://peterkloss.dev/a%20b/%C3%A9?q=%2F&r=a%20b; the 308 carries strict-transport-security, x-content-type-options, referrer-policy, permissions-policy, cross-origin-opener-policy, x-frame-options, cache-control "public, max-age=0, must-revalidate"; /api/build-info.json: HTTP 200, commit d092eb6
check 11 (Vercel Toolbar): pass: /: HTTP 200, the built file byte for byte, 0 policy violations, 0 requests to vercel.live, other hosts: none, planted controls: script-src-elem inline, img-src https://example.invalid/spike-control.png, img-src https://example.invalid/spike-control.png, service worker controls the page, 2 console errors (console: TypeError: Invalid action variant at set variant (https://resume-deploy-spike-pqcn5i4qt-peterkloss.vercel.app/assets/routes-DcKKjtoG.js:395:15588) at Reflect.se | network: Failed to load resource: the server responded with a status of 404 ()); /deep-dives/agent-workflows: HTTP 200, the built file byte for byte, 0 policy violations, 0 requests to vercel.live, other hosts: none, planted controls: script-src-elem inline, img-src https://example.invalid/spike-control.png, img-src https://example.invalid/spike-control.png, service worker controls the page, 0 console errors; /no-such-page: HTTP 404, the built file byte for byte, 0 policy violations, 0 requests to vercel.live, other hosts: none, planted controls: script-src-elem inline, img-src https://example.invalid/spike-control.png, img-src https://example.invalid/spike-control.png, service worker does not control the page, 1 console errors (network: Failed to load resource: the server responded with a status of 404 ()); / without x-vercel-skip-toolbar: HTTP 200, the built file byte for byte
check 10 (PDF in Chrome's viewer): manual, Peter's: https://resume-deploy-spike-pqcn5i4qt-peterkloss.vercel.app/Peter-Kloss-Resume.pdf
```

Run 40582697904 (`82ba906`, control: the worker policy route first), check 4 and check 5:

```text
check 4 (route headers): FAIL: /sw.js (the service worker): the header policy, not the worker policy; /workbox-1ce433d4.js (Workbox): the header policy, not the worker policy; seen: / (a page): HTTP 200, the six headers, the header policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline"; /deep-dives/agent-workflows (a deep dive): HTTP 200, the six headers, the header policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline; filename=\"agent-workflows\""; /sw.js (the service worker): HTTP 200, the six headers, the header policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline; filename=\"sw.js\""; /workbox-1ce433d4.js (Workbox): HTTP 200, the six headers, the header policy, cache-control "public, max-age=31536000, immutable", content-disposition "inline; filename=\"workbox-1ce433d4.js\""; /assets/_id-CtqVfDmn.js (a hashed asset): HTTP 200, the six headers, the header policy, cache-control "public, max-age=31536000, immutable", content-disposition "inline; filename=\"_id-CtqVfDmn.js\""; /Peter-Kloss-Resume.pdf (the PDF): HTTP 200, the six headers, no policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline; filename=\"Peter-Kloss-Resume.pdf\""; /api/spike (a function): HTTP 200, the six headers, the header policy, cache-control "no-store"; /no-such-page (the not-found page, last route): HTTP 404, the six headers, the header policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline; filename=\"404.html\""; /__server (the not-found page, route before the filesystem): HTTP 404, the six headers, the header policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline; filename=\"404.html\""; if it fails: the header routes change, so each path gets exactly one policy
check 5 (host redirect): pass: /resume?x=1: HTTP 308 to https://peterkloss.dev/resume?x=1; /?a=1&b=two: HTTP 308 to https://peterkloss.dev/?a=1&b=two; /deep-dives/agent-workflows: HTTP 308 to https://peterkloss.dev/deep-dives/agent-workflows; /a%20b/%C3%A9?q=%2F&r=a+b: HTTP 308 to https://peterkloss.dev/a%20b/%C3%A9?q=%2F&r=a%20b; the 308 carries the six headers, the header policy, cache-control "public, max-age=0, must-revalidate"; /api/build-info.json: HTTP 200, commit 82ba906
```

Run 40583006081 (`4929a15`, the final code):

```text
check 4 (route headers): pass: / (a page): HTTP 200, the six headers, the header policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline"; /deep-dives/agent-workflows (a deep dive): HTTP 200, the six headers, the header policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline; filename=\"agent-workflows\""; /sw.js (the service worker): HTTP 200, the six headers, the worker policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline; filename=\"sw.js\""; /workbox-1ce433d4.js (Workbox): HTTP 200, the six headers, the worker policy, cache-control "public, max-age=31536000, immutable", content-disposition "inline; filename=\"workbox-1ce433d4.js\""; /assets/_id-CtqVfDmn.js (a hashed asset): HTTP 200, the six headers, the header policy, cache-control "public, max-age=31536000, immutable", content-disposition "inline; filename=\"_id-CtqVfDmn.js\""; /Peter-Kloss-Resume.pdf (the PDF): HTTP 200, the six headers, no policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline; filename=\"Peter-Kloss-Resume.pdf\""; /api/spike (a function): HTTP 200, the six headers, the header policy, cache-control "no-store"; /no-such-page (the not-found page, last route): HTTP 404, the six headers, the header policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline; filename=\"404.html\""; /__server (the not-found page, route before the filesystem): HTTP 404, the six headers, the header policy, cache-control "public, max-age=0, must-revalidate", content-disposition "inline; filename=\"404.html\""
check 5 (host redirect): pass: /resume?x=1: HTTP 308 to https://peterkloss.dev/resume?x=1; /?a=1&b=two: HTTP 308 to https://peterkloss.dev/?a=1&b=two; /deep-dives/agent-workflows: HTTP 308 to https://peterkloss.dev/deep-dives/agent-workflows; /a%20b/%C3%A9?q=%2F&r=a+b: HTTP 308 to https://peterkloss.dev/a%20b/%C3%A9?q=%2F&r=a%20b; the 308 carries the six headers, the header policy, cache-control "public, max-age=0, must-revalidate"; /api/build-info.json: HTTP 200, commit 4929a15
check 11 (Vercel Toolbar): pass: /: HTTP 200, the built file byte for byte, 0 policy violations, 0 requests to vercel.live, other hosts: none, planted controls: script-src-elem inline, img-src https://example.invalid/spike-control.png, img-src https://example.invalid/spike-control.png, service worker controls the page, 2 console errors (console: TypeError: Invalid action variant at set variant (https://resume-deploy-spike-26t9pe7rk-peterkloss.vercel.app/assets/routes-DcKKjtoG.js:395:15588) at Reflect.se | network: Failed to load resource: the server responded with a status of 404 ()); /deep-dives/agent-workflows: HTTP 200, the built file byte for byte, 0 policy violations, 0 requests to vercel.live, other hosts: none, planted controls: script-src-elem inline, img-src https://example.invalid/spike-control.png, img-src https://example.invalid/spike-control.png, service worker controls the page, 0 console errors; /no-such-page: HTTP 404, the built file byte for byte, 0 policy violations, 0 requests to vercel.live, other hosts: none, planted controls: script-src-elem inline, img-src https://example.invalid/spike-control.png, img-src https://example.invalid/spike-control.png, service worker does not control the page, 1 console errors (network: Failed to load resource: the server responded with a status of 404 ()); / without x-vercel-skip-toolbar: HTTP 200, the built file byte for byte
check 10 (PDF in Chrome's viewer): manual, Peter's: https://resume-deploy-spike-26t9pe7rk-peterkloss.vercel.app/Peter-Kloss-Resume.pdf
```

**What the runs show.**

- **One header, two routes: the last matching route wins.** The worker files match the header policy route and the worker policy route. With the worker route last, they got the worker policy (runs 40581693149 and 40583006081); with it first, the header policy (control run 40582697904). Each time they got exactly one policy, never two joined by ", ". So the more specific route does not win; the order does. SPEC-deploy's sentence "The worker files therefore get one full policy, from the last matching route" holds on Vercel.
- **Different headers from several routes add up.** Every response got the six headers from one route, its policy from another, and on `/assets/` and Workbox the cache rule from a third.
- **One HSTS value, the spec's.** Vercel adds `strict-transport-security: max-age=63072000` on its own (research 12). With the route's header, every response had exactly `max-age=63072000; includeSubDomains`, so the route's value replaces Vercel's, not joins it.
- **The headers reach function responses and the not-found page.** `/api/spike` got the six headers and the header policy, and kept its own `cache-control: no-store`. The not-found page got them from both routes that serve it: the last route (`/no-such-page`) and the route before the filesystem (`/__server`).
- **The PDF** got the six headers and no policy, `content-type: application/pdf`, Vercel's default `cache-control: public, max-age=0, must-revalidate`, and `content-disposition: inline; filename="Peter-Kloss-Resume.pdf"`, byte for byte the committed file. Vercel adds `content-disposition: inline` to every static file it served here, with the file name (`/` got `inline` alone); `inline` lets a browser show the file instead of saving it.
- **The cache rules** match SPEC-deploy's table: `/assets/` and `/workbox-<hash>.js` are immutable; the pages, `/sw.js` and the PDF keep Vercel's default.
- **The redirect keeps the query.** The route's `Location` names only the path (`https://peterkloss.dev/$1`), and Vercel added the request's query: `/resume?x=1` and `/?a=1&b=two` went to the same path and query, and a path with no query got no `?`. This matches how Vercel's own `vercel.json` `redirects` work: `@vercel/routing-utils` 6.6.0 (`dist/superstatic.js`, `convertRedirects`) compiles each one to this same route form, `{ src, headers: { Location }, status }`, and adds no query for a redirect, and Vercel's docs say a redirect passes the query through (research 12). So the "If it fails" change, a route that adds the query itself, is not needed.
- **Encoded characters.** The path `/a%20b/%C3%A9` reached `Location` unchanged. The query `q=%2F&r=a+b` arrived as `q=%2F&r=a%20b`: Vercel parses the query and writes it again, so a `+` becomes `%20`. Both mean a space in a form-encoded query, which is how URLSearchParams reads it.
- **`/api/` is not redirected** on the production address: `/api/build-info.json` answered 200 with the commit. The routes match without regard to case, so `(?!api/)` also leaves `/API/...` alone; no run asked that.
- **The 308 carries the header routes' headers.** The redirect route comes first and has no `continue`, but the 308 had the six headers and the header policy (control run and final run), and Vercel's default `cache-control: public, max-age=0, must-revalidate`. The header routes come after it. So on Vercel, the headers of the `continue` routes after the redirect route still reach the 308. SPEC-deploy names no cache rule for the redirect.
- **The toolbar stays off.** In every Chrome load: no request to `vercel.live`, no toolbar element, and the document byte for byte the built file. A plain request without `x-vercel-skip-toolbar` also got the built file. With the team's production setting Off, Vercel injects nothing into the deployment URL's pages, with or without the header. No run could show the toolbar on: the project has no preview deployments (its Ignored Build Step), and an agent does not change the setting.
- **The split policy works on the real deployment.** Chrome reported no policy violation on `/`, a deep dive and the not-found page, with the header policy and each page's tag. The planted controls each gave their violation (`img-src` for the image, `script-src-elem` for the inline script), so both policies are enforced there. The service worker took control of `/` and the deep dive, so its own requests (the precache) got through, with the bypass cookie.
- **Seen, not judged.** On `/`, Chrome logged `TypeError: Invalid action variant` from the design system's button in `routes-DcKKjtoG.js` (the spike's `DsButton`, older than D3), and one 404. The log does not name the 404's address; the local test shows Chrome asking for `/favicon.ico`, which the spike has not. The not-found page logs its own 404. None is a policy violation.
- **The WAF.** Each run sent about 9 requests to `/api/` paths: 1 from the wait step, 3 from check 2, 3 from check 3, 1 from check 4 and 1 from check 5. No run met a 429.

**Check 10, Peter's check.** He opens the PDF on the deployment URL in Chrome, signed in to Vercel. A pass: Chrome's own PDF viewer shows both pages of the resume, with its toolbar (page count, zoom, download), and the page is neither blank nor a download. A blank page, a "blocked" page or a file saved to Downloads is a fail; the "If it fails" change is that the documents' headers change.

**For D6** (nothing in the spec changes here):

- Check 4: the header routes as SPEC-deploy writes them work. Copy "the last matching route wins" as seen, with the control. D18's `writeVercelConfig()` keeps the worker policy route after the header policy route, and `config.test.ts` checks that order.
- Check 5: pass; the redirect route needs no query of its own. Record the `+` to `%20` change, and that the 308 carries the headers.
- Check 11: pass, with the limit above (no run with the toolbar on).
- Check 10: Peter's verdict, once he gives it.
- Research 12 can add: Vercel sends `content-disposition: inline; filename="<name>"` with static files, and its default `cache-control` on a 308.
- Not tested: whether one header name in two spellings (`Content-Security-Policy` in one route, `content-security-policy` in another) merges as one. The spike's routes spell every name in lower case, and D18 can do the same.

**For D4 and D5.**

- D4: the production address now answers 308 for every path outside `/api/`. Vercel Cron's `/api/cron/health` is under `/api/`, so the redirect leaves it alone.
- D5: check 8 can post to `/api/chat` on the production address without meeting the redirect. Each run already sends about 9 `/api/` requests.

## Seen on the way

- Each push deployed in about 20 to 30 seconds. Vercel's commit status reads "Vercel is deploying your app", then "Deployment has completed".
- Without the bypass, the Git branch URL and the deployment's own URL answer 302 to Vercel's sign-in. The production address `project-8ar0o.vercel.app` answers 200, as "Standard Protection protects all domains except production domains" says. D3 (check 5) and D4 (check 6) use that address.
- `/build-info.json` and `/api/build-info.json` are public on the production address. They hold no secret.
- `gh run list --workflow spike-check.yml` looks the file up on `main` and answers 404 until the workflow's first run exists. After that it works.
- A newer push cancels the older `spike-check` run (`concurrency`). Vercel also builds only the newest queued commit, so a superseded run would wait out its 15 minutes.

## Run locally

```sh
bun ci
bun run build              # writes .vercel/output/
bun local-checks.ts        # checks 4, 5 and 11 against local servers; needs Chrome (or CHROME_PATH)
```

`csp-test.ts` and `offline-test.ts` are the CSP probe's local tests; they still read `dist/client/`, the output folder before Nitro's Vercel preset.
