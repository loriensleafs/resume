// The id grammar (SPEC-knowledge, Ids): one place that says what an id in the
// knowledge base looks like, for the build, the reads and the citation check.

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NUMBER_FROM_1 = /^[1-9][0-9]*$/;
const SLUG_CHARACTERS = 60;
/** A 60-character source id, a dot and a passage number up to 999. */
const PASSAGE_ID_CHARACTERS = 64;

/** How a slug is written, for error messages. */
export const SLUG_RULE = `lowercase letters and digits, with single hyphens between them, at most ${SLUG_CHARACTERS} characters`;
/** How a source id is written, for error messages: the rule isSourceId() checks. */
export const SOURCE_ID_RULE = `a slug (${SLUG_RULE}), never "basics" or "education"`;
/** How a passage id is written, for error messages. */
export const PASSAGE_ID_RULE = `a passage id is <source id>.<n>, at most ${PASSAGE_ID_CHARACTERS} characters`;

/** Every form an id can take, with its parts. */
export type IdForm =
  | { form: "basics" }
  | { form: "education" }
  | { form: "role"; role: string }
  | { form: "highlight"; role: string; n: number }
  | { form: "skills"; slug: string }
  | { form: "logistics"; topic: string }
  | { form: "source"; source: string }
  | { form: "passage"; source: string; n: number };

export const isSlug = (s: string) => s.length <= SLUG_CHARACTERS && SLUG.test(s);

/** A slug that is not one of the bare resume entry ids. */
export const isSourceId = (s: string) => isSlug(s) && s !== "basics" && s !== "education";

/** A name in lowercase, each run of other characters made one hyphen, no hyphen at either end. */
export const toSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const roleId = (role: string) => `role:${role}`;
export const highlightId = (role: string, n: number) => `highlight:${role}.${n}`;
export const skillsId = (groupName: string) => `skills:${toSlug(groupName)}`;
export const logisticsId = (topic: string) => `logistics:${topic}`;
export const passageId = (sourceId: string, n: number) => `${sourceId}.${n}`;

/** Splits "<name>.<n>" at its last dot; undefined when the part after it is not a safe integer from 1. */
function splitNumber(s: string): [string, number] | undefined {
  const dot = s.lastIndexOf(".");
  const digits = s.slice(dot + 1);
  const n = Number(digits);
  return dot > 0 && NUMBER_FROM_1.test(digits) && Number.isSafeInteger(n) ? [s.slice(0, dot), n] : undefined;
}

/** The form of an id and its parts, or undefined when the id follows no form. */
export function parseId(id: string): IdForm | undefined {
  if (id === "basics" || id === "education") return { form: id };
  const colon = id.indexOf(":");
  if (colon === -1) {
    if (isSourceId(id)) return { form: "source", source: id };
    if (id.length > PASSAGE_ID_CHARACTERS) return undefined;
    const passage = splitNumber(id);
    return passage && isSourceId(passage[0]) ? { form: "passage", source: passage[0], n: passage[1] } : undefined;
  }
  const rest = id.slice(colon + 1);
  switch (id.slice(0, colon)) {
    case "role":
      return isSlug(rest) ? { form: "role", role: rest } : undefined;
    case "highlight": {
      const highlight = splitNumber(rest);
      return highlight && isSlug(highlight[0]) ? { form: "highlight", role: highlight[0], n: highlight[1] } : undefined;
    }
    case "skills":
      return isSlug(rest) ? { form: "skills", slug: rest } : undefined;
    case "logistics":
      return isSlug(rest) ? { form: "logistics", topic: rest } : undefined;
  }
  return undefined;
}
