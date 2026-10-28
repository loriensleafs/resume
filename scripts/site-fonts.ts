// `bun run scripts/site-fonts.ts [variable font...]`: cuts the site's fonts into public/fonts/ (SPEC-site, Tech Stack:
// Google Sans Flex and Google Sans Code served from the site itself, a Latin subset of each variable font).
//
// Each cut is one WOFF file. It keeps the weight axis from 400 to 700 and pins every other axis at its default. That is
// the font Google Fonts serves for the design system's own request,
// `family=Google+Sans+Flex:wght@400..700&family=Google+Sans+Code:wght@400..700` (its Typeface page, 0.3.3): Google
// pins each axis a request does not name. So the site draws text in Google Sans Flex, and labels, numbers and code in
// Google Sans Code, as the design system and the mockups do, with no request to Google. The build copies
// public/fonts/ into the site and downloads nothing (SPEC-deploy, Documents), so commit what this script writes.
//
// The cutter is HarfBuzz's subsetter, compiled to WebAssembly in the harfbuzzjs package, as in the content module's
// scripts/make-fonts.ts, which cuts the documents' fonts; this script leaves that script and fonts/ unchanged.
// The format is WOFF, the format of the wording draft for Peter's one review (decision record row 153). The draft,
// docs/design/wording-drafts/S7.md, compares it with WOFF2; both files follow his choice.
//
// Usage:
//   bun run scripts/site-fonts.ts                     downloads each variable font to its path below if missing
//   bun run scripts/site-fonts.ts <variable font>...  cuts each file given, which its SHA-256 matches to a font below;
//                                                     a font with no file given comes from its path, as above

const REPO = `${import.meta.dir}/..`;

type Font = {
  family: string;
  /**
   * The variable font in google/fonts at a fixed commit, with its SHA-256. The script cuts only this file, so a new cut
   * reproduces the committed one. The path is in the repository's root, where git ignores it.
   */
  source: { url: string; sha256: string; path: string };
  /**
   * The cut file, in the repository. The site's @font-face rules (src/site/styles/fonts.css) name it at its address,
   * the same path under /fonts/. Its license, OFL.txt, is committed beside it and holds each font's copyright notice.
   */
  output: string;
  /** Every axis but weight, pinned at its default in the font's fvar table. Google Fonts pins them there too. */
  pinned: Record<string, number>;
};

const FONTS: Font[] = [
  {
    family: "Google Sans Flex",
    // Version 5.000. `bun run fonts` downloads the same font from google/fonts' main branch, where version 5.000 landed
    // on 2026-10-09, and keeps it as GoogleSansFlex-VF.ttf. The name of this pinned copy carries the version, so the
    // two copies never share a file, and neither script cuts the other's download.
    source: {
      url: "https://raw.githubusercontent.com/google/fonts/bd8f81ddb5c74d5c8897b36ad88b440266245103/ofl/googlesansflex/GoogleSansFlex%5BROND%2Copsz%2Cslnt%2Cwdth%2Cwght%5D.ttf",
      sha256: "a9ac770798857d5e8ac593ced42b22e40a7c08cec98319f92b0eccc2783a77ba",
      path: "GoogleSansFlex-VF-5.000.ttf",
    },
    output: "public/fonts/google-sans-flex-latin.woff",
    // Optical size 18 is also Google Fonts' registry default for this family (METADATA.pb), and its rule says
    // font-stretch 100%. A check on 2026-10-27 shaped every character of Google's static 400 and 700 files and of this
    // font at these values: no advance differed. At optical size 14, 503 of 540 did.
    pinned: { opsz: 18, wdth: 100, slnt: 0, ROND: 0 },
  },
  {
    family: "Google Sans Code",
    // Version 6.001, the upright font. It landed in google/fonts on 2025-08-27 and is still the newest there on
    // 2026-10-27. The design system's request names no italic, so the italic file stays out.
    source: {
      url: "https://raw.githubusercontent.com/google/fonts/5be3d1410fd1df6f03a64234dd28ea6fff96f397/ofl/googlesanscode/GoogleSansCode%5Bwght%5D.ttf",
      sha256: "c9649573afcd966f61096b1e9c3c3115e7b54315ca2adf9839c6f8b17d5f8e1f",
      path: "GoogleSansCode-VF-6.001.ttf",
    },
    output: "public/fonts/google-sans-code-latin.woff",
    // Its one axis is weight, from 300 to 800, so no axis is pinned. A check on 2026-10-27 drew every character of this
    // font and of the cut at weights 400 to 700, in steps of 50: no advance differed, and no point moved by more than
    // 0.5 units of 2000 (at weight 400, none moved).
    pinned: {},
  },
];

/**
 * Google Fonts' "latin" subset: the unicode-range of the latin rule that Google serves for the design system's request,
 * the same for both families. Every character the pages print is in it (seam 1 checks the built pages against each
 * cut font).
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

/** The weight axis keeps the design system's weights, 400 to 700 (its Typeface page and its weight tokens). */
const WEIGHT = { min: 400, max: 700, default: 400 };

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

/** The Latin subset of a variable font, weight 400 to 700, every other axis pinned, as a TrueType (sfnt) file. */
function cutLatin(hb: Hb, font: Font, source: Uint8Array): Uint8Array<ArrayBuffer> {
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
  // No IUP optimization (HB_SUBSET_FLAGS_OPTIMIZE_IUP_DELTAS): for Google Sans Flex it saves 1.4 KB, but moves points
  // of 108 of the 226 glyphs at weight 700 by 1 unit away from Google's own instance; without it, 1 glyph differs
  // (2026-10-27).
  hb.hb_subset_input_set_flags(input, hb.hb_subset_input_get_flags(input) | FLAG_NOTDEF_OUTLINE);

  for (const [axis, value] of Object.entries(font.pinned)) {
    if (!hb.hb_subset_input_pin_axis_location(input, face, tag(axis), value)) {
      throw new Error(`site-fonts: could not pin the axis ${axis} of ${font.family} at ${value}`);
    }
  }
  if (!hb.hb_subset_input_set_axis_range(input, face, tag("wght"), WEIGHT.min, WEIGHT.max, WEIGHT.default)) {
    throw new Error(`site-fonts: could not keep the axis wght of ${font.family} from ${WEIGHT.min} to ${WEIGHT.max}`);
  }

  const subset = hb.hb_subset_or_fail(face, input);
  hb.hb_subset_input_destroy(input);
  if (!subset) throw new Error(`site-fonts: HarfBuzz could not cut the subset of ${font.family}`);

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

const sha256Of = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

/**
 * Each font's variable font: a file given on the command line, which its SHA-256 matches to the font, or else the
 * repository's copy at the font's path, downloaded when it is missing and checked by SHA-256.
 */
async function readSources(given: string[]): Promise<Map<Font, Uint8Array>> {
  const sources = new Map<Font, Uint8Array>();
  for (const path of given) {
    if (!(await Bun.file(path).exists())) throw new Error(`site-fonts: no file at ${path}`);
    const bytes = await Bun.file(path).bytes();
    const sha256 = sha256Of(bytes);
    const font = FONTS.find(({ source }) => source.sha256 === sha256);
    if (!font) {
      const expected = FONTS.map(({ source }) => `${source.path} (${source.url})`).join(", ");
      throw new Error(`site-fonts: ${path} is none of the variable fonts this script cuts: ${expected}`);
    }
    sources.set(font, bytes);
  }
  for (const font of FONTS) {
    if (sources.has(font)) continue;
    const path = `${REPO}/${font.source.path}`;
    if (!(await Bun.file(path).exists())) {
      console.log(`Downloading the ${font.family} variable font to ${font.source.path}`);
      const response = await fetch(font.source.url);
      if (!response.ok) {
        throw new Error(`site-fonts: the download of ${font.family} failed with status ${response.status}`);
      }
      await Bun.write(path, response);
    }
    // A new BunFile: one made before the download reads the file as empty after it (Bun 1.4.4, seen 2026-10-27).
    const bytes = await Bun.file(path).bytes();
    const sha256 = sha256Of(bytes);
    if (sha256 !== font.source.sha256) {
      throw new Error(
        `site-fonts: ${path} is not the ${font.family} variable font this script cuts (its SHA-256 is ${sha256}). ` +
          `Delete it so that the script downloads ${font.source.url}, or pass that file.`,
      );
    }
    sources.set(font, bytes);
  }
  return sources;
}

const sources = await readSources(Bun.argv.slice(2));
const hb = await loadHarfBuzz();
for (const font of FONTS) {
  const sfnt = cutLatin(hb, font, sources.get(font)!);
  const woff = await toWoff(sfnt);
  await Bun.write(`${REPO}/${font.output}`, woff);
  console.log(`${font.output}: ${woff.byteLength} bytes (${sfnt.byteLength} bytes as TrueType)`);
}
