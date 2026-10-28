---
name: update-mockups
description: Change the site mockups and keep their three copies in step (the canvas, the board sources and the images). Use when Peter asks to change, add or fix a mockup or a board, when a spec change alters what a view of the site or the chat shows, and before any edit to `docs/design/mockups/`.
---

# Update the mockups

The mockups are the approved look of the site and the chat. They exist as three copies, and a change keeps all three in step:

| Copy | Where | What it holds |
| --- | --- | --- |
| The canvas | The private Claude Design canvas "Resume site mockups" | The boards. Every change starts here |
| The board sources | `prototypes/site-mockups/` on the branch `prototype/site-mockups` | A copy of each board and of the canvas index, with the render tools. Its README lists the files and the render steps |
| The images | [docs/design/mockups/](../../../docs/design/mockups/README.md) on `main` | A PNG of each board in each of its modes, and the README that lists them |

Only a session with the Artifact tool can change the canvas.

The main checkout is the first path that `git worktree list` prints. Steps 1, 4 and 5 write into it, and each one starts with the **checkout check**: in the main checkout, `git branch --show-current` prints `main`, and `git status --short` lists only files that this run changed. When the check fails, stop and tell Peter what the checkout holds.

## 1. Settle the change

Run the checkout check. Read the design request against the approved specs, [SPEC-site](../../../spec/SPEC-site.md) and [SPEC-chat](../../../spec/SPEC-chat.md), and against the decision record rows that the [mockups README](../../../docs/design/mockups/README.md) names.

- A change that makes a board match an approved spec is settled.
- A change Peter asked for is his decision. Add it as a row in the decision record (the newest `docs/design/interview-<date>.md`), and ask only about what his request leaves open.
- Any other change of product behavior needs Peter's decision first: what a view shows or does, a text, a new state. Ask him through `brain:ask-user-question`, and add his answer as a row in the decision record.
- A decided change of behavior also changes the spec text that describes it.

Write the rows and the spec changes in the main checkout and leave them uncommitted: step 5 commits them with the images. Then check your tools. With no Artifact tool, stop here. Tell Peter the settled change, its row numbers, and that a session with the Artifact tool runs steps 2 to 5 from these uncommitted changes.

Done when each part of the change matches an approved spec or a decision record row, and you either have the Artifact tool or have told Peter that you stopped.

## 2. Change the canvas

The boards load a design-system bundle that is built on the branch, so set up the branch checkout first. In the main checkout:

```sh
git fetch origin prototype/site-mockups
git worktree add ../resume-mockups prototype/site-mockups
git -C ../resume-mockups pull --ff-only
```

Leave out `git worktree add` when `../resume-mockups` exists. In `../resume-mockups/prototypes/site-mockups/`, install the render tools and build the bundle as the branch README's "Render the images again" says.

The boards are plain HTML pages built with `@acmelabs/design-system-browser`. Its version is written in one place: the `devDependencies` entry of `prototypes/site-mockups/package.json` on the branch. It moves together with the design-system packages in `package.json` on `main` (decision record row 172). Run the capability check ([AGENTS.md](../../../AGENTS.md), "Work through brain") for this work: load the design system's `choose-and-compose` and `html-artifacts` skills with `bun run intent load @acmelabs/design-system#<skill>`, and ask the `acme-design-system` docs server about each component with that version and the framework `html`.

A version move changes only that entry and `bun.lock`. Before you publish it, build the bundle at the old and the new version and compare the two files. When they differ, render every board at both versions on this machine and compare each pair. A board that looks different goes to Peter (step 4) before the canvas changes.

Find the canvas with the Artifact tool's `list` action: its title is "Resume site mockups". Read it with the `read` action, and follow the type instructions that the result gives. Read each file you change by its `path`, `canvas.json` included, then edit only the files the change needs:

- Edit the light board. Each `Dark…` board imports its light board with `appearance="dark"`, so the dark board follows.
- Model a new board on its nearest sibling on the same page: the `appearance` prop that `export.ts` sets, its entries in `canvas.json` (`boards`, with `w`, `h`, `page` and `title`, and `order`), and a `Dark…` twin where the page shows light and dark side by side.
- A component that `design-system-bundle.ts` does not import yet needs its imports there, in the pattern of the file's other imports (an icon needs two). Build the bundle again, and publish `boards/acme/design-system.js` as `acme/design-system.js`.

Publish every changed file in one call: `publish` with the canvas `url` and `files`. Note the new version number for steps 3 to 5.

Done when the publish succeeded and the canvas has a new version.

## 3. Update the branch and render the images

In `../resume-mockups/prototypes/site-mockups/`:

1. Read the changed boards and `canvas.json` back from the canvas (the Artifact tool's `read` with `paths`), and copy them into `boards/`. A new board also needs its entry, with its slug, in the `boards` list of `export.ts`.
2. Make a new empty render folder outside both checkouts with `mktemp -d`, and render only the changed boards into it: `bun export.ts boards <render folder> <slug> …`. A change that touches every board, such as a new design-system version, renders all 30 images in about 65 s: run it in the background, and give Peter its progress as the count of images in the render folder.
3. Set the canvas version and the date in the branch's `README.md`. Stage it by name with the changed boards and `canvas.json`, plus `export.ts`, `design-system-bundle.ts`, `package.json` or `bun.lock` when they changed. Commit as "Update the mockup sources to canvas version <n>".
4. Push the branch by step 1 of the [release skill](../release/SKILL.md), the path for a branch other than `main`. The branch has no `.agents/skills/release/scripts/`, so run the two checks from the branch checkout by their path in the main checkout.

Done when `git ls-remote origin refs/heads/prototype/site-mockups` prints the same commit as `git rev-parse HEAD` in the branch checkout, or the release skill stopped the push and Peter has its reason.

## 4. Ask Peter to approve

Peter approves the new images before they reach `main`, because the images on `main` are the approved look that the specs are written from.

1. Open each new image with the Read tool. Check that it shows the change, and that it shows no private detail, such as the phone number. The private-detail check cannot read text drawn in an image, so this look is the only check of the pixels.
2. Ask through `brain:ask-user-question` whether Peter approves the changed boards. Put in the question the canvas link and version, each changed board with what changed on it, the paths of its new images in the render folder, and that you looked at each image and found no private detail.
3. Run the checkout check, and add his answer as a row in the decision record.

When Peter names changes, they are the change for step 2.

Done when his answer is a row in the decision record, and he approved, or he named changes and you went back to step 2.

## 5. Update the images on `main`

`main` holds the images and their README; the board sources stay on the branch. Run the checkout check, then in the main checkout:

1. Copy the new images of the changed boards from the render folder into `docs/design/mockups/`, and only those. A new render of an unchanged board differs from its image on `main` at glyph edges, from the platform's font rendering. Git also keeps each image version for good: all 30 images add about 3.5 MB to the history.
2. In the [mockups README](../../../docs/design/mockups/README.md), add one dated line under "Updating": the date, the canvas version, the decision record rows, and what changed in a few words. A new board gets a row in its table.
3. Run the before-commit checks ([AGENTS.md](../../../AGENTS.md), "Verify").
4. Stage by name the images, the README, the decision record and the spec changes from step 1. Commit as "docs(design): update the mockup images to canvas version <n>".
5. Push `main` with the [release skill](../release/SKILL.md).

Done when the release skill reports the commit on GitHub, or it stopped the push and Peter has its reason.
