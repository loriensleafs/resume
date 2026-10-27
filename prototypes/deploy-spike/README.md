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
- `vite.config.ts` gives Nitro four functions, each a copy of Nitro's server with its own `.vc-config.json`:
  - `__server`, with SPEC-deploy's `vercel.functions.runtime: "bun1.4.x"`;
  - `/api/spike`, its own function through `vercel.functionRules`, as SPEC-deploy gives `/api/chat`: `bun1.4.x`, `maxDuration` 150, region `iad1`;
  - the probe `/api/spike-bun1x`, with Nitro's documented runtime value `"bun1.x"`;
  - `/api/spike-cancel` (D4, check 7): `/api/spike`'s settings plus `supportsCancellation: true`, Vercel's opt-in that ends a function when its client disconnects.
  Each function's `environment` sets `SPIKE_FUNCTION` to its name, so the function can say which one answered.
- `src/site/routes/api.spike.ts`: `GET /api/spike` answers with `SPIKE_FUNCTION`, `Bun.version`, `Bun.revision`, the path the function saw, `VERCEL_REGION` and `VERCEL_ENV`. A query picks the function: none for `/api/spike`, `?function=server` for `/__server`, `?function=bun1x` for the probe. D4 adds four modes (`?mode=`) for checks 6, 7 and 9, which answer only on the protected hosts (see "Checks 6, 7 and 9").
- `src/site/routes/api.cron.health.ts` (D4): the route Vercel Cron calls. It records each call in the store and answers which function took it.
- `src/site/spike-store.ts` (D4): the store calls, through Upstash's REST API with `fetch`, as SPEC-deploy's "Store calls" says. No package is added. The tokens never leave the file: a caller gets HTTP statuses, results and the first word of an error.
- `post-build.ts`, the spike's twin of SPEC-deploy's `writeVercelConfig()` and `addPolicyTags()`: it writes `static/404.html` (no script), gives each HTML file its policy tag (D3), replaces Nitro's `routes` in `config.json` with the list in "Checks 2 and 3" below and the redirect and header routes in "Checks 4, 5, 10 and 11", keeps Nitro's other fields, and adds an override for each prerendered page and the cron `/api/cron/health` at `17 15 * * *`. D4 adds a second cron on that path, daily at the first whole minute 4 minutes after the build (the probe, check 6), when `PROBE_CRON` is on; it is off since the D4 review. The tags come before `gen-sw.ts`, as SPEC-deploy's build step 3 comes before step 4. It exports its route, header, policy and cron values, and `check.ts` imports them, so the two cannot drift apart. The build runs only when the file is the entry point (`import.meta.main`, https://bun.com/docs/guides/util/entrypoint), so the import writes nothing.
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
5. Last, the job `waf` runs `bun check.ts waf` on a runner of its own: check 8 alone, against the same deployment, whatever the verdicts of step 4 (D5, see "Check 8").

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
| `poll(label, maxMs, attempt, everyMs)` | Calls `attempt` every `everyMs` (10 s when not given) until it returns a value, or until `maxMs` or the run's deadline passes. Check 6 polls a function's record of the cron's calls this way, every 30 s, when the probe cron is on |
| `chrome(paths)` | Loads each path on the deployment in the runner's Chrome (`/usr/bin/google-chrome`, or `CHROME_PATH`), each in a fresh browser context, through the DevTools protocol over Bun's `WebSocket`, so the spike adds no package. Only requests to the deployment's host get the bypass and `x-vercel-skip-toolbar: 1`; the first also sends `x-vercel-set-bypass-cookie: true`, so the service worker's own requests pass. It reports, per page: the document's status and SHA-256, the page's policy violations, requests to `vercel.live` and to other hosts (the page's and its service worker's), a toolbar element, whether a service worker controls the page, console errors, and the violations of two planted controls (check 11) |

The bypass secret is read in one place, and it goes only to hosts that match this project's protected `*.vercel.app` names. The production address must equal the workflow's `SPIKE_PRODUCTION_HOST`.

Notes for later checks:
- Check 6: Vercel Cron calls on its own schedule, so with the probe cron on, the check waits inside the run's bound. A newer push cancels the run (`concurrency`), and with it the wait. With the probe cron off (the default since the D4 review), it reads the cron's record once.
- Check 8: the WAF rules count per IP address over 10 minutes. A rerun within 10 minutes meets the old count, so check 8 runs last, in the job `waf` (see "Check 8").

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
| 2 | The post-build routes, the `overrides`, the cron, and the functions' Bun | D2 | Routes, overrides and the functions' Bun: pass, 2026-10-27 (run 40572167592). Vercel serves the routes and overrides that `post-build.ts` writes. A function with `runtime: "bun1.4.x"` runs Bun 1.4.1; one with `"bun1.x"` runs Bun 1.3.14, also with `bunVersion` `"1.4.x"`. Vercel also serves `<path>/index.html` at `<path>` with no override. The cron: not verified. The build's own `config.json` holds the cron entry, and Vercel built the deployment with it; that the project runs the cron stays unverified until D4's check 6 sees Vercel Cron call it. See "Checks 2 and 3". D4: check 6 saw Vercel Cron call a second cron on the same path that the build wrote (runs 40589291781 and 40591039392), so the project runs the crons in `config.json`. SPEC-deploy's own schedule has not fired yet |
| 3 | Unknown paths, `/API/chat` and `/sources/x` get `/404.html` with status 404 | D2 | Pass, 2026-10-27 (run 40572167592), after one change to the routes: Nitro's `__server.func` answered at `/__server` (run 40570467882) until a route before the filesystem sent that path to `/404.html`. `caseSensitive: true` keeps `/API/spike` off its function. See "Checks 2 and 3" |
| 4 | How route headers merge | D3 | Pass, 2026-10-27 (run 40583006081, and 40581693149). For one header from two routes, the last matching route wins: the worker files get exactly one policy, the worker policy, and with the worker route first they get the header policy (control run 40582697904). The PDF gets no policy. The six headers and the header policy reach a function response and the not-found page from both its routes; the route's HSTS replaces Vercel's own. See "Checks 4, 5, 10 and 11" |
| 5 | A host redirect keeps the query string | D3 | Pass, 2026-10-27 (run 40583006081, and 40581693149, 40582697904). On the production `.vercel.app` address the route answers 308, and Vercel adds the request's query to the route's `Location`; `/api/` is not redirected. The route needs no query of its own. Vercel writes the query again (`+` becomes `%20`), and the 308 carries the header routes' headers |
| 6 | Vercel Cron reaches `/api/cron/health` under Standard Protection | D4 | Pass, 2026-10-27 (runs 40589291781 and 40591039392). Vercel Cron called the deployment's own URL, `resume-deploy-spike-<hash>-peterkloss.vercel.app`, a protected host, and passed Standard Protection with no bypass. It did not call the project's production address `project-8ar0o.vercel.app`. The call came 6 s and 14 s into the probe's minute, with the user agent `vercel-cron/…` and the probe's `x-vercel-cron-schedule`, and reached `/__server` through the API route after the filesystem phase. The rule that follows: the host redirects must match exact hosts, never `*.vercel.app`, or the cron gets a 308. The project has no `CRON_SECRET`, so the call carried no `Authorization`: Vercel documents `Bearer <CRON_SECRET>` once it is set, and setup step 13 proves it. SPEC-deploy's own `17 15 * * *` has not fired yet. See "Checks 6, 7 and 9" |
| 7 | Store writes finish after a stopped stream | D4 | Pass for SPEC-deploy's setup, 2026-10-27 (runs 40589291781 and 40591039392), but not for the reason the spec expects. Without `supportsCancellation` the function never sees a visitor's Stop: it sends all 40 chunks, then writes, and both writes land about 9 s and 11 s after the stop. So the turn is logged `answered`, and `stopped` never occurs on Vercel. With `supportsCancellation`, Vercel ends the function on the stop, and its writes are lost; inside `request.waitUntil` they land, and the function still runs to its end. A write after the response's end lands only with `request.waitUntil`, which Nitro passes on from Vercel with no package, so `@vercel/functions` is not needed while D20's guard holds. Scope: a 10 s stream with no model; that the model keeps generating is inferred; the 150 s case was not run. See "Checks 6, 7 and 9" |
| 8 | The WAF rules' case handling and content-type condition | D5 | Pass on a preview, 2026-10-27 (runs 40587839966, attempts 1 and 2, 40588287129 and 40588744616, on the branch `prototype/d5-waf`). A chat POST with `Content-Type: text/plain` gets the WAF's 403; malformed JSON chat POSTs get the not-found page until the 21st, which gets the WAF's 429. The path condition matched `/API/chat`, and it decodes `%63`. Both WAF answers carry `x-vercel-mitigated: deny`. Production: pass, 2026-10-27 (run 40596354489, `VERCEL_ENV production`), the same answers, and `/Api/Chat` matched too. See "Check 8" |
| 9 | What the Upstash tokens can run | D4 | Pass, 2026-10-27 (runs 40589291781 and 40591039392). `/multi-exec` with the standard token runs the key table's writes and the reservation with `EXPIREAT` (each answers 1, and `PTTL` shows the expiry). The read-only token runs `LRANGE`, `HGETALL`, `ZRANGE … WITHSCORES` and `GET`, one by one and as `/pipeline`; it is refused `SET`, `EXPIREAT` and `/multi-exec` (HTTP 403 `NOPERM`), even for reads. It ran `SCAN` (HTTP 200), which Upstash's docs and research 12 say it cannot, so it can list every key in the database. The D4 review's run 40594002369 also saw it refused a `SET` through `/pipeline` (`NOPERM` in the command's reply, HTTP 200 for the batch), `DEL` and an `EVAL` of a `SET` (HTTP 403 `NOPERM`), with no key made and none deleted, and refused `KEYS` (HTTP 403). See "Checks 6, 7 and 9" |
| 10 | Chrome's PDF viewer with the site's headers | D3 | Pass, 2026-10-27, Peter's check by hand (decision record row 160): he opened https://resume-deploy-spike-26t9pe7rk-peterkloss.vercel.app/Peter-Kloss-Resume.pdf in Chrome, signed in to Vercel, and "Both pages show". That deployment is run 40583006081's; check 4 shows the PDF served byte for byte with the six headers, no policy, `content-type: application/pdf` and `content-disposition: inline` |
| 11 | The Vercel Toolbar stays off | D3 | Pass for the production setting; the header's own effect is not proven. 2026-10-27, runs 40583006081, 40581693149 and 40582697904 on production deployments. They prove: with the toolbar off for production, Chrome on the deployment URL makes no request to `vercel.live`, has no toolbar element and no policy violation, and receives the built file byte for byte; a plain request without `x-vercel-skip-toolbar` also gets the built file; planted controls prove the listener and both policies work. They do not prove that `x-vercel-skip-toolbar` keeps an enabled toolbar off. Preview run 40584951645 (toolbar on by default) shows that check 11 goes red there: a plain request without the header got other bytes. But headless Chrome got the built file with and without the header, so the header's effect was not seen. Gap for D6; see "Check 11 on a preview" |
| 12 | The status helper's name and Deployment Checks | D5 | Moved to D32 and setup step 10 (main's decision, 2026-10-27): it needs a workflow on `main`. See "Check 12" |

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
   The header routes write each header name in lower case, so no two routes set one header under two spellings. The redirect route writes `Location` as Vercel's docs do; no other route sets it.
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
- **The toolbar stays off on production deployments.** In every Chrome load with the header: no request to `vercel.live`, no toolbar element, and the document byte for byte the built file. A plain request without `x-vercel-skip-toolbar` also got the built file. So with the team's production setting Off, Vercel changed nothing in the production deployment's pages. These runs say nothing about the header's own effect: the toolbar was off, so there was nothing for the header to keep out. "Check 11 on a preview" below is the one attempt to see the toolbar on.
- **The split policy works on the real deployment.** Chrome reported no policy violation on `/`, a deep dive and the not-found page, with the header policy and each page's tag. The planted controls each gave their violation (`img-src` for the image, `script-src-elem` for the inline script), so both policies are enforced there. The service worker took control of `/` and the deep dive, so its own requests (the precache) got through, with the bypass cookie.
- **Seen, not judged.** On `/`, Chrome logged `TypeError: Invalid action variant` from the design system's button in `routes-DcKKjtoG.js` (the spike's `DsButton`, older than D3), and one 404. The log does not name the 404's address; the local test shows Chrome asking for `/favicon.ico`, which the spike has not. The not-found page logs its own 404. None is a policy violation.
- **The WAF.** Each run sent about 9 requests to `/api/` paths: 1 from the wait step, 3 from check 2, 3 from check 3, 1 from check 4 and 1 from check 5. No run met a 429.

**Check 10, Peter's check: pass** (decision record row 160). Peter opened https://resume-deploy-spike-26t9pe7rk-peterkloss.vercel.app/Peter-Kloss-Resume.pdf, the PDF of run 40583006081's deployment, in Chrome while signed in to Vercel. His answer: "Both pages show". The pass rule was set before he looked: Chrome's own PDF viewer shows both pages, and the page is neither blank nor a download; a blank page, a "blocked" page or a file saved to Downloads would have failed. So the documents keep SPEC-deploy's headers: the six headers and no policy. Scope: one browser (Chrome, signed in to Vercel) and one deployment URL; the production domain was not tried, because it redirects.

**Check 11 on a preview** (D3 review, one attempt). The production runs had the toolbar off, so they could not show the header working or check 11 going red. Vercel turns the toolbar on for previews by default (https://vercel.com/docs/vercel-toolbar), and the project's Ignored Build Step builds production only. So a throwaway branch, `prototype/d3-preview` (commit `9947f2d`, on top of `98316e1`), sets `"ignoreCommand": "exit 1"` in `vercel.json`. Vercel's docs: "This value overrides the Ignored Build Step in Project Settings" (https://vercel.com/docs/project-configuration/vercel-json#ignorecommand). So the branch built a protected preview with no dashboard change. Its own workflow runs `bun check.ts preview`, which waits for that preview on its Git branch URL and runs check 11 twice: with `x-vercel-skip-toolbar` on Chrome's requests, and without it. The plain request in check 11 never sends the header. The branch never merges, the spike branch included.

Run 40584951645, preview `resume-deploy-spike-c94c3f395-peterkloss.vercel.app`, `VERCEL_ENV preview`:

| Request | `/` | Requests to `vercel.live` |
|---|---|---|
| Chrome with `x-vercel-skip-toolbar` | the built file byte for byte | 0 |
| Chrome without the header | the built file byte for byte | 0 |
| A plain request (Bun's `fetch`) without the header | other bytes | not a browser |

```text
check 11 (Vercel Toolbar), preview, with x-vercel-skip-toolbar: FAIL: / without x-vercel-skip-toolbar answered HTTP 200 with other bytes than the built file; seen: /: HTTP 200, the built file byte for byte, 0 policy violations, 0 requests to vercel.live, other hosts: none, planted controls: script-src-elem inline, img-src https://example.invalid/spike-control.png, img-src https://example.invalid/spike-control.png, service worker controls the page, 2 console errors (console: TypeError: Invalid action variant at set variant (https://resume-deploy-spike-c94c3f395-peterkloss.vercel.app/assets/routes-DcKKjtoG.js:395:15588) at Reflect.se | network: Failed to load resource: the server responded with a status of 404 ()); /deep-dives/agent-workflows: HTTP 200, the built file byte for byte, 0 policy violations, 0 requests to vercel.live, other hosts: none, planted controls: script-src-elem inline, img-src https://example.invalid/spike-control.png, img-src https://example.invalid/spike-control.png, service worker controls the page, 0 console errors; /no-such-page: HTTP 404, the built file byte for byte, 0 policy violations, 0 requests to vercel.live, other hosts: none, planted controls: script-src-elem inline, img-src https://example.invalid/spike-control.png, img-src https://example.invalid/spike-control.png, service worker does not control the page, 1 console errors (network: Failed to load resource: the server responded with a status of 404 ()); / without x-vercel-skip-toolbar: HTTP 200, other bytes
check 11 (Vercel Toolbar), preview, without x-vercel-skip-toolbar: FAIL: / without x-vercel-skip-toolbar answered HTTP 200 with other bytes than the built file; seen: /: HTTP 200, the built file byte for byte, 0 policy violations, 0 requests to vercel.live, other hosts: none, planted controls: script-src-elem inline, img-src https://example.invalid/spike-control.png, img-src https://example.invalid/spike-control.png, service worker controls the page, 2 console errors (console: TypeError: Invalid action variant at set variant (https://resume-deploy-spike-c94c3f395-peterkloss.vercel.app/assets/routes-DcKKjtoG.js:395:15588) at Reflect.se | network: Failed to load resource: the server responded with a status of 404 ()); /deep-dives/agent-workflows: HTTP 200, the built file byte for byte, 0 policy violations, 0 requests to vercel.live, other hosts: none, planted controls: script-src-elem inline, img-src https://example.invalid/spike-control.png, img-src https://example.invalid/spike-control.png, service worker controls the page, 0 console errors; /no-such-page: HTTP 404, the built file byte for byte, 0 policy violations, 0 requests to vercel.live, other hosts: none, planted controls: script-src-elem inline, img-src https://example.invalid/spike-control.png, img-src https://example.invalid/spike-control.png, service worker does not control the page, 1 console errors (network: Failed to load resource: the server responded with a status of 404 ()); / without x-vercel-skip-toolbar: HTTP 200, other bytes
```

What it shows:

- **Check 11 can go red.** On the preview, the plain request without the header got other bytes than the built file, so Vercel changed the page there, and check 11 failed. On the production deployments the same request got the built file. The run prints no page content, so what Vercel added is not seen; the toolbar is the likely change, because it is on for previews.
- **The header's effect is not proven.** Headless Chrome got the built file and made no request to `vercel.live` also without the header, so the Chrome loads cannot tell the header's effect apart. A hypothesis, not tested: Vercel adds nothing for headless Chrome, whose user agent says `HeadlessChrome`. The run also made no plain request with the header, which would have isolated it.
- **The gap, for D6.** A second attempt would load the preview in Chrome with a user agent without `Headless`, make a plain request both with and without the header, and print booleans about the changed bytes (whether they hold `vercel.live`). The task allowed one attempt, so this one stops here.
- `prototype/d3-preview` and its preview deployment stay on GitHub and on the project; any later push to that branch builds a preview again.

**The scope of these verdicts** (for D6 and D18).

- **The route list the runs used**, in this order (13 routes):
  1. one host redirect, for `project-8ar0o.vercel.app` only;
  2. the header routes: the cache rule (`/assets/` and Workbox in one route), the six headers, the header policy, the worker policy;
  3. spike only: the two query routes from `/api/spike` to `/__server` and `/api/spike-bun1x`;
  4. new to the spec (D2, route 3): each function folder that no API route names gets `/404.html` with status 404;
  5. `{ "handle": "filesystem" }`, with the overrides;
  6. the API routes `/api/spike` and `/api/cron/health`, case-sensitive;
  7. every other path gets `/404.html` with status 404.
- **How it differs from SPEC-deploy's order** (host redirects, headers, filesystem, three API routes, not-found page):
  - one host route, not four;
  - the spike's query routes and the function-folder route sit between the header routes and the filesystem;
  - the API routes are the spike's, not `/api/chat`, `/api/status` and `/api/cron/health`;
  - SPEC-deploy gives the headers as one step and fixes no order inside it; the spike's order is cache, six headers, header policy, worker policy;
  - one cache route covers `/assets/` and Workbox.
- **Check 4** read nine paths of one deployment at a time. Only the policy header was set by two routes; every other header came from one route.
- **Check 5 and the 308 with its headers** were tested on one host only, the project's `.vercel.app` address, with three paths and one encoded path. pkloss.dev, pwk.dev and www.peterkloss.dev have no domain on this project. Their routes have the same form with another `eq` value, but no run asked them, so the kept query, the `+` to `%20` rewrite and the headers on the 308 are seen on one host only.
- **Check 10** is one browser (Chrome, signed in to Vercel) on one deployment URL.
- **Check 11** passed on production deployments only. The preview attempt below proves that the check goes red on a preview, but not that `x-vercel-skip-toolbar` keeps an enabled toolbar off.
- **The header rule in D18.** Two ways keep exactly one policy on each worker file:

  | Way | What decides the worker files' policy | What it costs |
  |---|---|---|
  | The worker route last (the spike's order, and SPEC-deploy's sentence "from the last matching route") | Vercel's merge: the last matching route wins. The runs and the control prove it on Vercel; Vercel's docs do not state it for Build Output routes, but Next.js documents the same rule for its `headers` ("If two headers match the same path and set the same header key, the last header key will override the first", https://nextjs.org/docs/app/api-reference/config/next-config-js/headers) | The order matters: `config.test.ts` must fail when the worker route moves before the header policy route, and `bun run preview` must apply the routes in order, a later value replacing an earlier one |
  | Header routes whose paths never overlap | One route only: the header policy route's `src` leaves out the worker files, as it leaves out the documents | Two patterns must stay in step: each file with its own policy must also be in the header policy route's exclusion. The runs tested such an exclusion for the PDF, not for the worker files. A file left out of the exclusion falls back to the merge rule anyway |

  Recommended: the worker route last. It needs no spec change, the spike proved it with a control, it is the rule Vercel documents for its own framework, and a test can pin the order. The other way trades one order rule for two lists that must agree.

**For D6** (nothing in the spec changes here):

- Check 4: the header routes as SPEC-deploy writes them work. Copy "the last matching route wins" as seen, with the control. D18's `writeVercelConfig()` keeps the worker policy route after the header policy route, and `config.test.ts` checks that order.
- Check 5: pass; the redirect route needs no query of its own. Record the `+` to `%20` change, and that the 308 carries the headers.
- Check 11: pass for the production setting. Copy the gap with it: no run proves that `x-vercel-skip-toolbar` keeps an enabled toolbar off, because headless Chrome got the preview's built page with and without the header. D26's smoke check runs headless Chrome too, so a plain request compared byte for byte with the built file is what saw Vercel change a page.
- Check 10: pass, by Peter's hand (row 160). The documents' headers stay as SPEC-deploy gives them.
- Research 12 can add: Vercel sends `content-disposition: inline; filename="<name>"` with static files, and its default `cache-control` on a 308.
- Not tested: whether one header name in two spellings (`Content-Security-Policy` in one route, `content-security-policy` in another) merges as one. The spike's header routes spell every name in lower case, and D18 can do the same.

**For D4 and D5.**

- D4: the production address now answers 308 for every path outside `/api/`. Vercel Cron's `/api/cron/health` is under `/api/`, so the redirect leaves it alone.
- D5: check 8 can post to `/api/chat` on the production address without meeting the redirect. Each run already sends about 9 `/api/` requests.

## Checks 6, 7 and 9: Vercel Cron, store writes after Stop, and the Upstash tokens

**What D4 adds.**

1. The store: Peter's `resume-deploy-spike-kv` (Upstash for Redis, iad1, pay as you go), attached to Production only with the prefix `KV`. Only the functions hold its variables, so the store calls run in the functions, and `check.ts` reads their flat reports. Every key starts with `spike:` and expires: the stream markers after 15 minutes, the token check's keys after 10 minutes (and it deletes them), the cron record after 7 days.
2. The store modes of `/api/spike` (`?mode=store`, `stream`, `report-stream`, `report-cron`) answer only when the request's `Host`, `x-forwarded-host` and URL all name a protected host (the deployment URL or the Git branch URL). On the public production address they answer 403, so only a caller with the bypass secret can make them write. The plain `/api/spike` answer (check 2) is unchanged.
3. `/api/cron/health` records every call: when, the hosts it named, whether its user agent is `vercel-cron/…`, its `x-vercel-cron-schedule`, whether `Authorization` was `Bearer $CRON_SECRET` (a word: `secret`, `absent` or `other`), and the function and commit that answered. It keeps the newest 50 calls. SPEC-deploy's route answers 401 at once without the right `CRON_SECRET`. The spike's route is open instead, because the project has no `CRON_SECRET`, and what reaches the route is the question. So anyone can write to it through the public production address, within these bounds: keys with the `spike:` prefix, at most 50 entries, a 7-day expiry, the WAF's "api rate limit", and a database that only the spike uses. The 401 path is not tested.
4. The probe cron. Vercel Cron calls only on its schedule, and SPEC-deploy's `17 15 * * *` is hours away from any run. Vercel's docs allow several crons on one path, each call naming its schedule in `x-vercel-cron-schedule`, and on Pro a cron runs "within the minute specified" (https://vercel.com/docs/cron-jobs/manage-cron-jobs). So `post-build.ts` can add a second daily cron on `/api/cron/health`, at the first whole minute 4 minutes after the build (UTC). The switch is `PROBE_CRON` in `post-build.ts`, off since the D4 review, so later runs do not wait about 5 minutes for the call. It is a constant in the repository, because Vercel's build writes `config.json` and never sees the workflow's environment; check 6 follows what the build wrote. The record keeps SPEC-deploy's own calls too, so a later read can show the 15:17 call.

**What the checks ask.**

- Check 9 (`?mode=store`), on fresh keys:
  - the standard token's `/multi-exec` writes a list (`RPUSH`), a hash (`HINCRBY`) and a sorted set (`ZADD GT`, twice, so the lower score must leave the member alone), each with `EXPIREAT` in the same transaction;
  - the reservation's transaction, as "The daily cap" step 1: `INCRBY` 900000 (the $0.90 in millionths), `EXPIREAT`, `GET` of the spend-limit marker, and `PTTL`, which shows the expiry took; then the take-back, `DECRBY`, which keeps the expiry;
  - the read-only token's `LRANGE`, `HGETALL`, `ZRANGE … WITHSCORES` and `GET`, one by one and as one `/pipeline`, must read back what was written. Its `/multi-exec`, `SCAN` and `KEYS` are recorded (`KEYS` since the D4 review);
  - controls: the read-only token's `SET` and `EXPIREAT` must be refused, with no key made and the expiry unchanged. Since the D4 review, also a `SET` through `/pipeline`, a `DEL` of a key the standard token made, and an `EVAL` of a script that runs `SET`: each must be refused, with no key made and none deleted.
- Check 7 (`?mode=stream`). A "turn" writes once before its stream, where SPEC-deploy reserves; sends up to 40 events 250 ms apart; and after the last event writes twice, as `log.append()` and `telemetry.record()`, the second 2 s after the first, before it ends the stream. The run makes six streams, each followed by 15 s with no request to a function. Streams 1 to 4 run in `/api/spike`, the chat's twin (`maxDuration` 150, iad1), set up as SPEC-deploy sets up `/api/chat`:
  1. the stopped turn: the run reads 3 events, then aborts its `fetch`, as the browser's Stop does;
  2. the full turn (control): the run reads to the end, so both writes land while it is connected;
  3. recorded: the function ends the stream, then writes 2 s later, with no `waitUntil`;
  4. recorded: the same inside `request.waitUntil`. Nitro's Vercel entry sets it from the context Vercel passes to the function (`req.waitUntil = context?.waitUntil`, `nitro/dist/presets/vercel/runtime/vercel.web.mjs`), so it needs no package;
  5. recorded: the stopped turn in `/api/spike-cancel` (`?function=cancel`), the same function with `supportsCancellation: true`;
  6. recorded: the same, with the turn's writes inside `request.waitUntil`.
  Then the run reads each marker's age from the store's own clock (`PTTL`) and works out when each write landed against its own times, about ±1 s. The pass rule: the stopped turn's two writes are in the store, the second about 2 s after the first, and both landed before the next request reached the function. A write that lands only when a later request arrives would mean the function was frozen until then. The function also reports how it saw the stop: `request.signal`'s abort, the stream's `cancel`, or a failed `enqueue`.
- Check 6: one plain `GET /api/cron/health` on the production address, without the bypass, must reach `/__server` through the route after the filesystem phase and be recorded. With the probe cron on, the run then waits until 30 s after the probe's minute and reads the record every 30 s, for up to 3 minutes. Vercel Cron's call must name the probe's schedule and reach `/__server` at `/api/cron/health`. The line names the host the call reached and whether it is a protected one. With the probe cron off, one read of the record replaces the wait; its line shows SPEC-deploy's calls and the earlier probes' calls.

**Local run.** A scratch harness (not committed) ran checks 9, 7 and 6 against the built `__server` function behind a local server, with an in-memory stand-in for Upstash's REST API. All three passed, and every stopped stream saw the stop as `abort` (Bun's own server aborts `request.signal`). A control that held the `record` write 17 s turned check 7 red: "the stopped turn's record landed +19.0 s after its append, not about 2 s". This tests the check code, not Vercel.

**The runs.**

| Run | Commit | What the commit changed | Check 6 | Check 7 | Check 9 |
|---|---|---|---|---|---|
| 40589291781 | `76a45a7` | The D4 routes, the probe cron and checks 6, 7 and 9, with four streams | Pass | Pass | Pass |
| 40591039392 | `eb8e295` | `/api/spike-cancel` and streams 5 and 6 | Pass | Pass | Pass |
| 40594002369 | `f6f32b9` | D4 review: the probe cron off, more read-only controls | Pass, no wait (the record only) | Pass | Pass |

Checks 1 to 5 and 11 passed in all three runs; check 2 also reached `/api/spike-cancel` (Bun 1.4.1, path `/api/spike`). No run met a 429. Run 40592148105 (`b1cc098`, README only) was cancelled by hand; its deployment's probe cron still called at 22:11:05 UTC, as run 40594002369's record shows. With the probe off, run 40594002369 took 3 min 21 s from start to end.

The verdict lines, word for word.

Run 40589291781 (`76a45a7`):

```text
check 9 (Upstash tokens): pass: the function has KV_REST_API_URL true, KV_REST_API_TOKEN true, KV_REST_API_READ_ONLY_TOKEN true; standard token, /multi-exec of RPUSH, HINCRBY and ZADD GT, each with EXPIREAT: ok, EXPIREAT answered 1 for each: true, ZADD GT kept the higher score: true; the reservation, /multi-exec of INCRBY 900000, EXPIREAT, GET of the spend-limit marker and PTTL: ok, total 900000, EXPIREAT 1, marker none, PTTL 598899 ms; the take-back, /multi-exec of DECRBY and PTTL: total 0, expiry kept true; read-only token: LRANGE ok, HGETALL ok, ZRANGE ok, GET ok; as /pipeline ok; as /multi-exec HTTP 403 NOPERM; read-only SET: HTTP 403 NOPERM, key made 0; read-only EXPIREAT: HTTP 403 NOPERM, expiry unchanged true; read-only SCAN: HTTP 200; cleanup: DEL removed 4 keys
check 7 (store writes after Stop): pass: stopped turn: the run read 3 events and stopped +0.6 s after its request; the function did not see the stop: it ended "end" after 40 chunks; its writes landed, from the stop: before the stream -0.6 s, append +9.5 s, record +11.5 s; the next request came at +15.0 s; full turn (control): 40 events and the done event true, append -2.1 s and record -0.1 s from the end; a write 2 s after the stream's end, no waitUntil: +15.0 s from the end (4 events); the same inside request.waitUntil (on the request: true, registered: true): +1.9 s from the end (4 events)
check 6 (Vercel Cron): pass: a plain GET of /api/cron/health on the production address, without the bypass: HTTP 200, function /__server, recorded true; Vercel Cron called the probe "49 21 * * *" (due 21:49:00 UTC) at 21:49:06 UTC (+6.3 s), 1 calls in all; host resume-deploy-spike-i4i6dcqyb-peterkloss.vercel.app (a protected host), x-forwarded-host resume-deploy-spike-i4i6dcqyb-peterkloss.vercel.app, URL host resume-deploy-spike-i4i6dcqyb-peterkloss.vercel.app; /__server at /api/cron/health, VERCEL_ENV production, region iad1, this commit true; authorization absent, CRON_SECRET set false; in the record (7 days): SPEC-deploy's "17 15 * * *" 0 calls; earlier probes 0; calls without Vercel Cron's user agent 1 (last host project-8ar0o.vercel.app, function /__server)
```

Run 40591039392 (`eb8e295`):

```text
check 9 (Upstash tokens): pass: the function has KV_REST_API_URL true, KV_REST_API_TOKEN true, KV_REST_API_READ_ONLY_TOKEN true; standard token, /multi-exec of RPUSH, HINCRBY and ZADD GT, each with EXPIREAT: ok, EXPIREAT answered 1 for each: true, ZADD GT kept the higher score: true; the reservation, /multi-exec of INCRBY 900000, EXPIREAT, GET of the spend-limit marker and PTTL: ok, total 900000, EXPIREAT 1, marker none, PTTL 599249 ms; the take-back, /multi-exec of DECRBY and PTTL: total 0, expiry kept true; read-only token: LRANGE ok, HGETALL ok, ZRANGE ok, GET ok; as /pipeline ok; as /multi-exec HTTP 403 NOPERM; read-only SET: HTTP 403 NOPERM, key made 0; read-only EXPIREAT: HTTP 403 NOPERM, expiry unchanged true; read-only SCAN: HTTP 200; cleanup: DEL removed 4 keys
check 7 (store writes after Stop): pass: stopped turn: the run read 3 events and stopped +0.6 s after its request; /api/spike did not see the stop: it ended "end" after 40 chunks; its writes landed, from the stop: before the stream -0.6 s, append +9.4 s, record +11.4 s; the next request came at +15.0 s; full turn (control): 40 events and the done event true, append -2.1 s and record -0.1 s from the end; a write 2 s after the stream's end, no waitUntil: +14.9 s from the end (4 events); the same inside request.waitUntil (on the request: true, registered: true): +1.9 s from the end (4 events); with supportsCancellation, stopped turn: the run read 3 events and stopped +0.6 s after its request; /api/spike-cancel wrote nothing after the last chunk; its writes landed, from the stop: before the stream -0.6 s, append not in the store, record not in the store; the next request came at +15.0 s; with supportsCancellation, stopped turn with its writes inside request.waitUntil: the run read 3 events and stopped +1.3 s after its request; /api/spike-cancel did not see the stop: it ended "end" after 40 chunks, waitUntil registered: true; its writes landed, from the stop: before the stream -0.6 s, append +9.4 s, record +11.4 s; the next request came at +15.0 s; a second read +10.1 s after the first: s4 append not in the store from the first read, s4 record not in the store from the first read
check 6 (Vercel Cron): pass: a plain GET of /api/cron/health on the production address, without the bypass: HTTP 200, function /__server, recorded true; Vercel Cron called the probe "3 22 * * *" (due 22:03:00 UTC) at 22:03:14 UTC (+14.3 s), 1 calls in all; host resume-deploy-spike-mvnmwlvlt-peterkloss.vercel.app (a protected host), x-forwarded-host resume-deploy-spike-mvnmwlvlt-peterkloss.vercel.app, URL host resume-deploy-spike-mvnmwlvlt-peterkloss.vercel.app; /__server at /api/cron/health, VERCEL_ENV production, region iad1, this commit true; authorization absent, CRON_SECRET set false; in the record (7 days): SPEC-deploy's "17 15 * * *" 0 calls; earlier probes 1; calls without Vercel Cron's user agent 2 (last host project-8ar0o.vercel.app, function /__server)
```

Run 40594002369 (`f6f32b9`, D4 review), checks 9 and 6 (check 7's line matches run 40591039392's, with the same times):

```text
check 9 (Upstash tokens): pass: the function has KV_REST_API_URL true, KV_REST_API_TOKEN true, KV_REST_API_READ_ONLY_TOKEN true; standard token, /multi-exec of RPUSH, HINCRBY and ZADD GT, each with EXPIREAT: ok, EXPIREAT answered 1 for each: true, ZADD GT kept the higher score: true; the reservation, /multi-exec of INCRBY 900000, EXPIREAT, GET of the spend-limit marker and PTTL: ok, total 900000, EXPIREAT 1, marker none, PTTL 599299 ms; the take-back, /multi-exec of DECRBY and PTTL: total 0, expiry kept true; read-only token: LRANGE ok, HGETALL ok, ZRANGE ok, GET ok; as /pipeline ok; as /multi-exec HTTP 403 NOPERM; read-only SET: HTTP 403 NOPERM, key made 0; read-only EXPIREAT: HTTP 403 NOPERM, expiry unchanged true; read-only SET through /pipeline: HTTP 200 NOPERM, key made 0; read-only DEL: HTTP 403 NOPERM, key kept true; read-only EVAL of a SET: HTTP 403 NOPERM, key made 0; read-only SCAN: HTTP 200; read-only KEYS: HTTP 403 NOPERM; cleanup: DEL removed 4 keys
check 6 (Vercel Cron): pass: no probe cron in this build (post-build.ts PROBE_CRON is off), so no wait for a live call; a plain GET of /api/cron/health on the production address, without the bypass: HTTP 200, function /__server, recorded true; in the record (7 days): SPEC-deploy's "17 15 * * *" 0 calls; probes of earlier builds 3 (last 2026-10-27T22:11:05.219Z, "11 22 * * *", host resume-deploy-spike-41kv8d9qn-peterkloss.vercel.app); calls without Vercel Cron's user agent 4 (last host project-8ar0o.vercel.app, function /__server)
```

**What the runs show.**

- **Vercel Cron calls the deployment's own URL.** Both calls named the deployment's generated host (`resume-deploy-spike-i4i6dcqyb-…`, `resume-deploy-spike-mvnmwlvlt-…`) in `Host`, `x-forwarded-host` and the URL. That host is protected, and the call reached the function with no bypass, so Vercel lets its own cron through Standard Protection. Vercel's docs say the cron calls "your project's production deployment URL" (https://vercel.com/docs/cron-jobs); the runs show that this is the deployment's own URL, not the project's production address. Each call came within its minute (6 s and 14 s in), as the docs say for Pro, and named its schedule in `x-vercel-cron-schedule`. Two crons on one path both stay in `config.json`, and each run saw only its own probe's call.
- **The rule that follows for the host redirect.** Vercel Cron does not follow redirects (https://vercel.com/docs/cron-jobs/manage-cron-jobs#cron-jobs-and-redirects). The spike's redirect matches one exact host, `project-8ar0o.vercel.app`, so the cron's host never meets it. SPEC-deploy's real redirect must match exact hosts too (`has` host `eq`), never a pattern such as `*.vercel.app`: a pattern would match the deployment's own URL and send the cron a 308, and the health job would never run. Only the spike's exact-host form was run; a pattern was not tried.
- **The route after the filesystem reaches `/__server`.** Vercel Cron's call and a plain request on the production address both reached `/__server` through `^/api/cron/health$`, the API route after `{ "handle": "filesystem" }`. D2 tested only the routes before the filesystem.
- **`CRON_SECRET`: documented, not seen.** Vercel documents that once the project sets `CRON_SECRET`, its value "will be automatically sent as an `Authorization` header" with each cron call, as `Bearer <CRON_SECRET>` (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs). The spike project has no `CRON_SECRET`, so the calls carried no `Authorization` header, and the runs do not show the header on a call to a protected deployment URL. SPEC-deploy's 401 rule needs it. The conductor decided that setup step 13 proves it on the real project, where the health job runs with the secret set.
- **The function never learns of the stop.** In `/api/spike`, set up as SPEC-deploy sets up the chat, the run stopped after 3 events, but the function sent all 40 chunks (10 s): `request.signal` did not abort, the stream's `cancel` did not run, and no `enqueue` failed. Its writes then landed at about +9.5 s and +11.5 s from the stop, before any other request. So the writes finish, because Vercel keeps reading the function's stream to its end. This matches Vercel's and the AI SDK's docs: without `supportsCancellation`, a stop "does not cancel the Vercel Function or model request" (https://ai-sdk.dev/docs/advanced/vercel-deployment-guide).
- **So `stopped` never occurs on Vercel.** SPEC-chat logs `stopped` for one cause only, "The visitor selects Stop" (its table of how a turn ends); the deadline and `max_tokens` log `error` ("The log records `error`, not `stopped`"). Without `supportsCancellation` the function never sees the visitor's Stop, so the turn runs to its end and is logged `answered`. Inferred, not seen (the spike has no model): the model keeps generating after the Stop, so each Stop still costs up to the turn's full cost, at most its $0.90 reservation; the log holds the whole answer, not what the visitor saw; and telemetry's `stopped` count stays 0. After "Send now" (SPEC-chat's queued questions), the stopped turn runs on beside the next one.
- **A write after the response's end waits for the next request.** With no `waitUntil`, the write planned 2 s after the stream's end landed at +15.0 s and +14.9 s: when the run's next request reached the function. So Vercel freezes a function between requests, and work after the response's end needs `waitUntil`. With `request.waitUntil` it landed at +1.9 s both times.
- **`request.waitUntil` needs no package, but rests on a Nitro detail.** Nitro's Vercel entry puts Vercel's own `context.waitUntil` on the request (`req.waitUntil = context?.waitUntil`, `nitro/dist/presets/vercel/runtime/vercel.web.mjs` in `nitro` 3.0.260903-beta), and TanStack Start hands the route that request. It was present and worked on Vercel's Bun runtime in both runs. That line is Nitro's code, not a documented API, so a Nitro release could drop it. The rule D20 needs: work after the last chunk always calls `request.waitUntil`, and the code throws when it is missing; an optional call (`request.waitUntil?.()`) would lose the writes without a sign. D20 adds a guard test that fails when the built function no longer sets `request.waitUntil`. While that guard holds, SPEC-deploy's fallback, `waitUntil` from `@vercel/functions` (the documented twin), is not needed.
- **`supportsCancellation` works on the Bun runtime, but only to end the function.** Vercel documents it for Node.js only (https://vercel.com/docs/functions/functions-api-reference#cancel-requests). In `/api/spike-cancel`, the stopped turn's writes after the last chunk never landed: not at the first read, not 10 s later, and not after the next request reached that function. The write before the stream landed. So Vercel ended the function on the stop, and its work was lost; the next stream's slower start (+1.3 s to its third event, against +0.6 s) fits a new instance (an inference). With its writes inside `request.waitUntil`, the function lived on, but `request.signal` still did not abort: it sent all 40 chunks and wrote at +9.4 s and +11.4 s. So on Bun the setting does not tell the function about the stop; whether the abort would arrive at all is not seen, because the one function that lived on never got it.
- **The read-only token.** It runs the reader's four commands one by one and as `/pipeline`, and reads back exactly what the standard token wrote. Upstash refuses its writes with HTTP 403 `NOPERM`, and also refuses its `/multi-exec`, even of reads. It ran `SCAN` (HTTP 200), although Upstash's docs say "Some powerful read commands (e.g. SCAN, KEYS) are also restricted with read only token" (https://upstash.com/docs/redis/features/restapi), and research 12 says it cannot. So the read-only token can list every key in the database, not only `spike:` keys: a leaked read-only token is read access to the whole database. The D4 review's run 40594002369 found `KEYS` refused (HTTP 403 `NOPERM`), so of the two only `SCAN` runs. The same run found every other write refused: a `SET` through `/pipeline` (the batch answers HTTP 200, and the command's reply holds `NOPERM`), `DEL` of a key the standard token made, and an `EVAL` of a script that runs `SET` (HTTP 403 `NOPERM`); no key was made and none deleted. So a leaked read-only token cannot change or delete the log, by any of the routes tried.
- **The transactions.** `/multi-exec` ran each write with its `EXPIREAT` in one transaction; `EXPIREAT` answered 1, and `PTTL` gave 598899 and 599249 ms for a 600 s expiry. `ZADD GT` kept the higher score. `DECRBY` kept the key's expiry.

**The scope of these verdicts** (for D6).

- Check 6 saw two calls, each of a probe cron at a minute set at build time, on two deployments. SPEC-deploy's `17 15 * * *` has not fired on this project yet. `spike:cron:calls` keeps every call for 7 days, so a D5 run after 15:17 UTC shows it in check 6's line ("SPEC-deploy's "17 15 * * *" N calls").
- Check 7 used a stand-in turn: a 10 s stream of timed events and store writes, no model call, `GET` and not `POST`. Each stream ran once per run; stops came 0.6 s to 1.3 s after the request. That the model keeps generating after a Stop is inferred, not seen. The chat's long case was not run: a turn of up to 120 s, under the 150 s `maxDuration`, or a large stream; that Vercel keeps reading such a stream to its end is not shown.
- Check 9 ran on spike keys with a 10-minute expiry, not on the key table's names, and one transaction size (7 commands).
- The landing times come from the store's `PTTL` against the runner's clock, about ±1 s.

**For D6** (each item that changes a spec is Peter's to approve; a route, a header or a runtime setting is "ask first"):

- Check 6: pass. Copy the host as seen: Vercel Cron calls the production deployment's own generated URL, through Standard Protection. So SPEC-deploy's acceptance sentence "On the `.vercel.app` address, `/api/` paths are not redirected, so Vercel Cron reaches the health job" names the wrong host. The rule for D17: the host redirects match exact hosts only, never a pattern such as `*.vercel.app`, or the cron's call gets a 308 and the health job never runs. Whether the `.vercel.app` route still needs its `/api/` exception for another reason is a spec question.
- Check 6: `CRON_SECRET` is documented, not seen: Vercel sends `Authorization: Bearer <CRON_SECRET>` with each cron call once the project sets it. The spike project sets none. Setup step 13 proves it on the real project (the conductor's decision). SPEC-deploy's 401 path is untested.
- Check 7: pass, so the "If it fails" change (`@vercel/functions`) is not needed. But the reason changes two specs, and D6 brings both to Peter: without `supportsCancellation`, the function never sees a visitor's Stop, the turn is logged `answered`, and `stopped` never occurs on Vercel (SPEC-chat logs `DEADLINE` and `MAX_TOKENS` as `error`). The items:
  - SPEC-chat: the `stopped` row of its table of how a turn ends, and its handler tests "an aborted request gives a `stopped` entry" and "a Stop during the third [call]: telemetry gets the sum of the two calls' usage". They hold for the handler, not on Vercel.
  - SPEC-deploy: "a turn whose last model call did not finish keeps its whole reservation" still holds for `DEADLINE`, `MAX_TOKENS` and a broken stream, but never for a visitor's Stop, whose call finishes. The cap still holds, because a turn's worst case is under its $0.90 reservation.
  - The option the spike found: `supportsCancellation` on `/api/chat`, with every write after the last chunk inside Nitro's `request.waitUntil`, no new package. Seen so far it gains nothing: in stream 6 the function, kept alive by `waitUntil`, still did not see the stop and ran to its end. Without `waitUntil` the setting ends the function and loses the writes, so the turn's log entry and its settle are lost and the reservation stays counted, which errs toward pausing.
  - The scope: a 10 s stream with no model; the model's behaviour after a Stop is inferred; the 120 s turn under the 150 s `maxDuration` was not run.
- Check 7: work after the response's end needs `request.waitUntil`. D20's rule: always call it, and throw when it is missing; D20 adds a guard test that fails when the built function lacks it.
- Check 9: pass. `createOpsReader()` (D28) must use single commands or `/pipeline`, never `/multi-exec`, with the read-only token. Research 12's line "A read-only token cannot run `SCAN` or `KEYS`" is wrong for `SCAN`: the read-only token can list every key, so a leaked read-only token reads the whole database.

**For D5.**

- Each run now sends about 21 requests to `/api/` paths: 1 from the wait step, 4 from check 2, 3 from check 3, 1 from check 4, 1 from check 5, 1 from check 9, 6 streams and 1 or 2 reports from check 7, and 1 plain request and 1 report from check 6. Check 8 adds its own.
- Check 7 takes about 2 minutes. Check 6 no longer waits, because `PROBE_CRON` is off; with it on, check 6 waits until 30 s after the probe's minute, 4 to 5 minutes after the build. Check 8 runs last, after check 6.
- After 15:17 UTC, check 6's line shows whether SPEC-deploy's own cron call came ("SPEC-deploy's "17 15 * * *" N calls").
- `/api/cron/health` on the production address is open and writes to the store, within the bounds in "What D4 adds".

## Check 8: the WAF rules

**The rules.** Peter published SPEC-deploy's three rules ("Rate limits") on the throwaway project on 2026-10-27, in this order. Each path condition uses Vercel's "Request Path" field. The windows, keys and the api rule's two groups are from D5's task body.

| Order | Rule | Matches | Action |
|---|---|---|---|
| 1 | "chat content type" | Path starts with `/api/chat`, method `POST`, and `Content-Type` does not start with `application/json` | Deny (403) |
| 2 | "chat rate limit" | Path starts with `/api/chat`, method `POST` | Fixed window, 600 s, 20, key IP address: 429 |
| 3 | "api rate limit" | Path starts with `/api/` and is not `/api/chat`; or path starts with `/api/` and the method is not `POST` | Fixed window, 600 s, 60, key IP address: 429 |

**Where check 8 ran, and why.** D4 ran on the spike's production deployment at the same time, and each push to `prototype/deploy-spike` makes a new one. So D5 ran on its own throwaway branch, `prototype/d5-waf`, cut from `235c0e0`. As on D3's preview branch, `vercel.json` sets `"ignoreCommand": "exit 1"`, so each push builds a protected preview and leaves production alone. The branch's workflow `spike-d5-waf` waits for the preview, then runs check 8 in a `waf` job like the one in `spike-check.yml`. Every preview run below is that branch's, and so is the code that only those runs used: the preview wait, the first probe (`bun check.ts waf-probe`), the workflow and the `ignoreCommand`. That branch is never rewritten; D5's lasting changes came onto this branch as new commits, after D4.

**What Vercel's docs say** (read 2026-10-27):

- **Previews.** A rule can test "Environment: The Vercel Environment that received this request", "Preview or Production" (https://vercel.com/docs/vercel-firewall/vercel-waf/rule-configuration#parameters). So the rules see preview traffic, and a rule with no Environment condition applies to both. The three rules have none.
- **The order.** "Vercel's platform-wide firewall is the first line of defense […]. Once a request passes this layer, deployment protection checks whether it can continue […]. If allowed to go through, the request is subject to the rules that you configured with the Web Application Firewall (WAF)" (https://vercel.com/docs/vercel-firewall/firewall-concepts). So on a protected host, a request meets the rules only with the bypass. Without it, Vercel's sign-in answers first.
- **Case.** "All operators are case insensitive" (same rule-configuration page, "Operators").
- **The two path fields.** "Request Path: The full request path on the incoming request, always starting with a leading `/`". "Raw Path: The raw request path, ignoring any parsing or normalizing that might be done at the framework level" (same page, "Parameters").
- **Deny.** "Blocks the request and no further rules are evaluated" (same page, "Actions"); "A `403 Forbidden` response is returned. The request does not reach your application." (firewall-concepts, "Deny").
- **Regions.** "Rate limit counters are tracked on a per-region basis; traffic matching a given rate limit key in multiple regions can exceed the limit you configure for any single region" (https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).
- **Persistent actions.** A deny or rate-limit action can carry a time-based block; the dashboard's "for" field "defaults to 1 minute", and then the address "will be blocked for a period of time" before any rule runs (https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules#persistent-actions).

**First, the fact that decided whether D5 goes on.** Run 40587243876 (on `prototype/d5-waf`, preview `resume-deploy-spike-8xxlufo3i-peterkloss.vercel.app`) sent one chat POST with `Content-Type: text/plain` to the preview, with the bypass:

```text
probe (WAF on a preview, VERCEL_ENV preview): POST /api/chat Content-Type text/plain: HTTP 403, x-vercel-mitigated deny, the not-found page false, content-type text/plain; charset=utf-8, 59 bytes; the rules apply to this preview: true
```

So the rules apply to a preview's address, as the docs say. Without the WAF, the spike answers that request with `static/404.html` and status 404 (check 3).

**What check 8 asks.** `bun check.ts waf` sends these requests to the deployment's own host, with the bypass, in this order. The spike has no `/api/chat` route, so without the WAF a chat POST gets the not-found page with status 404. Vercel's edge marks its own answer with `x-vercel-mitigated`. For each answer, the check prints the status, that header's value, whether the body is the not-found page byte for byte, and the edge region from the first part of `x-vercel-id`. For a body that is neither, it prints only the media type of `content-type` (since the D5 review).

1. `POST /api/chat` with `Content-Type: text/plain`. Judged: the WAF's 403.
2. `POST /API/chat`, `text/plain`, and since the D5 review also `POST /Api/Chat`. Recorded: does the path condition match other spellings?
3. `POST /api/%63hat`, `text/plain` (`%63` is `c`). Recorded: does the Request Path field decode it?
4. `GET /api/sp%69ke` (`%69` is `i`). Recorded: do the routes send it to the `/api/spike` function (check 2)?
5. `POST /api/chat` with `Content-Type: application/json` and the malformed body `{"messages":`, until a 429, at most 41 times. Judged: each one before the 429 gets the not-found page, and the WAF's 429 comes by the 41st (SPEC-deploy's smoke check). The first is the control: it shows that the content type decides the 403, not the path. When the first already gets 429, the address met the limit in the last 10 minutes, and the check fails with "rerun later".
6. After the 429, `GET /build-info.json` (from run 40588287129 on). Recorded: does the limited address still get the site?

A local run against two fake servers (one that answers as the WAF should, one with no WAF), and a third whose address was already counted, gave pass, FAIL and FAIL. It tests the check code, not Vercel, and it is not committed.

**The runs.** Each was a fresh runner's address. Each one drove its address to the chat rate limit, in the `waf` job, on purpose; no run met a limit it did not cause. The probe run sent one chat POST and met none.

| Run | Where | Edge region | `text/plain` to `/api/chat`, `/API/chat`, `/api/%63hat` | `GET /api/sp%69ke` | JSON chat POSTs | After the 429 |
|---|---|---|---|---|---|---|
| 40587839966, attempt 1 | A preview of `prototype/d5-waf` | sfo1 | 403, `x-vercel-mitigated: deny`, each | 200 from `/api/spike` | 1 to 20: the not-found page; 21: 429, `deny` | Not asked |
| 40587839966, attempt 2 (the `waf` job again, on a new runner) | The same preview | iad1 | The same | The same | The same | Not asked |
| 40588287129 | A newer preview of `prototype/d5-waf` | sfo1 | The same | The same | The same | `GET /build-info.json`: 200 |
| 40588744616 (the run of the README push) | The newest preview of `prototype/d5-waf` | pdx1 | The same | The same | The same | `GET /build-info.json`: 200 |
| 40596354489, **production** (the first run after the move onto this branch) | This branch's production deployment `resume-deploy-spike-abyytni8m-peterkloss.vercel.app`, `VERCEL_ENV production` | cle1 | The same, and `/Api/Chat`: 403, `deny` | The same | The same | `GET /build-info.json`: 200 |

The verdict lines, word for word. On these runs the check printed "matches /API/chat regardless of case"; since the D5 review it prints "matches /API/chat", because one spelling does not prove every case, and it also tries `/Api/Chat`.

```text
40587839966, attempt 1: check 8 (WAF rules): pass: POST /api/chat text/plain: HTTP 403, x-vercel-mitigated deny; POST /API/chat text/plain: HTTP 403, x-vercel-mitigated deny: the path condition matches /API/chat regardless of case; POST /api/%63hat text/plain: HTTP 403, x-vercel-mitigated deny: the path condition decodes %63; GET /api/sp%69ke: HTTP 200 from the function /api/spike: the routes decode %69; POST /api/chat application/json (malformed): 1 to 20 got the not-found page with status 404; 21 got HTTP 429, x-vercel-mitigated deny; edge region sfo1
40587839966, attempt 2: check 8 (WAF rules): pass: POST /api/chat text/plain: HTTP 403, x-vercel-mitigated deny; POST /API/chat text/plain: HTTP 403, x-vercel-mitigated deny: the path condition matches /API/chat regardless of case; POST /api/%63hat text/plain: HTTP 403, x-vercel-mitigated deny: the path condition decodes %63; GET /api/sp%69ke: HTTP 200 from the function /api/spike: the routes decode %69; POST /api/chat application/json (malformed): 1 to 20 got the not-found page with status 404; 21 got HTTP 429, x-vercel-mitigated deny; edge region iad1
40588287129: check 8 (WAF rules): pass: POST /api/chat text/plain: HTTP 403, x-vercel-mitigated deny; POST /API/chat text/plain: HTTP 403, x-vercel-mitigated deny: the path condition matches /API/chat regardless of case; POST /api/%63hat text/plain: HTTP 403, x-vercel-mitigated deny: the path condition decodes %63; GET /api/sp%69ke: HTTP 200 from the function /api/spike: the routes decode %69; POST /api/chat application/json (malformed): 1 to 20 got the not-found page with status 404; 21 got HTTP 429, x-vercel-mitigated deny; edge region sfo1; then GET /build-info.json: HTTP 200: the limited address still gets the site
40588744616: check 8 (WAF rules): pass: POST /api/chat text/plain: HTTP 403, x-vercel-mitigated deny; POST /API/chat text/plain: HTTP 403, x-vercel-mitigated deny: the path condition matches /API/chat regardless of case; POST /api/%63hat text/plain: HTTP 403, x-vercel-mitigated deny: the path condition decodes %63; GET /api/sp%69ke: HTTP 200 from the function /api/spike: the routes decode %69; POST /api/chat application/json (malformed): 1 to 20 got the not-found page with status 404; 21 got HTTP 429, x-vercel-mitigated deny; edge region pdx1; then GET /build-info.json: HTTP 200: the limited address still gets the site
```

Production, run 40596354489, the job `waf` of `spike-check` (its job `check` passed all nine checks first):

```text
check 8 (WAF rules): pass: POST /api/chat text/plain: HTTP 403, x-vercel-mitigated deny; POST /API/chat text/plain: HTTP 403, x-vercel-mitigated deny: the path condition matches /API/chat; POST /Api/Chat text/plain: HTTP 403, x-vercel-mitigated deny: the path condition matches /Api/Chat; POST /api/%63hat text/plain: HTTP 403, x-vercel-mitigated deny: the path condition decodes %63; GET /api/sp%69ke: HTTP 200 from the function /api/spike: the routes decode %69; POST /api/chat application/json (malformed): 1 to 20 got the not-found page with status 404; 21 got HTTP 429, x-vercel-mitigated deny; edge region cle1; then GET /build-info.json: HTTP 200: the limited address still gets the site
```

**What the runs show.**

- **The rules apply to previews and to production.** The probe and the four preview runs were on `VERCEL_ENV preview`, run 40596354489 on `VERCEL_ENV production`, and the WAF answered the same way each time.
- **The content-type rule works as written.** A `text/plain` chat POST got the WAF's 403. A JSON chat POST to the same path passed the rule and got the not-found page. So the content type decides the 403, not the path.
- **The chat rate limit.** Twenty malformed JSON chat POSTs passed, and the 21st got the WAF's 429, in sfo1, iad1 and pdx1 on previews and in cle1 on production. So the smoke check's bound, a 429 by the 41st, holds with room: 41 also covers a fixed window that starts again during the run.
- **Posts denied by "chat content type" did not count toward "chat rate limit".** Three `text/plain` chat POSTs came first, and the 429 still came at the 21st JSON POST. This matches the docs: a deny stops the rules, and "chat content type" comes first. The runs show this for that pair of rules only; the "api rate limit" rule never fired, and no run read what the denied requests cost.
- **Case.** The path condition matched `/API/chat` in every run, and `/Api/Chat` in the production run, the first that tried it; the Request Path field with "starts with" did it. For every other spelling, the evidence is the docs: "All operators are case insensitive". So the WAF matches more than the routes do: the case-sensitive API routes send `/API/chat` to the not-found page (check 3), and the WAF denies or counts it before that. Either way, `/API/chat` never reaches a function.
- **Encoding.** The Request Path field decodes `%63`, and the routes decode `%69`. So the encoded paths met the WAF and the routes alike, and no encoded path reached a function past the chat rules. One encoded letter was tested each way; `%2F`, `//`, `/./` and a trailing slash were not.
- **Raw Path: not tested.** No rule uses it. The question "which field handles `/API/chat`" has one answer from the runs: Request Path matches it.
- **Telling the WAF's answer apart.** Both the 403 and the 429 carry `x-vercel-mitigated: deny`; the value does not tell a deny from a limit, the status does. The WAF's 403 body is `text/plain` (59 bytes in the probe), and the not-found page carries no such header. So D27's smoke check can look for `x-vercel-mitigated` to tell the WAF's 403 from the chat handler's 403 `FORBIDDEN_ORIGIN`. No run saw a function's 403, so that the handler's answer has no such header is expected, not seen.
- **No persistent action.** After each 403, the next request got its normal answer, and after the 429, `GET /build-info.json` got 200. So neither the deny rule nor the chat rate limit blocks the address beyond the requests they match: a visitor at the chat limit still gets the site.

**The scope of this verdict.**

- **Both environments, one kind of host.** Four runs used previews and one a production deployment, each on the deployment's own protected host, with the bypass. No run asked the public `.vercel.app` address or a custom domain, which have no Deployment Protection in front of the rules. None of the three rules has a Hostname or Environment condition. Since D5's lasting changes came onto this branch, its `waf` job runs check 8 on each production deployment.
- **Why not the production address.** The earlier plan ("For D4 and D5", above) posted to the production address. For `prototype/d5-waf`, that address served the spike branch's commits, not that branch's, and the deployment's own host with the bypass works on both branches the same way. On this branch the deployment is a production deployment, so check 8 here tests the production environment.
- **The "api rate limit" rule: not tested.** No run sent 61 `/api/` requests that the rule counts. Each check 8 run sends one (`GET /api/sp%69ke`); `/api/%63hat` decoded to a chat POST, which the rule leaves out.
- **Regions.** Each run's chat POSTs reached one edge region. A client whose requests reach two regions can pass 20 in each (docs); no run tried that.
- **Not seen:** a rerun from an address that met the limit in the last 10 minutes. The local run tests that the check fails then; no Vercel run met it.

**For D6** (nothing in the spec changes here):

- Check 8: pass on a preview and on production (run 40596354489). The three rules work as SPEC-deploy writes them, so "If it fails" (the rules change) is not needed.
- SPEC-deploy's line "Whether a WAF path condition matches without regard to case, and whether the content-type condition works as written, are spike checks" gets its answers: the path condition matched `/API/chat` and, on production, `/Api/Chat`, and the docs say all operators are case insensitive; the content-type condition works as written.
- Research 12 can add:
  - the order: platform firewall, then Deployment Protection, then the project's rules;
  - the rules apply to previews and to production (the Environment parameter, and the runs);
  - the WAF's 403 and 429 both carry `x-vercel-mitigated: deny`;
  - posts denied by "chat content type" did not count toward "chat rate limit", which comes after it;
  - the Request Path field matched other spellings of `/api/chat` (the docs: operators are case insensitive), and it decoded a percent-encoded letter (`%63`), as the routes did (`%69`).
- Setup step 7 can say: leave each rule's "for" field (a persistent action) empty. The deny rule and the chat rate limit have none on the throwaway project (seen; the api rate limit never fired), and the runs show that a visitor at the chat limit still gets the site. This is a spec change for Peter's approval.
- D27: on a protected deployment URL, the WAF checks need the bypass, because Deployment Protection comes first. `x-vercel-mitigated` can tell the WAF's 403 from the handler's (expected, not seen for the handler). The smoke check requires it on the 429 too, as check 8 does, so a 429 from the chat handler cannot pass for the WAF's. The 429 came at the 21st in each run, so "by the 41st" stays.

## Check 12: moved to D32

Check 12 asks for the status helper's name, and whether Deployment Checks hold the domains until its status passes. It cannot run on a spike branch:

- The release check starts on Vercel's `vercel.deployment.ready` event, a `repository_dispatch` event. GitHub's docs: "This event will only trigger a workflow run if the workflow file exists on the default branch" (https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#repository_dispatch). Research 12 says the same from Vercel's docs.
- Spike code never reaches `main` (brain's prototype rules). Also, the throwaway project has `repository_dispatch` off ("Why this route", above).

So check 12 moved to D32 and setup step 10 (main's decision, 2026-10-27). At setup step 10, the release check's first production run shows the status helper's name. Peter requires that name in Deployment Checks, and the run shows whether they hold the deployment until the status passes. Research 12 records the verdict then. D32's body also names a point for that first run: in its source, the status helper posts `failure` only when a step concluded `failure`, so a cancelled step would post `success`; no run has shown it yet.

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
