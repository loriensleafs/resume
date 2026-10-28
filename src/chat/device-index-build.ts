// The device index's build-time part (SPEC-chat, "The build"): buildDeviceIndex() makes it from
// publicKnowledge(knowledge), never from the full knowledge, so it holds no Not public text. The chat's Vite plugin
// (vite-plugin.ts) is its only caller, and writes the result into the static folder. The browser's part is
// device-index.ts; this file stays apart from it, so the browser's JavaScript never holds the build code.

import { parseId, skillsId } from "../knowledge/ids";
import type { PublicKnowledge } from "../knowledge/types";
import type { SiteResume } from "../site/data";
import type { DeviceEntry, DeviceIndex } from "./device-index";

/**
 * The label of each resume entry, by its id: "Resume: FedNow" for a role and "Resume: FedNow, highlight 2" for a
 * highlight (SPEC-chat, Citations card). A role is named by its short label, its `x-short` in resume.yaml, as the
 * career timeline names it; the site's build data holds it (src/site/data.ts). The labels of basics, a skills group and
 * education are a wording draft (docs/design/wording-drafts/C16.md).
 */
function resumeLabeler(resume: SiteResume): (id: string) => string {
  // Maps, never an object's properties, so an id such as "constructor" names nothing (SPEC-knowledge, Ids).
  const shortOf = new Map(resume.work.map((role) => [role.id, role.short]));
  const groupOf = new Map(resume.skills.map((group) => [skillsId(group.name), group.name]));
  return (id) => {
    const form = parseId(id);
    switch (form?.form) {
      case "basics":
        return `Resume: ${resume.basics.name}`;
      case "role": {
        const short = shortOf.get(form.role);
        if (short) return `Resume: ${short}`;
        break;
      }
      case "highlight": {
        const short = shortOf.get(form.role);
        if (short) return `Resume: ${short}, highlight ${form.n}`;
        break;
      }
      case "skills": {
        const group = groupOf.get(id);
        if (group !== undefined) return `Resume: Skills, ${group}`;
        break;
      }
      case "education":
        return "Resume: Education";
    }
    // Both come from the same resume.yaml, so this stops the build only if the two ever disagree.
    throw new Error(`device index: the resume entry ${id} has no label in the site's resume data`);
  };
}

/** "Logistics: work arrangement" for the topic work-arrangement (SPEC-chat, Markers). */
const logisticsLabel = (topic: string) => `Logistics: ${topic.replaceAll("-", " ")}`;

/**
 * The device index of the public knowledge base; `resume` gives the labels' names (SPEC-chat, "The build"). The core
 * keeps its order: the resume entries, then the logistics answers. A catalog entry stays out, because a whole source is
 * never a citation (SPEC-chat, Markers); its passages follow, in source-id order, each in file order.
 */
export function buildDeviceIndex(knowledge: PublicKnowledge, resume: SiteResume): DeviceIndex {
  const resumeLabel = resumeLabeler(resume);
  const entries: DeviceEntry[] = [];
  for (const { id, kind, title, text } of knowledge.core) {
    // A logistics answer's title is its topic (SPEC-knowledge, Rendered text).
    if (kind === "resume") entries.push({ id, label: resumeLabel(id), text });
    if (kind === "logistics") entries.push({ id, label: logisticsLabel(title), text });
  }
  for (const source of knowledge.sources) {
    for (const { id, heading, text } of source.passages) entries.push({ id, label: `${source.title}: ${heading}`, text });
  }
  return { entries, links: [...new Set(knowledge.sources.flatMap((source) => source.links))] };
}
