// The pages' data, made at build time from the project's files (SPEC-site, Project Structure; decision 0023):
// buildSiteData() reads resume.yaml and the approved sources, and gives what the pages show. The Vite plugin in
// data.ts makes modules from it, which the route loaders and the career timeline import.
// - The resume facts that the pages show, and each approved source's id, title and roles only (decision 0006;
//   SPEC-site, Acceptance criteria).
// - Each approved source's JSON file: its kind, its summary and its passages.
// - The career timeline: its spans and year labels, and the stylesheet that places them on the year axis.
// Every source text comes from publicKnowledge(knowledge), which leaves out each source's Not public section.

import { formatRange, formatTitle, type Job, loadResume, type Resume } from "../content";
import { buildKnowledge, publicKnowledge } from "../knowledge/build";
import type { PublicKnowledge } from "../knowledge/types";

/**
 * A role as the resume view shows it. The plugin formats its text at build time, so the browser loads no code from the
 * content module, whose schema brings zod.
 */
export type SiteRole = Pick<Job, "id" | "name" | "position" | "earlier" | "highlights"> & {
  /** The dates as the documents print them: "Dec 2024 – Aug 2026". */
  dates: string;
  /** The title line as the documents print it, then the location: "Lead Front-End Engineer, Boston, MA". */
  titleLine: string;
  /** The role's short label on the career timeline, its `x-short` in resume.yaml: "FedNow". */
  short: string;
  /** The role's years: "2021 – 2024", or "2024 – Present" while it lasts. */
  years: string;
};

/**
 * The resume facts that the pages show, and no other field. A field added to resume.yaml reaches no page until a view
 * needs it and this type names it. The app bar shows the name and the headline (label); the resume view the rest.
 */
export type SiteResume = {
  basics: Pick<Resume["basics"], "name" | "label" | "summary">;
  work: SiteRole[];
  skills: Pick<Resume["skills"][number], "name" | "keywords">[];
  education: Pick<Resume["education"][number], "institution">[];
};

/** One approved source as publicKnowledge() gives it to the site (SPEC-knowledge, "Who gets which shape"). */
type PublicSource = PublicKnowledge["sources"][number];

/** A role of a source: its id, and its short label and years as the source page shows them ("FedNow, 2021 – 2024"). */
export type SourceRole = Pick<SiteRole, "id" | "short" | "years">;

/**
 * An approved source in the build-time module: its id, title and roles only (SPEC-site, Acceptance criteria). Each
 * role comes resolved from resume.yaml at build time, so a role that resume.yaml lacks stops the build.
 */
export type SiteSource = Pick<PublicSource, "id" | "title"> & { roles: SourceRole[] };

/** One source's JSON file: what its view shows beyond the module's id, title and roles. */
export type SourceJsonFile = Pick<PublicSource, "kind" | "summary" | "passages">;

/**
 * A span on the career timeline: one role or earlier role, with what the band shows of it (SPEC-site, Views: Career
 * timeline band). Its place on the year axis is a class of the timeline stylesheet, because a page may hold no style
 * attribute (SPEC-deploy, Headers).
 */
export type TimelineSpan = Pick<SiteRole, "id" | "short" | "name" | "position" | "years"> & {
  /** The class that places the span on the year axis: "career-timeline-span-fednow". */
  className: string;
};

/** A year label on the career timeline's year axis, with the class that places it: "career-timeline-year-2021". */
export type YearLabel = { year: string; className: string };

/** The career timeline band: its spans, earliest first, and its year labels, from left to right. */
export type SiteTimeline = { spans: TimelineSpan[]; yearLabels: YearLabel[] };

/** The default export of virtual:site-data. src/site/virtual-site-data.d.ts types the module with it. */
export type SiteData = { resume: SiteResume; sources: SiteSource[]; timeline: SiteTimeline };

/** "2021 – 2024" from 2021 and 2024; one year alone when the role starts and ends in it; "Present" with no end date. */
function formatYears({ startDate, endDate }: Pick<Job, "startDate" | "endDate">): string {
  const start = startDate.slice(0, 4);
  const end = endDate ? endDate.slice(0, 4) : "Present";
  return start === end ? start : `${start} – ${end}`;
}

/** Each field by name: a spread would carry every field that the schema gains into the pages. */
function siteResume(resume: Resume): SiteResume {
  return {
    basics: { name: resume.basics.name, label: resume.basics.label, summary: resume.basics.summary },
    work: resume.work.map((job) => ({
      id: job.id,
      name: job.name,
      position: job.position,
      earlier: job.earlier,
      highlights: job.highlights,
      dates: formatRange(job),
      titleLine: job.location ? `${formatTitle(job)}, ${job.location}` : formatTitle(job),
      short: job["x-short"],
      years: formatYears(job),
    })),
    skills: resume.skills.map(({ name, keywords }) => ({ name, keywords })),
    education: resume.education.map(({ institution }) => ({ institution })),
  };
}

/** A month as one number, 12 × its year + its index in the year: January 2009 is 24108, December 2024 is 24299. */
type Month = number;

/** The first month a date of resume.yaml names: "2024-12" is December 2024; "2021" is January 2021. */
function firstMonth(date: string): Month {
  const [year, month] = date.split("-");
  return Number(year) * 12 + (month ? Number(month) - 1 : 0);
}

/**
 * The month after a role ends. An end date with a month includes that month: "Aug 2026" ends as September begins. An end
 * date of a year alone ends as that year begins, so "2019 – 2020" is one year and meets "2020 – 2021", as the
 * first-view board draws them; a role that starts and ends in one year spans that year. A role with no end date runs
 * through the build's month.
 */
function monthAfter(job: Pick<Job, "id" | "startDate" | "endDate">, today: Date): Month {
  if (!job.endDate) return today.getFullYear() * 12 + today.getMonth() + 1;
  const end = job.endDate.includes("-") ? firstMonth(job.endDate) + 1 : firstMonth(job.endDate);
  const start = firstMonth(job.startDate);
  if (end > start) return end;
  if (!job.endDate.includes("-") && job.endDate === job.startDate.slice(0, 4)) return end + 12;
  throw new Error(`resume.yaml: work ${job.id}: endDate ${job.endDate} is before startDate ${job.startDate}`);
}

/**
 * The career timeline band and its stylesheet (SPEC-site, Views: Career timeline band). The year axis runs from January
 * of the first role's year to the end of the last role, one grid column per month, so each span is as long as its role
 * and a gap between roles shows as space. The stylesheet sets the axis's months on the band, and the grid columns of
 * each span and year label. Its year labels are those of the first-view board: every second year from the first, and
 * the last year at the axis's end; a year that begins less than two years before the axis's end gets no label.
 */
function careerTimeline(work: Job[], today: Date): { timeline: SiteTimeline; stylesheet: string } {
  const roles = work
    .map((job) => ({ job, start: firstMonth(job.startDate), end: monthAfter(job, today) }))
    .sort((a, b) => a.start - b.start);
  const axisStart = Math.floor(roles[0]!.start / 12) * 12;
  const axisEnd = Math.max(...roles.map(({ end }) => end));
  const months = axisEnd - axisStart;
  /** The grid lines of the months from `start` up to `end`, with the axis's first month in column 1. */
  const columns = (start: Month, end: Month) => `grid-column: ${start - axisStart + 1} / ${end - axisStart + 1};`;

  const spans = roles.map(({ job }) => ({
    id: job.id,
    short: job["x-short"],
    name: job.name,
    position: job.position,
    years: formatYears(job),
    className: `career-timeline-span-${job.id}`,
  }));
  const yearLabels: (YearLabel & { rule: string })[] = [];
  for (let january = axisStart; january <= axisEnd - 24; january += 24) {
    const year = String(january / 12);
    yearLabels.push({ year, className: `career-timeline-year-${year}`, rule: columns(january, january + 24) });
  }
  // The last year that the axis holds a month of, at the axis's end, over its last two years.
  const lastYear = String(Math.floor((axisEnd - 1) / 12));
  const lastLabel = Math.max(axisStart, axisEnd - 24);
  yearLabels.push({
    year: lastYear,
    className: `career-timeline-year-${lastYear}`,
    rule: `${columns(lastLabel, axisEnd)} text-align: end;`,
  });

  const stylesheet = [
    "/* The career timeline's year axis, made at build time from resume.yaml (careerTimeline() in src/site/site-data.ts). */",
    `.career-timeline { --career-timeline-months: ${months}; }`,
    ...roles.map(({ job, start, end }) => `.career-timeline-span-${job.id} { ${columns(start, end)} }`),
    ...yearLabels.map(({ className, rule }) => `.${className} { ${rule} }`),
  ].join("\n");
  return {
    timeline: { spans, yearLabels: yearLabels.map(({ year, className }) => ({ year, className })) },
    stylesheet: `${stylesheet}\n`,
  };
}

/**
 * The pages' data from the project's files under `root`: the module's data, each approved source's JSON file by
 * source id, in source-id order, and the career timeline's stylesheet. The resume comes through
 * loadResume("public", root) and the sources through publicKnowledge(), so neither a private detail nor a Not public
 * section reaches it. Each field is named, as in siteResume(). `today` ends a role that has no end date.
 */
export async function buildSiteData(
  root: string,
  today = new Date(),
): Promise<{ data: SiteData; sourceJsonFiles: Map<string, SourceJsonFile>; timelineStylesheet: string }> {
  const fullResume = await loadResume("public", root);
  const resume = siteResume(fullResume);
  const { timeline, stylesheet } = careerTimeline(fullResume.work, today);
  const { sources } = publicKnowledge(await buildKnowledge({ root }));
  // A Map, never an object's property, so a role id such as "constructor" names no role (SPEC-knowledge).
  const roleById = new Map(resume.work.map(({ id, short, years }) => [id, { id, short, years }]));
  // The knowledge build checks each role of an approved source against resume.yaml (SPEC-knowledge, Sources: Roles);
  // this stops the build too, should the two ever disagree.
  const roleOf = (sourceId: string, roleId: string): SourceRole => {
    const role = roleById.get(roleId);
    if (!role) throw new Error(`source ${sourceId}: the role ${roleId} is not in resume.yaml`);
    return role;
  };
  return {
    data: {
      resume,
      sources: sources.map(({ id, title, roles }) => ({ id, title, roles: roles.map((roleId) => roleOf(id, roleId)) })),
      timeline,
    },
    sourceJsonFiles: new Map(sources.map(({ id, kind, summary, passages }) => [id, { kind, summary, passages }])),
    timelineStylesheet: stylesheet,
  };
}
