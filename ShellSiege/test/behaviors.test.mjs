// THE JOBS. Each enemy has a rhythm the player is meant to learn, and what makes
// a rhythm learnable is the WARNING. So these tests pin the contract rather than
// the numbers: the warning is shown, the danger is decided where the player is
// when it goes off (not where he was when the warning began), and the thing the
// player is meant to do about it actually works.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/core/world.js';
import { BREEDS } from '../src/core/breeds.js';
import { makeFoe, updateFoes, updateFoeShots, applyLevel } from '../src/core/foes.js';
import { BEHAVIORS, TELEGRAPH_STATES } from '../src/core/behaviors.js';

const DT = 1 / 60;
const PR = 42;   // the player's radius

/** A world with one foe `dist` px to the player's right, its cooldown cleared so the job starts at once. */
function setup(breed, dist, level = 1) {
  const w = createWorld();
  w.maxHp = w.hp = 1000;
  const f = makeFoe(w.player.x + dist, w.player.y, 0, breed);
  if (level > 1) applyLevel(f, level);
  f.b = { cool: 0, casts: 0, dx: 1, dy: 0, left: 0, hit: false };
  w.foes.push(f); w.targets.push(f);
  return { w, f };
}

/** Step the world; `each(t, frame)` runs before every frame so a test can move the player. */
function run(w, seconds, each) {
  let frame = 0;
  for (let t = 0; t < seconds; t += DT, frame++) {
    if (each && each(t, frame) === 'stop') return t;
    w.timeS += DT;
    updateFoes(w, DT);
    updateFoeShots(w, DT);
  }
  return seconds;
}
const until = (w, seconds, cond) => run(w, seconds, () => (cond() ? 'stop' : undefined));
const dist = (w, f) => Math.hypot(f.x - w.player.x, f.y - w.player.y);

// ---------------------------------------------------------------- all of them
test('EVERY BREED NAMES A BEHAVIOUR THAT EXISTS, with the numbers that behaviour reads', () => {
  const need = {
    melee: [],
    thrower: ['keepMin', 'keepMax', 'throwEvery', 'windupS', 'shotSpeed', 'shotRadius', 'shotDamage', 'shotLifeS'],
    charger: ['chargeMin', 'chargeMax', 'dist', 'speed', 'every', 'windupS', 'stunS', 'hitDamage'],
    slammer: ['trigger', 'radius', 'every', 'windupS', 'damage'],
    summoner: ['first', 'every', 'max', 'count', 'breed', 'windupS'],
  };
  for (const [k, b] of Object.entries(BREEDS)) {
    assert.ok(BEHAVIORS[b.behavior], `${k}: behaviour "${b.behavior}" does not exist`);
    for (const field of need[b.behavior]) assert.ok(b.job && b.job[field] !== undefined, `${k}: job.${field} missing`);
  }
});

test('THE FIVE BREEDS HAVE FIVE DIFFERENT JOBS -- that was the whole request', () => {
  const jobs = Object.values(BREEDS).map((b) => b.behavior);
  assert.equal(new Set(jobs).size, jobs.length, `two breeds share a job: ${jobs.join(', ')}`);
  assert.equal(BREEDS.slayer.behavior, 'melee', 'the Slayer stays the plain fast soldier');
});

test('A FOE SHOWS ITS WARNING ONLY WHILE IT IS WARNING, and every warning state shows one', () => {
  for (const breed of ['evilgod', 'mechgolem', 'elemgolem', 'fortgolem']) {
    const { w, f } = setup(breed, breed === 'evilgod' ? 700 : 280);
    const seen = new Set();
    run(w, 14, () => {
      if (TELEGRAPH_STATES.has(f.state) && f.state !== 'windup') {
        assert.ok(f.tell, `${breed} is in "${f.state}" with nothing to draw`);
        seen.add(f.state);
      } else if (!TELEGRAPH_STATES.has(f.state)) {
        assert.equal(f.tell, null, `${breed} shows a warning while in "${f.state}"`);
      }
    });
    assert.ok(seen.size >= 1, `${breed} never warned in 14 seconds`);
  }
});

test('A JOB\'S DAMAGE GROWS WITH THE LEVEL, not only the body\'s hit points', () => {
  const a = makeFoe(0, 0, 0, 'evilgod'), b = applyLevel(makeFoe(0, 0, 0, 'evilgod'), 4);
  assert.ok(b.job.shotDamage > a.job.shotDamage);
  assert.equal(BREEDS.evilgod.job.shotDamage, a.job.shotDamage, 'the breed table itself was changed');
});

// ---------------------------------------------------------------- Evil God
test('THE THROWER HOLDS A RING AROUND YOU: it closes in from afar and backs off when you rush it', () => {
  const far = setup('evilgod', 1100);
  run(far.w, 8);
  const j = BREEDS.evilgod.job;
  const d = dist(far.w, far.f);
  assert.ok(d < j.keepMax + 80, `still ${d.toFixed(0)}px away after 8s`);
  const near = setup('evilgod', 150);
  run(near.w, 4);
  assert.ok(dist(near.w, near.f) > j.keepMin - 80, `did not back off: ${dist(near.w, near.f).toFixed(0)}px`);
});

test('THE THROWER WARNS, THEN THROWS; THE ORB HURTS ONCE AND IS GONE', () => {
  const { w, f } = setup('evilgod', 450);
  const hp0 = w.hp;
  let sawOrb = false;
  until(w, 6, () => {
    if (f.state === 'throw') { assert.equal(f.tell.kind, 'orb'); sawOrb = true; }
    return w.foeShots.length > 0;
  });
  assert.ok(sawOrb, 'threw without showing the wind-up');
  assert.equal(w.hp, hp0, 'hurt before the orb had even travelled');
  until(w, 3, () => w.hp < hp0);
  assert.equal(hp0 - w.hp, BREEDS.evilgod.job.shotDamage, 'one orb must do exactly one orb of damage');
  assert.equal(w.foeShots.filter((s) => s.alive && s.from === f.id && Math.hypot(s.x - w.player.x, s.y - w.player.y) < 50).length, 0, 'the orb is still there after hitting');
});

test('AN ORB IS DODGED BY MOVING: it is aimed at release and does not home', () => {
  const { w, f } = setup('evilgod', 450);
  const hp0 = w.hp;
  let moved = false;
  run(w, 4, () => {
    if (!moved && w.foeShots.length > 0) { w.player.y += 400; moved = true; }     // step aside once it is in the air
  });
  assert.ok(moved, 'it never threw');
  assert.equal(w.hp, hp0, 'the orb homed in on a player who had stepped aside');
});

test('A TALL OBSTACLE STOPS AN ORB IN FLIGHT, A LOW ONE DOES NOT', () => {
  // Built by hand rather than through the thrower: a thrower now refuses to throw
  // at something it cannot see (below), so "it threw into the pillar" is no longer
  // a thing it does. What has to stay true is what happens to an orb that is
  // ALREADY in the air when something tall steps into its path -- the player ducks
  // behind a pillar after the throw -- and that rubble does nothing to it.
  const trial = (tall) => {
    const w = createWorld();
    w.maxHp = w.hp = 1000;
    w.obstacles = [{ kind: 'circle', x: w.player.x + 225, y: w.player.y, r: 70, tall }];
    const spec = BREEDS.evilgod.job;
    w.foeShots.push({ x: w.player.x + 450, y: w.player.y, vx: -spec.shotSpeed, vy: 0, r: spec.shotRadius,
                      damage: spec.shotDamage, lifeS: spec.shotLifeS, alive: true, from: -1 });
    for (let t = 0; t < 3; t += DT) updateFoeShots(w, DT);
    return w.hp;
  };
  assert.equal(trial(true), 1000, 'an orb passed through a pillar');
  assert.ok(trial(false) < 1000, 'rubble was treated as cover');
});

test('A THROWER WITH A WALL BETWEEN US DOES NOT THROW INTO IT: it works round to a clear shot', () => {
  // Found by the soak test, which watched an Evil God throw orb after orb into a
  // barricade it could not see through, from a spot it never left.
  const { w, f } = setup('evilgod', 450);
  w.obstacles = [{ kind: 'rect', x: w.player.x + 225, y: w.player.y, hw: 40, hh: 700, tall: true }];
  let thrownWhileBlocked = 0;
  const hp0 = w.hp;
  run(w, 45, () => {
    if (f.state === 'throw') {
      const clear = (() => { const n = 40; for (let i = 1; i < n; i++) { const x = f.x + (w.player.x - f.x) * i / n, y = f.y + (w.player.y - f.y) * i / n; if (Math.abs(x - w.obstacles[0].x) < 40 + 24 && Math.abs(y - w.obstacles[0].y) < 700) return false; } return true; })();
      if (!clear) thrownWhileBlocked++;
    }
  });
  assert.equal(thrownWhileBlocked, 0, 'it threw into the wall');
  assert.ok(w.hp < hp0, 'it never found a way to a clear shot');
});

// ---------------------------------------------------------------- Mechanical Golem
test('THE CHARGER LOCKS A LINE AND DOES NOT FOLLOW YOU: a sideways step dodges it', () => {
  const { w, f } = setup('mechgolem', 520);
  const hp0 = w.hp;
  let lock = null;
  // ONE charge only. Run on and it charges a second time, toward wherever the
  // player has moved to, and a test that kept the first line would then be
  // comparing a new dash against an old lock and calling the charger a cheat.
  until(w, 6, () => {
    if (f.state === 'charge' && !lock) {
      assert.equal(f.tell.kind, 'line');
      lock = { dx: f.tell.dx, dy: f.tell.dy };
      w.player.y += 600;                                  // step aside as soon as the warning starts
    }
    if (f.state === 'dash') assert.ok(Math.abs(Math.atan2(lock.dy, lock.dx) - f.facing) < 1e-6, 'steered during the dash');
    return lock && f.state === 'recover';                 // the first dash is over
  });
  assert.ok(lock, 'never charged');
  assert.equal(f.state, 'recover', 'the dash never finished');
  assert.equal(w.hp, hp0, 'it hit a player who was no longer on the line');
});

test('STANDING IN THE LINE GETS YOU HIT EXACTLY ONCE PER CHARGE', () => {
  const { w } = setup('mechgolem', 520);
  const hp0 = w.hp;
  const t = until(w, 8, () => w.hp < hp0);
  assert.ok(t < 8, 'never hit a player who stood still');
  run(w, 0.6);
  assert.equal(hp0 - w.hp, BREEDS.mechgolem.job.hitDamage, 'hit more than once in one charge');
});

test('A CHARGER THAT CRASHES INTO A PILLAR IS STUNNED, then recovers', () => {
  const { w, f } = setup('mechgolem', 600);
  // a tall pillar on the line, between it and the player
  w.obstacles = [{ kind: 'circle', x: w.player.x + 300, y: w.player.y, r: 70, tall: true }];
  const t0 = until(w, 8, () => f.state === 'stunned');
  assert.ok(t0 < 8, `never crashed (state ${f.state})`);
  const stunned = run(w, 5, () => (f.state !== 'stunned' ? 'stop' : undefined));
  assert.ok(stunned >= BREEDS.mechgolem.job.stunS - 0.1, `recovered after only ${stunned.toFixed(2)}s`);
  assert.equal(f.state, 'walk', `came out of the stun into "${f.state}"`);
});

test('A CHARGER RESTS BETWEEN CHARGES', () => {
  const { w, f } = setup('mechgolem', 520);
  let charges = 0, prev = f.state;
  run(w, 6, () => { if (f.state === 'charge' && prev !== 'charge') charges++; prev = f.state; });
  assert.ok(charges <= Math.ceil(6 / BREEDS.mechgolem.job.every) + 1, `${charges} charges in 6 seconds`);
});

// ---------------------------------------------------------------- Elemental Golem
test('THE SLAMMER WARNS WITH THE EXACT RING IT WILL HIT, and hurts you if you stay in it', () => {
  const { w, f } = setup('elemgolem', 250);
  const hp0 = w.hp;
  let ring = null;
  run(w, 6, () => { if (f.state === 'slam') ring = f.tell; });
  assert.ok(ring, 'never slammed');
  assert.equal(ring.kind, 'ring');
  assert.equal(ring.r, BREEDS.elemgolem.job.radius, 'the drawn ring is not the danger radius');
  assert.ok(w.hp < hp0, 'a player standing in the ring was not hurt');
});

test('WALKING OUT OF THE RING DURING THE WARNING IS A DODGE', () => {
  const { w, f } = setup('elemgolem', 250);
  const hp0 = w.hp;
  const R = BREEDS.elemgolem.job.radius;
  let out = false;
  run(w, 3, () => {
    if (f.state === 'slam' && !out) { w.player.x = f.x - (R + PR + 60); out = true; }   // well outside it
  });
  assert.ok(out, 'never slammed');
  assert.equal(w.hp, hp0, 'it hurt a player who had left the ring');
});

test('A SLAM LEAVES A SHOCKWAVE FOR THE RENDERER, which fades', () => {
  const { w, f } = setup('elemgolem', 250);
  until(w, 4, () => f.shock);
  assert.ok(f.shock && f.shock.r === BREEDS.elemgolem.job.radius);
  run(w, 1);
  assert.equal(f.shock, null, 'the shockwave never ended');
});

// ---------------------------------------------------------------- Fort Golem
test('THE WARDEN CALLS SLAYERS, BESIDE ITSELF, AND NO MORE THAN ITS CAP', () => {
  const { w, f } = setup('fortgolem', 900);
  const j = BREEDS.fortgolem.job;
  const slayers = () => w.foes.filter((x) => x.breed === 'slayer');
  run(w, 60);
  assert.ok(slayers().length >= j.count, 'it never called anyone');
  assert.ok(slayers().length <= j.max * j.count, `${slayers().length} summoned; the cap is ${j.max * j.count}`);
  for (const s of slayers()) assert.ok(w.targets.includes(s), 'a summoned foe is not in targets, so the gun cannot see it');
});

test('THE WARDEN SHOWS A SIGIL BEFORE THEY ARRIVE', () => {
  const { w, f } = setup('fortgolem', 900);
  let sigil = null;
  until(w, 12, () => { if (f.state === 'cast') sigil = f.tell; return w.foes.length > 1; });
  assert.ok(sigil && sigil.kind === 'sigil', 'they arrived with no warning');
});

test('SUMMONED SLAYERS ARE AS TOUGH AS THE LEVEL, not level one', () => {
  const { w } = setup('fortgolem', 900, 4);
  run(w, 14);
  const s = w.foes.find((x) => x.breed === 'slayer');
  assert.ok(s, 'nothing was summoned');
  assert.ok(s.maxHp > BREEDS.slayer.hp, 'a level 4 warden called level 1 Slayers');
  assert.equal(s.level, 4);
});

// ---------------------------------------------------------------- the plain soldier
test('THE SLAYER IS STILL JUST A SOLDIER: it never throws, charges, slams or summons', () => {
  const { w, f } = setup('slayer', 600);
  const states = new Set();
  run(w, 12, () => states.add(f.state));
  for (const s of states) assert.ok(['walk', 'windup', 'recover'].includes(s), `a Slayer entered "${s}"`);
  assert.equal(w.foeShots.length, 0);
  assert.equal(w.foes.length, 1);
});
