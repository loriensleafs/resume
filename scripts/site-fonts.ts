// `bun run scripts/site-fonts.ts [path/to/GoogleSansFlex-VF-5.000.ttf]`: cuts the site's font into public/fonts/
// (SPEC-site, Tech Stack: Google Sans Flex served from the site itself, a Latin subset of the variable font).
//
// The cut is one WOFF file. It keeps the weight axis from 400 to 700 and pins every other axis at its default. That is
// the font Google Fonts serves for the design system's own request, `family=Google+Sans+Flex:wght@400..700` (its
// Typeface page, 0.3.3): Google pins each axis a request does not name. So the site draws text as the design system
// and the mockups do, with no request to Google. The build copies public/fonts/ into the site and downloads nothing
// (SPEC-deploy, Documents), so commit what this script writes.
//
// The cutter is HarfBuzz's subsetter, compiled to WebAssembly in the harfbuzzjs package, as in the content module's
// scripts/make-fonts.ts, which cuts the documents' fonts; this script leaves that script and fonts/ unchanged.
// The format is WOFF, the format of the wording draft for Peter's one review (decision record row 153). The draft,
// docs/design/wording-drafts/S7.md, compares it with WOFF2.
//
// Usage:
//   bun run scripts/site-fonts.ts                   downloads the variable font to GoogleSansFlex-VF-5.000.ttf if missing
//   bun run scripts/site-fonts.ts <variable font>   cuts that file; it must be the version below

const REPO = `${import.meta.dir}/..`;

/**
 * The variable font: Google Sans Flex 5.000 in google/fonts at a fixed commit, with its SHA-256. The script cuts only
 * this file, so a new cut reproduces the committed one. `bun run fonts` downloads the same font from google/fonts'
 * main branch, where version 5.000 landed on 2026-10-09, and keeps it as GoogleSansFlex-VF.ttf.
 */
const SOURCE = {
  url: "https://raw.githubusercontent.com/google/fonts/bd8f81ddb5c74d5c8897b36ad88b440266245103/ofl/googlesansflex/GoogleSansFlex%5BROND%2Copsz%2Cslnt%2Cwdth%2Cwght%5D.ttf",
  sha256: "a9ac770798857d5e8ac593ced42b22e40a7c08cec98319f92b0eccc2783a77ba",
  // In the repository's root, where git ignores it. The name carries the version, so this pinned copy and the
  // unpinned copy of `bun run fonts` never share a file, and neither script cuts the other's download.
  path: "GoogleSansFlex-VF-5.000.ttf",
};

/**
 * The cut file, in the repository. The site's @font-face rule (src/site/styles/fonts.css) names it at its address,
 * /fonts/google-sans-flex-latin.woff. Its license, OFL.txt, is committed beside it.
 */
const OUTPUT = "public/fonts/google-sans-flex-latin.woff";

/**
 * Google Fonts' "latin" subset: the unicode-range of the latin rule that Google serves for the design system's request.
 * Every character the pages print is in it (seam 1 checks the built pages against the cut font).
 */
const LATIN: [first: number, last: number][] = [
  [0x0000, 0x00ff],
  [0x0131, 0x0131],
  [0x0152, 0x0153],
  [0x02bb, 0x02bc],
  [0x02c6, 0x02c6],
  [0x02da, 0x02da],
  [0x02dc, 0x02dc],
  [0x0304, 0x0304],
  [0x0308, 0x0308],
  [0x0329, 0x0329],
  [0x2000, 0x206f],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2191, 0x2191],
  [0x2193, 0x2193],
  [0x2212, 0x2212],
  [0x2215, 0x2215],
  [0xfeff, 0xfeff],
  [0xfffd, 0xfffd],
];

/** The weight axis keeps the design system's weights, 400 to 700 (its Typeface page). */
const WEIGHT = { min: 400, max: 700, default: 400 };
/**
 * Every other axis, pinned at its default in the font's fvar table. Google Fonts pins them there too: optical size 18
 * is also its registry default for this family (METADATA.pb), and its rule says font-stretch 100%. A check on
 * 2026-10-27 shaped every character of Google's static 400 and 700 files and of this font at these values: no advance
 * differed. At optical size 14, 503 of 540 did.
 */
const PINNED = { opsz: 18, wdth: 100, slnt: 0, ROND: 0 };

// The HarfBuzz functions this script calls. harfbuzz-subset.wasm exports them as raw C functions, which take and
// return numbers (pointers, sizes, flags, floats); harfbuzzjs's typed API has no subsetting.
const HB_FUNCTIONS = [
  "malloc",
  "free",
  "hb_blob_create",
  "hb_blob_destroy",
  "hb_blob_get_data",
  "hb_blob_get_length",
  "hb_face_create",
  "hb_face_destroy",
  "hb_face_reference_blob",
  "hb_set_add",
  "hb_set_clear",
  "hb_set_invert",
  "hb_subset_input_create_or_fail",
  "hb_subset_input_destroy",
  "hb_subset_input_get_flags",
  "hb_subset_input_pin_axis_location",
  "hb_subset_input_set",
  "hb_subset_input_set_axis_range",
  "hb_subset_input_set_flags",
  "hb_subset_input_unicode_set",
  "hb_subset_or_fail",
] as const;
type Hb = Record<(typeof HB_FUNCTIONS)[number], (...args: number[]) => number> & { memory: WebAssembly.Memory };

const isHarfBuzz = (exports: WebAssembly.Exports): exports is WebAssembly.Exports & Hb =>
  exports.memory instanceof WebAssembly.Memory && HB_FUNCTIONS.every((name) => typeof exports[name] === "function");

// From hb-subset.h of HarfBuzz 15.0.0, the version in harfbuzzjs 1.6.4.
const SETS_NAME_ID = 4;
const SETS_LAYOUT_FEATURE_TAG = 6;
const FLAG_NOTDEF_OUTLINE = 0x40;

const tag = (s: string) =>
  ((s.charCodeAt(0) << 24) | (s.charCodeAt(1) << 16) | (s.charCodeAt(2) << 8) | s.charCodeAt(3)) >>> 0;

async function loadHarfBuzz(): Promise<Hb> {
  const wasmPath = Bun.resolveSync("harfbuzzjs/dist/harfbuzz-subset.wasm", import.meta.dir);
  const { instance } = await WebAssembly.instantiate(await Bun.file(wasmPath).arrayBuffer());
  if (!isHarfBuzz(instance.exports)) throw new Error(`${wasmPath} lacks a HarfBuzz function that this script calls`);
  return instance.exports;
}

/** The Latin subset of the variable font, weight 400 to 700, every other axis pinned, as a TrueType (sfnt) file. */
function cutLatin(hb: Hb, source: Uint8Array): Uint8Array<ArrayBuffer> {
  const ptr = hb.malloc(source.byteLength);
  new Uint8Array(hb.memory.buffer, ptr, source.byteLength).set(source);
  const blob = hb.hb_blob_create(ptr, source.byteLength, 2 /* HB_MEMORY_MODE_WRITABLE */, 0, 0);
  const face = hb.hb_face_create(blob, 0);
  hb.hb_blob_destroy(blob);

  const input = hb.hb_subset_input_create_or_fail();
  const unicodes = hb.hb_subset_input_unicode_set(input);
  for (const [first, last] of LATIN) for (let cp = first; cp <= last; cp++) hb.hb_set_add(unicodes, cp);

  // Keep every OpenType feature (HarfBuzz's default list drops tnum, which the tokens turn on for all text) and every
  // name record, the copyright and the license among them. An inverted empty set means "all".
  for (const which of [SETS_LAYOUT_FEATURE_TAG, SETS_NAME_ID]) {
    const set = hb.hb_subset_input_set(input, which);
    hb.hb_set_clear(set);
    hb.hb_set_invert(set);
  }
  // No IUP optimization (HB_SUBSET_FLAGS_OPTIMIZE_IUP_DELTAS): it saves 1.4 KB, but moves points of 108 of the 226
  // glyphs at weight 700 by 1 unit away from Google's own instance; without it, 1 glyph differs (2026-10-27).
  hb.hb_subset_input_set_flags(input, hb.hb_subset_input_get_flags(input) | FLAG_NOTDEF_OUTLINE);

  for (const [axis, value] of Object.entries(PINNED)) {
    if (!hb.hb_subset_input_pin_axis_location(input, face, tag(axis), value)) {
      throw new Error(`site-fonts: could not pin the axis ${axis} at ${value}`);
    }
  }
  if (!hb.hb_subset_input_set_axis_range(input, face, tag("wght"), WEIGHT.min, WEIGHT.max, WEIGHT.default)) {
    throw new Error(`site-fonts: could not keep the axis wght from ${WEIGHT.min} to ${WEIGHT.max}`);
  }

  const subset = hb.hb_subset_or_fail(face, input);
  hb.hb_subset_input_destroy(input);
  if (!subset) throw new Error("site-fonts: HarfBuzz could not cut the subset");

  const outBlob = hb.hb_face_reference_blob(subset);
  const length = hb.hb_blob_get_length(outBlob);
  const dataPtr = hb.hb_blob_get_data(outBlob, 0);
  const out = new Uint8Array(hb.memory.buffer, dataPtr, length).slice();

  hb.hb_blob_destroy(outBlob);
  hb.hb_face_destroy(subset);
  hb.hb_face_destroy(face);
  hb.free(ptr);
  return out;
}

/** The zlib format (RFC 1950) of the data, which WOFF needs. */
async function zlibCompress(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  // The web's CompressionStream writes it as "deflate". Bun.deflateSync writes raw deflate only: Bun 1.4.4 ignores
  // the windowBits option that its own types document for a zlib header and footer (seen 2026-10-27).
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const padded = (length: number) => (length + 3) & ~3;

/**
 * The sfnt file as WOFF 1.0 (https://www.w3.org/TR/WOFF/): a 44-byte header, a 20-byte entry per table in ascending tag
 * order, then the tables in the sfnt's own order, each compressed when that makes it smaller and padded with zeros to a
 * 4-byte boundary, the last one too. No metadata block, no private block.
 */
async function toWoff(sfnt: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);
  const numTables = view.getUint16(4);
  const tables: { tag: number; checksum: number; sfntOffset: number; data: Uint8Array; stored: Uint8Array }[] = [];
  for (let i = 0; i < numTables; i++) {
    const record = 12 + i * 16;
    const sfntOffset = view.getUint32(record + 8);
    const data = sfnt.subarray(sfntOffset, sfntOffset + view.getUint32(record + 12));
    const compressed = await zlibCompress(data);
    tables.push({
      tag: view.getUint32(record),
      checksum: view.getUint32(record + 4),
      sfntOffset,
      data,
      // WOFF stores a table uncompressed when compression does not make it smaller.
      stored: compressed.byteLength < data.byteLength ? compressed : data,
    });
  }
  const headerSize = 44 + 20 * numTables;
  // The tables keep the sfnt's order; each one's offset in the WOFF file follows from it.
  const woffOffsets = new Map<number, number>();
  let end = headerSize;
  for (const table of tables.toSorted((a, b) => a.sfntOffset - b.sfntOffset)) {
    woffOffsets.set(table.tag, end);
    end = padded(end + table.stored.byteLength);
  }

  const woff = new Uint8Array(end);
  const out = new DataView(woff.buffer);
  const head = tables.find((table) => table.tag === tag("head"));
  if (!head) throw new Error("site-fonts: the cut font has no head table");
  const headView = new DataView(head.data.buffer, head.data.byteOffset, head.data.byteLength);

  out.setUint32(0, tag("wOFF"));
  out.setUint32(4, view.getUint32(0)); // the sfnt's flavor: 0x00010000 for TrueType outlines
  out.setUint32(8, woff.byteLength);
  out.setUint16(12, numTables);
  // The size of the sfnt that a browser rebuilds: its header, its directory and each table padded to 4 bytes.
  out.setUint32(16, tables.reduce((size, table) => size + padded(table.data.byteLength), 12 + 16 * numTables));
  // The WOFF version is the font's revision (head.fontRevision), as fontTools writes it.
  out.setUint16(20, headView.getUint16(4));
  out.setUint16(22, headView.getUint16(6));
  // The reserved field, metaOffset, metaLength, metaOrigLength, privOffset and privLength stay 0.

  tables
    .toSorted((a, b) => a.tag - b.tag)
    .forEach((table, i) => {
      const entry = 44 + i * 20;
      const offset = woffOffsets.get(table.tag)!;
      out.setUint32(entry, table.tag);
      out.setUint32(entry + 4, offset);
      out.setUint32(entry + 8, table.stored.byteLength);
      out.setUint32(entry + 12, table.data.byteLength);
      out.setUint32(entry + 16, table.checksum);
      woff.set(table.stored, offset);
    });
  return woff;
}

/** The variable font at the path given, or the repository's copy, downloaded when it is missing; checked by SHA-256. */
async function readSource(given: string | undefined): Promise<Uint8Array> {
  const path = given ?? `${REPO}/${SOURCE.path}`;
  if (!(await Bun.file(path).exists())) {
    if (given !== undefined) throw new Error(`site-fonts: no file at ${path}`);
    console.log(`Downloading the Google Sans Flex variable font to ${SOURCE.path}`);
    const response = await fetch(SOURCE.url);
    if (!response.ok) throw new Error(`site-fonts: the download failed with status ${response.status}`);
    await Bun.write(path, response);
  }
  // A new BunFile: one made before the download reads the file as empty after it (Bun 1.4.4, seen 2026-10-27).
  const bytes = await Bun.file(path).bytes();
  const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  if (sha256 !== SOURCE.sha256) {
    throw new Error(
      `site-fonts: ${path} is not Google Sans Flex 5.000 (its SHA-256 is ${sha256}). ` +
        `Delete it so that the script downloads ${SOURCE.url}, or pass that file.`,
    );
  }
  return bytes;
}

const source = await readSource(Bun.argv[2]);
const sfnt = cutLatin(await loadHarfBuzz(), source);
const woff = await toWoff(sfnt);
await Bun.write(`${REPO}/${OUTPUT}`, woff);
console.log(`${OUTPUT}: ${woff.byteLength} bytes (${sfnt.byteLength} bytes as TrueType)`);
