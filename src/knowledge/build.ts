// Builds the chat's knowledge base in its two layers (SPEC-knowledge): the core, sent with every
// question, and the approved sources, which the chat reads by id. The core holds the resume
// entries, then the approved logistics answers, then one catalog entry per approved source, in
// source-id order. Every entry has an id the chat can cite or read.

import { z } from "zod";
import { displayUrl, formatLocation, formatRange, formatTitle, loadResume, type Resume } from "../content";
import { highlightId, isSlug, isSourceId, logisticsId, PASSAGE_ID_RULE, parseId, roleId, skillsId, SLUG_RULE, SOURCE_ID_RULE, toSlug } from "./ids";
import { KnowledgeError, LINE_BREAK, parseSource } from "./parse";
import { PASSAGE_CHARACTERS, renderSource, SOURCE_CHARACTERS, SUMMARY_CHARACTERS } from "./render";
import type { Entry, Knowledge, PublicKnowledge, Source } from "./types";

const REPO = `${import.meta.dir}/../..`;
const SOURCES = "knowledge/sources";

/**
 * A link as written: "https://", then no white space, control character, invisible format
 * character (a bidi control, a zero-width character) or backslash. The URL class drops tabs, line
 * breaks and some zero-width characters, and reads a backslash as a slash, so without this a link
 * could parse as one URL, look like another, and add a line to the rendered source.
 */
const WRITTEN_HTTPS_LINK = /^https:\/\/[^\s\p{Cc}\p{Cf}\\]+$/u;

// Not public names kinds of material only (Sources), so it holds no link and no email address.
// Each pattern starts at a fixed character or a word start and checks a bounded run after it, so a
// long section costs one pass. A bare host and path, such as wiki.corp.example.com/x, is left to
// Peter's review at approval: a pattern for it would also stop the build on prose like "Node.js/Bun".
const NOT_PUBLIC_LINKS = [
  /\/\/[^\s/]/, // a URL with any scheme (https://, ftp://, slack://), and a protocol-relative link (//corp.com/x)
  /\b(?:javascript|data):\S/i, // the two schemes with no "//"; "data: accounts", with a space, is prose
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/, // an IPv4 address, also with a port or a path after it
];
/** Anything of the form name@host, so an email address with no dot in its host is one too. */
const EMAIL_ADDRESS = /[^\s@]@[^\s@]/;

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
 * The rule `link` breaks, or undefined when it is an absolute https:// URL with no user name or
 * password. No message shows the link, so a user name or password in it never reaches a terminal
 * or a CI log.
 */
function linkProblem(link: string): string | undefined {
  const url = URL.canParse(link) ? new URL(link) : undefined;
  if (url?.protocol !== "https:" || !WRITTEN_HTTPS_LINK.test(link)) {
    return "is not an absolute https:// URL: write it in full, with no space, line break, backslash or invisible character";
  }
  if (url.username || url.password) return "holds a user name or password: give the URL without them";
  return undefined;
}

/** Source-id order, by code unit: "alpha" comes before "alpha-beta", although "alpha-beta.md" comes before "alpha.md". */
const bySourceId = (a: Source, b: Source) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Every rule of an approved source that `source` breaks, each naming its field, in front-matter
 * order, then passage order, then Not public, then the size of the source as the chat reads it
 * (renderSource()); an empty list when it breaks none. `resumeIds` holds the ids of
 * the resume entries, where its roles and highlights must be. parseSource() has checked the shape
 * already. A draft meets these rules only once approved, and previewDraft() names the ones it
 * breaks (Drafts and approval).
 */
function checkSource(source: Source, resumeIds: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const goodId = isSourceId(source.id);
  if (!goodId) problems.push(`id ${JSON.stringify(source.id)} is not a source id: use ${SOURCE_ID_RULE}`);
  source.roles.forEach((role, i) => {
    if (!resumeIds.has(roleId(role))) problems.push(`roles[${i}] ${JSON.stringify(role)} is not a role id in resume.yaml`);
  });
  source.highlights.forEach((highlight, i) => {
    if (!resumeIds.has(highlight)) problems.push(`highlights[${i}] ${JSON.stringify(highlight)} is not a highlight in resume.yaml`);
  });
  const lines = source.summary.split(LINE_BREAK).length;
  if (lines > 1 || source.summary.length < 1 || source.summary.length > SUMMARY_CHARACTERS) {
    problems.push(
      `summary must be one line of 1 to ${SUMMARY_CHARACTERS} characters; it has ${source.summary.length} characters on ${lines} line${lines === 1 ? "" : "s"}`,
    );
  }
  source.links.forEach((link, i) => {
    const problem = linkProblem(link);
    if (problem) problems.push(`links[${i}] ${problem}`);
  });
  for (const p of source.passages) {
    const passage = `passage ${p.id} (${JSON.stringify(p.heading)})`;
    // A bad source id makes every passage id bad too; its own problem says so once.
    if (goodId && parseId(p.id)?.form !== "passage") problems.push(`${passage} breaks the passage id rule: use ${PASSAGE_ID_RULE}; this id has ${p.id.length}`);
    if (!p.text) problems.push(`${passage} has no text; an approved passage holds text, and only Not public may be empty`);
    if (p.text.length > PASSAGE_CHARACTERS) problems.push(`${passage} has ${p.text.length} characters; an approved passage holds at most ${PASSAGE_CHARACTERS}`);
  }
  // No message shows what it found: that is the material Not public keeps out.
  if (NOT_PUBLIC_LINKS.some((link) => link.test(source.notPublic))) {
    problems.push('Not public holds a URL or an IP address; it names kinds of material only, such as "internal links"');
  }
  if (EMAIL_ADDRESS.test(source.notPublic)) problems.push('Not public holds an email address; it names kinds of material only, such as "colleague names"');
  const rendered = renderSource(source).length;
  if (rendered > SOURCE_CHARACTERS) problems.push(`the rendered source has ${rendered} characters; an approved source renders to at most ${SOURCE_CHARACTERS}`);
  return problems;
}

/**
 * The approved sources in knowledge/sources/, in source-id order; none when the folder does not
 * exist. Every file is parsed, so a draft's shape is checked too, and then a draft is left out.
 * An approved source that breaks a rule stops the build with every rule it breaks.
 */
async function approvedSources(root: string, resumeIds: ReadonlySet<string>): Promise<Source[]> {
  const files: string[] = [];
  try {
    for await (const f of new Bun.Glob("*.md").scan({ cwd: `${root}/${SOURCES}` })) files.push(f);
  } catch (e) {
    if ((e as { code?: string }).code === "ENOENT") return [];
    throw e;
  }
  // Checked one at a time in file-name order, so the same broken file is always the one reported.
  files.sort();
  const texts = await Promise.all(files.map((f) => Bun.file(`${root}/${SOURCES}/${f}`).text()));
  const sources: Source[] = [];
  files.forEach((f, i) => {
    const file = `${SOURCES}/${f}`;
    const { status, source } = parseSource(texts[i]!, file);
    if (status === "draft") return;
    const problems = checkSource(source, resumeIds);
    if (problems.length) throw new KnowledgeError(file, ...problems);
    sources.push(source);
  });
  return sources.sort(bySourceId);
}

/** A source's catalog entry: its title, then its kind, its roles when it has any, and its summary. */
function catalogEntry(source: Source): Entry {
  const roles = source.roles.length ? `, roles ${source.roles.join(", ")}` : "";
  return { id: source.id, kind: "catalog", title: source.title, text: `${source.kind}${roles}. ${source.summary}` };
}

/** Every id in the knowledge base, each core entry's and each passage's, follows the id rules and is used once. */
function checkIds(core: Entry[], sources: Source[]): void {
  const seen = new Set<string>();
  // For passage ids this is a backstop no file can reach today: checkSource() stops a bad one first, and file names keep source ids apart.
  for (const id of [...core.map((e) => e.id), ...sources.flatMap((s) => s.passages.map((p) => p.id))]) {
    if (!parseId(id)) throw new KnowledgeError("knowledge", `id ${JSON.stringify(id)} does not follow the id rules`);
    if (seen.has(id)) throw new KnowledgeError("knowledge", `id ${JSON.stringify(id)} is used twice`);
    seen.add(id);
  }
}

export async function buildKnowledge(options: { root?: string } = {}): Promise<Knowledge> {
  const root = options.root ?? REPO;
  const resume = await loadResume("public", root);
  checkResumeSlugs(resume);
  const resumeCore = resumeEntries(resume);
  const sources = await approvedSources(root, new Set(resumeCore.map((e) => e.id)));
  const core = [...resumeCore, ...(await logisticsEntries(root)), ...sources.map(catalogEntry)];
  checkIds(core, sources);
  return { core, sources };
}

/**
 * The knowledge base as a browser may hold it: the core, and each approved source without its Not
 * public text (SPEC-knowledge, "Who gets which shape"). The type alone does not keep that text out:
 * a Source is also an `Omit<Source, "notPublic">`. So each source is built anew from the fields a
 * browser may see. The callback's return type makes the type check reject any other field, and a
 * field added to Source stops the type check here until someone decides whether a browser may see it.
 */
export function publicKnowledge(knowledge: Knowledge): PublicKnowledge {
  return {
    core: knowledge.core,
    sources: knowledge.sources.map((s): PublicKnowledge["sources"][number] => ({
      id: s.id,
      title: s.title,
      kind: s.kind,
      subject: s.subject,
      roles: s.roles,
      highlights: s.highlights,
      summary: s.summary,
      links: s.links,
      passages: s.passages,
    })),
  };
}
