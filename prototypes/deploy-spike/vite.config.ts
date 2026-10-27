import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tanstackStart({
      srcDirectory: 'src/site',
      prerender: { enabled: true, crawlLinks: true, failOnError: true },
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
