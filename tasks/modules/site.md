# Site tasks

Spec: [SPEC-site](../../spec/SPEC-site.md), approved 2026-10-27 (decision record rows 134, 137 to 139). The order is in [todo.md](../todo.md); read these conventions and your task's body only.

## Conventions

The mockups that the tasks draw are in `docs/design/mockups/`: first view, after a question with a source open, returning visitor, installed app, page not found, career timeline states, the phone boards (role selected, source, install offer, new chat, page not found) and the app icon.

- **Files** leaves out `tasks/todo.md` and `docs/STATUS.md`, which every task updates at its end, and the generated `src/site/routeTree.gen.ts`. `bun.lock` changes only through `bun add` with `package.json`, and counts as one file with it. A name in parentheses after `package.json` is a package or a script it gains, not a file.
- **Library skills.** Before code that uses a library, the task loads its skill with `bun run intent load <package>#<skill>` (AGENTS.md, decision 0014): `@tanstack/react-start` and `@tanstack/react-router` from S1, `@tanstack/react-db` in S21, and `@acmelabs/design-system#react-integration`, `#choose-and-compose` and `#forms-and-accessibility` for every task that adds a design-system part. Each part's record comes from the `acme-design-system` MCP server, with the version that `package.json` pins (0.3.3) and framework `react`.
- **Seam 1** is `src/site/__tests__/build.test.ts`. Until S8 it runs `buildSite({ root, outDir })` directly, with a fixture root whose `private.yaml` holds a fake phone number (main's decision, 2026-10-27). From S8 it runs `bun run build:site --root <fixture root> --out <folder>` once. The built-output checks (each HTML file's policy tag, no `style=` attribute) live here only; deploy's `src/deploy/__tests__/config.test.ts` checks `addPolicyTags()` and `writeVercelConfig()` at unit level. **Seam 2** is `src/site/__tests__/browser.test.ts`: Playwright drives Chrome (`CHROME_PATH`) under Bun against `bun run preview --dir <folder>`.
- **The workspace contract.** S14 exports the whole `Workspace` type; each member whose behavior a later task adds is a no-op until then. The chat's tasks check that they call a member; S32 to S36, which run after those chat tasks, check the effect.
- **Composition roots.** `scripts/build-site.ts`, `vite.config.ts` and the route files import several modules; the module that provides a step wires it in (S28 adds the `writeServiceWorker()` call as the build script's step 4).
- Every task ends with `bun run build`, `bun test` and, once S8 lands, `bun run build:site` (AGENTS.md, Verify). A push that changes a site file is a release (AGENTS.md, "Releases and approvals").
- S31 to S36 each wait for a chat task, because only a scripted answer from the preview's fake model reaches these contract members. S31 runs right after C17; the rest run in phase 4.

## Tasks

### S1: The TanStack Start app on Bun, with Nitro's Vercel output

Delivers: Peter can run `bun run dev` and open `/`, and a Vite build writes Nitro's Vercel output in `.vercel/output/`.
Blocked by: none
Acceptance:
- The spec's packages are installed at their exact versions: `@tanstack/react-start` 1.169.4, `@tanstack/react-router` 1.170.46, `react` and `react-dom` 19.3.1, `vite` 8.3.5, `@vitejs/plugin-react` 6.1.2 and `nitro` 3.0.260903-beta. `@types/react` and `@types/react-dom` 19.3.0 are exact development dependencies, so the type check (A9) reads the React code (row 159). Vite runs under `bun --bun`, with `srcDirectory: "src/site"` and Nitro's `vercel` preset (Tech Stack).
- `bun --bun vite build` writes `.vercel/output/config.json` and `.vercel/output/static/`, and git ignores `.vercel/` (AC; Boundaries: never commit `.vercel/`).
- The task confirms that each function's `index.mjs` in `.vercel/output/functions/` has a default export with `fetch(request)`, which `bun run preview` needs, and records what it found in its `tasks/todo.md` entry (Commands: "the plan confirms it when it installs Nitro").
Verify: `bun install`; `bun run dev`, then `curl -s http://localhost:3000/ | grep -c '<html lang="en"'` prints 1; `bun --bun vite build && ls .vercel/output/static .vercel/output/functions`; `bun run build`; `bun test` (43 pass)
Files: `package.json` and `bun.lock`, `.gitignore`, `vite.config.ts`, `src/site/router.tsx`, `src/site/routes/__root.tsx`
Size: M
Needs Peter: no. Peter approved `nitro` and `react-dom` (row 135), and `@types/react` and `@types/react-dom` (row 159); approving the spec approved the rest.

### S2: `buildSite()` prerenders `/` and `/resume`, and no other page

Delivers: `buildSite({ root, outDir })` writes `/` and `/resume` as static pages into `<outDir>/.vercel/output/static/`, and seam 1 starts.
Blocked by: S1
Acceptance:
- `buildSite()` prerenders `/` and `/resume` and no other page, with `crawlLinks` and `failOnError` (AC; Tech Stack).
- `prerender.filter` rejects each path with `?` and sets `sitemap: { exclude: true }` on it: no HTML file comes from a path with `?`, and the sitemap lists no address with `?` (Tech Stack; Testing 1).
- With the fixture root's fake phone number, no file under the output holds that number, and no built page holds a `style=` attribute (Testing 1; SPEC-deploy, Headers).
Verify: `bun test src/site/__tests__/build.test.ts`; `bun run build`; `bun test`
Files: `src/site/build.ts`, `vite.config.ts`, `src/site/routes/index.tsx`, `src/site/routes/resume.tsx`, `src/site/__tests__/build.test.ts`
Size: M
Needs Peter: no

### S3: The resume view from build-time data, with knowledge ids

Delivers: `/` and `/resume` show the whole resume (the lead, each role with its highlights, the earlier roles, skills and education) as plain semantic HTML that reads without JavaScript, each entry with its knowledge id.
Blocked by: S2, K1 (the id rules in `src/knowledge/ids.ts`, with their export names in SPEC-knowledge)
Acceptance:
- Every resume entry appears as text in `/` and `/resume` with its knowledge id on its element: `basics` on the lead, `role:<id>` on each role's heading, `highlight:<role id>.<n>` on each highlight, `skills:<slug>` on each skills group and `education` on the education entry (Views: Resume view; Testing 1).
- Every resume fact comes from `resume.yaml` through `loadResume("public", root)`, held in `src/site/data.ts`, a module made at build time. The loaders read that module, and no route defines a server function (AC; decision 0023).
Verify: `bun test src/site/__tests__/build.test.ts`; `grep -rn createServerFn src/site` prints nothing; `bun run build`; `bun test`
Files: `src/site/data.ts`, `src/site/shell/ResumeView.tsx`, `src/site/routes/index.tsx`, `src/site/routes/resume.tsx`, `src/site/__tests__/build.test.ts`
Size: M
Needs Peter: no

### S4: The app bar, and design-system parts in prerendered pages

Delivers: every page opens with the design system's app bar ("Peter Kloss" in the blue box, then the headline), and each design-system part prerenders as its tag with its light-DOM text.
Blocked by: S3
Acceptance:
- Every page has `acme-app-bar` with "Peter Kloss" in the blue box and the headline (`basics.label`), from `@acmelabs/design-system-react` 0.3.2 and its token stylesheet, each part imported from its own wrapper module (Views: App bar; Tech Stack).
- Each design-system part the pages use appears in the prerendered HTML as its tag with its light-DOM text, and no page holds a declarative shadow root (`<template shadowrootmode`) (Testing 1).
- The app bar's `end` slot takes its content from the page's route, so the workspace route can put the chat's New chat there (capability map, contracts: "the app bar's end slot").
Verify: `bun test src/site/__tests__/build.test.ts`; `bun run build`; `bun test`
Files: `package.json` and `bun.lock`, `src/site/shell/AppBar.tsx`, `src/site/routes/__root.tsx`, `src/site/styles/tokens.css`, `src/site/__tests__/build.test.ts`
Size: M
Needs Peter: no

### S5: The static not-found page

Delivers: the build writes `404.html`, the not-found page with Peter's approved wording and no script.
Blocked by: S4
Acceptance:
- `buildSite()` writes `404.html` with the app bar's name box and headline, "404", the heading "Page not found", "There is no page at this address. The link may be mistyped, or the page may have moved.", and the links "Ask the chat about Peter's work" (`/`) and "Read Peter's resume" (`/resume`) (Workspace addresses; row 138).
- `404.html` holds no script, so it follows the system's light or dark setting (Testing 1; Saved views, the head script). The browser check of its appearance is in S13.
Verify: `bun test src/site/__tests__/build.test.ts`; `bun test`
Files: `src/site/build.ts`, `src/site/not-found.tsx`, `src/site/__tests__/build.test.ts`
Size: S
Needs Peter: no

### S6: Page titles, descriptions, canonical addresses and share previews

Delivers: each page has a title, a description, a canonical address on `https://peterkloss.dev` and Open Graph tags, and the sitemap lists every page.
Blocked by: S3
Acceptance:
- `/` and `/resume` each have a title, a description from `resume.yaml` (no fact copied by hand), a canonical address on `https://peterkloss.dev` and Open Graph tags (Testing 1; Standalone pages; AC).
- The sitemap lists every prerendered page on `https://peterkloss.dev` (Testing 1).
Verify: `bun test src/site/__tests__/build.test.ts`; `bun test`
Files: `src/site/page-head.ts`, `src/site/routes/index.tsx`, `src/site/routes/resume.tsx`, `vite.config.ts`, `src/site/__tests__/build.test.ts`
Size: S
Needs Peter: no

### S7: Google Sans Flex served from the site itself

Delivers: the pages use a committed Latin subset of the Google Sans Flex variable font, weights 400 to 700, from the site's own address.
Blocked by: S4. The font file format is a wording draft for Peter's one review before D37 (row 153).
Acceptance:
- `scripts/site-fonts.ts` cuts a Latin subset of the variable font, weights 400 to 700, with `harfbuzzjs`; the files are committed in `public/fonts/`, and the build copies them and downloads nothing (Tech Stack; SPEC-deploy, Documents). The script and folder names are the site planner's choice: the spec names neither, and a new script keeps the content module's `scripts/make-fonts.ts`, which the documents hash covers, unchanged.
- The files use WOFF, which needs no new package; `docs/design/wording-drafts/S7.md` holds this wording draft. WOFF2 needs an encoder package, and a new package needs Peter's approval first (AGENTS.md, Code), so WOFF2 comes only from his review, as a follow-up task (Open Questions; row 153).
- No output file names a font on another host; the `@font-face` rules point at the site's own files (Boundaries: no request to a third party).
Verify: `bun run scripts/site-fonts.ts` (with the variable font present); `bun test src/site/__tests__/build.test.ts`; `bun test`
Files: `scripts/site-fonts.ts`, `public/fonts/` (the cut files), `src/site/styles/fonts.css`, `src/site/routes/__root.tsx`, `src/site/__tests__/build.test.ts`, `docs/design/wording-drafts/S7.md`
Size: M
Needs Peter: approval of the font format in his one review before D37 (row 153); WOFF2 also needs his approval of its encoder package. The task finishes on the wording draft, WOFF.

### S8: Seam 1 runs the build script

Delivers: the build-output test builds once through `bun run build:site --root <fixture root> --out <folder>` and checks each page's policy tag, so later checks see the same output that Vercel serves.
Blocked by: S2, S3, S4, S5, S6, S7, D16 (`scripts/build-site.ts` with `--root`, `--out` and `addPolicyTags()`)
Acceptance:
- `src/site/__tests__/build.test.ts` builds once with `bun run build:site --root <fixture root> --out <folder>`, where the fixture root holds a `private.yaml` with a fake phone number, and every earlier seam-1 check passes on that output (Testing 1; main's decision 2026-10-27).
- Each HTML file, `404.html` included, starts with a policy tag that lists exactly the hashes of its own inline scripts (AC; Testing 1). This is the one built-output check of the policy tags; deploy's `src/deploy/__tests__/config.test.ts` checks `addPolicyTags()` at unit level only (main's decision, 2026-10-27).
Verify: `bun test src/site/__tests__/build.test.ts`; `bun run build:site`; `bun test`
Files: `src/site/__tests__/build.test.ts`, `src/site/__tests__/fixture-root.ts`
Size: S
Needs Peter: no

### S9: The preview and the real-browser test

Delivers: `bun run preview --dir <folder>` serves a built output as Vercel does, and `src/site/__tests__/browser.test.ts` drives Chrome against it.
Blocked by: S8, D17 (`writeVercelConfig()`: the clean addresses and the not-found route)
Acceptance:
- `bun run preview [--dir <folder>]` (`scripts/preview-site.ts`, with `Bun.serve`) serves `<folder>/.vercel/output/static/` with the routes, headers, `overrides` and status codes of its `config.json`: `/` and `/resume` answer 200, and an unknown path answers the not-found page with 404 (Commands).
- The browser test builds into the seam-1 folder, starts the preview, and on every page it visits fails on any request to `/_serverFn/`, any Content Security Policy violation and any page error (Testing 2: Policy).
- After load, each design-system part on `/` and `/resume` is defined and upgraded, with its shadow root, and axe-core reports no WCAG 2.2 AA violation on `/` and `/resume` at 1440 × 900 and 390 × 844 (Testing 2: Design-system parts, Accessibility).
Verify: `bun test src/site`; `bun run build:site && bun run preview`, then `curl -s -o /dev/null -w '%{http_code}' http://localhost:4173/nope` prints 404
Files: `scripts/preview-site.ts`, `package.json` and `bun.lock` (`playwright`, `axe-core`, the `preview` script), `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### S10: The career timeline band

Delivers: the workspace shows every role and earlier role as a span at its true length on a year axis, with its short label, its full name for screen readers, and a tooltip.
Blocked by: S9, T1 (the roles' `x-short` field)
Acceptance:
- Under the app bar, full width, the band is headed "Career timeline", and on wide screens "Select a role to read it and scope the chat" follows (row 50). Each span sits at its true length, a gap shows as space, and each width comes from a class in a stylesheet the build writes, never a `style` attribute (Views: Career timeline band; SPEC-deploy, Headers).
- Each span's label is its role's `x-short` value on one line, ending in an ellipsis when it is longer than its span; each span is a real button whose accessible name holds the full employer name and the years (Testing 1).
- Hover or focus darkens the span, and `acme-tooltip` adds the full employer name, the title and the years as its description ("Jack Morton Worldwide", "Senior Front-End Engineer, 2016 – 2017"); axe on `/` stays clean (Views; Testing 2: Accessibility).
Verify: `bun test src/site`; `bun run build:site`; `bun test`
Files: `src/site/shell/CareerTimeline.tsx`, `src/site/data.ts` (the spans, the year axis and the timeline stylesheet), `src/site/routes/index.tsx`, `src/site/__tests__/build.test.ts`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### S11: The workspace and its first view on wide screens

Delivers: `/` is the workspace, as the first-view board shows: the app bar, the career timeline band, the chat column with the first view's static parts, and the document panel with the Resume tab.
Blocked by: S10. The suggested questions' wording is a wording draft for Peter's one review before D37 (row 153).
Acceptance:
- On a wide screen `/` shows the chat column, 560 px at its outer edge to the document panel's border, and the document panel, whose `acme-tabs` holds the "Resume" tab with the resume view. Below 1024 px it shows one column (AC; Views: Chat column, Document panel).
- With JavaScript off, `/` shows the first view's static parts: "Ask about Peter's work.", the line about where answers come from, and the suggested questions from `src/site/suggested-questions.ts`, each a button (Views: Chat column; AC: each page reads without JavaScript).
- axe reports no violation on `/` at 1440 × 900 and 390 × 844 (Testing 2: Accessibility).
Verify: `bun test src/site`; `bun run build:site`; `bun test`
Files: `src/site/routes/index.tsx`, `src/site/shell/DocumentPanel.tsx`, `src/site/suggested-questions.ts`, `src/site/styles/layout.css`, `src/site/__tests__/browser.test.ts`, `docs/design/wording-drafts/S11.md`
Size: M
Needs Peter: approval of the wording of the overall suggested questions (Boundaries: ask first), in his one review before D37 (row 153). The task finishes on the wording draft in `docs/design/wording-drafts/S11.md`.

### S12: The head script

Delivers: before the first paint, each page applies the stored theme and hides the first view when a conversation exists, so nothing flashes.
Blocked by: S11, D16 (`addPolicyTags()`, through S8)
Acceptance:
- Each page except `404.html` holds the head script right after its policy tag (`src/site/head-script.ts`), and the code names the design-system gap it covers (Saved views, the head script; Testing 1).
- With `theme` set to `dark` or `light`, the root has `data-acme-appearance` before the first paint; with `auto` or no value it has none. With `pk-conversation` set to `"1"`, the root has `data-pk-conversation`, and the stylesheet hides the first view's static parts. Blocked local storage reads as no value (Saved views).
Verify: `bun test src/site`; `bun run build:site`; `bun test`
Files: `src/site/head-script.ts`, `src/site/routes/__root.tsx`, `src/site/styles/layout.css`, `src/site/__tests__/build.test.ts`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### S13: The theme switch

Delivers: on wide screens the visitor picks System, Light or Dark in the app bar, and the choice survives a reload.
Blocked by: S12
Acceptance:
- The app bar's `end` slot holds `acme-theme-switcher` with System, Light and Dark, and the page content sits in one `acme-theme` scope. On `acme-request` with the action `appearance`, the site sets the switch's `value` and the scope's `appearance`, writes `theme`, and updates the root attribute (Views: Theme switch).
- The dark theme survives a reload, set before the first paint; the not-found page follows the emulated system appearance (Testing 2: Theme).
- axe reports no violation on `/` and `/resume` in dark, at both sizes (Testing 2: Accessibility).
Verify: `bun test src/site`; `bun test`
Files: `src/site/shell/ThemeSwitch.tsx`, `src/site/shell/AppBar.tsx`, `src/site/routes/__root.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### S14: The workspace contract, and the scope from the career timeline

Delivers: selecting a role on the career timeline sets the scope with its label and years, shows the role in the resume and puts `/?role=<id>` in the address; the chat module can build against the whole workspace contract.
Blocked by: S11
Acceptance:
- `src/site/workspace.ts` exports `Scope`, `Workspace` and `useWorkspace()` as the spec's Code Style shows (rows 134 and 137). `setScope()` holds the role with its `x-short` label and its years from `resume.yaml`, and `setScope(null)` clears the selection on the timeline. Each member whose behavior a later task adds is a no-op until then, named in a comment.
- Selecting a role turns its span blue with its name in bold, shows the role in the resume, sets the scope and puts `/?role=<id>` in the address with `history.replaceState` (Testing 2: Wide screens; Views).
- `/?role=<id>` opens the workspace with that role selected and the resume at it; an unknown role id gives the first view, not an error (Workspace addresses).
Verify: `bun test src/site`; `bun test`
Files: `src/site/workspace.ts`, `src/site/shell/CareerTimeline.tsx`, `src/site/shell/ResumeView.tsx`, `src/site/routes/index.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### S15: The first view names the selected role

Delivers: with a role selected, the first view says "Ask about FedNow.", gives the role's title, employer and dates, offers "Read FedNow in the resume" and that role's suggested questions; a suggested question sets the workspace's `suggestedQuestion`.
Blocked by: S14. Each role's suggested questions are a wording draft for Peter's one review before D37 (row 153).
Acceptance:
- With a role selected, the first view names it, gives its title, employer and dates from `resume.yaml`, offers "Read FedNow in the resume" (on wide screens it shows the role in the resume), and lists that role's suggested questions (Views: Chat column).
- Selecting a suggested question sets `suggestedQuestion` to its text, and `clearSuggestedQuestion()` clears it (Code Style table). The chat's test "Selecting a suggested question sends it once" proves the hand-over.
Verify: `bun test src/site`; `bun test`
Files: `src/site/routes/index.tsx`, `src/site/suggested-questions.ts`, `src/site/workspace.ts`, `src/site/__tests__/browser.test.ts`, `docs/design/wording-drafts/S15.md`
Size: S
Needs Peter: approval of the wording of each role's suggested questions, in his one review before D37 (row 153). The task finishes on the wording draft in `docs/design/wording-drafts/S15.md`.

### S16: Source pages

Delivers: every approved source has a standalone prerendered page at `/sources/<id>` with all its passages, and no static file holds a source's `Not public` text.
Blocked by: S6, S8, K3 (sources and `buildKnowledge()` with the two layers), K5 (the source-id rules), K9 (`publicKnowledge()`)
Acceptance:
- The prerender `pages` list holds `/sources/<id>` for each approved source id from `publicKnowledge(knowledge)`, and no draft source has a page. Each page shows the app bar, the title, the kind line ("Deep dive, written from Peter's answers and approved by him. FedNow, 2021 – 2024. 5 passages."), every passage with its anchor `#<source id>.<n>`, and "Ask the chat about this", a link to `/?source=<id>` (AC; Views: Source view, Standalone pages; Testing 1).
- The build-time module holds each approved source's id, title and roles only. Each source's passages are a separate JSON file that Vite emits under `/assets/` with a hashed name. No file under `static/` holds `Not public` text (AC; Testing 1).
- Each source page has a title, a description, a canonical address and Open Graph tags, and the sitemap lists it (Testing 1).
Verify: `bun test src/site/__tests__/build.test.ts`; `bun run build:site`; `bun test`
Files: `src/site/data.ts`, `src/site/routes/sources.$id.tsx`, `src/site/shell/SourceView.tsx`, `vite.config.ts`, `src/site/__tests__/build.test.ts`
Size: M
Needs Peter: no

### S17: Passage text as Markdown

Delivers: passages render through `@tanstack/markdown/react` with no `style` attribute.
Blocked by: S16, S13
Acceptance:
- Passages render with `@tanstack/markdown/react` 0.0.13, a direct dependency, with raw HTML off. Its `components` option for `th` and `td` turns a column's alignment into a class from the stylesheet (Tech Stack; SPEC-deploy amendment 4).
- Every source page still holds every passage's text and no `style=` attribute (Testing 1).
- axe reports no violation on a source page at 1440 × 900 and 390 × 844, light and dark (Testing 2: Accessibility).
Verify: `bun test src/site`; `bun test`
Files: `package.json` and `bun.lock`, `src/site/shell/SourceView.tsx`, `src/site/styles/layout.css`, `src/site/__tests__/build.test.ts`, `src/site/__tests__/browser.test.ts`
Size: S
Needs Peter: no (SPEC-chat names the package; SPEC-site uses it)

### S18: A source opens in the document panel from its address

Delivers: `/?source=<id>&passage=<n>` opens the workspace with that source in a tab and the passage marked; `/?source=<id>` opens it at its top.
Blocked by: S14, S16
Acceptance:
- `/?source=<id>&passage=<n>` shows the tab "Source: <title>" with the source view, and the marked passage is tinted, scrolled into view (with no animation under `prefers-reduced-motion`) and shows "Ask about this passage", which sets `askRequest` to the passage id. `/?source=<id>` opens the source at its top with no passage marked. An unknown source id gives the first view (Testing 2: Wide screens; Views; Workspace addresses; Code Style).
- The workspace fetches a source's JSON file only when it shows that source: the network log of `/` holds no source file (AC).
- The address follows the view with `history.replaceState` (`/?source=<id>&passage=<n>`, `/?source=<id>`, `/?role=<id>`, `/`), and axe reports no violation on the workspace with a source open at 1440 × 900, light and dark (Workspace addresses; Testing 2: Accessibility).
Verify: `bun test src/site`; `bun test`
Files: `src/site/shell/DocumentPanel.tsx`, `src/site/shell/SourceView.tsx`, `src/site/workspace.ts`, `src/site/routes/index.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### S19: Close the source tab

Delivers: the × after the source tab's title closes the source and shows the Resume tab.
Blocked by: S18
Acceptance:
- An `acme-icon-button` named "Close source", after the source tab's title and outside the tab's own button, closes the source tab, shows the Resume tab and takes `source` out of the address (Views: Document panel; rows 49 and 54; Testing 2: Wide screens).
- axe reports no violation for the tab list with the × in place, in light and dark (Views: "the plan checks that its place keeps the tab list valid under axe").
Verify: `bun test src/site`; `bun test`
Files: `src/site/shell/DocumentPanel.tsx`, `src/site/styles/layout.css`, `src/site/__tests__/browser.test.ts`
Size: S
Needs Peter: no

### S20: "Ask about this" on resume highlights

Delivers: hovering or focusing a highlight shows "Ask about this", which hands that highlight to the chat.
Blocked by: S14
Acceptance:
- Hovering or focusing a highlight in the resume view shows "Ask about this", reachable by keyboard; selecting it sets `askRequest` to `{ id: "highlight:<role id>.<n>" }`, and `clearAskRequest()` clears it (Views: Resume view; Code Style table). The chat's About chip test proves the hand-over.
Verify: `bun test src/site`; `bun test`
Files: `src/site/shell/ResumeView.tsx`, `src/site/workspace.ts`, `src/site/__tests__/browser.test.ts`
Size: S
Needs Peter: no

### S21: Saved views in `peterkloss-views`

Delivers: a returning visitor gets back the open tab, the source, its marked passage and the scope; blocked or unknown storage gives a first visit.
Blocked by: S19
Acceptance:
- The site opens `peterkloss-views` once with `createIndexedDB({ name: "peterkloss-views", version: 1, stores: ["views"] })` and keeps `SavedViews` through an `indexedDBCollectionOptions` collection. It writes on every change and reads before the workspace first renders, so a reload restores the tab, the source, the passage and the scope (Saved views; Testing 2: Wide screens).
- A record with an unknown `version` is deleted, and the visit is a first visit. With `indexedDB.open` throwing (an init script), the workspace shows the first view and works with no page error. Nothing calls `deleteDatabase` (Testing 2: Storage).
- An address with `?source=` or `?role=` replaces the saved views (Workspace addresses).
Verify: before the code, `bun run intent list` names the `@tanstack/react-db` skills and `bun run intent load` loads each; then `bun test src/site`; `bun test`
Files: `package.json` and `bun.lock` (`@tanstack/react-db` 0.5.12, `@tanstack/db` 0.15.2), `src/site/saved-views.ts`, `src/site/workspace.ts`, `src/site/routes/index.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### S22: Document downloads from the resume view and the app bar

Delivers: the resume view's ⋯ menu and the app bar's "Resume" menu download the committed PDF, Word and text files.
Blocked by: S11, T2 (`bun run documents` and the committed `documents/`)
Acceptance:
- `buildSite()` copies `documents/`, building no document and needing no Chrome, so `/Peter-Kloss-Resume.pdf`, `.docx` and `.txt` are in the output (SPEC-deploy, build script step 1; Workspace addresses).
- A ⋯ `acme-icon-button` ("More actions") at the resume view's top-right corner opens `acme-menu` with PDF, Word and Text, on the Resume tab and on `/resume`. On wide screens the app bar's `end` slot holds "Resume", a menu of the same three. Each item fetches its document with a success status (Views; Testing 2: Downloads). The task records how a menu item starts a download: `acme-menu-item` 0.3.3 has `href`, `target` and `rel`, and no `download` attribute (design system MCP, checked at 0.3.2 and again at 0.3.3 on 2026-10-27).
- axe reports no violation with the ⋯ menu open at 1440 × 900 (Testing 2: Accessibility).
Verify: `bun test src/site`; `bun run build:site`; `bun test`
Files: `src/site/build.ts`, `src/site/shell/ResumeView.tsx`, `src/site/shell/AppBar.tsx`, `src/site/__tests__/build.test.ts`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### S23: The workspace on phones

Delivers: at 390 × 844 the workspace is one column, the timeline scrolls sideways from the latest roles, and the app bar holds the name box and the download button.
Blocked by: S15, S22
Acceptance:
- One column. The career timeline scrolls sideways, opens at the latest roles and says "Swipe for earlier roles" (Views; Testing 2: Phones).
- The app bar shows the name box and, in its `end` slot, the download button for the three documents, and no theme switch; the page keeps the stored theme or follows the system (Views: Phones).
- Selecting a role sets the scope, names the role in the first view and leaves the resume closed (Views: Phones and the timeline; Testing 2: Phones).
Verify: `bun test src/site`; `bun test`
Files: `src/site/shell/CareerTimeline.tsx`, `src/site/shell/AppBar.tsx`, `src/site/routes/index.tsx`, `src/site/styles/layout.css`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### S24: The resume sheet on phones

Delivers: on a phone, "Read FedNow in the resume" opens a full-height resume sheet at the role, and focus stays inside it until it closes.
Blocked by: S23
Acceptance:
- "Read FedNow in the resume" opens the resume sheet, `acme-drawer` with `placement="bottom"` at full height, at the role. It has a × "Close" at its top right, no grab handle, and the ⋯ menu (Views: Phone sheets, Resume sheet; Testing 2: Phones).
- Opening a sheet moves focus into it; Tab stays inside it; Escape or a tap outside closes it; focus returns to what opened it (Testing 2: Sheets).
- axe reports no violation at 390 × 844 with the resume sheet open and with its ⋯ menu open, light and dark (Testing 2: Accessibility).
Verify: `bun test src/site`; `bun test`
Files: `src/site/shell/Sheet.tsx`, `src/site/shell/ResumeView.tsx`, `src/site/routes/index.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### S25: The source sheet on phones

Delivers: at 390 × 844 a source opens as a sheet over the chat column, from the marked passage onward, with "All passages".
Blocked by: S24, S18
Acceptance:
- At 390 × 844, `/?source=<id>&passage=<n>` opens the source sheet: the title as the drawer's heading, the kind line, and the passages from the marked one onward, with it marked. Its `footer` slot holds "Ask about this passage" and "All passages", which shows every passage from the first while the marked one stays marked (Views: Source sheet; Testing 2: Phones).
- Without a citation number, the sheet shows no "Source for citation" line (Views: Source sheet).
- axe reports no violation at 390 × 844 with the source sheet open, light and dark (Testing 2: Accessibility).
Verify: `bun test src/site`; `bun test`
Files: `src/site/shell/Sheet.tsx`, `src/site/shell/SourceView.tsx`, `src/site/routes/index.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### S26: The app icon

Delivers: `bun run icons` renders the PK icon and the favicon with Chrome into `public/icons/`, and the build copies the committed files.
Blocked by: S7, S8
Acceptance:
- `bun run icons` (`scripts/icons.ts`) renders "PK" in Google Sans Flex Bold, white on `--ds-blue-700`, as a rounded square at 192 and 512 px, a maskable 512 px version with the letters inside the safe zone, and the favicon, with Chrome, locally, into `public/icons/`. The files are committed with the script (Views: App icon).
- The build copies the committed icons; the icon files in the output are those files, at those sizes (Testing 1).
- `/` and `/resume` gain `og:image` on `https://peterkloss.dev`, pointing at the committed 512 px icon, with its width and height (Peter's row 173; S6's `pageHead()` in `src/site/page-head.ts`).
Verify: `bun run icons && git status public/icons`; `bun test src/site/__tests__/build.test.ts`; `bun test`
Files: `scripts/icons.ts`, `public/icons/` (four files), `package.json` (the `icons` script), `src/site/build.ts`, `src/site/__tests__/build.test.ts`
Size: M
Needs Peter: no (the app-icon board is approved)

### S27: The web manifest and the "Install app" button

Delivers: the site has a web manifest for "Peter Kloss", and the app bar shows "Install app" when the browser offers installation.
Blocked by: S26
Acceptance:
- The web manifest, made from `resume.yaml`'s name, has the name "Peter Kloss", `start_url` `/`, `scope` `/`, `display` `standalone`, and PNG icons of 192, 512 and maskable 512 px; every page links it and the favicon (Testing 1; AC).
- On wide screens "Install app" (secondary button, Chrome's install icon) shows in the app bar's `end` slot only after `beforeinstallprompt` and while the site does not run as an app (`display-mode: standalone`); selecting it calls the saved prompt (Views: Install offer). The test dispatches the event and stubs the display mode with init scripts.
- Running as an app, the site asks for persistent storage with `navigator.storage.persist()` (Saved views).
Verify: `bun test src/site`; `bun test`
Files: `src/site/build.ts`, `src/site/routes/__root.tsx`, `src/site/shell/AppBar.tsx`, `src/site/__tests__/build.test.ts`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### S28: The service worker and its precache

Delivers: `writeServiceWorker(staticDir)` writes a Workbox service worker whose precache holds every page, source file, font, icon and document.
Blocked by: S16, S22, S27, C16 (the chat's `device-index.json`, which the precache lists)
Acceptance:
- `writeServiceWorker(staticDir)` runs `generateSW` from `workbox-build` 7.4.1 over the static folder, and this task adds its call to `scripts/build-site.ts` as step 4, after `addPolicyTags()` (main's decision: in a composition root, the module that provides a step wires it in). The precache lists every prerendered page under its clean address, `404.html`, the JavaScript and CSS, each source's JSON file, the fonts, the icons, the three documents and the chat's `device-index.json` (Offline; Testing 1; the last check moved here from C16).
- `ignoreURLParametersMatching` holds `/^utm_/`, `/^fbclid$/`, `/^source$/`, `/^passage$/` and `/^role$/`. A navigation that is not precached goes to the network first and gets `404.html` only when the network fails; `/api/` is never a navigation fallback (Offline; Testing 1).
- The worker's registration is a script file, not an inline script; a new version installs in the background, takes over on the next visit and shows no prompt (Offline).
Verify: `bun test src/site/__tests__/build.test.ts`; `bun run build:site`; `bun test`
Files: `package.json` and `bun.lock` (`workbox-build`), `src/site/service-worker.ts`, `src/site/register-service-worker.ts`, `src/site/routes/__root.tsx`, `src/site/__tests__/build.test.ts`, `scripts/build-site.ts` (the step-4 call)
Size: M
Needs Peter: no

### S29: Offline after one visit, and installable

Delivers: after one visit, with the network off, the pages, the documents and the workspace addresses load, and Chrome can install the site.
Blocked by: S28, S21, S25
Acceptance:
- After one visit, with the network off, `/`, `/resume`, a source page, the PDF, `/?source=<id>&passage=<n>` and `/?role=<id>` load with no page errors, and a design-system part is upgraded (Testing 2: Offline).
- Offline, a click from a source page to `/` shows the first view, and an unknown path shows the not-found page (Testing 2: Offline).
- The service worker controls the page and the manifest is linked, so Chrome can install the site (Testing 2: Install).
Verify: `bun test src/site`; `bun test`
Files: `src/site/__tests__/browser.test.ts`, and `src/site/service-worker.ts` when a check fails
Size: S
Needs Peter: no

### S30: The speed budget

Delivers: the browser test holds the main content's paint, the layout shift and the first-load JavaScript to Peter's targets.
Blocked by: S29
Acceptance:
- With 4× CPU slowdown and a slow 4G network, the largest content paint on `/` and `/resume` is under 2.5 s, and layout shift is under 0.1 (Testing 2: Speed; row 24).
- From the network log, the JavaScript that `/` loads before any interaction, gzip-compressed, is under 200 KB (Testing 2: Speed).
Verify: `bun test src/site`; `bun test`
Files: `src/site/__tests__/browser.test.ts`, and the code a failing budget points at
Size: S (M when a budget fails)
Needs Peter: no

### S31: The preview answers the API routes

Delivers: `bun run preview` answers `/api/chat`, `/api/status` and `/api/cron/health` through each built function, as Vercel does.
Blocked by: S9, C17 (the route file `src/site/routes/api.chat.ts` with the fake model). It runs right after C17: C18, D21 and every later chat browser test need the preview to answer `/api/chat`.
Acceptance:
- For a path that `config.json` routes to a function, the preview imports that function's `index.mjs` from the output's `functions/` folder and answers with its default export's `fetch(request)` (Commands).
- Against the preview, `POST /api/chat` with a malformed JSON body gets 400 with the chat's `ChatError` shape, and a `POST /api/chat` from the page streams a scripted answer (Commands; SPEC-chat; the second check moved here from C17).
Verify: `bun test src/site`; `bun run build:site && bun run preview`, then `curl -s -X POST -H 'content-type: application/json' -d '{' http://localhost:4173/api/chat`
Files: `scripts/preview-site.ts`, `src/site/__tests__/browser.test.ts`
Size: S
Needs Peter: no

### S32: Citations open the resume and sources on wide screens

Delivers: selecting a citation shows its resume entry or opens its source, the timeline lights the cited roles, each cited resume entry shows its number, and the chat can open the whole resume.
Blocked by: S18, S20, S31, C24 and C25 (numbered citation buttons and the citations card, with a scripted answer in `src/chat/server/__tests__/fixtures.ts` that cites a passage, a highlight, a skills group and a logistics answer), C28 (the resume card and `open_resume`)
Acceptance:
- `setCited(ids)` numbers the ids by position: the timeline lights the role of each `role:` and `highlight:` id and every role in a cited passage's source `roles`, and each cited resume entry shows its number, gray, in memory only (Code Style table; Testing 2: Citations).
- `openCitation(id, n)`: a resume entry of any kind shows in the Resume tab, scrolled into view and tinted, with a blue number; a passage opens its source tab with the passage marked, replacing any open source; a logistics id or an id that no longer exists opens nothing. With a number the panel says "Opened from citation <n>"; without one it says nothing (Code Style table; Views: Document panel; Testing 2: Citations). This is the effect check for the chat's calls from C24 (citation buttons, and `setCited()` after each answer and on restore) and C36 (device matches, with no number).
- `openResume()` shows the Resume tab at its top (Code Style table; the chat's "Can I see his resume?" test, whose call C28 adds).
Verify: `bun test src/site`; `bun test`
Files: `src/site/workspace.ts`, `src/site/shell/DocumentPanel.tsx`, `src/site/shell/ResumeView.tsx`, `src/site/shell/CareerTimeline.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### S33: Citations open sheets on phones

Delivers: on a phone, a passage citation opens the source sheet with "Source for citation 1", a resume citation opens the resume sheet at its entry, and `openResume()` opens the resume sheet at its top.
Blocked by: S32, S24, S25
Acceptance:
- At 390 × 844, a passage citation opens the source sheet with "Source for citation 1" and the passages from the cited one; "All passages" shows every passage (Testing 2: Phones).
- A resume entry citation opens the full-height resume sheet at that entry; `openResume()` opens it at its top (Code Style table: `openCitation`, `openResume`; row 81).
Verify: `bun test src/site`; `bun test`
Files: `src/site/workspace.ts`, `src/site/shell/Sheet.tsx`, `src/site/routes/index.tsx`, `src/site/__tests__/browser.test.ts`
Size: S
Needs Peter: no

### S34: A restored conversation never shows the first view

Delivers: a returning visitor with a saved conversation never sees the first view flash, and on phones New chat takes the download button's place while a conversation exists.
Blocked by: S12, S23, S31, C20 (the restore of the saved conversation, with its `setConversationActive()` calls), C35 (New chat)
Acceptance:
- `setConversationActive(true)` hides the first view's static parts and writes `pk-conversation` `"1"`; `false` removes the flag and the root attribute and shows the first view (Code Style table; Chat column, steps 1 to 4).
- After a scripted answer, a reload never shows the first view's heading, and layout shift stays under 0.1. With `pk-conversation` set and no saved conversation, the first view shows after the chat's check (Testing 2: First view). This is the effect check for C20's restore.
- On phones the app bar's `end` slot holds the download button, then the chat's New chat once a conversation exists; the workspace route puts New chat there (Views: Phones; Testing 2: Phones).
Verify: `bun test src/site`; `bun test`
Files: `src/site/workspace.ts`, `src/site/routes/index.tsx`, `src/site/shell/AppBar.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### S35: New chat clears the saved views

Delivers: a confirmed New chat clears the site's saved views and returns to the first view, and keeps the theme and the install offer's count.
Blocked by: S21, S34, C35 (New chat with its confirmation)
Acceptance:
- `reset()` clears the `views` store with `clearObjectStore`, removes `pk-conversation`, and returns to the first view: the Resume tab, no source, no scope and no cited ids (Code Style table).
- A confirmed New chat empties the `views` store of `peterkloss-views`, removes `pk-conversation`, keeps `theme` and `pk-install`, and deletes no database (Testing 2: Storage). This is the effect check for C35.
Verify: `bun test src/site`; `bun test`
Files: `src/site/saved-views.ts`, `src/site/workspace.ts`, `src/site/__tests__/browser.test.ts`
Size: S
Needs Peter: no

### S36: The install offer on phones

Delivers: on a phone, after the third finished answer, a bottom sheet offers to install the site, at most once every 30 days and never inside the installed app.
Blocked by: S24, S27, S31, C27 (`answerFinished()` once per finished answer, never on a restore or a Retry)
Acceptance:
- `answerFinished()` adds one to `answers` in local storage `pk-install` (`{ "answers": number, "notNowAt": string | null }`). At 390 × 844 the install sheet ("Install Peter Kloss", the address, the three lines, "Not now" and "Install", as the install-offer board shows) appears after the third scripted answer, not before; a restore and a Retry do not count (Install offer; Testing 2: Install offer). This is the effect check for the `answerFinished()` calls of C18 and C27.
- Closing it without an install ("Not now", Escape or a tap outside) writes the day to `notNowAt`, and a fourth answer shows no sheet; with `notNowAt` 31 days old, the next answer shows it. It never shows while the site runs as an app. Where the browser has no install prompt, "Install" shows the steps to add the site to the home screen (Install offer; Testing 2: Install offer).
- axe reports no violation at 390 × 844 with the install sheet open, light and dark (Testing 2: Accessibility).
Verify: `bun test src/site`; `bun test`
Files: `src/site/shell/InstallOffer.tsx`, `src/site/workspace.ts`, `src/site/routes/index.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### S37: Google Sans Code served from the site itself

Delivers: labels, numbers and code use a committed Latin subset of Google Sans Code from the site's own address, as the design system's `--acme-font-mono` and the mockups ask (Peter's row 179).
Blocked by: S7
Acceptance:
- `scripts/site-fonts.ts` also cuts a Latin subset of Google Sans Code, the weights the tokens use, with `harfbuzzjs`, in the same format as the Flex file; the file is committed in `public/fonts/`, and the build copies it and downloads nothing.
- `src/site/styles/fonts.css` names it for `--acme-font-mono`; no output file names a font on another host.
- SPEC-site's Tech Stack names Google Sans Code beside Google Sans Flex; the report gives the file's size and `/`'s first-load size against its budget.
Verify: `bun run scripts/site-fonts.ts`; `bun test src/site/__tests__/build.test.ts`; `bun test`
Files: `scripts/site-fonts.ts`, `public/fonts/` (the cut file), `src/site/styles/fonts.css`, `src/site/__tests__/build.test.ts`, `spec/SPEC-site.md`
Size: S
Needs Peter: no (row 179). The format follows his choice for S7's wording draft before D37.

## Checkpoints

### Checkpoint site: the build output

After S1 to S8, with D16. `bun run build`, `bun run build:site` and `bun test` pass, and seam 1 runs through the build script with a fake-phone fixture root. Peter looks at `/` and `/resume` in `bun run dev` with the app bar, the fonts and the not-found page. The push changes site files, so it is a release.

### Checkpoint site: the wide workspace

After S9 to S22, with D17. The wide workspace works end to end in the browser test: the timeline, the scope, a source from its address, the × on the source tab, the saved views, the theme and the downloads, with no axe violation in light and dark. Peter reviews the running preview at 1440 × 900, light and dark, against the first-view, career-timeline-states and answer-with-source boards (the source half).

### Checkpoint site: phones, offline, install

After S23 to S30. Phones, the icon, the manifest, offline and the speed budget pass; `bun test src/site` passes on a clean checkout with Chrome. Peter reviews the preview at 390 × 844 against the phone boards and the installed-app board.

### Checkpoint site: lands

After S31 to S36, with the chat tasks they name. SPEC-site's Success Criteria: `bun test src/site` passes on a clean checkout with Chrome installed, the chat included, and with it the effect checks for C20, C24, C27, C28, C35 and C36. Peter reviews the running preview against the approved mockups at desktop and phone sizes, in light and dark, and approves it. The site rows of `AGENTS.md`'s Modules table and `spec/README.md` say built, and the fresh-session check passes.
