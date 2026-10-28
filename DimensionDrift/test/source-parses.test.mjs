// Every source file has to parse in a real JavaScript engine.
//
// THIS LOOKS LIKE SOMETHING THE BUILD ALREADY DOES. It is not, and the gap is
// exactly how a syntax error rode along in carve for five weeks without one
// green build going red.
//
//   return (
//     `air ${...}\n` +
//     `flick ${flick}`,     <- trailing comma in a parenthesised expression
//   );
//
// `(a, )` is a SyntaxError in the spec and V8 rejects it. esbuild and rollup
// both accept it: they fully parse the file and re-emit it, and the comma never
// survives into the output. So `vite build` is green, `bootqa.mjs` is green,
// the shipped bundle runs, and every consumer that goes through a bundler is
// fine for ever.
//
// `vite dev` is the one consumer that is not. It rewrites import specifiers
// with es-module-lexer, which SCANS for `import`/`export` and never parses the
// body, then hands the rest of the file to the browser verbatim — so the
// browser is the first thing in the chain to read that comma, and it refuses
// the whole module. The game died on a blank screen with one unsourced
// `Unexpected token ')'` and nothing else in the console.
//
// Which means: the thing this repo uses to PLAY the game is a stricter parser
// than the thing it uses to ship it. A bundler cannot gate this. V8 can, so V8
// is what is asked, through `node --check` on a copy named `.mjs` — the same
// parser the browser would use, applied to the same bytes it would receive.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, copyFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..', 'src');

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : full.endsWith('.js') ? [full] : [];
});

test('every file under src/ parses in V8, not just in the bundler', () => {
  const files = walk(SRC);
  // A glob that matches nothing runs zero checks and passes, which is the same
  // shape of silence this whole file exists to close.
  assert.ok(files.length > 15, `expected the whole game under src/, found ${files.length}`);

  const scratch = mkdtempSync(path.join(tmpdir(), 'ddparse-'));
  const broken = [];
  try {
    for (const file of files) {
      // Copied to a `.mjs` name so `node --check` reads it as a module and the
      // import statements are not themselves the error.
      const copy = path.join(scratch, 'check.mjs');
      copyFileSync(file, copy);
      try {
        execFileSync(process.execPath, ['--check', copy], { stdio: 'pipe' });
      } catch (err) {
        const why = String(err.stderr ?? '').split('\n').find((l) => l.includes('Error')) ?? 'parse failed';
        broken.push(`${path.relative(path.join(here, '..'), file)}: ${why.trim()}`);
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  assert.deepEqual(broken, [], `\n  ${broken.join('\n  ')}\n`);
});
