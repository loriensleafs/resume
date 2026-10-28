# Site mockups: prototype sources

This branch keeps the sources of the site mockups. It is a prototype record, not code for `main`. The approved images and their index are on `main` in [docs/design/mockups/](https://github.com/loriensleafs/resume/tree/main/docs/design/mockups).

## What is here

| Path | What it is |
| --- | --- |
| `boards/*.dc.html` | One file per board of the private Claude Design canvas "Resume site mockups", version 46 (2026-10-27) |
| `boards/canvas.json` | The canvas index: pages, board positions, titles and notes |
| `design-system-bundle.ts` | The entry for the one-file design-system bundle the boards load as `acme/design-system.js` |
| `export.ts` | Renders the "Merged, light and dark" boards to PNG without the canvas |
| `package.json`, `bun.lock` | The render tools at exact versions: the design system's browser build and Playwright 1.63.0. The browser build's entry in `package.json` is the one place the boards' design-system version is written |

The canvas has three pages. "Merged, light and dark" is the approved design. "First mockups" and "Concepts" are the earlier explorations it came from.

On 2026-10-27 the boards moved to the design system 0.3.3 (decision record row 172 on `main`). The bundle built at 0.3.3 is byte-identical to the bundle built at 0.3.2, so the canvas stays at version 46: it already holds the same bundle. A new render of all 30 boards matches the approved images, so the images on `main` stay.

## Limits

The boards are Claude Design files. They load the canvas runtime (`support.js`), which is not here, and their `{{holes}}` and `<dc-import>` tags work only inside the canvas. To change a board, import these files into a Design canvas, or edit the canvas itself.

## Render the images again

1. In this folder, install the render tools: `bun install`. On a machine that has no Chromium for Playwright 1.63.0 yet, also run `bunx --bun playwright install chromium` once.
2. Build the bundle: `bun build design-system-bundle.ts --format iife --minify --target browser --outfile boards/acme/design-system.js`.
3. Render into a folder outside this checkout: `bun export.ts boards <folder>`. Add board slugs, such as `first-view`, to render only those. A full render makes 30 images in about a minute.

`export.ts` fills each board's `{{holes}}` from its `renderVals()`, sets light or dark mode, and saves `<slug>-light.png` and `<slug>-dark.png` at the board's canvas size. This checkout's own `docs/design/mockups/` is an old copy; the approved images are on `main`. A change to the mockups follows the `update-mockups` repo skill on `main`: Peter approves the new images before they replace the ones there.

A new render shows the same content as the images on `main`, with differences at glyph edges only; they come from the platform's font rendering or the browser build that made those images, and Playwright 1.64.1 matched them no closer than the pinned 1.63.0 (test of 2026-10-27).
