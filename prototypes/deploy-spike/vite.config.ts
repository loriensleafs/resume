// PROTOTYPE (deploy spike): the site spike built with Nitro's Vercel preset, as in prototypes/nitro-vercel-output/.
// Nitro writes .vercel/output/; the pages land in .vercel/output/static/. post-build.ts then replaces Nitro's routes.
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
    nitro({
      preset: 'vercel',
      // Check 2: three functions, each a copy of Nitro's server with its own .vc-config.json.
      // `environment` names the function, so /api/spike can report which one answered.
      // https://nitro.build/deploy/providers/vercel#per-route-function-configuration
      // https://vercel.com/docs/build-output-api/primitives#serverless-function-configuration
      vercel: {
        // SPEC-deploy's line: Nitro writes "bun1.x" when nothing sets the runtime. __server gets this config.
        // CONTROL RUN (D2): no runtime, so Nitro writes its default. The restore commit puts 'bun1.4.x' back.
        functions: { environment: { SPIKE_FUNCTION: '/__server' } },
        functionRules: {
          // The chat's twin: its own function, as SPEC-deploy's functionRules gives /api/chat.
          '/api/spike': { maxDuration: 150, regions: ['iad1'], environment: { SPIKE_FUNCTION: '/api/spike' } },
          // The probe: Nitro's documented runtime value, with vercel.json bunVersion "1.4.x".
          '/api/spike-bun1x': { runtime: 'bun1.x', environment: { SPIKE_FUNCTION: '/api/spike-bun1x' } },
        },
      },
    }),
    viteReact(),
    VitePWA({
      injectRegister: false,
      registerType: 'autoUpdate',
      manifest: { name: 'Site spike', short_name: 'Spike', start_url: '/', display: 'standalone', icons: [] },
      workbox: { globPatterns: ['**/*.{js,css,html,pdf,docx,txt,woff2}'], navigateFallback: null },
    }),
  ],
})
