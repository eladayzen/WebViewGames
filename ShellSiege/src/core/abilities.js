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

// THE DIVISION (Elad, 24 Nov): the turtle ALLIES and every WEAPON or EFFECT are temporary (kind 'temp', gone
// when the level ends). Everything else is a RAPHAEL UPGRADE (kind 'perm'): it is what becomes constant.

export const ABILITIES = {
  rapid:  { kind: 'perm', weight: 1.0, label: 'RAPID THROW', blurb: 'Throw more often',     step: 0.22, max: 6 },
  // LOCKED FOR NOW (max 0 = never offered): the blade is a single dagger that must come home before
  // the next throw. A second one unlocks later, then freeze / shock / chain-shock / explosion.
  // DAGGERS: one to start; this adds the second (the cap). Nothing is thrown while the quiver is empty.
  multi:  { kind: 'temp', big: true, weight: 0.7, label: 'TWIN DAGGERS', blurb: 'A second dagger',     step: 1,    max: 1 },
  // NINJA STARS: a second weapon beside the daggers (see systems/combat.js). Thrown, not caught.
  stars:    { kind: 'temp', big: true, weight: 1.0, label: 'NINJA STARS',  blurb: 'Throw stars too',      step: 1,    max: 1 },
  starrate: { kind: 'temp', weight: 0.9, label: 'STAR FLURRY',  blurb: 'Throw stars faster',   step: 0.30, max: 5, requires: 'stars' },
  starsplit:{ kind: 'temp', weight: 0.8, label: 'STAR SPREAD',  blurb: 'More stars per throw', step: 1,    max: 3, requires: 'stars' },
  damage: { kind: 'perm', weight: 1.0, label: 'HARD SHELL',  blurb: 'Hit harder',           step: 0.30, max: 6 },
  pierce: { kind: 'perm', big: true, weight: 0.7, label: 'PIERCE',      blurb: 'Blades pass through',  step: 1,    max: 3 },
  reach:  { kind: 'perm', weight: 0.8, label: 'LONG REACH',  blurb: 'Throw further',        step: 0.25, max: 4 },
  // LOCKED (Elad, 23 Nov: never upgrade the player's speed): never rolled, kept so the stat plumbing stays.
  swift:  { kind: 'perm', weight: 0.8, label: 'SWIFT',       blurb: 'Move faster',          step: 0.14, max: 0, locked: true },
  // ADDED FOR THIS DESIGN: Elad's own example of a permanent upgrade was
  // health, and there was no way to get any.
  hearts: { kind: 'perm', weight: 1.0, label: 'THICK HIDE',  blurb: 'More health',          step: 0.25, max: 5 },
  shield: { kind: 'temp', big: true, weight: 0.9, label: 'SHELL SHIELD', blurb: 'Shield that cuts hits, on and off', step: 1, max: 4 },
  // THE TURTLE ALLIES (core/allies.js). Temporary: they last for the level.
  // POWERS THAT CHANGE HOW YOU PLAY (core/powers.js)
  orbit:  { kind: 'temp', big: true, weight: 0.9, label: 'SPINNING BLADES', blurb: 'Blades circle you, then rest', step: 1, max: 4 },
  burst:  { kind: 'temp', big: true, weight: 0.9, label: 'SHELL SHOCK',   blurb: 'Charge a blast, time it',      step: 1, max: 4 },
  // LOCKED (Elad, 24 Nov: "the Raphael dash ability is not good"): never rolled. The sim (core/powers.js) is kept.
  dash:      { kind: 'temp', big: true, locked: true, weight: 0.8, label: 'DASH STRIKE',    blurb: 'Blink through a foe, cutting it', step: 1, max: 0 },
  // LOCKED (Elad, 24 Nov: "kill it for now"): the mines left behind. Never rolled; the sim (core/powers.js) is kept.
  caltrop:   { kind: 'temp', big: true, locked: true, weight: 0.8, label: 'CALTROPS',       blurb: 'Spikes drop where you run',      step: 1, max: 0 },
  // LOCKED (Elad, 24 Nov: it looked bad and its value was unclear). Never rolled; the sim is kept.
  shellboom: { kind: 'temp', big: true, locked: true, weight: 0.8, label: 'BOOMERANG SHELL', blurb: 'A shell flies out and back',    step: 1, max: 0 },
  decoy:     { kind: 'temp', big: true, weight: 0.7, label: 'PIZZA DECOY',    blurb: 'Foes chase a pizza box',         step: 1, max: 4 },
  arc:       { kind: 'temp', big: true, weight: 0.8, label: 'CHAIN LIGHTNING', blurb: 'Hits arc to nearby foes',       step: 1, max: 4 },
  vortex:    { kind: 'temp', big: true, weight: 0.7, label: 'VORTEX',         blurb: 'Drags the crowd in',             step: 1, max: 4 },
  frost:     { kind: 'temp', big: true, weight: 0.7, label: 'FREEZE NOVA',    blurb: 'Slows everything near you',      step: 1, max: 4 },
  rush:      { kind: 'temp', big: true, weight: 0.8, label: 'ADRENALINE',     blurb: 'Kills make you throw faster',    step: 1, max: 4 },
  leo:    { kind: 'temp', big: true, weight: 0.9, label: 'LEONARDO',    blurb: 'Dashes in with twin blades', step: 1,   max: 4 },
  mikey:  { kind: 'temp', big: true, weight: 0.9, label: 'MICHELANGELO', blurb: 'Nunchucks that stun a lane', step: 1, max: 4 },
  donnie: { kind: 'temp', big: true, weight: 0.9, label: 'DONATELLO',   blurb: 'Gravity grenades pull foes in', step: 1,  max: 4 },
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
    fireIntervalS: 0.30 / (1 + build.rapid * a.rapid.step),
    projectiles: 1,                          // daggers per throw
    quiver: 1 + build.multi * a.multi.step,  // daggers that can exist at once
    // The star weapon, or null when not held. Half the dagger's damage, slow, no return.
    stars: build.stars > 0 ? {
      intervalS: 1.4 / (1 + build.starrate * a.starrate.step),
      count: 1 + build.starsplit * a.starsplit.step,
      damage: 6.5 * (1 + build.damage * a.damage.step),
      rangePx: 520 * (1 + build.reach * a.reach.step),
    } : null,
    damage: 13 * (1 + build.damage * a.damage.step),
    pierce: build.pierce * a.pierce.step,
    rangePx: 760 * (1 + build.reach * a.reach.step),
    speedMul: 1 + build.swift * a.swift.step,
    // A MULTIPLIER on the player's base health, not a number of hearts: the
    // base itself is `?php=` overridable, and a multiplier survives that.
    maxHpMul: 1 + build.hearts * a.hearts.step,
    shield: build.shield,            // copies held; core/allies.js turns it into hit points
  };
}

/** Everything not yet maxed out. */
export function offerable(build) {
  return Object.keys(ABILITIES).filter((k) => build[k] < ABILITIES[k].max && (!ABILITIES[k].requires || build[ABILITIES[k].requires] > 0));
}

/** Take one. Capped, so a maxed ability can never exceed its own limit. */
export function take(build, key) {
  if (!(key in ABILITIES)) return build;
  build[key] = Math.min(ABILITIES[key].max, build[key] + 1);
  return build;
}
