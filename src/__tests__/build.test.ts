// Seam 1 of SPEC-content: build() writes real files; these tests read them the way
// a recruiter's tools and hiring software do.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { build, type BuiltVariant } from "../build";
import { loadResume, type Resume } from "../content";
import { holds, isMadeUpNumber, loadPrivateValues } from "../private-details";

const REPO = `${import.meta.dir}/../..`;
const FAKE_PHONE = "(555) 555-0100";
// The private values that no tracked file may hold. README's made-up number is not private.
const PRIVATE = await loadPrivateValues(REPO);
const PRIVATE_VALUES = PRIVATE.ok ? PRIVATE.values.filter((value) => !isMadeUpNumber(value)) : [];
// CI and a fresh clone have no private.yaml, and a made-up number leaves nothing private: then nothing can leak.
// A broken private.yaml is no reason to skip: the test runs and fails with the reason.
const NOTHING_PRIVATE = PRIVATE.ok ? PRIVATE_VALUES.length === 0 : PRIVATE.missing;
const tmp = `${Bun.env.TMPDIR ?? "/tmp"}/resume-test-${crypto.randomUUID()}`;
const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

let pub: BuiltVariant;
let priv: BuiltVariant;
let resume: Resume;

beforeAll(async () => {
  await Bun.write(`${tmp}/root/resume.yaml`, Bun.file(`${REPO}/resume.yaml`));
  await Bun.write(`${tmp}/root/private.yaml`, `basics:\n  phone: ${FAKE_PHONE}\n`);
  [pub, priv] = (await build({ root: `${tmp}/root`, outDir: `${tmp}/out`, variants: ["public", "private"] })) as [
    BuiltVariant,
    BuiltVariant,
  ];
  resume = await loadResume("public", `${tmp}/root`);
}, 60_000);

afterAll(async () => {
  await $`rm -rf ${tmp}`.quiet().nothrow();
});

const pdfText = async (pdf: string) => normalize(await $`pdftotext -raw ${pdf} -`.text());
const docxText = async (docx: string) => {
  const xml = await $`unzip -p ${docx} word/document.xml`.text();
  return [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
    .map((m) => m[1]!)
    .join(" ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"');
};

describe("the PDF", () => {
  test("is US Letter, exactly 2 pages, and tagged", async () => {
    const info = await $`pdfinfo ${pub.pdf}`.text();
    expect(info).toMatch(/^Pages:\s+2$/m);
    expect(info).toMatch(/^Page size:\s+612 x 792 pts/m);
    expect(info).toMatch(/^Tagged:\s+yes$/m);
  });

  test("embeds every font as CID TrueType with a Unicode map", async () => {
    const rows = (await $`pdffonts ${pub.pdf}`.text()).trim().split("\n").slice(2);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row).toMatch(/CID TrueType\s+Identity-H\s+yes\s+yes\s+yes/);
  });

  test("contains every sentence whole, with no joined or split words", async () => {
    const text = await pdfText(pub.pdf);
    const sentences = [
      resume.basics.label,
      resume.basics.summary,
      ...resume.work.flatMap((j) => [j.name, j.position, ...j.highlights]),
      ...resume.skills.map((s) => s.keywords.join(", ")),
    ];
    for (const s of sentences) expect(text).toContain(normalize(s));
  });
});

describe("the Word file", () => {
  test("presents the content in reading order", async () => {
    const text = await docxText(pub.docx);
    const order = [
      resume.basics.name,
      resume.basics.label,
      resume.basics.summary.slice(0, 40),
      "Experience",
      ...resume.work.filter((j) => !j.earlier).map((j) => j.name),
      "Earlier roles",
      ...resume.work.filter((j) => j.earlier).map((j) => j.name),
      "Skills",
      "Education",
      resume.education[0]!.institution,
    ];
    let at = -1;
    for (const item of order) {
      const next = text.indexOf(item, at + 1);
      expect({ item, found: next > at }).toEqual({ item, found: true });
      at = next;
    }
  });
});

describe("the text file", () => {
  test("matches its snapshot", async () => {
    expect(await Bun.file(pub.txt).text()).toMatchSnapshot();
  });
});

describe("private details", () => {
  test("appear in the private documents", async () => {
    expect(await pdfText(priv.pdf)).toContain(FAKE_PHONE);
    expect(await Bun.file(priv.txt).text()).toContain(FAKE_PHONE);
    expect(await docxText(priv.docx)).toContain(FAKE_PHONE);
  });

  test("never appear in the public documents", async () => {
    expect(await pdfText(pub.pdf)).not.toContain(FAKE_PHONE);
    expect(await docxText(pub.docx)).not.toContain(FAKE_PHONE);
    for (const file of [pub.txt, pub.html]) expect(await Bun.file(file).text()).not.toContain(FAKE_PHONE);
  });

  // The failure names each file and never the value (src/private-details.ts).
  test.skipIf(NOTHING_PRIVATE)("never appear in a tracked file, in any format", async () => {
    expect(PRIVATE.ok ? "" : PRIVATE.reason).toBe("");
    const tracked = (await $`git -C ${REPO} ls-files -z`.text()).split("\0").filter(Boolean);
    const leaks: string[] = [];
    for (const path of tracked) {
      const file = Bun.file(`${REPO}/${path}`);
      if (!(await file.exists())) continue;
      const text = await file.text();
      if (PRIVATE_VALUES.some((value) => holds(text, value))) leaks.push(path);
    }
    expect(leaks).toEqual([]);
  });
});

describe("an invalid resume source", () => {
  const base = `basics:
  name: Test Person
  label: Engineer
  email: test@example.com
  summary: A summary.
  location: { city: Boston, region: MA, countryCode: US }
  profiles: []
work:
  - id: acme
    name: Acme
    position: Engineer
    startDate: 2020
    highlights: [Did a thing.]
skills: []
education: []
`;
  const attempt = async (name: string, yaml: string) => {
    await Bun.write(`${tmp}/bad/${name}/resume.yaml`, yaml);
    return build({ root: `${tmp}/bad/${name}`, outDir: `${tmp}/bad/${name}/out`, variants: ["public"] });
  };

  test("is accepted when valid (control)", async () => {
    await expect(loadResumeFrom("valid", base)).resolves.toBeDefined();
  });

  test("stops the build and names a missing field", async () => {
    await expect(attempt("missing", base.replace("  label: Engineer\n", ""))).rejects.toThrow(/basics\.label/);
  });

  test("stops the build and names a bad date", async () => {
    await expect(attempt("date", base.replace("startDate: 2020", 'startDate: "Dec 2020"'))).rejects.toThrow(
      /YYYY[\s\S]*work\[0\]\.startDate/,
    );
  });

  test("stops the build and names a misspelled field", async () => {
    await expect(attempt("typo", base.replace("highlights:", "hightlights:"))).rejects.toThrow(/hightlights/);
  });

  test("refuses a phone number in resume.yaml", async () => {
    await expect(attempt("phone", base.replace("  email:", `  phone: ${FAKE_PHONE}\n  email:`))).rejects.toThrow(
      /private\.yaml/,
    );
  });

  async function loadResumeFrom(name: string, yaml: string) {
    await Bun.write(`${tmp}/bad/${name}/resume.yaml`, yaml);
    return loadResume("public", `${tmp}/bad/${name}`);
  }

  // The real resume may have no hyphen at a line end today. In this fixture the long
  // compound cannot fit at the end of the first line, so without the hyphen script Chrome
  // breaks it after "agent-" (verified 2026-10-26). The test fails if that script stops working.
  test("keeps hyphenated words whole across line ends (fixture)", async () => {
    const sentence =
      "Built shared packages and tooling for every application team across the organization, including the agent-workflow-orchestration-platform-design-system-front-end-tooling suite.";
    const [out] = await attempt("hyphens", base.replace("[Did a thing.]", `["${sentence}"]`));
    expect(await pdfText(out!.pdf)).toContain(sentence);
  }, 30_000);
});
