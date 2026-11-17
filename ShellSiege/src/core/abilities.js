// WHAT YOU PICK WHEN YOU LEVEL UP, AND WHAT IT DOES.
//
// Lifted from TMNT Survivor, which is the point: that game already solved
// this and the solution is not Survivor-specific. What was dropped in the
// port is as deliberate as what was kept.
//
// MOSTLY NUMBERS, ON PURPOSE. Every one of these is a stat modifier -- it
// changes a number the rest of the game already reads. That ratio is the
// answer to "we need lots of systems that synergise": we do not. A pool of
// stat modifiers already produces different runs, because +2 blades and +60%
// throw rate is a different character from +120% damage and pierce. New
// BEHAVIOURS are expensive and a handful carries a whole game.
//
// STACKING IS LINEAR AND CAPPED. Each pick adds `step`; `max` is where an
// ability stops being offered. Linear because it is legible -- a player can
// feel "another one of those" -- and capped so a run cannot become one
// ability taken nine times, which is the most boring build available.
//
// WHAT DID NOT COME ACROSS. Survivor's MAGNET pulls in dropped gems, and
// there are no drops here: a kill is worth XP the moment it happens, because
// a pickup is a second system and the point of this build is to test ONE
// mechanic on a board. Its KATANA is a behaviour, not a number, and it needs
// a weapon that orbits -- that is a real feature, not a port.
//
// THE SAI IS NOT AN ABILITY EITHER, and should not become one by accident:
// it is the base weapon, and these all modify it.

export const ABILITIES = {
  rapid:  { label: 'RAPID THROW', blurb: 'Throw more often',     step: 0.22, max: 6 },
  multi:  { label: 'SPLIT THROW', blurb: 'One more blade',       step: 1,    max: 4 },
  damage: { label: 'HARD SHELL',  blurb: 'Hit harder',           step: 0.30, max: 6 },
  pierce: { label: 'PIERCE',      blurb: 'Blades pass through',  step: 1,    max: 3 },
  reach:  { label: 'LONG REACH',  blurb: 'Throw further',        step: 0.25, max: 4 },
  swift:  { label: 'SWIFT',       blurb: 'Move faster',          step: 0.14, max: 4 },
};

/** A fresh, empty build. */
export function createBuild() {
  const b = {};
  for (const k of Object.keys(ABILITIES)) b[k] = 0;
  return b;
}

/**
 * The numbers the rest of the game reads. ONE PLACE, derived, never stored.
 *
 * Nothing anywhere else may keep its own copy of "current throw rate": a
 * build changes mid-run and a cached stat is a bug that only shows up after a
 * level-up, which is the hardest moment to reproduce.
 *
 * The bases are exactly BASE_GUN's, so an empty build plays identically to
 * the build before abilities existed.
 */
export function stats(build) {
  const a = ABILITIES;
  return {
    fireIntervalS: 0.55 / (1 + build.rapid * a.rapid.step),
    projectiles: 1 + build.multi * a.multi.step,
    damage: 10 * (1 + build.damage * a.damage.step),
    pierce: build.pierce * a.pierce.step,
    rangePx: 620 * (1 + build.reach * a.reach.step),
    speedMul: 1 + build.swift * a.swift.step,
  };
}

/** Everything not yet maxed out. */
export function offerable(build) {
  return Object.keys(ABILITIES).filter((k) => build[k] < ABILITIES[k].max);
}

/**
 * Two to choose from -- one per lean direction. See core/levelup.js for why
 * two and not three.
 *
 * WITHOUT REPLACEMENT, which is the only load-bearing rule here: the same
 * ability twice in one draw is a choice between two identical cards, and a
 * player reads that as the game being broken rather than as bad luck.
 *
 * Late in a long run there may be fewer than two left. Offering one is
 * correct; padding with a duplicate is not.
 *
 * `rng` is injected so a test can be deterministic and so a run could later
 * be seeded and replayed.
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
 * Kills needed to reach the NEXT level, from the current one.
 *
 * XP IS KILLS HERE, not gems: no drops, no magnet, no pickup system. So the
 * curve is gentler than Survivor's -- it counted gems, and a player collected
 * well under one per kill. Five for the first level is about twelve seconds
 * of play, which is early enough that a new player meets the choice screen
 * before they have decided what the game is.
 */
export function xpForLevel(level) {
  return Math.round(5 * Math.pow(1.45, level - 1));
}
