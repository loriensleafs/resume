# The site is static files with build-time data; only the three API routes run as functions

TanStack Start with Nitro's Vercel preset sends every path that is not a file to a server function, which renders it at request time. That page has no Content Security Policy tag, so the strict policy would not cover it. In the same way, a click between pages runs the next route's loader in the browser, and the loader calls its server function as `GET /_serverFn/<id>`. A local check showed that, with no server, that request gets a 404 and the page comes up empty, online and offline.

Decided 2026-10-27 by Peter, with the approval of SPEC-deploy ([interview record](../design/interview-2026-10-26.md), row 127).

- No page and no server function runs at request time. Only `/api/chat`, `/api/status` and `/api/cron/health` run as functions.
- After the build, `writeVercelConfig()` replaces Nitro's routes in `.vercel/output/config.json`: the host redirects, the headers, the clean addresses, the three API routes (case-sensitive), and the static not-found page with status 404 for every other path.
- Loaders get their data from a module made at build time, which holds only public data. The browser test fails on any request to `/_serverFn/`.
- Every HTML file carries its own policy tag with its script hashes, so a page keeps its policy also from the service worker's cache.

Considered:

- Keep Nitro's catch-all to `/__server`: unknown paths render with no policy tag, and every unknown path or scan runs a function.
- Send only `/_serverFn/` to a function: a click online works, but offline it fails, and SPEC-site promises pages offline after one visit.
- TanStack Start's static server functions (`@tanstack/start-static-server-functions`): they write each result to a JSON file at build time, but they are a new package, and a build-time module does the same with none.

Evidence: [research 12](../research/12-deploy-platform.md), section "Local checks and facts after the third review"; the probes on the branch `prototype/csp-probe` (`prototypes/nitro-vercel-output/`, `prototypes/csp-probe-2/nav-check.ts`).
