// Seam 2 of SPEC-content: each renderer on a small fixture, for the cases the real
// resume does not exercise (escaping, a current role, no earlier roles).

import { describe, expect, test } from "bun:test";
import { $ } from "bun";
import { displayUrl, formatDate, formatRange, formatTitle, type Resume } from "../content";
import { renderDocx } from "../export/docx";
import { renderText } from "../export/text";
import { renderPrintHtml } from "../print/template";

const fixture = (overrides: Partial<Resume> = {}): Resume => ({
  basics: {
    name: "Test Person",
    label: "Engineer",
    email: "test@example.com",
    summary: "A summary.",
    location: { city: "Boston", region: "MA", countryCode: "US" },
    profiles: [{ network: "GitHub", username: "test", url: "https://github.com/test" }],
  },
  work: [
    {
      id: "acme",
      name: "Acme & Co <Labs>",
      // Each x-short appears nowhere else in the fixture, so a renderer that prints it fails the tests.
      "x-short": "ACME-SHORT",
      position: "Engineer",
      team: "Platform team",
      promotedFrom: "Junior Engineer",
      location: "Boston, MA",
      startDate: "2024-03",
      highlights: ["Built <things> & shipped them."],
      earlier: false,
    },
    {
      id: "old",
      name: "Old Co",
      "x-short": "OLD-SHORT",
      position: "Developer",
      startDate: "2010",
      endDate: "2012",
      highlights: [],
      earlier: true,
    },
  ],
  skills: [{ name: "Tools", keywords: ["Bun", "TypeScript"] }],
  education: [{ institution: "A University" }],
  ...overrides,
});

describe("formatting", () => {
  test("prints months as short names and years alone", () => {
    expect(formatDate("2024-12")).toBe("Dec 2024");
    expect(formatDate("2021")).toBe("2021");
  });

  test("prints a range with an en dash, and Present without an end date", () => {
    expect(formatRange({ startDate: "2024-03" })).toBe("Mar 2024 – Present");
    expect(formatRange({ startDate: "2010", endDate: "2012" })).toBe("2010 – 2012");
  });

  test("joins position, team and promotion note", () => {
    expect(formatTitle(fixture().work[0]!)).toBe("Engineer, Platform team (promoted from Junior Engineer)");
  });

  test("shortens profile links for display", () => {
    expect(displayUrl("https://www.linkedin.com/in/someone")).toBe("linkedin.com/in/someone");
    expect(displayUrl("https://github.com/test/")).toBe("github.com/test");
  });
});

describe("renderPrintHtml", () => {
  const html = renderPrintHtml(fixture(), "FONTS");

  test("escapes content", () => {
    expect(html).toContain("Acme &amp; Co &lt;Labs&gt;");
    expect(html).toContain("Built &lt;things&gt; &amp; shipped them.");
    expect(html).not.toContain("<Labs>");
  });

  test("points the fonts at the given folder", () => {
    expect(html).toContain('url("FONTS/gsf-400.ttf")');
  });

  test("lists earlier roles compactly, and omits the block when there are none", () => {
    expect(html).toContain('<div class="label">Earlier roles</div>');
    expect(html).toContain('<span class="company">Old Co</span><span class="title">Developer</span>');
    const none = renderPrintHtml(fixture({ work: [fixture().work[0]!] }), "FONTS");
    expect(none).not.toContain('<div class="earlier">');
  });

  test("omits the phone when there is none, and shows it when there is", () => {
    expect(html).not.toContain("555");
    const withPhone = fixture();
    withPhone.basics.phone = "(555) 555-0100";
    expect(renderPrintHtml(withPhone, "FONTS")).toContain("<span>(555) 555-0100</span>");
  });

  test("prints no role's x-short, for a role or an earlier role", () => {
    expect(html).not.toContain("ACME-SHORT");
    expect(html).not.toContain("OLD-SHORT");
  });
});

describe("renderText", () => {
  const text = renderText(fixture());

  test("writes each role as plain lines with - bullets", () => {
    expect(text).toContain("Acme & Co <Labs> | Mar 2024 – Present\n");
    expect(text).toContain("Engineer, Platform team (promoted from Junior Engineer) | Boston, MA\n");
    expect(text).toContain("- Built <things> & shipped them.\n");
    expect(text).toContain("Earlier roles\n- Old Co, Developer | 2010 – 2012\n");
  });

  test("has no hard wraps and ends with a newline", () => {
    expect(text.split("\n").every((line) => line.length < 400)).toBe(true);
    expect(text.endsWith("\n")).toBe(true);
  });

  test("omits the earlier-roles heading when there are none", () => {
    expect(renderText(fixture({ work: [fixture().work[0]!] }))).not.toContain("Earlier roles");
  });

  test("prints no role's x-short, for a role or an earlier role", () => {
    expect(text).not.toContain("ACME-SHORT");
    expect(text).not.toContain("OLD-SHORT");
  });
});

describe("renderDocx", () => {
  test("writes escaped text, right tab stops and Word bullets", async () => {
    const path = `${Bun.env.TMPDIR ?? "/tmp"}/resume-render-${crypto.randomUUID()}.docx`;
    await Bun.write(path, await renderDocx(fixture()));
    const xml = await $`unzip -p ${path} word/document.xml`.text();
    await $`rm -f ${path}`.quiet();
    expect(xml).toContain("Acme &amp; Co &lt;Labs&gt;");
    expect(xml).toContain('<w:tab w:val="right"');
    expect(xml).toContain("<w:numPr>");
  });

  test("prints no role's x-short in any part of the file, for a role or an earlier role", async () => {
    const path = `${Bun.env.TMPDIR ?? "/tmp"}/resume-render-${crypto.randomUUID()}.docx`;
    await Bun.write(path, await renderDocx(fixture()));
    const parts = await $`unzip -p ${path}`.text();
    await $`rm -f ${path}`.quiet();
    expect(parts).toContain("Old Co"); // control: the parts were read
    expect(parts).not.toContain("ACME-SHORT");
    expect(parts).not.toContain("OLD-SHORT");
  });
});
