// The device index (glossary): the labels and public text of the resume entries, logistics answers and passages, and
// the approved sources' links, kept on the visitor's device so that device matches work offline (SPEC-chat, "The
// build"; Views, "Citations card" and "Device matches"; Rendering answers).
// This file is the browser's part: the file's shape and name, and loadDeviceIndex(). The build-time part,
// buildDeviceIndex(), is in device-index-build.ts, so the browser's JavaScript never holds the build code.
// - At build time, the chat's Vite plugin (vite-plugin.ts) writes the device index into the static folder.
// - In the browser, loadDeviceIndex() fetches that file once, on demand: when the input first gets focus, or when the
//   column first shows an answer or answer steps (task C36). So the module that calls it imports this one with a
//   dynamic import(), and neither the file nor this module is part of the JavaScript that / loads first. The site's
//   service worker precaches the file, so it loads offline too (task S28).

/** One resume entry, logistics answer or passage, by its knowledge id, with the label and the text a browser shows. */
export type DeviceEntry = { id: string; label: string; text: string };

/** The device index, as device-index.json holds it. */
export type DeviceIndex = {
  /** The resume entries in resume order, then the logistics answers, then each approved source's passages. */
  entries: DeviceEntry[];
  /** The approved sources' links, each once: the https addresses an answer may link to (SPEC-chat, Rendering answers). */
  links: string[];
};

/** The file's name in the static folder, and so its address on the site: /device-index.json. */
export const DEVICE_INDEX_FILE = "device-index.json";

/** The one fetch of the page, while it runs or once it has succeeded. */
let loading: Promise<DeviceIndex> | undefined;

/**
 * The device index, fetched once per page: every call gets the same promise. A failed fetch is forgotten, so the next
 * call tries again, for example once the network is back before the service worker holds the file.
 */
export function loadDeviceIndex(): Promise<DeviceIndex> {
  loading ??= fetchDeviceIndex().catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

async function fetchDeviceIndex(): Promise<DeviceIndex> {
  const address = `/${DEVICE_INDEX_FILE}`;
  const response = await fetch(address);
  if (!response.ok) throw new Error(`${address}: ${response.status} ${response.statusText}`);
  // The build wrote the file from this module's own type (vite-plugin.ts), and the site serves it from its own origin.
  return (await response.json()) as DeviceIndex;
}
