// Renders the knowledge base as the text the chat reads (SPEC-knowledge, Rendered text): the core,
// sent with every question, and one source, which the chat reads by id. Each entry and each
// passage starts with the [id] the chat cites or reads. This module imports types only, so the
// build, the reads, the chat and the scripts can use it without the build.

import type { Entry, Knowledge, Source } from "./types";

// The size budgets of the text the chat reads (SPEC-knowledge, Objective), in characters: about
// 4 characters to a token.
/** The rendered core stays under this: about 20,000 tokens. `bun run knowledge` and a test check it. */
export const CORE_CHARACTERS = 80_000;
/**
 * An approved source renders to at most this: about 6,000 tokens. A read stops at the same 24,000
 * characters (SPEC-knowledge, readPassages() rules), so one read always holds a whole source. The
 * build checks it.
 */
export const SOURCE_CHARACTERS = 24_000;
/** An approved passage holds at most this. The build checks it. */
export const PASSAGE_CHARACTERS = 3_000;
/** An approved source's summary, one line of the catalog, holds at most this. The build checks it. */
export const SUMMARY_CHARACTERS = 200;

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

/** The line under a source's title: whose words the source holds, so the chat quotes only Peter's own words as his. */
const KIND_LINES: Record<Source["kind"], string> = {
  "deep-dive": "Deep dive: written from Peter's answers, in the third person.",
  interview: "Interview: Peter's own words, in the first person.",
};

const NOT_PUBLIC_HEADING = "## Not public: decline to describe these kinds of material";

/**
 * The source's header, the passages asked for (all when omitted) in file order, then Not public.
 * The header is the title, the kind line, and a line of the roles, highlights and links that are
 * not empty, left out when all three are. An id that names no passage of this source adds nothing.
 */
export function renderSource(source: Source, passageIds?: string[]): string {
  const asked = passageIds && new Set(passageIds);
  const parts: [label: string, values: string[]][] = [
    ["Roles", source.roles],
    ["Highlights", source.highlights],
    ["Links", source.links],
  ];
  const about = parts.filter(([, values]) => values.length).map(([label, values]) => `${label}: ${values.join(", ")}.`);
  const header = [`# [${source.id}] ${source.title}`, KIND_LINES[source.kind], ...(about.length ? [about.join(" ")] : [])];
  const passages = source.passages.filter((p) => !asked || asked.has(p.id)).map((p) => `## [${p.id}] ${p.heading}\n${p.text}`);
  const notPublic = `${NOT_PUBLIC_HEADING}\n${source.notPublic || "Nothing listed."}`;
  return `${[header.join("\n"), ...passages, notPublic].join("\n\n")}\n`;
}
