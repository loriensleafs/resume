// Shared fixture builders for the knowledge tests.

import { SECTIONS } from "../../src/knowledge/parse";

export function deepDive(overrides: { front?: string; body?: string } = {}): string {
  const front =
    overrides.front ??
    "id: sample\ntitle: A sample deep dive\nrole: acme\nhighlights: [1]\nstatus: approved\napproved: 2026-10-27\nsource: Interview with Peter, 2026-10-27";
  const body = overrides.body ?? SECTIONS.map((s) => `## ${s}\n\n${s === "Not public" ? "" : `Text for ${s}.`}\n`).join("\n");
  return `---\n${front}\n---\n\n${body}`;
}
