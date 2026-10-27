# One YAML resume source in the JSON Resume shape

The resume now feeds five outputs: the PDF, the Word file, the text file, the site and the chat's knowledge file. One source means they can never disagree on a title or a date. The shape follows JSON Resume (jsonresume.org), an open standard that resume tools and AI agents read; fields it lacks are marked `# extension`. Bun reads YAML natively, so the format adds no package.

Decided 2026-10-26 by Peter.

Considered: one Markdown file (easier prose, but needs a parser and strict heading rules); keeping `resume.html` as the source (the site and chat would depend on print markup).

Consequences: content edits happen in `resume.yaml`; the print HTML, Word and text files are generated. The generated print HTML was verified byte-identical to the hand-written `resume.html` it replaced.
