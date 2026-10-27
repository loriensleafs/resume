# Fonts in Chrome's PDF output

Experiments in this repo, 2026-10-26.

- Chrome embeds the Google Sans Flex **variable font** as **Type 3** glyphs. Some PDF parsers read Type 3 text badly.
- **Fixed-weight TrueType** instances (each variation axis pinned) embed as **CID TrueType** with a Unicode map. `pdffonts` shows `CID TrueType ... yes yes yes` for all seven embedded fonts.
- The weights cut: 400 (body), 450 (headline), 520 (job titles), 640 (companies, section names, labels), 680 (name). Optical size 14 for text, 13 for the headline, 30 for the name; width 100, slant 0, roundness 0.
- The subset keeps Basic Latin, Latin-1, Latin Extended-A and the typographic marks the resume uses (dashes, curly quotes, bullet, ellipsis, ™, →).
- HarfBuzz's subsetter keeps only a default list of OpenType features, and that list drops `tnum` (tabular figures, used by the dates). `scripts/make-fonts.ts` therefore keeps every feature and every name record.
- HarfBuzz output (the current fonts) and the earlier fontTools output differ only in one-pixel anti-aliasing on curves. Glyph widths, positions and line breaks are identical, and the extracted text is identical.
- Google Sans Flex is under the SIL Open Font License 1.1 with no Reserved Font Name, so modified subsets may ship with `fonts/OFL.txt`.
