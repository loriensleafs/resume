// PROTOTYPE (deploy spike): the site spike built with Nitro's Vercel preset, as in prototypes/nitro-vercel-output/.
// Nitro writes .vercel/output/; the pages land in .vercel/output/static/.
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tanstackStart({
      srcDirectory: 'src/site',
      prerender: {
        enabled: true,
        crawlLinks: true,
        failOnError: true,
        // The page links the documents; they are static files, not pages, and the branch commits none,
        // so the crawler leaves them alone. https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering
        filter: ({ path }) => !/\.(pdf|docx|txt)$/.test(path),
      },
    }),
    nitro({ preset: 'vercel' }),
    viteReact(),
    VitePWA({
      injectRegister: false,
      registerType: 'autoUpdate',
      manifest: { name: 'Site spike', short_name: 'Spike', start_url: '/', display: 'standalone', icons: [] },
      workbox: { globPatterns: ['**/*.{js,css,html,pdf,docx,txt,woff2}'], navigateFallback: null },
    }),
  ],
})
