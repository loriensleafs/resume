# Print rules that keep the PDF readable by hiring software

Hiring software (ATS) extracts the PDF's text. These rules keep that text complete and in reading order. Each one looks unnecessary until it is removed:

- **One column** of real text. Multi-column layouts can come out of a parser in the wrong order.
- **Exactly 2 pages.** Normal at Peter's level of experience.
- **Fixed-weight TrueType fonts**, cut from the variable font. Chrome embeds a variable font as Type 3 glyphs, which some parsers read badly; fixed weights embed as CID TrueType. See [research 04](../research/04-pdf-fonts.md).
- **Common ligatures off**, so "fi" and "fl" stay two real letters in the extracted text.
- **Hyphenated words stay on one line** (a small script in the print HTML). A line break at a hyphen makes the extracted halves join or split, which breaks keyword matches.
- **Tagged PDF**, so screen readers get headings, paragraphs and lists.

Decided 2026-10-26 by Peter, with the HTML and CSS design.
