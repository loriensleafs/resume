// Shared fixture builders for the knowledge tests.

import { $ } from "bun";
import { SECTIONS } from "../parse";

export const FAKE_PHONE = "(555) 555-0100";

/** The fixture resume source: one role with two highlights, one skills group. */
export const RESUME_YAML = `basics:
  name: Test Person
  label: Engineer
  email: test@example.com
  summary: A summary.
  location: { city: Boston, region: MA, countryCode: US }
  profiles: []
work:
  - id: acme
    name: Acme
    position: Engineer
    startDate: 2020
    highlights: [Built the first thing., Built the second thing.]
skills:
  - name: Platform and tooling
    keywords: [Bun]
education:
  - institution: A University
`;

const tmp = `${Bun.env.TMPDIR ?? "/tmp"}/knowledge-test-${crypto.randomUUID()}`;

/**
 * A temporary repo root with `RESUME_YAML`, a `private.yaml` that holds `FAKE_PHONE`, then
 * `files` (a `resume.yaml` there replaces the fixture's). Call `removeFixtures` in `afterAll`.
 */
export async function fixture(name: string, files: Record<string, string> = {}): Promise<string> {
  const root = `${tmp}/${name}`;
  await Bun.write(`${root}/resume.yaml`, RESUME_YAML);
  await Bun.write(`${root}/private.yaml`, `basics:\n  phone: ${FAKE_PHONE}\n`);
  for (const [path, text] of Object.entries(files)) await Bun.write(`${root}/${path}`, text);
  return root;
}

export async function removeFixtures(): Promise<void> {
  await $`rm -rf ${tmp}`.quiet().nothrow();
}

/** Front matter as one YAML value per field; `null` leaves the field out. */
type Front = Record<string, string | null>;

function sourceFile(defaults: Front, front: Front, body: string): string {
  const yaml = Object.entries({ ...defaults, ...front })
    .filter(([, value]) => value !== null)
    .map(([field, value]) => `${field}: ${value}`)
    .join("\n");
  return `---\n${yaml}\n---\n\n${body}`;
}

/** An approved deep dive, `sample`, about the fixture role `acme` and its first highlight. */
const DEEP_DIVE_FRONT: Front = {
  id: "sample",
  title: "A sample deep dive",
  kind: "deep-dive",
  subject: "project",
  roles: "[acme]",
  highlights: "[highlight:acme.1]",
  summary: "How Peter built the first thing.",
  links: "[]",
  status: "approved",
  approved: "2026-10-27",
  source: "Interview with Peter, 2026-10-27",
};

/** The six deep-dive sections, each with one line of text. */
export const DEEP_DIVE_BODY = SECTIONS.map((s) => `## ${s}\n\n${s === "Not public" ? "Internal code." : `Text for ${s}.`}\n`).join("\n");

/** A source file in the new front matter: `DEEP_DIVE_FRONT` with `front` laid over it, then `body`. */
export function deepDiveFile(front: Front = {}, body = DEEP_DIVE_BODY): string {
  return sourceFile(DEEP_DIVE_FRONT, front, body);
}

/** An approved interview, `sample`, about the fixture role `acme`. It has no highlights field. */
const INTERVIEW_FRONT: Front = {
  id: "sample",
  title: "Why platform work",
  kind: "interview",
  subject: "career",
  roles: "[acme]",
  summary: "Why Peter chose front-end platform work.",
  links: "[]",
  status: "approved",
  approved: "2026-10-27",
  source: "Interview with Peter, 2026-10-27",
};

/** Two questions, the first answered over two passages, then Not public. */
const INTERVIEW_BODY = [
  "## Why front-end platform work?\n\nI like building what other engineers use.\n",
  "## Why front-end platform work? (continued)\n\nAnd I like seeing a whole team move faster.\n",
  "## How did you help with the migration?\n\nI helped plan it.\n",
  "## Not public\n\nColleague names.\n",
].join("\n");

/** A source file in the new front matter: `INTERVIEW_FRONT` with `front` laid over it, then `body`. */
export function interviewFile(front: Front = {}, body = INTERVIEW_BODY): string {
  return sourceFile(INTERVIEW_FRONT, front, body);
}

export function deepDive(overrides: { front?: string; body?: string } = {}): string {
  const front =
    overrides.front ??
    "id: sample\ntitle: A sample deep dive\nrole: acme\nhighlights: [1]\nstatus: approved\napproved: 2026-10-27\nsource: Interview with Peter, 2026-10-27";
  const body = overrides.body ?? SECTIONS.map((s) => `## ${s}\n\n${s === "Not public" ? "" : `Text for ${s}.`}\n`).join("\n");
  return `---\n${front}\n---\n\n${body}`;
}
