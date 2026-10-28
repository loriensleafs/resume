// Seam 1 of SPEC-deploy at unit level (tasks/modules/deploy.md, Notes): addPolicyTags() on a fixture static folder,
// writeVercelConfig() on a fixture of Nitro's Vercel output, and the settings in code that Vercel and Bun read from the
// checkout: vercel.json, and no .env file (task D8).
// The checks of the built output (each built page's own tag, no style attribute) live once, in the site's build test,
// src/site/__tests__/build.test.ts.
// Each expected hash is a literal from outside this code. 'sha256-B2yPHKaXnvFWtRChIbabYmUBFZdVfKKXHbWtWidDVF8=' is
// MDN's worked example for `var inline = 1;`
// (https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src).
// The others come from `printf '<script text>' | openssl dgst -sha256 -binary | base64`.

import { afterAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { existsSync } from "node:fs";
import { mkdir, readdir, symlink } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { addPolicyTags } from "../policy";
import { writeVercelConfig } from "../routes";

const REPO = resolve(import.meta.dir, "../../..");
const tmp = `${Bun.env.TMPDIR ?? "/tmp"}/deploy-config-test-${crypto.randomUUID()}`;

/** Writes the pages into a new static folder and returns its path. */
async function staticFolder(name: string, pages: Record<string, string>): Promise<string> {
  const dir = `${tmp}/${name}`;
  for (const [path, html] of Object.entries(pages)) await Bun.write(`${dir}/${path}`, html);
  return dir;
}

/**
 * The paths, from root, of every entry under root whose name starts with ".env", ignored files included. It leaves out
 * installed packages (node_modules), git's own folder and each nested checkout, a folder with its own .git, such as an
 * agent's worktree under .claude/worktrees/. It follows no symbolic link.
 */
async function envFiles(root: string, dir = root): Promise<string[]> {
  const found: string[] = [];
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.name.startsWith(".env")) found.push(path.slice(root.length + 1));
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === ".git" || existsSync(`${path}/.git`)) {
      continue;
    }
    found.push(...(await envFiles(root, path)));
  }
  return found;
}

/** One route of config.json, in the shape of Vercel's Build Output API. */
type Route = { src?: string; dest?: string; handle?: string; [field: string]: unknown };

/**
 * The config.json that Nitro's Vercel preset wrote in a local build of the site (nitro 3.0.260903-beta): its immutable
 * rule for /assets/, the filesystem, and every other path to its server function.
 */
const NITRO_CONFIG = {
  version: 3,
  framework: { name: "nitro", version: "3.0.260903-beta" },
  overrides: {},
  routes: [
    { headers: { "cache-control": "public, max-age=31536000, immutable" }, src: "/assets/(.*)" },
    { handle: "filesystem" },
    { src: "/(.*)", dest: "/__server" },
  ],
};

/**
 * Writes a fixture of Nitro's Vercel output and returns its .vercel/output path: config.json, a function folder for
 * each of `functions` (with its .vc-config.json), a symbolic link to `__server.func` for each of `links`, as Nitro
 * writes its per-route folders, and each of `files` under static/.
 */
async function nitroOutput(
  name: string,
  parts: { config?: object; functions?: string[]; links?: string[]; files?: string[] } = {},
): Promise<string> {
  const output = `${tmp}/${name}/.vercel/output`;
  const { config = NITRO_CONFIG, functions = ["__server"], links = [], files = ["index.html", "404.html"] } = parts;
  await Bun.write(`${output}/config.json`, JSON.stringify(config, null, 2));
  for (const fn of functions) {
    await Bun.write(`${output}/functions/${fn}.func/.vc-config.json`, '{ "handler": "index.mjs" }');
  }
  // Nitro's link is relative, "./" plus the path from the link's folder (nitro 3.0.260903-beta, dist/_presets.mjs).
  for (const fn of links) {
    const link = `${output}/functions/${fn}.func`;
    await mkdir(dirname(link), { recursive: true });
    await symlink(`./${relative(dirname(link), `${output}/functions/__server.func`)}`, link);
  }
  for (const file of files) await Bun.write(`${output}/static/${file}`, `<!-- ${file} -->`);
  return output;
}

/** The routes that writeVercelConfig() wrote into the output's config.json. */
async function routesOf(output: string): Promise<Route[]> {
  return (await Bun.file(`${output}/config.json`).json()).routes;
}

/** The headers that one route sets, by name; none for a route without headers. */
const headersOf = (route: Route) => (route.headers ?? {}) as Record<string, string>;

/**
 * The response headers that the routes before the filesystem give a request for `path` on peterkloss.dev, merged as
 * the deploy spike saw Vercel merge them (spike check 4, with a control): every matching route adds its headers, and
 * for one header name the last matching route wins. A route matches without regard to case unless it sets
 * caseSensitive (research 12, vercel.json reference). A route without continue ends the list, and a route with a host
 * condition matches no request for peterkloss.dev.
 */
function servedHeaders(routes: Route[], path: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const route of routes) {
    if (route.handle !== undefined) break;
    if (route.has !== undefined || !new RegExp(route.src!, route.caseSensitive ? "" : "i").test(path)) continue;
    Object.assign(headers, headersOf(route));
    if (route.continue !== true) break;
  }
  return headers;
}

// SPEC-deploy, "Headers": the table's six headers and the two policies, as literals. The names are in lower case, as
// the spike's header routes wrote them.
// SIX_HEADERS names the same set as SECURITY_HEADERS in src/deploy/routes.ts.
const SIX_HEADERS = {
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  "cross-origin-opener-policy": "same-origin",
  "x-frame-options": "DENY",
};
const HEADER_POLICY =
  "style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; " +
  "worker-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const WORKER_POLICY =
  "style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; " +
  "worker-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; " +
  "frame-ancestors 'none'; script-src 'self'";

/**
 * One path of each kind the site serves: pages, the not-found page from the last route and from a function folder's
 * route, a function, the hashed files, the service worker and Workbox's file, the files with fixed names, and the
 * three documents. The fixture's output has the function folders `__server` and `api/chat`.
 */
const SERVED_PATHS = [
  "/",
  "/resume",
  "/sources/agent-workflows",
  "/no-such-page",
  "/__server",
  "/api/chat",
  "/assets/main-CtqVfDmn.js",
  "/assets/main-B2yPHKaX.css",
  "/sw.js",
  "/workbox-1ce433d4.js",
  "/manifest.webmanifest",
  "/device-index.json",
  "/icons/icon-192.png",
  "/Peter-Kloss-Resume.pdf",
  "/Peter-Kloss-Resume.docx",
  "/Peter-Kloss-Resume.txt",
];

afterAll(async () => {
  await $`rm -rf ${tmp}`.quiet().nothrow();
});

describe("addPolicyTags()", () => {
  test("puts the page's policy tag first in its <head> and changes nothing else", async () => {
    const page =
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Home</title></head>' +
      '<body><main>Home</main><script>var inline = 1;</script></body></html>';
    const dir = await staticFolder("one-page", { "index.html": page });

    await addPolicyTags(dir);

    expect(await Bun.file(`${dir}/index.html`).text()).toBe(
      page.replace(
        "<head>",
        `<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' ` +
          `'sha256-B2yPHKaXnvFWtRChIbabYmUBFZdVfKKXHbWtWidDVF8='">`,
      ),
    );
  });

  test("lists each inline script's hash once, in page order, and no hash for a script with src", async () => {
    const dir = await staticFolder("scripts", {
      "index.html":
        "<!doctype html><html><head><title>Home</title></head><body>" +
        "<script>var inline = 1;</script>" +
        '<script type="module" src="/assets/app.js"></script>' +
        "<script>var other = 2;</script>" +
        "<script>var inline = 1;</script>" +
        "</body></html>",
    });

    await addPolicyTags(dir);

    expect(await Bun.file(`${dir}/index.html`).text()).toStartWith(
      `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; ` +
        `script-src 'self' 'sha256-B2yPHKaXnvFWtRChIbabYmUBFZdVfKKXHbWtWidDVF8=' ` +
        `'sha256-mDAj095ZDa2VvLUffwPkMbb0rqMdZMss59PqabEj5ZY='"><title>`,
    );
  });

  test("gives each HTML file, in any folder, the hashes of its own inline scripts only", async () => {
    const dir = await staticFolder("pages", {
      "index.html": "<html><head></head><body><script>var inline = 1;</script></body></html>",
      "resume/index.html": "<html><head></head><body><script>var other = 2;</script></body></html>",
    });

    await addPolicyTags(dir);

    expect(await Bun.file(`${dir}/index.html`).text()).toStartWith(
      `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; ` +
        `script-src 'self' 'sha256-B2yPHKaXnvFWtRChIbabYmUBFZdVfKKXHbWtWidDVF8='"></head>`,
    );
    expect(await Bun.file(`${dir}/resume/index.html`).text()).toStartWith(
      `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; ` +
        `script-src 'self' 'sha256-mDAj095ZDa2VvLUffwPkMbb0rqMdZMss59PqabEj5ZY='"></head>`,
    );
  });

  // The HTML parser turns CR LF and a lone CR into LF before a script's text exists
  // (https://html.spec.whatwg.org/multipage/parsing.html#preprocessing-the-input-stream), and the browser hashes that
  // text. The literal is the hash of "var a = 1;\nvar b = 2;\n".
  test("hashes the script text the browser parses, with CR LF and a lone CR as LF", async () => {
    const dir = await staticFolder("newlines", {
      "index.html": "<html><head></head><body><script>var a = 1;\r\nvar b = 2;\r</script></body></html>",
    });

    await addPolicyTags(dir);

    expect(await Bun.file(`${dir}/index.html`).text()).toStartWith(
      `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; ` +
        `script-src 'self' 'sha256-wpN3pHOJg4wfHiikUaAxsdhu7ZP8zXhm5aZ+OS31NBc='"></head>`,
    );
  });

  test("gives a page with no inline script `script-src 'self'` alone", async () => {
    const dir = await staticFolder("no-script", {
      "404.html": "<html><head><title>Page not found</title></head><body><h1>Page not found</h1></body></html>",
    });

    await addPolicyTags(dir);

    expect(await Bun.file(`${dir}/404.html`).text()).toStartWith(
      `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">` +
        "<title>",
    );
  });

  // Each refusal fails the build where the page would otherwise go out with no policy tag, or with two policies.
  test("refuses a page with no <head>, and names it", async () => {
    const dir = await staticFolder("no-head", {
      "index.html": "<html><head></head><body></body></html>",
      "fragment.html": "<p>No head here.</p><script>var inline = 1;</script>",
    });

    await expect(addPolicyTags(dir)).rejects.toThrow(`${dir}/fragment.html must have only`);
  });

  // A script before the policy tag runs with no policy, so its hash in the tag would protect nothing.
  test("refuses a page with a script before its <head>, and names it", async () => {
    const dir = await staticFolder("script-first", {
      "index.html": "<!doctype html><script>var inline = 1;</script><html><head></head><body></body></html>",
    });

    await expect(addPolicyTags(dir)).rejects.toThrow(`${dir}/index.html must have only`);
  });

  // The browser ignores a <head> start tag inside <body>, and a policy tag outside <head>
  // (https://html.spec.whatwg.org/multipage/semantics.html#attr-meta-http-equiv-content-security-policy).
  test("refuses a page whose <head> sits inside <body>, and names it", async () => {
    const dir = await staticFolder("head-in-body", {
      "index.html": "<html><body><head></head><script>var inline = 1;</script></body></html>",
    });

    await expect(addPolicyTags(dir)).rejects.toThrow(`${dir}/index.html must have only`);
  });

  // The browser's tokenizer ends "<!-->" at once, so the script after it runs; a comment rule that read on to the
  // next "-->" would take that script for comment text.
  test("refuses a script after <!-->, which the browser does not read as a comment", async () => {
    const dir = await staticFolder("short-comment", {
      "index.html": "<!--><script>var inline = 1;</script><!-- --><html><head></head><body></body></html>",
    });

    await expect(addPolicyTags(dir)).rejects.toThrow(`${dir}/index.html must have only`);
  });

  // A comment rule that may end at any later "-->" gives k comments about 2^k ways to split, so this page once took
  // hours to refuse (D16 security review). The bound only has to tell a linear check from that, with room for a slow
  // CI runner.
  test("refuses a page with 40 comments and then a script before <head>, in under 500 ms", async () => {
    const dir = await staticFolder("many-comments", {
      "index.html": `${"<!--a-->".repeat(40)}<script>var inline = 1;</script><html><head></head></html>`,
    });

    const started = performance.now();
    await expect(addPolicyTags(dir)).rejects.toThrow(`${dir}/index.html must have only`);
    const elapsed = performance.now() - started;

    console.log(`40 comments refused in ${elapsed.toFixed(1)} ms`);
    expect(elapsed).toBeLessThan(500);
  });

  test("accepts a doctype, whitespace, comments and <html> before <head>, and puts the tag right after <head>", async () => {
    const start = "<!-- built -->\n<!DOCTYPE html>\n<!-- page -->\n<HTML lang=\"en\" class='a b'>\n  <head data-x=y>";
    const page = `${start}<title>Home</title></head><body><script>var inline = 1;</script></body></HTML>`;
    const dir = await staticFolder("preamble", { "index.html": page });

    await addPolicyTags(dir);

    expect(await Bun.file(`${dir}/index.html`).text()).toBe(
      `${start}<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' ` +
        `'sha256-B2yPHKaXnvFWtRChIbabYmUBFZdVfKKXHbWtWidDVF8='">${page.slice(start.length)}`,
    );
  });

  test("refuses a page that already has a policy tag, and names it", async () => {
    const dir = await staticFolder("tagged", {
      "index.html":
        '<html><head><meta http-equiv="content-security-policy" content="script-src \'self\'"></head></html>',
    });

    await expect(addPolicyTags(dir)).rejects.toThrow(`${dir}/index.html already has a policy tag`);
  });

  test("refuses a static folder with no HTML file, and names the folder", async () => {
    const dir = await staticFolder("no-pages", { "assets/app.js": "console.log(1);" });

    await expect(addPolicyTags(dir)).rejects.toThrow(`no HTML file under ${dir}`);
  });
});

// The expected routes are SPEC-deploy's, "Routes", "Headers" and "Caching", in the form that the deploy spike ran on
// Vercel (research 12, "Deploy spike verdicts", checks 2 to 6).
describe("writeVercelConfig()", () => {
  test("redirects pkloss.dev, pwk.dev and www.peterkloss.dev first, each by its exact host, with 308 to peterkloss.dev", async () => {
    const output = await nitroOutput("redirects");

    await writeVercelConfig(output);

    expect((await routesOf(output)).slice(0, 3)).toEqual([
      {
        src: "^/(.*)$",
        has: [{ type: "host", value: { eq: "pkloss.dev" } }],
        status: 308,
        headers: { Location: "https://peterkloss.dev/$1" },
      },
      {
        src: "^/(.*)$",
        has: [{ type: "host", value: { eq: "pwk.dev" } }],
        status: 308,
        headers: { Location: "https://peterkloss.dev/$1" },
      },
      {
        src: "^/(.*)$",
        has: [{ type: "host", value: { eq: "www.peterkloss.dev" } }],
        status: 308,
        headers: { Location: "https://peterkloss.dev/$1" },
      },
    ]);
  });

  // Vercel gives the project's .vercel.app address when Peter imports the project; task D37 writes it into routes.ts.
  test("names no .vercel.app host until task D37 writes the project's address", async () => {
    const output = await nitroOutput("no-vercel-app");

    await writeVercelConfig(output);

    expect(JSON.stringify(await routesOf(output))).not.toContain("vercel.app");
  });

  test("redirects the project's .vercel.app address after the domains, except its /api/ paths", async () => {
    const output = await nitroOutput("vercel-app");

    await writeVercelConfig(output, { vercelAppHost: "resume-test.vercel.app" });

    const route = (await routesOf(output))[3]!;
    expect(route).toEqual({
      src: "^/(?!api/)(.*)$",
      has: [{ type: "host", value: { eq: "resume-test.vercel.app" } }],
      status: 308,
      headers: { Location: "https://peterkloss.dev/$1" },
    });
    // Vercel matches a route's src without regard to case (research 12, vercel.json reference), as the "i" flag does.
    const src = new RegExp(route.src!, "i");
    expect(["/", "/resume", "/sources/agent-workflows", "/api"].filter((path) => !src.test(path))).toEqual([]);
    expect(["/api/chat", "/api/status", "/api/cron/health"].filter((path) => src.test(path))).toEqual([]);
  });

  // SPEC-deploy, "Headers": on every response, from a route on /(.*). Spike check 4 saw the six headers reach a page, a
  // function's response and the not-found page from both its routes, with the header routes before both.
  test("sets the six headers on every path, from one route on /(.*) with continue: true", async () => {
    const output = await nitroOutput("six-headers", { functions: ["__server", "api/chat"] });

    await writeVercelConfig(output);

    const routes = await routesOf(output);
    expect(routes.filter((route) => route.src === "^/(.*)$" && route.continue === true)).toEqual([
      { src: "^/(.*)$", headers: SIX_HEADERS, continue: true },
    ]);
    expect(SERVED_PATHS.filter((path) => !Bun.deepMatch(SIX_HEADERS, servedHeaders(routes, path)))).toEqual([]);
  });

  // SPEC-deploy, "Headers": "object-src 'none'" on a PDF can blank it in a browser's PDF viewer, so the documents get
  // no policy (spike check 10 passed with none). Vercel serves files by their exact names, so a document's name in
  // other letter case is the not-found page, which keeps the header policy.
  test("gives every path the header policy, except the worker files, which get the worker policy, and the documents, which get none", async () => {
    const output = await nitroOutput("policies", { functions: ["__server", "api/chat"] });

    await writeVercelConfig(output);

    const routes = await routesOf(output);
    const policyOf = (path: string) => servedHeaders(routes, path)["content-security-policy"] ?? "none";
    const paths = [...SERVED_PATHS, "/peter-kloss-resume.pdf"];
    expect(Object.fromEntries(paths.map((path) => [path, policyOf(path)]))).toEqual({
      "/": HEADER_POLICY,
      "/resume": HEADER_POLICY,
      "/sources/agent-workflows": HEADER_POLICY,
      "/no-such-page": HEADER_POLICY,
      "/__server": HEADER_POLICY,
      "/api/chat": HEADER_POLICY,
      "/assets/main-CtqVfDmn.js": HEADER_POLICY,
      "/assets/main-B2yPHKaX.css": HEADER_POLICY,
      "/sw.js": WORKER_POLICY,
      "/workbox-1ce433d4.js": WORKER_POLICY,
      "/manifest.webmanifest": HEADER_POLICY,
      "/device-index.json": HEADER_POLICY,
      "/icons/icon-192.png": HEADER_POLICY,
      "/Peter-Kloss-Resume.pdf": "none",
      "/Peter-Kloss-Resume.docx": "none",
      "/Peter-Kloss-Resume.txt": "none",
      "/peter-kloss-resume.pdf": HEADER_POLICY,
    });
  });

  // A route's headers is an object, so the worker files, which match both policy routes, get the policy of the last
  // one. Spike check 4's control run put the worker policy route first, and the worker files got the header policy.
  test("puts the worker policy route after the header policy route, because the last matching route wins", async () => {
    const output = await nitroOutput("policy-order");

    await writeVercelConfig(output);

    const routes = await routesOf(output);
    const routeIndexOf = (policy: string) =>
      routes.findIndex((route) => headersOf(route)["content-security-policy"] === policy);
    expect(routeIndexOf(HEADER_POLICY)).toBeGreaterThan(-1);
    expect(routeIndexOf(WORKER_POLICY)).toBeGreaterThan(routeIndexOf(HEADER_POLICY));
  });

  test("has no 'unsafe-inline' and no 'unsafe-eval' in any policy", async () => {
    const output = await nitroOutput("no-unsafe");

    await writeVercelConfig(output);

    const policies = (await routesOf(output)).flatMap((route) =>
      Object.entries(headersOf(route))
        .filter(([name]) => name.toLowerCase() === "content-security-policy")
        .map(([, value]) => value),
    );
    expect(policies.toSorted()).toEqual([HEADER_POLICY, WORKER_POLICY]);
    expect(policies.filter((policy) => /'unsafe-(?:inline|eval)'/.test(policy))).toEqual([]);
  });

  // SPEC-deploy, "Caching". Hashed names never change their content, so they are kept a year; every other file
  // revalidates with Vercel's default, `public, max-age=0, must-revalidate` (research 12), which spike check 4 saw on
  // the pages, /sw.js, the PDF and the not-found page. The function sets its own no-store, which spike check 4 saw kept
  // when no route set a cache rule. Vercel serves a file only by its exact name, so /ASSETS/ is the not-found page.
  test("keeps /assets/ files and Workbox's file a year, and leaves every other path to Vercel's default, which revalidates", async () => {
    const output = await nitroOutput("cache", { functions: ["__server", "api/chat"] });

    await writeVercelConfig(output);

    const routes = await routesOf(output);
    const cacheOf = (path: string) => servedHeaders(routes, path)["cache-control"] ?? "Vercel's default";
    const paths = [...SERVED_PATHS, "/ASSETS/main-CtqVfDmn.js"];
    expect(Object.fromEntries(paths.map((path) => [path, cacheOf(path)]))).toEqual({
      "/": "Vercel's default",
      "/resume": "Vercel's default",
      "/sources/agent-workflows": "Vercel's default",
      "/no-such-page": "Vercel's default",
      "/__server": "Vercel's default",
      "/api/chat": "Vercel's default",
      "/assets/main-CtqVfDmn.js": "public, max-age=31536000, immutable",
      "/assets/main-B2yPHKaX.css": "public, max-age=31536000, immutable",
      "/sw.js": "Vercel's default",
      "/workbox-1ce433d4.js": "public, max-age=31536000, immutable",
      "/manifest.webmanifest": "Vercel's default",
      "/device-index.json": "Vercel's default",
      "/icons/icon-192.png": "Vercel's default",
      "/Peter-Kloss-Resume.pdf": "Vercel's default",
      "/Peter-Kloss-Resume.docx": "Vercel's default",
      "/Peter-Kloss-Resume.txt": "Vercel's default",
      "/ASSETS/main-CtqVfDmn.js": "Vercel's default",
    });
  });

  // SPEC-deploy, "Headers": no two routes set one header under two spellings, because whether two spellings merge is
  // not tested (research 12, check 4).
  test("writes every header name of the header routes in lower case", async () => {
    const output = await nitroOutput("lower-case");

    await writeVercelConfig(output);

    const names = (await routesOf(output))
      .filter((route) => route.continue === true)
      .flatMap((route) => Object.keys(headersOf(route)));
    expect(names).toContain("cache-control");
    expect(names.filter((name) => name !== name.toLowerCase())).toEqual([]);
  });

  // The routes name the documents; `bun run documents` names the committed files (src/build.ts, BASENAME). A renamed
  // document would otherwise get the header policy and could show blank in a browser's PDF viewer.
  test("gives no policy to each committed document in documents/", async () => {
    const output = await nitroOutput("committed-documents");
    const documents = (await readdir(`${REPO}/documents`)).filter((name) => name !== "inputs.sha256");

    await writeVercelConfig(output);

    const routes = await routesOf(output);
    expect(documents).toHaveLength(3);
    const withPolicy = documents.filter((name) => servedHeaders(routes, `/${name}`)["content-security-policy"]);
    expect(withPolicy).toEqual([]);
  });

  // In the filesystem phase Vercel serves each function folder at its own path, before any later route (spike check 3:
  // /__server answered from Nitro's function). Nitro writes a per-route folder as a link to __server.func, so the
  // linked "sources/[id]" proves that the scan follows links. "api/status" is a link too, and its own API route names
  // it.
  test("before the filesystem, sends each function folder that no API route names to /404.html with status 404", async () => {
    const output = await nitroOutput("function-folders", {
      functions: ["__server", "api/chat"],
      links: ["api/status", "sources/[id]"],
    });

    await writeVercelConfig(output);

    const routes = await routesOf(output);
    const beforeFilesystem = routes.slice(0, routes.findIndex((route) => route.handle === "filesystem"));
    expect(beforeFilesystem.filter((route) => route.dest !== undefined)).toEqual([
      { src: "^/__server(?:/.*)?$", dest: "/404.html", status: 404 },
      { src: "^/sources/\\[id\\](?:/.*)?$", dest: "/404.html", status: 404 },
    ]);
  });

  // Vercel runs a folder named *.func (https://vercel.com/docs/build-output-api/primitives#functions), so a plain file
  // with that name is no function and needs no route.
  test("does not count a plain file named *.func as a function folder", async () => {
    const output = await nitroOutput("plain-func-file");
    await Bun.write(`${output}/functions/notes.func`, "not a function");

    await writeVercelConfig(output);

    const routes = await routesOf(output);
    const beforeFilesystem = routes.slice(0, routes.findIndex((route) => route.handle === "filesystem"));
    expect(beforeFilesystem.filter((route) => route.dest !== undefined)).toEqual([
      { src: "^/__server(?:/.*)?$", dest: "/404.html", status: 404 },
    ]);
  });

  // Nitro writes an override with a contentType for a prerendered file whose type its name does not give
  // (getPrerenderOverrides, nitro 3.0.260903-beta); "feed" stands for one.
  test("gives each prerendered page an override for its clean address, beside Nitro's own overrides", async () => {
    const output = await nitroOutput("overrides", {
      config: { ...NITRO_CONFIG, overrides: { feed: { contentType: "application/rss+xml" } } },
      files: ["index.html", "resume/index.html", "sources/agent-workflows/index.html", "404.html", "sitemap.xml"],
    });

    await writeVercelConfig(output);

    expect((await Bun.file(`${output}/config.json`).json()).overrides).toEqual({
      feed: { contentType: "application/rss+xml" },
      "resume/index.html": { path: "resume" },
      "sources/agent-workflows/index.html": { path: "sources/agent-workflows" },
    });
  });

  // Routes match without regard to case unless caseSensitive is set, and then /API/chat would reach the chat's
  // function (spike check 3's control run).
  test("after the filesystem, sends the three API paths to their functions, each case-sensitive", async () => {
    const output = await nitroOutput("api-routes", { functions: ["__server", "api/chat"] });

    await writeVercelConfig(output);

    const routes = await routesOf(output);
    const afterFilesystem = routes.slice(routes.findIndex((route) => route.handle === "filesystem") + 1);
    expect(afterFilesystem.slice(0, 3)).toEqual([
      { src: "^/api/chat$", dest: "/api/chat", caseSensitive: true },
      { src: "^/api/status$", dest: "/__server", caseSensitive: true },
      { src: "^/api/cron/health$", dest: "/__server", caseSensitive: true },
    ]);
  });

  // Nitro's last route, /(.*) to /__server, rendered every path that is not a file in a function at request time.
  test("sends every other path to /404.html with status 404 last, and no other path to a function", async () => {
    const output = await nitroOutput("not-found", { functions: ["__server", "api/chat"], links: ["sources/[id]"] });

    await writeVercelConfig(output);

    const routes = await routesOf(output);
    expect(routes.at(-1)).toEqual({ src: "^/(.*)$", dest: "/404.html", status: 404 });
    const toFunctions = routes.filter((route) => route.dest !== undefined && route.dest !== "/404.html");
    expect(toFunctions.map((route) => route.src)).toEqual(["^/api/chat$", "^/api/status$", "^/api/cron/health$"]);
  });

  test("keeps Nitro's other fields, and has Vercel Cron call /api/cron/health daily at 15:17 UTC", async () => {
    const output = await nitroOutput("other-fields");

    await writeVercelConfig(output);

    const { routes, overrides, ...otherFields } = await Bun.file(`${output}/config.json`).json();
    expect(otherFields).toEqual({
      version: 3,
      framework: { name: "nitro", version: "3.0.260903-beta" },
      crons: [{ path: "/api/cron/health", schedule: "17 15 * * *" }],
    });
  });

  // A wrong folder, such as the static folder, must stop the build, not leave Nitro's routes in place.
  test("refuses a folder with no config.json, and names the folder", async () => {
    const dir = `${tmp}/no-config`;
    await Bun.write(`${dir}/static/index.html`, "<!-- index.html -->");

    await expect(writeVercelConfig(dir)).rejects.toThrow(`no config.json in ${dir}`);
  });

  // Nitro always writes __server.func, so an output with no functions folder is not Nitro's whole Vercel output.
  test("refuses an output with no functions folder, and names the folder", async () => {
    const output = await nitroOutput("no-functions", { functions: [] });

    await expect(writeVercelConfig(output)).rejects.toThrow(`no functions folder in ${output}`);
  });

  // Nitro's per-route folder is a link to __server.func, so a renamed __server.func leaves the link pointing at
  // nothing. The build stops there, and does not count the link as a function folder.
  test("refuses a symbolic link to a missing path in the functions folder, and names the link", async () => {
    const output = await nitroOutput("dangling-link", { functions: [], links: ["sources/[id]"] });

    await expect(writeVercelConfig(output)).rejects.toThrow(
      `${resolve(output, "functions/sources/[id].func")} is a symbolic link to a missing path`,
    );
  });
});

describe("vercel.json", () => {
  // The expected object is SPEC-deploy's, "Configuration in code". Routes, headers and the cron live in the build's
  // .vercel/output/config.json instead, so any other key here fails.
  test("holds only the build settings: Bun 1.4, no framework, bun ci, build:site and the ignore step", async () => {
    expect(await Bun.file(`${REPO}/vercel.json`).json()).toEqual({
      $schema: "https://openapi.vercel.sh/vercel.json",
      bunVersion: "1.4.x",
      framework: null,
      installCommand: "bun ci",
      buildCommand: "bun run build:site",
      ignoreCommand: "sh scripts/ignore-build.sh",
    });
  });
});

// Bun loads .env, .env.<NODE_ENV> and .env.local into a run on its own (SPEC-deploy, "Secrets and settings"), so Peter's
// local keys live in .secrets/local.env, and no file named .env or .env.* is ever created.
describe("no .env file", () => {
  test("the checkout holds no .env file, ignored ones included", async () => {
    expect(await envFiles(REPO)).toEqual([]);
  });

  // The control: a scan that found nothing would let the checkout's test pass with a .env file in place.
  test("the scan finds each planted .env file, and leaves out installed packages and nested checkouts", async () => {
    const root = `${tmp}/env-scan`;
    for (const path of [".env", "src/.env.local", "node_modules/some-package/.env", "worktree/.env", "README.md"]) {
      await Bun.write(`${root}/${path}`, "");
    }
    await Bun.write(`${root}/worktree/.git`, "gitdir: elsewhere\n");

    expect(await envFiles(root)).toEqual([".env", "src/.env.local"]);
  });
});

describe("bunfig.toml", () => {
  // Bun reads bunfig.toml from the folder that a run starts in, so a fixture folder with a copy shows its effect.
  // `bun run questions` and `bun run evals` name .secrets/local.env with --env-file (SPEC-deploy), so that must load.
  test("turns Bun's automatic .env loading off, and a file that --env-file names still loads", async () => {
    const dir = `${tmp}/bunfig`;
    await Bun.write(`${dir}/.env`, "D8_MARKER=from-dotenv\n");
    await Bun.write(`${dir}/.secrets/local.env`, "D8_MARKER=from-local-env\n");
    const marker = "process.env.D8_MARKER ?? 'unset'";
    // The control: without the repository's bunfig.toml, Bun loads the .env file.
    expect((await $`${process.execPath} --print ${marker}`.cwd(dir).text()).trim()).toBe("from-dotenv");

    await Bun.write(`${dir}/bunfig.toml`, Bun.file(`${REPO}/bunfig.toml`));

    expect((await $`${process.execPath} --print ${marker}`.cwd(dir).text()).trim()).toBe("unset");
    expect((await $`${process.execPath} --env-file=.secrets/local.env --print ${marker}`.cwd(dir).text()).trim()).toBe(
      "from-local-env",
    );
  });
});
