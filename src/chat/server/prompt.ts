// The system prompts (SPEC-chat, The request): the chat's instructions, then the core of the knowledge
// base with its catalog, then the question's request lines.
//
// C15's place: C15 writes the prompt's wording as a wording draft for Peter's approval (row 153),
// with the scope, audience and "about" lines. Until then the prompt is the smallest one that holds
// the core and asks for the citation markers, and the "about" line is the only request line.

import { renderCore } from "../../knowledge/render";
import type { Entry, Knowledge } from "../../knowledge/types";
import type { ChatProps } from "./props";

/** Built once for each Knowledge value: the core is the same for every request, so the prompt cache's prefix stays the same text. */
const prompts = new WeakMap<Knowledge, string>();

function systemPrompt(knowledge: Knowledge): string {
  let prompt = prompts.get(knowledge);
  if (prompt === undefined) {
    prompt = [
      "You answer visitors' questions about Peter Kloss's work from the knowledge base below.",
      "After each fact, write the id of the entry it comes from in square brackets, for example [basics].",
      "",
      renderCore(knowledge),
    ].join("\n");
    prompts.set(knowledge, prompt);
  }
  return prompt;
}

/** The resume entry of the core that `id` names, if any. A logistics answer or a catalog entry is no resume entry. */
const resumeEntry = (knowledge: Knowledge, id: string): Entry | undefined =>
  knowledge.core.find((entry) => entry.kind === "resume" && entry.id === id);

/**
 * The question's request lines: code's own statements about how the visitor asks it, for the model.
 * "Ask about this" on a resume entry names the entry (The request, "About"); a passage or a source
 * is read instead (about-read.ts), and any other id adds no line.
 */
function requestLines(knowledge: Knowledge, props: ChatProps): string[] {
  const entry = props.about ? resumeEntry(knowledge, props.about) : undefined;
  return entry ? [`The visitor asks about this resume entry: [${entry.id}] ${entry.title}.`] : [];
}

/**
 * The system prompts of one question: the system prompt with the core, then the request lines in one
 * block of their own. The first block is the same text for every question. With the short prompt
 * cache, the Anthropic adapter marks the last tool, the last user block and then the last two system
 * blocks, so the core keeps its own cache marker while the request lines stay one block.
 */
export function systemPrompts(knowledge: Knowledge, props: ChatProps): string[] {
  const lines = requestLines(knowledge, props);
  return lines.length ? [systemPrompt(knowledge), lines.join("\n")] : [systemPrompt(knowledge)];
}
