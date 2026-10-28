// The sizes of the site's icon files, as seam 1 reads them (SPEC-site, Views: App icon; Testing 1): the share image, the
// icons in public/icons/ and the icons the web manifest lists.

/** The PNG signature, the first 8 bytes of every PNG file (https://www.w3.org/TR/png-3/#5PNG-file-signature). */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * The width and height of a PNG image, from its IHDR chunk, which comes first, right after the signature
 * (https://www.w3.org/TR/png-3/#11IHDR). It throws for any other file.
 */
export function pngSize(png: Uint8Array): { width: number; height: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const isPng = PNG_SIGNATURE.every((byte, i) => png[i] === byte);
  if (!isPng || new TextDecoder().decode(png.subarray(12, 16)) !== "IHDR") throw new Error("not a PNG file");
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/**
 * The size of each square image in an icon file: a PNG file holds one; an ICO file holds the PNG images its directory
 * lists. An ICO file is a 6-byte header (0, type 1, the image count), then one 16-byte entry per image: its width and
 * height (0 means 256), its byte length and its offset
 * (https://learn.microsoft.com/en-us/previous-versions/ms997538(v=msdn.10); a PNG image inside an ICO file:
 * https://devblogs.microsoft.com/oldnewthing/20101022-00/?p=12473). It throws when an image is not square, or when an
 * entry's size is not its PNG's.
 */
export function iconSizes(file: Uint8Array): number[] {
  const square = ({ width, height }: { width: number; height: number }) => {
    if (width !== height) throw new Error(`an image is ${width} × ${height} px, not square`);
    return width;
  };
  if (PNG_SIGNATURE.every((byte, i) => file[i] === byte)) return [square(pngSize(file))];
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== 1) throw new Error("neither a PNG nor an ICO file");
  return Array.from({ length: view.getUint16(4, true) }, (_, i) => {
    const entry = 6 + 16 * i;
    const listed = square({ width: view.getUint8(entry) || 256, height: view.getUint8(entry + 1) || 256 });
    const start = view.getUint32(entry + 12, true);
    const size = square(pngSize(file.subarray(start, start + view.getUint32(entry + 8, true))));
    if (size !== listed) throw new Error(`image ${i + 1} is listed at ${listed} px, but its PNG is ${size} px`);
    return size;
  });
}
