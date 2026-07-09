// Vite's HTML pipeline always tags the bundled entry script as type="module",
// regardless of the Rollup output format. With vite-plugin-singlefile + an
// IIFE output, the inlined script has no remaining import/export statements,
// so the module type is a leftover with no effect except tripping WebView
// module-loading restrictions under file://. Strip it post-build.
import { readFileSync, writeFileSync } from 'node:fs';

const distHtml = new URL('../dist/index.html', import.meta.url);
let html = readFileSync(distHtml, 'utf8');

const before = html;
// Note: `defer`/`async` have no effect on inline scripts (no `src`) per the
// HTML spec, so we can't rely on script placement/attributes to guarantee
// the body is parsed first — main.js guards its own entry point instead.
html = html.replace(/<script\s+type="module"\s+crossorigin>/, '<script>');
html = html.replace(/<script\s+type="module"\s+crossorigin\s+src="([^"]+)">/, '<script src="$1">');

if (html === before) {
  throw new Error('strip-module: no type="module" script tag found to strip — check dist/index.html manually.');
}
if (/type="module"/.test(html)) {
  throw new Error('strip-module: type="module" still present after replacement — check dist/index.html manually.');
}

writeFileSync(distHtml, html);
console.log('strip-module: stripped type="module" from dist/index.html');
