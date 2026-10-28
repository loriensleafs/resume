// The design system's wrapper is named AppBar too; this file's component is the site's app bar around it.
import { AppBar as AcmeAppBar } from "@acmelabs/design-system-react/components/app-bar";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type AppBarProps = {
  /** Peter's name, in the blue name box: `basics.name`. */
  name: string;
  /** The headline after the name box: `basics.label`. */
  headline: string;
  /** What the page's route puts in the end slot, such as the chat's New chat on the workspace. */
  end?: ReactNode;
};

/**
 * The app bar that every page opens with (SPEC-site, Views: App bar): the design system's acme-app-bar, as the
 * first-view board draws it. The name box, a link to the workspace, sits in the start slot. The headline is the main
 * header content, in the default slot, whose region the design system lets shrink, so a narrow screen cuts the
 * headline instead of widening the page. The end slot holds what the page's route gives it (the capability map's
 * contract "the app bar's end slot"), so each route decides the slot's content from its own state.
 */
export function AppBar({ name, headline, end }: AppBarProps) {
  return (
    <AcmeAppBar>
      {/* exact: the link is the current page on / only, not on every page under it. */}
      <Link to="/" activeOptions={{ exact: true }} slot="start" className="app-bar-name">
        {name}
      </Link>{" "}
      {/* The space keeps the name and the headline apart in the light DOM, before the part upgrades. */}
      <span className="text-label-14 app-bar-headline">{headline}</span>
      {end !== undefined && (
        <div slot="end" className="app-bar-end">
          {end}
        </div>
      )}
    </AcmeAppBar>
  );
}
