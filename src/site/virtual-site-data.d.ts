// The module that siteData() in src/site/data.ts makes at build time. Vite resolves it; this file gives TypeScript its
// type, SiteData itself, so the two cannot drift (https://vite.dev/guide/api-plugin#importing-a-virtual-file).
declare module "virtual:site-data" {
  const data: import("./data").SiteData;
  export default data;
}
