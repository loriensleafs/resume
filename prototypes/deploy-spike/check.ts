// PROTOTYPE (deploy spike): finds this commit's deployment on the throwaway Vercel project and checks it.
// .github/workflows/spike-check.yml runs it in two steps that share one 15-minute bound (RUN_MS):
//   bun check.ts wait  Waits for Vercel's commit status on this commit, reads /build-info.json from the project's
//                      Git branch URL until it names this commit, then waits until the production address serves
//                      the same commit. Writes deployment=, production= and deadline= to $GITHUB_OUTPUT.
//   bun check.ts run   Runs every check in CHECKS, in order, and prints one verdict line each.
// Adding a check (D2 to D5): append a Check to CHECKS. Its run(ctx) gets both hosts, build-info.json, the shared
// deadline and the helpers below. A check never touches the bypass secret; deploymentFetch adds it and
// productionFetch never sends it. Expected values come from build-info.json, which the build reads from its output.
// Checks 2 and 3 (D2) test the config.json that post-build.ts writes: the routes, overrides, cron and functions.
// Checks 4, 5 and 11 (D3) test its headers, its host redirect and the Vercel Toolbar; check 11 drives the runner's
// Chrome through the DevTools protocol (chromeVisits below), so the spike adds no package. Check 10 is Peter's, by
// hand; the run prints the PDF's address for it.
// It prints states, hosts and verdicts only. Rerun only the newest run: an older one waits for a commit that the
// branch URL no longer serves.

import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
// The values that post-build.ts writes. Importing it writes nothing (its build runs only as entry point).
import {
  API_ROUTES,
  CRON,
  DOCUMENTS,
  HEADER_POLICY,
  IMMUTABLE,
  PRODUCTION_HOST,
  QUERY_ROUTES,
  REDIRECT_ORIGIN,
  SECURITY_HEADERS,
  SPIKE_PATH,
  WORKER_POLICY,
} from "./post-build.ts";

const PROJECT_STATUS_URL = "https://vercel.com/peterkloss/resume-deploy-spike/"; // Vercel's commit status links here
const PROTECTED_HOST = /^resume-deploy-spike-[a-z0-9-]+-peterkloss\.vercel\.app$/; // the deployment and branch URLs
const PUBLIC_HOST = /^[a-z0-9-]+\.vercel\.app$/; // the production address; it must also equal SPIKE_PRODUCTION_HOST
const RUN_MS = 15 * 60_000; // the brief's bound for one deployment and its workflow run
const POLL_MS = 10_000;

type BuildInfo = {
  commit: string | null;
  vercelEnv: string | null;
  deploymentHost: string | null;
  branchHost: string | null;
  productionHost: string | null;
  vercelJsonBunVersion: string | null;
  lockfileVersion: number | null;
  bunVersion: string;
  bunRevision: string;
  bunPath: string;
  functions: Record<string, { runtime: string | null; maxDuration: number | null }>;
  routeCount: number;
  pages: { file: string; path: string; sha256: string | null; override: string | null }[]; // prerendered, except /
  notFoundSha256: string | null; // static/404.html
  files: Record<string, string | null>; // SHA-256 of index.html, the PDF and sw.js
  workbox: string[]; // the workbox-<hash>.js files
  asset: string | null; // one file in assets/
  crons: { path: string; schedule: string }[];
};

type Report = Record<string, boolean | string | number | null>;

export type Ctx = {
  deployment: string; // the deployment's own host (protected)
  production: string; // the project's production .vercel.app address (public)
  info: BuildInfo; // this deployment's build-info.json
  deadline: number; // epoch ms: the end of this run's 15 minutes
  /**
   * GET or other request on the deployment's own host, with the bypass and, unless `skipToolbar` is false,
   * x-vercel-skip-toolbar; no redirects.
   */
  deploymentFetch(path: string, init?: RequestInit, options?: { skipToolbar?: boolean }): Promise<Response>;
  /** Request on the public production address, with x-vercel-skip-toolbar only, never the bypass; no redirects. */
  productionFetch(path: string, init?: RequestInit): Promise<Response>;
  /** A flat JSON object that a spike function on the deployment reports: booleans, hosts, times, no tokens. */
  report(path: string): Promise<Report>;
  /** Calls attempt every 10 s until it returns a value, or until maxMs or the run's deadline passes. */
  poll<T>(label: string, maxMs: number, attempt: () => Promise<T | undefined>): Promise<T | undefined>;
  /**
   * Loads each path on the deployment in Chrome, each in a fresh browser context. Only requests to the deployment
   * get the bypass and x-vercel-skip-toolbar; the first also asks for the bypass cookie, so the service worker's own
   * requests pass. See chromeVisits.
   */
  chrome(paths: string[]): Promise<ChromeVisit[]>;
};

type Check = {
  check: number;
  name: string;
  ifFails: string; // the change from SPEC-deploy's "If it fails" column
  run(ctx: Ctx): Promise<{ pass: boolean; detail: string }>;
};

// ---- the checks -------------------------------------------------------------------------------------------------

/**
 * Check 1: which Bun runs the build. SPEC-deploy needs every build tool on Bun 1.4, so the check passes on the 1.4
 * line. Whether bunVersion or the lockfile decides it is settled by the control runs in the README.
 */
const buildBun: Check = {
  check: 1,
  name: "build Bun",
  ifFails: "the install command installs Bun 1.4.2 and the build command calls $HOME/.bun/bin/bun",
  async run({ info }) {
    const pass = info.bunVersion.startsWith("1.4.");
    const facts =
      `the build ran Bun ${info.bunVersion} (${info.bunPath}, revision ${info.bunRevision.slice(0, 9)}); ` +
      `vercel.json bunVersion ${info.vercelJsonBunVersion === null ? "absent" : `"${info.vercelJsonBunVersion}"`}; ` +
      `bun.lock lockfileVersion ${info.lockfileVersion}`;
    return { pass, detail: pass ? facts : `${facts}; SPEC-deploy needs Bun 1.4` };
  },
};

const sha256 = (bytes: ArrayBuffer) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

/**
 * The requests that reach a function, and the function post-build.ts routes each to, from the values it exports.
 * `spec` marks the functions that stand for SPEC-deploy's: those must run Bun 1.4. The probe is recorded, not judged.
 */
const FUNCTION_ROUTES = [
  // its own function, as SPEC-deploy's /api/chat
  ...API_ROUTES.filter((route) => route.path === SPIKE_PATH).map((route) => ({ request: route.path, fn: route.fn, spec: true })),
  // ?function=server to /__server, as /api/status and the health job; ?function=bun1x to the probe ("bun1.x")
  ...QUERY_ROUTES.map((route) => ({ request: `${SPIKE_PATH}?function=${route.query}`, fn: route.fn, spec: !route.probe })),
];

/**
 * Check 2: Vercel serves the routes, overrides and cron that post-build.ts wrote, and which Bun runs each function.
 * Each route must reach the function it names (the function reports its name from its .vc-config.json), and the
 * function must see the path that was asked for. Each prerendered page must have an override, and its clean address
 * must serve its file byte for byte; the page list comes from the files, so a control without overrides still asks.
 */
const postBuildRoutes: Check = {
  check: 2,
  name: "post-build routes",
  ifFails: "the routes move to the form Vercel accepts; the runtime value is the one that gives Bun 1.4",
  async run({ info, report, deploymentFetch }) {
    const problems: string[] = [];
    const seen: string[] = [`config.json has ${info.routeCount} routes`];

    for (const route of FUNCTION_ROUTES) {
      const r = await report(route.request).catch((error: Error) => void problems.push(`${route.request}: ${error.message}`));
      if (!r) continue;
      const runtime = info.functions[String(r.function)]?.runtime ?? "unknown"; // of the function that answered
      seen.push(`${route.request} reached ${r.function} (runtime "${runtime}"): Bun ${r.bunVersion}, path ${r.path}`);
      if (r.function !== route.fn) problems.push(`${route.request} reached ${r.function}, not ${route.fn}`);
      if (r.path !== SPIKE_PATH) problems.push(`${route.fn} saw the path ${r.path}, not ${SPIKE_PATH}`);
      if (route.spec && !String(r.bunVersion).startsWith("1.4.")) {
        problems.push(`${route.fn} (runtime "${runtime}") runs Bun ${r.bunVersion}; SPEC-deploy needs 1.4`);
      }
    }

    if (info.pages.length === 0) problems.push("the build prerendered no page besides /");
    for (const page of info.pages) {
      const res = await deploymentFetch(`/${page.path}`);
      const same = page.sha256 !== null && sha256(await res.arrayBuffer()) === page.sha256;
      const override = page.override === page.path ? "override" : "no override";
      seen.push(`/${page.path} (${override}): HTTP ${res.status}, ${same ? "" : "not "}the file ${page.file}`);
      if (page.override !== page.path) problems.push(`config.json has no override for ${page.file}`);
      if (res.status !== 200 || !same) problems.push(`/${page.path} answered HTTP ${res.status} ${same ? "with" : "without"} the file ${page.file}`);
    }

    const cron = info.crons.some((c) => c.path === CRON.path && c.schedule === CRON.schedule);
    seen.push(cron ? `config.json has the cron ${CRON.path} "${CRON.schedule}"` : "config.json has no cron");
    if (!cron) problems.push(`config.json has no cron ${CRON.path} "${CRON.schedule}"`);

    return { pass: problems.length === 0, detail: problems.length ? `${problems.join("; ")}; seen: ${seen.join("; ")}` : seen.join("; ") };
  },
};

/**
 * Paths that must get the static not-found page with status 404. The page must be static/404.html byte for byte:
 * a function in this spike renders TanStack's page or Nitro's JSON error, never that file.
 */
const NOT_FOUND_PATHS = [
  "/no-such-page", // an unknown path
  "/API/chat", // the acceptance's path; the spike has no /api/chat route in any case
  "/API/spike", // the case test: /api/spike reaches a function (check 2), so this tests caseSensitive
  "/sources/x", // a source page with no file; the spike has no /sources/ pages
  "/deep-dives/x", // the spike's dynamic route with no file: in a function, its loader would run
  "/__server", // Nitro's function by its folder name (a .func folder also answers at its own path)
  "/api/spike-bun1x", // the probe's function by its folder name: no API route names it
  "/_serverFn/x", // TanStack's server-function path
];

/** Check 3: unknown paths get /404.html with status 404, and no function renders them. */
const notFound: Check = {
  check: 3,
  name: "not-found paths",
  ifFails: "as check 2: the routes move to the form Vercel accepts",
  async run({ info, deploymentFetch }) {
    if (!info.notFoundSha256) return { pass: false, detail: "the build wrote no 404.html" };
    const wrong: string[] = [];
    for (const path of NOT_FOUND_PATHS) {
      const res = await deploymentFetch(path);
      const page = sha256(await res.arrayBuffer()) === info.notFoundSha256;
      if (res.status !== 404 || !page) {
        wrong.push(`${path} answered HTTP ${res.status} with ${page ? "404.html" : `another body (${res.headers.get("content-type")})`}`);
      }
    }
    const all = NOT_FOUND_PATHS.join(", ");
    return wrong.length
      ? { pass: false, detail: `${wrong.join("; ")}; the others got 404.html with status 404` }
      : { pass: true, detail: `${all}: HTTP 404 with static/404.html byte for byte, so no function rendered them` };
  },
};

/** Vercel's default cache rule, which SPEC-deploy keeps for pages, /sw.js and the documents ("Caching"). */
const REVALIDATE = "public, max-age=0, must-revalidate";

/** How many policies a content-security-policy value holds: each has one base-uri. Two headers arrive joined by ", ". */
const policyCount = (value: string | null) => (value === null ? 0 : value.split("base-uri").length - 1);
const policyName = (value: string | null) =>
  value === null
    ? "no policy"
    : value === HEADER_POLICY
      ? "the header policy"
      : value === WORKER_POLICY
        ? "the worker policy"
        : `${policyCount(value)} other ${policyCount(value) === 1 ? "policy" : "policies"} ${JSON.stringify(value)}`;

/** The six headers that every response gets, by name, as SPEC-deploy's table gives them. */
function securityHeaderProblems(res: Response): string[] {
  return Object.entries(SECURITY_HEADERS)
    .filter(([name, value]) => res.headers.get(name) !== value)
    .map(([name]) => `${name} ${res.headers.get(name) === null ? "missing" : JSON.stringify(res.headers.get(name))}`);
}

/**
 * Check 4: how route headers merge. The worker files match both policy routes and must get one policy, the worker
 * policy; the PDF must get none; a function response and the not-found page (from a route before the filesystem and
 * from the last route) must get the six headers and the header policy. A wrong value names what arrived, so two
 * policies or two HSTS values show joined by ", ".
 */
const headerMerge: Check = {
  check: 4,
  name: "route headers",
  ifFails: "the header routes change, so each path gets exactly one policy",
  async run({ info, deploymentFetch }) {
    const page = info.pages[0];
    if (!page || !info.asset || info.workbox.length === 0) {
      return { pass: false, detail: "build-info.json names no deep dive, no asset or no workbox-<hash>.js file" };
    }
    type Case = { path: string; what: string; status: number; policy: string | null; cache: string | null; sha256?: string | null; type?: string };
    const cases: Case[] = [
      { path: "/", what: "a page", status: 200, policy: HEADER_POLICY, cache: REVALIDATE, sha256: info.files["index.html"] },
      { path: `/${page.path}`, what: "a deep dive", status: 200, policy: HEADER_POLICY, cache: REVALIDATE, sha256: page.sha256 },
      { path: "/sw.js", what: "the service worker", status: 200, policy: WORKER_POLICY, cache: REVALIDATE, sha256: info.files["sw.js"] },
      ...info.workbox.map((file) => ({ path: `/${file}`, what: "Workbox", status: 200, policy: WORKER_POLICY, cache: IMMUTABLE })),
      { path: `/assets/${info.asset}`, what: "a hashed asset", status: 200, policy: HEADER_POLICY, cache: IMMUTABLE },
      {
        path: `/${DOCUMENTS[0]}`,
        what: "the PDF",
        status: 200,
        policy: null,
        cache: REVALIDATE,
        sha256: info.files[DOCUMENTS[0]],
        type: "application/pdf",
      },
      { path: SPIKE_PATH, what: "a function", status: 200, policy: HEADER_POLICY, cache: "no-store" },
      { path: "/no-such-page", what: "the not-found page, last route", status: 404, policy: HEADER_POLICY, cache: null, sha256: info.notFoundSha256 },
      { path: "/__server", what: "the not-found page, route before the filesystem", status: 404, policy: HEADER_POLICY, cache: null, sha256: info.notFoundSha256 },
    ];

    const problems: string[] = [];
    const seen: string[] = [];
    for (const c of cases) {
      const res = await deploymentFetch(c.path);
      const body = await res.arrayBuffer();
      const policy = res.headers.get("content-security-policy");
      const cache = res.headers.get("cache-control");
      const wrong = [
        ...(res.status === c.status ? [] : [`HTTP ${res.status}, not ${c.status}`]),
        ...securityHeaderProblems(res),
        ...(policy === c.policy ? [] : [`${policyName(policy)}, not ${policyName(c.policy)}`]),
        ...(c.cache === null || cache === c.cache ? [] : [`cache-control ${JSON.stringify(cache)}, not "${c.cache}"`]),
        ...(c.sha256 === undefined || (c.sha256 !== null && sha256(body) === c.sha256) ? [] : ["not the built file byte for byte"]),
        ...(c.type === undefined || res.headers.get("content-type")?.startsWith(c.type) ? [] : [`content-type ${res.headers.get("content-type")}`]),
      ];
      if (wrong.length) problems.push(`${c.path} (${c.what}): ${wrong.join(", ")}`);
      const disposition = res.headers.get("content-disposition");
      seen.push(
        `${c.path} (${c.what}): HTTP ${res.status}, ${securityHeaderProblems(res).length === 0 ? "the six headers" : "not the six headers"}, ` +
          `${policyName(policy)}, cache-control ${JSON.stringify(cache)}${disposition === null ? "" : `, content-disposition ${JSON.stringify(disposition)}`}`,
      );
    }
    return { pass: problems.length === 0, detail: problems.length ? `${problems.join("; ")}; seen: ${seen.join("; ")}` : seen.join("; ") };
  },
};

/**
 * Check 5: the host redirect on the production .vercel.app address answers 308 to the same path and query on
 * peterkloss.dev, and leaves /api/ alone. The route's Location names only the path ($1), so a kept query is Vercel's
 * doing. A path with encoded characters and the headers on the 308 are recorded, not judged.
 */
const hostRedirect: Check = {
  check: 5,
  name: "host redirect",
  ifFails: "the route adds the query itself",
  async run({ info, productionFetch }) {
    const page = info.pages[0];
    if (info.productionHost !== null && info.productionHost !== PRODUCTION_HOST) {
      return { pass: false, detail: `the redirect route names ${PRODUCTION_HOST}, but the project's production address is ${info.productionHost}` };
    }
    const cases = [
      { path: "/resume?x=1", location: `${REDIRECT_ORIGIN}/resume?x=1` }, // SPEC-deploy's smoke check
      { path: "/?a=1&b=two", location: `${REDIRECT_ORIGIN}/?a=1&b=two` },
      ...(page ? [{ path: `/${page.path}`, location: `${REDIRECT_ORIGIN}/${page.path}` }] : []), // no query, no "?"
    ];
    const problems: string[] = [];
    const seen: string[] = [];
    let first: Response | null = null;
    for (const c of cases) {
      const res = await productionFetch(c.path);
      first ??= res;
      const location = res.headers.get("location");
      seen.push(`${c.path}: HTTP ${res.status} to ${location ?? "no Location"}`);
      if (res.status !== 308 || location !== c.location) problems.push(`${c.path} answered HTTP ${res.status} to ${location ?? "no Location"}, not 308 to ${c.location}`);
    }

    // Recorded: a path and query with encoded characters.
    const encoded = await productionFetch("/a%20b/%C3%A9?q=%2F&r=a+b");
    seen.push(`/a%20b/%C3%A9?q=%2F&r=a+b: HTTP ${encoded.status} to ${encoded.headers.get("location") ?? "no Location"}`);
    // Recorded: the headers on the 308. The redirect route has no `continue`, and the header routes come after it.
    if (first) {
      const wrong = securityHeaderProblems(first);
      const six =
        wrong.length === 0
          ? "the six headers"
          : wrong.every((w) => w.endsWith(" missing")) && wrong.length === Object.keys(SECURITY_HEADERS).length
            ? "none of the six headers"
            : `not the six headers: ${wrong.join(", ")}`;
      seen.push(
        `the 308 carries ${six}, ` +
          `${policyName(first.headers.get("content-security-policy"))}, cache-control ${JSON.stringify(first.headers.get("cache-control"))}`,
      );
    }

    // /api/ is not redirected: the wait step and Vercel Cron rely on it.
    const api = await productionFetch("/api/build-info.json");
    const apiCommit = api.status === 200 ? ((await api.json()) as BuildInfo).commit : null;
    seen.push(`/api/build-info.json: HTTP ${api.status}${apiCommit ? `, commit ${short(apiCommit)}` : ""}`);
    if (api.status !== 200 || apiCommit !== info.commit) problems.push(`/api/build-info.json answered HTTP ${api.status}, not 200 with this commit`);

    return { pass: problems.length === 0, detail: problems.length ? `${problems.join("; ")}; seen: ${seen.join("; ")}` : seen.join("; ") };
  },
};

/**
 * Check 11: with the toolbar off for production and x-vercel-skip-toolbar on every request to the deployment, Chrome
 * loads three pages on the deployment URL with no request to vercel.live, no toolbar element and no policy violation,
 * and receives the built file byte for byte, so Vercel injected nothing. Two planted controls prove that the
 * violation listener works and that both policies are enforced there: an image from another host (the header's
 * img-src) and an inline script (the tag's script-src). A plain request without x-vercel-skip-toolbar must also get
 * the built page, which shows the production setting alone keeps the toolbar out.
 */
const toolbarOff: Check = {
  check: 11,
  name: "Vercel Toolbar",
  ifFails: "the policy allows nothing more; the checks fail instead",
  async run({ info, chrome, deploymentFetch }) {
    const page = info.pages[0];
    if (!page) return { pass: false, detail: "build-info.json names no deep dive" };
    const expected = [
      { path: "/", status: 200, sha256: info.files["index.html"] },
      { path: `/${page.path}`, status: 200, sha256: page.sha256 },
      { path: "/no-such-page", status: 404, sha256: info.notFoundSha256 },
    ];
    const visits = await chrome(expected.map((e) => e.path));

    const problems: string[] = [];
    const seen: string[] = [];
    for (const [i, visit] of visits.entries()) {
      const want = expected[i]!;
      const same = want.sha256 !== null && visit.documentSha256 === want.sha256;
      const plantedImg = visit.planted.some((v) => v.startsWith("img-src "));
      const plantedScript = visit.planted.some((v) => v.startsWith("script-src"));
      if (visit.vercelLive > 0) problems.push(`${visit.path}: ${visit.vercelLive} requests to vercel.live`);
      if (visit.toolbar) problems.push(`${visit.path}: the page holds a toolbar element or a vercel.live script or frame`);
      if (visit.violations.length) problems.push(`${visit.path}: policy violations ${visit.violations.join(", ")}`);
      if (visit.status !== want.status) problems.push(`${visit.path}: HTTP ${visit.status}, not ${want.status}`);
      if (!same) problems.push(`${visit.path}: Chrome did not receive the built file byte for byte`);
      if (!plantedImg || !plantedScript) problems.push(`${visit.path}: the planted controls gave ${visit.planted.join(", ") || "no violation"}, so the listener or a policy did not work`);
      seen.push(
        `${visit.path}: HTTP ${visit.status}, ${same ? "the built file byte for byte" : "other bytes"}, ${visit.violations.length} policy violations, ` +
          `${visit.vercelLive} requests to vercel.live, other hosts: ${visit.otherHosts.join(", ") || "none"}, ` +
          `planted controls: ${visit.planted.join(", ") || "none"}, service worker ${visit.controlled ? "controls the page" : "does not control the page"}, ` +
          `${visit.errors.length} console errors${visit.errors.length ? ` (${visit.errors.join(" | ")})` : ""}`,
      );
    }

    // Without x-vercel-skip-toolbar, the production setting alone must keep the toolbar out.
    const plain = await deploymentFetch("/", undefined, { skipToolbar: false });
    const plainSame = info.files["index.html"] !== null && sha256(await plain.arrayBuffer()) === info.files["index.html"];
    seen.push(`/ without x-vercel-skip-toolbar: HTTP ${plain.status}, ${plainSame ? "the built file byte for byte" : "other bytes"}`);
    if (plain.status !== 200 || !plainSame) problems.push(`/ without x-vercel-skip-toolbar answered HTTP ${plain.status} with other bytes than the built file`);

    return { pass: problems.length === 0, detail: problems.length ? `${problems.join("; ")}; seen: ${seen.join("; ")}` : seen.join("; ") };
  },
};

export const CHECKS: Check[] = [buildBun, postBuildRoutes, notFound, headerMerge, hostRedirect, toolbarOff];

// ---- Chrome through the DevTools protocol ----------------------------------------------------------------------

/** What one page load in Chrome showed. */
export type ChromeVisit = {
  path: string;
  status: number | null; // the document's HTTP status
  documentSha256: string | null; // of the document's body as Chrome received it
  violations: string[]; // the page's own policy violations: "<directive> <blocked URI>"
  planted: string[]; // the violations that the planted controls caused
  vercelLive: number; // requests to vercel.live from the page or its service worker
  otherHosts: string[]; // hosts other than the origin's that the page or its service worker requested
  toolbar: boolean; // a vercel-live-feedback element, or a script or frame from vercel.live, in the page
  controlled: boolean; // a service worker controls the page
  errors: string[]; // page errors and console errors, from the page and its service worker, before the controls
};

type CdpMessage = { id?: number; method?: string; params?: any; result?: any; error?: { message: string }; sessionId?: string };

/** A minimal DevTools protocol client over Bun's WebSocket. https://chromedevtools.github.io/devtools-protocol/ */
class Cdp {
  private next = 0;
  private readonly waiting = new Map<number, { resolve(result: any): void; reject(error: Error): void; method: string }>();
  private readonly handlers = new Set<(message: CdpMessage) => void>();

  private constructor(private readonly ws: WebSocket) {
    ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as CdpMessage;
      if (message.id === undefined) return this.handlers.forEach((handler) => handler(message));
      const waiter = this.waiting.get(message.id);
      this.waiting.delete(message.id);
      if (message.error) waiter?.reject(new Error(`${waiter.method}: ${message.error.message}`));
      else waiter?.resolve(message.result);
    };
    ws.onclose = () => {
      for (const waiter of this.waiting.values()) waiter.reject(new Error(`${waiter.method}: Chrome closed the connection`));
      this.waiting.clear();
    };
  }

  static connect(url: string): Promise<Cdp> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.onopen = () => resolve(new Cdp(ws));
      ws.onerror = () => reject(new Error("cannot connect to Chrome's DevTools endpoint"));
    });
  }

  send(method: string, params: object = {}, sessionId?: string): Promise<any> {
    const id = ++this.next;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        reject(new Error(`${method}: no answer in 30 s`));
      }, 30_000);
      this.waiting.set(id, {
        method,
        resolve: (result) => (clearTimeout(timer), resolve(result)),
        reject: (error) => (clearTimeout(timer), reject(error)),
      });
    });
  }

  on(handler: (message: CdpMessage) => void): void {
    this.handlers.add(handler);
  }

  close(): void {
    this.ws.close();
  }
}

// Records the page's policy violations; injected before any page script, so it sees them all.
const VIOLATION_LISTENER = `window.__spikeViolations = [];
document.addEventListener("securitypolicyviolation", (e) => window.__spikeViolations.push(e.effectiveDirective + " " + (e.blockedURI || "inline")));`;
// The planted controls: an image from another host breaks the header's img-src, an inline script the tag's script-src.
const PLANT_CONTROLS = `(() => {
  const img = document.createElement("img"); img.src = "https://example.invalid/spike-control.png"; document.body.append(img);
  const script = document.createElement("script"); script.textContent = "window.__spikeInline = true"; document.body.append(script);
})()`;
const PAGE_STATE = `JSON.stringify({
  violations: window.__spikeViolations ?? null,
  toolbar: document.querySelector('vercel-live-feedback, script[src*="vercel.live"], iframe[src*="vercel.live"]') !== null,
  controlled: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
})`;

const CHROME = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];

const withTimeout = <T>(promise: Promise<T>, ms: number, what: string) =>
  Promise.race([promise, sleep(ms).then(() => Promise.reject(new Error(`${what} within ${ms / 1000} s`)))]);

/**
 * Loads each path of `origin` in headless Chrome, each in a fresh browser context, and reports what it saw.
 * Every request the page makes to the origin's host gets `headersFor(first)`, where `first` is true for the first
 * request of the visit; a request to any other host goes out unchanged, so those headers never leave the origin.
 * The service workers are attached too, so their requests and console errors count.
 */
export async function chromeVisits(origin: string, paths: string[], headersFor: (first: boolean) => Record<string, string>): Promise<ChromeVisit[]> {
  const chromePath = CHROME.find((path) => path !== undefined && existsSync(path));
  if (!chromePath) throw new Error("no Chrome: set CHROME_PATH");
  const profile = await mkdtemp(`${process.env.RUNNER_TEMP ?? tmpdir()}/spike-chrome-`);
  // --no-sandbox as Playwright launches Chromium by default; the pages are the spike's own.
  const chrome = Bun.spawn(
    [chromePath, "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
      "--no-sandbox", "--disable-background-networking", "--disable-component-update", "--disable-sync", "about:blank"],
    { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
  );
  try {
    // Chrome writes its port and browser path to DevToolsActivePort in the profile.
    const active = await pollUntil("chrome", Date.now() + 30_000, async () => {
      const file = Bun.file(`${profile}/DevToolsActivePort`);
      const [port, path] = (await file.exists()) ? (await file.text()).split("\n") : [];
      return port && path ? `ws://127.0.0.1:${port}${path}` : undefined;
    });
    if (!active) throw new Error("Chrome did not start within 30 s");
    const cdp = await Cdp.connect(active);
    try {
      return await visitAll(cdp, origin, paths, headersFor);
    } finally {
      cdp.close();
    }
  } finally {
    chrome.kill();
    await chrome.exited;
    await rm(profile, { recursive: true, force: true });
  }
}

async function visitAll(cdp: Cdp, origin: string, paths: string[], headersFor: (first: boolean) => Record<string, string>): Promise<ChromeVisit[]> {
  const host = new URL(origin).host;
  // The visit in progress: its browser context, its sessions (the page and its service workers) and what they showed.
  // One verdict line each: an error's text keeps its first 160 characters on one line.
  const oneLine = (text: unknown) => String(text).replace(/\s+/g, " ").slice(0, 160);
  let current: {
    context: string;
    page: string;
    sessions: Set<string>;
    visit: ChromeVisit;
    hosts: Set<string>;
    document: string | null;
    first: boolean;
    planted: boolean;
    loaded(): void;
  } | null = null;

  cdp.on((message) => {
    const p = message.params;
    // A service worker, from the auto-attach below: count its requests and errors, then let it start.
    if (message.method === "Target.attachedToTarget" && !message.sessionId) {
      const session: string = p.sessionId;
      if (current && p.targetInfo.browserContextId === current.context) current.sessions.add(session);
      void Promise.all(["Network.enable", "Runtime.enable", "Log.enable"].map((m) => cdp.send(m, {}, session)))
        .catch(() => {})
        .finally(() => cdp.send("Runtime.runIfWaitingForDebugger", {}, session).catch(() => {}));
      return;
    }
    if (!current || !message.sessionId || !current.sessions.has(message.sessionId)) return;
    const c = current;
    switch (message.method) {
      case "Fetch.requestPaused": {
        // Only the origin's requests get the extra headers; a request elsewhere goes out unchanged.
        const url = new URL(p.request.url);
        if (url.host !== host) {
          void cdp.send("Fetch.continueRequest", { requestId: p.requestId }, message.sessionId).catch(() => {});
          break;
        }
        const headers = Object.entries({ ...p.request.headers, ...headersFor(c.first) }).map(([name, value]) => ({ name, value: String(value) }));
        c.first = false;
        void cdp.send("Fetch.continueRequest", { requestId: p.requestId, headers }, message.sessionId).catch(() => {});
        break;
      }
      case "Network.requestWillBeSent": {
        const url = URL.parse(p.request.url);
        if (!url || !url.protocol.startsWith("http") || c.planted) break;
        if (url.hostname === "vercel.live" || url.hostname.endsWith(".vercel.live")) c.visit.vercelLive++;
        if (url.host !== host) c.hosts.add(url.host);
        break;
      }
      case "Network.responseReceived":
        // The visited page's own document, not a frame's: same host and path.
        if (message.sessionId === c.page && p.type === "Document" && URL.parse(p.response.url)?.host === host && URL.parse(p.response.url)?.pathname === c.visit.path) {
          c.document = p.requestId;
          c.visit.status = p.response.status;
        }
        break;
      case "Page.loadEventFired":
        c.loaded();
        break;
      case "Runtime.exceptionThrown":
        if (!c.planted) c.visit.errors.push(`exception: ${oneLine(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text)}`);
        break;
      case "Runtime.consoleAPICalled":
        if (!c.planted && p.type === "error") c.visit.errors.push(`console: ${oneLine(p.args?.[0]?.value ?? p.args?.[0]?.description)}`);
        break;
      case "Log.entryAdded":
        if (!c.planted && p.entry.level === "error") c.visit.errors.push(`${p.entry.source}: ${oneLine(p.entry.text)}`);
        break;
    }
  });

  // Attach to every service worker as it starts; each waits until the handler above has enabled its domains.
  await cdp.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true, filter: [{ type: "service_worker", exclude: false }] });

  const visits: ChromeVisit[] = [];
  for (const path of paths) {
    const { browserContextId } = await cdp.send("Target.createBrowserContext", { disposeOnDetach: true });
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    let loaded = () => {};
    const load = new Promise<void>((resolve) => (loaded = resolve));
    const visit: ChromeVisit = {
      path, status: null, documentSha256: null, violations: [], planted: [], vercelLive: 0, otherHosts: [], toolbar: false, controlled: false, errors: [],
    };
    current = { context: browserContextId, page: sessionId, sessions: new Set([sessionId]), visit, hosts: new Set(), document: null, first: true, planted: false, loaded };
    try {
      await Promise.all(["Page.enable", "Network.enable", "Runtime.enable", "Log.enable"].map((m) => cdp.send(m, {}, sessionId)));
      await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] }, sessionId);
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: VIOLATION_LISTENER }, sessionId);
      const navigation = await cdp.send("Page.navigate", { url: `${origin}${path}` }, sessionId);
      if (navigation.errorText) throw new Error(`${path}: ${navigation.errorText}`);
      await withTimeout(load, 30_000, `${path} did not load`);
      await sleep(4_000); // the service worker installs and claims the page; a late toolbar script would load now

      const evaluate = async () =>
        JSON.parse((await cdp.send("Runtime.evaluate", { expression: PAGE_STATE, returnByValue: true }, sessionId)).result.value) as {
          violations: string[] | null;
          toolbar: boolean;
          controlled: boolean;
        };
      const before = await evaluate();
      visit.violations = before.violations ?? ["the violation listener did not run"];
      visit.toolbar = before.toolbar;
      visit.controlled = before.controlled;
      visit.otherHosts = [...current.hosts].sort();
      if (current.document) {
        const body = await cdp.send("Network.getResponseBody", { requestId: current.document }, sessionId);
        visit.documentSha256 = new Bun.CryptoHasher("sha256").update(body.base64Encoded ? Buffer.from(body.body, "base64") : body.body).digest("hex");
      }

      current.planted = true;
      await cdp.send("Runtime.evaluate", { expression: PLANT_CONTROLS }, sessionId);
      await sleep(1_000);
      visit.planted = ((await evaluate()).violations ?? []).slice(visit.violations.length);
    } finally {
      current = null;
      await cdp.send("Target.disposeBrowserContext", { browserContextId }).catch(() => {});
    }
    visits.push(visit);
  }
  return visits;
}

// ---- the harness ------------------------------------------------------------------------------------------------

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.log(`error: ${name} is not set`);
    process.exit(1);
  }
  return value;
}

function protectedHost(host: string, what: string): string {
  if (!PROTECTED_HOST.test(host)) {
    console.log(`error: ${what} ${JSON.stringify(host)} is not one of this project's protected *.vercel.app hosts`);
    process.exit(1);
  }
  return host;
}

function productionHost(host: string, what: string): string {
  if (!PUBLIC_HOST.test(host) || host !== env("SPIKE_PRODUCTION_HOST")) {
    console.log(`error: ${what} ${JSON.stringify(host)} is not the project's production address`);
    process.exit(1);
  }
  return host;
}

/**
 * The only place the bypass secret is read. Its headers go out only to a host that matches PROTECTED_HOST, with
 * x-vercel-skip-toolbar unless `skipToolbar` is false, and with x-vercel-set-bypass-cookie when `setCookie` is true.
 */
function bypassHeaders(host: string, options: { skipToolbar?: boolean; setCookie?: boolean } = {}): Record<string, string> {
  protectedHost(host, "host");
  return {
    "x-vercel-protection-bypass": env("VERCEL_AUTOMATION_BYPASS_SECRET"),
    ...(options.skipToolbar === false ? {} : { "x-vercel-skip-toolbar": "1" }),
    ...(options.setCookie ? { "x-vercel-set-bypass-cookie": "true" } : {}),
  };
}

function withBypass(host: string, init: RequestInit = {}, options: { skipToolbar?: boolean } = {}): RequestInit {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(bypassHeaders(host, options))) headers.set(name, value);
  return { ...init, headers, redirect: "manual" };
}

function withoutBypass(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.delete("x-vercel-protection-bypass");
  headers.set("x-vercel-skip-toolbar", "1");
  return { ...init, headers, redirect: "manual" };
}

/** Without a valid bypass, Vercel answers 302 to its sign-in page (seen on this project), or 401. */
const httpNote = (status: number) =>
  status === 401 || (status >= 300 && status < 400) ? `HTTP ${status} (the bypass was not accepted)` : `HTTP ${status}`;
const short = (sha: string | null) => (sha ?? "none").slice(0, 7);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readBuildInfo(url: string, init: RequestInit): Promise<{ status: number; info?: BuildInfo }> {
  const res = await fetch(url, init);
  if (res.status !== 200) return { status: res.status };
  return { status: 200, info: (await res.json()) as BuildInfo };
}

/** Logs a line only when it differs from the last one, so a long poll stays short in the log. */
function quietLog() {
  let last = "";
  return {
    say(line: string) {
      if (line !== last) console.log(line);
      last = line;
    },
    get last() {
      return last;
    },
  };
}

async function pollUntil<T>(label: string, until: number, attempt: () => Promise<T | undefined>) {
  const log = quietLog();
  while (Date.now() < until) {
    const value = await attempt().catch((error: Error) => {
      log.say(`${label}: ${error.message}; trying again`);
      return undefined;
    });
    if (value !== undefined) return value;
    await sleep(Math.min(POLL_MS, Math.max(0, until - Date.now())));
  }
  return undefined;
}

/** Vercel's newest commit status for this project on the commit, or null before Vercel posts one. */
async function vercelStatus(repo: string, sha: string, token: string) {
  const res = await fetch(`https://api.github.com/repos/${repo}/commits/${sha}/statuses?per_page=100`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
  });
  if (!res.ok) throw new Error(`GitHub statuses API answered ${res.status}`);
  const statuses = (await res.json()) as { state: string; description: string | null; target_url: string | null }[];
  return statuses.find((s) => s.target_url?.startsWith(PROJECT_STATUS_URL)) ?? null; // newest first
}

async function wait(): Promise<void> {
  const repo = env("GITHUB_REPOSITORY");
  const sha = env("GITHUB_SHA");
  const token = env("GITHUB_TOKEN");
  const branch = protectedHost(env("SPIKE_BRANCH_HOST"), "SPIKE_BRANCH_HOST");
  const production = productionHost(env("SPIKE_PRODUCTION_HOST"), "SPIKE_PRODUCTION_HOST");
  const deadline = Date.now() + RUN_MS;
  const log = quietLog();
  console.log(`waiting up to ${RUN_MS / 60_000} minutes for the deployment of ${short(sha)}`);

  // 1. Vercel's commit status, then the branch URL's build-info.json naming this commit.
  const info = await pollUntil("github", deadline, async () => {
    const status = await vercelStatus(repo, sha, token);
    if (!status) return void log.say("vercel: no commit status yet");
    if (status.state === "pending") return void log.say(`vercel: pending (${status.description})`);
    if (status.state !== "success") {
      console.log(`vercel: ${status.state} (${status.description}); see ${status.target_url}`);
      process.exit(1);
    }
    log.say(`vercel: success (${status.description})`);
    const { status: http, info } = await readBuildInfo(`https://${branch}/build-info.json`, withBypass(branch));
    if (http !== 200) return void log.say(`branch URL ${branch}: ${httpNote(http)}`);
    if (info?.commit !== sha) return void log.say(`branch URL ${branch}: serves ${short(info?.commit ?? null)}, waiting for ${short(sha)}`);
    return info;
  });
  if (!info) {
    console.log(`error: no deployment of ${short(sha)} within ${RUN_MS / 60_000} minutes; last state: ${log.last}`);
    process.exit(1);
  }
  const deployment = protectedHost(info.deploymentHost ?? "", "build-info deploymentHost");
  console.log(`deployment of ${short(sha)}: https://${deployment}`);
  if (info.productionHost !== null && info.productionHost !== production) {
    console.log(`error: the project's production address is ${info.productionHost}, but the workflow names ${production}`);
    process.exit(1);
  }

  // 2. The production address can lag the commit status, so wait until it serves this commit too.
  const served = await pollUntil("production", deadline, async () => {
    const { status: http, info: live } = await readBuildInfo(`https://${production}/api/build-info.json`, withoutBypass());
    if (http !== 200) return void log.say(`production ${production}: HTTP ${http}`);
    if (live?.commit !== sha) return void log.say(`production ${production}: serves ${short(live?.commit ?? null)}, waiting for ${short(sha)}`);
    return true;
  });
  if (!served) {
    console.log(`error: ${production} did not serve ${short(sha)} within the run's bound; last state: ${log.last}`);
    process.exit(1);
  }
  console.log(`production ${production}: serves ${short(sha)}`);

  const output = Bun.file(env("GITHUB_OUTPUT"));
  const lines = `deployment=${deployment}\nproduction=${production}\ndeadline=${deadline}\n`;
  await Bun.write(output, ((await output.exists()) ? await output.text() : "") + lines);
}

async function run(): Promise<void> {
  const sha = env("GITHUB_SHA");
  const deployment = protectedHost(env("DEPLOYMENT_HOST"), "DEPLOYMENT_HOST");
  const production = productionHost(env("PRODUCTION_HOST"), "PRODUCTION_HOST");
  const deadline = Number(env("RUN_DEADLINE"));
  if (!Number.isFinite(deadline)) {
    console.log("error: RUN_DEADLINE is not a time");
    process.exit(1);
  }

  const { status, info } = await readBuildInfo(`https://${deployment}/build-info.json`, withBypass(deployment));
  if (status !== 200 || !info) {
    console.log(`error: build-info.json answered ${httpNote(status)}`);
    process.exit(1);
  }
  if (info.commit !== sha) {
    console.log(`error: ${deployment} is the deployment of ${short(info.commit)}, not ${short(sha)}`);
    process.exit(1);
  }
  console.log(`deployment ${deployment}, production ${production}: commit ${short(sha)}, VERCEL_ENV ${info.vercelEnv}`);

  const ctx: Ctx = {
    deployment,
    production,
    info,
    deadline,
    deploymentFetch: (path, init, options) => fetch(`https://${deployment}${path}`, withBypass(deployment, init, options)),
    productionFetch: (path, init) => fetch(`https://${production}${path}`, withoutBypass(init)),
    async report(path) {
      const res = await fetch(`https://${deployment}${path}`, withBypass(deployment));
      if (res.status !== 200) throw new Error(`${path} answered ${httpNote(res.status)}`);
      const body = (await res.json()) as unknown;
      const flat =
        body !== null && typeof body === "object" && !Array.isArray(body) &&
        Object.values(body).every((v) => v === null || ["boolean", "string", "number"].includes(typeof v));
      if (!flat) throw new Error(`${path} did not answer a flat JSON object`);
      return body as Report;
    },
    poll: (label, maxMs, attempt) => pollUntil(label, Math.min(Date.now() + maxMs, deadline), attempt),
    chrome: (paths) => chromeVisits(`https://${deployment}`, paths, (first) => bypassHeaders(deployment, { setCookie: first })),
  };

  let failed = 0;
  for (const check of CHECKS) {
    const result = await check.run(ctx).catch((error: Error) => ({ pass: false, detail: `error: ${error.message}` }));
    if (!result.pass) failed++;
    const tail = result.pass ? "" : `; if it fails: ${check.ifFails}`;
    console.log(`check ${check.check} (${check.name}): ${result.pass ? "pass" : "FAIL"}: ${result.detail}${tail}`);
  }
  // Check 10 is Peter's, in his own Chrome: the deployment URL is protected, and he is signed in to Vercel.
  console.log(`check 10 (PDF in Chrome's viewer): manual, Peter's: https://${deployment}/${DOCUMENTS[0]}`);
  console.log(`checks: ${CHECKS.length - failed} pass, ${failed} fail`);
  if (failed) process.exit(1);
}

/**
 * THROWAWAY BRANCH prototype/d3-preview only (D3 review): waits for this commit's preview deployment on the
 * branch URL, then runs check 11 twice against it: with x-vercel-skip-toolbar on every request to the deployment,
 * and without it. Vercel turns the toolbar on for previews by default, so the run without the header shows whether
 * check 11 can go red, and the run with it whether the header keeps the toolbar off.
 */
async function preview(): Promise<void> {
  const repo = env("GITHUB_REPOSITORY");
  const sha = env("GITHUB_SHA");
  const token = env("GITHUB_TOKEN");
  const branch = protectedHost(env("SPIKE_BRANCH_HOST"), "SPIKE_BRANCH_HOST");
  const deadline = Date.now() + RUN_MS;
  const log = quietLog();
  console.log(`waiting up to ${RUN_MS / 60_000} minutes for the preview of ${short(sha)}`);
  const info = await pollUntil("github", deadline, async () => {
    const status = await vercelStatus(repo, sha, token);
    if (!status) return void log.say("vercel: no commit status yet");
    if (status.state === "pending") return void log.say(`vercel: pending (${status.description})`);
    if (status.state !== "success") {
      console.log(`vercel: ${status.state} (${status.description}); see ${status.target_url}`);
      process.exit(1);
    }
    log.say(`vercel: success (${status.description})`);
    const { status: http, info } = await readBuildInfo(`https://${branch}/build-info.json`, withBypass(branch));
    if (http !== 200) return void log.say(`branch URL ${branch}: ${httpNote(http)}`);
    if (info?.commit !== sha) return void log.say(`branch URL ${branch}: serves ${short(info?.commit ?? null)}, waiting for ${short(sha)}`);
    return info;
  });
  if (!info) {
    console.log(`error: no preview of ${short(sha)} within ${RUN_MS / 60_000} minutes; last state: ${log.last}`);
    process.exit(1);
  }
  const deployment = protectedHost(info.deploymentHost ?? "", "build-info deploymentHost");
  console.log(`preview of ${short(sha)}: https://${deployment}, VERCEL_ENV ${info.vercelEnv}`);

  for (const skipToolbar of [true, false]) {
    const ctx = {
      info,
      deploymentFetch: (path: string, init?: RequestInit, options?: { skipToolbar?: boolean }) =>
        fetch(`https://${deployment}${path}`, withBypass(deployment, init, options)),
      chrome: (paths: string[]) => chromeVisits(`https://${deployment}`, paths, (first) => bypassHeaders(deployment, { setCookie: first, skipToolbar })),
    } as unknown as Ctx;
    const result = await toolbarOff.run(ctx).catch((error: Error) => ({ pass: false, detail: `error: ${error.message}` }));
    const header = skipToolbar ? "with" : "without";
    console.log(`check 11 (Vercel Toolbar), preview, ${header} x-vercel-skip-toolbar: ${result.pass ? "pass" : "FAIL"}: ${result.detail}`);
  }
}

// Only as the entry point, so a local test can import chromeVisits.
if (import.meta.main) {
  const command = process.argv[2];
  if (command === "wait") await wait();
  else if (command === "run") await run();
  else if (command === "preview") await preview();
  else {
    console.log("usage: bun check.ts wait | bun check.ts run | bun check.ts preview");
    process.exit(2);
  }
}
