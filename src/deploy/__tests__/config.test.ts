// Seam 1 of SPEC-deploy at unit level: addPolicyTags() on a fixture static folder (tasks/modules/deploy.md, Notes).
// The checks of the built output (each built page's own tag, no style attribute) live once, in the site's build test,
// src/site/__tests__/build.test.ts.
// Each expected hash is a literal from outside this code. 'sha256-B2yPHKaXnvFWtRChIbabYmUBFZdVfKKXHbWtWidDVF8=' is
// MDN's worked example for `var inline = 1;`
// (https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src).
// The others come from `printf '<script text>' | openssl dgst -sha256 -binary | base64`.

import { afterAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { addPolicyTags } from "../policy";

const tmp = `${Bun.env.TMPDIR ?? "/tmp"}/deploy-config-test-${crypto.randomUUID()}`;

/** Writes the pages into a new static folder and returns its path. */
async function staticFolder(name: string, pages: Record<string, string>): Promise<string> {
  const dir = `${tmp}/${name}`;
  for (const [path, html] of Object.entries(pages)) await Bun.write(`${dir}/${path}`, html);
  return dir;
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

    await expect(addPolicyTags(dir)).rejects.toThrow(`${dir}/fragment.html has 0 <head> elements`);
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
