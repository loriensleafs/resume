// `bun run knowledge`: prints the core exactly as the chat gets it with every question, then its
// size against its budget and each approved source's size as the chat reads it. A core at or over
// its budget exits with 1; the build already stops on a source over its own.
//
// `bun run knowledge <source id>`: prints one approved source exactly as the chat's read tool gets
// it (readPassages()), then names any id it does not know. Each argument is an id, so a passage id
// prints that one passage as a read gives it. An unknown or skipped id exits with 1.
//
// The text goes to standard output and everything else to standard error, so
// `bun run knowledge > core.txt` writes the core alone.

import { buildKnowledge } from "../src/knowledge/build";
import { readPassages } from "../src/knowledge/read";
import { CORE_CHARACTERS, renderCore, renderSource, SOURCE_CHARACTERS } from "../src/knowledge/render";
import type { Entry, Knowledge } from "../src/knowledge/types";

const formatCount = (n: number) => n.toLocaleString("en-US");

async function printCore(knowledge: Knowledge): Promise<void> {
  const core = renderCore(knowledge);
  await Bun.write(Bun.stdout, core);

  const count = (kind: Entry["kind"]) => knowledge.core.filter((e) => e.kind === kind).length;
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
}

async function printRead(knowledge: Knowledge, ids: string[]): Promise<void> {
  const { text, unknown, skipped } = readPassages(knowledge, ids);
  await Bun.write(Bun.stdout, text);
  for (const id of unknown) console.error(`Unknown id ${JSON.stringify(id)}: no approved source or passage has it.`);
  for (const id of skipped) console.error(`Skipped id ${JSON.stringify(id)}: the read reached its size limit before it.`);
  if (unknown.length) console.error("`bun run knowledge` lists the approved sources.");
  if (unknown.length || skipped.length) process.exitCode = 1;
}

const ids = Bun.argv.slice(2);
const knowledge = await buildKnowledge();
await (ids.length ? printRead(knowledge, ids) : printCore(knowledge));
