// The device index (glossary): the labels and public text of the resume entries, logistics answers and passages, and
// the approved sources' links, kept on the visitor's device so that device matches work offline (SPEC-chat, "The
// build"; Views, "Citations card" and "Device matches"; Rendering answers).
// - At build time, buildDeviceIndex() makes it from publicKnowledge(knowledge), never from the full knowledge, so it
//   holds no Not public text. The chat's Vite plugin (vite-plugin.ts) writes it into the static folder.
// - In the browser, loadDeviceIndex() fetches that file once, on demand: when the input first gets focus, or when the
//   column first shows an answer or answer steps (task C36). So the module that calls it imports this one with a
//   dynamic import(), and neither the file nor this module is part of the JavaScript that / loads first. The site's
//   service worker precaches the file, so it loads offline too (task S28).

import { parseId, skillsId } from "../knowledge/ids";
import type { PublicKnowledge } from "../knowledge/types";
import type { SiteResume } from "../site/data";

/** One resume entry, logistics answer or passage, by its knowledge id, with the label and the text a browser shows. */
export type DeviceEntry = { id: string; label: string; text: string };

/** The device index, as device-index.json holds it. */
export type DeviceIndex = {
  /** The resume entries in resume order, then the logistics answers, then each approved source's passages. */
  entries: DeviceEntry[];
  /** The approved sources' links, each once: the https addresses an answer may link to (SPEC-chat, Rendering answers). */
  links: string[];
};

/** The file's name in the static folder, and so its address on the site: /device-index.json. */
export const DEVICE_INDEX_FILE = "device-index.json";

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
    const short = form?.form === "role" || form?.form === "highlight" ? shortOf.get(form.role) : undefined;
    if (form?.form === "basics") return `Resume: ${resume.basics.name}`;
    if (form?.form === "role" && short) return `Resume: ${short}`;
    if (form?.form === "highlight" && short) return `Resume: ${short}, highlight ${form.n}`;
    if (form?.form === "skills" && groupOf.has(id)) return `Resume: Skills, ${groupOf.get(id)}`;
    if (form?.form === "education") return "Resume: Education";
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

/** The one fetch of the page, while it runs or once it has succeeded. */
let loading: Promise<DeviceIndex> | undefined;

/**
 * The device index, fetched once per page: every call gets the same promise. A failed fetch is forgotten, so the next
 * call tries again, for example once the network is back before the service worker holds the file.
 */
export function loadDeviceIndex(): Promise<DeviceIndex> {
  loading ??= fetchDeviceIndex().catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

async function fetchDeviceIndex(): Promise<DeviceIndex> {
  const address = `/${DEVICE_INDEX_FILE}`;
  const response = await fetch(address);
  if (!response.ok) throw new Error(`${address}: ${response.status} ${response.statusText}`);
  // The build wrote the file from this module's own type (vite-plugin.ts), and the site serves it from its own origin.
  return (await response.json()) as DeviceIndex;
}
