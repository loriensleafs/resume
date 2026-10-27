// PROTOTYPE (deploy spike): finds this commit's deployment on the throwaway Vercel project and checks it.
// .github/workflows/spike-check.yml runs it in two steps:
//   bun check.ts wait         Waits for Vercel's commit status on this commit, then reads build-info.json from
//                             the project's Git branch URL until it names this commit. Writes
//                             origin=https://<the deployment's own URL> to $GITHUB_OUTPUT.
//   bun check.ts run <origin> Runs the checks against that deployment, one verdict line per check.
// It prints states, hosts and verdicts only. The bypass secret goes only to this project's *.vercel.app hosts.

const PROJECT_STATUS_URL = "https://vercel.com/peterkloss/resume-deploy-spike/"; // Vercel's commit status links here
const PROJECT_HOST = /^resume-deploy-spike-[a-z0-9-]+-peterkloss\.vercel\.app$/; // unique and branch URLs
const WAIT_MS = 15 * 60_000; // the brief's bound for one deployment
const POLL_MS = 10_000;

type BuildInfo = {
  commit: string | null;
  vercelEnv: string | null;
  deploymentHost: string | null;
  branchHost: string | null;
  vercelJsonBunVersion: string | null;
  lockfileVersion?: number | null; // from the restore commit on; the first two runs lack it
  bunVersion: string;
  bunRevision: string;
  bunPath: string;
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.log(`error: ${name} is not set`);
    process.exit(1);
  }
  return value;
}

function projectHost(host: string, what: string): string {
  if (!PROJECT_HOST.test(host)) {
    console.log(`error: ${what} ${JSON.stringify(host)} is not one of this project's *.vercel.app hosts`);
    process.exit(1);
  }
  return host;
}

function spikeHeaders(): Record<string, string> {
  return {
    "x-vercel-protection-bypass": env("VERCEL_AUTOMATION_BYPASS_SECRET"),
    "x-vercel-skip-toolbar": "1",
  };
}

async function fetchBuildInfo(origin: string): Promise<{ status: number; info?: BuildInfo }> {
  const res = await fetch(`${origin}/build-info.json`, { headers: spikeHeaders(), redirect: "manual" });
  if (res.status !== 200) return { status: res.status };
  return { status: 200, info: (await res.json()) as BuildInfo };
}

const short = (sha: string | null) => (sha ?? "none").slice(0, 7);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const branchHost = projectHost(env("SPIKE_BRANCH_HOST"), "SPIKE_BRANCH_HOST");
  const deadline = Date.now() + WAIT_MS;
  let last = "";
  const say = (line: string) => {
    if (line !== last) console.log(line);
    last = line;
  };

  console.log(`waiting up to ${WAIT_MS / 60_000} minutes for the deployment of ${short(sha)}`);
  while (Date.now() < deadline) {
    const status = await vercelStatus(repo, sha, token).catch((error: Error) => {
      say(`github: ${error.message}; trying again`);
      return undefined;
    });
    if (status === undefined) {
      // a failed read of the statuses; try again
    } else if (!status) {
      say("vercel: no commit status yet");
    } else if (status.state === "pending") {
      say(`vercel: pending (${status.description})`);
    } else if (status.state !== "success") {
      console.log(`vercel: ${status.state} (${status.description}); see ${status.target_url}`);
      process.exit(1);
    } else {
      say(`vercel: success (${status.description})`);
      const { status: http, info } = await fetchBuildInfo(`https://${branchHost}`).catch((error: Error) => {
        say(`branch URL ${branchHost}: ${error.message}; trying again`);
        return { status: 0, info: undefined };
      });
      if (http === 0) {
        // a failed fetch; try again
      } else if (http !== 200) {
        say(`branch URL ${branchHost}: HTTP ${http}`);
      } else if (info?.commit !== sha) {
        say(`branch URL ${branchHost}: serves ${short(info?.commit ?? null)}, waiting for ${short(sha)}`);
      } else {
        const host = projectHost(info.deploymentHost ?? "", "build-info deploymentHost");
        console.log(`deployment of ${short(sha)}: https://${host}`);
        const output = Bun.file(env("GITHUB_OUTPUT"));
        await Bun.write(output, ((await output.exists()) ? await output.text() : "") + `origin=https://${host}\n`);
        return;
      }
    }
    await sleep(POLL_MS);
  }
  console.log(`error: no deployment of ${short(sha)} within ${WAIT_MS / 60_000} minutes; last state: ${last}`);
  process.exit(1);
}

type Verdict = { check: number; name: string; pass: boolean; detail: string; ifFails: string };

/**
 * Check 1: which Bun runs the build. SPEC-deploy needs every build tool on Bun 1.4, so the check passes on the
 * 1.4 line. Whether vercel.json's bunVersion decides it was settled by a control run with "1.x" (README):
 * it does not; Vercel's install step picks Bun 1.4 from bun.lock's lockfileVersion 2 (@vercel/build-utils 14.10.1).
 */
function checkBuildBun(info: BuildInfo): Verdict {
  const pass = info.bunVersion.startsWith("1.4.");
  const facts =
    `the build ran Bun ${info.bunVersion} (${info.bunPath}, revision ${info.bunRevision.slice(0, 9)}); ` +
    `vercel.json bunVersion "${info.vercelJsonBunVersion}"; bun.lock lockfileVersion ${info.lockfileVersion ?? "not recorded"}`;
  return {
    check: 1,
    name: "build Bun",
    pass,
    detail: pass ? facts : `${facts}; SPEC-deploy needs Bun 1.4`,
    ifFails: "the install command installs Bun 1.4.2 and the build command calls $HOME/.bun/bin/bun",
  };
}

async function run(origin: string): Promise<void> {
  const sha = env("GITHUB_SHA");
  const host = projectHost(new URL(origin).host, "origin");
  const { status, info } = await fetchBuildInfo(`https://${host}`);
  if (status !== 200 || !info) {
    console.log(`error: build-info.json answered HTTP ${status}${status === 401 ? " (the bypass was not accepted)" : ""}`);
    process.exit(1);
  }
  if (info.commit !== sha) {
    console.log(`error: ${host} is the deployment of ${short(info.commit)}, not ${short(sha)}`);
    process.exit(1);
  }
  console.log(`deployment ${host}: commit ${short(sha)}, VERCEL_ENV ${info.vercelEnv}`);

  const verdicts = [checkBuildBun(info)];
  for (const v of verdicts) {
    const tail = v.pass ? "" : `; if it fails: ${v.ifFails}`;
    console.log(`check ${v.check} (${v.name}): ${v.pass ? "pass" : "FAIL"}: ${v.detail}${tail}`);
  }
  const failed = verdicts.filter((v) => !v.pass).length;
  console.log(`checks: ${verdicts.length - failed} pass, ${failed} fail`);
  if (failed) process.exit(1);
}

const [command, arg] = process.argv.slice(2);
if (command === "wait") await wait();
else if (command === "run" && arg) await run(arg);
else {
  console.log("usage: bun check.ts wait | bun check.ts run <origin>");
  process.exit(2);
}
