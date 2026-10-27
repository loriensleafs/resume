// The system prompt (SPEC-chat, The request): the chat's instructions, then the core of the
// knowledge base with its catalog.
//
// C15's place: C15 writes the prompt's wording as a wording draft for Peter's approval (row 153),
// with the scope, audience and "about" lines. Until then the prompt is the smallest one that holds
// the core and asks for the citation markers.

import { renderCore } from "../../knowledge/render";
import type { Knowledge } from "../../knowledge/types";

/** Built once for each Knowledge value: the core is the same for every request, so the prompt cache's prefix stays the same text. */
const prompts = new WeakMap<Knowledge, string>();

export function systemPrompt(knowledge: Knowledge): string {
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
