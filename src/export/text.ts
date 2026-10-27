// Plain-text resume for "paste your resume" boxes on application forms.
// No hard line wraps (forms wrap for you) and ASCII bullets (some forms mangle "•").

import { displayUrl, formatLocation, formatRange, formatTitle, type Resume } from "../content";

export function renderText(resume: Resume): string {
  const b = resume.basics;
  const out: string[] = [];
  const section = (title: string) => out.push("", title.toUpperCase(), "");

  out.push(b.name, b.label);
  out.push([formatLocation(resume), b.phone, b.email].filter(Boolean).join(" | "));
  out.push(b.profiles.map((p) => displayUrl(p.url)).join(" | "));

  section("Summary");
  out.push(b.summary);

  section("Experience");
  for (const j of resume.work.filter((j) => !j.earlier)) {
    out.push(`${j.name} | ${formatRange(j)}`);
    out.push([formatTitle(j), j.location].filter(Boolean).join(" | "));
    for (const h of j.highlights) out.push(`- ${h}`);
    out.push("");
  }
  const earlier = resume.work.filter((j) => j.earlier);
  if (earlier.length) {
    out.push("Earlier roles");
    for (const j of earlier) out.push(`- ${j.name}, ${j.position} | ${formatRange(j)}`);
  } else {
    out.pop();
  }

  section("Skills");
  for (const s of resume.skills) out.push(`${s.name}: ${s.keywords.join(", ")}`);

  section("Education");
  for (const e of resume.education) out.push(e.institution);

  return out.join("\n") + "\n";
}
