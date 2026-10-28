// The static not-found page, 404.html (SPEC-site, Workspace addresses): what every unknown path gets, with status 404.
// buildSite() renders it after the Vite build, outside the route tree: the root route's shell always renders
// <Scripts />, and this page holds no script.
import { renderToStaticMarkup } from "react-dom/server";
import { SITE_LINKS } from "./page-head";
import type { AppBarProps } from "./shell/AppBar";

export type NotFoundPageProps = {
  /** `name` goes in the app bar's name box, and `label`, the headline, follows it, as in the app bar. */
  basics: AppBarProps["basics"];
  /** The addresses of the stylesheets every page links: the design system's tokens, which follow the system's light
   *  or dark setting with no script, and the site's own rules, the app bar's name box among them. */
  stylesheets: string[];
};

/**
 * The arrow at the end of each link, as the boards draw it. The design system's icons are parts that a script
 * defines, so this page draws its own. Presentation attributes, not a style attribute, which the policy blocks.
 */
const arrow = (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M5 12h14M13 6l6 6-6 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** The whole document. */
function NotFoundPage({ basics, stylesheets }: NotFoundPageProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Page not found</title>
        {/* The web manifest and the favicon, as on every page (src/site/page-head.ts). */}
        {SITE_LINKS.map(({ rel, href }) => (
          <link key={rel} rel={rel} href={href} />
        ))}
        {stylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>
        {/* The app bar's name box and headline, with its rules in layout.css, in a plain header as the not-found
            boards draw it. acme-app-bar draws its bar and its banner landmark in its shadow DOM, so with no script
            to define it, it would stay an unknown inline element. A plain link, as no router runs here. */}
        <header className="not-found-bar">
          <a href="/" className="app-bar-name">
            {basics.name}
          </a>{" "}
          <span className="text-label-14 app-bar-headline">{basics.label}</span>
        </header>
        <main className="not-found">
          <p className="text-label-13-mono not-found-dim">404</p>
          {/* text-heading-32 is the phone board's style; layout.css gives wide screens the desktop board's. */}
          <h1 className="text-heading-32 not-found-heading">Page not found</h1>
          <p className="text-copy-16 not-found-dim not-found-measure">
            There is no page at this address. The link may be mistyped, or the page may have moved.
          </p>
          <nav aria-label="Where to go next" className="not-found-nav not-found-measure">
            <ul className="not-found-links">
              <li>
                <a href="/" className="text-label-16 not-found-link">
                  Ask the chat about Peter’s work
                  {arrow}
                </a>
              </li>
              <li>
                <a href="/resume" className="text-label-16 not-found-link">
                  Read Peter’s resume
                  {arrow}
                </a>
              </li>
            </ul>
          </nav>
        </main>
      </body>
    </html>
  );
}

/** The text of 404.html. React writes no doctype, so it goes first here, as on the prerendered pages. */
export function renderNotFoundPage(props: NotFoundPageProps): string {
  return `<!DOCTYPE html>${renderToStaticMarkup(<NotFoundPage {...props} />)}`;
}
