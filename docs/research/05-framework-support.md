# TanStack adapters and the design system's React support

Checked 2026-10-26 on the npm registry and in acmelabs-15/design-system.

| Package | React | Lit |
|---|---|---|
| TanStack AI | `@tanstack/ai-react` 1.0.0 (2026-10-22) | none on npm; `@tanstack/ai-client` 1.0.0 is framework-free |
| TanStack Query | `@tanstack/react-query` 5.105.0 | `@tanstack/lit-query` 0.2.31 |
| TanStack DB | `@tanstack/react-db` 0.5.12 (`@tanstack/db` 0.15.2) | none on npm |
| TanStack Start | `@tanstack/react-start` 1.169.4 | not applicable |
| Design system | `@acmelabs/design-system-react` 0.3.2 | `@acmelabs/design-system` 0.3.2 |

Design system facts (its README and source at commit 76acca9):

- The React package wraps the same Lit elements. "The package is for browser rendering; server rendering is outside its supported contract."
- `acme-markdown` renders Markdown from a `text` property with TanStack Markdown; raw HTML is off unless opted in. Setting `text` again re-renders, which suits streamed answers.
- The design system's default font is Google Sans Flex; `registerTheme` changes fonts and colors.

Outcome: [decision 0007](../decisions/0007-tanstack-start-pwa.md).
