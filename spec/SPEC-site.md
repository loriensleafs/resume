# Spec: site

Approved by Peter on 2026-10-27. Amended (the resume view's ⋯ menu, `openResume()`, the optional citation number, the app bar's end slot, the route files as the only place site and chat meet, design-system parts for sheets and the menu) and approved again the same day ([interview record](../docs/design/interview-2026-10-26.md) rows 81 and 85 to 106). Amended again on 2026-10-27 by the approval of [SPEC-deploy](SPEC-deploy.md) (row 127): Nitro's Vercel output, build-time data for the pages, the policy tags, the static not-found page, the service worker's network-first navigations and the committed documents ([decision 0023](../docs/decisions/0023-static-site-build-time-data.md)).

## Objective

Build the site: the public TanStack Start progressive web app at peterkloss.dev ([decision 0007](../docs/decisions/0007-tanstack-start-pwa.md), [decision 0018](../docs/decisions/0018-domains.md)). It puts the chat first, keeps the resume beside it, opens a source beside the chat when a citation asks for it ([decision 0015](../docs/decisions/0015-sources-on-demand.md)), saves the visitor's views in their own browser ([decision 0017](../docs/decisions/0017-saved-visitor-session.md)), installs as a standalone app, and keeps its pages readable offline ([decision 0010](../docs/decisions/0010-offline-chat.md)). The look is the approved mockups in [docs/design/mockups/](../docs/design/mockups/README.md), built with Peter's ACME design system.

The site is the shell. The chat column's contents belong to the chat module ([SPEC-chat](SPEC-chat.md)): the conversation, the input and its states, the answer steps, the message actions, the citations card, queued questions, "Answers for", New chat and `/api/chat`. The site gives the chat module one contract, the workspace contract (see Code Style). The site's shell, workspace and data code never import the chat module. Only the route files in `src/site/routes/` put the two together: the workspace route renders the chat column, and the `/api/chat` route calls the chat's handler ([capability map](README.md)).

Acceptance criteria:

- `bun run build:site` writes Nitro's Vercel output, `.vercel/output/`, in every environment; the pages are in `.vercel/output/static/`. It prerenders `/`, `/resume` and `/sources/<id>` for every approved source. Each page reads without JavaScript.
- No page and no server function runs at request time ([decision 0023](../docs/decisions/0023-static-site-build-time-data.md)). Loaders get their data from a module made at build time, so a click between pages needs no server, online or offline. Every other path gets the static not-found page with status 404.
- Every HTML file meets SPEC-deploy's Content Security Policy: it starts with its own policy tag, which lists the hashes of its inline scripts, and holds no `style` attribute.
- Every resume fact on the site comes from `resume.yaml` through the content module's loader, `public` variant. Every source text comes from `buildKnowledge()`. No page copies a fact by hand, and no file holds a private detail.
- A source page shows every passage of the source and never its `Not public` section. No page lists the sources for browsing (decision 0015); source pages are reached from citations, the "Open beside the chat" link, the sitemap and shared links.
- On a wide screen the workspace shows the app bar, the career timeline band, the chat column and the document panel, as in the mockups. Below 1024 px it shows one column, and the resume and sources open as sheets.
- Selecting a role on the career timeline shows that role in the resume and sets the chat's scope to it. A citation opens its source in the document panel with the passage marked, or shows the cited highlight in the resume.
- The saved views (the open tab, the open source and its marked passage, and the scope) come back on the next visit, also in the installed app. Blocked or empty browser storage gives a first visit.
- The site installs as a standalone app with the PK icon, named "Peter Kloss", with its start address and scope at `https://peterkloss.dev/`.
- After one visit, `/`, `/resume`, every source page, the fonts and the three documents load with no network.
- No WCAG 2.2 AA violation on any view, in light and dark. On a throttled phone profile, the main content is visible in under 2.5 s and layout shift stays under 0.1. JavaScript loaded by `/` before any interaction is under 200 KB compressed. (Peter's targets, [interview record](../docs/design/interview-2026-10-26.md) row 24.)

## Views

The approved mockups are the reference for every view. The image index names each one.

**App bar.** A blue box with "Peter Kloss", then the headline (`basics.label`). At the end: "Install app" (secondary button, Chrome's install icon), "Resume" (a menu of the PDF, Word and text documents), and a three-way theme switch: system, light, dark. On phones: the name box and a download button for the documents. The app bar has an end slot that the workspace route fills with the chat's New chat on phones ([SPEC-chat](SPEC-chat.md)).

**Career timeline band.** Full width under the app bar, headed "Career timeline". Every role and earlier role in `resume.yaml` is a span at its true length on a year axis, with its employer name on one line. The selected role is blue with its name in bold; roles the latest answer cites are blue with their names in normal weight. On phones the band scrolls sideways, opens at the latest roles and says "Swipe for earlier roles". Each span is a real button with the employer and dates as its name.

**Chat column.** 560 px wide on wide screens, full width on phones. The site renders the first view's static parts so the page reads without JavaScript: the heading "Ask about Peter's work.", the line about where answers come from, and the suggested questions. With a role selected, the first view names the role ("Ask about FedNow."), gives its title, employer and dates from `resume.yaml`, offers "Read FedNow in the resume", and shows that role's suggested questions. The suggested questions live in `src/site/suggested-questions.ts`, and Peter approves their wording. The chat module owns everything else in the column.

**Document panel.** Right of the chat column, with design-system tabs: "Resume", and "Source: <title>" while a source is open. The source tab has a × in the tab to close it; at most one source tab is open, and a new source replaces it. The panel notes which citation opened the source ("Opened from citation 1").

- **Resume view:** the lead, each role with its highlights, the earlier roles, skills and education, from `resume.yaml`. Each highlight carries its knowledge id. A cited highlight is tinted and shows its citation number. Hovering or focusing a highlight shows "Ask about this". A ⋯ icon button ("More actions") at the view's top-right corner opens the design system's `acme-menu`: PDF, Word, Text. Each item downloads that public document; the plan checks how a menu item starts a download. The menu appears wherever the resume view does: the Resume tab, the phone resume sheet and `/resume` (Peter, [interview record](../docs/design/interview-2026-10-26.md) row 81; the mockups do not show it yet).
- **Source view:** the title, a line naming its kind and approval ("Deep dive, written from Peter's answers and approved by him. FedNow, 2021 – 2024. 5 passages."), and the numbered passages. The marked passage is tinted, scrolled into view and shows "Ask about this passage".

**Phone sheets.** Sheets are the design system's `acme-drawer` with `placement="bottom"`: focus moves into the sheet, stays there, Escape closes it, and focus returns to what opened it. A source opens as a bottom sheet over the conversation with the cited passage first ("Source for citation 1", "Ask about this passage", "All passages"). The resume opens as a full-height sheet at the selected role ("Read FedNow in the resume"), or at its top when the chat opens it.

**Install offer.** "Install app" in the app bar appears only when the browser offers installation (`beforeinstallprompt`) and the site is not already running as an app. On phones, after the visitor's third answer, a sheet offers the app once ("Install Peter Kloss": opens on its own, picks up the conversation, readable offline; "Not now" and "Install"). "Not now" hides it for 30 days. Where the browser has no install prompt (Safari on iPhone), the sheet's button shows the steps to add the site to the home screen.

**Installed app.** The same site in its own window, with the PK icon and "Peter Kloss" in the title bar.

**App icon.** "PK" in Google Sans Flex Bold, white on the site's blue (`--ds-blue-700`), as a rounded square, plus a maskable version with the letters inside the safe zone. The build renders it to PNG at 192 and 512 px, and to the favicon.

**Standalone pages.** `/resume` and `/sources/<id>` use the app bar and the same resume and source views, as single pages without the chat column. Each source page links "Ask the chat about this", which opens the workspace with that source open. The canonical address of every page is on `https://peterkloss.dev`.

## Workspace addresses

| Address | Opens |
|---|---|
| `/` | The workspace with the saved views, or the first view |
| `/?source=<source id>&passage=<n>` | The workspace with that source open and the passage marked; this replaces the saved views |
| `/?role=<role id>` | The workspace with that role selected and the resume at it |
| `/resume` | The standalone resume page |
| `/sources/<source id>` | The standalone source page; each passage has the anchor `#<source id>.<n>` |
| `/Peter-Kloss-Resume.pdf`, `.docx`, `.txt` | The public documents, committed in `documents/` ([SPEC-deploy](SPEC-deploy.md)) |
| Any other path, `/sources/<unknown id>` included | The not-found page, status 404 |

An unknown source or role id in a query (`?source=`, `?role=`) gives the first view, not an error. An unknown path, `/sources/<unknown id>` included, gets the not-found page with status 404: "Page not found" with links to the chat and to the resume, and no script. Peter approves its wording. A citation to an id that no longer exists shows as plain text (SPEC-knowledge).

## Saved views

The site stores its part of the saved session in IndexedDB through TanStack DB (`createIndexedDB` and `indexedDBCollectionOptions`), in the database `peterkloss`. The chat module adds its own collections to the same database. IndexedDB holds a long conversation, keeps structured values, and syncs open tabs; local storage holds about 5 MB and only strings.

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
- The theme choice is not part of the saved session, so New chat keeps it. It lives in local storage under `theme`, and a small script in the page head applies it before the first paint, so the page never flashes the wrong theme.
- The site asks the browser for persistent storage (`navigator.storage.persist()`) when the app is installed.

## Offline

A Bun script runs `generateSW` from `workbox-build` on `.vercel/output/static/` after the Vite build ([research 09](../docs/research/09-site-feasibility.md)). The precache holds every prerendered page under its clean address, the not-found page, the JavaScript and CSS, the fonts, the icons and the three documents. A navigation to a page that is not precached goes to the network first, and gets the not-found page only when the network fails. Workbox's `navigateFallback` alone would show the not-found page for such a navigation also online, for example for a source page that a release has just added. `/api/` is never a navigation fallback. The worker's registration is a script file, not an inline script. A new version installs in the background and takes over on the next visit; the site shows no update prompt. The chat's behavior offline is the chat module's ([decision 0010](../docs/decisions/0010-offline-chat.md)).

## Tech Stack

Versions checked on 2026-10-26 ([research 05](../docs/research/05-framework-support.md), [research 09](../docs/research/09-site-feasibility.md)); the plan pins exact versions when it installs them.

- Bun 1.4.2 and TypeScript; Bun APIs for scripts. Vite runs under `bun --bun` ([decision 0004](../docs/decisions/0004-bun-only.md)).
- `@tanstack/react-start` 1.169.4 with `@tanstack/react-router` 1.170.46, React 19.3.1, Vite 8.3.5, `@vitejs/plugin-react` 6.1.2. App source in `src/site` (`srcDirectory`), static prerendering with `crawlLinks` and `failOnError`.
- `@acmelabs/design-system-react` 0.3.2 and its tokens. Its parts render in the browser only ([decision 0007](../docs/decisions/0007-tanstack-start-pwa.md)): prerendered pages hold plain semantic HTML styled with the design system's tokens, and the parts upgrade after load. Each part is imported on its own, not from one bundle.
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
bun run build:site        # copies documents/; Vite build with prerendering, icons, fonts, service worker, policy tags, the not-found page and the routes → .vercel/output/
bun run preview           # serves .vercel/output/ at http://localhost:4173 with its routes, headers and status codes, as Vercel does
bun test tests/site       # this module's tests: the build output and the browser test
bun test                  # every test
bun run build             # the documents only, unchanged (content module)
```

## Project Structure

```text
src/site/                    the TanStack Start app (srcDirectory)
src/site/routes/             __root.tsx, index.tsx (workspace), resume.tsx, sources.$id.tsx
src/site/shell/              AppBar, CareerTimeline, DocumentPanel, ResumeView, SourceView, Sheet, InstallOffer, ThemeSwitch
src/site/workspace.ts        the workspace contract the chat module reads
src/site/saved-views.ts      the saved views in IndexedDB
src/site/suggested-questions.ts  the first view's suggested questions, overall and per role
src/site/data.ts             the pages' data: a Vite module made at build time from resume.yaml and buildKnowledge(), public text only
src/site/styles/             tokens import, fonts, layout
src/site/build.ts            buildSite({ root, outDir }): the module's one entry point
scripts/build-site.ts        `bun run build:site`: a thin wrapper around buildSite()
scripts/preview-site.ts      `bun run preview`: Bun.serve over .vercel/output/ with the routes of its config.json
vite.config.ts               TanStack Start, React and prerender settings
tests/site/build.test.ts     seam 1: the build output
tests/site/browser.test.ts   seam 2: the real-browser test
.vercel/output/              site output; ignored by git
```

## Code Style

The same as [SPEC-content](SPEC-content.md): small pure functions, errors that name the file and the field, Bun APIs in scripts. React components are function components, one per file, named for what they show. The workspace contract is the site's whole interface to the chat module:

```ts
/** The role the chat is asking about, from the career timeline. */
export type Scope = { roleId: string } | null;

/** What the site gives the chat module. The chat reads it; the site's shell never imports the chat. */
export type Workspace = {
  scope: Scope;
  setScope(scope: Scope): void;
  /** A passage id opens its source beside the chat with the passage marked; a resume entry id shows it in the resume.
   *  Without a number (a device match), the panel shows no "Opened from citation" note. */
  openCitation(id: string, citationNumber?: number): void;
  /** The whole resume at its top: the Resume tab on wide screens, the full-height sheet on phones (row 81). */
  openResume(): void;
  /** The latest answer's citations: their roles light up on the timeline and their highlights in the resume. */
  setCited(ids: string[]): void;
  /** "Ask about this" on a resume highlight or a passage; the chat takes the request and clears it. */
  askRequest: { id: string } | null;
  clearAskRequest(): void;
  /** New chat: the saved views go back to the first view. */
  reset(): Promise<void>;
};

export function useWorkspace(): Workspace;
```

- Every visible string sits in the component that shows it, in plain English; ids come from SPEC-knowledge.
- Layout uses the design system's tokens and parts. A style override of a design-system part goes on a plain wrapper element and names the design-system gap it covers.
- Motion respects `prefers-reduced-motion`.

## Testing Strategy

`bun test`, at the two seams Peter confirmed on 2026-10-26 ([interview record](../docs/design/interview-2026-10-26.md) row 23):

1. **The build output.** `buildSite()` runs once into a temporary folder, with a fixture `private.yaml` that holds a fake phone number. The tests read the files:
   - `/`, `/resume` and one page per approved source exist; no page for a draft source.
   - Every highlight in `resume.yaml` appears as text in `/` and `/resume`, with its knowledge id on its element. Every passage of a source appears on its page with its anchor; its `Not public` text appears in no file.
   - No file under the output holds the fake phone number.
   - The web manifest has the name, `start_url` `/`, `scope` `/`, `display` `standalone`, and PNG icons of 192, 512 and maskable 512 px.
   - The service worker's precache lists every page under its clean address, the not-found page, the fonts, the icons and the three documents.
   - Each HTML file starts with a policy tag that lists exactly the hashes of its own inline scripts, and no file holds a `style=` attribute.
   - The not-found page `404.html` exists and has no script.
   - The JavaScript that `/` loads before interaction, gzip-compressed, is under 200 KB.
   - Each page has a title, a description, a canonical address on `https://peterkloss.dev`, and Open Graph tags; the sitemap lists every page.
2. **One real-browser test.** Playwright drives Chromium under Bun against `bun run preview`:
   - axe-core reports no WCAG 2.2 AA violation on `/`, `/resume`, a source page and the workspace with a source open, at 1440 × 900 and 390 × 844, in light and dark.
   - With 4× CPU slowdown and a slow 4G network: the largest content paint on `/` and `/resume` is under 2.5 s, and layout shift is under 0.1.
   - Selecting a role on the timeline shows it in the resume and sets the scope. `/?source=<id>&passage=<n>` opens the source with the passage marked. A reload restores the tab, the source, the passage and the scope.
   - The dark theme survives a reload, set on the page before its first paint.
   - The resume view's ⋯ menu lists PDF, Word and Text, and each item fetches its document with a success status.
   - After one visit, with the network off, `/`, `/resume`, a source page and the PDF load with no page errors, and a design-system part is upgraded. A click from a source page to `/` shows the first view, and an unknown path shows the not-found page.
   - On every page it visits, the test fails on any request to `/_serverFn/`, and on any Content Security Policy violation.
   - The service worker controls the page and the manifest is linked, so Chromium can install the site.

## Boundaries

- **Always:** take every fact from `resume.yaml` and `buildKnowledge()`. Build to the approved mockups. Keep every page readable without JavaScript. Use the glossary's words and SPEC-knowledge's ids. Run `bun run build`, `bun run build:site` and `bun test` before a commit.
- **Ask first:** a dependency not named in this spec; a change from the approved mockups; the wording of the suggested questions; a change to the workspace contract, because the chat module depends on it; any request to a third party (fonts, analytics, scripts).
- **Never:** put private details or a source's `Not public` text in any output. Add a list of sources to browse. Store anything that identifies a visitor on a server (the chat's anonymous question log is [decision 0020](../docs/decisions/0020-anonymous-question-log.md)). Server-render design-system parts. Run a page or a server function at request time. Add Node or Python tooling. Commit `dist/` or `.vercel/`.

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
31. As Peter, I want private details and `Not public` text kept out of every output, so that nothing leaks through the site.
32. As Peter, I want nothing that identifies a visitor on a server, so that the site respects visitors' privacy.
33. As Peter, I want no third-party requests, so that the site works offline and leaks no visits.
34. As a future agent, I want the build-output and browser tests to name what broke, so that I fix the cause.
35. As the chat module, I want to open the whole resume beside the chat, so that a visitor who asks for the resume reads it at once.

## Out of scope

- Everything inside the chat column apart from the first view's static text, and `/api/chat`: [SPEC-chat](README.md). That includes New chat, which calls the workspace's `reset()`.
- The domains, redirects, hosting settings, security headers (which enforce "no third-party requests"), rate limits and CI: [SPEC-deploy](SPEC-deploy.md).
- A page or menu that lists the sources ([decision 0015](../docs/decisions/0015-sources-on-demand.md)).
- Accounts, server-side storage of visitors and analytics.
- An update prompt for a new site version.
- Languages other than English.
- Cards inside answers: the chat module owns answers, and its only card is the resume card (interview rows 63 and 81).

## Prior-art tests

- `tests/content/build.test.ts`: runs `build()` into a temporary folder and checks the real files. Seam 1 follows it with `buildSite()`.
- `tests/knowledge/build.test.ts`: fixture `private.yaml` with a fake phone number, and checks that it reaches no output.
- The offline check in [research 09](../docs/research/09-site-feasibility.md): Playwright in Chromium under Bun, network off after one visit. Seam 2 grows from it.

## Success Criteria

- `bun test tests/site` passes on a clean checkout with Chrome installed.
- Peter reviews the running preview against the approved mockups at desktop and phone sizes, in light and dark, and approves it.

## Open Questions

None for this spec. For the plan: the font file format (WOFF2 needs an encoder package, which needs Peter's approval; WOFF needs none).
