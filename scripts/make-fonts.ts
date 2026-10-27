// Cut Google Sans Flex into the fixed-weight, Latin-only fonts in fonts/.
//
// Chromium embeds a variable font in a PDF as Type 3 glyphs, which some hiring
// software reads poorly. Fixed-weight TrueType files embed cleanly.
//
// Uses HarfBuzz's subsetter (compiled to WebAssembly, from the harfbuzzjs
// package) to pin every variation axis and keep only the characters we use.
//
// Usage:
//   bun install
//   bun run fonts          # downloads the variable font if it is missing
//   bun run scripts/make-fonts.ts path/to/GoogleSansFlex-VF.ttf

const VF_URL =
  "https://raw.githubusercontent.com/google/fonts/main/ofl/googlesansflex/GoogleSansFlex%5BROND,opsz,slnt,wdth,wght%5D.ttf";
const VF_PATH = "GoogleSansFlex-VF.ttf";

// Output file: weight and optical size. Optical size 14 for text reads tighter
// than the "true" 10 at these print sizes; the name uses 30.
const SPECS: Record<string, { wght: number; opsz: number }> = {
  "fonts/gsf-400.ttf": { wght: 400, opsz: 14 }, // body
  "fonts/gsf-450.ttf": { wght: 450, opsz: 13 }, // headline
  "fonts/gsf-520.ttf": { wght: 520, opsz: 14 }, // job titles
  "fonts/gsf-640.ttf": { wght: 640, opsz: 14 }, // companies, section names, labels
  "fonts/gsf-680.ttf": { wght: 680, opsz: 30 }, // name
};
const FIXED_AXES = { wdth: 100, slnt: 0, ROND: 0 };

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);
const UNICODES = [
  ...range(0x20, 0x7f),
  ...range(0xa0, 0x180),
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x2122, 0x2192,
];

// The HarfBuzz functions this script calls. harfbuzz-subset.wasm exports them as raw C functions, which take and
// return numbers (pointers, sizes, flags); harfbuzzjs's typed API has no subsetting.
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
  "hb_subset_input_set_flags",
  "hb_subset_input_unicode_set",
  "hb_subset_or_fail",
] as const;
type Hb = Record<(typeof HB_FUNCTIONS)[number], (...args: number[]) => number> & { memory: WebAssembly.Memory };

const isHarfBuzz = (exports: WebAssembly.Exports): exports is WebAssembly.Exports & Hb =>
  exports.memory instanceof WebAssembly.Memory && HB_FUNCTIONS.every((name) => typeof exports[name] === "function");

// From hb-subset.h.
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

function instanceFont(hb: Hb, source: Uint8Array, axes: Record<string, number>): Uint8Array {
  const ptr = hb.malloc(source.byteLength);
  new Uint8Array(hb.memory.buffer, ptr, source.byteLength).set(source);
  const blob = hb.hb_blob_create(ptr, source.byteLength, 2 /* HB_MEMORY_MODE_WRITABLE */, 0, 0);
  const face = hb.hb_face_create(blob, 0);
  hb.hb_blob_destroy(blob);

  const input = hb.hb_subset_input_create_or_fail();
  const unicodes = hb.hb_subset_input_unicode_set(input);
  for (const cp of UNICODES) hb.hb_set_add(unicodes, cp);

  // Keep every OpenType feature (HarfBuzz's default list drops tnum, which
  // the dates use) and every name record. An inverted empty set means "all".
  for (const which of [SETS_LAYOUT_FEATURE_TAG, SETS_NAME_ID]) {
    const set = hb.hb_subset_input_set(input, which);
    hb.hb_set_clear(set);
    hb.hb_set_invert(set);
  }
  hb.hb_subset_input_set_flags(input, hb.hb_subset_input_get_flags(input) | FLAG_NOTDEF_OUTLINE);

  for (const [axis, value] of Object.entries(axes)) {
    if (!hb.hb_subset_input_pin_axis_location(input, face, tag(axis), value)) {
      throw new Error(`could not pin axis ${axis}=${value}`);
    }
  }

  const subset = hb.hb_subset_or_fail(face, input);
  hb.hb_subset_input_destroy(input);
  if (!subset) throw new Error("subsetting failed");

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

const sourcePath = Bun.argv[2] ?? VF_PATH;
if (!(await Bun.file(sourcePath).exists())) {
  console.log(`Downloading the Google Sans Flex variable font to ${sourcePath}`);
  const res = await fetch(VF_URL);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  await Bun.write(sourcePath, res);
}

const hb = await loadHarfBuzz();
const source = new Uint8Array(await Bun.file(sourcePath).arrayBuffer());
for (const [path, { wght, opsz }] of Object.entries(SPECS)) {
  const bytes = instanceFont(hb, source, { wght, opsz, ...FIXED_AXES });
  await Bun.write(path, bytes);
  console.log(`${path}: weight ${wght}, optical size ${opsz}, ${bytes.byteLength} bytes`);
}
