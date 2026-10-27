import { highlightId, roleId, skillsId } from "../../knowledge/ids";
import type { SiteData } from "../data";

/**
 * The whole resume as plain semantic HTML that reads without JavaScript (SPEC-site, Views: Resume view): the lead, each
 * role with its highlights, the earlier roles, skills and education, in the documents' order.
 *
 * Each resume entry is one element that carries its knowledge id (SPEC-knowledge, Ids) in data-knowledge-id. A cited
 * entry's number and tint belong on that element, and "Ask about this" inside each highlight's element. The ⋯ menu
 * belongs at the top of the article.
 */
export function ResumeView({ resume }: { resume: SiteData["resume"] }) {
  const roles = resume.work.filter((role) => !role.earlier);
  const earlierRoles = resume.work.filter((role) => role.earlier);
  return (
    <article>
      {/* "basics" and "education" are ids with no parts, so ids.ts has no builder for them. */}
      <p data-knowledge-id="basics">{resume.basics.summary}</p>
      {roles.map((role) => (
        <section key={role.id}>
          <header data-knowledge-id={roleId(role.id)}>
            <h2>{role.name}</h2>
            <p>{role.dates}</p>
            <p>{role.location ? `${role.titleLine}, ${role.location}` : role.titleLine}</p>
          </header>
          {role.highlights.length > 0 && (
            <ul>
              {role.highlights.map((highlight, i) => {
                const id = highlightId(role.id, i + 1);
                return (
                  <li key={id} data-knowledge-id={id}>
                    {highlight}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
      {earlierRoles.length > 0 && (
        <section>
          <h2>Earlier roles</h2>
          <ul>
            {earlierRoles.map((role) => (
              <li key={role.id} data-knowledge-id={roleId(role.id)}>
                <span>{`${role.name}, ${role.position}`}</span> <span>{role.dates}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2>Skills</h2>
        <dl>
          {resume.skills.map((group) => {
            const id = skillsId(group.name);
            return (
              // HTML lets a div wrap one name and its value in a dl, so the group's id has one element.
              <div key={id} data-knowledge-id={id}>
                <dt>{group.name}</dt>
                <dd>{group.keywords.join(", ")}</dd>
              </div>
            );
          })}
        </dl>
      </section>
      <section>
        <h2>Education</h2>
        <div data-knowledge-id="education">
          {resume.education.map((school) => (
            <p key={school.institution}>{school.institution}</p>
          ))}
        </div>
      </section>
    </article>
  );
}
