// `bun run knowledge`: prints the core exactly as the chat gets it with every question, then its
// size against its budget and each approved source's size as the chat reads it. The core goes to
// standard output and the sizes to standard error, so `bun run knowledge > core.txt` writes the
// core alone. A core at or over its budget exits with 1; the build already stops on a source over its own.

import { buildKnowledge } from "../src/knowledge/build";
import { CORE_CHARACTERS, renderCore, renderSource, SOURCE_CHARACTERS } from "../src/knowledge/render";
import type { Entry } from "../src/knowledge/types";

const knowledge = await buildKnowledge();
const core = renderCore(knowledge);
await Bun.write(Bun.stdout, core);

const count = (kind: Entry["kind"]) => knowledge.core.filter((e) => e.kind === kind).length;
const formatCount = (n: number) => n.toLocaleString("en-US");
console.error(
  `Core: ${knowledge.core.length} entries (${count("resume")} resume, ${count("logistics")} logistics, ${count("catalog")} catalog); ` +
    `${formatCount(core.length)} of ${formatCount(CORE_CHARACTERS)} characters.`,
);
for (const source of knowledge.sources) {
  const passages = source.passages.length;
  console.error(
    `Source ${source.id}: ${passages} passage${passages === 1 ? "" : "s"}; ${formatCount(renderSource(source).length)} of ${formatCount(SOURCE_CHARACTERS)} characters.`,
  );
}
if (!knowledge.sources.length) console.error("Sources: none approved.");
if (core.length >= CORE_CHARACTERS) {
  console.error(`The core must stay under ${formatCount(CORE_CHARACTERS)} characters.`);
  process.exitCode = 1;
}
