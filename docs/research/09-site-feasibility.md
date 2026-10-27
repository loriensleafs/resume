# Site feasibility: TanStack Start, prerendering, offline and the design system under Bun

Tested 2026-10-26 in a throwaway app outside the repository, on Bun 1.4.2.

Versions: `@tanstack/react-start` 1.169.4, `@tanstack/react-router` 1.170.46, React 19.3.1, Vite 8.3.5, `@vitejs/plugin-react` 6.1.2, `vite-plugin-pwa` 2.0.0, `workbox-build` 7.4.1, `@acmelabs/design-system-react` 0.3.2.

| Question | Result |
|---|---|
| App source in a nested folder | Works: `tanstackStart({ srcDirectory: "src/site" })`. |
| Static prerendering | Works: `prerender: { enabled: true, crawlLinks: true, failOnError: true }`. Pages land at `dist/client/<route>/index.html`. The crawl also visits the download links and leaves the files intact. |
| Reading YAML at build time | Works: a `createServerFn` handler reads the file with `Bun.file` and `Bun.YAML` during prerender under `bun --bun vite build`. |
| A design-system React part in a prerendered page | A static import of `Button` from `@acmelabs/design-system-react/components/button` did not break prerendering. The HTML holds `<acme-button>`, and the browser upgrades it after load. The package still does not promise server rendering ([0007](../decisions/0007-tanstack-start-pwa.md)), so each part needs this check. |
| `vite-plugin-pwa` | With Vite 8 and TanStack Start's multi-environment build, it wrote `manifest.webmanifest` but no service worker. |
| A service worker after prerendering | Works: a Bun script calls `generateSW` from `workbox-build` on `dist/client` after `vite build`. The precache list then holds the prerendered pages, JS, CSS and the PDF, Word and text files. Pages must be cached under their clean URLs (`/deep-dives/<id>`, not `…/index.html`); a `manifestTransforms` entry does that. |
| Offline in a real browser | Passes in Chromium driven by Playwright under Bun: after one visit, `/`, two deep-dive pages and `/resume.pdf` load with the network off, with no page errors, and the design-system button is upgraded. |

Playwright runs under Bun (`require("playwright")` in a `bun` script), so the browser test needs no Node.

Not tested: the `nitro()` plugin and Vercel's Bun runtime (deploy module), and the chat route.

Outcome: the site spec can keep [decision 0007](../decisions/0007-tanstack-start-pwa.md), with a post-build service-worker step instead of `vite-plugin-pwa`.
