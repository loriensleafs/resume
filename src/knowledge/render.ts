// Renders the knowledge base as the text the chat reads (SPEC-knowledge, Rendered text). Each
// line of the core starts with the [id] the chat cites or reads.

import type { Entry, Knowledge } from "./types";

/** The rendered core stays under this many characters: about 20,000 tokens at roughly 4 characters per token. */
export const CORE_CHARACTERS = 80_000;

/** The core's three parts, in this order, each under its heading. */
const HEADINGS: Record<Entry["kind"], string> = {
  resume: "Resume",
  logistics: "Job-search logistics",
  catalog: "Catalog",
};

/** The core in its three parts, each heading printed even over a part with no entries; one `[<id>] <title>: <text>` line per entry. */
export function renderCore(knowledge: Knowledge): string {
  const parts = (Object.keys(HEADINGS) as Entry["kind"][]).map((kind) => {
    const lines = knowledge.core.filter((e) => e.kind === kind).map((e) => `[${e.id}] ${e.title}: ${e.text}`);
    return [`# ${HEADINGS[kind]}`, ...(lines.length ? ["", ...lines] : [])].join("\n");
  });
  return `${parts.join("\n\n")}\n`;
}
