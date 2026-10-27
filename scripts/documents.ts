// `bun run documents`: rebuilds the committed public documents in documents/ when their
// inputs changed. The website serves these files, because Vercel's build has no Chrome
// (SPEC-deploy, Documents).
//
// `docx` and Chrome stamp the build date into every file, so two builds of the same inputs
// differ byte for byte. The inputs hash in documents/inputs.sha256 decides instead: an
// unchanged hash writes nothing, and the committed files stay as they are.

import { $ } from "bun";
import { BASENAME, build } from "../src/build";

const REPO = `${import.meta.dir}/..`;

// The documents' inputs (SPEC-content, Acceptance): the resume source, this module's source
// files and the fonts. Test folders are not source files, so a test change needs no rebuild.
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

/** One hash over every input of the documents, in the form documents/inputs.sha256 holds. */
export async function inputsHash(root = REPO): Promise<string> {
  const paths = new Set<string>();
  for (const pattern of INPUT_FILES) {
    // A dotfile, such as macOS's .DS_Store, is never an input.
    for await (const path of new Bun.Glob(pattern).scan({ cwd: root, onlyFiles: true })) {
      if (!path.split("/").includes("__tests__")) paths.add(path);
    }
  }

  // Each line is "<sha256>  <name>", as sha256sum writes it; the lines are hashed together.
  const lines: string[] = [];
  for (const path of [...paths].sort()) lines.push(`${sha256(await Bun.file(`${root}/${path}`).bytes())}  ${path}`);

  const lock = Bun.JSONC.parse(await Bun.file(`${root}/bun.lock`).text()) as { packages: Record<string, unknown> };
  for (const name of LOCKED_PACKAGES) {
    const entry = lock.packages[name];
    if (!entry) throw new Error(`bun.lock has no top-level entry for ${name}`);
    lines.push(`${sha256(JSON.stringify(entry))}  bun.lock#${name}`);
  }
  return sha256(lines.map((line) => `${line}\n`).join(""));
}

const DOCUMENTS = ["pdf", "docx", "txt"] as const;

if (import.meta.main) {
  const dir = `${REPO}/documents`;
  const hashFile = Bun.file(`${dir}/inputs.sha256`);
  const hash = await inputsHash();
  const committed = (await hashFile.exists()) ? (await hashFile.text()).trim() : "";
  const present = await Promise.all(DOCUMENTS.map((ext) => Bun.file(`${dir}/${BASENAME}.${ext}`).exists()));

  if (committed === hash && present.every(Boolean)) {
    console.log("documents/ is up to date: the inputs hash has not changed, so nothing was written.");
  } else {
    const tmp = `${Bun.env.TMPDIR ?? "/tmp"}/resume-documents-${crypto.randomUUID()}`;
    try {
      const [built] = await build({ outDir: tmp, variants: ["public"] });
      for (const ext of DOCUMENTS) await Bun.write(`${dir}/${BASENAME}.${ext}`, Bun.file(built![ext]));
      // The hash goes last, so an interrupted run never pairs a new hash with old documents.
      await Bun.write(hashFile, `${hash}\n`);
    } finally {
      await $`rm -rf ${tmp}`.quiet().nothrow();
    }
    console.log(`documents/: wrote ${DOCUMENTS.map((ext) => `${BASENAME}.${ext}`).join(", ")} and inputs.sha256.`);
  }
}
