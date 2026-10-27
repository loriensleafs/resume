// The text of a built document, read the way a recruiter's tools and hiring software read it. The content
// module's two document tests share it: seam 1 (src/__tests__/build.test.ts) and seam 3
// (scripts/__tests__/documents.test.ts).

import { $ } from "bun";

/** The text with each run of whitespace made one space. */
export const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

/** The PDF's text in the order its pages draw it (`pdftotext -raw`). */
export const pdfText = async (pdf: string) => normalize(await $`pdftotext -raw ${pdf} -`.text());

// The five entities XML predefines. "&amp;" goes last, so "&amp;lt;" becomes "&lt;", not "<".
const ENTITIES = [
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&quot;", '"'],
  ["&apos;", "'"],
  ["&amp;", "&"],
] as const;

/** The Word file's body text (`word/document.xml`), its runs in order with a space between them. */
export async function docxText(docx: string): Promise<string> {
  const xml = await $`unzip -p ${docx} word/document.xml`.text();
  const runs = [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((match) => match[1]!).join(" ");
  return normalize(ENTITIES.reduce((text, [entity, character]) => text.replaceAll(entity, character), runs));
}
