// WHAT YOU ARE HANDED AFTER A ROOM, AND WHAT IT DOES.
//
// Lifted from TMNT Survivor, which is the point: that game already solved
// this and the solution is not Survivor-specific. What was dropped in the
// port is as deliberate as what was kept.
//
// NOBODY PICKS ANY MORE. Elad, 22 Nov: choosing a card with a balance board
// "is not as fun" as choosing with a regular input, so the cards are gone and
// core/roll.js hands over one ability at random after each cleared room. That
// is why every entry below carries a `weight`, and why a repeat is made less
// likely rather than impossible: with no choice, a dead roll is the one thing
// that cannot be allowed to feel like the player's fault.
//
// EVERY ABILITY IS EITHER PERMANENT OR TEMPORARY, and that is a property of
// the ability, not of the run (Elad's design, same day):
//
//   perm  a stat. Survives death AND the end of the level, which is how a
//         player who keeps dying still gets stronger and the game stays
//         kind to a child who is not good at it yet.
//   temp  a behaviour -- the turtle allies. Earned again every level; one
//         may be carried across. None exist yet (phase 3), but the field is
//         here now so the roll and the run never have to be reworked for it.
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

export const KINDS = ['perm', 'temp'];

export const ABILITIES = {
  rapid:  { kind: 'perm', weight: 1.0, label: 'RAPID THROW', blurb: 'Throw more often',     step: 0.22, max: 6 },
  multi:  { kind: 'perm', weight: 0.7, label: 'SPLIT THROW', blurb: 'One more blade',       step: 1,    max: 4 },
  damage: { kind: 'perm', weight: 1.0, label: 'HARD SHELL',  blurb: 'Hit harder',           step: 0.30, max: 6 },
  pierce: { kind: 'perm', weight: 0.7, label: 'PIERCE',      blurb: 'Blades pass through',  step: 1,    max: 3 },
  reach:  { kind: 'perm', weight: 0.8, label: 'LONG REACH',  blurb: 'Throw further',        step: 0.25, max: 4 },
  swift:  { kind: 'perm', weight: 0.8, label: 'SWIFT',       blurb: 'Move faster',          step: 0.14, max: 4 },
  // ADDED FOR THIS DESIGN: Elad's own example of a permanent upgrade was
  // health, and there was no way to get any.
  hearts: { kind: 'perm', weight: 1.0, label: 'THICK HIDE',  blurb: 'More health',          step: 0.25, max: 5 },
  // THE TURTLE ALLIES (core/allies.js). Temporary: they last for the level.
  leo:    { kind: 'temp', weight: 0.9, label: 'LEONARDO',    blurb: 'Dashes in with twin blades', step: 1,   max: 4 },
  donnie: { kind: 'temp', weight: 0.9, label: 'DONATELLO',   blurb: 'Wide staff, stuns a lane', step: 1,  max: 4 },
};

/** A level is over: temporary abilities go, permanent ones stay. */
export function clearTemp(build) {
  for (const k of Object.keys(ABILITIES)) if (ABILITIES[k].kind === 'temp') build[k] = 0;
  return build;
}

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
    // A MULTIPLIER on the player's base health, not a number of hearts: the
    // base itself is `?php=` overridable, and a multiplier survives that.
    maxHpMul: 1 + build.hearts * a.hearts.step,
  };
}

/** Everything not yet maxed out. */
export function offerable(build) {
  return Object.keys(ABILITIES).filter((k) => build[k] < ABILITIES[k].max);
}

/** Take one. Capped, so a maxed ability can never exceed its own limit. */
export function take(build, key) {
  if (!(key in ABILITIES)) return build;
  build[key] = Math.min(ABILITIES[key].max, build[key] + 1);
  return build;
}
