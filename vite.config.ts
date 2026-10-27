// The site's Vite build: TanStack Start with React, and Nitro's Vercel output (SPEC-site, Tech Stack).
// Vite runs under Bun: `bun --bun vite dev` and `bun --bun vite build` (decision 0004).
// Plugin order from https://tanstack.com/start/latest/docs/framework/react/guide/hosting#nitro
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    tanstackStart({ srcDirectory: "src/site" }),
    // Nitro writes Vercel's output, `.vercel/output/`, in every environment (SPEC-deploy, Configuration in code).
    nitro({ preset: "vercel" }),
    viteReact(),
  ],
});
