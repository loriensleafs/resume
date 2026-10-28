import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
// Every page's stylesheets: the design system's tokens, the site's own font, then the site's own rules. Start finds CSS
// that the root route imports and links it in every page's head, so a page is styled before any script runs:
// https://tanstack.com/start/latest/docs/framework/react/guide/css-styling#use-side-effect-imports-for-global-route-css
import "../styles/tokens.css";
import "../styles/fonts.css";
import "../styles/layout.css";

// The shell wraps the root route's component, its error component and its not-found component,
// so every page keeps the document, its language and its scripts. TanStack Start's Selective SSR guide
// defines shellComponent in its section "How to disable SSR of the root route?":
// https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr#how-to-disable-ssr-of-the-root-route
export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
