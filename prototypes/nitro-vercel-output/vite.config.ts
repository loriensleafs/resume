// PROTOTYPE: the spike built with Nitro's Vercel preset, to read the routes it writes.
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

export default defineConfig({
  plugins: [
    tanstackStart({ srcDirectory: 'src/site', prerender: { enabled: true, crawlLinks: true, failOnError: true } }),
    nitro({ preset: 'vercel', vercel: { functionRules: { '/api/chat': { maxDuration: 90 } } } }),
    viteReact(),
  ],
})
