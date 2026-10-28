import { parseId } from "../../knowledge/ids";
import type { SiteRole, SiteSource, SourceJsonFile } from "../data";

export type SourceViewProps = {
  /** The source: the build-time module's id and title, and its JSON file's kind and passages. */
  source: Pick<SiteSource, "id" | "title"> & Pick<SourceJsonFile, "kind" | "passages">;
  /** The roles the source is about, in the source's own order, as the career timeline names them. */
  roles: Pick<SiteRole, "short" | "years">[];
};

/**
 * What each kind of source is and who approved it. The deep dive's line is SPEC-site's (Views: Source view); the
 * interview's is S16's wording draft (docs/design/wording-drafts/S16.md).
 */
const KIND_LINES: Record<SourceJsonFile["kind"], string> = {
  "deep-dive": "Deep dive, written from Peter’s answers and approved by him.",
  interview: "Interview, in Peter’s own words and approved by him.",
};

/**
 * The line under the title: the kind, the roles with their years, and the number of passages. "Deep dive, written from
 * Peter's answers and approved by him. FedNow, 2021 – 2024. 5 passages." A source about no role leaves the roles out.
 */
function kindLine({ source, roles }: SourceViewProps): string {
  const count = source.passages.length;
  return [
    KIND_LINES[source.kind],
    ...(roles.length > 0 ? [`${roles.map((role) => `${role.short}, ${role.years}`).join("; ")}.`] : []),
    `${count} ${count === 1 ? "passage" : "passages"}.`,
  ].join(" ");
}

/** A passage's number, the <n> of its id <source id>.<n> (SPEC-knowledge, Ids). */
function passageNumber(id: string): number {
  const form = parseId(id);
  if (form?.form !== "passage") throw new Error(`SourceView: ${JSON.stringify(id)} is not a passage id`);
  return form.n;
}

/**
 * One source as plain semantic HTML that reads without JavaScript (SPEC-site, Views: Source view): the title, the kind
 * line, and every passage under its number and heading. Each passage is one element whose id, `<source id>.<n>`, is its
 * anchor, and which carries its knowledge id (SPEC-knowledge, Ids) in data-knowledge-id, as the resume view's entries
 * do. A passage's text shows as its paragraphs; task S17 renders it as Markdown.
 */
export function SourceView({ source, roles }: SourceViewProps) {
  return (
    <article>
      <header>
        <h1 className="text-heading-20">{source.title}</h1>
        <p className="text-copy-13">{kindLine({ source, roles })}</p>
      </header>
      {source.passages.map((passage) => (
        <section key={passage.id} id={passage.id} data-knowledge-id={passage.id}>
          <h2 className="text-label-16">
            <span className="text-label-13-mono">{passageNumber(passage.id)}</span> {passage.heading}
          </h2>
          {passage.text
            .split(/\n\s*\n/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean)
            .map((paragraph, i) => (
              // A paragraph has no id of its own; its place in the passage, fixed at build time, names it.
              <p key={i} className="text-copy-14">
                {paragraph}
              </p>
            ))}
        </section>
      ))}
    </article>
  );
}
