// The site's Vite build: TanStack Start with React, and Nitro's Vercel output (SPEC-site, Tech Stack).
// Vite runs under Bun: `bun --bun vite dev` and `bun --bun vite build` (decision 0004).
// Plugin order from https://tanstack.com/start/latest/docs/framework/react/guide/hosting#nitro
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // Vite's root is this folder, wherever Vite starts (https://vite.dev/config/shared-options#root; the default is
  // the working folder). TanStack Start's prerender starts a Vite preview server with this file alone, so the root
  // must come from here (@tanstack/start-plugin-core, vite/prerender.js); there, Start finds src/site and Nitro
  // finds its last build from the root.
  root: import.meta.dirname,
  server: { port: 3000 },
  plugins: [
    // Static prerendering (SPEC-site, Tech Stack), with the options of TanStack Start's guide:
    // https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering
    tanstackStart({
      srcDirectory: "src/site",
      pages: [{ path: "/" }, { path: "/resume" }],
      prerender: {
        enabled: true,
        crawlLinks: true,
        failOnError: true,
        // The crawler drops a page's query from its output path, so a crawled /?source= or /?role= link would
        // overwrite index.html. The crawler also adds a crawled page to the sitemap's page list before this filter
        // runs, so the filter takes the page out of the sitemap as well (@tanstack/start-plugin-core, prerender.js).
        filter: (page) => {
          if (!page.path.includes("?")) return true;
          page.sitemap = { ...page.sitemap, exclude: true };
          return false;
        },
      },
      sitemap: { enabled: true, host: "https://peterkloss.dev" },
    }),
    // Nitro writes Vercel's output, `.vercel/output/`, in every environment (SPEC-deploy, Configuration in code).
    nitro({ preset: "vercel" }),
    viteReact(),
  ],
});
