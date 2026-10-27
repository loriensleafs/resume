# PROTOTYPE: strict Content Security Policy probe

Throwaway code. It answers one question for SPEC-deploy and is never merged into `main`.

## Question

Do the prerendered TanStack Start pages, the design system's components and the Workbox service worker run under a strict, hash-based Content Security Policy, with no `'unsafe-inline'` and no `'unsafe-eval'`, online and offline?

## Verdict (2026-10-27)

Yes. `csp-test.ts` serves `dist/client/` with this policy on every response. For each HTML page it adds the SHA-256 hash of each inline script, as a build step would:

```text
default-src 'self'; script-src 'self' 'sha256-…' (one per inline script of the page); style-src 'self';
img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self';
object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'
```

Chromium, through Playwright under Bun, reported no `securitypolicyviolation` event on four loads: the first visit to `/`, a second visit, `/deep-dives/design-system-mcp`, and `/` offline from the service worker. The router ran on the client, `acme-button` was defined and the service worker controlled the page.

Facts behind the verdict:

- A prerendered page has four inline scripts: the service-worker registration (the site's own), TanStack Router's scroll restoration, its hydration bootstrap (`$_TSR`, which holds per-page data) and a stream-boundary remover. Each page therefore has its own hashes.
- The design system adds its styles as constructable stylesheets (`adoptedStyleSheets`). It falls back to `<style>` elements with `window.litNonce` only where a browser lacks them. So `style-src 'self'` is enough.
- One console error, `TypeError: Invalid action variant`, also appears with no policy. It comes from this spike's old `variant="filled"` on `acme-button`, not from the policy.

Not tested: the chat's `fetch` to `/api/chat` (same origin, covered by `connect-src 'self'`), the site's own CSS and font files (same origin), and how the hashes reach the response on Vercel. A per-path header written into the build output and a `<meta http-equiv="Content-Security-Policy">` tag in each page are the two ways; the plan picks one.

## Run

```sh
bun install
cp ../../dist/public/resume.{pdf,docx,txt} public/   # after `bun run build --public` in the repo root
bun --bun vite build && bun gen-sw.ts
bun csp-test.ts            # with the policy
NOCSP=1 bun csp-test.ts    # control, without the policy
```
