// CRATES TO SHOOT AT, standing in for the horde.
//
// Phase 2 of the port has a character, a camera and a gun but no enemies --
// the Foot Clan still needs a rig. A shooting range is what lets the thing be
// judged anyway: whether the weapon reads, whether the shots leave from the
// right place, whether the aim arc feels right at this camera pitch, and
// whether a bright green turtle is legible against this floor while something
// is happening.
//
// SUPERSEDED BY core/foes.js, and kept: `?crates=14` brings the range back,
// which is still the fastest way to look at a weapon on its own without
// something walking at you while you do it. It defaults to 0 now.
//
// They are deliberately NOT enemies-with-the-movement-removed. They do not
// chase, they do not touch the player, and they respawn, because the point is
// to keep something in range while the camera and the art are being looked at.
// systems/horde.js from Survivor replaces this wholesale.

import { ARENA } from '../core/world.js';

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return Number.isFinite(v) && QS.get(k) !== null ? v : d;
};

export const CRATE = {
  radius: num('crad', 46),
  hp: num('chp', 30),
  count: num('crates', 0),
  respawnS: num('cresp', 2.5),
  // Kept off the dais so the centre of the plaza stays readable, and off the
  // wall so none of them is unreachable in a corner.
  minR: num('cmin', 420),
  maxR: num('cmax', 1500),
};

/** A deterministic shuffle, so a reload shows the same range. */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function place(r, i, n) {
  // Spread around the player's start on a ring, jittered, rather than
  // scattered uniformly: a uniform scatter leaves bald patches you have to
  // walk across to find anything, and walking to find a target is not what
  // this range is for.
  const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.4;
  const d = CRATE.minR + r() * (CRATE.maxR - CRATE.minR);
  return {
    x: ARENA.width / 2 + Math.cos(a) * d,
    y: ARENA.height / 2 + Math.sin(a) * d,
  };
}

/**
 * @param count how many, defaulting to `?crates=` (0 now that foes exist).
 *        Passed explicitly by the tests, which are about the crate behaviour
 *        and must not go silently green the day the default becomes zero.
 */
export function createTargets(seed = 20261116, count = CRATE.count) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const p = place(r, i, count);
    out.push({
      ...p,
      kind: 'crate',
      home: { ...p },
      radius: CRATE.radius,
      hp: CRATE.hp,
      maxHp: CRATE.hp,
      hitT: 0,
      alive: true,
      deadAtS: -Infinity,
      spin: r() * Math.PI * 2,
    });
  }
  return out;
}

/** Tick hit flashes, and stand a crate back up once it has been gone a moment. */
export function updateTargets(w, dt) {
  for (const t of w.targets) {
    // ONLY CRATES STAND BACK UP. The foes share this array, and the respawn
    // rule below -- "it has been dead long enough, put it back" -- would
    // resurrect every Foot Soldier on a 2.5 second loop, which looks like an
    // enemy that cannot be killed rather than like a bug.
    if (t.kind !== 'crate') continue;
    if (t.hitT > 0) t.hitT = Math.max(0, t.hitT - dt);
    if (!t.alive && w.timeS - t.deadAtS >= CRATE.respawnS) {
      t.alive = true;
      t.hp = t.maxHp;
      t.hitT = 0;
      t.x = t.home.x;
      t.y = t.home.y;
      t.bornAtS = w.timeS;
    }
  }
}
