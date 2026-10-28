// `bun run preview`: serves a built Vercel output as Vercel serves it (SPEC-site, Commands; SPEC-deploy, "Changes to
// other specs", SPEC-site item 7). The browser test and the smoke test serve the seam-1 folder with it.
//
//   bun run preview                  serves .vercel/output/ under the repository, at http://localhost:4173
//   bun run preview --dir <folder>   serves <folder>/.vercel/output/ instead, as `bun run build:site --out <folder>`
//                                    writes it
//   bun run preview --port <n>       listens on port n; 0 lets the system choose a free port
//
// A relative folder starts at the working folder, which `bun run` sets to the repository.
//
// It follows the output's config.json, Vercel's Build Output API (https://vercel.com/docs/build-output-api/configuration):
// the routes in order, before and after the filesystem phase, with their headers and status codes, and the overrides.
// Where Vercel's documents are silent, it does what the deploy spike saw on Vercel (research 12, "Deploy spike
// verdicts"). It reads the output once, at start, as a deployment is fixed: restart it after a new build. A route field
// or phase it does not follow stops it at start, so it never serves a config.json other than Vercel would.

import { realpath } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { Glob } from "bun";

const REPO = resolve(import.meta.dir, "..");

/** A `has` condition: the request's host equals a value. Each host redirect of writeVercelConfig() uses this form. */
type HostCondition = { type: "host"; value: { eq: string } };

/** A route of config.json, in the fields this preview follows. */
type Route = {
  src: string;
  dest?: string;
  headers?: Record<string, string>;
  status?: number;
  continue?: boolean;
  caseSensitive?: boolean;
  has?: HostCondition[];
};

/** A route, ready to match: its anchored pattern. */
type CompiledRoute = Route & { pattern: RegExp };

type Config = {
  routes?: (Route | { handle: string })[];
  overrides?: Record<string, { path?: string; contentType?: string }>;
};

/** A static file, with the content type its override gives it. */
type StaticFile = { file: string; contentType?: string };

/** The route fields this preview follows. Any other field stops it at start, named. */
const ROUTE_FIELDS = new Set(["src", "dest", "headers", "status", "continue", "caseSensitive", "has"]);

/** Vercel's own cache-control for a static file and a redirect (spike checks 4 and 5, research 12). */
const DEFAULT_CACHE_CONTROL = "public, max-age=0, must-revalidate";

/** Prints why the preview cannot start, and stops. */
function fail(message: string): never {
  console.error(`bun run preview: ${message}`);
  process.exit(1);
}

/**
 * The routes before and after the filesystem phase. Vercel anchors each `src` with ^ and $, and matches it without
 * regard to case unless the route is caseSensitive (@vercel/routing-utils, normalizeRoutes; the vercel.json reference:
 * "With routes, the src property is case-insensitive").
 */
function compileRoutes(routes: Config["routes"] = []): { before: CompiledRoute[]; after: CompiledRoute[] } {
  const phases: { before: CompiledRoute[]; after: CompiledRoute[] } = { before: [], after: [] };
  let phase: "before" | "after" = "before";
  routes.forEach((route, i) => {
    if ("handle" in route) {
      if (route.handle !== "filesystem" || Object.keys(route).length !== 1 || phase === "after") {
        fail(`route ${i} is ${JSON.stringify(route)}; the preview follows one { "handle": "filesystem" } only`);
      }
      phase = "after";
      return;
    }
    const unknown = Object.keys(route).filter((field) => !ROUTE_FIELDS.has(field));
    if (unknown.length > 0) {
      fail(`route ${i} has ${unknown.map((field) => `"${field}"`).join(", ")}, which the preview does not follow`);
    }
    for (const condition of route.has ?? []) {
      const value = condition.value as unknown;
      const keys = typeof value === "object" && value !== null ? Object.keys(value) : [];
      const isHostEq = condition.type === "host" && keys.length === 1 && keys[0] === "eq";
      if (!isHostEq) {
        fail(`route ${i} has the condition ${JSON.stringify(condition)}; the preview follows { eq } on the host only`);
      }
    }
    // A dest that is a full URL, or that carries a query, is a form no route of writeVercelConfig() has.
    if (route.dest !== undefined && (!route.dest.startsWith("/") || route.dest.includes("?"))) {
      fail(`route ${i} has the dest ${route.dest}; the preview follows a path with no query only`);
    }
    const src = `${route.src.startsWith("^") ? "" : "^"}${route.src}${route.src.endsWith("$") ? "" : "$"}`;
    phases[phase].push({ ...route, pattern: new RegExp(src, route.caseSensitive ? "" : "i") });
  });
  return phases;
}

/**
 * Each static file by the path that serves it. An override serves its file at its own path only: Vercel's overrides
 * example answers 404 at the file's stored path (https://github.com/vercel/examples/tree/main/build-output-api/overrides).
 * Vercel also serves `<path>/index.html` at `<path>` with no override, and index.html at / (spike check 2).
 */
async function indexStaticFiles(
  staticDir: string,
  overrides: Config["overrides"] = {},
): Promise<Map<string, StaticFile>> {
  const files = new Map<string, StaticFile>();
  const staticRoot = await realpath(staticDir);
  for await (const path of new Glob("**/*").scan({ cwd: staticDir, dot: true })) {
    const file = join(staticDir, path);
    // Only files inside the static folder: a link that leads out of it would serve any file on this machine.
    if (!(await realpath(file)).startsWith(staticRoot + sep)) {
      fail(`static/${path} links to a file outside the static folder`);
    }
    const override = overrides[path];
    const served = { file, contentType: override?.contentType };
    if (override?.path !== undefined) {
      files.set(`/${override.path.replace(/^\//, "")}`, served);
      continue;
    }
    files.set(`/${path}`, served);
    if (path === "index.html" || path.endsWith("/index.html")) {
      files.set(`/${path.slice(0, -"/index.html".length)}`, served);
    }
  }
  return files;
}

/**
 * The path of each function: the folder `functions/<path>.func`, with its `.vc-config.json`
 * (https://vercel.com/docs/build-output-api/primitives#functions). Nitro can write a function folder as a link to
 * `__server.func`, so the scan follows links (src/deploy/routes.ts).
 */
async function indexFunctions(functionsDir: string): Promise<Set<string>> {
  const functions = new Set<string>();
  const configs = new Glob("**/*.func/.vc-config.json").scan({ cwd: functionsDir, dot: true, followSymlinks: true });
  for await (const configPath of configs) functions.add(`/${configPath.slice(0, -".func/.vc-config.json".length)}`);
  return functions;
}

/** A route's template with the match's groups in it: $1, $2 and $name, each passed through `encode`. */
function fill(template: string, match: RegExpExecArray, encode: (value: string) => string = (value) => value): string {
  return template.replace(/\$(\d+|[A-Za-z_]\w*)/g, (_, key: string) => {
    const value = /^\d+$/.test(key) ? match[Number(key)] : match.groups?.[key];
    return encode(value ?? "");
  });
}

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: { dir: { type: "string" }, port: { type: "string" } },
  strict: true,
});
const outputDir = join(resolve(values.dir ?? REPO), ".vercel/output");
const port = Number(values.port ?? "4173");
if (!Number.isInteger(port) || port < 0 || port > 65_535) fail(`--port ${values.port} is not a port number`);

const configFile = Bun.file(join(outputDir, "config.json"));
if (!(await configFile.exists())) fail(`no Vercel output in ${outputDir}; run bun run build:site first`);
const config = (await configFile.json()) as Config;
const routes = compileRoutes(config.routes);
const files = await indexStaticFiles(join(outputDir, "static"), config.overrides);
const functions = await indexFunctions(join(outputDir, "functions"));

/** The routing so far: the path, as routes rewrite it, and the headers the matching routes set. */
type Routing = { path: string; headers: Headers };

/** Whether a route's status and headers make a redirect: a status from 300 to 399 with a Location. */
const isRedirect = (status: number | undefined, headers: Headers) =>
  status !== undefined && status >= 300 && status < 400 && headers.has("location");

/** The route's match on the path, or null when the route or one of its host conditions does not match. */
function matchRoute(route: CompiledRoute, host: string, path: string): RegExpExecArray | null {
  if (!(route.has ?? []).every((condition) => condition.value.eq === host)) return null;
  return route.pattern.exec(path);
}

/** Sets a matching route's headers, a later route's value replacing an earlier one's (spike check 4). */
function setHeaders(route: CompiledRoute, match: RegExpExecArray, headers: Headers): void {
  // A header value goes on the wire, so a group from the decoded path is encoded again there.
  for (const [name, value] of Object.entries(route.headers ?? {})) headers.set(name, fill(value, match, encodeURI));
}

/**
 * Runs one phase's routes. A route that matches sets its headers and rewrites the path to its dest. With `continue` the
 * phase goes on; without it the routing ends, and the route's status (if any) is returned.
 */
function runPhase(phase: CompiledRoute[], host: string, routing: Routing): { status?: number } | undefined {
  for (const [i, route] of phase.entries()) {
    const match = matchRoute(route, host, routing.path);
    if (!match) continue;
    setHeaders(route, match, routing.headers);
    if (route.dest !== undefined) routing.path = fill(route.dest, match);
    if (route.continue) continue;
    // A redirect still gets the headers of the phase's later `continue` routes: on Vercel the host redirect, the first
    // route, answered its 308 with the header routes' headers (spike check 5). Vercel's local router, `vercel dev`,
    // stops at the redirect instead (packages/cli/src/util/dev/router.ts); the preview follows the platform.
    if (isRedirect(route.status, routing.headers)) {
      for (const later of phase.slice(i + 1).filter((other) => other.continue)) {
        const laterMatch = matchRoute(later, host, routing.path);
        if (laterMatch) setHeaders(later, laterMatch, routing.headers);
      }
    }
    return { status: route.status };
  }
  return undefined;
}

/** Vercel's own answer when no file and no function serves a path. */
function notFound(headers: Headers): Response {
  headers.set("content-type", "text/plain; charset=utf-8");
  return new Response("The page could not be found.\n\nNOT_FOUND\n", { status: 404, headers });
}

/**
 * Serves a path from the filesystem: a static file, with Vercel's own headers under the routes' headers, or a
 * function. Vercel names the served path's last part in content-disposition, and sends `inline` alone for / (spike
 * check 4).
 */
function serve(path: string, status: number | undefined, routeHeaders: Headers): Response {
  const hit = files.get(path);
  if (hit) {
    const file = Bun.file(hit.file);
    const headers = new Headers({
      "content-type": hit.contentType ?? file.type,
      "content-disposition": path === "/" ? "inline" : `inline; filename="${basename(path)}"`,
      "cache-control": DEFAULT_CACHE_CONTROL,
    });
    for (const [name, value] of routeHeaders) headers.set(name, value);
    return new Response(file, { status: status ?? 200, headers });
  }
  if (functions.has(path)) {
    // Task S31 makes the preview answer through the function's own index.mjs. Until then it says it does not.
    routeHeaders.set("content-type", "text/plain; charset=utf-8");
    return new Response(`The preview runs no function yet: ${path}\n`, { status: 501, headers: routeHeaders });
  }
  return notFound(routeHeaders);
}

/** Answers one request as Vercel's routing does: the routes before the filesystem, the filesystem, the routes after. */
function answer(request: Request): Response {
  const url = new URL(request.url);
  let path: string;
  try {
    // Vercel matches routes against the decoded path: a route on /api/chat also matches /api/%63hat (spike check 8).
    path = decodeURIComponent(url.pathname);
  } catch {
    return new Response("The path's percent-encoding is malformed.\n", { status: 400 });
  }
  const routing: Routing = { path, headers: new Headers() };
  const ended = runPhase(routes.before, url.hostname, routing);
  if (ended) return finish(ended.status, routing, url);
  if (files.has(routing.path) || functions.has(routing.path)) return serve(routing.path, undefined, routing.headers);
  const missed = runPhase(routes.after, url.hostname, routing);
  if (missed) return finish(missed.status, routing, url);
  return notFound(routing.headers);
}

/**
 * Ends the routing at a route without `continue`. A status from 300 to 399 with a Location is a redirect, to which
 * Vercel adds the request's query, writing a `+` as `%20` (spike check 5). Any other route serves its path.
 */
function finish(status: number | undefined, routing: Routing, url: URL): Response {
  if (isRedirect(status, routing.headers)) {
    routing.headers.set("location", `${routing.headers.get("location")}${url.search.replace(/\+/g, "%20")}`);
    if (!routing.headers.has("cache-control")) routing.headers.set("cache-control", DEFAULT_CACHE_CONTROL);
    return new Response(null, { status, headers: routing.headers });
  }
  return serve(routing.path, status, routing.headers);
}

const server = Bun.serve({
  hostname: "localhost",
  port,
  development: false,
  fetch: answer,
  error(error) {
    console.error(error);
    return new Response("The preview failed on this request.\n", { status: 500 });
  },
});
console.log(`Preview: ${server.url} serving ${outputDir}`);

// A stop request (Ctrl-C, or the browser test's kill) is the normal end of a preview: it stops listening and exits
// with 0, so `bun run` reports no error.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void server.stop(true);
    process.exit(0);
  });
}
