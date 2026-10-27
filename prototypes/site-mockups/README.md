# Site mockups: prototype sources

This branch keeps the sources of the site mockups. It is a prototype record, not code for `main`. The approved images and their index are on `main` in [docs/design/mockups/](https://github.com/loriensleafs/resume/tree/main/docs/design/mockups).

## What is here

| Path | What it is |
| --- | --- |
| `boards/*.dc.html` | One file per board of the private Claude Design canvas "Resume site mockups", version 42 (2026-10-27) |
| `boards/canvas.json` | The canvas index: pages, board positions, titles and notes |
| `design-system-bundle.ts` | The entry for the one-file design-system bundle the boards load as `acme/design-system.js` |
| `export.ts` | Renders the "Merged, light and dark" boards to PNG without the canvas |

The canvas has three pages. "Merged, light and dark" is the approved design. "First mockups" and "Concepts" are the earlier explorations it came from.

## Limits

The boards are Claude Design files. They load the canvas runtime (`support.js`), which is not here, and their `{{holes}}` and `<dc-import>` tags work only inside the canvas. To change a board, import these files into a Design canvas, or edit the canvas itself.

## Render the images again

1. In this folder, install the design system's browser build and Playwright: `bun add @acmelabs/design-system-browser@0.3.2 playwright`.
2. Build the bundle: `bun build design-system-bundle.ts --format iife --minify --target browser --outfile boards/acme/design-system.js`.
3. Render: `bun export.ts boards ../../docs/design/mockups`. Add board slugs, such as `first-view`, to render only those.

`export.ts` fills each board's `{{holes}}` from its `renderVals()`, sets light or dark mode, and saves `<slug>-light.png` and `<slug>-dark.png` at the board's canvas size. Replace the images on `main` in the same commit as the change that needs them.
