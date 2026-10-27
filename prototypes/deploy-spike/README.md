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
- `bun run build` runs three steps: `build-info.ts`, `bun --bun vite build`, then `gen-sw.ts` (the Workbox service worker over `.vercel/output/static/`).
- `build-info.ts` writes `public/build-info.json`, which Vite copies to `/build-info.json`. It holds the commit, the deployment's own address (`VERCEL_URL`), the Git branch address, `vercel.json`'s `bunVersion`, `bun.lock`'s `lockfileVersion`, and the output of `bun --version` with the binary's path and revision. It writes named fields only, because the build environment also holds the bypass secret.
- The prerender crawler skips the links to `.pdf`, `.docx` and `.txt`: they are files, not pages, and this branch commits none. Without the filter the build fails with "Failed to fetch /resume.pdf: Not Found".
- `check.ts` and `.github/workflows/spike-check.yml` (below).

## How the checks reach the deployment

Each push to the branch starts `spike-check`, which runs on `ubuntu-24.04` with Bun 1.4.2:

1. `bun check.ts wait` reads the commit's statuses through GitHub's API and waits for Vercel's status for this project. A `failure` or `error` ends the run with Vercel's description and its dashboard link.
2. After `success`, it reads `/build-info.json` from the project's Git branch URL, `resume-deploy-spike-git-prototype-deploy-spike-peterkloss.vercel.app`, until the file names this commit. The file's `VERCEL_URL` is the deployment's own address.
3. `bun check.ts run <origin>` runs the checks against that address and prints one line per check: `check <n> (<name>): pass|FAIL: <what it saw>`, and for a failure the change from the spec's "If it fails" column.

The wait is at most 15 minutes. Every request carries `x-vercel-protection-bypass` and `x-vercel-skip-toolbar: 1`. The secret goes only to hosts that match this project's `*.vercel.app` names.

Why this route. With the project's settings, Vercel posts only a commit status, whose link is the dashboard, not the deployment's address; `deployment_status` and `repository_dispatch` are off, and `repository_dispatch` reaches only workflows on `main` anyway.

| Route to the deployment | Exact for the commit | Needs Peter | Effect on later checks |
|---|---|---|---|
| GitHub Deployments, with `deployment_status` turned on | Yes | Yes, a project setting | None |
| The production `.vercel.app` address and `build-info.json` | Yes | No | Breaks at D3: check 5 redirects that host to peterkloss.dev |
| Vercel's commit status, then the Git branch URL's `build-info.json` (chosen) | Yes | No | None |

## Verdicts

| # | Check | Task | Verdict |
|---|---|---|---|
| 1 | Which Bun runs the build, and whether `bunVersion` decides it | D1 | Pass, 2026-10-27. Bun 1.4.4 (`/bun1.4/bun`) runs the build. `bunVersion` does not decide it; `bun.lock`'s `lockfileVersion: 2` does. See "Check 1" below |
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

Three runs of `spike-check`, each against its own commit's deployment:

| Run | Commit | `bunVersion` | Verdict line |
|---|---|---|---|
| 40564053962 | `0ebfce2` | `"1.4.x"` | `check 1 (build Bun): pass: the build ran Bun 1.4.4 (/bun1.4/bun, revision 38afee6c8), the line that vercel.json bunVersion "1.4.x" names` |
| 40564247218 | `e17572a` (control) | `"1.x"` | `check 1 (build Bun): FAIL: the build ran Bun 1.4.4 (/bun1.4/bun, revision 38afee6c8), but vercel.json bunVersion "1.x" names 1.3; …` |
| 40564612136 | `57ee1fd` | `"1.4.x"` | `check 1 (build Bun): pass: the build ran Bun 1.4.4 (/bun1.4/bun, revision 38afee6c8); vercel.json bunVersion "1.4.x"; bun.lock lockfileVersion 2` |

- **Which Bun.** Bun 1.4.4, revision `38afee6c8`, at `/bun1.4/bun`. Vercel picks the patch; CI pins 1.4.2.
- **Whether `bunVersion` decides it.** No. With `"1.x"`, which Vercel's docs map to Bun 1.3.14 for functions, the build still ran 1.4.4. The control's FAIL is the first rule's comparison with the line `bunVersion` names; it is the evidence, not a broken build. From `57ee1fd` on, check 1 passes when the build runs the 1.4 line, which is what SPEC-deploy needs.
- **What decides it.** Vercel's `@vercel/build-utils` 14.10.1 changelog: "The install step now selects the Bun 1.4 binary whenever the lockfile requires it, mirroring how the pnpm version is already inferred from its lockfile version, instead of always running the container's default Bun 1.3.x install." Bun 1.4 writes `lockfileVersion: 2`. The spike's `bun.lock` and `main`'s both have it. (https://unpkg.com/@vercel/build-utils@14.12.0/CHANGELOG.md) Not run here: a build with a `lockfileVersion: 1` lockfile.
- **For D6** (nothing in the spec changes here):
  - The "If it fails" change, the 1.4.2 installer, is not needed.
  - SPEC-deploy's note on `bunVersion` (`"1.x"` would be Bun 1.3.14) can hold for the functions only; check 2 tells. For the build, the lockfile decides.
  - Vercel's own way to pin an exact build Bun is the install command `bunx bun@<version> install` (https://vercel.com/kb/guide/how-to-pin-a-specific-bun-version-for-vercel-builds). The spec's fallback names Bun's installer instead.

## Seen on the way

- Each push deployed in about 20 to 30 seconds. Vercel's commit status reads "Vercel is deploying your app", then "Deployment has completed".
- Without the bypass, the Git branch URL and the deployment's own URL answer 302 to Vercel's sign-in. The production address `project-8ar0o.vercel.app` answers 200, as "Standard Protection protects all domains except production domains" says. D3 (check 5) and D4 (check 6) use that address.
- `/build-info.json` is public on the production address. It holds no secret.
- `gh run list --workflow spike-check.yml` looks the file up on `main` and answers 404 until the workflow's first run exists. After that it works.
- A newer push cancels the older `spike-check` run (`concurrency`). Vercel also builds only the newest queued commit, so a superseded run would wait out its 15 minutes.

## Run locally

```sh
bun ci
bun run build              # writes .vercel/output/
```

`csp-test.ts` and `offline-test.ts` are the CSP probe's local tests; they still read `dist/client/`, the output folder before Nitro's Vercel preset.
