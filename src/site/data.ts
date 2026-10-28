// The Vite plugin that gives the pages their data, made at build time (SPEC-site, Project Structure; decision 0023).
// buildSiteData() in site-data.ts reads the project's files; siteData() makes three modules from what it gives. The
// route loaders and the career timeline import them, so every page and every click between pages has its data with no
// server, online or offline.
// - virtual:site-data holds the public resume facts that the pages show, each approved source's id, title and roles
//   only, and the career timeline's spans and year labels (decision 0006; SPEC-site, Acceptance criteria).
// - virtual:site-source-json loads one source's JSON file: its kind, its summary and its passages. In the browser it
//   fetches the file, which Vite emits under /assets/ with a hashed name, so the JavaScript that / loads does not grow
//   with the sources. ("Source file" in the knowledge module means the Markdown file in knowledge/sources/.)
// - virtual:career-timeline.css is the career timeline's stylesheet: each span's place on the year axis, as a class,
//   because a page may hold no style attribute (SPEC-deploy, Headers). Vite's CSS build emits it as a stylesheet file,
//   which the page links.
// Vite's convention for a module made at build time: https://vite.dev/guide/api-plugin#importing-a-virtual-file

import { dirname, join, resolve } from "node:path";
import type { Plugin } from "vite";
import { SOURCES } from "../knowledge/build";
import { buildSiteData, type SourceJsonFile } from "./site-data";

export type SiteDataOptions = {
  /** The folder that holds resume.yaml and knowledge/. buildSite() sets it; without it, the plugin reads Vite's root. */
  root?: string;
};

declare module "vite" {
  interface UserConfig {
    /** The site's build-time data. A key of its own, as Nitro reads its `nitro` key, so that buildSite() can set the
     *  root in the inline config that Vite merges with vite.config.ts. */
    siteData?: SiteDataOptions;
  }
}

export type SiteDataPluginOptions = {
  /** TanStack Start's prerender page list: the array that vite.config.ts also gives tanstackStart() as `pages`. */
  pages: { path: string }[];
};

const DATA_ID = "virtual:site-data";
const SOURCE_JSON_ID = "virtual:site-source-json";
/** The id ends in .css, so Vite's CSS plugins build the module as a stylesheet (vite 8.3.5, CSS_LANGS_RE). */
const TIMELINE_CSS_ID = "virtual:career-timeline.css";
const IDS = [DATA_ID, SOURCE_JSON_ID, TIMELINE_CSS_ID];
/** A hook filter: Rolldown calls the hook only for this id (https://vite.dev/guide/api-plugin#hook-filters). */
const only = (id: string) => new RegExp(`^${RegExp.escape(id)}$`);

/**
 * The code of virtual:site-source-json: a Map from each approved source id to a function that gives its JSON file.
 * - In a build for the browser, the plugin emits each JSON file as an asset, so Vite writes it under /assets/ with a
 *   hashed name, and the function fetches it. Rolldown turns import.meta.ROLLUP_FILE_URL_<reference> into the file's
 *   address (https://rollupjs.org/plugin-development/#file-urls; Vite's resolveFileUrl hook gives the address on the
 *   site's base).
 * - On the server, where the prerender runs the loaders, and in `vite dev`, which emits no file, the function gives
 *   the file's content from the module itself. The server's bundle runs at build time only (decision 0023).
 */
function sourceJsonModule(
  sourceJsonFiles: Map<string, SourceJsonFile>,
  emit: ((file: SourceJsonFile, id: string) => string) | undefined,
): string {
  if (!emit) {
    const entries = [...sourceJsonFiles].map(
      ([id, file]) => `[${JSON.stringify(id)}, async () => (${JSON.stringify(file)})]`,
    );
    return `export default new Map([${entries.join(", ")}]);`;
  }
  const entries = [...sourceJsonFiles].map(
    ([id, file]) => `[${JSON.stringify(id)}, () => fetchSourceJson(import.meta.ROLLUP_FILE_URL_${emit(file, id)})]`,
  );
  return `async function fetchSourceJson(address) {
  const response = await fetch(address);
  if (!response.ok) throw new Error(\`\${address}: \${response.status} \${response.statusText}\`);
  return response.json();
}
export default new Map([${entries.join(", ")}]);`;
}

export function siteData({ pages }: SiteDataPluginOptions): Plugin {
  let root = process.cwd();
  return {
    name: "resume:site-data",
    // The `config` hook gets vite.config.ts merged with the caller's inline config:
    // https://vite.dev/guide/api-plugin#config
    // In a build, it adds /sources/<id> for each approved source to the prerender's page list. No prerendered page links
    // every source (decision 0015), so link crawling alone would prerender no source page (SPEC-site, Tech Stack).
    // TanStack Start reads its options once, in its own `config` hook (@tanstack/start-plugin-core 1.171.55,
    // vite/plugin.js: getConfig() in "tanstack-start-core:config"). Order "pre" runs this hook before every hook without
    // an order, whatever the plugins' enforce (https://vite.dev/guide/api-plugin#plugin-ordering), so the page list is
    // whole when Start reads it. The build test fails when a source page is missing.
    config: {
      order: "pre",
      async handler(config, { command, isPreview }) {
        root = resolve(config.root ?? process.cwd(), config.siteData?.root ?? ".");
        if (command !== "build" || isPreview) return;
        const { data } = await buildSiteData(root);
        // The source page's route is src/site/routes/sources.$id.tsx.
        for (const { id } of data.sources) {
          const path = `/sources/${id}`;
          if (!pages.some((page) => page.path === path)) pages.push({ path });
        }
      },
    },
    resolveId: {
      filter: { id: IDS.map(only) },
      handler: (id) => `\0${id}`,
    },
    load: {
      filter: { id: IDS.map((id) => only(`\0${id}`)) },
      async handler(id) {
        // `vite dev` loads the modules again when resume.yaml or a source file changes. Bun.Glob is Bun's global: Vite's
        // config loader bundles this file and cannot resolve an import from "bun".
        this.addWatchFile(join(root, "resume.yaml"));
        for await (const file of new Bun.Glob(`${SOURCES}/*.md`).scan({ cwd: root })) {
          this.addWatchFile(join(root, file));
        }
        const { data, sourceJsonFiles, timelineStylesheet } = await buildSiteData(root);
        if (id === `\0${DATA_ID}`) return `export default ${JSON.stringify(data)};`;
        if (id === `\0${TIMELINE_CSS_ID}`) return timelineStylesheet;
        const emitsFiles = this.environment.mode === "build" && this.environment.config.consumer === "client";
        const emit = (file: SourceJsonFile, sourceId: string) =>
          this.emitFile({ type: "asset", name: `${sourceId}.json`, source: JSON.stringify(file) });
        return sourceJsonModule(sourceJsonFiles, emitsFiles ? emit : undefined);
      },
    },
    // `vite dev` also loads the modules again when a source file is added or removed: addWatchFile() above covers only
    // the files that exist at load. Vite calls this hook with type "create" or "delete" for such a file, in each
    // environment, and invalidates the modules it returns (vite 8.3.5, handleHMRUpdate()).
    hotUpdate({ type, file, modules }) {
      if (type === "update" || dirname(file) !== join(root, SOURCES) || !file.endsWith(".md")) return;
      const graph = this.environment.moduleGraph;
      return [...modules, ...[DATA_ID, SOURCE_JSON_ID].flatMap((id) => graph.getModuleById(`\0${id}`) ?? [])];
    },
  };
}
