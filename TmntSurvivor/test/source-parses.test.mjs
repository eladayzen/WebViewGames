// EVERY SOURCE FILE IS A VALID MODULE, asked of V8 rather than of a bundler.
//
// Lifted from the DimensionDrift session, which lost an evening to it. The
// failure it catches: `return ( a, );` -- a trailing comma inside a
// parenthesised expression -- is a SyntaxError that esbuild and rollup both
// ACCEPT, because they fully parse and re-emit and the comma never reaches the
// output. So `vite build` is green and the shipped bundle is fine. But
// `vite dev` rewrites import specifiers with a scanner that never parses the
// body and hands the rest to the browser verbatim, so the browser is the first
// real parser the bytes meet: blank page, one unsourced "Unexpected token",
// nothing else. It sat in carve for five weeks.
//
// No bundler can be asked this question, which is the whole point of asking
// node. Negative control for whoever maintains this: put a trailing comma in
// a parenthesised expression in any src file -- `vite build` still exits 0 and
// this test goes red.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, copyFileSync, mkdtempSync } from 'node:fs';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (extname(e.name) === '.js') out.push(p);
  }
  return out;
}

test('every src/**/*.js parses as an ES module', () => {
  const files = walk('src');
  // A glob that matches nothing passes silently -- the same shape of failure
  // this file exists to close, so it is asserted rather than assumed.
  assert.ok(files.length > 0, 'found no source files to check');
  const tmp = mkdtempSync(join(tmpdir(), 'parse-'));
  const bad = [];
  for (const f of files) {
    // Copied to .mjs because `node --check` treats a bare .js as CommonJS and
    // would reject every import statement in the repo.
    const as = join(tmp, 'check.mjs');
    copyFileSync(f, as);
    try {
      execFileSync(process.execPath, ['--check', as], { stdio: 'pipe' });
    } catch (e) {
      bad.push(`${f}: ${String(e.stderr).split('\n').find((l) => l.includes('Error')) || 'parse failed'}`);
    }
  }
  assert.deepEqual(bad, [], `files that V8 refuses:\n${bad.join('\n')}`);
});
