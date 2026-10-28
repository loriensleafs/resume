// `bun run icons`: renders the app icon and the favicon with Google Chrome into public/icons/ (SPEC-site, Views: App
// icon). Commit the files in the same commit as the change that made them: Vercel's build has no Chrome, and Bun's
// image API reads no SVG, so the build copies the committed files. Vite copies public/ into the static folder, so the
// site serves them at /icons/.
//
//   bun run icons                  renders with Google Chrome at its default place on this system
//   CHROME_PATH=<file> bun run icons   renders with the Chrome at <file>
//
// The drawing is the approved app-icon board's (docs/design/mockups/app-icon-light.png; its board source is
// prototypes/site-mockups/boards/AppIcons.dc.html on the branch prototype/site-mockups). On a square of 512 units:
// "PK" in Google Sans Flex at weight 700, 220 units, letter spacing -6, white, centred on (256, 262), on the site's
// blue, --ds-blue-700, in the light appearance. The rounded square clips the square with a corner radius of 112 units.
//
// The page loads nothing from a network: the design system's token stylesheet, the site's own @font-face rules and
// its committed font file come from this checkout. The script stops when the letters are not in the committed font,
// when a request leaves the checkout, or when the maskable icon's letters leave its safe zone.

import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";

const REPO = resolve(import.meta.dir, "..");
const OUT = join(REPO, "public/icons");

/** One image of an icon file: its width and height in px, and whether the rounded square clips it. */
type Image = { size: number; rounded: boolean };

/** Each file the script writes into public/icons/, with the images it holds, in the order the file lists them. */
const ICONS: { file: string; images: Image[] }[] = [
  // The installed app's icon, as the board draws it ("Rounded square, 192 px").
  { file: "icon-192.png", images: [{ size: 192, rounded: true }] },
  // The same at 512 px, which is also the share image of / and /resume (decision record row 173).
  { file: "icon-512.png", images: [{ size: 512, rounded: true }] },
  // The maskable version fills the whole square: the platform cuts its own shape, as the board's "Circle, as Android
  // cuts it" shows, and the manifest specification suggests no transparent pixels in a maskable icon
  // (https://www.w3.org/TR/appmanifest/#icon-masks).
  { file: "icon-maskable-512.png", images: [{ size: 512, rounded: false }] },
  // The favicon: the board's three small sizes in one ICO file, the favicon format that every browser reads.
  { file: "favicon.ico", images: [16, 32, 48].map((size) => ({ size, rounded: true })) },
];

/**
 * The page's address. Nothing answers there: the page's route answers each request from this checkout, and the
 * reserved top-level domain .invalid never resolves (RFC 2606), so a request the route does not answer fails.
 */
const ORIGIN = "https://icons.invalid";

/** The checkout's files that the page loads, by their path on the page's address. */
const FILES: Record<string, string> = {
  // The same token stylesheet that the site imports (src/site/styles/tokens.css).
  "/tokens.css": fileURLToPath(import.meta.resolve("@acmelabs/design-system/styles/tokens.css")),
  // The site's own @font-face rules, which name the committed font files at /fonts/ (task S7).
  "/fonts.css": join(REPO, "src/site/styles/fonts.css"),
  "/fonts/google-sans-flex-latin.woff": join(REPO, "public/fonts/google-sans-flex-latin.woff"),
};

/** The page that draws one image, as the board's SVG draws it. */
function iconPage({ size, rounded }: Image): string {
  return `<!doctype html>
<html lang="en" data-acme-appearance="light">
<head>
<meta charset="utf-8">
<title>PK</title>
<link rel="stylesheet" href="/tokens.css">
<link rel="stylesheet" href="/fonts.css">
<style>
  /* The token stylesheet gives html and body the page's background; the image keeps only its own pixels. */
  html, body { margin: 0; background: none; }
  svg { display: block; }
  .ground { fill: var(--ds-blue-700); }
  .letters { fill: #fff; font-family: var(--acme-font-sans); font-weight: 700; font-size: 220px; letter-spacing: -6px; }
</style>
</head>
<body>
<svg width="${size}" height="${size}" viewBox="0 0 512 512">
  <clipPath id="rounded-square"><rect width="512" height="512" rx="112"/></clipPath>
  <g${rounded ? ' clip-path="url(#rounded-square)"' : ""}>
    <rect class="ground" width="512" height="512"/>
    <text class="letters" x="256" y="262" text-anchor="middle" dominant-baseline="central">PK</text>
  </g>
</svg>
</body>
</html>`;
}

/**
 * Google Chrome at CHROME_PATH, or at Chrome's default place on this system (Playwright's "chrome" channel), as the
 * site's browser test finds it. The script never downloads a browser.
 */
function chrome() {
  const path = Bun.env.CHROME_PATH;
  return path ? { executablePath: path } : { channel: "chrome" };
}

/**
 * Checks that Chrome drew the letters with the committed font, not a fallback: Chrome's own record of the fonts that
 * drew a node's text (the DevTools protocol's CSS.getPlatformFontsForNode). A fallback font, or a Google Sans Flex
 * installed on this computer, would be no web font.
 */
async function checkLettersFont(page: Page): Promise<void> {
  const devTools = await page.context().newCDPSession(page);
  await devTools.send("DOM.enable");
  await devTools.send("CSS.enable");
  const { root } = await devTools.send("DOM.getDocument");
  const { nodeId } = await devTools.send("DOM.querySelector", { nodeId: root.nodeId, selector: ".letters" });
  const { fonts } = await devTools.send("CSS.getPlatformFontsForNode", { nodeId });
  await devTools.detach();
  const drawn = fonts.map(({ familyName, isCustomFont, glyphCount }) => ({ familyName, isCustomFont, glyphCount }));
  const expected = [{ familyName: "Google Sans Flex", isCustomFont: true, glyphCount: 2 }];
  if (JSON.stringify(drawn) !== JSON.stringify(expected)) {
    throw new Error(`Chrome drew "PK" with ${JSON.stringify(drawn)}, not the committed Google Sans Flex file`);
  }
}

/** The color Chrome gives the icon's ground, --ds-blue-700 in the light appearance, as CSS writes it ("rgb(…)"). */
async function groundColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const token = getComputedStyle(document.documentElement).getPropertyValue("--ds-blue-700").trim();
    if (!token) throw new Error("the design system's token stylesheet sets no --ds-blue-700");
    return getComputedStyle(document.querySelector(".ground")!).fill;
  });
}

/** Renders one image to a PNG file's bytes, with transparent pixels outside the rounded square. */
async function render(page: Page, image: Image): Promise<{ png: Uint8Array; color: string }> {
  await page.setViewportSize({ width: image.size, height: image.size });
  await page.goto(`${ORIGIN}/${image.size}-${image.rounded ? "rounded" : "full"}.html`);
  // The letters show in a fallback font until the font file loads (font-display: swap), so wait for every load.
  await page.evaluate(() => document.fonts.ready);
  await checkLettersFont(page);
  const png = await page.screenshot({
    type: "png",
    omitBackground: true,
    clip: { x: 0, y: 0, width: image.size, height: image.size },
    scale: "css",
  });
  return { png, color: await groundColor(page) };
}

/**
 * How far the letters reach from the image's centre, in px: the farthest corner of any pixel whose color is not the
 * ground's (the corner pixel's). Edge pixels with any letter coverage count, so the measure errs outwards. Chrome
 * decodes the PNG with no color conversion, so the values are the file's own.
 */
async function lettersReach(page: Page, png: Uint8Array): Promise<number> {
  return page.evaluate(async (base64) => {
    const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
    const bitmap = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
    const { width, height } = bitmap;
    const context = new OffscreenCanvas(width, height).getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, width, height);
    const isGround = (at: number) => [0, 1, 2, 3].every((channel) => data[at + channel] === data[channel]);
    const [centreX, centreY] = [width / 2, height / 2];
    let reach = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (isGround((y * width + x) * 4)) continue;
        const dx = Math.max(Math.abs(x - centreX), Math.abs(x + 1 - centreX));
        const dy = Math.max(Math.abs(y - centreY), Math.abs(y + 1 - centreY));
        reach = Math.max(reach, Math.hypot(dx, dy));
      }
    }
    return reach;
  }, Buffer.from(png).toString("base64"));
}

/**
 * An ICO file that holds PNG images: a 6-byte header (0, type 1 for an icon, the image count), one 16-byte entry per
 * image (its width and height, where 0 means 256; no palette; 1 color plane; 32 bits per pixel; its byte length; its
 * offset in the file), then the images (https://learn.microsoft.com/en-us/previous-versions/ms997538(v=msdn.10)).
 * Each image is a whole PNG file in 32-bit RGBA, with no mask: the alpha channel gives it
 * (https://devblogs.microsoft.com/oldnewthing/20101022-00/?p=12473).
 */
function icoFile(images: { size: number; png: Uint8Array }[]): Uint8Array {
  for (const { size, png } of images) {
    // The IHDR chunk's bit depth and color type, at bytes 24 and 25: 8 and 6 are 8-bit RGBA
    // (https://www.w3.org/TR/png-3/#11IHDR).
    if (png[24] !== 8 || png[25] !== 6) throw new Error(`the ${size} px favicon image is not 32-bit RGBA`);
  }
  const headerLength = 6 + 16 * images.length;
  const file = new Uint8Array(headerLength + images.reduce((length, { png }) => length + png.byteLength, 0));
  const view = new DataView(file.buffer);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);
  let offset = headerLength;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    view.setUint8(entry, size % 256);
    view.setUint8(entry + 1, size % 256);
    view.setUint16(entry + 4, 1, true);
    view.setUint16(entry + 6, 32, true);
    view.setUint32(entry + 8, png.byteLength, true);
    view.setUint32(entry + 12, offset, true);
    file.set(png, offset);
    offset += png.byteLength;
  });
  return file;
}

// Two Chrome switches keep the files the same from one run to the next, so a run with no change leaves git clean:
// - --force-color-profile=srgb: the PNG holds sRGB values, so Chrome draws in sRGB whatever the display, and the token
//   stylesheet's Display P3 value of --ds-blue-700, which applies only under (color-gamut: p3), stays out. Playwright
//   passes this switch too; it is named here because the icon's color depends on it.
// - --disable-gpu: Chrome draws on the CPU. With the GPU, about one run in six changed one edge pixel of the maskable
//   icon by 1 of 255 (Chrome 156, macOS, 2026-10-27); with it off, 24 runs in a row wrote the same bytes. The
//   content module prints the PDF with the same switch (src/print/chrome.ts).
const browser = await chromium.launch({ ...chrome(), args: ["--force-color-profile=srgb", "--disable-gpu"] });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const strayRequests: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) {
      strayRequests.push(url.href);
      return route.abort();
    }
    if (url.pathname in FILES) return route.fulfill({ path: FILES[url.pathname]! });
    const image = /^\/(\d+)-(rounded|full)\.html$/.exec(url.pathname);
    if (!image) {
      strayRequests.push(url.href);
      return route.abort();
    }
    return route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: iconPage({ size: Number(image[1]), rounded: image[2] === "rounded" }),
    });
  });

  const colors = new Set<string>();
  for (const { file, images } of ICONS) {
    const rendered: { size: number; png: Uint8Array }[] = [];
    for (const image of images) {
      const { png, color } = await render(page, image);
      colors.add(color);
      if (!image.rounded) {
        // The W3C manifest's safe zone: a circle on the centre, with a radius of 2/5 of the icon's size
        // (https://www.w3.org/TR/appmanifest/#icon-masks).
        const reach = await lettersReach(page, png);
        const safeZone = (image.size * 2) / 5;
        const measured = `the letters reach ${reach.toFixed(1)} px from the centre`;
        if (reach > safeZone) throw new Error(`${file}: ${measured}; the safe zone's radius is ${safeZone} px`);
        console.log(`${file}: ${measured}, inside the ${safeZone} px safe zone`);
      }
      rendered.push({ size: image.size, png });
    }
    if (strayRequests.length > 0) {
      throw new Error(`the icon page asked for files outside the checkout: ${strayRequests.join(", ")}`);
    }
    const bytes = file.endsWith(".ico") ? icoFile(rendered) : rendered[0]!.png;
    await Bun.write(join(OUT, file), bytes);
    const sizes = images.map(({ size }) => `${size} px`).join(", ");
    console.log(`public/icons/${file}: ${sizes}; ${bytes.byteLength} bytes`);
  }
  console.log(`Ground: --ds-blue-700 in the light appearance, ${[...colors].join(" and ")}`);
  console.log("Commit public/icons/ in the same commit as the change that made these files.");
} finally {
  await browser.close();
}
