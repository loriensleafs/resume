import { Tooltip } from "@acmelabs/design-system-react/components/tooltip";
import type { SiteTimeline, TimelineSpan } from "../site-data";
// Each span's and year label's place on the year axis: a class in the stylesheet the build writes from resume.yaml
// (careerTimeline() in src/site/site-data.ts), because a page may hold no style attribute (SPEC-deploy, Headers).
import "virtual:career-timeline.css";

/**
 * A span's accessible name: the full employer name and the years (SPEC-site, Views: Names), "Jack Morton Worldwide,
 * 2016 – 2017". When the employer name does not hold the span's visible label outside parentheses, the name starts with
 * the label, so it holds what the span shows (WCAG 2.2, 2.5.3 Label in Name): "HBS, Harvard Business School,
 * 2015 – 2016". Text in parentheses does not count, as axe-core reads the criterion (4.14, after ACT rule 2ee8b8).
 */
function spanName({ name, short, years }: TimelineSpan): string {
  const holdsLabel = name.replace(/\([^()]*\)/g, "").includes(short);
  return `${holdsLabel ? name : `${short}, ${name}`}, ${years}`;
}

/**
 * The career timeline band (SPEC-site, Views: Career timeline band), as the first-view and career-timeline-states
 * boards draw it: full width under the app bar, headed "Career timeline", with every role and earlier role as a span at
 * its true length on a year axis, earliest first. A gap between roles shows as space. Each span is a real button with
 * the role's short label; acme-tooltip shows the full employer name, then the title and the years, on hover or focus,
 * and gives that text to the button as its description.
 */
export function CareerTimeline({ timeline }: { timeline: SiteTimeline }) {
  return (
    <div role="group" aria-labelledby="career-timeline-heading" className="career-timeline">
      <div className="career-timeline-header">
        <h2 id="career-timeline-heading" className="text-label-13 career-timeline-heading">
          Career timeline
        </h2>
        {/* Decision record row 50: the instruction stays; the stylesheet shows it on wide screens only. */}
        <p className="text-label-12 career-timeline-hint">Select a role to read it and scope the chat</p>
      </div>
      <div className="career-timeline-scroller">
        <div className="career-timeline-track">
          <ul className="career-timeline-spans">
            {timeline.spans.map((span) => (
              <li key={span.id} className={`career-timeline-span ${span.className}`}>
                <Tooltip>
                  <button type="button" className="career-timeline-button" aria-label={spanName(span)}>
                    <span className="text-label-12 career-timeline-label">{span.short}</span>
                    <span className="career-timeline-bar" />
                  </button>
                  {/* Two elements, so the tooltip shows two lines and its description reads "<name> <title>, <years>". */}
                  <span slot="content" className="text-label-13 career-timeline-tooltip-name">
                    {span.name}
                  </span>
                  <span slot="content" className="text-label-12 career-timeline-tooltip-line">
                    {`${span.position}, ${span.years}`}
                  </span>
                </Tooltip>
              </li>
            ))}
          </ul>
          {/* Each button's name holds its years, so the axis's labels are for the eye only. */}
          <div className="career-timeline-axis" aria-hidden="true">
            {timeline.yearLabels.map(({ year, className }) => (
              <span key={year} className={`career-timeline-year ${className}`}>
                {year}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
