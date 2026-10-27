// `bun run knowledge`: prints the core exactly as the chat gets it with every question, then its
// size against its budget. The core goes to standard output and the size to standard error, so
// `bun run knowledge > core.txt` writes the core alone. A core at or over its budget exits with 1.

import { buildKnowledge, type Entry } from "../src/knowledge/build";
import { CORE_CHARACTERS, renderCore } from "../src/knowledge/render";

const knowledge = await buildKnowledge();
const core = renderCore(knowledge);
await Bun.write(Bun.stdout, core);

const count = (kind: Entry["kind"]) => knowledge.core.filter((e) => e.kind === kind).length;
const number = (n: number) => n.toLocaleString("en-US");
console.error(
  `Core: ${knowledge.core.length} entries (${count("resume")} resume, ${count("logistics")} logistics, ${count("catalog")} catalog); ` +
    `${number(core.length)} of ${number(CORE_CHARACTERS)} characters.`,
);
if (core.length >= CORE_CHARACTERS) {
  console.error(`The core must stay under ${number(CORE_CHARACTERS)} characters.`);
  process.exitCode = 1;
}
