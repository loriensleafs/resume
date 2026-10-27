// The one rule for private details (decision 0006). private.yaml holds them, and three checks read them here:
// the content test over every tracked file, the release skill's push guard over everything a push sends, and the
// agent files' check, which needs no private.yaml and so also runs in CI. Nothing here returns or throws a private
// value: a reason is fixed text, and a phone number found is a line number.

/** What private.yaml lets a check compare against, or why it cannot check. */
export type PrivateValues = { ok: true; values: string[] } | { ok: false; missing: boolean; reason: string };

// A number needs this many digits before it is found in any format; fewer would match too much other text.
const MIN_DIGITS = 7;

// One separator between two digits: a space or a tab, a punctuation mark (a dash, a bracket, a dot, a slash, an
// underscore), a symbol such as "+", or an invisible format character such as a zero-width space. Never a letter,
// a digit, a line break or another control character, so a NUL line keeps two pieces of text apart.
const SEPARATOR = String.raw`[\t\p{Z}\p{P}\p{S}\p{Cf}]`;
// Between two digits of a private value: up to 4 separators, then up to two line breaks (a blank line), each with
// up to 12 characters of indentation, such as spaces, a diff's "+" or a quote's ">".
const GAP = String.raw`${SEPARATOR}{0,4}(?:\r?\n${SEPARATOR}{0,12}){0,2}`;
// Between two digit groups of a phone number on one line: up to 4 separators.
const LINE_GAP = `${SEPARATOR}{0,4}`;

// A North American number, not inside a longer number or word: an optional 1, +1 or 001, then an area code and an
// exchange that start with 2 to 9 (so a timestamp such as 1700000000 is none), then four digits.
const NORTH_AMERICAN = new RegExp(
  String.raw`(?<![\p{L}\p{N}+])(?:(?:\+|00)?1${LINE_GAP})?[2-9]\d\d${LINE_GAP}([2-9]\d\d)${LINE_GAP}(\d{4})(?!\d)`,
  "gu",
);
// Any other country's number, not inside a longer number or word: + or 00, a country code that starts with 2 to 9,
// then 8 to 15 digits in all.
const INTERNATIONAL = new RegExp(String.raw`(?<![\p{L}\p{N}+])(?:\+|00)[2-9](?:${LINE_GAP}\d){7,14}(?!\d)`, "gu");

/** The text in NFKC form, with each decimal digit of any script written as its ASCII digit. */
function plain(text: string): string {
  return text.normalize("NFKC").replace(/\p{Nd}/gu, (digit) => {
    if (digit <= "9") return digit;
    // Unicode keeps each script's digits in a run of ten, 0 to 9, and never splits a run, so a digit's value is
    // its distance from the start of its run.
    let code = digit.codePointAt(0)!;
    let distance = 0;
    while (/\p{Nd}/u.test(String.fromCodePoint(code - 1))) {
      code -= 1;
      distance += 1;
    }
    return String(distance % 10);
  });
}

/** The digits of a number, without a leading 1 or 001 country code before ten more digits. */
const nationalDigits = (value: string) => plain(value).replace(/\D/g, "").replace(/^(?:00)?1(?=\d{10}$)/, "");

const isFictional = (exchange: string, subscriber: string) =>
  exchange === "555" && subscriber >= "0100" && subscriber <= "0199";

/** Whether `value` is a number in NANPA's range for fiction, 555-0100 to 555-0199, which any area code may hold. */
export function isMadeUpNumber(value: string): boolean {
  const digits = nationalDigits(value);
  if (/\p{L}/u.test(value) || (digits.length !== 7 && digits.length !== 10)) return false;
  return isFictional(digits.slice(-7, -4), digits.slice(-4));
}

/**
 * Whether `text` holds the private `value`: as written, in any letter case, or, for a value with 7 or more digits,
 * in any format of those digits (GAP above), with an optional 1, +1 or 001 before them, and in any script's digits.
 */
export function holds(text: string, value: string): boolean {
  const haystack = plain(text);
  const wanted = plain(value.trim());
  if (haystack.toLowerCase().includes(wanted.toLowerCase())) return true;
  const digits = nationalDigits(wanted);
  if (digits.length < MIN_DIGITS) return false;
  return new RegExp(String.raw`(?<!\d)(?:(?:00${GAP})?1${GAP})?${[...digits].join(GAP)}(?!\d)`, "u").test(haystack);
}

// A match made of digits alone, with no separator, "+" or bracket, is an id or a timestamp as often as a phone
// number, so findPhoneNumbers lets it pass. The private number is still found in that form: holds() compares
// every file against private.yaml.
const isBareDigits = (match: string) => /^\d+$/.test(match);

/** The lines, from 1, that hold a phone number other than a made-up one. It never gives the number itself. */
export function findPhoneNumbers(text: string): number[] {
  const lines: number[] = [];
  text.split("\n").forEach((line, i) => {
    const plainLine = plain(line);
    const northAmerican = [...plainLine.matchAll(NORTH_AMERICAN)].some(
      ([match, exchange, subscriber]) => !isBareDigits(match) && !isFictional(exchange!, subscriber!),
    );
    const international = [...plainLine.matchAll(INTERNATIONAL)].some(([match]) => !isBareDigits(match));
    if (northAmerican || international) lines.push(i + 1);
  });
  return lines;
}

/** Every non-empty scalar in the parsed YAML, once each. */
function scalars(parsed: unknown): string[] {
  const values: string[] = [];
  const walk = (node: unknown): void => {
    if (node !== null && typeof node === "object") Object.values(node).forEach(walk);
    else if (node !== null && node !== undefined) {
      const value = String(node).trim();
      if (value !== "") values.push(value);
    }
  };
  walk(parsed);
  return [...new Set(values)];
}

/** A number with fewer digits than any format check needs: it holds digits and no letter. */
const isShortNumber = (value: string) => {
  const digits = plain(value).replace(/\D/g, "");
  return !/\p{L}/u.test(value) && digits.length > 0 && digits.length < MIN_DIGITS;
};

/**
 * Every value in `root`/private.yaml. It fails closed: a missing, unreadable or broken file, a file with no value,
 * and a number with fewer than 7 digits all mean it cannot check. The reason is fixed text and quotes nothing.
 */
export async function loadPrivateValues(root: string): Promise<PrivateValues> {
  const cannotCheck = (reason: string): PrivateValues => ({ ok: false, missing: false, reason });
  const file = Bun.file(`${root}/private.yaml`);
  if (!(await file.exists())) return { ok: false, missing: true, reason: "private.yaml is missing" };
  let text: string;
  try {
    text = await file.text();
  } catch {
    return cannotCheck("private.yaml cannot be read");
  }
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(text);
  } catch {
    return cannotCheck("private.yaml does not parse"); // the parser's own message could quote the file
  }
  const values = scalars(parsed);
  if (values.length === 0) return cannotCheck("private.yaml holds no value");
  if (values.some(isShortNumber)) return cannotCheck("a number in private.yaml has fewer than 7 digits");
  return { ok: true, values };
}
