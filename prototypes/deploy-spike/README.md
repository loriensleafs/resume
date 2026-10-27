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
- `bun run build` runs three steps: `bun --bun vite build`, `gen-sw.ts` (the Workbox service worker over `.vercel/output/static/`), then `build-info.ts`.
- `build-info.ts` writes `build-info.json` into the static output, at `/build-info.json` and again at `/api/build-info.json`. It holds:
  - the commit, `VERCEL_ENV`, and three addresses: the deployment's own (`VERCEL_URL`), the Git branch URL and the production address (`VERCEL_PROJECT_PRODUCTION_URL`);
  - `vercel.json`'s `bunVersion` and `bun.lock`'s `lockfileVersion`;
  - the output of `bun --version`, with the binary's path and revision;
  - each function's `runtime` and `maxDuration`, read from the built `.vc-config.json` files.
- It writes named fields only, because the build environment also holds the bypass secret. Checks take their expected values from this file, not from constants in `check.ts`.
- The prerender crawler skips the links to `.pdf`, `.docx` and `.txt`: they are files, not pages, and this branch commits none. Without the filter the build fails with "Failed to fetch /resume.pdf: Not Found".
- `check.ts` and `.github/workflows/spike-check.yml` (below).

## How the checks reach the deployment

Each push to the branch starts `spike-check`, which runs on `ubuntu-24.04` with Bun 1.4.2:

1. `bun check.ts wait` reads the commit's statuses through GitHub's API and waits for Vercel's status for this project. A `failure` or `error` ends the run with Vercel's description and its dashboard link.
2. After `success`, it reads `/build-info.json` from the project's Git branch URL, `resume-deploy-spike-git-prototype-deploy-spike-peterkloss.vercel.app`, until the file names this commit. The file's `VERCEL_URL` is the deployment's own address.
3. It then reads `/api/build-info.json` from the production address, `project-8ar0o.vercel.app`, until that address serves the same commit, because the production address can lag the commit status. The `/api/` copy stays reachable after D3 adds the host redirect there, because SPEC-deploy's redirect leaves `/api/` alone. The polling on the protected hosts uses `/build-info.json`, so it does not count against the WAF's `/api/` rule.
4. `bun check.ts run` runs every check in `CHECKS`, in order, and prints one line per check: `check <n> (<name>): pass|FAIL: <what it saw>`, and for a failure the change from the spec's "If it fails" column. A check that throws gets a FAIL line, and the next check still runs.

The wait and the checks share one bound: 15 minutes from the start of the wait. The job's own timeout is 17 minutes, which adds room for setup. A newer push cancels the run, and only the newest run is worth a rerun: an older one waits for a commit that the branch URL no longer serves.

**Adding a check (D2 to D5).** Append a `Check` to `CHECKS` in `check.ts`. Its `run(ctx)` gets:

| Field | What it is |
|---|---|
| `deployment`, `production` | The deployment's own host (protected) and the production address (public) |
| `info` | This deployment's `build-info.json`, the source of expected values (check 2 compares the functions' `runtime` with the Bun they report) |
| `deadline` | The end of the run's 15 minutes |
| `deploymentFetch(path, init)` | A request to the deployment, with the bypass and `x-vercel-skip-toolbar: 1`; redirects are not followed |
| `productionFetch(path, init)` | A request to the production address, with `x-vercel-skip-toolbar: 1` and never the bypass; redirects are not followed (check 5 reads the 308's `Location`) |
| `report(path)` | A flat JSON object that a spike function on the deployment reports: booleans, hosts and times. The store checks (7 and 9) run inside the function, which holds the `KV_*` variables, so the runner needs no new secret |
| `poll(label, maxMs, attempt)` | Calls `attempt` every 10 s until it returns a value, or until `maxMs` or the run's deadline passes. Check 6 polls a function's record of the cron's calls this way |

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
| 2 | The post-build routes, the `overrides`, the cron, and the functions' Bun | D2 | Pending |
| 3 | Unknown paths, `/API/chat` and `/sources/x` get `/404.html` with status 404 | D2 | Pending |
| 4 | How route headers merge | D3 | Pending |
| 5 | A host redirect keeps the query string | D3 | Pending |
| 6 | Vercel Cron reaches `/api/cron/health` under Standard Protection | D4 | Pending |
| 7 | Store writes finish after a stopped stream | D4 | Pending |
| 8 | The WAF rules' case handling and content-type condition | D5 | Pending |
| 9 | What the Upstash tokens can run | D4 | Pending |
| 10 | Chrome's PDF viewer with the site's headers | D3 | Pending |
| 11 | The Vercel Toolbar stays off | D3 | Pending |
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
```

`csp-test.ts` and `offline-test.ts` are the CSP probe's local tests; they still read `dist/client/`, the output folder before Nitro's Vercel preset.
