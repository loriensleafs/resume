---
name: update-mockups
description: Change the site mockups and keep their three copies in step (the private Claude Design canvas "Resume site mockups", the board sources on the branch `prototype/site-mockups` and the images in `docs/design/mockups/` on `main`). Use when Peter asks to change, add or fix a mockup, a board or a mockup image, when a spec change alters what a view of the site or the chat shows, and before any edit to `docs/design/mockups/`.
---

# Update the mockups

The mockups are the approved look of the site. They exist as three copies, and a change keeps all three in step:

| Copy | Where | What it holds |
| --- | --- | --- |
| The canvas | The private Claude Design canvas "Resume site mockups" | The boards. Change a board here and nowhere else |
| The board sources | `prototypes/site-mockups/` on the branch `prototype/site-mockups` | Each board as `boards/<Name>.dc.html`, the canvas index `boards/canvas.json`, `export.ts`, `design-system-bundle.ts` and a README |
| The images | [docs/design/mockups/](../../../docs/design/mockups/README.md) on `main` | A PNG of each board that `export.ts` lists, in the modes it names, and the README that lists them |

Only a session with the Artifact tool can change the canvas.

## 1. Settle the change

Read the design request against the approved specs, [SPEC-site](../../../spec/SPEC-site.md) and [SPEC-chat](../../../spec/SPEC-chat.md), and against the decision record rows that the [mockups README](../../../docs/design/mockups/README.md) names.

- A change that makes a board match an approved spec is settled.
- A change Peter asked for is his decision. Add it as a row in the decision record (the newest `docs/design/interview-<date>.md`), and ask only about what his request leaves open.
- Any other change of product behavior needs Peter's decision first: what a view shows or does, a text, a new state. Ask him through `brain:ask-user-question`, and add his answer as a row in the decision record.
- A decided change of behavior also changes the spec text that describes it.

Then check your tools. With no Artifact tool, commit the new rows and spec changes, and stop. Tell Peter the settled change and its row numbers, and that a session with the Artifact tool runs steps 2 to 5.

Done when each part of the change matches an approved spec or a decision record row.

## 2. Change the canvas

The boards are HTML pages built with `@acmelabs/design-system-browser` 0.3.2, not React. Run the capability check ([AGENTS.md](../../../AGENTS.md), "Work through brain") for this work: load the design system's `choose-and-compose` and `html-artifacts` skills with `bun run intent load @acmelabs/design-system#<skill>`, and ask the `acme-design-system` docs server about each component with the version `0.3.2` and the framework `html`.

Find the canvas with the Artifact tool's `list` action: its title is "Resume site mockups". Read it and its type's instructions. Read each file you change by its `path`, `canvas.json` included, then edit only the files the change needs:

- Edit the light board. Each `Dark…` board imports its light board with `appearance="dark"`, so the dark board follows.
- Model a new board on its nearest sibling on the same page: the `appearance` prop that `export.ts` sets, its entries in `canvas.json` (`boards`, with `w`, `h`, `page` and `title`, and `order`), and a `Dark…` twin where the page shows light and dark side by side.
- A component that `design-system-bundle.ts` on the branch does not import yet needs its imports there, in the pattern of the file's other imports (an icon needs two). Set up step 3's checkout and render tools first. Rebuild `boards/acme/design-system.js` with the bundle step of the branch README, and publish it as `acme/design-system.js`.

Publish every changed file in one call: `publish` with the canvas `url` and `files`. Note the new version number for steps 3 to 5.

Done when the publish succeeded and the canvas has a new version.

## 3. Update the branch and render the images

The `main` checkout is the first path that `git worktree list` prints. Work on the branch in a second checkout beside it, so that the `main` checkout stays on `main`. In the `main` checkout:

```sh
git fetch origin prototype/site-mockups
git worktree add ../resume-mockups prototype/site-mockups
```

When `../resume-mockups` exists already, run `git -C ../resume-mockups pull --ff-only` instead. Then, in `../resume-mockups/prototypes/site-mockups/`:

1. Read the changed boards and `canvas.json` back from the canvas (the Artifact tool's `read` with `paths`), and copy them into `boards/`.
2. Install the render tools with steps 1 and 2 under "Render the images again" in the branch's `prototypes/site-mockups/README.md`. The folder has no `package.json` on the branch. Without one, `bun add` writes to the branch's root `package.json` and `bun.lock`, and the bundle build cannot resolve `./node_modules/…`. So when `package.json` is missing in this folder, write `{"private": true}` to it first.
3. Render into the `main` checkout, and only the changed boards: `bun export.ts boards <main checkout>/docs/design/mockups <slug> …`. Each board's slug is in the `boards` list of `export.ts`; a new board needs its entry there.
4. Set the canvas version and the date in the branch's `README.md`. Stage it by name with the changed boards and `canvas.json`, plus `export.ts` or `design-system-bundle.ts` when they changed. Commit as "Update the mockup sources to canvas version <n>". This commit holds prototype sources only: the render's `package.json`, `bun.lock` and `node_modules/` stay out, and the before-commit checks run for `main` in step 4.
5. Ask Peter once through `brain:ask-user-question` before the push, unless he asked for this push in this session (the push rule of the [release skill](../release/SKILL.md)). Then push with `git push origin prototype/site-mockups`.

Done when `git ls-remote origin refs/heads/prototype/site-mockups` prints the same commit as `git rev-parse HEAD` in the branch checkout, or Peter declined the push. A decline stops the skill, and the commit stays local.

## 4. Update the images on `main`

Board sources never go to `main`: the mockups on `main` are the images and their README.

1. In the `main` checkout, `git status` lists the rendered images. Check that only the changed boards' images changed, and look at each one.
2. Update the [mockups README](../../../docs/design/mockups/README.md): add an "Updated" paragraph with the date, the canvas version and the decision record rows, and list what changed. A new board gets a row in its table.
3. Run the before-commit checks ([AGENTS.md](../../../AGENTS.md), "Verify").
4. Stage by name the images, the README, and any row or spec change from step 1 that is not committed yet. Commit as "docs(design): update the mockup images to canvas version <n>".
5. Push `main` with the [release skill](../release/SKILL.md).

Done when the release skill reports the commit on GitHub, or Peter declined the push. A decline stops the skill.

## 5. Ask Peter to approve

Ask through `brain:ask-user-question` whether Peter approves the changed boards. Put in the question the canvas link and version, each changed board with what changed on it, and the paths of its images on `main`.

Add his answer as a row in the decision record, and commit it; the next push of `main` takes it. Named changes go back to step 2.

Done when Peter approved or named changes, and his answer is a committed decision record row.
