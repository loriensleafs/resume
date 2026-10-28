// The pages' data, made at build time (SPEC-site, Project Structure; decision 0023). siteData() is a Vite plugin that
// makes the module virtual:site-data from the project's files. The route loaders import that module, so every page
// and every click between pages has its data with no server, online or offline.
// The module holds public facts only: the fields the pages show, from loadResume("public", root) (decision 0006).
// Vite's convention for a module made at build time: https://vite.dev/guide/api-plugin#importing-a-virtual-file

import { join, resolve } from "node:path";
import type { Plugin } from "vite";
import { formatRange, formatTitle, type Job, loadResume, type Resume } from "../content";

/**
 * A role as the resume view shows it. The plugin formats its text at build time, so the browser loads no code from the
 * content module, whose schema brings zod.
 */
export type SiteRole = Pick<Job, "id" | "name" | "position" | "earlier" | "highlights"> & {
  /** The dates as the documents print them: "Dec 2024 – Aug 2026". */
  dates: string;
  /** The title line as the documents print it, then the location: "Lead Front-End Engineer, Boston, MA". */
  titleLine: string;
};

/**
 * The resume facts that the pages show, and no other field. A field added to resume.yaml reaches no page until a view
 * needs it and this type names it. The app bar shows the name and the headline (label); the resume view the rest.
 */
export type SiteResume = {
  basics: Pick<Resume["basics"], "name" | "label" | "summary">;
  work: SiteRole[];
  skills: Pick<Resume["skills"][number], "name" | "keywords">[];
  education: Pick<Resume["education"][number], "institution">[];
};

/** The default export of virtual:site-data. src/site/virtual-site-data.d.ts types the module with it. */
export type SiteData = { resume: SiteResume };

/** Each field by name: a spread would carry every field that the schema gains into the pages. */
function siteResume(resume: Resume): SiteResume {
  return {
    basics: { name: resume.basics.name, label: resume.basics.label, summary: resume.basics.summary },
    work: resume.work.map((job) => ({
      id: job.id,
      name: job.name,
      position: job.position,
      earlier: job.earlier,
      highlights: job.highlights,
      dates: formatRange(job),
      titleLine: job.location ? `${formatTitle(job)}, ${job.location}` : formatTitle(job),
    })),
    skills: resume.skills.map(({ name, keywords }) => ({ name, keywords })),
    education: resume.education.map(({ institution }) => ({ institution })),
  };
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
        return `export default ${JSON.stringify(data)};`;
      },
    },
  };
}
