// Parses one source file (SPEC-knowledge, Sources): YAML front matter, then "## " sections.
// Every section is a numbered passage except the last, Not public. parseDeepDive() below is
// the old contract's parser for knowledge/deep-dives/, until K4 removes it.

import { z } from "zod";
import { parseId } from "./ids";

/** A deep dive's sections, in order. */
export const SECTIONS = ["Problem", "What Peter did", "How it worked", "Result", "Tools", "Not public"] as const;
export type Section = (typeof SECTIONS)[number];

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
/** The end of an interview heading whose answer goes on from the passage before it. */
const CONTINUED = " (continued)";
/** In an approved source (SPEC-knowledge, Objective; Sources, "Summary"). */
const PASSAGE_CHARACTERS = 3000;
const SUMMARY_CHARACTERS = 200;

const nonEmpty = z.string().trim().min(1);

// The shape of the front matter, for a draft and an approved source alike. The build checks
// the rest once a source is approved (Drafts and approval): the source id's grammar, whether
// its roles and highlights exist in resume.yaml, and its links.
const sourceFrontMatter = z
  .strictObject({
    id: z.string().min(1),
    title: nonEmpty,
    kind: z.enum(["deep-dive", "interview"]),
    subject: z.enum(SUBJECTS),
    roles: z.array(z.string()).default([]),
    highlights: z
      .array(z.string().refine((h) => parseId(h)?.form === "highlight", "not a highlight id: use highlight:<role id>.<n>"))
      .default([]),
    summary: z.string().trim(),
    links: z.array(z.string()).default([]),
    status: z.enum(["draft", "approved"]),
    approved: z.iso.date().nullish(),
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

/** Splits the body into "## " sections; a heading needs text, and text before the first one is not allowed. */
function splitSections(body: string, file: string): { heading: string; text: string }[] {
  const sections: { heading: string; lines: string[] }[] = [];
  const preamble: string[] = [];
  for (const line of body.split("\n")) {
    const heading = line.match(/^## (.*)$/)?.[1]?.trim();
    if (heading === "") throw new KnowledgeError(file, 'a "## " heading has no text');
    if (heading) sections.push({ heading, lines: [] });
    else (sections.at(-1)?.lines ?? preamble).push(line);
  }
  if (preamble.join("").trim()) throw new KnowledgeError(file, "text before the first section is not allowed");
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

/** Each rule of an approved source's sizes that `source` breaks. A draft meets them only once approved. */
function approvalProblems(source: Source): string[] {
  const problems: string[] = [];
  const lines = source.summary.split(/\r\n|\r|\n/).length;
  if (lines > 1 || source.summary.length < 1 || source.summary.length > SUMMARY_CHARACTERS) {
    problems.push(
      `summary must be one line of 1 to ${SUMMARY_CHARACTERS} characters; it has ${source.summary.length} characters on ${lines} line${lines === 1 ? "" : "s"}`,
    );
  }
  for (const p of source.passages) {
    if (p.text.length > PASSAGE_CHARACTERS) {
      problems.push(`passage ${p.id} ("${p.heading}") has ${p.text.length} characters; an approved passage holds at most ${PASSAGE_CHARACTERS}`);
    }
  }
  return problems;
}

/** One source file as a source with numbered passages; stops with the file and the field on a broken shape. */
export function parseSource(text: string, file: string): SourceFile {
  const match = text.match(/^---\n([\s\S]*?)\n---(?:\n([\s\S]*))?$/);
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
  const passages = sections.slice(0, -1).map((s, i) => ({ id: `${front.id}.${i + 1}`, heading: s.heading, text: s.text }));
  const source: Source = { ...front, notPublic: sections.at(-1)!.text, passages };

  if (status === "approved") {
    const problems = approvalProblems(source);
    if (problems.length) throw new KnowledgeError(file, `an approved source breaks these rules:\n${problems.map((p) => `- ${p}`).join("\n")}`);
  }
  return { status, source };
}

/** Sections that may stay empty in an approved deep dive. */
const OPTIONAL: ReadonlySet<Section> = new Set(["Not public"]);

const slug = z.string().regex(/^[a-z0-9-]+$/, "use lowercase letters, digits and hyphens");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use "YYYY-MM-DD"');

const frontMatter = z
  .strictObject({
    id: slug,
    title: z.string().trim().min(1),
    role: slug,
    highlights: z.array(z.number().int().positive()).default([]),
    status: z.enum(["draft", "approved"]),
    approved: day.nullish(),
    source: z.string().trim().min(1),
  })
  .refine((f) => f.status !== "approved" || f.approved, {
    message: "an approved deep dive needs the date Peter approved it",
    path: ["approved"],
  });

export type DeepDive = z.infer<typeof frontMatter> & { sections: Record<Section, string> };

export class KnowledgeError extends Error {
  constructor(file: string, detail: string) {
    super(`${file}: ${detail}`);
  }
}

export function parseDeepDive(source: string, file: string): DeepDive {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new KnowledgeError(file, "must start with front matter between --- lines");
  const [, yaml, body] = match as unknown as [string, string, string];

  const meta = frontMatter.safeParse(Bun.YAML.parse(yaml));
  if (!meta.success) throw new KnowledgeError(file, `front matter is not valid:\n${z.prettifyError(meta.error)}`);

  const expected = `${meta.data.id}.md`;
  if (!file.endsWith(`/${expected}`) && file !== expected) {
    throw new KnowledgeError(file, `the file name must be ${expected}, to match its id`);
  }

  // Split the body into "## Heading" sections; text before the first heading is not allowed.
  const found: { heading: string; text: string[] }[] = [];
  const preamble: string[] = [];
  for (const line of body.split("\n")) {
    const heading = line.match(/^## (.+?)\s*$/);
    if (heading) found.push({ heading: heading[1]!, text: [] });
    else (found.at(-1)?.text ?? preamble).push(line);
  }
  if (preamble.join("").trim()) throw new KnowledgeError(file, "text before the first section is not allowed");

  const headings = found.map((s) => s.heading);
  if (headings.join("|") !== SECTIONS.join("|")) {
    throw new KnowledgeError(file, `sections must be, in order: ${SECTIONS.join(", ")}. Found: ${headings.join(", ") || "none"}`);
  }

  const sections = Object.fromEntries(found.map((s) => [s.heading, s.text.join("\n").trim()])) as Record<Section, string>;
  if (meta.data.status === "approved") {
    const empty = SECTIONS.filter((s) => !OPTIONAL.has(s) && !sections[s]);
    if (empty.length) throw new KnowledgeError(file, `an approved deep dive needs text in: ${empty.join(", ")}`);
  }

  return { ...meta.data, sections };
}
