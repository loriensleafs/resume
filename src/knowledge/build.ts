// Assembles the chat's knowledge: resume entries, then approved deep dives, then
// approved logistics answers. Every entry has a stable id the chat can cite.

import { z } from "zod";
import { displayUrl, formatLocation, formatRange, formatTitle, loadResume } from "../content";
import { highlightId, isSlug, isSourceId, logisticsId, parseId, roleId, skillsId, SLUG_RULE, toSlug } from "./ids";
import { KnowledgeError, parseDeepDive, SECTIONS, type DeepDive } from "./parse";

export type Entry = { id: string; kind: "resume" | "deep-dive" | "logistics"; title: string; text: string };

const REPO = `${import.meta.dir}/../..`;

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

export async function loadDeepDives(root: string): Promise<DeepDive[]> {
  const dir = `${root}/knowledge/deep-dives`;
  const files: string[] = [];
  try {
    for await (const f of new Bun.Glob("*.md").scan({ cwd: dir })) files.push(f);
  } catch {
    return []; // no deep dives yet
  }
  files.sort();
  return Promise.all(files.map(async (f) => parseDeepDive(await Bun.file(`${dir}/${f}`).text(), `knowledge/deep-dives/${f}`)));
}

export async function buildKnowledge(options: { root?: string } = {}): Promise<Entry[]> {
  const root = options.root ?? REPO;
  const resume = await loadResume("public", root);
  resume.work.forEach((job, i) => {
    if (!isSlug(job.id)) throw new KnowledgeError("resume.yaml", `work[${i}].id "${job.id}" is not a slug: use ${SLUG_RULE}`);
  });
  resume.skills.forEach((group, i) => {
    if (!isSlug(toSlug(group.name))) {
      throw new KnowledgeError("resume.yaml", `skills[${i}].name "${group.name}" gives no slug: its slug needs ${SLUG_RULE}`);
    }
  });
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

  const roles = new Map(resume.work.map((j) => [j.id, j]));
  for (const dive of await loadDeepDives(root)) {
    const file = `knowledge/deep-dives/${dive.id}.md`;
    const role = roles.get(dive.role);
    if (!role) throw new KnowledgeError(file, `role "${dive.role}" is not a work id in resume.yaml`);
    for (const n of dive.highlights) {
      if (n > role.highlights.length) throw new KnowledgeError(file, `role "${dive.role}" has no highlight ${n}`);
    }
    if (dive.status !== "approved") continue;
    entries.push({
      id: `deep:${dive.id}`,
      kind: "deep-dive",
      title: dive.title,
      text: SECTIONS.map((s) => `${s}: ${dive.sections[s] || "Nothing listed."}`).join("\n"),
    });
  }

  const logisticsFile = Bun.file(`${root}/knowledge/logistics.yaml`);
  if (await logisticsFile.exists()) {
    const parsed = logisticsSchema.safeParse(Bun.YAML.parse(await logisticsFile.text()));
    if (!parsed.success) throw new KnowledgeError("knowledge/logistics.yaml", `not valid:\n${z.prettifyError(parsed.error)}`);
    for (const t of parsed.data.topics) {
      if (t.status === "approved") entries.push({ id: logisticsId(t.topic), kind: "logistics", title: t.topic, text: t.answer!.trim() });
    }
  }

  const seen = new Set<string>();
  for (const e of entries) {
    // "deep:" is the old contract's form until K3 makes each deep dive a catalog entry.
    const follows = e.id.startsWith("deep:") ? isSourceId(e.id.slice("deep:".length)) : parseId(e.id) !== undefined;
    if (!follows) throw new KnowledgeError("knowledge", `id "${e.id}" does not follow the id rules`);
    if (seen.has(e.id)) throw new KnowledgeError("knowledge", `id "${e.id}" is used twice`);
    seen.add(e.id);
  }
  return entries;
}
