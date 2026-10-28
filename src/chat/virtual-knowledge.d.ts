// The module that the chat's Vite plugin (vite-plugin.ts) makes at build time. Vite resolves it; this file gives
// TypeScript its type, from the knowledge module itself, so the two cannot drift
// (https://vite.dev/guide/api-plugin#importing-a-virtual-file).
declare module "virtual:knowledge" {
  /** The buildKnowledge() output, with each source's Not public text: only the chat's server route imports it. */
  const knowledge: import("../knowledge/types").Knowledge;
  export default knowledge;
}
