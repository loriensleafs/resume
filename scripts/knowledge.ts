// `bun run knowledge`: prints exactly what the chat will see, then its size.

import { buildKnowledge } from "../src/knowledge/build";
import { checkBudget, KNOWLEDGE_BUDGET, renderKnowledge } from "../src/knowledge/render";

const entries = await buildKnowledge();
const text = renderKnowledge(entries);
console.log(text);
const count = (kind: string) => entries.filter((e) => e.kind === kind).length;
console.error(
  `${entries.length} entries (${count("resume")} resume, ${count("deep-dive")} deep dives, ${count("logistics")} logistics); ` +
    `${text.length} of ${KNOWLEDGE_BUDGET} characters`,
);
checkBudget(text);
