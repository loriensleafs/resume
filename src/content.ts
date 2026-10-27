// Loads resume.yaml (and private.yaml, when asked), checks it against the schema,
// and returns typed content for every output.

import { z } from "zod";

// "2024" or "2024-12". YAML reads a bare year as a number, so accept both.
const date = z
  .union([z.number().int(), z.string()])
  .transform(String)
  .pipe(z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'use "YYYY" or "YYYY-MM"'));

const text = z.string().trim().min(1);

const profile = z.strictObject({ network: text, username: text, url: z.url() });

const job = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/, "use lowercase letters, digits and hyphens"),
  name: text,
  // The career timeline's label for the role (SPEC-site). Only the site reads it; no document prints it.
  "x-short": text,
  position: text,
  team: text.optional(),
  promotedFrom: text.optional(),
  location: text.optional(),
  startDate: date,
  endDate: date.optional(), // omitted means "Present"
  highlights: z.array(text).default([]),
  earlier: z.boolean().default(false),
});

const resumeSchema = z.strictObject({
  basics: z.strictObject({
    name: text,
    label: text,
    email: z.email(),
    phone: text.optional(),
    summary: text,
    location: z.strictObject({ city: text, region: text, countryCode: z.string().length(2) }),
    profiles: z.array(profile),
  }),
  work: z.array(job).min(1),
  skills: z.array(z.strictObject({ name: text, keywords: z.array(text).min(1) })),
  education: z.array(z.strictObject({ institution: text })),
});

const privateSchema = z.strictObject({
  basics: z.strictObject({ phone: text.optional() }).optional(),
});

export type Resume = z.infer<typeof resumeSchema>;
export type Job = Resume["work"][number];

/** Which audience a build is for. "public" never contains private.yaml. */
export type Variant = "public" | "private";

function check<T>(schema: z.ZodType<T>, data: unknown, file: string): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(`${file} is not valid:\n${z.prettifyError(result.error)}`);
  return result.data;
}

export async function loadResume(variant: Variant, root = process.cwd()): Promise<Resume> {
  const source = Bun.YAML.parse(await Bun.file(`${root}/resume.yaml`).text());
  const resume = check(resumeSchema, source, "resume.yaml");
  if (resume.basics.phone) throw new Error("resume.yaml must not hold the phone number; put it in private.yaml");

  if (variant === "private") {
    const file = Bun.file(`${root}/private.yaml`);
    if (!(await file.exists())) throw new Error("the private build needs private.yaml (see README)");
    const extra = check(privateSchema, Bun.YAML.parse(await file.text()), "private.yaml");
    resume.basics.phone = extra.basics?.phone;
  }

  const ids = resume.work.map((j) => j.id);
  const repeated = ids.find((id, i) => ids.indexOf(id) !== i);
  if (repeated) throw new Error(`resume.yaml: work id "${repeated}" is used twice`);
  return resume;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2024-12" → "Dec 2024", "2021" → "2021". */
export function formatDate(value: string): string {
  const [year, month] = value.split("-");
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year!;
}

/** "Dec 2024 – Aug 2026", with an en dash; no end date means "Present". */
export function formatRange(job: Pick<Job, "startDate" | "endDate">): string {
  return `${formatDate(job.startDate)} – ${job.endDate ? formatDate(job.endDate) : "Present"}`;
}

/** The title line as printed: position, team, and the promotion note. */
export function formatTitle(job: Job): string {
  let title = job.position;
  if (job.team) title += `, ${job.team}`;
  if (job.promotedFrom) title += ` (promoted from ${job.promotedFrom})`;
  return title;
}

/** "https://www.linkedin.com/in/x" → "linkedin.com/in/x". */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

export function formatLocation(resume: Resume): string {
  return `${resume.basics.location.city}, ${resume.basics.location.region}`;
}
