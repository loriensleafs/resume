import type { ReactNode } from 'react'
import { Outlet, createRootRoute, HeadContent, Scripts, Link } from '@tanstack/react-router'
import tokensHref from '@acmelabs/design-system/styles/tokens.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Site spike' },
    ],
    links: [
      { rel: 'stylesheet', href: tokensHref },
      { rel: 'manifest', href: '/manifest.webmanifest' },
    ],
    scripts: [
      { children: "if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')" },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <nav>
          <Link to="/">Home</Link>
        </nav>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
