// writeVercelConfig(outputDir): the routes of Nitro's Vercel output (SPEC-deploy, "Routes"), step 5 of the build
// script. Nitro's own routes end with `/(.*)` to `/__server`, which renders every path that is not a file in a function
// at request time, with no policy tag. So this step replaces Nitro's routes with the spec's list and keeps Nitro's
// other fields. The route forms are the ones the deploy spike ran on Vercel (research 12, "Deploy spike verdicts"), and the
// fields follow Vercel's Build Output API: https://vercel.com/docs/build-output-api/configuration
import type { Stats } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { Glob } from "bun";
import { SITE_ADDRESS } from "../site/page-head";

/** The domains that answer with a 308 to the same path and query on peterkloss.dev (decision 0018). */
export const REDIRECT_HOSTS = ["pkloss.dev", "pwk.dev", "www.peterkloss.dev"] as const;

/**
 * The project's public .vercel.app address, which redirects as the domains do, except its /api/ paths. Vercel gives it
 * when Peter imports the project, so setup step 11 (task D37) writes it here; until then no route names it.
 */
export const VERCEL_APP_HOST: string | undefined = undefined;

/**
 * The three paths that run as functions, and the function folder each runs in. The chat has its own folder, from
 * Nitro's `vercel.functionRules` (task D20); the status route and the health job run in Nitro's `__server`.
 */
const API_ROUTES = [
  { path: "/api/chat", fn: "/api/chat" },
  { path: "/api/status", fn: "/__server" },
  { path: "/api/cron/health", fn: "/__server" },
] as const;

/** The not-found page that buildSite() writes. Every path that is neither a file nor an API path gets it, with 404. */
const NOT_FOUND_PAGE = "/404.html";

/** The Vercel health job: Vercel Cron calls it daily at 15:17 UTC (SPEC-deploy, "Smoke check and health checks"). */
const CRON = { path: "/api/cron/health", schedule: "17 15 * * *" } as const;

/** One route of config.json. */
type Route = Record<string, unknown>;

/** An entry of `overrides`: the address that serves one static file, and its content type. */
type Override = { path?: string; contentType?: string };

/** The fields of config.json that this step writes. Nitro's other fields pass through as they are. */
type VercelConfig = {
  routes?: Route[];
  overrides?: Record<string, Override>;
  crons?: { path: string; schedule: string }[];
  [field: string]: unknown;
};

/**
 * A 308 from one host to the same path on peterkloss.dev. `has` matches the host exactly, never a pattern such as
 * `*.vercel.app`: a pattern would also match each deployment's own address, which Vercel Cron calls and the release
 * check's smoke check loads (spike check 6). Vercel adds the request's query to Location, so the route names none;
 * Vercel writes the query again, so a `+` becomes `%20` (spike check 5).
 */
function hostRedirect(host: string, src: string): Route {
  const location = `${SITE_ADDRESS}/$1`;
  return { src, has: [{ type: "host", value: { eq: host } }], status: 308, headers: { Location: location } };
}

/** A literal path inside a route's `src`, which is a regular expression (PCRE). */
const literal = (path: string) => path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** What a symbolic link points to. A link to a missing path stops the build and names the link. */
async function linkTarget(link: string): Promise<Stats> {
  try {
    return await stat(link);
  } catch (e) {
    if ((e as { code?: string }).code !== "ENOENT") throw e;
    throw new Error(`writeVercelConfig: ${link} is a symbolic link to a missing path`, { cause: e });
  }
}

/**
 * The URL path of each function folder in the output, sorted: `functions/api/chat.func` is `/api/chat`. Vercel serves
 * a function folder at that path (https://vercel.com/docs/build-output-api/primitives#functions). Only a folder whose
 * name ends in `.func` is one; a plain file with such a name is not. The scan follows symbolic links, because Nitro can
 * write a per-route folder as a link to `__server.func` (its observability routes, from compatibility date 2025-07-15;
 * nitro 3.0.260903-beta, dist/_presets.mjs). It stops at each `.func` folder: what is inside belongs to that function.
 */
async function findFunctionFolders(outputDir: string): Promise<string[]> {
  const folders: string[] = [];
  async function scan(dir: string, path: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const entryPath = join(dir, entry.name);
      // A link counts as what it points to, so a linked folder is a folder like any other.
      const isFolder = entry.isSymbolicLink() ? (await linkTarget(entryPath)).isDirectory() : entry.isDirectory();
      if (!isFolder) continue;
      if (entry.name.endsWith(".func")) folders.push(`${path}/${entry.name.slice(0, -".func".length)}`);
      else await scan(entryPath, `${path}/${entry.name}`);
    }
  }
  const functionsDir = join(outputDir, "functions");
  if (!(await stat(functionsDir).catch(() => undefined))?.isDirectory()) {
    throw new Error(`writeVercelConfig: no functions folder in ${outputDir}, so no Vercel output`);
  }
  await scan(functionsDir, "");
  return folders.sort();
}

/**
 * Nitro's overrides, plus one for each prerendered page, `<path>/index.html`, that serves it at its clean address,
 * `<path>`. The home page, index.html, is served at / without one. A page's override keeps Nitro's other fields.
 */
async function withPageOverrides(
  staticDir: string,
  nitro: Record<string, Override> = {},
): Promise<Record<string, Override>> {
  const overrides = { ...nitro };
  const pages = (await Array.fromAsync(new Glob("**/index.html").scan({ cwd: staticDir }))).sort();
  for (const page of pages) {
    if (page !== "index.html") overrides[page] = { ...nitro[page], path: page.slice(0, -"/index.html".length) };
  }
  return overrides;
}

export type VercelConfigOptions = {
  /** The project's .vercel.app address; VERCEL_APP_HOST when left out. A test passes one before task D37 writes it. */
  vercelAppHost?: string;
};

/**
 * Replaces the routes in `<outputDir>/config.json`, Nitro's Vercel output, with SPEC-deploy's list, adds an override
 * for each prerendered page and the cron, and keeps Nitro's other fields. Only the three API paths then run as
 * functions; every other path is a file, or the not-found page with status 404. Returns the function folders that got
 * the not-found page, as URL paths.
 */
export async function writeVercelConfig(
  outputDir: string,
  { vercelAppHost = VERCEL_APP_HOST }: VercelConfigOptions = {},
): Promise<string[]> {
  const file = Bun.file(join(outputDir, "config.json"));
  if (!(await file.exists())) throw new Error(`writeVercelConfig: no config.json in ${outputDir}, so no Vercel output`);
  const nitro = (await file.json()) as VercelConfig;
  // A function folder whose path is an API path is that route's own function; every other one must not answer.
  const unnamedFolders = (await findFunctionFolders(outputDir)).filter(
    (path) => !API_ROUTES.some((route) => route.path === path),
  );
  const routes: Route[] = [
    // 1. Host redirects. The .vercel.app route leaves /api/ alone, so the API stays reachable on that address.
    ...REDIRECT_HOSTS.map((host) => hostRedirect(host, "^/(.*)$")),
    ...(vercelAppHost ? [hostRedirect(vercelAppHost, "^/(?!api/)(.*)$")] : []),
    // 2. Headers, each route with continue: true: task D18.
    // 3. Function folders. Each one that no API route names gets the not-found page at its own path, before the
    //    filesystem phase would serve the function there (spike check 3). A route's dest still reaches the folder.
    ...unnamedFolders.map((path) => ({ src: `^${literal(path)}(?:/.*)?$`, dest: NOT_FOUND_PAGE, status: 404 })),
    // 4. The files, each prerendered page also at its clean address through its override.
    { handle: "filesystem" },
    // 5. The three API routes. Each is case-sensitive, because routes otherwise match without regard to case, and
    //    /API/chat would reach the chat's function (spike check 3). The function sees the asked path (spike check 2).
    ...API_ROUTES.map((route) => ({ src: `^${literal(route.path)}$`, dest: route.fn, caseSensitive: true })),
    // 6. Every other path gets the not-found page. No route sends a page or /_serverFn/ to a function.
    { src: "^/(.*)$", dest: NOT_FOUND_PAGE, status: 404 },
  ];
  const overrides = await withPageOverrides(join(outputDir, "static"), nitro.overrides);
  const config: VercelConfig = { ...nitro, overrides, routes, crons: [{ ...CRON }] };
  await Bun.write(file, `${JSON.stringify(config, null, 2)}\n`);
  return unnamedFolders;
}
