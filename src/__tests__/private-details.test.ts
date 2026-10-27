// The one rule for private details (decision 0006): how private.yaml loads, how a private value is found in any
// format, and how a phone number nobody named is found. Every number here is made up: 555-0100 to 555-0199 are
// reserved for fiction, 555 is no area code, and 020 7946 0000 to 0999 is the UK's range for drama.

import { afterAll, describe, expect, test } from "bun:test";
import { findPhoneNumbers, holds, isMadeUpNumber, loadPrivateValues } from "../private-details";

const PHONE = "(555) 555-0142";
const tmp = `${Bun.env.TMPDIR ?? "/tmp"}/private-details-test-${crypto.randomUUID()}`;

afterAll(() => {
  Bun.spawnSync(["rm", "-rf", tmp]);
});

/** A folder that holds `privateYaml` as private.yaml, or no private.yaml when it is null. */
async function root(privateYaml: string | null): Promise<string> {
  const dir = `${tmp}/${crypto.randomUUID()}`;
  await Bun.write(`${dir}/resume.yaml`, "basics: {}\n");
  if (privateYaml !== null) await Bun.write(`${dir}/private.yaml`, privateYaml);
  return dir;
}

describe("holds", () => {
  test.each([
    ["as written", `Call ${PHONE}.`],
    ["as digits only", "Call 5555550142."],
    ["with spaces and dots", "Call 555 555 0142 or 555.555.0142."],
    ["with en dashes", "Call 555–555–0142."],
    ["with em dashes", "Call 555—555—0142."],
    ["with underscores", "Call 555_555_0142."],
    ["with slashes", "Call 555/555/0142."],
    ["with a zero-width space", "Call 555​555​0142."],
    ["with four separators", "Call (555) - 555 - 0142."],
    ["with a space between each digit", "Call 5 5 5 5 5 5 0 1 4 2."],
    ["across a blank line", "Call 555\n\n555-0142."],
    ["across indentation", "Call 555\n        555-0142."],
    ["after a leading 1", "Call 15555550142."],
    ["after +1 and a separator", "Call +1 555 555 0142."],
    ["after +1 with no separator", "Call +15555550142."],
    ["after 001", "Call 001 555 555 0142."],
    ["in fullwidth digits", "Call ５５５-５５５-０１４２."],
    ["in Arabic-Indic digits", "Call ٥٥٥٥٥٥٠١٤٢."],
  ])("finds a phone number %s", (_name, text) => {
    expect(holds(text, PHONE)).toBe(true);
  });

  test.each([
    ["another number", "Call (555) 555-0143."],
    ["the digits inside a longer number", "Call 95555550142 or 55555501429."],
    ["five separators between two digits", "Call 555 -  - 5550142."],
    ["three line breaks", "Call 555\n\n\n555-0142."],
    ["two pieces that a NUL line joins", "Call 555\n\u0000\n555-0142."],
  ])("does not find a phone number in %s", (_name, text) => {
    expect(holds(text, PHONE)).toBe(false);
  });

  test("reads a private value written with +1 or in other digits", () => {
    expect(holds("Call 555.555.0142.", "+1 555 555 0142")).toBe(true);
    expect(holds("Call 555.555.0142.", "５５５５５５０１４２")).toBe(true);
  });

  test("finds a value without digits as written, in any letter case", () => {
    expect(holds("Write to fake.person@EXAMPLE.com.", "Fake.Person@example.com")).toBe(true);
    expect(holds("Write to fake.person at example.com.", "Fake.Person@example.com")).toBe(false);
  });

  test("finds a value with fewer than 7 digits only as written", () => {
    expect(holds("Code 123-456.", "123-456")).toBe(true);
    expect(holds("Code 123 456.", "123-456")).toBe(false);
  });
});

describe("findPhoneNumbers", () => {
  test.each([
    ["in brackets", "Call (555) 555-0200."],
    ["with hyphens", "Call 555-555-0200."],
    ["with dots", "Call 555.555.0200."],
    ["as digits only", "Call 5555550200."],
    ["with slashes", "Call 555 / 555 / 0200."],
    ["with en dashes", "Call 555–555–0200."],
    ["after +1", "Call +1 555 555 0200."],
    ["with an extension", "Call 555-555-0200x12."],
    ["in fullwidth digits", "Call （５５５）５５５－０２００."],
    ["just below the made-up range", "Call 555-555-0099."],
    ["beside a made-up one", "Call 555-555-0100 or 555-555-0200."],
    ["in international form", "Call +44 20 7946 0958."],
    ["with 00 for the plus sign", "Call 0044 20 7946 0958."],
    ["with a bracketed trunk zero", "Call +44 (0) 20 7946 0958."],
  ])("finds a phone number %s", (_name, text) => {
    expect(findPhoneNumbers(text)).toEqual([1]);
  });

  test.each([
    ["a made-up number", "Call (555) 555-0100 or 555-555-0199."],
    ["a timestamp", "Posted at 1700000000."],
    ["a number whose exchange starts with 0", "Order 7700900123."],
    ["a commit hash", "Commit e3b0c44298fc1c149afbf4c8996fb92427ae41e4."],
    ["a date and counts", "On 2026-10-27, 1,024 characters and rows 147 to 148."],
  ])("finds no phone number in %s", (_name, text) => {
    expect(findPhoneNumbers(text)).toEqual([]);
  });

  test("gives the line of each phone number, from 1", () => {
    expect(findPhoneNumbers("A note.\nCall 555-555-0200.\nMore.\nOr +44 20 7946 0958.")).toEqual([2, 4]);
  });
});

describe("isMadeUpNumber", () => {
  test("is true for 555-0100 to 555-0199 in any area code or form", () => {
    expect(isMadeUpNumber("(555) 555-0100")).toBe(true);
    expect(isMadeUpNumber("+1 212 555 0199")).toBe(true);
    expect(isMadeUpNumber("555-0150")).toBe(true);
  });

  test("is false for any other value", () => {
    expect(isMadeUpNumber("555-555-0200")).toBe(false);
    expect(isMadeUpNumber("555-555-0099")).toBe(false);
    expect(isMadeUpNumber("fake.person@example.com")).toBe(false);
  });
});

describe("loadPrivateValues", () => {
  test("gives every value in private.yaml", async () => {
    const dir = await root(`basics:\n  phone: ${PHONE}\n  email: fake.person@example.com\n`);
    expect(await loadPrivateValues(dir)).toEqual({ ok: true, values: [PHONE, "fake.person@example.com"] });
  });

  test("cannot check without private.yaml, and says it is missing", async () => {
    expect(await loadPrivateValues(await root(null))).toEqual({ ok: false, missing: true, reason: "private.yaml is missing" });
  });

  test.each([
    ["does not parse", `basics: [\n  phone: ${PHONE}\n`, "private.yaml does not parse"],
    ["holds no value", "basics: {}\n", "private.yaml holds no value"],
    ["holds a number with fewer than 7 digits", "basics:\n  code: 123-456\n", "a number in private.yaml has fewer than 7 digits"],
  ])("cannot check a private.yaml that %s, and quotes none of it", async (_name, privateYaml, reason) => {
    expect(await loadPrivateValues(await root(privateYaml))).toEqual({ ok: false, missing: false, reason });
  });

  // Root reads every file, so the check only means something for another user.
  test.skipIf(process.getuid?.() === 0)("cannot check a private.yaml that cannot be read", async () => {
    const dir = await root(`basics:\n  phone: ${PHONE}\n`);
    Bun.spawnSync(["chmod", "000", `${dir}/private.yaml`]);
    expect(await loadPrivateValues(dir)).toEqual({ ok: false, missing: false, reason: "private.yaml cannot be read" });
  });
});
