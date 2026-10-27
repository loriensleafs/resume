# Spec: site

Approved by Peter on 2026-10-27. Amended (the resume view's ⋯ menu, `openResume()`, the optional citation number, the app bar's end slot, the route files as the only place site and chat meet, design-system parts for sheets and the menu) and approved again the same day ([decision record](../docs/design/interview-2026-10-26.md) rows 81 and 85 to 106). Amended again on 2026-10-27 by the approval of [SPEC-deploy](SPEC-deploy.md) (row 127): Nitro's Vercel output, build-time data for the pages, the policy tags, the static not-found page, the service worker's network-first navigations and the committed documents ([decision 0023](../docs/decisions/0023-static-site-build-time-data.md)). Amended on 2026-10-27 after the spec reviews (decision record rows 128 to 136). Approved by Peter with the updated mockups on 2026-10-27 (decision record row 139); the scope label and the texts follow rows 137 and 138.

## Objective

Build the site: the public TanStack Start progressive web app at peterkloss.dev ([decision 0007](../docs/decisions/0007-tanstack-start-pwa.md), [decision 0018](../docs/decisions/0018-domains.md)). It puts the chat first, keeps the resume beside it, opens a source beside the chat when a citation asks for it ([decision 0015](../docs/decisions/0015-sources-on-demand.md)), saves the visitor's views in their own browser ([decision 0017](../docs/decisions/0017-saved-visitor-session.md)), installs as a standalone app, and keeps its pages readable offline ([decision 0010](../docs/decisions/0010-offline-chat.md)). The look is the approved mockups in [docs/design/mockups/](../docs/design/mockups/README.md), built with Peter's ACME design system.

The site is the shell. The chat column's contents belong to the chat module ([SPEC-chat](SPEC-chat.md)): the conversation, the input and its states, the answer steps, the message actions, the citations card, queued questions, "Answers for", New chat and `/api/chat`. The site gives the chat module one contract, the workspace contract (see Code Style). The site's code imports neither the chat module nor the deploy module ([capability map](README.md)). Only these files put the modules together:

- The route files in `src/site/routes/`, at run time. The workspace route renders the chat column. `api.chat.ts` calls the chat's handler ([SPEC-chat](SPEC-chat.md)); `api.status.ts` and `api.cron.health.ts` call the deploy module ([SPEC-deploy](SPEC-deploy.md)).
- `vite.config.ts`, which adds the chat's Vite plugin to the Vite build and holds SPEC-deploy's Nitro `vercel` settings.
- `scripts/build-site.ts`, at build time. SPEC-deploy owns it. It runs the site's `buildSite()` (during whose Vite build the chat's plugin writes `device-index.json`), the deploy module's `addPolicyTags()`, the site's `writeServiceWorker()` and the deploy module's `writeVercelConfig()`, in that order.

Acceptance criteria:

- `bun run build:site` writes Nitro's Vercel output, `.vercel/output/`, in every environment; the pages are in `.vercel/output/static/`. It prerenders `/`, `/resume` and `/sources/<id>` for every approved source, and no other page. Each page reads without JavaScript.
- No page and no server function runs at request time ([decision 0023](../docs/decisions/0023-static-site-build-time-data.md)). Loaders get their data from a module made at build time, so a click between pages needs no server, online or offline. Every other path gets the static not-found page with status 404, apart from the three API routes (see Workspace addresses).
- The build-time module holds the public resume facts and each approved source's id, title and roles. Each source's passages are a separate JSON file, which Vite emits as a hashed file under `/assets/`. A view fetches a source's file only when it shows that source, and the service worker precaches every one. So the JavaScript that `/` loads does not grow with the sources.
- Every HTML file meets SPEC-deploy's Content Security Policy: it starts with its own policy tag, which lists the hashes of its inline scripts, and holds no `style` attribute.
- Every resume fact on the site comes from `resume.yaml` through the content module's loader, `public` variant. Every source text comes from `publicKnowledge(knowledge)`, whose `PublicKnowledge` shape has no `Not public` section ([SPEC-knowledge](SPEC-knowledge.md)). The site never reads the full knowledge. No page copies a fact by hand, and no file holds a private detail.
- No file under `.vercel/output/static/` holds `Not public` text. The chat's function bundle holds it on purpose, because the model receives it on the server ([SPEC-chat](SPEC-chat.md)).
- A source page shows every passage of the source and never its `Not public` section. No page lists the sources for browsing (decision 0015); source pages are reached from citations, the "Open beside the chat" link, the sitemap and shared links.
- On a wide screen the workspace shows the app bar, the career timeline band, the chat column and the document panel, as in the mockups. Below 1024 px it shows one column, and the resume and sources open as sheets.
- Selecting a role on the career timeline sets the chat's scope to it. On wide screens it also shows that role in the resume; on phones the first view names the role, as the phone boards show. A passage citation opens its source with the passage marked. A citation of any resume entry shows that entry in the resume. A logistics citation opens nothing.
- The saved views (the open tab, the open source and its marked passage, and the scope) come back on the next visit, also in the installed app. Blocked or empty browser storage gives a first visit.
- The site installs as a standalone app with the PK icon, named "Peter Kloss", with its start address and scope at `https://peterkloss.dev/`.
- After one visit, `/`, `/resume`, every source page, the workspace addresses with `?source=` or `?role=`, the fonts and the three documents load with no network.
- No WCAG 2.2 AA violation on any view, in light and dark. On a throttled phone profile, the main content is visible in under 2.5 s and layout shift stays under 0.1. JavaScript loaded by `/` before any interaction is under 200 KB compressed. (Peter's targets, [decision record](../docs/design/interview-2026-10-26.md) row 24.)

## Views

The approved mockups are the reference for every view. The image index names each one.

**App bar.** The design system's `acme-app-bar`: a blue box with "Peter Kloss", then the headline (`basics.label`). Its `end` slot holds, on wide screens, "Install app" (secondary button, Chrome's install icon), "Resume" (a menu of the PDF, Word and text documents) and the theme switch.

- **Theme switch.** `acme-theme-switcher`, with the values `auto`, `light` and `dark` and its default labels System, Light and Dark. The page content sits in one `acme-theme` scope. When the switch sends `acme-request` with the action `appearance`, the site sets the switch's `value` and the scope's `appearance`, writes the value to `theme`, and updates the root attribute (see Saved views).
- **Phones.** The name box, and in the `end` slot the download button for the documents. While a conversation exists, the slot holds the chat's New chat instead, as the phone boards show (row 81; [SPEC-chat](SPEC-chat.md)). The workspace route puts New chat in the slot. The documents stay in the resume sheet's ⋯ menu. Phones show no theme switch, as the phone boards show: the page keeps the stored choice, or follows the system's appearance.

**Career timeline band.** Full width under the app bar, headed "Career timeline". On wide screens the line "Select a role to read it and scope the chat" follows the heading (row 50). Every role and earlier role in `resume.yaml` is a span at its true length on a year axis. A gap between roles shows as space. The timeline states board shows each state.

- **Labels.** Each span's label is the role's short name, from a new field `x-short` on each role in `resume.yaml`. The values are the labels of the approved mockups: "Brigham and Women's", "Six Red Marbles", "HBS", "Jack Morton", "Sheridan", "LinkSquares", "Pippin", "FedNow" and "Highspot". SPEC-content adds the field to its schema. A label stays on one line; a label longer than its span ends in an ellipsis ("Jack M…").
- **Hover and focus.** The span darkens, and `acme-tooltip` shows the full employer name, then the title and the years ("Jack Morton Worldwide", "Senior Front-End Engineer, 2016 – 2017").
- **Names.** Each span is a real button. Its accessible name is the full employer name and the years; the tooltip adds the title as its description.
- **Selected and cited.** The selected role is blue with its name in bold. Roles the latest answer cites are blue with their names in normal weight.
- **Phones.** The band scrolls sideways, opens at the latest roles and says "Swipe for earlier roles".

**Chat column.** 560 px wide on wide screens, measured at its outer edge to the document panel's border, as in the desktop boards. Its content sits inside the column's side padding, so the input is about 512 px wide. Full width on phones. The site renders the first view's static parts so the page reads without JavaScript: the heading "Ask about Peter's work.", the line about where answers come from, and the suggested questions. With a role selected, the first view names the role ("Ask about FedNow."), gives its title, employer and dates from `resume.yaml`, offers "Read FedNow in the resume", and shows that role's suggested questions. The suggested questions live in `src/site/suggested-questions.ts`, and Peter approves their wording. Each one is a button. Selecting it sets the workspace's `suggestedQuestion`, which the chat sends. The chat module owns everything else in the column.

The first view never shows before a restored conversation:

1. While a conversation exists, the chat calls `setConversationActive(true)`, and the site keeps the local-storage flag `pk-conversation` (`"1"`).
2. On the next load, the head script (see Saved views) reads the flag before the first paint. When the flag is set, it puts the attribute `data-pk-conversation` on the root element, and the site's stylesheet hides the first view's static parts.
3. The chat reads its saved conversation before its first render and passes `initialMessages` and `threadId` to `useChat` ([SPEC-chat](SPEC-chat.md)).
4. When the chat finds no conversation, it calls `setConversationActive(false)`. The site removes the flag and the attribute, and the first view shows.

**Document panel.** Right of the chat column, with the design system's `acme-tabs`: "Resume", and "Source: <title>" while a source is open. At most one source tab is open, and a new source replaces it. A × after the source tab's title closes the source tab and shows the Resume tab (rows 49 and 54). `acme-tab` is a native button, and the design system has no close control for a tab. So the × is a separately built `acme-icon-button` named "Close source", outside the tab's own button; the plan checks that its place keeps the tab list valid under axe. The panel notes which citation opened the source ("Opened from citation 1").

- **Resume view:** the lead, each role with its highlights, the earlier roles, skills and education, from `resume.yaml`. Each resume entry carries its knowledge id on its element: `basics` on the lead, `role:<id>` on each role's heading, `highlight:<role id>.<n>` on each highlight, `skills:<slug>` on each skills group and `education` on the education entry. Each entry the latest answer cites shows its citation number. The entry that a citation opened is also tinted, and its number is blue; the other cited entries' numbers are gray, with no tint, as in the citations card ([SPEC-chat](SPEC-chat.md)). Hovering or focusing a highlight shows "Ask about this". A ⋯ icon button ("More actions") at the view's top-right corner opens the design system's `acme-menu`: PDF, Word, Text. Each item downloads that public document; the plan checks how a menu item starts a download. The menu appears wherever the resume view does: the Resume tab, the phone resume sheet and `/resume` (Peter, [decision record](../docs/design/interview-2026-10-26.md) row 81; the desktop boards show it).
- **Source view:** the title, a line naming its kind and approval ("Deep dive, written from Peter's answers and approved by him. FedNow, 2021 – 2024. 5 passages."), and the numbered passages. The marked passage is tinted, scrolled into view and shows "Ask about this passage".

**Phone sheets.** Sheets are the design system's `acme-drawer` with `placement="bottom"`: focus moves into the sheet, stays there, Escape or a tap outside closes it, and focus returns to what opened it. Each sheet has a × button ("Close") at its top right. The drawer has no swipe dismissal (design system 0.3.2), so no sheet shows a grab handle.

- **Source sheet**, over the conversation, as the phone source board shows. It says "Source for citation <n>" (nothing there without a number), then the title as the drawer's heading, the kind line, and the passages from the cited one onward, with the cited one marked. Its `footer` slot holds "Ask about this passage" and "All passages". "All passages" shows every passage from the first, and the cited one stays marked.
- **Resume sheet**, full height. It opens at the selected role from "Read FedNow in the resume", at a cited entry from `openCitation()`, or at its top from `openResume()`. It holds the ⋯ menu.

**Phones and the timeline**, as the phone role-selected board shows. Selecting a role sets the scope. The resume does not open on its own. Without a conversation, the first view names the role and offers "Read FedNow in the resume", which opens the resume sheet at the role. With a conversation, the scope chip in the input shows the role ([SPEC-chat](SPEC-chat.md)).

**Install offer.** "Install app" in the app bar appears only when the browser offers installation (`beforeinstallprompt`) and the site is not already running as an app. On phones, a bottom sheet offers the app, as the install-offer board shows: "Install Peter Kloss", the address, three lines (opens on its own, picks up the conversation, readable offline), "Not now" and "Install".

- The chat calls `answerFinished()` once for each finished answer, never for a restore or a Retry. The site adds one to the count in local storage `pk-install`, a JSON string `{ "answers": number, "notNowAt": string | null }`.
- The sheet shows after the third finished answer, at most once per 30 days, and never while the site runs as an app.
- When the sheet closes without an install ("Not now", Escape or a tap outside), the site writes the day to `notNowAt`, which starts the 30 days. After them, the next finished answer shows the sheet again.
- `pk-install` is outside the saved session, so New chat keeps it.
- Where the browser has no install prompt (Safari on iPhone), the sheet's button shows the steps to add the site to the home screen.

**Installed app.** The same site in its own window, with the PK icon and "Peter Kloss" in the title bar.

**App icon.** "PK" in Google Sans Flex Bold, white on the site's blue (`--ds-blue-700`), as a rounded square, plus a maskable version with the letters inside the safe zone.

- `bun run icons` (`scripts/icons.ts`) renders the icon with Chrome, locally, to PNG at 192 and 512 px, the maskable version at 512 px, and the favicon. It writes them to `public/icons/`.
- The icon files are committed, as the documents are, because Vercel's build has no Chrome and Bun's image API reads no SVG. The build copies them.
- A change to the icon and its rendered files go in the same commit.

**Standalone pages.** `/resume` and `/sources/<id>` use the app bar and the same resume and source views, as single pages without the chat column. Each source page links "Ask the chat about this", which opens the workspace with that source open. The canonical address of every page is on `https://peterkloss.dev`.

## Workspace addresses

| Address | Opens |
|---|---|
| `/` | The workspace with the saved views, or the first view |
| `/?source=<source id>&passage=<n>` | The workspace with that source open and the passage marked; this replaces the saved views |
| `/?source=<source id>` | The workspace with that source open at its top and no passage marked; this replaces the saved views |
| `/?role=<role id>` | The workspace with that role selected and the resume at it |
| `/resume` | The standalone resume page |
| `/sources/<source id>` | The standalone source page; each passage has the anchor `#<source id>.<n>` |
| `/Peter-Kloss-Resume.pdf`, `.docx`, `.txt` | The public documents, committed in `documents/` ([SPEC-deploy](SPEC-deploy.md)) |
| `/api/chat`, `/api/status`, `/api/cron/health` | Not pages: the three API routes, which run as functions. SPEC-chat describes `/api/chat`; SPEC-deploy describes the other two |
| Any other path, `/sources/<unknown id>` and other `/api/` paths included | The not-found page, status 404 |

The address follows the view, with `history.replaceState`, so it adds no history entry:

- `/?source=<id>&passage=<n>` while a source is open with a marked passage;
- `/?source=<id>` while a source is open with no marked passage;
- `/?role=<id>` while a role is selected and no source is open;
- `/` otherwise.

So a visitor shares a role or a source by copying the address. An unknown source or role id in a query (`?source=`, `?role=`) gives the first view, not an error. An unknown path, `/sources/<unknown id>` included, gets the not-found page with status 404: "Page not found" with links to the chat and to the resume, and no script. Its wording (Peter, row 138): "404", the heading "Page not found", "There is no page at this address. The link may be mistyped, or the page may have moved.", and the links "Ask the chat about Peter's work" (`/`) and "Read Peter's resume" (`/resume`). It follows the system's light or dark setting, because a page with no script cannot read the visitor's stored theme. A citation to an id that no longer exists shows as plain text (SPEC-knowledge).

## Saved views

The site stores its part of the saved session, the saved views, in IndexedDB through TanStack DB. The site and the chat each own a separate database (Peter, [decision record](../docs/design/interview-2026-10-26.md) row 134):

| Database | Owner | Stores |
|---|---|---|
| `peterkloss-views` | The site | `views` |
| `peterkloss-chat` | The chat ([SPEC-chat](SPEC-chat.md)) | The chat's own stores |

- The site opens `peterkloss-views` once, with `createIndexedDB({ name: "peterkloss-views", version: 1, stores: ["views"] })`, and makes its collection with `indexedDBCollectionOptions`. A new store needs a higher version in that one call.
- Neither module opens the other's database. Nothing calls `deleteDatabase`.
- New chat clears the chat's stores with `clearObjectStore`, then calls `workspace.reset()`, which clears the `views` store in the same way.
- IndexedDB keeps structured values and syncs open tabs. Local storage holds about 5 MB and only strings.

```ts
type SavedViews = {
  version: 1;
  tab: "resume" | "source";
  sourceId: string | null;
  passageId: string | null;
  scope: Scope;
};
```

- The site writes the saved views on every change and reads them before the workspace first renders on the client.
- A stored `version` the site does not know is deleted, and the visit works as a first visit.
- When IndexedDB is blocked or `createIndexedDB` fails, the site keeps the views in memory, and the visit works as a first visit.
- The site asks the browser for persistent storage (`navigator.storage.persist()`) when the app is installed.

**Local storage.** Three small values live outside the saved views. Each read and write catches its own error; blocked local storage reads as no value.

| Key | Holds | Written by | New chat |
|---|---|---|---|
| `theme` | `light`, `dark` or `auto` | The theme switch | Keeps it |
| `pk-conversation` | `"1"` while a conversation exists | `setConversationActive()` | Removes it |
| `pk-install` | The install offer's answer count and the date of its last "Not now" | `answerFinished()` and the install offer | Keeps it |

**The head script.** Each page except the not-found page has one small inline script in its head, right after its policy tag, which allows it by hash ([SPEC-deploy](SPEC-deploy.md)). Before the first paint, the script:

- reads `theme`. For `light` or `dark`, it sets `data-acme-appearance` to that value on the root element. For `auto` or no value, it sets nothing, and the tokens follow the system's appearance. So the page never flashes the wrong theme;
- reads `pk-conversation`, and sets `data-pk-conversation` on the root element when the value is `"1"` (see Chat column).

The design system's token stylesheet reads `:root[data-acme-appearance="light"]` and `:root[data-acme-appearance="dark"]`, and `acme-theme` sets that attribute on itself. The design system documents no way to set the appearance before its parts load. The head script therefore sets the attribute directly; the code names this design-system gap. The not-found page has no script, so it follows the system's appearance.

## Offline

`writeServiceWorker(staticDir)` runs `generateSW` from `workbox-build` over `.vercel/output/static/` ([research 09](../docs/research/09-site-feasibility.md)). It is step 4 of the build script, after the policy tags, so the precache holds each page with its tag. A Bun script replaces the Vite PWA plugin that [decision 0007](../docs/decisions/0007-tanstack-start-pwa.md) names; the decision has an amendment line for it.

- The precache holds:
  - every prerendered page under its clean address, and the not-found page `404.html`;
  - the JavaScript and CSS, and the JSON file of each source;
  - the fonts, the icons and the three documents;
  - the chat's `device-index.json` ([SPEC-chat](SPEC-chat.md)).
- `ignoreURLParametersMatching` lists Workbox's defaults (`/^utm_/`, `/^fbclid$/`) and adds `/^source$/`, `/^passage$/` and `/^role$/`. So `/?source=<id>&passage=<n>` and `/?role=<id>` match the precached `/` offline.
- A navigation to a page that is not precached goes to the network first, and gets the not-found page only when the network fails. Workbox's `navigateFallback` alone would show the not-found page for such a navigation also online, for example for a source page that a release has just added.
- `/api/` is never a navigation fallback.
- The worker's registration is a script file, not an inline script.
- A new version installs in the background and takes over on the next visit. The site shows no update prompt.

The chat's behavior offline is the chat module's ([decision 0010](../docs/decisions/0010-offline-chat.md)).

## Tech Stack

Versions checked on 2026-10-26 ([research 05](../docs/research/05-framework-support.md), [research 09](../docs/research/09-site-feasibility.md)); the plan pins exact versions when it installs them.

- Bun 1.4.4 and TypeScript; Bun APIs for scripts. Vite runs under `bun --bun` ([decision 0004](../docs/decisions/0004-bun-only.md)).
- `react-dom` 19.3.1 and `nitro` 3.0.260903-beta, both pinned to these exact versions. Peter approved both ([decision record](../docs/design/interview-2026-10-26.md) row 135). Nitro's Vercel preset writes `.vercel/output/` ([SPEC-deploy](SPEC-deploy.md)).
  - `nitro` 3.0.260903-beta is a beta. On 2026-10-27 no stable 3.x release exists: npm marks `3.0.0` deprecated, and every other 3.x version is an alpha or a beta. 3.0.260903-beta is the newest, and npm's `latest` tag points to it. Each later bump of `nitro` is reviewed by hand, never through a version range.
- `@tanstack/react-start` 1.169.4 with `@tanstack/react-router` 1.170.46, React 19.3.1, Vite 8.3.5, `@vitejs/plugin-react` 6.1.2. App source in `src/site` (`srcDirectory`), static prerendering with `crawlLinks` and `failOnError`. The prerender settings in `vite.config.ts`:
  - `pages` lists `/`, `/resume` and `/sources/<id>` for each approved source id from `publicKnowledge(knowledge)`. No prerendered page links every source (decision 0015), so link crawling alone would prerender no source page.
  - `prerender.filter` rejects any path with `?`. The crawler strips the query from a page's output path, so a crawled `/?source=` or `/?role=` link would otherwise overwrite `index.html`.
  - TanStack Start adds a crawled page to its page list before the filter runs (`start-plugin-core`, `prerender.js`), and the sitemap is built from that list. So the filter also sets `sitemap: { exclude: true }` on each page it rejects, and the sitemap lists no address with `?`.
- `@acmelabs/design-system-react` 0.3.2 and its tokens. The wrappers support browser rendering only ([decision 0007](../docs/decisions/0007-tanstack-start-pwa.md)), so a part's shadow DOM never renders on the server. During prerender, each part renders as its tag with its light-DOM content: its text and its native elements. In the browser, the element is defined and the part upgrades. The resume and source text is plain semantic HTML styled with the tokens. Research 09 prerendered `<acme-button>` this way and saw it upgrade, and says each part needs the same check ([research 09](../docs/research/09-site-feasibility.md)). Seam 1 checks the tag of each part the pages use, and seam 2 checks its upgrade. Each part is imported on its own, not from one bundle.
- `@tanstack/react-db` 0.5.12 (`@tanstack/db` 0.15.2) for the saved views.
- `workbox-build` 7.4.1 for the service worker.
- Google Sans Flex served from the site itself, a Latin subset of the variable font (weights 400 to 700) cut with `harfbuzzjs`. No request to Google Fonts or any other third party. The cut font files are committed, so the Vercel build downloads nothing.
- Prerendered Markdown renders with `@tanstack/markdown/react`. Its `components` option for `th` and `td` turns a column's alignment into a class, because a `style` attribute breaks the policy.
- Dev: `playwright` (driving Chromium under Bun) and `axe-core` for the browser test.

Approving this spec approves adding these dependencies.

## Commands

```sh
bun install               # first time
bun run dev               # Vite dev server for the site at http://localhost:3000
bun run build:site        # scripts/build-site.ts (SPEC-deploy): buildSite(), the device index, the policy tags, writeServiceWorker(), the routes → .vercel/output/
bun run icons             # renders the app icon and the favicon with Chrome into public/icons/; commit the files
bun run preview           # serves .vercel/output/ at http://localhost:4173 as Vercel does, the API routes included
bun run preview --dir <folder>  # serves the .vercel/output/ in <folder>, as `bun run build:site --out <folder>` writes it (the tests' temporary folder)
bun test src/site       # this module's tests: the build output and the browser test
bun test                  # every test
bun run build             # the documents only, unchanged (content module)
```

`bun run preview` serves the static folder with the routes, headers, `overrides` and status codes of the output's `config.json`, as Vercel does. It answers the three API routes by importing each function's `index.mjs` from the output's `functions/` folder and calling its default export's `fetch(request)`. A local build with Nitro 3.0.260903-beta wrote that export; the plan confirms it when it installs Nitro. Outside production the chat function uses the fake model ([SPEC-chat](SPEC-chat.md)).

## Project Structure

```text
src/site/                    the TanStack Start app (srcDirectory)
src/site/routes/             the route files: __root.tsx, index.tsx (workspace), resume.tsx, sources.$id.tsx;
                             api.chat.ts (described in SPEC-chat); api.status.ts and api.cron.health.ts (described in SPEC-deploy)
src/site/routeTree.gen.ts    the route tree, generated from src/site/routes/ by TanStack Router's plugin inside tanstackStart();
                             committed (TanStack Router's FAQ) and never edited by hand
src/site/shell/              AppBar, CareerTimeline, DocumentPanel, ResumeView, SourceView, Sheet, InstallOffer, ThemeSwitch
src/site/workspace.ts        the workspace contract the chat module reads
src/site/saved-views.ts      the saved views in the IndexedDB database peterkloss-views
src/site/head-script.ts      the inline head script: the theme and the first view's pre-paint flag
src/site/suggested-questions.ts  the first view's suggested questions, overall and per role
src/site/data.ts             the pages' data: a Vite module made at build time from resume.yaml and the PublicKnowledge
                             shape from publicKnowledge(knowledge), never the full knowledge; one lazy JSON file per source
src/site/styles/             tokens import, fonts, layout
src/site/build.ts            buildSite({ root, outDir }): the Vite build with prerendering, documents/ and 404.html
src/site/service-worker.ts   writeServiceWorker(staticDir): Workbox generateSW over the static folder
scripts/build-site.ts        `bun run build:site`: the build-time composition root (owned by SPEC-deploy)
scripts/icons.ts             `bun run icons`: renders the icons with Chrome into public/icons/
scripts/preview-site.ts      `bun run preview [--dir <folder>]`: Bun.serve over `<folder>/.vercel/output/` (default: the repo root's) with the routes of its config.json
public/icons/                the committed icons: 192 px, 512 px, maskable 512 px and the favicon
vite.config.ts               TanStack Start, React, Nitro and prerender settings; adds the chat's Vite plugin
src/site/__tests__/build.test.ts  seam 1: the build output
src/site/__tests__/browser.test.ts  seam 2: the real-browser test
.vercel/output/              site output; ignored by git
```

## Code Style

The same as [SPEC-content](SPEC-content.md): small pure functions, errors that name the file and the field, Bun APIs in scripts. React components are function components, one per file, named for what they show. The workspace contract is the site's whole interface to the chat module:

```ts
/** The role the chat is asking about, from the career timeline. The site fills label and years
 *  from resume.yaml (row 137), so the chat's scope chip needs no lookup: "FedNow", "2021 – 2024". */
export type Scope = { roleId: string; label: string; years: string } | null;

/** What the site gives the chat module. The chat reads it; the site's shell never imports the chat. */
export type Workspace = {
  scope: Scope;
  setScope(scope: Scope): void;
  /** Any resume entry id (basics, role, highlight, skills, education) shows it in the resume;
   *  a passage id opens its source with the passage marked; a logistics id opens nothing. */
  openCitation(id: string, citationNumber?: number): void;
  openResume(): void;
  /** The latest answer's kept citations in order: the id at index i is citation i + 1.
   *  Also called on restore. A passage lights its source's roles on the timeline. */
  setCited(ids: string[]): void;
  askRequest: { id: string } | null;
  clearAskRequest(): void;
  /** A suggested question the visitor selected in the first view; the chat sends it, then clears it. */
  suggestedQuestion: string | null;
  clearSuggestedQuestion(): void;
  /** The chat says whether a conversation exists. The site hides the first view and keeps the pre-paint flag. */
  setConversationActive(active: boolean): void;
  /** One finished answer (not a restore, not Retry); the install offer counts these. */
  answerFinished(): void;
  reset(): Promise<void>;
};

export function useWorkspace(): Workspace;
```

Peter approved this contract on 2026-10-27 ([decision record](../docs/design/interview-2026-10-26.md) row 134). The site implements each member as follows:

| Member | What the site does |
|---|---|
| `scope`, `setScope()` | Holds the selected role, which the saved views keep, with the role's `x-short` label and its years (row 137). Only the timeline sets a scope; a request for the whole resume sets none. On wide screens, a role set from the timeline also shows in the resume. `setScope(null)` clears the selection on the timeline |
| `openCitation(id, n)` | A resume entry id (`basics`, `role:<id>`, `highlight:<role id>.<n>`, `skills:<slug>`, `education`): the resume shows that entry, scrolled into view and tinted, in the Resume tab on wide screens and in the full-height resume sheet on phones. A passage id: its source opens with the passage marked, in the source tab on wide screens and in the source sheet on phones. A logistics id, or an id that no longer exists: nothing opens. With a number, the panel says "Opened from citation <n>" and the phone sheet says "Source for citation <n>". Without a number (a device match), neither line shows |
| `openResume()` | The whole resume at its top: the Resume tab on wide screens, the full-height resume sheet on phones (row 81) |
| `setCited(ids)` | The id at index i is citation i + 1. The timeline lights the role of each `role:` and `highlight:` id, and every role in a cited passage's source `roles`. Each cited resume entry shows its citation number. The numbers live in memory only; the chat calls `setCited()` again on restore |
| `askRequest`, `clearAskRequest()` | "Ask about this" on a resume highlight or a passage sets `{ id }` to that knowledge id. The chat takes the request and clears it |
| `suggestedQuestion`, `clearSuggestedQuestion()` | Selecting a suggested question in the first view sets its text. The chat sends it, then clears it |
| `setConversationActive(active)` | `true` hides the first view's static parts and writes `pk-conversation` (`"1"`) to local storage. `false` removes the flag and shows the first view. On phones it also switches the app bar's end slot between the download button and New chat |
| `answerFinished()` | Adds one to the answer count in local storage `pk-install`, which the install offer reads |
| `reset()` | Clears the site's `views` store with `clearObjectStore`, removes `pk-conversation`, and returns to the first view: the Resume tab, no source, no scope and no cited ids. The theme and `pk-install` stay |

- Every visible string sits in the component that shows it, in plain English; ids come from SPEC-knowledge.
- Layout uses the design system's tokens and parts. A style override of a design-system part goes on a plain wrapper element and names the design-system gap it covers.
- Motion respects `prefers-reduced-motion`.

## Testing Strategy

`bun test`, at the two seams Peter confirmed on 2026-10-26 ([decision record](../docs/design/interview-2026-10-26.md) row 23):

1. **The build output.** `scripts/build-site.ts` ([SPEC-deploy](SPEC-deploy.md)) runs its five steps once into a temporary output folder, with a fixture `private.yaml` that holds a fake phone number. The tests read the files:
   - `/`, `/resume` and one page per approved source exist; no page for a draft source. No HTML file comes from a path with `?`, and the sitemap lists no address with `?`.
   - Every resume entry appears as text in `/` and `/resume`, with its knowledge id on its element: `basics`, each `role:`, each `highlight:`, each `skills:` group and `education`. Every passage of a source appears on its page with its anchor. Its `Not public` text appears in no file under the output's `static/` folder; the chat's function bundle holds it on purpose.
   - Each timeline span's label is its role's `x-short` value, and its button name holds the full employer name and the years.
   - No file under the output holds the fake phone number.
   - The web manifest has the name, `start_url` `/`, `scope` `/`, `display` `standalone`, and PNG icons of 192, 512 and maskable 512 px. The icon files in the output are the committed files from `public/icons/`, at those sizes.
   - The service worker's precache lists every page under its clean address, `404.html`, each source's JSON file, `device-index.json`, the fonts, the icons and the three documents. Its `ignoreURLParametersMatching` holds `source`, `passage` and `role` beside Workbox's defaults.
   - Each design-system part the pages use appears in the prerendered HTML as its tag, with its light-DOM text. No page holds a declarative shadow root (`<template shadowrootmode`).
   - Each HTML file starts with a policy tag that lists exactly the hashes of its own inline scripts. Each page except `404.html` holds the head script right after its policy tag. No file holds a `style=` attribute.
   - The not-found page `404.html` exists and has no script.
   - Each page has a title, a description, a canonical address on `https://peterkloss.dev`, and Open Graph tags; the sitemap lists every page.
2. **One real-browser test.** Playwright drives Chromium under Bun against `bun run preview --dir <folder>`, where `<folder>` is the one seam 1 built into with `bun run build:site --out <folder>`. So the test builds first and passes on a clean checkout. The chat's scripted answers come from the preview's fake model ([SPEC-chat](SPEC-chat.md)).
   - **Accessibility.** axe-core reports no WCAG 2.2 AA violation, in light and dark, on `/`, `/resume`, a source page and the workspace with a source open, at 1440 × 900 and 390 × 844. At 390 × 844 also with the source sheet, the resume sheet, the ⋯ menu and the install sheet open.
   - **Speed.** With 4× CPU slowdown and a slow 4G network: the largest content paint on `/` and `/resume` is under 2.5 s, and layout shift is under 0.1. From the network log, the JavaScript that `/` loads before any interaction, gzip-compressed, is under 200 KB.
   - **Design-system parts.** After load, each part the pages use is defined and upgraded, with its shadow root.
   - **Wide screens.** Selecting a role shows it in the resume, sets the scope and puts `/?role=<id>` in the address. `/?source=<id>&passage=<n>` opens the source with the passage marked; `/?source=<id>` opens it with no passage marked. The source tab's × shows the Resume tab and takes `source` out of the address. A reload restores the tab, the source, the passage and the scope.
   - **Citations.** A scripted answer that cites a passage, a highlight, a skills group and a logistics answer: the passage's source roles and the highlight's role light up on the timeline; each cited resume entry shows its number; the opened entry is tinted; the logistics citation opens nothing.
   - **First view.** After a scripted answer, a reload never shows the first view's heading, and layout shift stays under 0.1. With `pk-conversation` set and no saved conversation, the first view shows after the chat's check.
   - **Storage.** With IndexedDB blocked (an init script makes `indexedDB.open` throw), the workspace shows the first view and works, with no page error. A saved-views record with an unknown `version` is deleted, and the visit is a first visit. A confirmed New chat empties the `views` store of `peterkloss-views`, removes `pk-conversation`, keeps `theme` and `pk-install`, and deletes no database.
   - **Theme.** The switch shows System, Light and Dark. The dark theme survives a reload, set on the page before its first paint. The not-found page follows the emulated system appearance.
   - **Phones, at 390 × 844.** One column. The timeline scrolls sideways and opens at the latest roles. Selecting a role sets the scope, names the role in the first view, and leaves the resume closed; "Read FedNow in the resume" opens the resume sheet at the role. A passage citation opens the source sheet with "Source for citation 1" and the passages from the cited one; "All passages" shows every passage. The app bar's end slot shows the download button, then New chat once a conversation exists, and no theme switch.
   - **Sheets.** Opening a sheet moves focus into it; Tab stays inside it; Escape closes it; focus returns to what opened it.
   - **Install offer.** At 390 × 844, the install sheet shows after the third scripted answer, not before. A restore and a Retry do not count. "Not now" writes `notNowAt`, and a fourth answer shows no sheet. With `notNowAt` 31 days old, the next answer shows the sheet.
   - **Downloads.** The resume view's ⋯ menu lists PDF, Word and Text, and each item fetches its document with a success status.
   - **Offline.** After one visit, with the network off, `/`, `/resume`, a source page, the PDF, `/?source=<id>&passage=<n>` and `/?role=<id>` load with no page errors, and a design-system part is upgraded. A click from a source page to `/` shows the first view, and an unknown path shows the not-found page.
   - **Policy.** On every page it visits, the test fails on any request to `/_serverFn/`, and on any Content Security Policy violation.
   - **Install.** The service worker controls the page and the manifest is linked, so Chromium can install the site.

## Boundaries

- **Always:** take every fact from `resume.yaml` and `publicKnowledge(knowledge)`. Build to the approved mockups. Keep every page readable without JavaScript. Use the glossary's words and SPEC-knowledge's ids. Run `bun run typecheck`, `bun run build`, `bun run build:site` and `bun test` before a commit.
- **Ask first:** a dependency not named in this spec; a change from the approved mockups; the wording of the suggested questions; a change to the workspace contract, because the chat module depends on it; any request to a third party (fonts, analytics, scripts).
- **Never:** put private details in any output, or a source's `Not public` text in any file under `.vercel/output/static/`. Add a list of sources to browse. Store anything that identifies a visitor on a server (the chat's anonymous question log is [decision 0020](../docs/decisions/0020-anonymous-question-log.md)). Render a design-system part's shadow DOM on the server; the prerender writes only its tag and light-DOM content. Run a page or a server function at request time. Add Node or Python tooling. Commit `dist/` or `.vercel/`.

## User Stories

1. As a recruiter, I want to ask a question the moment the site opens, so that I get to what I need without reading the whole resume.
2. As a recruiter, I want the resume beside the chat, so that I can check an answer against it.
3. As a recruiter skimming, I want the resume readable without asking anything, so that the chat never stands between me and the facts.
4. As a hiring manager, I want to see Peter's career as a timeline at true lengths, so that I see how long he stayed where.
5. As a hiring manager, I want to select a role and ask about it, so that answers stay on the role I care about.
6. As a visitor, I want the roles an answer cites to light up on the timeline, so that I see where in his career the answer comes from.
7. As an engineer, I want a citation to open the source beside the chat with the passage marked, so that I read the exact words behind a claim.
8. As an engineer, I want to ask about a passage I am reading, so that I can go deeper from the source itself.
9. As a visitor, I want to close the source tab, so that the panel goes back to the resume.
10. As a visitor on a phone, I want sources and the resume in sheets, so that I keep my place in the conversation.
11. As a visitor on a phone, I want to swipe the timeline, so that earlier roles stay reachable on a narrow screen.
12. As a returning visitor, I want the site to reopen the source and role I left, so that I continue where I stopped.
13. As a visitor in a private window, I want the site to work as a first visit, so that blocked storage never breaks it.
14. As a visitor, I want to download the resume as PDF, Word or text from the resume itself, so that I can file it in my own system.
15. As a visitor, I want light, dark or my system's theme, so that the site is comfortable to read.
16. As a visitor who chose dark, I want no white flash on load, so that the choice feels kept.
17. As a frequent visitor, I want to install the site as an app, so that it opens on its own from my home screen or dock.
18. As an iPhone visitor, I want the steps to add the site to my home screen, so that I can install it without a browser prompt.
19. As a visitor who said "Not now", I want the install offer to stay away for a while, so that it does not nag.
20. As a visitor on a train, I want the resume, sources and documents offline after one visit, so that a lost connection does not stop me reading.
21. As a screen-reader user, I want real buttons, headings and landmarks, so that I can move through the timeline, tabs and sheets.
22. As a keyboard user, I want every timeline span, tab and sheet reachable and visible on focus, so that I never need a mouse.
23. As a visitor who prefers reduced motion, I want no sliding or shimmering, so that the site stays still.
24. As a visitor on a slow phone, I want the page visible in under 2.5 s without jumps, so that the first impression is fast.
25. As a recruiter, I want to share a link to a role or a source, so that a colleague sees the same thing.
26. As a colleague who opens a shared source link without the app, I want a readable page, so that the link works anywhere.
27. As a search engine, I want each page prerendered with a title, description and canonical address, so that I can index Peter's work.
28. As a recruiter pasting the link in a message, I want a share preview, so that the link looks trustworthy.
29. As the chat module, I want one workspace contract, so that I can scope questions, open citations and reset views without knowing the site's insides.
30. As Peter, I want every page built from `resume.yaml` and the approved sources, so that the site never drifts from my documents.
31. As Peter, I want private details and `Not public` text kept out of every file a browser can load, so that nothing leaks through the site.
32. As Peter, I want nothing that identifies a visitor on a server, so that the site respects visitors' privacy.
33. As Peter, I want no third-party requests, so that the site works offline and leaks no visits.
34. As a future agent, I want the build-output and browser tests to name what broke, so that I fix the cause.
35. As the chat module, I want to open the whole resume beside the chat, so that a visitor who asks for the resume reads it at once.
36. As a returning visitor, I want my conversation to appear without the first view showing first, so that the page does not jump.
37. As a recruiter, I want short employer names on the timeline, and the full name, title and years on hover or focus, so that the band stays readable and the details are one step away.
38. As a visitor, I want the address to follow the open source or the selected role, so that I can copy it and share what I see.
39. As a visitor offline, I want a `/?source=` or `/?role=` link to open from the cache, so that a saved link works without a network.
40. As a visitor, I want a citation of a role, a skills group, education or the lead to show that entry in the resume, so that I can check every kind of fact.
41. As a visitor, I want each cited resume entry to show its citation number, so that I can match the answer to the resume.
42. As a visitor, I want one tap on a suggested question to send it, so that I start at once.
43. As a phone visitor, I want "All passages" in the source sheet, so that I can read the whole source after the cited passage.
44. As a phone visitor who selects a role, I want the resume to stay closed until I ask for it, so that I stay in the chat.
45. As a phone visitor, I want the install offer only after three answers, so that it comes when I know the site is useful.
46. As a visitor on a slow phone, I want the first JavaScript to stay small as sources are added, so that the site stays fast.
47. As Peter, I want the site and the chat to keep separate databases, so that a change in one module never breaks the other's saved data.
48. As a future agent, I want the icons committed as the documents are, so that the Vercel build needs no Chrome.

## Out of scope

- Everything inside the chat column apart from the first view's static text, and `/api/chat`: [SPEC-chat](SPEC-chat.md). That includes New chat, which calls the workspace's `reset()`.
- `/api/status`, `/api/cron/health` and the build script `scripts/build-site.ts`: [SPEC-deploy](SPEC-deploy.md).
- The domains, redirects, hosting settings, security headers (which enforce "no third-party requests"), rate limits and CI: [SPEC-deploy](SPEC-deploy.md).
- A page or menu that lists the sources ([decision 0015](../docs/decisions/0015-sources-on-demand.md)).
- Accounts, server-side storage of visitors and analytics.
- An update prompt for a new site version.
- Languages other than English.
- Cards inside answers: the chat module owns answers, and its only card is the resume card (decision record rows 63 and 81).

## Prior-art tests

- `src/__tests__/build.test.ts`: runs `build()` into a temporary folder and checks the real files. Seam 1 follows it with the build script's five steps.
- `src/knowledge/__tests__/build.test.ts`: fixture `private.yaml` with a fake phone number, and checks that it reaches no output.
- The offline check in [research 09](../docs/research/09-site-feasibility.md): Playwright in Chromium under Bun, network off after one visit. Seam 2 grows from it.

## Success Criteria

- `bun test src/site` passes on a clean checkout with Chrome installed. It builds its own output first, so it needs no earlier `.vercel/output/`.
- Peter reviews the running preview against the approved mockups at desktop and phone sizes, in light and dark, and approves it.

## Open Questions

None for this spec. For the plan: the font file format (WOFF2 needs an encoder package, which needs Peter's approval; WOFF needs none).
