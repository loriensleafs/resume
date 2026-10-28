// The chat's Vite plugin (SPEC-chat, Project Structure, "The build"). vite.config.ts adds it to the site's Vite build;
// the site's code imports no chat module (SPEC-site, Objective).
// - virtual:knowledge gives the chat's server route the buildKnowledge() output, made at build time and bundled with
//   the function, so the function reads no source file at run time. It holds each source's Not public text, which the
//   model gets on the server only, so the plugin refuses to give it to the browser's build.
// - device-index.json, the device index, goes into the static folder during the same Vite build. It comes from
//   publicKnowledge(knowledge), so it holds no Not public text (device-index.ts).
// Both read the project's files under the root that buildSite() names: the site's build data reads the same root
// (src/site/data.ts), so the seam-1 build reads its fixture root here too.
// Vite's convention for a module made at build time: https://vite.dev/guide/api-plugin#importing-a-virtual-file

import { dirname, join, resolve } from "node:path";
import type { Plugin } from "vite";
import { buildKnowledge, publicKnowledge, SOURCES } from "../knowledge/build";
import { buildSiteData } from "../site/data";
import { buildDeviceIndex, DEVICE_INDEX_FILE, type DeviceIndex } from "./device-index";

const KNOWLEDGE_ID = "virtual:knowledge";
/** The resolved id: the "\0" prefix tells other plugins that no file holds the module. */
const RESOLVED_KNOWLEDGE_ID = `\0${KNOWLEDGE_ID}`;

/** The device index of the project's files under `root`. */
async function deviceIndexOf(root: string): Promise<DeviceIndex> {
  const [knowledge, { data }] = await Promise.all([buildKnowledge({ root }), buildSiteData(root)]);
  return buildDeviceIndex(publicKnowledge(knowledge), data.resume);
}

export function chatKnowledge(): Plugin {
  let root = process.cwd();
  return {
    name: "resume:chat-knowledge",
    // The resolved config keeps the caller's own keys (vite 8.3.5, resolveConfig()), so `siteData` holds the root that
    // buildSite() sets, as the site data's plugin reads it; `vite dev` has none and reads Vite's root.
    configResolved(config) {
      root = resolve(config.root, config.siteData?.root ?? ".");
    },
    // Hook filters: Rolldown calls each hook only for this id (https://vite.dev/guide/api-plugin#hook-filters).
    resolveId: {
      filter: { id: new RegExp(`^${KNOWLEDGE_ID}$`) },
      handler: () => RESOLVED_KNOWLEDGE_ID,
    },
    load: {
      filter: { id: new RegExp(`^${RESOLVED_KNOWLEDGE_ID}$`) },
      async handler() {
        // The browser's build writes the static folder, which must hold no Not public text (SPEC-site, Acceptance
        // criteria). So an import that reaches the browser stops the build, or fails the module in `vite dev`.
        if (this.environment.config.consumer === "client") {
          this.error(
            `${KNOWLEDGE_ID} holds each source's Not public text, so only the server may import it; ` +
              `the browser reads ${DEVICE_INDEX_FILE}`,
          );
        }
        // `vite dev` loads the module again when a file it reads changes. Bun.Glob is Bun's global: Vite's config
        // loader bundles this file and cannot resolve an import from "bun".
        this.addWatchFile(join(root, "resume.yaml"));
        this.addWatchFile(join(root, "knowledge/logistics.yaml"));
        for await (const file of new Bun.Glob(`${SOURCES}/*.md`).scan({ cwd: root })) {
          this.addWatchFile(join(root, file));
        }
        return `export default ${JSON.stringify(await buildKnowledge({ root }))};`;
      },
    },
    // `vite dev` also loads the module again when a source file is added or removed: addWatchFile() above covers only
    // the files that exist at load (the site data's plugin does the same; vite 8.3.5, handleHMRUpdate()).
    hotUpdate({ type, file, modules }) {
      if (type === "update" || dirname(file) !== join(root, SOURCES) || !file.endsWith(".md")) return;
      const knowledge = this.environment.moduleGraph.getModuleById(RESOLVED_KNOWLEDGE_ID);
      return knowledge ? [...modules, knowledge] : undefined;
    },
    // The browser's build writes the static folder, so the file goes into that environment's output, under its own
    // name with no hash: the browser fetches it by that one address.
    async generateBundle() {
      if (this.environment.config.consumer !== "client") return;
      const source = JSON.stringify(await deviceIndexOf(root));
      this.emitFile({ type: "asset", fileName: DEVICE_INDEX_FILE, source });
    },
    // `vite dev` writes no file, so its server answers the file's address itself, from the files as they are now.
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (new URL(request.url ?? "/", "http://localhost").pathname !== `/${DEVICE_INDEX_FILE}`) return next();
        try {
          const body = JSON.stringify(await deviceIndexOf(root));
          response.setHeader("Content-Type", "application/json");
          response.end(body);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}
