# The site is a TanStack Start progressive web app

Peter wants the site to be a progressive web app that works offline and uses TanStack Router, Query and DB, with a TanStack AI chat and his design system. TanStack Start includes the router, prerenders pages to static HTML that reads without JavaScript, and serves the chat's server route from the same app. The Vite PWA plugin (Workbox) generates the offline service worker.

Decided 2026-10-26 by Peter.

Considered:

- Lit with the framework-free `@tanstack/ai-client`: no TanStack React hooks or devtools, and no Lit adapters for TanStack AI or DB (npm, 2026-10-26).
- A React chat island on a plain Bun server: router setup, prerendering and the service worker would be built by hand.

Consequences:

- `@acmelabs/design-system-react` supports browser rendering only, so design-system parts render client-side. Resume text is prerendered as plain semantic HTML styled with the design system's tokens.
- Vite and Nitro run on the Bun runtime ([0004](0004-bun-only.md)).

Evidence: [research 05](../research/05-framework-support.md).
