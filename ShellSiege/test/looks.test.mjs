// WHAT EACH ROOM LOOKS LIKE AND HOW IT PLAYS. The rules worth testing are the
// ones that would make a room unplayable or boring: two rooms in a row the same,
// a layout that traps someone, a theme pointing at a painting that is not there.

import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, LAYOUTS, layoutObstacles, lookFor, usedFloors } from '../src/core/looks.js';
import { overlapsAny } from '../src/core/obstacles.js';
import { ARENA } from '../src/core/world.js';
import { FLOORS } from '../src/render/floors.js';
import { BREEDS } from '../src/core/breeds.js';

const BIGGEST = Math.max(...Object.values(BREEDS).map((b) => b.radius));

test('EVERY THEME POINTS AT A PAINTING THAT EXISTS, with real colours', () => {
  for (const [k, t] of Object.entries(THEMES)) {
    assert.ok(FLOORS[t.floor], `${k} names floor "${t.floor}", which is not in render/floors.js`);
    for (const c of ['tint', 'fog', 'apron', 'props']) assert.ok(Number.isInteger(t[c]), `${k}.${c}`);
    assert.ok(t.ring === null || Number.isInteger(t.ring.color), `${k}.ring`);
  }
});

test('EVERY LAYOUT KEEPS THE CENTRE CLEAR, because that is where you start', () => {
  const cx = ARENA.width / 2, cy = ARENA.height / 2;
  for (const key of Object.keys(LAYOUTS)) {
    assert.equal(overlapsAny(cx, cy, 350, layoutObstacles(key)), false, `${key} crowds the player's start`);
  }
});

test('EVERY OBSTACLE IS INSIDE THE ARENA', () => {
  for (const key of Object.keys(LAYOUTS)) {
    for (const o of layoutObstacles(key)) {
      const ext = o.kind === 'circle' ? [o.r, o.r] : [o.hw, o.hh];
      assert.ok(o.x - ext[0] >= 0 && o.x + ext[0] <= ARENA.width, `${key}: x ${o.x}`);
      assert.ok(o.y - ext[1] >= 0 && o.y + ext[1] <= ARENA.height, `${key}: y ${o.y}`);
    }
  }
});

test('NO LAYOUT CAN TRAP ANYONE: all the free floor is connected, even for the BIGGEST enemy', () => {
  // A layout the biggest enemy cannot cross is a room it can never reach you
  // in. Flood-fill a grid of cells a body of that size could stand on, from the
  // centre, and demand it reaches every one of them.
  const CELL = 60, N = Math.round(ARENA.width / CELL);
  for (const key of Object.keys(LAYOUTS)) {
    const obs = layoutObstacles(key);
    const free = (i, j) => !overlapsAny((i + 0.5) * CELL, (j + 0.5) * CELL, BIGGEST, obs)
      && (i + 0.5) * CELL > BIGGEST && (i + 0.5) * CELL < ARENA.width - BIGGEST
      && (j + 0.5) * CELL > BIGGEST && (j + 0.5) * CELL < ARENA.height - BIGGEST;
    let total = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (free(i, j)) total++;
    const seen = new Set();
    const stack = [[N / 2, N / 2]];
    while (stack.length) {
      const [i, j] = stack.pop();
      const k = i * N + j;
      if (i < 0 || j < 0 || i >= N || j >= N || seen.has(k) || !free(i, j)) continue;
      seen.add(k);
      stack.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
    }
    assert.equal(seen.size, total, `${key}: ${total - seen.size} of ${total} free cells are cut off`);
  }
});

test('THE OPEN LAYOUT IS EMPTY AND EVERY OTHER ONE HAS SOMETHING IN IT', () => {
  assert.equal(layoutObstacles('open').length, 0);
  for (const key of Object.keys(LAYOUTS).filter((k) => k !== 'open')) {
    assert.ok(layoutObstacles(key).length >= 2, `${key} is practically open`);
  }
});

test('NO TWO ROOMS IN A ROW ARE THE SAME, on any level', () => {
  for (let level = 1; level <= 8; level++) {
    for (let r = 0; r < 4; r++) {
      const a = lookFor(level, r), b = lookFor(level, r + 1);
      assert.notEqual(a.theme, b.theme, `level ${level}: rooms ${r + 1} and ${r + 2} share a theme`);
      assert.notEqual(a.layout, b.layout, `level ${level}: rooms ${r + 1} and ${r + 2} share a layout`);
    }
  }
});

test('A FIVE-ROOM LEVEL USES FIVE DIFFERENT THEMES AND FIVE DIFFERENT LAYOUTS', () => {
  for (let level = 1; level <= 6; level++) {
    const looks = [0, 1, 2, 3, 4].map((r) => lookFor(level, r));
    assert.equal(new Set(looks.map((l) => l.theme)).size, 5, `level ${level} repeats a theme`);
    assert.equal(new Set(looks.map((l) => l.layout)).size, 5, `level ${level} repeats a layout`);
  }
});

test('LEVEL TWO DOES NOT OPEN ON THE SAME ROOM LEVEL ONE DID', () => {
  assert.notDeepEqual(lookFor(2, 0), lookFor(1, 0));
});

test('A LOOK IS A PURE FUNCTION OF WHERE YOU ARE', () => {
  assert.deepEqual(lookFor(3, 2), lookFor(3, 2));
});

test('NO ROOM EVER USES THE GREY DAIS -- its painted steps are what Elad rejected', () => {
  // "we should not do anything with height depth - like the stairs with the
  // shadow". The art is kept, but a room that used it would put the stairs back.
  // A first version of the rotation did exactly that, because it was free.
  for (let level = 1; level <= 8; level++) {
    for (let r = 0; r < 5; r++) {
      const { theme } = lookFor(level, r);
      assert.notEqual(THEMES[theme].floor, 'stone', `level ${level} room ${r + 1} uses the dais (theme ${theme})`);
    }
  }
});

test('A THEME ONLY HAS A GLOW RING IF ITS PAINTING HAS RUNES TO SIT ON', () => {
  for (const [k, t] of Object.entries(THEMES)) {
    const hasRunes = FLOORS[t.floor].runeR !== null;
    assert.equal(t.ring !== null, hasRunes, `${k}: ring ${t.ring ? 'set' : 'null'} but floor ${t.floor} ${hasRunes ? 'has' : 'has no'} runes`);
  }
});

test('THE GAME LOADS EVERY PAINTING A ROOM CAN USE, and not the one none does', () => {
  const loaded = new Set(usedFloors());
  for (let level = 1; level <= 6; level++) {
    for (let r = 0; r < 5; r++) {
      assert.ok(loaded.has(THEMES[lookFor(level, r).theme].floor), `level ${level} room ${r + 1}: its floor would not be loaded`);
    }
  }
  assert.equal(loaded.has('stone'), false, 'the unused dais is being loaded into memory anyway');
});

test('THE NEW FLOORS ARE AS BRIGHT AS THE PLAZA, not dim', async () => {
  // The first plaza measured 0.480 and was "simply dim"; the shipped one is 0.829.
  // A floor is most of the screen, so its value sets the room's. Decode the real
  // files and measure, rather than trusting the grading script's printout.
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync('python3', ['-c', `
import colorsys, sys, warnings
warnings.filterwarnings('ignore')
from PIL import Image
for n in ('warm','sewer','roof','tech'):
    im = Image.open('public/tex/floor_%s.webp' % n).convert('RGB').resize((64,64))
    px = list(im.getdata())
    print(n, sum(colorsys.rgb_to_hsv(r/255,g/255,b/255)[2] for r,g,b in px)/len(px))
`], { encoding: 'utf8' });
  for (const line of out.trim().split('\n')) {
    const [name, v] = line.split(' ');
    assert.ok(Number(v) > 0.7, `${name} floor has mean value ${Number(v).toFixed(3)}, which is dim`);
  }
});
