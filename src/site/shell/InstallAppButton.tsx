import { Button } from "@acmelabs/design-system-react/components/button";
import { InstallDesktopIcon } from "@acmelabs/design-system-react/components/install-desktop-icon";
import type { InstallOffer } from "../install-offer";

export type InstallAppButtonProps = {
  /** Shows the browser's install dialog, from the prompt the site saved (src/site/install-offer.ts). */
  install: NonNullable<InstallOffer["install"]>;
};

/**
 * "Install app" in the app bar's end slot (SPEC-site, Views: App bar and Install offer), as the first-view board draws
 * it: a small secondary button, 32 px high, with Chrome's install icon, the Material symbol install_desktop, before its
 * label. The icon has no label of its own, so the design system hides it from screen readers, and the label names the
 * button. The app bar shows it on wide screens only (AppBar.tsx).
 */
export function InstallAppButton({ install }: InstallAppButtonProps) {
  return (
    <Button variant="secondary" size="small" onClick={() => void install()}>
      <InstallDesktopIcon slot="start" />
      Install app
    </Button>
  );
}
