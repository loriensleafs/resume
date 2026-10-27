// PROTOTYPE (deploy spike): finds this commit's deployment on the throwaway Vercel project and checks it.
// .github/workflows/spike-check.yml runs it in two steps that share one 15-minute bound (RUN_MS):
//   bun check.ts wait  Waits for Vercel's commit status on this commit, reads /build-info.json from the project's
//                      Git branch URL until it names this commit, then waits until the production address serves
//                      the same commit. Writes deployment=, production= and deadline= to $GITHUB_OUTPUT.
//   bun check.ts run   Runs every check in CHECKS, in order, and prints one verdict line each.
// Adding a check (D2 to D5): append a Check to CHECKS. Its run(ctx) gets both hosts, build-info.json, the shared
// deadline and the helpers below. A check never touches the bypass secret; deploymentFetch adds it and
// productionFetch never sends it. Expected values come from build-info.json, which the build reads from its output.
// It prints states, hosts and verdicts only. Rerun only the newest run: an older one waits for a commit that the
// branch URL no longer serves.

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
};

type Report = Record<string, boolean | string | number | null>;

export type Ctx = {
  deployment: string; // the deployment's own host (protected)
  production: string; // the project's production .vercel.app address (public)
  info: BuildInfo; // this deployment's build-info.json
  deadline: number; // epoch ms: the end of this run's 15 minutes
  /** GET or other request on the deployment's own host, with the bypass and x-vercel-skip-toolbar; no redirects. */
  deploymentFetch(path: string, init?: RequestInit): Promise<Response>;
  /** Request on the public production address, with x-vercel-skip-toolbar only, never the bypass; no redirects. */
  productionFetch(path: string, init?: RequestInit): Promise<Response>;
  /** A flat JSON object that a spike function on the deployment reports: booleans, hosts, times, no tokens. */
  report(path: string): Promise<Report>;
  /** Calls attempt every 10 s until it returns a value, or until maxMs or the run's deadline passes. */
  poll<T>(label: string, maxMs: number, attempt: () => Promise<T | undefined>): Promise<T | undefined>;
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

const CHECKS: Check[] = [buildBun];

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

/** The only place the bypass secret is read. It goes out only to a host that matches PROTECTED_HOST. */
function withBypass(host: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("x-vercel-protection-bypass", env("VERCEL_AUTOMATION_BYPASS_SECRET"));
  headers.set("x-vercel-skip-toolbar", "1");
  protectedHost(host, "host");
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
    deploymentFetch: (path, init) => fetch(`https://${deployment}${path}`, withBypass(deployment, init)),
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
  };

  let failed = 0;
  for (const check of CHECKS) {
    const result = await check.run(ctx).catch((error: Error) => ({ pass: false, detail: `error: ${error.message}` }));
    if (!result.pass) failed++;
    const tail = result.pass ? "" : `; if it fails: ${check.ifFails}`;
    console.log(`check ${check.check} (${check.name}): ${result.pass ? "pass" : "FAIL"}: ${result.detail}${tail}`);
  }
  console.log(`checks: ${CHECKS.length - failed} pass, ${failed} fail`);
  if (failed) process.exit(1);
}

const command = process.argv[2];
if (command === "wait") await wait();
else if (command === "run") await run();
else {
  console.log("usage: bun check.ts wait | bun check.ts run");
  process.exit(2);
}
