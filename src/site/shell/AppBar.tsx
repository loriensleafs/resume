// The design system's wrapper is named AppBar too; this file's component is the site's app bar around it.
import { AppBar as AcmeAppBar } from "@acmelabs/design-system-react/components/app-bar";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useSyncExternalStore } from "react";
import type { SiteResume } from "../site-data";
import { useInstallOffer } from "../install-offer";
import { InstallAppButton } from "./InstallAppButton";

/** SPEC-site's wide layout, from 1024 px, as layout.css writes it. */
const WIDE_SCREEN = "(width >= 1024px)";

/** The wide-screen query, made at the first use in the browser. */
let wideScreen: MediaQueryList | undefined;
const wideScreenQuery = () => (wideScreen ??= window.matchMedia(WIDE_SCREEN));

function followWideScreen(change: () => void): () => void {
  wideScreenQuery().addEventListener("change", change);
  return () => wideScreenQuery().removeEventListener("change", change);
}

/** True on a wide screen. The prerender knows no width, so it and the first render in the browser get false. */
function useWideScreen(): boolean {
  return useSyncExternalStore(followWideScreen, () => wideScreenQuery().matches, () => false);
}

export type AppBarProps = {
  /** `name`, Peter's name, goes in the blue name box; `label`, the headline, follows it. */
  basics: Pick<SiteResume["basics"], "name" | "label">;
  /** What the page's route puts in the end slot, such as the chat's New chat on the workspace. */
  end?: ReactNode;
};

/**
 * The app bar that every page opens with (SPEC-site, Views: App bar): the design system's acme-app-bar, as the
 * first-view board draws it. The name box, a link to the workspace, sits in the start slot. The headline is the main
 * header content, in the default slot, whose region the design system lets shrink, so a narrow screen cuts the
 * headline instead of widening the page. The end slot holds "Install app" while the browser offers the install, then
 * what the page's route gives it (the capability map's contract "the app bar's end slot"), so each route decides the
 * slot's content from its own state.
 */
export function AppBar({ basics, end }: AppBarProps) {
  // "Install app" shows only while the browser offers the install and the site does not run as an app (Views: Install
  // offer), and on wide screens only: on phones the install sheet offers the app. The prerender knows none of it, so no
  // page holds the button before its scripts run. Below 1024 px the button is left out, not hidden: an end slot with
  // nothing visible in it still takes the bar's gap from the headline, and the design system has no rule that shows a
  // part on wide screens only (its docs server, 0.3.3).
  const { runsAsApp, install } = useInstallOffer();
  const wide = useWideScreen();
  const installApp = install && !runsAsApp && wide ? <InstallAppButton install={install} /> : null;
  // React renders nothing for null, undefined, true or false, so a route can pass `active && <NewChat />`. The end slot
  // then prints no element, as when the route passes no end.
  const hasEnd = end !== null && end !== undefined && typeof end !== "boolean";
  return (
    <AcmeAppBar>
      {/* exact: the link is the current page on / only, not on every page under it. */}
      <Link to="/" activeOptions={{ exact: true }} slot="start" className="app-bar-name">
        {basics.name}
      </Link>{" "}
      {/* The space keeps the name and the headline apart in the light DOM, before the part upgrades. */}
      <span className="text-label-14 app-bar-headline">{basics.label}</span>
      {(installApp || hasEnd) && (
        <div slot="end" className="app-bar-end">
          {installApp}
          {end}
        </div>
      )}
    </AcmeAppBar>
  );
}
