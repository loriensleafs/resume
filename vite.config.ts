// The site's Vite build: TanStack Start with React, and Nitro's Vercel output (SPEC-site, Tech Stack).
// Vite runs under Bun: `bun --bun vite dev` and `bun --bun vite build` (decision 0004).
// Plugin order from https://tanstack.com/start/latest/docs/framework/react/guide/hosting#nitro
import { resolve } from "node:path";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";
import { siteData } from "./src/site/data";
import { SITE_ADDRESS } from "./src/site/page-head";

/**
 * Keeps TanStack Start's page list, pages.json, out of the static folder. Start writes it beside sitemap.xml whenever
 * it writes the sitemap, and no option leaves it out (@tanstack/start-plugin-core 1.171.55, build-sitemap.js). Nothing
 * reads it: not Start, not Nitro, not the site. Served, it would be a second public list of the pages, and it also
 * holds each address with "?" that the prerender filter drops, which the sitemap leaves out on purpose.
 * Start writes it in a buildApp hook with enforce "post" and order "post". This plugin has the same two and comes after
 * tanstackStart() in the list, so Vite runs its hook later: Vite sorts the plugins by enforce, then each hook by its
 * order, and keeps the list's order inside each group (https://vite.dev/guide/api-plugin#plugin-ordering; vite 8.3.5,
 * sortUserPlugins() and getSortedPluginsByHook()).
 */
function withoutPageList(): Plugin {
  return {
    name: "resume:without-page-list",
    enforce: "post",
    buildApp: {
      order: "post",
      async handler(builder) {
        // TanStack Start writes the sitemap and the page list into the client environment's output folder.
        const client = builder.environments.client;
        if (!client) throw new Error("vite.config.ts: the build has no client environment, so no static folder");
        const pageList = Bun.file(resolve(builder.config.root, client.config.build.outDir, "pages.json"));
        if (await pageList.exists()) await pageList.delete();
      },
    },
  };
}

/**
 * The prerender's page list (SPEC-site, Tech Stack): / and /resume here, and /sources/<id> for each approved source,
 * which siteData() adds in a build, once it knows the root that buildSite() names. Both plugins get this one array.
 */
const pages = [{ path: "/" }, { path: "/resume" }];

export default defineConfig({
  // Vite's root is this folder, wherever Vite starts (https://vite.dev/config/shared-options#root; the default is
  // the working folder). TanStack Start's prerender starts a Vite preview server with this file alone, so the root
  // must come from here (@tanstack/start-plugin-core, vite/prerender.js); there, Start finds src/site and Nitro
  // finds its last build from the root.
  root: import.meta.dirname,
  server: { port: 3000 },
  plugins: [
    // The pages' data, made at build time from resume.yaml and the approved sources (src/site/data.ts). buildSite()
    // sets `siteData.root`; `vite dev` reads this folder's files.
    siteData({ pages }),
    // Static prerendering (SPEC-site, Tech Stack), with the options of TanStack Start's guide:
    // https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering
    tanstackStart({
      srcDirectory: "src/site",
      pages,
      prerender: {
        enabled: true,
        crawlLinks: true,
        failOnError: true,
        // The filter drops each page whose path has "?", and keeps that page out of the sitemap. Why: the crawler
        // drops a page's query from its output path, so a crawled /?source= or /?role= link would overwrite
        // index.html. And the crawler adds a crawled page to the sitemap's page list before this filter runs, so
        // a dropped page stays in the sitemap unless the filter excludes it (@tanstack/start-plugin-core,
        // prerender.js).
        filter: (page) => {
          if (!page.path.includes("?")) return true;
          page.sitemap = { ...page.sitemap, exclude: true };
          return false;
        },
      },
      // The sitemap lists each page on the site's one address, as each page's canonical address does
      // (src/site/page-head.ts).
      sitemap: { enabled: true, host: SITE_ADDRESS },
    }),
    withoutPageList(),
    // Nitro writes Vercel's output, `.vercel/output/`, in every environment (SPEC-deploy, Configuration in code).
    nitro({ preset: "vercel" }),
    viteReact(),
  ],
});
