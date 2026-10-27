// addPolicyTags(staticDir): each HTML file's own Content Security Policy tag (SPEC-deploy, Headers), step 3 of the
// build script. The prerendered pages are static, so TanStack Start's per-request nonce cannot allow their inline
// scripts; a hash of each script can. The header policy from the routes covers everything except scripts.
import { Glob } from "bun";

/** The policy tag of a page whose inline scripts have these hash sources. */
function policyTag(hashes: string[]): string {
  const scriptSrc = ["'self'", ...hashes].join(" ");
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src ${scriptSrc}">`;
}

/**
 * The hash source of one inline script, as the browser computes it: SHA-256 over the script's text in UTF-8
 * (https://www.w3.org/TR/CSP3/#match-element-to-source-list). The browser hashes the text after its parser
 * turned CR LF and a lone CR into LF (https://html.spec.whatwg.org/multipage/parsing.html#preprocessing-the-input-stream),
 * while HTMLRewriter gives the file's bytes as they are, so the newlines are normalized here first.
 */
function hashSource(text: string): string {
  const parsed = text.replace(/\r\n?/g, "\n");
  return `'sha256-${new Bun.CryptoHasher("sha256").update(parsed).digest("base64")}'`;
}

/**
 * What the policy tag depends on in one page: the text of each inline script (a script element with no src
 * attribute) in page order, the number of <head> elements, and the number of policy tags already there.
 * HTMLRewriter reads elements as the browser does, so a script inside a comment is not one, and a data-src
 * attribute is not src. It gives a script's text raw, with no entity decoding, as the browser runs it.
 */
function readPage(html: string): { scripts: string[]; heads: number; policyTags: number } {
  const scripts: { text: string }[] = [];
  let script = { text: "" };
  let heads = 0;
  let policyTags = 0;
  new HTMLRewriter()
    .on("script:not([src])", {
      element: () => {
        script = { text: "" };
        scripts.push(script);
      },
      text: (chunk) => {
        script.text += chunk.text;
      },
    })
    .on("head", { element: () => void heads++ })
    .on('meta[http-equiv="Content-Security-Policy" i]', { element: () => void policyTags++ })
    .transform(html);
  return { scripts: scripts.map(({ text }) => text), heads, policyTags };
}

/**
 * Starts each HTML file's <head> under staticDir with its policy tag: `default-src 'self'; script-src 'self'` and
 * the hash of each of the page's own inline scripts. Returns the files, as paths in staticDir.
 * It fails, naming the file, on a page it cannot give exactly one policy tag first in its head.
 */
export async function addPolicyTags(staticDir: string): Promise<string[]> {
  const pages = (await Array.fromAsync(new Glob("**/*.html").scan({ cwd: staticDir }))).sort();
  // An empty list means the folder is wrong or the build wrote no page; either way no page would get a tag.
  if (pages.length === 0) throw new Error(`addPolicyTags: no HTML file under ${staticDir}`);
  for (const page of pages) {
    const file = `${staticDir}/${page}`;
    const html = await Bun.file(file).text();
    const { scripts, heads, policyTags } = readPage(html);
    if (heads !== 1) throw new Error(`addPolicyTags: ${file} has ${heads} <head> elements; its policy tag needs one`);
    // A second policy is enforced beside this one, and one written without this page's hashes blocks its scripts.
    if (policyTags > 0) throw new Error(`addPolicyTags: ${file} already has a policy tag; this step writes the only one`);
    // A Set keeps each hash once, in page order: two scripts with the same text need one hash.
    const tag = policyTag([...new Set(scripts.map(hashSource))]);
    const tagged = new HTMLRewriter()
      .on("head", { element: (head) => void head.prepend(tag, { html: true }) })
      .transform(html);
    await Bun.write(file, tagged);
  }
  return pages;
}
