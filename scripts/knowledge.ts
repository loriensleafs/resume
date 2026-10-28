// `bun run knowledge`: prints the core exactly as the chat gets it with every question, then its
// size against its budget and each approved source's size as the chat reads it. A core at or over
// its budget exits with 1; the build already stops on a source over its own.
//
// `bun run knowledge <source id>`: prints one approved source exactly as the chat's read tool gets
// it (readPassages()), then names any id it does not know. Each argument is an id, so a passage id
// prints that one passage as a read gives it, and several ids print as one read. An unknown or
// skipped id exits with 1.
//
// `bun run knowledge --draft <source id>`: prints the source file with that id in
// knowledge/sources/ as the chat will read it once approved (previewDraft()), then names each rule
// it breaks. A broken rule exits with 1. It reads only resume.yaml and that file, so another broken
// source file never hides the draft.
//
// `--root <folder>`, with any of the three: reads the knowledge, resume.yaml and the drafts under
// <folder> instead of the repository, as `bun run build:site --root` does (the tests' fixture
// roots). A relative folder starts at the working folder, which `bun run` sets to the repository.
//
// The flags are read before the ids: an unknown flag, `--root` with no folder, an empty value or a
// path that is not a folder, or `--draft` with no id or with more ids, exits with 2. A broken rule
// in a knowledge file, or a missing or broken resume.yaml, prints its message and exits with 1.
//
// The text goes to standard output and everything else to standard error, so
// `bun run knowledge > core.txt` writes the core alone.

import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildKnowledge, previewDraft } from "../src/knowledge/build";
import { KnowledgeError } from "../src/knowledge/parse";
import { readLimits, readPassages } from "../src/knowledge/read";
import { CORE_CHARACTERS, renderCore, renderSource, SOURCE_CHARACTERS } from "../src/knowledge/render";
import type { Entry, Knowledge } from "../src/knowledge/types";

const REPO = resolve(import.meta.dir, "..");
const USAGE =
  "Usage: bun run knowledge [--root <folder>] [<source or passage id> ...]\n       bun run knowledge [--root <folder>] --draft <source id>";

const formatCount = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

async function printCore(knowledge: Knowledge): Promise<void> {
  const core = renderCore(knowledge);
  await Bun.write(Bun.stdout, core);

  const count = (kind: Entry["kind"]) => knowledge.core.filter((e) => e.kind === kind).length;
  console.error(
    `Core: ${knowledge.core.length} entries (${count("resume")} resume, ${count("logistics")} logistics, ${count("catalog")} catalog); ` +
      `${formatCount(core.length)} of ${formatCount(CORE_CHARACTERS)} characters.`,
  );
  for (const source of knowledge.sources) {
    console.error(
      `Source ${source.id}: ${plural(source.passages.length, "passage")}; ${formatCount(renderSource(source).length)} of ${formatCount(SOURCE_CHARACTERS)} characters.`,
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
  for (const id of skipped) {
    console.error(`Skipped id ${JSON.stringify(id)}: the read reached its limit of ${formatCount(readLimits.characters)} characters before it.`);
  }
  if (unknown.length) console.error("`bun run knowledge` lists the approved sources.");
  if (unknown.length || skipped.length) process.exitCode = 1;
}

async function printDraft(root: string, id: string): Promise<void> {
  const { text, problems } = await previewDraft({ root, id });
  await Bun.write(Bun.stdout, text);
  for (const problem of problems) console.error(problem);
  const quotedId = JSON.stringify(id);
  if (!text) {
    // previewDraft() gives no text only for a broken shape (front matter or sections).
    console.error(`${quotedId}: the rules of an approved source are checked once its front matter and sections are right.`);
  } else if (problems.length) {
    console.error(`${quotedId} breaks ${plural(problems.length, "rule")} of an approved source.`);
  } else {
    console.error(`${quotedId} renders to ${formatCount(text.length)} of ${formatCount(SOURCE_CHARACTERS)} characters and breaks no rule of an approved source.`);
  }
  if (problems.length) process.exitCode = 1;
}

/** A command line the script cannot run: the message and the usage go to standard error, and it exits with 2. */
function exitWithUsage(message: string): never {
  console.error(`${message}\n${USAGE}`);
  process.exit(2);
}

/** The flags and the ids, read before anything else runs. */
function readArgs() {
  try {
    // strict refuses an unknown or misspelt flag, so `--drfat x` never reads as two ids (https://bun.com/docs/guides/process/argv).
    return parseArgs({
      args: Bun.argv.slice(2),
      options: { draft: { type: "string" }, root: { type: "string" } },
      allowPositionals: true,
      strict: true,
    });
  } catch (e) {
    exitWithUsage((e as Error).message);
  }
}

/** Whether `path` is a folder. A path that does not exist, or that runs through a file, is none; any other failure throws. */
async function isFolder(path: string): Promise<boolean> {
  try {
    return (await Bun.file(path).stat()).isDirectory();
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "ENOENT" || code === "ENOTDIR") return false;
    throw e;
  }
}

const { values, positionals: ids } = readArgs();
if (values.draft !== undefined && ids.length) exitWithUsage("--draft takes one source id and no other ids");
// resolve("") is the working folder, so an empty value would read the repository instead.
if (values.root === "") exitWithUsage("--root takes a folder, not an empty value");
const root = resolve(values.root ?? REPO);
if (values.root !== undefined && !(await isFolder(root))) exitWithUsage(`--root ${JSON.stringify(root)} is not a folder`);
try {
  if (values.draft !== undefined) await printDraft(root, values.draft);
  else {
    const knowledge = await buildKnowledge({ root });
    await (ids.length ? printRead(knowledge, ids) : printCore(knowledge));
  }
} catch (e) {
  // A broken rule is a message for the person who runs the command, not a crash.
  if (!(e instanceof KnowledgeError)) throw e;
  console.error(e.message);
  process.exitCode = 1;
}
