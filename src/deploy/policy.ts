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

// A policy tag protects only what comes after it, and the browser enforces it only as a child of <head>
// (https://html.spec.whatwg.org/multipage/semantics.html#attr-meta-http-equiv-content-security-policy). So a page
// may start with nothing but a doctype, whitespace, comments and an <html> start tag before its <head> start tag.
// The tree builder then makes that <head> the first child of <html>
// (https://html.spec.whatwg.org/multipage/parsing.html#the-before-head-insertion-mode), and the tag goes right after
// it. Each part below is stricter than the browser's tokenizer, so the browser reads a matching start the same way;
// a page that does not match is refused, never guessed at.
/** HTML's whitespace. `\s` also matches characters, such as a no-break space, that the tree builder does not skip. */
const SPACE = "[\\t\\n\\f\\r ]";
/**
 * A comment ends at the first --> or --!>. Its text may not hold either, so each comment has one end, and a failing
 * match cannot try each later end in turn (k comments would give 2^k tries). "<!-->" and "<!--->" end at once, so a
 * start with them is refused.
 */
const COMMENT = "<!--(?!-?>)(?:(?!--!?>)[\\s\\S])*--!?>";
const SKIPPED = `(?:${SPACE}|${COMMENT})*`;
/** An attribute with a plain name and a quoted or plain value. A quote or "<" in a name or plain value fails. */
const ATTRIBUTE = `${SPACE}+[a-z_:][-a-z0-9_:.]*(?:${SPACE}*=${SPACE}*(?:"[^"]*"|'[^']*'|[^\\t\\n\\f\\r "'=<>\`]+))?`;
const startTag = (name: string) => `<${name}(?:${ATTRIBUTE})*${SPACE}*>`;
/** A doctype ends at its first ">", whatever comes before it. */
const UP_TO_HEAD = new RegExp(
  `^${SKIPPED}(?:<!doctype[^>]*>${SKIPPED})?(?:${startTag("html")}${SKIPPED})?${startTag("head")}`,
  "i",
);

/**
 * What the policy tag depends on in one page: the text of each inline script (a script element with no src
 * attribute) in page order, and the number of policy tags already there. HTMLRewriter reads elements as the browser
 * does, so a script inside a comment is not one, and a data-src attribute is not src. It gives a script's text raw,
 * with no entity decoding, as the browser runs it.
 */
function readPage(html: string): { scripts: string[]; policyTags: number } {
  const scripts: string[] = [];
  let policyTags = 0;
  new HTMLRewriter()
    .on("script:not([src])", {
      element: () => void scripts.push(""),
      // A script's text arrives in chunks after its start tag, so each chunk belongs to the last script.
      text: (chunk) => {
        scripts[scripts.length - 1] += chunk.text;
      },
    })
    .on('meta[http-equiv="Content-Security-Policy" i]', { element: () => void policyTags++ })
    .transform(html);
  return { scripts, policyTags };
}

/**
 * Starts each HTML file's <head> under staticDir with its policy tag: `default-src 'self'; script-src 'self'` and
 * the hash of each of the page's own inline scripts. Returns the files, as paths in staticDir.
 * It fails, naming the file, on a page whose policy tag would not come before every script, or would not be its only one.
 */
export async function addPolicyTags(staticDir: string): Promise<string[]> {
  const pages = (await Array.fromAsync(new Glob("**/*.html").scan({ cwd: staticDir }))).sort();
  // An empty list means the folder is wrong or the build wrote no page; either way no page would get a tag.
  if (pages.length === 0) throw new Error(`addPolicyTags: no HTML file under ${staticDir}`);
  for (const page of pages) {
    const file = `${staticDir}/${page}`;
    const html = await Bun.file(file).text();
    const head = UP_TO_HEAD.exec(html)?.[0];
    if (head === undefined) {
      throw new Error(
        `addPolicyTags: ${file} must have only a doctype, whitespace, comments and <html> before its <head>, ` +
          "so that its policy tag comes before every script",
      );
    }
    const { scripts, policyTags } = readPage(html);
    // A second policy is enforced beside this one, and one written without this page's hashes blocks its scripts.
    if (policyTags > 0) throw new Error(`addPolicyTags: ${file} already has a policy tag; this step writes the only one`);
    // A Set keeps each hash once, in page order: two scripts with the same text need one hash.
    const tag = policyTag([...new Set(scripts.map(hashSource))]);
    await Bun.write(file, head + tag + html.slice(head.length));
  }
  return pages;
}
