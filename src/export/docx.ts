// Word (.docx) resume for portals that take Word and for recruiters who edit.
//
// Same content and order as the PDF, with real Word headings, bullets and right tab
// stops for dates, so hiring software reads it in order. Arial, because recruiters'
// machines do not have Google Sans Flex.

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  type ParagraphChild,
} from "docx";
import { displayUrl, formatLocation, formatRange, formatTitle, type Job, type Resume } from "../content";

const FONT = "Arial";
const INK = "1F2328";
const INK_2 = "3C4043";
const GRAPHITE = "5F6368";
const ACCENT = "2F6FDB";

const inch = (n: number) => Math.round(n * 1440); // twips
const pt = (n: number) => Math.round(n * 2); // half-points, for font sizes
const twip = (points: number) => Math.round(points * 20); // spacing
const MARGIN_X = 0.6;
const TEXT_WIDTH = inch(8.5 - 2 * MARGIN_X);
const RIGHT_TAB = [{ type: TabStopType.RIGHT, position: TEXT_WIDTH }];

const gap = " ".repeat(3); // between contact items

function link(url: string, text: string): ExternalHyperlink {
  return new ExternalHyperlink({ link: url, children: [new TextRun({ text, color: GRAPHITE })] });
}

function contactLine(items: ParagraphChild[], after = 0): Paragraph {
  const children: ParagraphChild[] = [];
  items.forEach((item, i) => {
    if (i) children.push(new TextRun({ text: gap, size: pt(9) }));
    children.push(item);
  });
  return new Paragraph({ children, run: { size: pt(9), color: GRAPHITE }, spacing: { after } });
}

function jobParagraphs(j: Job, first: boolean): Paragraph[] {
  const head = new Paragraph({
    keepNext: true,
    tabStops: RIGHT_TAB,
    spacing: { before: first ? 0 : twip(6.5), after: 0 },
    children: [
      new TextRun({ text: j.name, bold: true, size: pt(10.5) }),
      new TextRun({ text: "\t" }),
      new TextRun({ text: formatRange(j), size: pt(9), color: GRAPHITE }),
    ],
  });
  const title = new Paragraph({
    keepNext: true,
    tabStops: RIGHT_TAB,
    spacing: { after: twip(2.25) },
    children: [
      new TextRun({ text: formatTitle(j), color: INK_2 }),
      ...(j.location
        ? [new TextRun({ text: "\t" }), new TextRun({ text: j.location, size: pt(9), color: GRAPHITE })]
        : []),
    ],
  });
  const bullets = j.highlights.map(
    (h) =>
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: twip(1.25) },
        children: [new TextRun(h)],
      }),
  );
  return [head, title, ...bullets];
}

export async function renderDocx(resume: Resume): Promise<Uint8Array> {
  const b = resume.basics;
  const main = resume.work.filter((j) => !j.earlier);
  const earlier = resume.work.filter((j) => j.earlier);

  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: twip(2) },
      children: [new TextRun({ text: b.name })],
    }),
    new Paragraph({
      spacing: { after: twip(3.5) },
      children: [new TextRun({ text: b.label, size: pt(12), color: ACCENT })],
    }),
    contactLine([
      new TextRun({ text: formatLocation(resume), color: GRAPHITE, size: pt(9) }),
      ...(b.phone ? [new TextRun({ text: b.phone, color: GRAPHITE, size: pt(9) })] : []),
      link(`mailto:${b.email}`, b.email),
    ]),
    contactLine(
      b.profiles.map((p) => link(p.url, displayUrl(p.url))),
      twip(7),
    ),
    new Paragraph({
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT, space: 8 } },
      indent: { left: inch(0.1) },
      children: [new TextRun({ text: b.summary, size: pt(10) })],
    }),

    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Experience")] }),
    ...main.flatMap((j, i) => jobParagraphs(j, i === 0)),
  ];

  if (earlier.length) {
    children.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: twip(6.5), after: twip(1.5) },
        children: [new TextRun({ text: "Earlier roles", bold: true })],
      }),
      ...earlier.map(
        (j, i) =>
          new Paragraph({
            keepNext: i < earlier.length - 1,
            tabStops: RIGHT_TAB,
            children: [
              new TextRun({ text: j.name, bold: true }),
              new TextRun({ text: `${gap}${j.position}`, color: GRAPHITE }),
              new TextRun({ text: "\t" }),
              new TextRun({ text: formatRange(j), size: pt(9), color: GRAPHITE }),
            ],
          }),
      ),
    );
  }

  children.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Skills")] }),
    ...resume.skills.map(
      (s) =>
        new Paragraph({
          tabStops: [{ type: TabStopType.LEFT, position: inch(1.5) }],
          indent: { left: inch(1.5), hanging: inch(1.5) },
          spacing: { after: twip(2.5) },
          children: [new TextRun({ text: s.name, bold: true }), new TextRun("\t"), new TextRun(s.keywords.join(", "))],
        }),
    ),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Education")] }),
    ...resume.education.map((e) => new Paragraph({ children: [new TextRun(e.institution)] })),
  );

  const doc = new Document({
    title: `${b.name} — Resume`,
    creator: b.name,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: pt(9.5), color: INK },
          paragraph: { spacing: { line: 264 } }, // 1.1 lines
        },
        title: { run: { font: FONT, size: pt(26), bold: true, color: INK } },
        heading1: {
          run: { font: FONT, size: pt(11), bold: true, color: ACCENT },
          paragraph: { spacing: { before: twip(10), after: twip(4) }, keepNext: true },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: inch(0.17), hanging: inch(0.13) } },
                run: { color: GRAPHITE },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: inch(8.5), height: inch(11) },
            margin: { top: inch(0.55), bottom: inch(0.5), left: inch(MARGIN_X), right: inch(MARGIN_X) },
          },
        },
        children,
      },
    ],
  });

  return new Uint8Array(await Packer.toArrayBuffer(doc));
}
