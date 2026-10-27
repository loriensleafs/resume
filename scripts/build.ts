// `bun run build`: builds every resume file from resume.yaml.
//
//   bun run build            public files (no phone number) in dist/public/
//                            and, when private.yaml exists, private files in dist/private/
//   bun run build --public   public files only
//
// The website serves the committed documents in documents/, which `bun run documents` writes.
// CI runs `bun run build` to check that the documents still build.
//
// Each variant gets the PDF, the Word file, the text file and resume.html, the print
// preview: open it in a browser to see the PDF layout.

import { build } from "../src/build";

const built = await build(Bun.argv.includes("--public") ? { variants: ["public"] } : {});
for (const b of built) console.log(`dist/${b.variant}/: PDF, Word, text and resume.html`);
