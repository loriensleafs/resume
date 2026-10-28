// Seam 1 of SPEC-deploy at unit level: addPolicyTags() on a fixture static folder (tasks/modules/deploy.md, Notes),
// and the settings in code that Vercel and Bun read from the checkout: vercel.json, and no .env file (task D8).
// The checks of the built output (each built page's own tag, no style attribute) live once, in the site's build test,
// src/site/__tests__/build.test.ts.
// Each expected hash is a literal from outside this code. 'sha256-B2yPHKaXnvFWtRChIbabYmUBFZdVfKKXHbWtWidDVF8=' is
// MDN's worked example for `var inline = 1;`
// (https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src).
// The others come from `printf '<script text>' | openssl dgst -sha256 -binary | base64`.

import { afterAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { addPolicyTags } from "../policy";

const REPO = resolve(import.meta.dir, "../../..");
const tmp = `${Bun.env.TMPDIR ?? "/tmp"}/deploy-config-test-${crypto.randomUUID()}`;

/** Writes the pages into a new static folder and returns its path. */
async function staticFolder(name: string, pages: Record<string, string>): Promise<string> {
  const dir = `${tmp}/${name}`;
  for (const [path, html] of Object.entries(pages)) await Bun.write(`${dir}/${path}`, html);
  return dir;
}

/**
 * The paths, from root, of every entry under root whose name starts with ".env", ignored files included. It leaves out
 * installed packages (node_modules), git's own folder and each nested checkout, a folder with its own .git, such as an
 * agent's worktree under .claude/worktrees/. It follows no symbolic link.
 */
async function envFiles(root: string, dir = root): Promise<string[]> {
  const found: string[] = [];
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.name.startsWith(".env")) found.push(path.slice(root.length + 1));
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === ".git" || existsSync(`${path}/.git`)) {
      continue;
    }
    found.push(...(await envFiles(root, path)));
  }
  return found;
}

afterAll(async () => {
  await $`rm -rf ${tmp}`.quiet().nothrow();
});

describe("addPolicyTags()", () => {
  test("puts the page's policy tag first in its <head> and changes nothing else", async () => {
    const page =
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Home</title></head>' +
      '<body><main>Home</main><script>var inline = 1;</script></body></html>';
    const dir = await staticFolder("one-page", { "index.html": page });

    await addPolicyTags(dir);

    expect(await Bun.file(`${dir}/index.html`).text()).toBe(
      page.replace(
        "<head>",
        `<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' ` +
          `'sha256-B2yPHKaXnvFWtRChIbabYmUBFZdVfKKXHbWtWidDVF8='">`,
      ),
    );
  });

  test("lists each inline script's hash once, in page order, and no hash for a script with src", async () => {
    const dir = await staticFolder("scripts", {
      "index.html":
        "<!doctype html><html><head><title>Home</title></head><body>" +
        "<script>var inline = 1;</script>" +
        '<script type="module" src="/assets/app.js"></script>' +
        "<script>var other = 2;</script>" +
        "<script>var inline = 1;</script>" +
        "</body></html>",
    });

    await addPolicyTags(dir);

    expect(await Bun.file(`${dir}/index.html`).text()).toStartWith(
      `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; ` +
        `script-src 'self' 'sha256-B2yPHKaXnvFWtRChIbabYmUBFZdVfKKXHbWtWidDVF8=' ` +
        `'sha256-mDAj095ZDa2VvLUffwPkMbb0rqMdZMss59PqabEj5ZY='"><title>`,
    );
  });

  test("gives each HTML file, in any folder, the hashes of its own inline scripts only", async () => {
    const dir = await staticFolder("pages", {
      "index.html": "<html><head></head><body><script>var inline = 1;</script></body></html>",
      "resume/index.html": "<html><head></head><body><script>var other = 2;</script></body></html>",
    });

    await addPolicyTags(dir);

    expect(await Bun.file(`${dir}/index.html`).text()).toStartWith(
      `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; ` +
        `script-src 'self' 'sha256-B2yPHKaXnvFWtRChIbabYmUBFZdVfKKXHbWtWidDVF8='"></head>`,
    );
    expect(await Bun.file(`${dir}/resume/index.html`).text()).toStartWith(
      `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; ` +
        `script-src 'self' 'sha256-mDAj095ZDa2VvLUffwPkMbb0rqMdZMss59PqabEj5ZY='"></head>`,
    );
  });

  // The HTML parser turns CR LF and a lone CR into LF before a script's text exists
  // (https://html.spec.whatwg.org/multipage/parsing.html#preprocessing-the-input-stream), and the browser hashes that
  // text. The literal is the hash of "var a = 1;\nvar b = 2;\n".
  test("hashes the script text the browser parses, with CR LF and a lone CR as LF", async () => {
    const dir = await staticFolder("newlines", {
      "index.html": "<html><head></head><body><script>var a = 1;\r\nvar b = 2;\r</script></body></html>",
    });

    await addPolicyTags(dir);

    expect(await Bun.file(`${dir}/index.html`).text()).toStartWith(
      `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; ` +
        `script-src 'self' 'sha256-wpN3pHOJg4wfHiikUaAxsdhu7ZP8zXhm5aZ+OS31NBc='"></head>`,
    );
  });

  test("gives a page with no inline script `script-src 'self'` alone", async () => {
    const dir = await staticFolder("no-script", {
      "404.html": "<html><head><title>Page not found</title></head><body><h1>Page not found</h1></body></html>",
    });

    await addPolicyTags(dir);

    expect(await Bun.file(`${dir}/404.html`).text()).toStartWith(
      `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">` +
        "<title>",
    );
  });

  // Each refusal fails the build where the page would otherwise go out with no policy tag, or with two policies.
  test("refuses a page with no <head>, and names it", async () => {
    const dir = await staticFolder("no-head", {
      "index.html": "<html><head></head><body></body></html>",
      "fragment.html": "<p>No head here.</p><script>var inline = 1;</script>",
    });

    await expect(addPolicyTags(dir)).rejects.toThrow(`${dir}/fragment.html must have only`);
  });

  // A script before the policy tag runs with no policy, so its hash in the tag would protect nothing.
  test("refuses a page with a script before its <head>, and names it", async () => {
    const dir = await staticFolder("script-first", {
      "index.html": "<!doctype html><script>var inline = 1;</script><html><head></head><body></body></html>",
    });

    await expect(addPolicyTags(dir)).rejects.toThrow(`${dir}/index.html must have only`);
  });

  // The browser ignores a <head> start tag inside <body>, and a policy tag outside <head>
  // (https://html.spec.whatwg.org/multipage/semantics.html#attr-meta-http-equiv-content-security-policy).
  test("refuses a page whose <head> sits inside <body>, and names it", async () => {
    const dir = await staticFolder("head-in-body", {
      "index.html": "<html><body><head></head><script>var inline = 1;</script></body></html>",
    });

    await expect(addPolicyTags(dir)).rejects.toThrow(`${dir}/index.html must have only`);
  });

  // The browser's tokenizer ends "<!-->" at once, so the script after it runs; a comment rule that read on to the
  // next "-->" would take that script for comment text.
  test("refuses a script after <!-->, which the browser does not read as a comment", async () => {
    const dir = await staticFolder("short-comment", {
      "index.html": "<!--><script>var inline = 1;</script><!-- --><html><head></head><body></body></html>",
    });

    await expect(addPolicyTags(dir)).rejects.toThrow(`${dir}/index.html must have only`);
  });

  // A comment rule that may end at any later "-->" gives k comments about 2^k ways to split, so this page once took
  // hours to refuse (D16 security review). The bound only has to tell a linear check from that, with room for a slow
  // CI runner.
  test("refuses a page with 40 comments and then a script before <head>, in under 500 ms", async () => {
    const dir = await staticFolder("many-comments", {
      "index.html": `${"<!--a-->".repeat(40)}<script>var inline = 1;</script><html><head></head></html>`,
    });

    const started = performance.now();
    await expect(addPolicyTags(dir)).rejects.toThrow(`${dir}/index.html must have only`);
    const elapsed = performance.now() - started;

    console.log(`40 comments refused in ${elapsed.toFixed(1)} ms`);
    expect(elapsed).toBeLessThan(500);
  });

  test("accepts a doctype, whitespace, comments and <html> before <head>, and puts the tag right after <head>", async () => {
    const start = "<!-- built -->\n<!DOCTYPE html>\n<!-- page -->\n<HTML lang=\"en\" class='a b'>\n  <head data-x=y>";
    const page = `${start}<title>Home</title></head><body><script>var inline = 1;</script></body></HTML>`;
    const dir = await staticFolder("preamble", { "index.html": page });

    await addPolicyTags(dir);

    expect(await Bun.file(`${dir}/index.html`).text()).toBe(
      `${start}<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' ` +
        `'sha256-B2yPHKaXnvFWtRChIbabYmUBFZdVfKKXHbWtWidDVF8='">${page.slice(start.length)}`,
    );
  });

  test("refuses a page that already has a policy tag, and names it", async () => {
    const dir = await staticFolder("tagged", {
      "index.html":
        '<html><head><meta http-equiv="content-security-policy" content="script-src \'self\'"></head></html>',
    });

    await expect(addPolicyTags(dir)).rejects.toThrow(`${dir}/index.html already has a policy tag`);
  });

  test("refuses a static folder with no HTML file, and names the folder", async () => {
    const dir = await staticFolder("no-pages", { "assets/app.js": "console.log(1);" });

    await expect(addPolicyTags(dir)).rejects.toThrow(`no HTML file under ${dir}`);
  });
});

describe("vercel.json", () => {
  // The expected object is SPEC-deploy's, "Configuration in code". Routes, headers and the cron live in the build's
  // .vercel/output/config.json instead, so any other key here fails.
  test("holds only the build settings: Bun 1.4, no framework, bun ci, build:site and the ignore step", async () => {
    expect(await Bun.file(`${REPO}/vercel.json`).json()).toEqual({
      $schema: "https://openapi.vercel.sh/vercel.json",
      bunVersion: "1.4.x",
      framework: null,
      installCommand: "bun ci",
      buildCommand: "bun run build:site",
      ignoreCommand: "sh scripts/ignore-build.sh",
    });
  });
});

// Bun loads .env, .env.<NODE_ENV> and .env.local into a run on its own (SPEC-deploy, "Secrets and settings"), so Peter's
// local keys live in .secrets/local.env, and no file named .env or .env.* is ever created.
describe("no .env file", () => {
  test("the checkout holds no .env file, ignored ones included", async () => {
    expect(await envFiles(REPO)).toEqual([]);
  });

  // The control: a scan that found nothing would let the checkout's test pass with a .env file in place.
  test("the scan finds each planted .env file, and leaves out installed packages and nested checkouts", async () => {
    const root = `${tmp}/env-scan`;
    for (const path of [".env", "src/.env.local", "node_modules/some-package/.env", "worktree/.env", "README.md"]) {
      await Bun.write(`${root}/${path}`, "");
    }
    await Bun.write(`${root}/worktree/.git`, "gitdir: elsewhere\n");

    expect(await envFiles(root)).toEqual([".env", "src/.env.local"]);
  });
});

describe("bunfig.toml", () => {
  // Bun reads bunfig.toml from the folder that a run starts in, so a fixture folder with a copy shows its effect.
  // `bun run questions` and `bun run evals` name .secrets/local.env with --env-file (SPEC-deploy), so that must load.
  test("turns Bun's automatic .env loading off, and a file that --env-file names still loads", async () => {
    const dir = `${tmp}/bunfig`;
    await Bun.write(`${dir}/.env`, "D8_MARKER=from-dotenv\n");
    await Bun.write(`${dir}/.secrets/local.env`, "D8_MARKER=from-local-env\n");
    const marker = "process.env.D8_MARKER ?? 'unset'";
    // The control: without the repository's bunfig.toml, Bun loads the .env file.
    expect((await $`${process.execPath} --print ${marker}`.cwd(dir).text()).trim()).toBe("from-dotenv");

    await Bun.write(`${dir}/bunfig.toml`, Bun.file(`${REPO}/bunfig.toml`));

    expect((await $`${process.execPath} --print ${marker}`.cwd(dir).text()).trim()).toBe("unset");
    expect((await $`${process.execPath} --env-file=.secrets/local.env --print ${marker}`.cwd(dir).text()).trim()).toBe(
      "from-local-env",
    );
  });
});
