// The pages' data, made at build time (SPEC-site, Project Structure; decision 0023). buildSiteData() reads the project's
// files; siteData() is the Vite plugin that makes two modules from what it gives. The route loaders import them, so
// every page and every click between pages has its data with no server, online or offline.
// - virtual:site-data holds the public resume facts that the pages show, and each approved source's id, title and
//   roles only (decision 0006; SPEC-site, Acceptance criteria).
// - virtual:site-source-json loads one source's JSON file: its kind, its summary and its passages. In the browser it
//   fetches the file, which Vite emits under /assets/ with a hashed name, so the JavaScript that / loads does not grow
//   with the sources. ("Source file" in the knowledge module means the Markdown file in knowledge/sources/.)
// Every source text comes from publicKnowledge(knowledge), which leaves out each source's Not public section.
// Vite's convention for a module made at build time: https://vite.dev/guide/api-plugin#importing-a-virtual-file

import { dirname, join, resolve } from "node:path";
import type { Plugin } from "vite";
import { formatRange, formatTitle, type Job, loadResume, type Resume } from "../content";
import { buildKnowledge, publicKnowledge, SOURCES } from "../knowledge/build";
import type { PublicKnowledge } from "../knowledge/types";

/**
 * A role as the resume view shows it. The plugin formats its text at build time, so the browser loads no code from the
 * content module, whose schema brings zod.
 */
export type SiteRole = Pick<Job, "id" | "name" | "position" | "earlier" | "highlights"> & {
  /** The dates as the documents print them: "Dec 2024 – Aug 2026". */
  dates: string;
  /** The title line as the documents print it, then the location: "Lead Front-End Engineer, Boston, MA". */
  titleLine: string;
  /** The role's short label on the career timeline, its `x-short` in resume.yaml: "FedNow". */
  short: string;
  /** The role's years: "2021 – 2024", or "2024 – Present" while it lasts. */
  years: string;
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

/** One approved source as publicKnowledge() gives it to the site (SPEC-knowledge, "Who gets which shape"). */
type PublicSource = PublicKnowledge["sources"][number];

/** A role of a source: its id, and its short label and years as the source page shows them ("FedNow, 2021 – 2024"). */
export type SourceRole = Pick<SiteRole, "id" | "short" | "years">;

/**
 * An approved source in the build-time module: its id, title and roles only (SPEC-site, Acceptance criteria). Each
 * role comes resolved from resume.yaml at build time, so a role that resume.yaml lacks stops the build.
 */
export type SiteSource = Pick<PublicSource, "id" | "title"> & { roles: SourceRole[] };

/** One source's JSON file: what its view shows beyond the module's id, title and roles. */
export type SourceJsonFile = Pick<PublicSource, "kind" | "summary" | "passages">;

/** The default export of virtual:site-data. src/site/virtual-site-data.d.ts types the module with it. */
export type SiteData = { resume: SiteResume; sources: SiteSource[] };

/** "2021 – 2024" from 2021 and 2024; one year alone when the role starts and ends in it; "Present" with no end date. */
function formatYears({ startDate, endDate }: Pick<Job, "startDate" | "endDate">): string {
  const start = startDate.slice(0, 4);
  const end = endDate ? endDate.slice(0, 4) : "Present";
  return start === end ? start : `${start} – ${end}`;
}

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
      short: job["x-short"],
      years: formatYears(job),
    })),
    skills: resume.skills.map(({ name, keywords }) => ({ name, keywords })),
    education: resume.education.map(({ institution }) => ({ institution })),
  };
}

/**
 * The pages' data from the project's files under `root`: the module's data, and each approved source's JSON file by
 * source id, in source-id order. The resume comes through loadResume("public", root) and the sources through
 * publicKnowledge(), so neither a private detail nor a Not public section reaches it. Each field is named, as in
 * siteResume().
 */
export async function buildSiteData(
  root: string,
): Promise<{ data: SiteData; sourceJsonFiles: Map<string, SourceJsonFile> }> {
  const resume = siteResume(await loadResume("public", root));
  const { sources } = publicKnowledge(await buildKnowledge({ root }));
  // A Map, never an object's property, so a role id such as "constructor" names no role (SPEC-knowledge).
  const roleById = new Map(resume.work.map(({ id, short, years }) => [id, { id, short, years }]));
  // The knowledge build checks each role of an approved source against resume.yaml (SPEC-knowledge, Sources: Roles);
  // this stops the build too, should the two ever disagree.
  const roleOf = (sourceId: string, roleId: string): SourceRole => {
    const role = roleById.get(roleId);
    if (!role) throw new Error(`source ${sourceId}: the role ${roleId} is not in resume.yaml`);
    return role;
  };
  return {
    data: {
      resume,
      sources: sources.map(({ id, title, roles }) => ({ id, title, roles: roles.map((roleId) => roleOf(id, roleId)) })),
    },
    sourceJsonFiles: new Map(sources.map(({ id, kind, summary, passages }) => [id, { kind, summary, passages }])),
  };
}

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
/** A hook filter: Rolldown calls the hook only for this id (https://vite.dev/guide/api-plugin#hook-filters). Neither id
 *  holds a character that a regular expression reads specially, so each matches itself. */
const only = (id: string) => new RegExp(`^${id}$`);

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
      filter: { id: [only(DATA_ID), only(SOURCE_JSON_ID)] },
      handler: (id) => `\0${id}`,
    },
    load: {
      filter: { id: [only(`\0${DATA_ID}`), only(`\0${SOURCE_JSON_ID}`)] },
      async handler(id) {
        // `vite dev` loads the modules again when resume.yaml or a source file changes. Bun.Glob is Bun's global: Vite's
        // config loader bundles this file and cannot resolve an import from "bun".
        this.addWatchFile(join(root, "resume.yaml"));
        for await (const file of new Bun.Glob(`${SOURCES}/*.md`).scan({ cwd: root })) {
          this.addWatchFile(join(root, file));
        }
        const { data, sourceJsonFiles } = await buildSiteData(root);
        if (id === `\0${DATA_ID}`) return `export default ${JSON.stringify(data)};`;
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
