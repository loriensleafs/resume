// buildSite(): the site's production build (SPEC-site, Project Structure). It runs the Vite app build of
// vite.config.ts, which prerenders the pages into Nitro's Vercel output under the folder the caller names.
import { join, resolve } from "node:path";
import { createBuilder } from "vite";

/** The site's Vite config. It sets Vite's root to its own folder, the repository, which holds src/site. */
const VITE_CONFIG = join(import.meta.dir, "../../vite.config.ts");

export type BuildSiteOptions = {
  /** The folder that holds the project's files: resume.yaml, private.yaml, knowledge/ and documents/.
   *  The pages read none of them yet. */
  root: string;
  /** The build writes Nitro's Vercel output to <outDir>/.vercel/output/, and the pages to its static/ folder.
   *  A relative path starts at the working folder. */
  outDir: string;
};

export async function buildSite({ outDir }: BuildSiteOptions): Promise<void> {
  // Vite makes a production build only when NODE_ENV is "production" or unset; any other value gives a development
  // build (https://vite.dev/guide/env-and-mode#node-env-and-modes). `bun test` sets NODE_ENV to "test", and with it
  // the prerender fails, because the server bundle then calls React's development JSX runtime. So the build pins
  // NODE_ENV for its own run and gives the caller's value back.
  const callersNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    // createBuilder() and buildApp() are the programmatic `vite build --app`, which builds every environment:
    // https://vite.dev/guide/api-environment-frameworks#building-programmatically-with-createbuilder
    // Nitro reads the `nitro` key of the Vite config, and its Vercel preset puts the functions and the static
    // folder inside output.dir: https://nitro.build/docs/vite#configuring-nitro-with-vite
    const builder = await createBuilder({
      configFile: VITE_CONFIG,
      nitro: { output: { dir: resolve(outDir, ".vercel/output") } },
    });
    await builder.buildApp();
  } finally {
    if (callersNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = callersNodeEnv;
  }
}
