// `bun run build:site`: the build script, the composition root at build time (SPEC-deploy, "Configuration in code").
// It writes Nitro's Vercel output: the prerendered pages, each with its own policy tag, and the functions.
//
//   bun run build:site                   writes .vercel/output/ under the repository
//   bun run build:site --out <folder>    writes <folder>/.vercel/output/ instead (the tests' seam-1 folder)
//   bun run build:site --root <folder>   every step reads the project's files (resume.yaml, private.yaml,
//                                        knowledge/, documents/) from <folder> instead of the repository
//
// A relative folder starts at the working folder, which `bun run` sets to the repository.
//
// Run one build per checkout at a time: two builds at once, such as this script and the site's build test, can
// prerender from each other's output (src/site/build.ts says why). This script runs its one buildSite() and waits for
// it before the next step.

import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { addPolicyTags } from "../src/deploy/policy";
import { writeVercelConfig } from "../src/deploy/routes";
import { buildSite } from "../src/site/build";

const REPO = resolve(import.meta.dir, "..");

// strict refuses an unknown or misspelt option, so a typo stops the build before any step, and never sends the
// output to the repository's own .vercel/output/ (https://bun.com/docs/guides/process/argv).
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: { out: { type: "string" }, root: { type: "string" } },
  strict: true,
});
const root = resolve(values.root ?? REPO);
const outDir = resolve(values.out ?? REPO);
const outputDir = join(outDir, ".vercel/output");
const staticDir = join(outputDir, "static");

// This script is the production build however it starts. A child of `bun test` inherits NODE_ENV "test", and with it
// Vite makes a development build (https://vite.dev/guide/env-and-mode#node-env-and-modes); Workbox's generateSW takes
// its default mode from NODE_ENV too (https://developer.chrome.com/docs/workbox/modules/workbox-build). The pin covers
// every step. buildSite() also pins NODE_ENV for its own run, for a caller that runs it in its own process.
process.env.NODE_ENV = "production";

// The five steps run in this order (SPEC-deploy, "The build script"). The module that provides a step wires it in.
// 1. Site: the Vite build prerenders the pages into Nitro's Vercel output under outDir.
// 2. Chat (task C16): the chat's Vite plugin writes device-index.json during step 1's Vite build. vite.config.ts adds
//    the plugin, so this script runs nothing for it.
await buildSite({ root, outDir });
// 3. Deploy: each HTML file's policy tag. It comes before the service worker, so the precache holds tagged pages.
const pages = await addPolicyTags(staticDir);
console.log(`Policy tags: ${pages.join(", ")}`);
// 4. Site (task S28): writeServiceWorker(staticDir).
// 5. Deploy: the routes replace Nitro's own, so only the three API paths run as functions; the redirects, the clean
//    addresses, the not-found page and the cron.
const unnamedFolders = await writeVercelConfig(outputDir);
console.log(`Routes: written; function folders sent to 404.html: ${unnamedFolders.join(", ")}`);
console.log(`Built ${outputDir}`);
