# PROTOTYPE: what Nitro's Vercel preset writes

Throwaway evidence for SPEC-deploy (interview row 126). It is never merged into `main`.

## Question

Which routes and functions does TanStack Start with `nitro({ preset: "vercel" })` write to `.vercel/output`? The spike in `prototypes/csp-probe/` was built with `vite.config.ts` from this folder, under Bun 1.4.2, with Nitro `3.0.260903-beta`, and with no Vercel account or CLI.

## Verdict (2026-10-27)

`config.json` (copied here) holds four routes:

1. `/assets/(.*)` gets `cache-control: public, max-age=31536000, immutable`.
2. `handle: filesystem`: prerendered files are served as they are.
3. `/api/chat` goes to its own function, because of `functionRules`; `chat.vc-config.json` (copied here) has `maxDuration: 90`.
4. `/(.*)` goes to `/__server`: every other path that is not a file is rendered by a function at request time, the not-found page included.

Both functions declare `runtime: "bun1.x"`, which Vercel maps to Bun 1.3.14, because nothing set a Bun version. The runtime must be set to `bun1.4.x` explicitly, in `vercel.json` (`bunVersion`) or in Nitro's `vercel.functions.runtime`.

So SPEC-deploy writes its own routes into `config.json` after the build: the redirects, the headers, the chat and status routes (with `caseSensitive: true`), and a static not-found page for every other path. Vercel's Build Output docs give the route fields (`src` as a regular expression, `headers`, `status`, `has`, `caseSensitive`, the `handle` phases) and allow `crons` in the same file: https://vercel.com/docs/build-output-api/configuration
