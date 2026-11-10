// WHAT YOU PICK WHEN YOU LEVEL UP, AND WHAT IT DOES.
//
// This is the engine of the genre. Kill things, collect what they drop, hit a
// threshold, choose one of three, stack it on everything chosen before. Every
// run is different because the draw is different, and that -- not the size of
// the catalogue -- is where replayability comes from.
//
// MOSTLY NUMBERS, ON PURPOSE. Seven of the eight below are stat modifiers:
// they change a number the rest of the game already reads. Only ORBIT adds a
// behaviour. That ratio is deliberate and it is the answer to "we need tons of
// different systems that create synergy together" -- we do not. A pool of
// stat modifiers already produces different runs, because +2 projectiles and
// +60% fire rate is a different character from +120% damage and pierce. New
// BEHAVIOURS are expensive and a handful carries a whole game.
//
// STACKING IS LINEAR AND CAPPED. Each pick adds `step`; `max` is where an
// ability stops being offered. Linear because it is legible -- a player can
// feel "another one of those" -- and capped so a run cannot become a single
// ability taken nine times, which is the most boring build available.
//
// EVOLUTIONS ARE NOT HERE AND SHOULD NOT BE YET. Combining two abilities into
// a third is the part of this genre that costs the most and matters least
// early: it rewards mastery after twenty runs. Build it later, for the pairs
// players actually gravitate to, which is information we do not have.

export const ABILITIES = {
  rapid:    { label: 'RAPID FIRE',   blurb: 'Shoot more often',        step: 0.22, max: 6 },
  multi:    { label: 'SPLIT SHOT',   blurb: 'One more projectile',     step: 1,    max: 4 },
  damage:   { label: 'HARD SHELL',   blurb: 'Hit harder',              step: 0.30, max: 6 },
  pierce:   { label: 'PIERCE',       blurb: 'Shots pass through',      step: 1,    max: 3 },
  reach:    { label: 'LONG REACH',   blurb: 'Shoot further',           step: 0.25, max: 4 },
  swift:    { label: 'SWIFT',        blurb: 'Move faster',             step: 0.14, max: 4 },
  magnet:   { label: 'MAGNET',       blurb: 'Pull in loot from afar',  step: 0.60, max: 4 },
  // THE KATANA IS NOT ALWAYS OUT. Every other card here is a permanent
  // number -- fire faster, hit harder -- and a weapon that simply circles you
  // forever is another one of those wearing a different coat. Drawn and
  // sheathed on a cycle, it is the only thing in the build that changes what
  // the player should be doing minute to minute: press in while it is out,
  // keep your distance while it is not. See KATANA in systems/combat.js for
  // the duty cycle and why each level shortens the rest rather than the sweep.
  katana:   { label: 'KATANA',       blurb: 'A blade sweeps, then rests',  step: 1,    max: 3 },
};

// BASE MAGNET RAISED FROM 170 TO 260 after running the loop: at 170 a player
// moving at any speed leaves their own gems behind, so kills stopped paying
// and the run never levelled. The ability still matters -- four stacks is
// roughly double -- but the floor has to be wide enough that killing something
// while moving is worth doing.

/** A fresh, empty build. */
export function createBuild() {
  return { rapid: 0, multi: 0, damage: 0, pierce: 0, reach: 0, swift: 0, magnet: 0, katana: 0 };
}

/**
 * The numbers the rest of the game reads. ONE PLACE, derived, never stored.
 *
 * Nothing anywhere else may keep its own copy of "current fire rate": a build
 * changes mid-run and a cached stat is a bug that only appears after a
 * level-up, which is the hardest moment to reproduce.
 */
export function stats(build) {
  const a = ABILITIES;
  return {
    fireIntervalS: 0.55 / (1 + build.rapid * a.rapid.step),
    projectiles: 1 + build.multi * a.multi.step,
    damage: 10 * (1 + build.damage * a.damage.step),
    pierce: build.pierce * a.pierce.step,
    rangePx: 620 * (1 + build.reach * a.reach.step),
    speedPxS: 1 + build.swift * a.swift.step,      // a MULTIPLIER on walk speed
    magnetPx: 260 * (1 + build.magnet * a.magnet.step),
    blades: build.katana * a.katana.step,
  };
}

/** Everything not yet maxed out. */
export function offerable(build) {
  return Object.keys(ABILITIES).filter((k) => build[k] < ABILITIES[k].max);
}

/**
 * Two to choose from -- one per lean direction. See levelup.js for why the
 * screen dropped from three: the middle card sat on the player's own resting
 * position and was therefore always half-chosen.
 *
 * WITHOUT REPLACEMENT, which is the only rule here that is load-bearing: the
 * same ability twice in one draw is a choice between two identical cards, and
 * a player reads that as the game being broken rather than as bad luck.
 *
 * Near the end of a long run there may be fewer than two left; offering one
 * is correct and offering a padded duplicate is not.
 *
 * `rng` is injected so a test can be deterministic and so a run could later be
 * seeded and replayed.
 */
export function draw(build, rng = Math.random, count = 2) {
  const pool = offerable(build);
  const picked = [];
  while (picked.length < count && pool.length) {
    picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return picked;
}

/** Take one. Capped, so a maxed ability can never exceed its own limit. */
export function take(build, key) {
  if (!(key in ABILITIES)) return build;
  build[key] = Math.min(ABILITIES[key].max, build[key] + 1);
  return build;
}

/**
 * The XP needed to reach the NEXT level, from the current one.
 *
 * Grows, so the first few levels come quickly and the run settles -- the early
 * ones are what teach the player that killing things leads to choices.
 */
export function xpForLevel(level) {
  // 8 for the first, not 14. Kills drop one gem each and a gem dropped at the
  // edge of weapon range is outside the magnet, so a player collects well
  // under one per kill early on. At 14 the first level-up was far enough away
  // that a run could be played for a minute without ever meeting the choice
  // screen -- which is the one thing a new player most needs to meet.
  return Math.round(8 * Math.pow(1.4, level - 1));
}
