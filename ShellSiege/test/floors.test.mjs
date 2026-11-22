// A floor whose texture file is missing does not throw -- three.js logs a 404
// and the plaza renders as an untextured white plane, which looks like a
// lighting bug rather than a missing file. Assert the files exist instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FLOORS, pickFloor } from '../src/render/floors.js';

test('every floor names a texture that is actually on disk', () => {
  for (const [key, f] of Object.entries(FLOORS)) {
    assert.ok(fs.existsSync(`public/${f.tex}`), `${key} -> public/${f.tex} missing`);
  }
});

test('every rune radius sits inside the arena', () => {
  // The arena is 36 units across, so a ring must be well under half of that or
  // the glow lands on the kerb instead of on the painted runes.
  for (const [key, f] of Object.entries(FLOORS)) {
    // A floor with no painted runes says so with null, and stage.js hides the ring.
    if (f.runeR === null) continue;
    assert.ok(f.runeR > 1 && f.runeR < 16, `${key} runeR ${f.runeR} out of range`);
  }
});

test('an unknown floor name falls back rather than returning undefined', () => {
  assert.equal(pickFloor('nope'), FLOORS.warm);
  assert.equal(pickFloor(null), FLOORS.warm);
  assert.equal(pickFloor('stone'), FLOORS.stone);
});

test('the grey dais is kept, not deleted', () => {
  // Elad: "keep this asset for later". It is reachable at ?theme=stone.
  assert.equal(FLOORS.stone.tex, 'tex/floor_plaza.webp');
});
