// buildSite(): the site's production build (SPEC-site, Project Structure). It runs the Vite app build of
// vite.config.ts, which prerenders the pages into Nitro's Vercel output under the folder the caller names, then writes
// the not-found page, 404.html, and the web manifest beside them.
import { join, resolve } from "node:path";
import { Glob } from "bun";
import { createBuilder } from "vite";
import { loadResume, type Resume } from "../content";
import { renderNotFoundPage } from "./not-found";
import { WEB_MANIFEST_ADDRESS } from "./page-head";

/** The site's Vite config. It sets Vite's root to its own folder, the repository, which holds src/site. */
const VITE_CONFIG = join(import.meta.dir, "../../vite.config.ts");

export type BuildSiteOptions = {
  /** The folder that holds the project's files: resume.yaml, private.yaml, knowledge/ and documents/. The pages' data
   *  comes from its resume.yaml (src/site/data.ts). A relative path starts at the working folder. */
  root: string;
  /** The build writes Nitro's Vercel output to <outDir>/.vercel/output/, and the pages to its static/ folder.
   *  A relative path starts at the working folder. */
  outDir: string;
};

export async function buildSite({ root, outDir }: BuildSiteOptions): Promise<void> {
  // Vite makes a production build only when NODE_ENV is "production" or unset; any other value gives a development
  // build (https://vite.dev/guide/env-and-mode#node-env-and-modes), whose prerender fails, because the server bundle
  // then calls React's development JSX runtime. The build script, its one caller, sets NODE_ENV to "production" for
  // every step (scripts/build-site.ts), so a run that starts under `bun test`, which sets "test", still builds for
  // production.
  //
  // createBuilder() and buildApp() are the programmatic `vite build --app`, which builds every environment:
  // https://vite.dev/guide/api-environment-frameworks#building-programmatically-with-createbuilder
  // Nitro reads the `nitro` key of the Vite config, and its Vercel preset puts the functions and the static
  // folder inside output.dir: https://nitro.build/docs/vite#configuring-nitro-with-vite
  // Limit: run one build per checkout at a time. Nitro records each build's output folder in
  // <Vite root>/node_modules/.nitro/last-build.json, and the prerender's preview server reads that file to find
  // the output. Nitro fixes that path; its buildDir option does not move it (nitro 3.0.260903-beta,
  // dist/_build/common.mjs). So two builds at once can prerender from each other's output.
  // The site's data plugin reads its root from the `siteData` key in the same way (src/site/data.ts).
  const builder = await createBuilder({
    configFile: VITE_CONFIG,
    siteData: { root: resolve(root) },
    nitro: { output: { dir: resolve(outDir, ".vercel/output") } },
  });
  await builder.buildApp();
  // The pages' own data: the same resume.yaml through the same public loader.
  const { basics } = await loadResume("public", resolve(root));
  const staticDir = resolve(outDir, ".vercel/output/static");
  await writeNotFoundPage(basics, staticDir);
  await Bun.write(join(staticDir, WEB_MANIFEST_ADDRESS), JSON.stringify(webManifest(basics), null, 2));
}

/**
 * Writes 404.html, the not-found page, into the static folder, outside the route tree. It takes the pages' own data and
 * stylesheets: the name and the headline, and each stylesheet that every prerendered page links.
 */
async function writeNotFoundPage(basics: Resume["basics"], staticDir: string): Promise<void> {
  const stylesheets = await stylesheetsOfEveryPage(staticDir);
  const page = renderNotFoundPage({ basics: { name: basics.name, label: basics.label }, stylesheets });
  await Bun.write(join(staticDir, "404.html"), page);
}

/**
 * The web manifest (https://www.w3.org/TR/appmanifest/), from which the browser installs the site as a standalone app
 * named after Peter, with the PK icon (SPEC-site, Acceptance criteria; Views: Installed app and App icon). Its
 * addresses resolve against the manifest's own, so the start address and the scope are https://peterkloss.dev/.
 *
 * - The id is the start address, as a browser would derive it. Written out, it keeps the installed app the same app if
 *   the start address ever changes (https://www.w3.org/TR/appmanifest/#id-member).
 * - The icons are the committed files that `bun run icons` renders into public/icons/, which Vite copies. An icon with
 *   no purpose serves any use; the maskable one keeps its letters inside the safe zone.
 * - No theme_color: the installed-app boards draw the title bar light in light mode and dark in dark mode, which one
 *   manifest color cannot do. Without it the browser draws its own title bar, in the system's appearance.
 */
function webManifest(basics: Resume["basics"]) {
  return {
    id: "/",
    name: basics.name,
    start_url: "/",
    scope: "/",
    display: "standalone",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

/**
 * The stylesheets that every prerendered page links, in page order: the root route's, which hold the design system's
 * tokens and the site's own rules. A stylesheet that only some pages link belongs to their routes, so it stays out.
 */
async function stylesheetsOfEveryPage(staticDir: string): Promise<string[]> {
  // 404.html stays out: a copy from an earlier build into the same folder would hold that build's stylesheets.
  const pages = (await Array.fromAsync(new Glob("**/*.html").scan({ cwd: staticDir })))
    .filter((page) => page !== "404.html")
    .sort();
  let shared: string[] | undefined;
  for (const page of pages) {
    const links: string[] = [];
    // The selector matches only links that have an href, so getAttribute() returns a string.
    new HTMLRewriter()
      .on('link[rel="stylesheet"][href]', { element: (link) => void links.push(link.getAttribute("href")!) })
      .transform(await Bun.file(join(staticDir, page)).text());
    shared = shared === undefined ? links : shared.filter((href) => links.includes(href));
  }
  if (!shared?.length) {
    throw new Error(`buildSite: no stylesheet is linked by every page under ${staticDir}, so 404.html would have no style`);
  }
  return shared;
}
