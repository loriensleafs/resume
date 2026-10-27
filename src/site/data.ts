// The pages' data, made at build time (SPEC-site, Project Structure; decision 0023). siteData() is a Vite plugin that
// makes the module virtual:site-data from the project's files. The route loaders import that module, so every page
// and every click between pages has its data with no server, online or offline.
// The module holds public facts only: the resume as loadResume("public", root) reads it (decision 0006).
// Vite's convention for a module made at build time: https://vite.dev/guide/api-plugin#importing-a-virtual-file

import { join, resolve } from "node:path";
import type { Plugin } from "vite";
import { formatRange, formatTitle, type Job, loadResume, type Resume } from "../content";

/**
 * A role with its dates and title line as the documents print them. The plugin formats them at build time, so the
 * browser loads no code from the content module, whose schema brings zod.
 */
export type SiteRole = Job & { dates: string; titleLine: string };
export type SiteResume = Omit<Resume, "work"> & { work: SiteRole[] };

/** What virtual:site-data exports: one named export per key. src/site/virtual-site-data.d.ts gives each its type. */
export type SiteData = { resume: SiteResume };

function siteResume(resume: Resume): SiteResume {
  const work = resume.work.map((job) => ({ ...job, dates: formatRange(job), titleLine: formatTitle(job) }));
  return { ...resume, work };
}

export type SiteDataOptions = {
  /** The folder that holds resume.yaml. buildSite() sets it; without it, the plugin reads Vite's root. */
  root?: string;
};

declare module "vite" {
  interface UserConfig {
    /** The site's build-time data. A key of its own, as Nitro reads its `nitro` key, so that buildSite() can set the
     *  root in the inline config that Vite merges with vite.config.ts. */
    siteData?: SiteDataOptions;
  }
}

const MODULE_ID = "virtual:site-data";
const RESOLVED_ID = `\0${MODULE_ID}`;
/** A hook filter: Rolldown calls the hook only for this id (https://vite.dev/guide/api-plugin#hook-filters). Neither id
 *  holds a character that a regular expression reads specially, so each matches itself. */
const only = (id: string) => new RegExp(`^${id}$`);

export function siteData(): Plugin {
  let root = process.cwd();
  return {
    name: "resume:site-data",
    // The `config` hook gets vite.config.ts merged with the caller's inline config:
    // https://vite.dev/guide/api-plugin#config
    config(config) {
      root = resolve(config.root ?? process.cwd(), config.siteData?.root ?? ".");
    },
    resolveId: { filter: { id: only(MODULE_ID) }, handler: () => RESOLVED_ID },
    load: {
      filter: { id: only(RESOLVED_ID) },
      async handler() {
        // `vite dev` loads the module again when resume.yaml changes.
        this.addWatchFile(join(root, "resume.yaml"));
        const data: SiteData = { resume: siteResume(await loadResume("public", root)) };
        return Object.entries(data)
          .map(([name, value]) => `export const ${name} = ${JSON.stringify(value)};`)
          .join("\n");
      },
    },
  };
}
