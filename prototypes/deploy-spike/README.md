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
- `build-info.ts` writes `public/build-info.json`, which Vite copies to `/build-info.json`. It holds the commit, the deployment's own address (`VERCEL_URL`), the Git branch address, `vercel.json`'s `bunVersion`, and the output of `bun --version` with the binary's path and revision. It writes named fields only, because the build environment also holds the bypass secret.
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
| 1 | Which Bun runs the build, and whether `bunVersion` decides it | D1 | Pending |
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

## Run locally

```sh
bun ci
bun run build              # writes .vercel/output/
```

`csp-test.ts` and `offline-test.ts` are the CSP probe's local tests; they still read `dist/client/`, the output folder before Nitro's Vercel preset.
