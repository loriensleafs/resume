// Renders the print HTML that Chrome turns into the PDF. The markup mirrors
// src/print/resume.css; spacing between inline spans is deliberate, so keep
// tags on one line where they are on one line here.

import { displayUrl, formatLocation, formatRange, formatTitle, type Job, type Resume } from "../content";

const css = await Bun.file(new URL("./resume.css", import.meta.url)).text();
const keepHyphens = await Bun.file(new URL("./keep-hyphens.js", import.meta.url)).text();

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const indent = (block: string, by: string) =>
  block
    .split("\n")
    .map((line) => (line ? by + line : line))
    .join("\n");

function job(j: Job): string {
  return `  <article class="job">
    <div class="row"><span class="company">${esc(j.name)}</span><span class="meta">${formatRange(j)}</span></div>
    <div class="row title-row"><span class="title">${esc(formatTitle(j))}</span><span class="meta">${esc(j.location ?? "")}</span></div>
    <ul>
${j.highlights.map((h) => `      <li>${esc(h)}</li>`).join("\n")}
    </ul>
  </article>
`;
}

function earlier(jobs: Job[]): string {
  if (!jobs.length) return "";
  const rows = jobs.map(
    (j) =>
      `    <div class="row"><span><span class="company">${esc(j.name)}</span><span class="title">${esc(j.position)}</span></span><span class="meta">${formatRange(j)}</span></div>`,
  );
  return `  <div class="earlier">
    <div class="label">Earlier roles</div>
${rows.join("\n")}
  </div>
`;
}

/**
 * @param fontsBase URL or path, relative to the written HTML file, of the fonts/ folder.
 */
export function renderPrintHtml(resume: Resume, fontsBase: string): string {
  const b = resume.basics;
  const contact1 = [esc(formatLocation(resume)), b.phone && esc(b.phone), `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>`]
    .filter(Boolean)
    .map((s) => `<span>${s}</span>`)
    .join("");
  const contact2 = b.profiles
    .map((p) => `<span><a href="${esc(p.url)}">${esc(displayUrl(p.url))}</a></span>`)
    .join("");
  const main = resume.work.filter((j) => !j.earlier);
  const older = resume.work.filter((j) => j.earlier);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(b.name)} — Resume</title>
<style>
${indent(css.replaceAll('url("fonts/', `url("${fontsBase}/`).trimEnd(), "  ")}
</style>
</head>
<body>

<header>
  <h1 class="name">${esc(b.name)}</h1>
  <p class="headline">${esc(b.label)}</p>
  <p class="contact">
    ${contact1}
  </p>
  <p class="contact">
    ${contact2}
  </p>
</header>

<p class="lead">${esc(b.summary)}</p>

<section>
  <h2>Experience</h2>

${main.map(job).join("\n")}
${earlier(older)}</section>

<section>
  <h2>Skills</h2>
  <dl class="skills">
${resume.skills.map((s) => `    <dt>${esc(s.name)}</dt><dd>${esc(s.keywords.join(", "))}</dd>`).join("\n")}
  </dl>
</section>

<section>
  <h2>Education</h2>
${resume.education.map((e) => `  <p class="edu">${esc(e.institution)}</p>`).join("\n")}
</section>

<script>
${indent(keepHyphens.trimEnd(), "  ")}
</script>
</body>
</html>
`;
}
