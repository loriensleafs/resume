// Parses one source file (SPEC-knowledge, Sources): YAML front matter, then "## " sections.
// Every section is a numbered passage except the last, Not public. The parser checks the shape
// only, for a draft and an approved source alike; the build checks an approved source's other
// rules (checkSource() in build.ts).

import { z } from "zod";
import { parseId, passageId } from "./ids";

/** One or more broken rules in a knowledge file: the message gives each on a new line, starting with the file, then naming the field. */
export class KnowledgeError extends Error {
  constructor(file: string, ...details: string[]) {
    super(details.map((detail) => `${file}: ${detail}`).join("\n"));
  }
}

/** A deep dive's sections, in order. */
export const SECTIONS = ["Problem", "What Peter did", "How it worked", "Result", "Tools", "Not public"] as const;

const SUBJECTS = ["project", "career", "working-style", "story", "opinion", "side-project", "skill"] as const;
export type Subject = (typeof SUBJECTS)[number];

export type Passage = { id: string; heading: string; text: string };
export type Source = {
  id: string;
  title: string;
  kind: "deep-dive" | "interview";
  subject: Subject;
  roles: string[];
  highlights: string[];
  summary: string;
  links: string[];
  notPublic: string;
  passages: Passage[];
};
/** One source file as parsed: the source, and whether Peter approved it. */
export type SourceFile = { status: "draft" | "approved"; source: Source };

const NOT_PUBLIC = "Not public";
/**
 * A line that looks like the Not public heading at any level, case or spacing. Only the exact
 * "## Not public" is that heading; a near miss would make its text a passage.
 */
const LIKE_NOT_PUBLIC = /^\s*#+\s*not\s+public\b/i;
/** The end of an interview heading whose answer goes on from the passage before it. */
const CONTINUED = " (continued)";

/**
 * Every line break Unicode knows (UAX #14's mandatory breaks), not only "\n": a YAML string can
 * hold any of them through an escape, and YAML 1.2 keeps a raw U+2028 inside a plain value.
 */
export const LINE_BREAK = /\r\n|[\n\v\f\r\x85\u{2028}\u{2029}]/u;
/** A title, a role id and a summary each print on one line of the core, so none holds a line break. */
const ONE_LINE = "must be one line, with no line break";
const oneLine = (s: string) => !LINE_BREAK.test(s);

const nonEmpty = z.string().trim().min(1);

// The shape of the front matter, for a draft and an approved source alike. The build checks
// the rest once a source is approved (Drafts and approval): the source id's grammar, whether
// its roles and highlights exist in resume.yaml, its summary, its links and its passages.
const sourceFrontMatter = z
  .strictObject({
    id: z.string().min(1),
    title: nonEmpty.refine(oneLine, ONE_LINE),
    kind: z.enum(["deep-dive", "interview"]),
    subject: z.enum(SUBJECTS),
    roles: z.array(z.string().refine(oneLine, ONE_LINE)).default([]),
    highlights: z
      .array(z.string().refine((h) => parseId(h)?.form === "highlight", "not a highlight id: use highlight:<role id>.<n>"))
      .default([]),
    summary: z.string().trim(),
    links: z.array(z.string()).default([]),
    status: z.enum(["draft", "approved"]),
    approved: z.iso.date().nullish(),
    // Provenance: where the facts come from, such as "Interview with Peter, 2026-10-26". Not a Source.
    source: nonEmpty,
  })
  .refine((f) => f.kind === "deep-dive" || f.highlights.length === 0, {
    message: "only a deep dive may have highlights",
    path: ["highlights"],
  })
  .refine((f) => f.status !== "approved" || f.approved, {
    message: "an approved source needs the date Peter approved it",
    path: ["approved"],
  });

/** A code fence line (CommonMark): up to three spaces, three or more backticks or tildes, then the rest. */
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/**
 * Splits the body into "## " sections. A heading needs text, a line that only looks like the Not
 * public heading stops it, and text before the first section is not allowed. Inside a fenced code
 * block every line is text, as in Markdown, and a fence that is never closed stops it.
 */
function splitSections(body: string, file: string): { heading: string; text: string }[] {
  const sections: { heading: string; lines: string[] }[] = [];
  const preamble: string[] = [];
  let fence: { marks: string; section: string | undefined } | undefined;
  for (const line of body.split("\n")) {
    const text = sections.at(-1)?.lines ?? preamble;
    const marks = line.match(FENCE);
    if (fence) {
      // A closing fence uses the same mark, at least as many of them, and nothing after them.
      if (marks && marks[1]![0] === fence.marks[0] && marks[1]!.length >= fence.marks.length && !marks[2]!.trim()) fence = undefined;
      text.push(line);
      continue;
    }
    // A backtick fence's info string has no backtick in it; a line like ```a``` is inline code.
    if (marks && !(marks[1]![0] === "`" && marks[2]!.includes("`"))) {
      fence = { marks: marks[1]!, section: sections.at(-1)?.heading };
      text.push(line);
      continue;
    }
    if (line !== `## ${NOT_PUBLIC}` && LIKE_NOT_PUBLIC.test(line)) {
      throw new KnowledgeError(file, `${JSON.stringify(line)} looks like the ${NOT_PUBLIC} heading: write it exactly "## ${NOT_PUBLIC}"`);
    }
    const heading = line.match(/^## (.*)$/)?.[1]?.trim();
    if (heading === "") throw new KnowledgeError(file, 'a "## " heading has no text');
    if (heading) sections.push({ heading, lines: [] });
    else text.push(line);
  }
  if (preamble.join("").trim()) throw new KnowledgeError(file, "text before the first section is not allowed");
  if (fence) throw new KnowledgeError(file, `the code fence ${fence.marks} in section "${fence.section}" is never closed`);
  return sections.map((s) => ({ heading: s.heading, text: s.lines.join("\n").trim() }));
}

const withoutContinued = (heading: string) => (heading.endsWith(CONTINUED) ? heading.slice(0, -CONTINUED.length) : heading);

/**
 * A deep dive has its six sections in order. An interview has at least one question, then Not
 * public, last and only last; a "(continued)" heading comes directly after the heading it continues.
 */
function checkSections(kind: Source["kind"], headings: string[], file: string): void {
  if (kind === "deep-dive") {
    if (headings.join("\n") !== SECTIONS.join("\n")) {
      throw new KnowledgeError(file, `a deep dive's sections must be, in order: ${SECTIONS.join(", ")}. Found: ${headings.join(", ") || "none"}`);
    }
    return;
  }
  if (headings.at(-1) !== NOT_PUBLIC || headings.indexOf(NOT_PUBLIC) !== headings.length - 1) {
    throw new KnowledgeError(file, `the last section, and only the last, must be ${NOT_PUBLIC}. Found: ${headings.join(", ") || "none"}`);
  }
  if (headings.length === 1) throw new KnowledgeError(file, `an interview needs at least one question before ${NOT_PUBLIC}`);
  headings.forEach((heading, i) => {
    if (!heading.endsWith(CONTINUED)) return;
    const question = withoutContinued(heading);
    if (i === 0 || withoutContinued(headings[i - 1]!) !== question) {
      throw new KnowledgeError(file, `"${heading}" must come directly after "${question}"`);
    }
  });
}

/**
 * One source file as a source with numbered passages; stops with the file and the field on a
 * broken shape. It checks only the shape, so an approved source can still break a rule of approval.
 */
export function parseSource(text: string, file: string): SourceFile {
  // One line ending first, so a stray carriage return never hides a heading in the text above it.
  const match = text.replace(/\r\n?/g, "\n").match(/^---\n([\s\S]*?)\n---(?:\n([\s\S]*))?$/);
  if (!match) throw new KnowledgeError(file, "must start with front matter between --- lines");
  const [, yaml, body = ""] = match as unknown as [string, string, string | undefined];

  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(yaml);
  } catch (e) {
    throw new KnowledgeError(file, `front matter is not YAML: ${(e as Error).message}`);
  }
  const meta = sourceFrontMatter.safeParse(parsed);
  if (!meta.success) throw new KnowledgeError(file, `front matter is not valid:\n${z.prettifyError(meta.error)}`);
  // The approval date and the `source:` line (where the facts come from) are for the people who
  // read the file; nothing after the parser reads them.
  const { status, approved: _approved, source: _from, ...front } = meta.data;
  // The whole file name, so an id with a folder in it never matches a file deeper down.
  const name = `${front.id}.md`;
  if (file.slice(file.lastIndexOf("/") + 1) !== name) throw new KnowledgeError(file, `the file name must be ${name}, to match its id`);

  const sections = splitSections(body, file);
  checkSections(front.kind, sections.map((s) => s.heading), file);
  // checkSections() leaves Not public as the last section, so every section before it is a passage.
  const passages = sections.slice(0, -1).map((s, i) => ({ id: passageId(front.id, i + 1), heading: s.heading, text: s.text }));
  return { status, source: { ...front, notPublic: sections.at(-1)!.text, passages } };
}
