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

export function deepDive(overrides: { front?: string; body?: string } = {}): string {
  const front =
    overrides.front ??
    "id: sample\ntitle: A sample deep dive\nrole: acme\nhighlights: [1]\nstatus: approved\napproved: 2026-10-27\nsource: Interview with Peter, 2026-10-27";
  const body = overrides.body ?? SECTIONS.map((s) => `## ${s}\n\n${s === "Not public" ? "" : `Text for ${s}.`}\n`).join("\n");
  return `---\n${front}\n---\n\n${body}`;
}
