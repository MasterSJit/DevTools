// Post-build hardening for the static export (`npm run build:static`).
//
// Next.js inlines small <script> blocks into every page, which normally forces CSP `'unsafe-inline'`.
// This script hashes every inline script in every exported page and injects a per-page
// <meta http-equiv="Content-Security-Policy"> that allows ONLY those exact scripts plus our own files.
// Browsers enforce both this meta policy and the broader header policy from .htaccess, so an injected
// <script> or event handler cannot run even if an XSS bug slipped into a tool.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { join, extname } from 'node:path';

const OUT = join(process.cwd(), 'out');

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const files = walk(OUT);
const INLINE = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
let pages = 0; let total = 0;

for (const file of files.filter((f) => extname(f) === '.html')) {
  let html = readFileSync(file, 'utf8');
  const hashes = new Set();
  for (const [, attrs, body] of html.matchAll(INLINE)) {
    if (/type=["']?(application\/(ld\+)?json|text\/template)/i.test(attrs)) continue; // data blocks never execute
    if (!body) continue;
    hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
  total += hashes.size;
  const policy = [
    `script-src 'self' 'wasm-unsafe-eval' blob: ${[...hashes].join(' ')}`.trim(),
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
  // Must come before any script in <head>.
  html = html.replace(/<head([^>]*)>/i, `<head$1>${meta}`);
  writeFileSync(file, html);
  pages++;
}

// Never ship source maps or stray dev files.
let removed = 0;
for (const f of files) {
  if (f.endsWith('.map') || /\/\.DS_Store$/.test(f)) { rmSync(f); removed++; }
}

console.log(`harden-static: CSP meta injected into ${pages} pages (${total} inline-script hashes); removed ${removed} map/junk files`);
