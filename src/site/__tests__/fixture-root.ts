// The fixture root of seam 1 (SPEC-site, Testing 1): a folder that holds the project's files, as the build script's
// --root reads them. Its resume.yaml is the repository's, with a name, a lead and a headline of its own, so a page that
// shows them read this root. Its private.yaml holds a fake phone number, so a file that holds it leaks a private
// detail. Its knowledge/sources/ holds two approved sources and a draft, each with Not public text (S16). Its
// knowledge/logistics.yaml holds an approved answer and a draft one, which only the device index can show (C16). A task
// whose build step reads another project file adds that file here.

const REPO = `${import.meta.dir}/../../..`;

/** The fixture root's phone number, in NANPA's range for fiction (555-0100 to 555-0199). */
export const FAKE_PHONE = "(555) 555-0100";
/** Only the fixture root's resume.yaml holds this name, so a page title that shows it read that resume.yaml. */
export const FIXTURE_NAME = "The Fixture Root’s Name";
/** Only the fixture root's resume.yaml holds this lead, so a page that shows it read resume.yaml from that root. */
export const FIXTURE_LEAD = "The fixture root’s lead, which no other resume.yaml holds.";
/** Only the fixture root's resume.yaml holds this headline, so an app bar that shows it read that resume.yaml. */
export const FIXTURE_HEADLINE = "The fixture root’s headline, which no other resume.yaml holds";

/**
 * The fixture root's approved deep dive. Its role and its five passages give SPEC-site's example of a kind line: "Deep
 * dive, written from Peter's answers and approved by him. FedNow, 2021 – 2024. 5 passages."
 */
export const FIXTURE_DEEP_DIVE = "fixture-deep-dive";
/** The fixture root's approved interview, about two roles, with an answer in two paragraphs. */
export const FIXTURE_INTERVIEW = "fixture-interview";
/** The fixture root's draft source: no page, no file and no text of it may reach the output. */
export const FIXTURE_DRAFT = "fixture-draft";

/** The deep dive's one link, which the interview also gives. Only the device index shows a source's links (C16). */
export const FIXTURE_LINK = "https://example.com/the-fixture-root/deep-dive";
/** The interview's second link. */
export const FIXTURE_INTERVIEW_LINK = "https://example.com/the-fixture-root/interview";

/** The fixture root's one approved logistics answer, on the topic work-arrangement. */
export const FIXTURE_LOGISTICS_ANSWER = "The fixture root’s work-arrangement answer.";
/** The fixture root's draft logistics answer: no output may hold it. */
export const FIXTURE_DRAFT_LOGISTICS_ANSWER = "The fixture root’s draft availability answer, which no output holds.";

/** The fixture root's knowledge/logistics.yaml (SPEC-knowledge, Logistics answers). */
const LOGISTICS = `topics:
  - topic: work-arrangement
    answer: ${FIXTURE_LOGISTICS_ANSWER}
    status: approved
    approved: 2026-10-27
  - topic: availability
    answer: ${FIXTURE_DRAFT_LOGISTICS_ANSWER}
    status: draft
`;

/** The knowledge/sources/ files of the fixture root, by file name. Each text is the fixture's own, in plain prose. */
const SOURCES: Record<string, string> = {
  [`${FIXTURE_DEEP_DIVE}.md`]: `---
id: ${FIXTURE_DEEP_DIVE}
title: The fixture root’s deep dive
kind: deep-dive
subject: project
roles: [fednow]
highlights: [highlight:fednow.1]
summary: The fixture deep dive’s summary, which its page gives as its description.
links: ["${FIXTURE_LINK}"]
status: approved
approved: 2026-10-27
source: Interview with Peter, 2026-10-27
---

## Problem

The fixture deep dive’s problem, in its own words.

## What Peter did

The fixture deep dive’s account of what Peter did.

## How it worked

The fixture deep dive’s account of how it worked.

## Result

The fixture deep dive’s result.

## Tools

The fixture deep dive’s tools.

## Not public

The fixture deep dive’s Not public kinds of material, which no static file holds.
`,
  [`${FIXTURE_INTERVIEW}.md`]: `---
id: ${FIXTURE_INTERVIEW}
title: The fixture root’s interview
kind: interview
subject: career
roles: [highspot, fednow]
summary: The fixture interview’s summary, which its page gives as its description.
links: ["${FIXTURE_LINK}", "${FIXTURE_INTERVIEW_LINK}"]
status: approved
approved: 2026-10-27
source: Interview with Peter, 2026-10-27
---

## Why the fixture question?

The fixture interview’s first answer, in its first paragraph.

The fixture interview’s first answer, in its second paragraph.

## Why the fixture question? (continued)

The fixture interview’s first answer, continued.

## How did you help with the fixture?

The fixture interview’s second answer.

## Not public

The fixture interview’s Not public kinds of material, which no static file holds.
`,
  [`${FIXTURE_DRAFT}.md`]: `---
id: ${FIXTURE_DRAFT}
title: The fixture root’s draft source
kind: interview
subject: story
roles: [fednow]
summary: The fixture draft’s summary, which no output holds.
links: ["https://example.com/${FIXTURE_DRAFT}"]
status: draft
source: Interview with Peter, 2026-10-27
---

## What did the fixture draft ask?

The fixture draft’s answer, which no output holds.

## Not public

The fixture draft’s Not public kinds of material.
`,
};

/**
 * Writes the fixture root into the folder `root`: its resume.yaml, its private.yaml, its logistics answers and its
 * knowledge sources.
 */
export async function writeFixtureRoot(root: string): Promise<void> {
  const source = Bun.YAML.parse(await Bun.file(`${REPO}/resume.yaml`).text()) as { basics: object };
  const fixtureSource = {
    ...source,
    basics: { ...source.basics, name: FIXTURE_NAME, summary: FIXTURE_LEAD, label: FIXTURE_HEADLINE },
  };
  await Bun.write(`${root}/resume.yaml`, Bun.YAML.stringify(fixtureSource));
  await Bun.write(`${root}/private.yaml`, `basics:\n  phone: ${FAKE_PHONE}\n`);
  await Bun.write(`${root}/knowledge/logistics.yaml`, LOGISTICS);
  for (const [name, text] of Object.entries(SOURCES)) await Bun.write(`${root}/knowledge/sources/${name}`, text);
}
