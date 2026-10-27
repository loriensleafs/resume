// Renders knowledge entries as plain text for the chat's system prompt. Each entry
// starts with its [id], which the chat cites.

import type { Entry } from "./build";

/** About 25,000 tokens at roughly 4 characters per token (SPEC-knowledge). */
export const KNOWLEDGE_BUDGET = 100_000;

const HEADINGS: Record<Entry["kind"], string> = {
  resume: "Resume",
  "deep-dive": "Deep dives",
  logistics: "Job-search logistics",
};

export function renderKnowledge(entries: Entry[]): string {
  const out: string[] = [];
  let kind: Entry["kind"] | undefined;
  for (const e of entries) {
    if (e.kind !== kind) {
      if (kind) out.push("");
      out.push(`# ${HEADINGS[e.kind]}`, "");
      kind = e.kind;
    }
    out.push(e.kind === "deep-dive" ? `[${e.id}] ${e.title}\n${e.text}\n` : `[${e.id}] ${e.title}: ${e.text}`);
  }
  return out.join("\n").trimEnd() + "\n";
}

export function checkBudget(text: string): void {
  if (text.length > KNOWLEDGE_BUDGET) {
    throw new Error(`the knowledge text is ${text.length} characters; the budget is ${KNOWLEDGE_BUDGET}`);
  }
}
