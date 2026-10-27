// The content module's one entry point: resume.yaml in, every document out.

import { loadResume, type Variant } from "./content";
import { renderDocx } from "./export/docx";
import { renderText } from "./export/text";
import { printToPdf, type PrintJob } from "./print/chrome";
import { renderPrintHtml } from "./print/template";

export const BASENAME = "Peter-Kloss-Resume";
const REPO = `${import.meta.dir}/..`;

export type BuildOptions = {
  /** Folder that holds resume.yaml and, for the private variant, private.yaml. */
  root?: string;
  /** Output folder; each variant writes to <outDir>/<variant>/. */
  outDir?: string;
  /** Defaults to "public", plus "private" when private.yaml exists. */
  variants?: Variant[];
  /** Folder of the fixed-weight fonts the print HTML loads. */
  fontsDir?: string;
};

export type BuiltVariant = { variant: Variant; dir: string; html: string; pdf: string; docx: string; txt: string };

export async function build(options: BuildOptions = {}): Promise<BuiltVariant[]> {
  const root = options.root ?? REPO;
  const outDir = options.outDir ?? `${root}/dist`;
  const fonts = Bun.pathToFileURL(options.fontsDir ?? `${REPO}/fonts`).href;
  const variants =
    options.variants ?? (["public", ...((await Bun.file(`${root}/private.yaml`).exists()) ? ["private"] : [])] as Variant[]);

  const built: BuiltVariant[] = [];
  for (const variant of variants) {
    const resume = await loadResume(variant, root);
    const dir = `${outDir}/${variant}`;
    const out: BuiltVariant = {
      variant,
      dir,
      html: `${dir}/resume.html`,
      pdf: `${dir}/${BASENAME}.pdf`,
      docx: `${dir}/${BASENAME}.docx`,
      txt: `${dir}/${BASENAME}.txt`,
    };
    await Bun.write(out.html, renderPrintHtml(resume, fonts));
    await Bun.write(out.txt, renderText(resume));
    await Bun.write(out.docx, await renderDocx(resume));
    built.push(out);
  }

  const jobs: PrintJob[] = built.map((b) => ({ html: b.html, pdf: b.pdf }));
  await printToPdf(jobs);
  return built;
}
