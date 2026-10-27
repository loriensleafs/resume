// Builds the chat's knowledge base in its two layers (SPEC-knowledge): the core, sent with every
// question, and the approved sources, which the chat reads by id. The core holds the resume
// entries, then the approved logistics answers, then one catalog entry per approved source, in
// source-id order. Every entry has an id the chat can cite or read.

import { z } from "zod";
import { displayUrl, formatLocation, formatRange, formatTitle, loadResume, type Resume } from "../content";
import { highlightId, isSlug, logisticsId, parseId, roleId, skillsId, SLUG_RULE, toSlug } from "./ids";
import { KnowledgeError, parseSource, type Source } from "./parse";

export type { Passage, Source, Subject } from "./parse";

/** One entry of the core: the chat sees it as `[<id>] <title>: <text>`. */
export type Entry = { id: string; kind: "resume" | "logistics" | "catalog"; title: string; text: string };
/** Server only: it holds each source's Not public text. The chat's function gets it through virtual:knowledge. */
export type Knowledge = { core: Entry[]; sources: Source[] };

const REPO = `${import.meta.dir}/../..`;
const SOURCES = "knowledge/sources";

const logisticsSchema = z.strictObject({
  topics: z.array(
    z
      .strictObject({
        topic: z.string().refine(isSlug, `not a slug: use ${SLUG_RULE}`),
        answer: z.string().nullish(),
        status: z.enum(["draft", "approved"]),
        approved: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish(),
      })
      .refine((t) => t.status !== "approved" || (t.answer?.trim() && t.approved), {
        message: "an approved answer needs text and the date Peter approved it",
      }),
  ),
});

/** Role ids and skills group names become ids, so each must give a slug. Logistics topics are checked in their schema. */
function checkResumeSlugs(resume: Resume): void {
  resume.work.forEach((job, i) => {
    if (!isSlug(job.id)) throw new KnowledgeError("resume.yaml", `work[${i}].id "${job.id}" is not a slug: use ${SLUG_RULE}`);
  });
  resume.skills.forEach((group, i) => {
    if (!isSlug(toSlug(group.name))) {
      throw new KnowledgeError("resume.yaml", `skills[${i}].name "${group.name}" gives no slug: its slug needs ${SLUG_RULE}`);
    }
  });
}

/** The resume entries, in resume order: basics, each role with its highlights, the skills groups, education. */
function resumeEntries(resume: Resume): Entry[] {
  const b = resume.basics;
  const entries: Entry[] = [];
  entries.push({
    id: "basics",
    kind: "resume",
    title: `${b.name}: ${b.label}`,
    text: [b.summary, `Location: ${formatLocation(resume)}.`, `Email: ${b.email}.`, ...b.profiles.map((p) => `${p.network}: ${displayUrl(p.url)}.`)].join(" "),
  });
  for (const job of resume.work) {
    entries.push({
      id: roleId(job.id),
      kind: "resume",
      title: job.name,
      text: `${formatTitle(job)}, ${formatRange(job)}${job.location ? `, ${job.location}` : ""}.${job.earlier ? " Listed under earlier roles." : ""}`,
    });
    job.highlights.forEach((h, i) => entries.push({ id: highlightId(job.id, i + 1), kind: "resume", title: `${job.name}, highlight ${i + 1}`, text: h }));
  }
  for (const group of resume.skills) {
    entries.push({ id: skillsId(group.name), kind: "resume", title: `Skills: ${group.name}`, text: group.keywords.join(", ") });
  }
  entries.push({ id: "education", kind: "resume", title: "Education", text: resume.education.map((e) => e.institution).join("; ") });
  return entries;
}

/** The approved answers in knowledge/logistics.yaml, in file order; none when the file does not exist. */
async function logisticsEntries(root: string): Promise<Entry[]> {
  const file = Bun.file(`${root}/knowledge/logistics.yaml`);
  if (!(await file.exists())) return [];
  const parsed = logisticsSchema.safeParse(Bun.YAML.parse(await file.text()));
  if (!parsed.success) throw new KnowledgeError("knowledge/logistics.yaml", `not valid:\n${z.prettifyError(parsed.error)}`);
  return parsed.data.topics
    .filter((t) => t.status === "approved")
    .map((t) => ({ id: logisticsId(t.topic), kind: "logistics" as const, title: t.topic, text: t.answer!.trim() }));
}

/**
 * The approved sources in knowledge/sources/, in source-id order; none when the folder does not
 * exist. Every file is parsed, so a draft's shape is checked too, and then a draft is left out.
 */
async function approvedSources(root: string): Promise<Source[]> {
  const files: string[] = [];
  try {
    for await (const f of new Bun.Glob("*.md").scan({ cwd: `${root}/${SOURCES}` })) files.push(f);
  } catch (e) {
    if ((e as { code?: string }).code === "ENOENT") return [];
    throw e;
  }
  // Parsed one at a time in file-name order, so the same broken file is always the one reported.
  files.sort();
  const texts = await Promise.all(files.map((f) => Bun.file(`${root}/${SOURCES}/${f}`).text()));
  return files
    .map((f, i) => parseSource(texts[i]!, `${SOURCES}/${f}`))
    .filter((parsed) => parsed.status === "approved")
    .map((parsed) => parsed.source)
    .sort(bySourceId);
}

/** Source-id order, by code unit: "alpha" comes before "alpha-beta", although "alpha-beta.md" comes before "alpha.md". */
const bySourceId = (a: Source, b: Source) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** A source's catalog entry: its title, then its kind, its roles when it has any, and its summary. */
function catalogEntry(source: Source): Entry {
  const roles = source.roles.length ? `, roles ${source.roles.join(", ")}` : "";
  return { id: source.id, kind: "catalog", title: source.title, text: `${source.kind}${roles}. ${source.summary}` };
}

/** Each core entry's id follows the id rules and is used once. */
function checkIds(core: Entry[]): void {
  const seen = new Set<string>();
  for (const e of core) {
    if (!parseId(e.id)) throw new KnowledgeError("knowledge", `id "${e.id}" does not follow the id rules`);
    if (seen.has(e.id)) throw new KnowledgeError("knowledge", `id "${e.id}" is used twice`);
    seen.add(e.id);
  }
}

export async function buildKnowledge(options: { root?: string } = {}): Promise<Knowledge> {
  const root = options.root ?? REPO;
  const resume = await loadResume("public", root);
  checkResumeSlugs(resume);
  const sources = await approvedSources(root);
  const core = [...resumeEntries(resume), ...(await logisticsEntries(root)), ...sources.map(catalogEntry)];
  checkIds(core);
  return { core, sources };
}
