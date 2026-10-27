// PROTOTYPE: turn the spike's build into the SPEC-deploy design: a policy tag per page,
// a static not-found page with no scripts, and a service worker with an offline fallback.
import { Glob } from "bun";
const root = `${import.meta.dir}/dist/client`;
async function sha(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return `'sha256-${Buffer.from(d).toString("base64")}'`;
}
for await (const path of new Glob("**/*.html").scan(root)) {
  const file = `${root}/${path}`;
  let html = await Bun.file(file).text();
  const hashes: string[] = [];
  for (const m of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) hashes.push(await sha(m[1]));
  const tag = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' ${hashes.join(" ")}">`;
  html = html.replace(/<head>/, `<head>${tag}`);
  await Bun.write(file, html);
  console.log(`${path}: ${hashes.length} inline scripts hashed`);
}
await Bun.write(`${root}/404.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Page not found</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'"></head>
<body><h1>Page not found</h1><p><a href="/">Ask the chat</a> or <a href="/resume">read the resume</a>.</p></body></html>`);
