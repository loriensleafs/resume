import { type DetailedHTMLProps, type HTMLAttributes, useEffect } from "react";
import type { SiteTimeline, TimelineSpan } from "../site-data";
// Each span's and year label's place on the year axis: a class in the stylesheet the build writes from resume.yaml
// (careerTimeline() in src/site/site-data.ts), because a page may hold no style attribute (SPEC-deploy, Headers).
import "virtual:career-timeline.css";

// The band renders acme-tooltip as its plain tag, not through the design system's Tooltip wrapper: the wrapper's
// module imports the part's definition, about 54 KB gzip-compressed of overlay code, and the JavaScript that / loads
// before any interaction stays under 200 KB (SPEC-site, Acceptance criteria). The band sets no property of the part
// and listens to none of its events, so the tag and its light-DOM children are all the wrapper would render. React 19
// renders a custom element's tag as it renders any HTML tag; this declaration lets TypeScript accept it.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "acme-tooltip": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

/**
 * The first interactions with the page, anywhere on it. The first of them loads acme-tooltip's definition. A keyboard
 * user's first Tab reaches the app bar before any span, and a pointer crosses the page before it reaches a span, so the
 * load starts before a span gets focus or hover. Until it ends (about 30 ms from the local preview, about 1.3 s on a
 * slow 4G network, measured on 2026-10-27), a span has its name but no tooltip and no description.
 */
const FIRST_INTERACTIONS = ["pointerdown", "pointerover", "keydown", "focusin"] as const;

/** The one load of acme-tooltip's definition, from the first interaction on. */
let tooltipDefinition: Promise<void> | undefined;

function defineTooltip(): void {
  // The design system's own definition module, which the Tooltip wrapper imports (@acmelabs/design-system 0.3.3,
  // "./define/tooltip"). Without it the band still names each span; only the tooltip and the description are missing.
  tooltipDefinition ??= import("@acmelabs/design-system/define/tooltip").then(
    () => undefined,
    (error: unknown) => console.error("The career timeline's tooltips did not load:", error),
  );
}

/** Loads acme-tooltip's definition on the first interaction with the page, while the band is on it. */
function useTooltipOnFirstInteraction(): void {
  useEffect(() => {
    if (tooltipDefinition) return;
    const listening = new AbortController();
    const start = () => {
      listening.abort();
      defineTooltip();
    };
    for (const type of FIRST_INTERACTIONS) {
      document.addEventListener(type, start, { capture: true, passive: true, signal: listening.signal });
    }
    return () => listening.abort();
  }, []);
}

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
  useTooltipOnFirstInteraction();
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
                <acme-tooltip>
                  <button type="button" className="career-timeline-button" aria-label={spanName(span)}>
                    <span className="text-label-12 career-timeline-label">{span.short}</span>
                    <span className="career-timeline-bar" />
                  </button>
                  {/* Two elements, so the tooltip shows two lines and its description reads "<name> <title>, <years>". */}
                  <span slot="content" className="text-label-13 career-timeline-tooltip-name">
                    {span.name}
                  </span>
                  <span slot="content" className="text-label-12 career-timeline-tooltip-line">
                    {`${span.title}, ${span.years}`}
                  </span>
                </acme-tooltip>
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
