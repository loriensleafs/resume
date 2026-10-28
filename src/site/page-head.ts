// What each page's head says about the page (SPEC-site, Standalone pages; Testing 1): its title, its description, its
// canonical address, and the Open Graph tags that a share preview shows. A route's head() returns it, and the root
// route's <HeadContent /> writes it into the page:
// https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management

/**
 * The site's one address (decision 0018): pkloss.dev, pwk.dev and www.peterkloss.dev redirect to it. Every page's
 * canonical address is on it, and vite.config.ts gives it to the sitemap, so the two name the same addresses.
 */
export const SITE_ADDRESS = "https://peterkloss.dev";

export type PageHeadOptions = {
  /** The page's clean address on the site, as the sitemap lists it: "/" or "/resume". It holds no query, because
   *  every workspace address, /?role=<id> and /?source=<id> included, shows the one page whose address is /. */
  path: string;
  /** The page's title, which the share preview shows too. */
  title: string;
  /** The page's description, which the share preview shows too: a text from resume.yaml or from an approved source,
   *  never one written in code. */
  description: string;
};

/**
 * The image a share preview shows: the app icon at 512 px, which `bun run icons` renders into public/icons/ (Peter,
 * decision record row 173). The preview loads it from the site's one address, so the tag gives its full address, and
 * its width and height let the preview lay it out before the file arrives (https://ogp.me/#structured).
 */
const SHARE_IMAGE = { path: "/icons/icon-512.png", width: 512, height: 512 };

/** One page's title, description, canonical address and Open Graph tags (https://ogp.me). */
export function pageHead({ path, title, description }: PageHeadOptions) {
  const address = new URL(path, SITE_ADDRESS).href;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: address },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:image", content: new URL(SHARE_IMAGE.path, SITE_ADDRESS).href },
      { property: "og:image:width", content: String(SHARE_IMAGE.width) },
      { property: "og:image:height", content: String(SHARE_IMAGE.height) },
    ],
    links: [{ rel: "canonical", href: address }],
  };
}
