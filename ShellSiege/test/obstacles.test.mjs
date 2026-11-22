// THINGS YOU CANNOT WALK THROUGH. A body must never end a frame inside one, must
// slide rather than stick, and a chaser must never stand still behind a pillar
// while the player waits on the other side.

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCircle, overlapsAny, blocksShot } from '../src/core/obstacles.js';
import { createWorld, updateWorld, ARENA } from '../src/core/world.js';

const pillar = (x, y, r = 70, tall = true) => ({ kind: 'circle', x, y, r, tall });
const wall = (x, y, hw, hh, tall = true) => ({ kind: 'rect', x, y, hw, hh, tall });

test('A BODY INSIDE A CIRCLE IS PUSHED OUT TO EXACTLY ITS EDGE', () => {
  const p = { x: 30, y: 0 };
  assert.equal(resolveCircle(p, 40, [pillar(0, 0, 70)]), true);
  assert.ok(Math.abs(Math.hypot(p.x, p.y) - 110) < 1e-6, `ended ${Math.hypot(p.x, p.y)} from the centre`);
});

test('A BODY THAT IS NOT TOUCHING ANYTHING IS LEFT ALONE', () => {
  const p = { x: 500, y: 500 };
  assert.equal(resolveCircle(p, 40, [pillar(0, 0), wall(900, 0, 50, 50)]), false);
  assert.deepEqual(p, { x: 500, y: 500 });
});

test('DEAD CENTRE HAS NO DIRECTION, and must not produce NaN', () => {
  const p = { x: 0, y: 0 };
  resolveCircle(p, 40, [pillar(0, 0, 70)]);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  assert.ok(Math.hypot(p.x, p.y) >= 110 - 1e-6);
});

test('A RECTANGLE PUSHES OUT FROM ITS EDGE, from a corner, and from the inside', () => {
  const w = wall(0, 0, 200, 40);
  const edge = { x: 0, y: -60 };                    // 60 above the top face (y = -40), radius 42
  resolveCircle(edge, 42, [w]);
  assert.ok(edge.y <= -40 - 42 + 1e-6, 'still overlapping the top face');
  const corner = { x: 215, y: -50 };                // diagonal off the top-right corner
  resolveCircle(corner, 42, [w]);
  assert.ok(Math.hypot(corner.x - 200, corner.y + 40) >= 42 - 1e-6, 'still inside the corner');
  const inside = { x: 150, y: 30 };                 // centre INSIDE the rectangle
  resolveCircle(inside, 42, [w]);
  assert.equal(overlapsAny(inside.x, inside.y, 42, [w]), false, 'did not get out');
});

test('WALKING INTO A WALL AT AN ANGLE SLIDES ALONG IT instead of sticking', () => {
  const w = wall(0, 0, 500, 40);
  const p = { x: -200, y: -200 };
  const startX = p.x;
  for (let i = 0; i < 90; i++) {
    p.x += 6; p.y += 6;                              // keeps pushing down-right
    resolveCircle(p, 42, [w]);
    assert.ok(p.y <= -40 - 42 + 1e-6, `crossed the wall at step ${i}`);
  }
  assert.ok(p.x > startX + 300, `stuck: moved only ${p.x - startX}px along the wall`);
});

test('TWO OBSTACLES AT A CORNER: ending a frame inside neither', () => {
  const obs = [wall(0, 0, 300, 40), pillar(340, -90, 60)];
  const p = { x: 320, y: -40 };                       // wedged where they meet
  resolveCircle(p, 42, obs);
  assert.equal(overlapsAny(p.x, p.y, 42 - 0.01, obs), false);
});

test('A CHASER LINED UP DEAD BEHIND A PILLAR STALLS WITHOUT THE NUDGE -- and passes with it', () => {
  // The control matters: it shows the failure is real, so the nudge in
  // core/foes.js is load-bearing and not decoration.
  const pass = (tangent) => {
    const obs = [pillar(0, 0, 70)];
    const f = { x: -400, y: 0 };
    for (let i = 0; i < 60 * 20; i++) {
      f.x += 2.75;                                    // 165 px/s at 60 fps, straight at the target
      resolveCircle(f, 40, obs, tangent);
      if (f.x > 400) return true;
    }
    return false;
  };
  assert.equal(pass(0), false, 'the control should stall; if it does not, the problem is not what we think');
  assert.equal(pass(1.4), true, 'a nudge of half a step should get a chaser round');
});

test('ONLY TALL OBSTACLES STOP A THROWN THING; low ones are flown over', () => {
  const obs = [pillar(0, 0, 70, true), pillar(500, 0, 70, false)];
  assert.equal(blocksShot(0, 0, 20, obs), true);
  assert.equal(blocksShot(500, 0, 20, obs), false, 'rubble must not stop an orb');
  assert.equal(blocksShot(250, 0, 20, obs), false);
});

test('THE PLAYER CANNOT WALK INTO A PILLAR -- on any frame, and he ends up STOPPED at it', () => {
  // The first version of this checked only where he finished. He finished at the
  // far wall, having walked straight through, and the test passed before
  // obstacles were wired in at all. So: check EVERY frame, and check he stopped.
  const w = createWorld();
  const o = pillar(w.player.x + 300, w.player.y, 80);
  w.obstacles = [o];
  const minD = o.r + w.playerRadius;
  for (let i = 0; i < 600; i++) {
    updateWorld(w, { x: 1, y: 0 }, 1 / 60);
    const d = Math.hypot(w.player.x - o.x, w.player.y - o.y);
    assert.ok(d >= minD - 1e-6, `inside the pillar on frame ${i}: ${d.toFixed(1)} < ${minD}`);
  }
  assert.ok(Math.abs(w.player.x - (o.x - minD)) < 1, `should be pinned at the pillar, was at x=${w.player.x.toFixed(0)}`);
});

test('A PLAYER LEANING ACROSS A PILLAR SLIDES ROUND IT rather than sticking', () => {
  const w = createWorld();
  // Aimed a little ABOVE the pillar's centre, so he strikes it off-centre and
  // is turned aside; a head-on hit has no side to slide to, and a path that
  // clears the pillar altogether proves nothing.
  const o = pillar(w.player.x + 300, w.player.y - 25, 80);
  w.obstacles = [o];
  const minD = o.r + w.playerRadius;
  for (let i = 0; i < 600; i++) {
    updateWorld(w, { x: 1, y: 0 }, 1 / 60);
    assert.ok(Math.hypot(w.player.x - o.x, w.player.y - o.y) >= minD - 1e-6, `inside the pillar on frame ${i}`);
  }
  assert.ok(w.player.x > o.x + 150, `did not get past the pillar: x=${w.player.x.toFixed(0)}`);
});

test('A BODY PINNED ON A WALL HEADS FOR THE NEARER END, whatever its intent or tie-break side', () => {
  // Following intent alone converges on the point of the wall nearest the player,
  // which is where a crowd piles up and jams (a Fort Golem and four summoned
  // Slayers stood wedged there for a minute). The way round is the nearer END.
  const w = wall(0, 0, 800, 46);
  for (const side of [1, -1]) {
    for (const dx of [-0.5, 0, 0.5]) {                         // intent west, straight in, east
      const p = { x: 300, y: -(46 + 115) + 5 };                // east of centre: the east end is nearer
      const x0 = p.x;
      resolveCircle(p, 115, [w], { dx, dy: 0.87, step: 1.5, side, commit: 0, chosen: 0 });
      assert.ok(p.x > x0, `side ${side}, intent ${dx}: moved ${(p.x - x0).toFixed(2)}, away from the nearer end`);
    }
  }
  const west = { x: -300, y: -(46 + 115) + 5 };
  resolveCircle(west, 115, [w], { dx: 0.5, dy: 0.87, step: 1.5, side: 1, commit: 0, chosen: 0 });
  assert.ok(west.x < -300, 'west of centre, the nearer end is the west one');
});

test('ROUND OBSTACLES HAVE NO ENDS, so intent decides which way to go round', () => {
  // As in the game: the body has ALREADY taken its intended step into the
  // obstacle, and the slide is applied on top of the push-out. (Calling the
  // function on a body that has not moved leaves out the natural part of the
  // slide, which is what a first version of this test did, wrongly.)
  const o = [pillar(0, 0, 70)];
  const go = (iy) => {
    const ix = 0.3, len = Math.hypot(ix, iy), step = 3;
    const p = { x: -110, y: 0 };                                // resting on the pillar's west side
    p.x += (ix / len) * step; p.y += (iy / len) * step;         // its intended step, into the pillar
    resolveCircle(p, 40, o, { dx: ix / len, dy: iy / len, step, side: 1, commit: 0, chosen: 0 });
    return p.y;
  };
  assert.ok(go(0.95) > 0.5, 'heading down, it should have been carried down');
  assert.ok(go(-0.95) < -0.5, 'heading up, it should have been carried up');
});

test('A COMMITTED SLIDE KEEPS ITS SENSE EVEN WHEN INTENT FLIPS -- the hover-on-the-threshold trap', () => {
  // The bug: just off a wall's centre, intent along it flickered across the
  // threshold, so a foe slid away, then back, then away -- pinned forever. Once a
  // sense is committed it must hold, whatever the intent does next.
  const w = wall(0, 0, 800, 46);
  const press = (dx, commit) => {
    const p = { x: 0, y: -(46 + 39) + 3 };
    const slide = { dx, dy: 0.99, step: 1.5, side: 1, commit, chosen: 0 };
    const x0 = p.x;
    resolveCircle(p, 39, [w], slide);
    return { moved: p.x - x0, chosen: slide.chosen };
  };
  const first = press(-0.2, 0);
  assert.ok(first.chosen !== 0, 'the first contact must choose a way round');
  const again = press(+0.2, first.chosen);          // intent now points the OTHER way
  assert.equal(Math.sign(again.moved), Math.sign(first.moved), 'it turned back on itself');
});

test('A BODY HEADING STRAIGHT INTO A SURFACE USES THE TIE-BREAK SIDE, one way each', () => {
  const o = [pillar(0, 0, 70)];
  const run = (side) => { const p = { x: -100, y: 0 }; resolveCircle(p, 40, o, { dx: 1, dy: 0, step: 3, side }); return p.y; };
  // (which way "side 1" goes is the surface's convention; what matters is that the two differ)
  assert.ok(run(1) * run(-1) < 0, 'an aligned body must be split to either side, not left standing');
});
