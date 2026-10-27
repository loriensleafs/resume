// Parses one deep-dive Markdown file: YAML front matter, then the required
// sections as "## " headings, in a fixed order.

import { z } from "zod";

export const SECTIONS = ["Problem", "What Peter did", "How it worked", "Result", "Tools", "Not public"] as const;
export type Section = (typeof SECTIONS)[number];

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
