// The modules that siteData() in src/site/data.ts makes at build time. Vite resolves them; this file gives TypeScript
// their types, from site-data.ts itself, so the two cannot drift (https://vite.dev/guide/api-plugin#importing-a-virtual-file).
// virtual:career-timeline.css needs no line here: vite/client types every *.css import.
declare module "virtual:site-data" {
  const data: import("./site-data").SiteData;
  export default data;
}

declare module "virtual:site-source-json" {
  /** Each approved source's JSON file, by source id: in the browser the function fetches it from /assets/. */
  const sourceJsonFiles: ReadonlyMap<string, () => Promise<import("./site-data").SourceJsonFile>>;
  export default sourceJsonFiles;
}
