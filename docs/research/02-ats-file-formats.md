# PDF and Word for hiring software (ATS)

Researched 2026-10-26.

## Sources

- ATS Verification, "PDF vs Word for ATS" (2026): both formats parse when built correctly. Word stores text in reading order, so it is the lower-risk upload when a portal accepts it. In the author's own parser, one resume with a two-column skills table scored 84–85 as a PDF made by an AI tool, and 99–100 as Word. The author calls this one illustration, not a vendor test, and retracted an earlier five-ATS table. https://atsverification.com/blog/pdf-vs-word-for-ats/
- Common failure modes it lists: image-only PDFs, custom-encoded fonts, multi-column reading order, text drawn as graphics.

## Checks on this repo's PDF (2026-10-26)

- `pdftotext` in default and `-raw` modes: every skills label stays separate from its list ("Front end TypeScript, React, …"). No "LanguagesGo"-style merges.
- `pdffonts`: all fonts are CID TrueType (see [04](04-pdf-fonts.md)).

## Outcome

The PDF stays the designed document. The build also makes a Word file and a text file from the same source ([decision 0011](../decisions/0011-word-and-text-documents.md)). The evidence that Word parses better is weak; Word is offered for portals that prefer it.
