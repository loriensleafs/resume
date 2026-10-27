---
name: release
description: Release procedure for every push to `main` in this repository, and the private-detail check for a push of any other branch. It checks the branch, checks the commits for private details, stops for the changes Peter still approves, finds whether the push changes a site file, runs the checks, records the push, pushes, watches the required checks and confirms whether peterkloss.dev is live. Use before every push to `main`, even one that looks docs-only, before a push of any other branch such as `prototype/deploy-spike`, and whenever Peter asks to push, release or deploy a change.
---

# Release

A push to `main` that changes a site file is a release. Once its three required checks pass, it goes live at peterkloss.dev ([SPEC-deploy](../../../spec/SPEC-deploy.md), "Releases"). A site file is any tracked path that `scripts/docs-only.txt` does not list. [AGENTS.md](../../../AGENTS.md), "Releases and approvals", says which pushes need Peter's approval (decision record row 151). This skill stops for those it can see in the commits, and pushes the rest once the checks pass. Peter does not see a push before it happens, so step 1 checks it for private details, and steps 5 and 6 tell him the outcome.

## 1. Check what the push sends

Start on `main`, with every commit from GitHub:

```sh
git branch --show-current
git fetch origin
git rev-list --count main..origin/main
git rev-list --count origin/main..main
```

- When the branch is not `main` and you mean to push that branch, such as `prototype/deploy-spike` (D1 to D5): run only the private-detail check below, on that branch's range `origin/<branch>..<branch>` (`origin/main..<branch>` for a branch GitHub does not have yet). Push it with `git push origin <branch>` only when the check prints `0`. The rest of this skill is for `main`.
- When the branch is not `main` in any other case, stop and tell Peter which branch is checked out.
- When the first count is not `0`, GitHub has commits that the local `main` lacks. Run `git rebase --autostash origin/main`, then the before-commit checks of step 2. On a conflict, run `git rebase --abort`, stop, and tell Peter.
- When the second count is `0`, the local `main` has nothing to push. Stop.

Now note the checked commit, the commit that `git rev-parse main` prints. Every check below runs on it, and step 4 pushes only it.

**Private details** ([decision 0006](../../../docs/decisions/0006-public-repo-private-details.md)). The check reads `private.yaml` and every commit to push, with its message and its changes, and prints one number, never a value. The script's header says what it matches.

```sh
bun scripts/private-detail-check.ts origin/main..main
```

- It prints `0`: go on.
- It prints a number above `0`: a commit to push holds a private detail. Stop, and push nothing. Ask Peter through `brain:ask-user-question`: give the number and the range, name no value, and recommend rewriting the unpushed commits without the detail. The commits stay local until he answers.
- It prints `cannot check: <reason>`, or anything else: stop, and push nothing. Tell Peter the reason, which holds no value. When the reason is a missing `private.yaml`, copy it into this clone from Peter's main checkout, then start again at step 1.

This check runs on every push, a docs-only push included.

**Changes Peter still approves.** A change to `scripts/docs-only.txt` and a change to an approved part of the knowledge base need his approval each time (AGENTS.md, "Releases and approvals"). List them:

```sh
git diff --name-status origin/main...main -- scripts/docs-only.txt knowledge/deep-dives knowledge/sources knowledge/logistics.yaml
```

- It prints nothing, or only lines that start with `A` (a new file: the docs-only list that D30 writes, or a new source that the `write-source` skill put to Peter): go on.
- A line starts with another letter (`M`, `D` or `R`: a change to a file that `origin/main` holds): go on only when the commits to push add a decision record row in `docs/design/` that holds Peter's approval of that change, as K11 to K13 do. Otherwise ask him through `brain:ask-user-question`, with the files and the commits. A decline ends the push, and the commits stay local.

**Site changes.** Run the second command only when the first one finds the script:

```sh
ls scripts/site-changed.sh
sh scripts/site-changed.sh origin/main main; echo "exit $?"
```

- **No script:** the deploy module is not built yet. No script decides which files are site files, and no release check runs. Tell Peter so. Then do steps 2, 3, 4 and 6. In step 3, record every file that the commits change.
- **Exit 0:** no site file changed, so the push is not a release. Leave out steps 2, 3 and 5. The before-commit checks ran on each commit ([AGENTS.md](../../../AGENTS.md), "Verify"), and the private-detail check above ran on this push.
- **Exit 1:** a site file changed, so the push is a release. Go on to step 2.
- **Any other exit code:** the script failed. Treat the push as a release, and put the error in step 3's record. An extra release watch is safe; a skipped one hides a change.

Done when the branch is `main`, the first count is `0` and the second is not, the private-detail check printed `0`, each change Peter still approves has his approval, and the exit code is known or the script is known to be missing.

## 2. Run the before-commit checks

```sh
bun run build
bun run build:site
bun test
```

Run `bun run build:site` once `package.json` has it ([AGENTS.md](../../../AGENTS.md), "Verify"). CI runs the same checks on the pushed commit. Run them here first, so that every release already builds when it reaches GitHub.

Done when all of them pass on the checked commit. After a failure, fix it in a new commit and start again at step 1, so that step 3 records the fix.

## 3. Record the push

Keep this record in the session's notes. Step 6 gives it to Peter, and at the task's end STATUS records the pushed commits ([AGENTS.md](../../../AGENTS.md), "Task end"):

- the commit to push, from `git rev-parse --short main`;
- the commits, from `git log --oneline origin/main..main`;
- the site files: the files in `git diff --name-only origin/main...main` that `scripts/docs-only.txt` does not list;
- the result of step 2.

Done when the record holds these four items.

## 4. Push

Check that `git rev-parse main` still prints the checked commit. When it prints another commit, a commit came in after the checks: start again at step 1. Then push, and compare GitHub's `main` with the local one:

```sh
git push origin main
git ls-remote origin refs/heads/main
git rev-parse main
```

When GitHub rejects the push because `origin/main` has new commits, start again at step 1. A force-push needs Peter's approval each time ([AGENTS.md](../../../AGENTS.md)).

Done when the commit from `git ls-remote` equals the commit from `git rev-parse main`.

## 5. Watch the three required checks

A release has three required checks on the pushed commit: the jobs `test` and `audit` of the workflow `ci`, and the release check. Write the pushed commit's full hash into each command; a shell variable does not reach the next command.

The whole wait has one limit: 90 minutes from the push. CI's `test` job stops at 20 minutes, and the release check waits up to 20 minutes for CI and then runs the smoke check, so a passing release ends inside that limit. Run each wait as a background command (in Claude Code, a shell call with `run_in_background`), because a foreground tool call can end at 20 minutes. Tell Peter each change of state while you wait.

1. Find the CI run. GitHub can take a minute to list a new run, so try at most 10 times, 30 seconds apart. When no run appears after the tenth try, CI did not start: stop waiting.

   ```sh
   gh run list --commit <commit> --workflow ci.yml --json databaseId,status,conclusion
   ```

2. Watch the run in the background, then read `test` and `audit` by name. The run's own conclusion also counts the job `audit-all`, which is not a required check.

   ```sh
   gh run watch <run id> --exit-status
   gh run view <run id> --json jobs --jq '.jobs[] | select(.name == "test" or .name == "audit") | {name, conclusion}'
   ```

3. Read the release check's status every 2 minutes, in the background, until its state is `success`, `failure` or `error`, or the 90 minutes are up.

   ```sh
   gh api "repos/{owner}/{repo}/commits/<commit>/status" --jq '.statuses[] | {context, state, target_url}'
   ```

   The release check posts a commit status. [Research 12](../../../docs/research/12-deploy-platform.md) records its name from spike check 12, and setup step 10 requires that name. Its `target_url` links to the release check's run. No release check runs while `.github/workflows/release-check.yml` is missing on `main` (task D32). When no release-check status has appeared by the end of the 90 minutes, Vercel did not build the commit, or the release check is not set up.

Done when `test`, `audit` and the release check all passed, one of them failed, no CI run appeared, or the 90 minutes from the push are up.

## 6. Report

Give Peter the outcome, with step 3's record when step 3 ran.

- **Not a release** (step 1, exit 0): the commits are on GitHub, and peterkloss.dev does not change.
- **No script** (step 1): the commits are on GitHub. No release check ran, because the deploy module is not built.
- **All three checks passed:** confirm that the release is live. `curl -s https://peterkloss.dev/api/status` names the live commit, which must equal the pushed commit. The route keeps its answer for 60 seconds, so ask again after a minute when the commits differ. When they still differ, the checks passed but the release is not live: domain auto-assignment can be off after a rollback (`docs/runbooks/rollback.md`).
- **A check failed:** name the check and its failed step (`gh run view <run id> --log-failed`; the release check's run id is in its status's `target_url`). The site stays on the last good deployment. A failed release check sends Peter a limit alert, "Release <short commit> failed: <step>". Peter promotes or rolls back a deployment in the Vercel dashboard; point him to `docs/runbooks/release-failed.md` and `docs/runbooks/rollback.md`.
- **No CI run:** the commits are on GitHub, and no check ran on them. Give the commit, so Peter can look at the repository's Actions page.
- **No release check ran:** say why, from step 5. No limit alert went out.
- **Release check still pending at 90 minutes:** give its `target_url`. The deployment stays off peterkloss.dev until the release check passes.

Done when Peter has the outcome.
