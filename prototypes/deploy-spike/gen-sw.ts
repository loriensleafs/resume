// Runs after `vite build` (and its prerender) so the precache list includes the prerendered HTML.
import { generateSW } from "workbox-build";
const result = await generateSW({
  globDirectory: "dist/client",
  globPatterns: ["**/*.{html,js,css,pdf,docx,txt,woff2,webmanifest}"],
  swDest: "dist/client/sw.js",
  navigateFallback: undefined,
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  // Prerendered pages live at <route>/index.html; visitors request <route>. Cache them under the clean URL.
  manifestTransforms: [async (entries) => ({
    manifest: entries.map((e) => ({ ...e, url: e.url === "index.html" ? "/" : e.url.endsWith("/index.html") ? "/" + e.url.slice(0, -"/index.html".length) : e.url })),
    warnings: [],
  })],
});
console.log(`precached ${result.count} files, ${result.size} bytes`);
for (const w of result.warnings) console.log("warning:", w);
