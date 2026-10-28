// The browser's side of installing the site (SPEC-site, Views: Install offer and Installed app; Saved views): the
// install prompt that the browser offers and the site saves, whether the site runs as the installed app, and the
// installed app's request for persistent storage. The app bar's "Install app" reads it, and so will the phone's install
// sheet (task S36).
import { createIsomorphicFn } from "@tanstack/react-start";
import { useSyncExternalStore } from "react";

/**
 * The event that Chromium fires when it can install the site
 * (https://wicg.github.io/manifest-incubations/#beforeinstallpromptevent-interface). TypeScript's DOM library lacks
 * it: it is a draft that only Chromium ships.
 */
interface BeforeInstallPromptEvent extends Event {
  /** Shows the browser's install dialog. The browser serves one call per event. */
  prompt(): Promise<unknown>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

/** What the install offer shows from. */
export type InstallOffer = {
  /** True while the site runs as the installed app, in its own window. */
  runsAsApp: boolean;
  /** Shows the browser's install dialog, from the prompt the site saved; null while the browser offers no install. */
  install: (() => Promise<unknown>) | null;
};

/** The media query that matches in the installed app's own window, the manifest's display (src/site/build.ts). */
const APP_DISPLAY = "(display-mode: standalone)";

/** No offer, in no app: the state before the browser offers anything, and the prerender's. */
const NO_OFFER: InstallOffer = { runsAsApp: false, install: null };

let offer = NO_OFFER;
let started = false;
const listeners = new Set<() => void>();

function update(change: Partial<InstallOffer>): void {
  offer = { ...offer, ...change };
  for (const listener of listeners) listener();
}

/**
 * Asks the browser to keep the site's storage, the saved views among it, when the device runs short of space (SPEC-site,
 * Saved views). Chrome answers without asking the visitor, and an installed app is among the sites it grants
 * (https://web.dev/articles/persistent-storage). The answer changes nothing the site shows, so a refusal stays a
 * refusal. navigator.storage exists only in a secure context.
 */
function askForPersistentStorage(): void {
  void navigator.storage?.persist().catch(() => false);
}

/**
 * Starts the install offer in the browser; on the server it does nothing. TanStack Start's compiler keeps only the
 * client function in the browser's bundle and puts an empty one in the server's
 * (https://tanstack.com/start/latest/docs/framework/react/guide/execution-model). The root route calls it when its
 * module runs, in the entry script, before React hydrates the page: Chromium fires beforeinstallprompt once per page,
 * maybe before any effect would run.
 */
export const startInstallOffer = createIsomorphicFn().client(() => {
  if (started) return; // a second run of the module, such as a hot update in `bun run dev`
  started = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    // The site offers the install itself. Without this, Chrome on a phone shows its own install banner at once.
    event.preventDefault();
    update({
      install: () => {
        update({ install: null }); // the event's one prompt is used
        return event.prompt();
      },
    });
  });
  window.addEventListener("appinstalled", () => update({ install: null }));

  // Chrome can move an open tab into the app's own window when the site is installed, so the display mode can change
  // while the page stays open.
  const appDisplay = window.matchMedia(APP_DISPLAY);
  let askedForStorage = false;
  const followDisplay = () => {
    update({ runsAsApp: appDisplay.matches });
    if (appDisplay.matches && !askedForStorage) {
      askedForStorage = true;
      askForPersistentStorage();
    }
  };
  appDisplay.addEventListener("change", followDisplay);
  followDisplay();
});

/** The install offer as it stands, for a component. The prerender and the first render in the browser get no offer. */
export function useInstallOffer(): InstallOffer {
  return useSyncExternalStore(subscribe, () => offer, () => NO_OFFER);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
