// The Foot Clan exists to answer one board question -- can a player SEE a
// swing coming and step out of it -- so the tests are about the telegraph and
// about the two arrays staying one truth, not about pathing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, ARENA } from '../src/core/world.js';
import { FOE, makeFoe, spawnPoint, updateFoes, updateFoeShots, hurtPlayer } from '../src/core/foes.js';
import { BREEDS, DEFAULT_BREED } from '../src/core/breeds.js';

// WHAT A BARE makeFoe() ACTUALLY PRODUCES. Every tunable is copied onto the
// foe at birth from its BREED, so a test that asserts against core/foes.js's
// module constants is asserting against a default the foe never used. It
// passed only while the default breed happened to share those numbers.
const B = BREEDS[DEFAULT_BREED];

function worldWithFoe(dx, dy) {
  const w = createWorld();
  const f = makeFoe(w.player.x + dx, w.player.y + dy, 0);
  w.foes.push(f);
  w.targets.push(f);
  return { w, f };
}

/** Step the sim in small slices, the way the frame loop does. */
function run(w, seconds, dt = 1 / 60, onStrike) {
  for (let t = 0; t < seconds; t += dt) {
    w.timeS += dt;
    updateFoes(w, dt, onStrike);
  }
}

test('a foe walks AT the player and stops at its reach', () => {
  const { w, f } = worldWithFoe(900, 0);
  run(w, 6);
  const d = Math.hypot(f.x - w.player.x, f.y - w.player.y);
  assert.ok(d <= B.reach + 1, `stopped at ${d.toFixed(0)}px, reach is ${B.reach}`);
});

test('IT TELEGRAPHS BEFORE IT HITS -- the whole experiment', () => {
  const { w } = worldWithFoe(B.reach - 5, 0);
  // Step just short of the windup: it must have committed to a swing and NOT
  // yet taken anything. An enemy that damages on contact cannot be dodged, and
  // cannot tell us whether the board is responsive enough to dodge with.
  run(w, B.windupS - 0.05);
  assert.equal(w.foes[0].state, 'windup');
  assert.equal(w.hp, w.maxHp, 'damage landed before the telegraph finished');
});

test('and then it does hit', () => {
  const { w } = worldWithFoe(B.reach - 5, 0);
  let struck = 0;
  run(w, B.windupS + 0.1, 1 / 60, () => struck++);
  assert.equal(struck, 1);
  assert.equal(w.hp, w.maxHp - B.damage);
});

test('STEPPING OUT OF REACH DURING THE WINDUP IS A DODGE', () => {
  const { w, f } = worldWithFoe(B.reach - 5, 0);
  run(w, B.windupS - 0.08);
  assert.equal(f.state, 'windup');
  // The player walks away mid-swing. The strike re-measures on the release
  // frame, so this has to miss -- if it does not, the telegraph is decoration.
  w.player.x -= B.reach + FOE.strikeSlack + 60;
  run(w, 0.2);
  assert.equal(w.hp, w.maxHp, 'the swing connected from out of range');
});

test('but a near miss still lands, so one pixel is not the difference', () => {
  const { w } = worldWithFoe(B.reach - 5, 0);
  run(w, B.windupS - 0.08);
  w.player.x -= FOE.strikeSlack - 10;     // drifted, but only just
  run(w, 0.2);
  assert.equal(w.hp, w.maxHp - B.damage);
});

test('it does not swing forever -- there is a recovery before the next one', () => {
  const { w } = worldWithFoe(B.reach - 5, 0);
  let struck = 0;
  run(w, B.windupS + 0.05, 1 / 60, () => struck++);
  assert.equal(struck, 1);
  run(w, B.recoverS - 0.1, 1 / 60, () => struck++);
  assert.equal(struck, 1, 'a second hit landed inside the recovery');
});

test('running out of health ends the run exactly once', () => {
  const w = createWorld();
  for (let i = 0; i < 50; i++) hurtPlayer(w, 10);
  assert.equal(w.hp, 0);
  assert.equal(w.dead, true);
  const at = w.diedAtS;
  hurtPlayer(w, 10);
  assert.equal(w.diedAtS, at, 'death time moved after the player was already dead');
});

test('a dead foe is removed from BOTH arrays, never one', () => {
  // They are the same objects seen two ways; one array outliving the other is
  // the failure this arrangement has to be protected from.
  const { w, f } = worldWithFoe(300, 0);
  f.alive = false;
  f.deadAtS = 0;
  w.timeS = FOE.corpseS + 1;
  updateFoes(w, 1 / 60);
  assert.equal(w.foes.length, 0);
  assert.equal(w.targets.includes(f), false);
});

test('a corpse is NOT culled while it is still playing its death', () => {
  const { w, f } = worldWithFoe(300, 0);
  f.alive = false;
  f.deadAtS = 0;
  w.timeS = FOE.corpseS * 0.5;
  updateFoes(w, 1 / 60);
  assert.equal(w.foes.length, 1);
});

test('they spawn OFF SCREEN, not on top of you', () => {
  const w = createWorld();
  for (let i = 0; i < 40; i++) {
    const p = spawnPoint(w.player.x, w.player.y, Math.random);
    const d = Math.hypot(p.x - w.player.x, p.y - w.player.y);
    // Half a 20-unit view is 1000 sim px; anything closer walks into frame
    // already on top of the player.
    assert.ok(d > 1000, `spawned ${d.toFixed(0)}px away`);
    assert.ok(p.x >= 0 && p.x <= ARENA.width && p.y >= 0 && p.y <= ARENA.height);
  }
});

test('a player jammed into a corner still gets enemies', () => {
  // Every ring angle clamps against a wall here, which is exactly the case the
  // naive version answers by spawning nothing and leaving the arena empty.
  const p = spawnPoint(FOE.radius + 10, FOE.radius + 10, () => 0.5);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  const d = Math.hypot(p.x - FOE.radius, p.y - FOE.radius);
  assert.ok(d > 1000, `corner spawn landed ${d.toFixed(0)}px away`);
});

test('a crowd does not converge into one body', () => {
  const w = createWorld();
  for (let i = 0; i < 6; i++) {
    const f = makeFoe(w.player.x + 600 + i, w.player.y + i, 0);
    w.foes.push(f); w.targets.push(f);
  }
  run(w, 5);
  for (let i = 0; i < w.foes.length; i++) {
    for (let j = i + 1; j < w.foes.length; j++) {
      const d = Math.hypot(w.foes[i].x - w.foes[j].x, w.foes[i].y - w.foes[j].y);
      assert.ok(d > FOE.radius, `two foes ${d.toFixed(0)}px apart -- they merged`);
    }
  }
});

test('a dead foe stops walking and stops swinging', () => {
  const { w, f } = worldWithFoe(B.reach - 5, 0);
  f.alive = false;
  f.deadAtS = 0;
  let struck = 0;
  run(w, 1, 1 / 60, () => struck++);
  assert.equal(struck, 0);
  assert.equal(w.hp, w.maxHp);
});

test('A FOE LINED UP BEHIND A PILLAR STILL GETS ROUND IT AND REACHES YOU', () => {
  // Through the real update loop, not just the push-out: the side-nudge in
  // makeFoe is what stops a chaser standing still behind an obstacle while the
  // player waits on the far side.
  for (let i = 0; i < 6; i++) {                     // both sides, several foes
    const w = createWorld();
    const pillar = { kind: 'circle', x: w.player.x - 300, y: w.player.y, r: 90, tall: true };
    w.obstacles = [pillar];
    const f = makeFoe(w.player.x - 700, w.player.y, 0);
    w.foes.push(f); w.targets.push(f);
    let reached = false;
    for (let t = 0; t < 30 && !reached; t += 1 / 60) {
      w.timeS += 1 / 60;
      updateFoes(w, 1 / 60);
      reached = Math.hypot(f.x - w.player.x, f.y - w.player.y) <= B.reach + 5;
    }
    assert.ok(reached, `foe ${i} (side ${f.side}) never got round the pillar; stopped at x=${f.x.toFixed(0)}`);
  }
});

test('A FOE IS NEVER LEFT INSIDE AN OBSTACLE, even when a crowd is pushing it in', () => {
  const w = createWorld();
  const o = { kind: 'rect', x: w.player.x + 600, y: w.player.y, hw: 60, hh: 400, tall: true };
  w.obstacles = [o];
  for (let i = 0; i < 8; i++) {
    const f = makeFoe(w.player.x + 1000, w.player.y - 300 + i * 80, 0);
    w.foes.push(f); w.targets.push(f);
  }
  for (let t = 0; t < 10; t += 1 / 60) {
    w.timeS += 1 / 60;
    updateFoes(w, 1 / 60);
    for (const f of w.foes) {
      const cx = Math.max(o.x - o.hw, Math.min(o.x + o.hw, f.x)), cy = Math.max(o.y - o.hh, Math.min(o.y + o.hh, f.y));
      assert.ok(Math.hypot(f.x - cx, f.y - cy) >= f.radius - 0.5, `a foe is inside the wall at t=${t.toFixed(2)}`);
    }
  }
});

test('SPAWNS NEVER LAND INSIDE AN OBSTACLE', () => {
  const w = createWorld();
  // one big obstacle on the ring, so a careless spawn would often hit it
  const obs = [{ kind: 'circle', x: w.player.x + 1400, y: w.player.y, r: 300, tall: true }];
  let s = 7; const rng = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 400; i++) {
    const p = spawnPoint(w.player.x, w.player.y, rng, obs);
    assert.ok(Math.hypot(p.x - obs[0].x, p.y - obs[0].y) >= obs[0].r + 130 - 1e-6, `spawn ${i} is inside the obstacle`);
  }
});

// ---- THE SWEEP THAT THE SOAK TEST FORCED ------------------------------------------
// A Fort Golem once stood pinned against a rooftop barricade for four minutes. The
// single-pillar test above never caught it because it only covered a foe dead
// behind a round obstacle; this covers every breed, in every layout, approaching
// from all eight sides, with both tie-break directions. If ANY of them can be
// pinned forever, a room can never be cleared.

test('NO FOE CAN BE PINNED FOREVER: every breed reaches a waiting player, in every layout, from every side', async () => {
  const { LAYOUTS, layoutObstacles } = await import('../src/core/looks.js');
  const { BREEDS } = await import('../src/core/breeds.js');
  const stuck = [];
  for (const layout of Object.keys(LAYOUTS)) {
    const obstacles = layoutObstacles(layout);
    for (const breed of Object.keys(BREEDS)) {
      for (let k = 0; k < 8; k++) {
        for (const side of [1, -1]) {
          const w = createWorld();
          w.maxHp = w.hp = 1e9;
          w.obstacles = obstacles;
          const a = (k / 8) * Math.PI * 2;
          const f = makeFoe(w.player.x + Math.cos(a) * 1250, w.player.y + Math.sin(a) * 1250, 0, breed);
          f.side = side;
          // "arrived" means close enough to do its job -- a thrower never closes to melee
          const near = Math.max(f.reach, f.job?.trigger ?? 0, f.job?.keepMax ?? 0, f.job?.chargeMax ?? 0) + 80;
          w.foes.push(f); w.targets.push(f);
          let arrived = false;
          for (let t = 0; t < 70 && !arrived; t += 1 / 30) {
            w.timeS += 1 / 30;
            updateFoes(w, 1 / 30);
            updateFoeShots(w, 1 / 30);
            arrived = Math.hypot(f.x - w.player.x, f.y - w.player.y) <= near;
          }
          if (!arrived) stuck.push(`${breed} in "${layout}" from ${(k * 45)}deg, side ${side}: stopped at ${Math.round(f.x)},${Math.round(f.y)}`);
        }
      }
    }
  }
  assert.deepEqual(stuck, [], `${stuck.length} cases pinned:\n  ${stuck.slice(0, 8).join('\n  ')}`);
});

// ---- KNOCKBACK: every attack shoves by its own amount ------------------------------
import { updateWorld } from '../src/core/world.js';

function shoved(push, ticks = 40) {
  const w = createWorld();
  const x0 = w.player.x;
  hurtPlayer(w, 1, push, x0 - 100, w.player.y);      // hit from the left: shove goes right
  for (let i = 0; i < ticks; i++) updateWorld(w, { x: 0, y: 0 }, 1 / 60);
  return w.player.x - x0;
}

test('A SHOVE MOVES THE PLAYER AWAY FROM THE ATTACK BY EXACTLY ITS PUSH VALUE, then stops', () => {
  assert.ok(Math.abs(shoved(200) - 200) < 3, `moved ${shoved(200).toFixed(1)}`);
  assert.equal(shoved(200, 60), shoved(200, 90), 'it kept sliding after the shove ended');
});
test('a bigger push throws further, and zero push does not move anyone', () => {
  assert.ok(shoved(300) > shoved(100) * 2.5);
  assert.equal(shoved(0), 0);
});
test('A SHOVE CANNOT THROW THE PLAYER OUT OF THE ARENA', () => {
  const w = createWorld();
  w.player.x = w.playerRadius + 5;
  hurtPlayer(w, 1, 400, w.player.x + 100, w.player.y);     // from the right, towards the wall
  for (let i = 0; i < 40; i++) updateWorld(w, { x: 0, y: 0 }, 1 / 60);
  assert.ok(w.player.x >= w.playerRadius - 0.01);
});
test('EVERY ATTACK HAS ITS OWN PUSH, and the big ones throw you further than the small ones', () => {
  assert.ok(BREEDS.slayer.push > 0 && BREEDS.fortgolem.push > BREEDS.slayer.push);
  assert.ok(BREEDS.mechgolem.job.push > BREEDS.mechgolem.push, 'the charge hits harder than the swing');
  assert.ok(BREEDS.elemgolem.job.push > BREEDS.elemgolem.push, 'the slam hits harder than the swing');
  assert.ok(BREEDS.evilgod.job.push < BREEDS.slayer.push, 'an orb is a flick, not a shove');
});
test('a melee hit shoves along the line from the foe, through the real update loop', () => {
  const { w } = worldWithFoe(B.reach - 5, 0);
  const x0 = w.player.x;
  run(w, B.windupS + 0.05);
  for (let i = 0; i < 20; i++) updateWorld(w, { x: 0, y: 0 }, 1 / 60);
  assert.ok(x0 - w.player.x > 20, `shoved only ${(x0 - w.player.x).toFixed(1)}px away from the foe`);
});
