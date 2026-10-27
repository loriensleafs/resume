// The module that siteData() in src/site/data.ts makes at build time. Vite resolves it; this file gives TypeScript its
// exports (https://vite.dev/guide/api-plugin#importing-a-virtual-file).
declare module "virtual:site-data" {
  /** The public resume from the build root's resume.yaml. */
  export const resume: import("./data").SiteData["resume"];
}
