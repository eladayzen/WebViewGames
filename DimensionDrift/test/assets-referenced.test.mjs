// Everything in public/ is referenced, and everything referenced is in public/.
//
// WHY. Vite copies `public/` into `dist/` wholesale -- it does not care whether
// anything points at a file. RoboRun still ships twelve unused Leonardo attack
// frames for exactly that reason (BAL-626): a reskin replaced the code that
// drew them, nobody deleted the files, and the directory copy kept emitting
// them into a build for a game they do not belong to. On a licensed title that
// is not a size problem, it is art from one IP riding inside another's build.
//
// The other direction is the one that breaks a device rather than embarrassing
// us: a path the code asks for that nothing copied. In a browser that is a 404
// in a console; inside the WebView there IS no console, so it is a silent
// missing soundtrack or an invisible rider.
//
// This reads SOURCE, not `dist/`, so it needs no build and answers at the place
// the decision is actually made.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const PUBLIC = path.join(ROOT, 'public');

/** Files Vite emits that are a contract with the page, not game content. */
const NOT_CONTENT = new Set(['base.css', 'styles.css']);

async function walk(dir, rel = '') {
  const out = [];
  for (const name of (await readdir(dir)).sort()) {
    const p = path.join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    if ((await stat(p)).isDirectory()) out.push(...await walk(p, r));
    else out.push(r);
  }
  return out;
}

async function sources() {
  const files = [path.join(ROOT, 'index.html')];
  for (const rel of await walk(path.join(ROOT, 'src'))) {
    if (rel.endsWith('.js')) files.push(path.join(ROOT, 'src', rel));
  }
  for (const rel of await walk(PUBLIC)) {
    if (rel.endsWith('.css')) files.push(path.join(PUBLIC, rel));
  }
  return Promise.all(files.map((f) => readFile(f, 'utf8')));
}

const shipped = (await walk(PUBLIC)).filter((f) => !NOT_CONTENT.has(f));
const text = (await sources()).join('\n');

test('public/ is not empty, so neither side of this check is vacuous', () => {
  // Without this, a public/ that lost its contents would make "nothing is
  // orphaned" pass triumphantly against an empty set.
  assert.ok(shipped.length >= 10, `only ${shipped.length} files in public/`);
  assert.ok(text.length > 10000, 'source scan came back suspiciously small');
});

test('every file shipped in public/ is referenced by the game', () => {
  const orphans = shipped.filter((rel) => {
    const base = rel.split('/').pop();
    return !text.includes(`/${rel}`) && !text.includes(base);
  });
  assert.deepEqual(orphans, [], `orphaned in public/: ${orphans.join(', ')}`);
});

test('every runtime path the game asks for exists in public/', () => {
  const asked = [...new Set(
    [...text.matchAll(/["'(]\/((?:audio|fonts|models|tracks|images|art|brand)\/[^"')?]+)/g)]
      .map((m) => m[1]),
  )].sort();
  assert.ok(asked.length > 0, 'found no runtime asset references at all');
  const missing = asked.filter((rel) => !shipped.includes(rel));
  assert.deepEqual(missing, [], `referenced but not shipped: ${missing.join(', ')}`);
});

test('no path still points at the carve asset namespace', () => {
  // The port moved /audio/carve/* up a level and renamed the track. A straggler
  // would 404 silently on a device, and would also leave the old game's name in
  // this one's shipped paths.
  const stale = [...text.matchAll(/\/(?:audio|tracks)\/carve[^"')\s]*/g)].map((m) => m[0]);
  assert.deepEqual([...new Set(stale)], []);
});
