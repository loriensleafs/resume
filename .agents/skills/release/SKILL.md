---
name: release
description: Release procedure for every push to `main` in this repository. It checks the branch, finds whether the push changes a site file, asks Peter, pushes, watches the required checks and confirms whether peterkloss.dev is live. Use before every push to `main`, even one that looks docs-only, and whenever Peter asks to push to `main`, release or deploy a change.
---

# Release

A push to `main` that changes a site file is a release. Once its three required checks pass, it goes live at peterkloss.dev, so Peter approves each one ([SPEC-deploy](../../../spec/SPEC-deploy.md), "Releases"). A site file is any tracked path that `scripts/docs-only.txt` does not list. A push that changes no site file is not a release and needs no release question. Every push needs Peter's approval: a release through step 3, any other push once, unless Peter asked for that push.

## 1. Find the site changes

Start on `main`, with every commit from GitHub:

```sh
git branch --show-current
git fetch origin
git rev-list --count main..origin/main
git rev-list --count origin/main..main
```

- When the branch is not `main`, stop and tell Peter which branch is checked out. This skill pushes `main` only.
- When the first count is not `0`, GitHub has commits that the local `main` lacks. Run `git rebase --autostash origin/main`, then the before-commit checks of step 2. On a conflict, run `git rebase --abort`, stop, and tell Peter.
- When the second count is `0`, the local `main` has nothing to push. Stop.

Then find the site changes. Run the second command only when the first one finds the script:

```sh
ls scripts/site-changed.sh
sh scripts/site-changed.sh origin/main main; echo "exit $?"
```

- **No script:** the deploy module is not built yet. No script decides which files are site files, and no release check runs. Tell Peter so. Then do steps 2, 3, 4 and 6. In step 3, list every file that the commits change.
- **Exit 0:** no site file changed, so the push is not a release. Leave out steps 2, 3 and 5. When Peter has not asked for this push in this session, ask him once through `brain:ask-user-question`, with the commit to push (`git rev-parse --short main`) and the commits. A decline ends the push, and the commits stay local.
- **Exit 1:** a site file changed, so the push is a release. Go on to step 2.
- **Any other exit code:** the script failed. Treat the push as a release, and put the error in step 3's question. An extra release question is safe; a skipped one hides a change.

Done when the branch is `main`, the first count is `0` and the second is not, the exit code is known or the script is known to be missing, and Peter has answered any question that exit 0 needed.

## 2. Run the before-commit checks

```sh
bun run build
bun run build:site
bun test
```

Run `bun run build:site` once `package.json` has it ([AGENTS.md](../../../AGENTS.md), "Verify"). CI runs the same checks on the pushed commit. Run them here first, so that Peter approves a release that already builds.

Done when all of them pass. After a failure, fix it in a new commit and start again at step 1, so that Peter sees the fix in step 3.

## 3. Ask Peter

Load `brain:ask-user-question` and ask one question: may these commits go to `main`? Put in the question:

- the commit to push, from `git rev-parse --short main`;
- the commits, from `git log --oneline origin/main..main`;
- the site files: the files in `git diff --name-only origin/main...main` that `scripts/docs-only.txt` does not list;
- the result of step 2.

Done when Peter approved this push, or declined it. A decline ends the release, and the commits stay local.

## 4. Push

When Peter's approval named a commit, check that `git rev-parse --short main` still prints it. Then push, and compare GitHub's `main` with the local one:

```sh
git push origin main
git ls-remote origin refs/heads/main
git rev-parse main
```

When GitHub rejects the push because `origin/main` has new commits, start again at step 1. A force-push needs Peter's approval each time ([AGENTS.md](../../../AGENTS.md)).

Done when the commit from `git ls-remote` equals the commit from `git rev-parse main`.

## 5. Watch the three required checks

A release has three required checks on the pushed commit: the jobs `test` and `audit` of the workflow `ci`, and the release check. Write the pushed commit's full hash into each command; a shell variable does not reach the next command.

```sh
gh run list --commit <commit> --workflow ci.yml --json databaseId,status,conclusion
gh run watch <run id>
gh run view <run id> --json jobs --jq '.jobs[] | select(.name == "test" or .name == "audit") | {name, conclusion}'
gh api "repos/{owner}/{repo}/commits/<commit>/status" --jq '.statuses[] | {context, state, target_url}'
```

- GitHub can take a minute to list a new run. Repeat `gh run list` until the run appears.
- Read `test` and `audit` by name. The run's own conclusion also counts the job `audit-all`, which is not a required check.
- The release check posts a commit status. [Research 12](../../../docs/research/12-deploy-platform.md) records its name from spike check 12, and setup step 10 requires that name. Its `target_url` links to the release check's run. It waits up to 20 minutes for CI, then runs the smoke check, so it can take half an hour.
- No release check runs while `.github/workflows/release-check.yml` is missing on `main` (task D32). When CI has finished and no release-check status appears within 35 minutes, Vercel did not build the commit, or the release check is not set up.
- When the release-check status is still `pending` 45 minutes after CI finished, stop waiting.
- Tell Peter each change of state while you wait.

Done when `test`, `audit` and the release check all passed, one of them failed, no release check ran, or the release check is still pending after 45 minutes.

## 6. Report

- **Not a release** (step 1, exit 0): the commits are on GitHub, and peterkloss.dev does not change.
- **No script** (step 1): the commits are on GitHub. No release check ran, because the deploy module is not built.
- **All three checks passed:** confirm that the release is live. `curl -s https://peterkloss.dev/api/status` names the live commit, which must equal the pushed commit. The route keeps its answer for 60 seconds, so ask again after a minute when the commits differ. When they still differ, the checks passed but the release is not live: domain auto-assignment can be off after a rollback (`docs/runbooks/rollback.md`).
- **A check failed:** name the check and its failed step (`gh run view <run id> --log-failed`; the release check's run id is in its status's `target_url`). The site stays on the last good deployment. A failed release check sends Peter a limit alert, "Release <short commit> failed: <step>". Peter promotes or rolls back a deployment in the Vercel dashboard; point him to `docs/runbooks/release-failed.md` and `docs/runbooks/rollback.md`.
- **No release check ran:** say why, from step 5. No limit alert went out.
- **Release check still pending:** give its `target_url`. The deployment stays off peterkloss.dev until the release check passes.

Done when Peter has the outcome.
