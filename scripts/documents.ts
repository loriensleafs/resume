// `bun run documents`: rebuilds the committed public documents in documents/ when their
// inputs changed. The website serves these files, because Vercel's build has no Chrome
// (SPEC-deploy, Documents).
//
// `docx` and Chrome stamp the build date into every file, so two builds of the same inputs
// differ byte for byte. The inputs hash in documents/inputs.sha256 decides instead: when no
// input changed, nothing is written, and the committed files stay as they are.

import { $ } from "bun";
import { BASENAME, build } from "../src/build";

const REPO = `${import.meta.dir}/..`;
const DOCUMENTS_DIR = `${REPO}/documents`;

// The documents' inputs (SPEC-content, Acceptance): the resume source, this module's source
// files and the fonts. Bun.Glob skips dotfiles, such as macOS's .DS_Store, and test folders
// are not source files, so neither is an input.
const INPUT_FILES = [
  "resume.yaml",
  "src/content.ts",
  "src/build.ts",
  "src/print/**",
  "src/export/**",
  "scripts/documents.ts",
  "fonts/**",
];

// Only this module's own packages, so a change to another module's packages needs no rebuild.
const LOCKED_PACKAGES = ["docx", "harfbuzzjs", "zod"];

const sha256 = (data: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(data).digest("hex");

/**
 * The inputs hash, as documents/inputs.sha256 holds it: one `<sha256>  <name>` line per input
 * in sha256sum form, sorted by name. A file's name is its path from the repo root; a locked
 * package is `bun.lock#<package>`, hashed from its bun.lock entry.
 */
export async function inputsManifest(): Promise<string> {
  const hashes = new Map<string, string>();
  for (const pattern of INPUT_FILES) {
    for await (const path of new Bun.Glob(pattern).scan({ cwd: REPO, onlyFiles: true })) {
      if (!path.split("/").includes("__tests__")) hashes.set(path, sha256(await Bun.file(`${REPO}/${path}`).bytes()));
    }
  }
  const lock = Bun.JSONC.parse(await Bun.file(`${REPO}/bun.lock`).text()) as { packages: Record<string, unknown> };
  for (const name of LOCKED_PACKAGES) {
    const entry = lock.packages[name];
    if (!entry) throw new Error(`bun.lock has no top-level entry for ${name}`);
    hashes.set(`bun.lock#${name}`, sha256(JSON.stringify(entry)));
  }
  return [...hashes.keys()]
    .sort()
    .map((name) => `${hashes.get(name)}  ${name}\n`)
    .join("");
}

/** The inputs hash committed in a documents folder, or "" when the folder has none. */
export async function committedManifest(dir = DOCUMENTS_DIR): Promise<string> {
  const file = Bun.file(`${dir}/inputs.sha256`);
  return (await file.exists()) ? file.text() : "";
}

/** The names of the inputs whose hash differs between two inputs hashes, or that only one lists. */
export function changedInputs(before: string, after: string): string[] {
  const a = hashesByName(before);
  const b = hashesByName(after);
  return [...new Set([...a.keys(), ...b.keys()])].filter((name) => a.get(name) !== b.get(name)).sort();
}

function hashesByName(manifest: string): Map<string, string> {
  const hashes = new Map<string, string>();
  for (const line of manifest.split("\n")) {
    const match = line.match(/^([0-9a-f]{64}) {2}(.+)$/);
    if (match) hashes.set(match[2]!, match[1]!);
  }
  return hashes;
}

const DOCUMENTS = ["pdf", "docx", "txt"] as const;

if (import.meta.main) {
  const manifest = await inputsManifest();
  const changed = changedInputs(await committedManifest(), manifest);
  const present = await Promise.all(DOCUMENTS.map((ext) => Bun.file(`${DOCUMENTS_DIR}/${BASENAME}.${ext}`).exists()));

  if (changed.length === 0 && present.every(Boolean)) {
    console.log("documents/ is up to date: no input changed, so nothing was written.");
  } else {
    const tmp = `${Bun.env.TMPDIR ?? "/tmp"}/resume-documents-${crypto.randomUUID()}`;
    try {
      const [built] = await build({ outDir: tmp, variants: ["public"] });
      for (const ext of DOCUMENTS) await Bun.write(`${DOCUMENTS_DIR}/${BASENAME}.${ext}`, Bun.file(built![ext]));
      // The inputs hash goes last, so an interrupted run never pairs it with old documents.
      await Bun.write(`${DOCUMENTS_DIR}/inputs.sha256`, manifest);
    } finally {
      await $`rm -rf ${tmp}`.quiet().nothrow();
    }
    console.log(`documents/: wrote ${DOCUMENTS.map((ext) => `${BASENAME}.${ext}`).join(", ")} and inputs.sha256.`);
  }
}
