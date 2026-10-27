# PROTOTYPE: the split Content Security Policy, the not-found page and the offline fallback

Throwaway code for SPEC-deploy, after its third review (interview row 126). It is never merged into `main`. It runs on the build of `prototypes/csp-probe/` (the site spike).

## Question

Does SPEC-deploy's design hold in Chrome?

- A header policy on every response with no `default-src` and no `script-src`.
- A policy tag first in each page's `<head>`: `default-src 'self'; script-src 'self'` plus the page's inline-script hashes.
- One full policy, with `script-src 'self'`, for the service worker's own files.
- A static not-found page with no scripts, sent with status 404.
- A service worker that serves the not-found page for unknown paths offline.

## Verdict (2026-10-27)

Yes. Chrome reported no `securitypolicyviolation` event, no page error and no service-worker console message on:

- a first visit and a second visit to `/`;
- a deep-dive page;
- client-side navigation back to `/`;
- an unknown path online;
- `/` offline;
- an unknown path offline.

The not-found page has no scripts, so it needs no hashes and does not hydrate the router.

One finding changes the design. Workbox's `navigateFallback` serves the not-found page for every navigation the service worker has not precached, online too: the unknown path online came back as the not-found page with status 200 from the worker. After a release adds a new source page, a returning visitor's old worker would show "not found" for that real page until the worker updates. So the worker must try the network first for navigations, and use the not-found page only when the network fails.

A second finding, from `nav-check.ts`: client-side navigation needs a server at run time. The "client navigation to /" step above raised no violation, but the page it reached was empty. The route's loader runs in the browser during navigation and calls the server function `getResume()` as `GET /_serverFn/<hash>`. The static server answered 404, so the page had no `<h1>`. A site with no request-time server must therefore give its loaders data that needs no server function at run time, and the browser test must fail on any request to `/_serverFn/`.

Not tested here: Vercel's own routing, header merging and case rules (the plan's deploy spike checks those on a real deployment).

## Run

```sh
# after building prototypes/csp-probe (see its README), with its dist/ and node_modules beside these files
bun prepare.ts      # adds each page's policy tag and writes dist/client/404.html
bun gen-sw.ts       # the service worker, with navigateFallback "/404.html"
bun csp-meta-test.ts
bun nav-check.ts    # client navigation from a deep dive back to /, with the requests it makes
```
