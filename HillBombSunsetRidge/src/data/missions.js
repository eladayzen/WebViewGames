// MISSIONS -- the content of the time-limited missions mode.
//
// A mission is a HARD-CAPPED timer plus a list of objectives. The timer does not
// move: no extension, no bonus seconds. That was Amit's explicit distinction --
// the time-extension idea is a DIFFERENT mode, and keeping the cap rigid here is
// what gives this one its character (plan the route, don't farm the clock).
//
// Objectives are counters over the ride's event stream (core/events.js), which
// is the whole reason that seam exists. Nothing here touches the rider, the
// physics or the camera, so adding a mission cannot change how the board feels.
//
// STARS. `stars` is a pair of SCORE thresholds for the 2nd and 3rd star; the
// 1st is finishing at all. So clearing the mission always pays something, and
// the other two are what you come back for. Failing pays nothing -- a mission
// you did not finish did not happen, and partial credit would blunt the only
// thing separating this mode from free ride.
//
// The thresholds are ANCHORED ON MEASURED RUNS, not picked by feel. On FIRST
// DROP an automated run that only steers for crystals scores ~9k; one that also
// tucks for speed and takes the ramps scores ~34k. That 3.7x spread is the whole
// design space, and the first guessed pair (9k/15k) sat entirely in the bottom
// of it -- a bare clear came out at two stars and three was routine. The 70s
// mission settled on 14k/26k, which is where `starTiers` below comes from.
//
// OBJECTIVE TARGETS ARE ALSO MEASURED, and this is what stops the list being
// wishful. An automated run that chases crystals and rails while tucking for
// speed produces, per minute of clock:
//
//     crystals  13     launches  15     grinds  3 (rail-focused; 1 while
//     score  ~25,000                            also chasing crystals)
//
// Grinds are by far the scarcest -- rails are sparse and entering one needs a
// committed line -- so rail targets stay near 2 per minute and never above 3.
// Checking the first draft of this list against those numbers killed three
// impossible missions outright: 45k in 85s, 55k in 90s and 70k in 120s all
// wanted 125-145% of the measured score ceiling. Nothing here now asks for more
// than ~85% of what was actually achieved.
//
// OBJECTIVE KINDS. Each names an event and, optionally, a filter on its payload:
//
//   pickup   {type}   collect N of a pickup type
//   launch            leave N ramps (any launcher)
//   grind             complete N grinds
//   score             reach N points
//
// NO TRICK OBJECTIVES. They were dropped rather than tuned: on this course a
// big launch nearly always produces a backflip, and only the big kicker scores
// as a HUGE AIR, so "3 backflips" and "4 huge airs" were within a rounding
// error of the same objective -- and both were really just "hit the big ramps".
// Score covers the same ground honestly, since tricks are what pay.
// The `trick`, `anyTrick` and `air` kinds still exist in modes/missions.js for
// whenever a course gives them room to mean different things.
//
// Adding a kind means adding one entry to KIND_SPECS in modes/missions.js and
// nothing else -- deliberately, so missions stay data.

/**
 * @typedef {{kind:string, count:number, type?:string, trick?:string, min?:number, label?:string}} Objective
 * @typedef {{id:string, number:number, name:string, brief:string, seconds:number, stars:[number,number], objectives:Objective[]}} Mission
 */

/**
 * Star thresholds from the mission's own clock. Derived rather than written out
 * forty times: the measured 70s mission settled on 14k/26k, so the rates are
 * 200 and 371 points per second of clock. Rounded to the nearest 500 because a
 * threshold of 18,932 implies a precision none of this has.
 */
function starTiers(seconds) {
  const round = (n) => Math.round(n / 500) * 500;
  return [round(200 * seconds), round(371 * seconds)];
}

/**
 * The list. Targets are chosen against the measured per-minute rates at the top
 * of this file -- roughly half of the ceiling early, up to ~85% late, so the
 * curve comes from the clock tightening rather than from asking for the
 * impossible.
 */
const AUTHORED = [
  ['firstDrop',   'FIRST DROP',    'Learn the ridge. Grab what shines.',        70, { pickup: 10 }],
  ['railRunner',  'RAIL RUNNER',   'The metal is faster than the paint.',       90, { grind: 3, pickup: 8 }],
  ['bigScore',    'BIG SCORE',     'Everything pays. Go and get paid.',         80, { score: 20000, launch: 5 }],
  ['sunsetRun',   'SUNSET RUN',    'Everything you know, before the light goes.', 90, { pickup: 12, grind: 2, score: 25000 }],
  ['airTime',     'AIR TIME',      'Feet off the ground as much as possible.',  75, { launch: 10 }],
  ['crystalHaul', 'CRYSTAL HAUL',  'Leave nothing shining behind you.',         85, { pickup: 13 }],
  ['ironLine',    'IRON LINE',     'Find the rails. Ride them properly.',      100, { grind: 4, launch: 6 }],
  ['fastLane',    'FAST LANE',     'Tuck low and let the hill do the work.',    75, { score: 24000 }],
  ['fullPlate',   'FULL PLATE',    'A bit of everything, and no time to spare.', 95, { pickup: 12, grind: 3, launch: 8 }],
  ['ridgeMaster', 'RIDGE MASTER',  'Prove you have learned the whole ridge.',  100, { score: 32000, pickup: 14 }],
  ['doubleDown',  'DOUBLE DOWN',   'Twice the crystals, twice the ramps.',      90, { pickup: 15, launch: 10 }],
  ['steelRush',   'STEEL RUSH',    'Rails pay, and they pay while you are on them.', 105, { grind: 4, score: 35000 }],
  ['highRoller',  'HIGH ROLLER',   'One number matters. Make it big.',          85, { score: 30000 }],
  ['sweep',       'SWEEP',         'Clean the hill out on the way down.',      100, { pickup: 18, grind: 4 }],
  ['launchParty', 'LAUNCH PARTY',  'Hit every ramp you can find.',              95, { launch: 18 }],
  ['goldRush',    'GOLD RUSH',     'The ridge is paved with the stuff.',       105, { pickup: 20 }],
  ['grindCity',   'GRIND CITY',    'Metal first, everything else after.',      110, { grind: 4, pickup: 18 }],
  ['topSpeed',    'TOP SPEED',     'No brakes. No hesitation.',                 90, { score: 32000 }],
  ['gauntlet',    'THE GAUNTLET',  'All three, all at once, all downhill.',    110, { pickup: 20, grind: 4, launch: 14 }],
  ['lastLight',   'LAST LIGHT',    'The last run before the sun goes.',        120, { score: 42000, pickup: 18, grind: 4 }],
];

// Objective order on screen: collect, ride, launch, score. Consistent across
// every mission so the eye learns where to look rather than re-reading the list.
const KIND_ORDER = ['pickup', 'grind', 'launch', 'score'];

/** @type {Mission[]} */
export const MISSIONS = AUTHORED.map(([id, name, brief, seconds, targets], i) => ({
  id,
  /** 1-based position in the list. Derived, never authored -- a hand-written
   *  number would go stale the moment a mission is inserted or reordered. */
  number: i + 1,
  name,
  brief,
  seconds,
  stars: starTiers(seconds),
  objectives: KIND_ORDER.filter((k) => targets[k] != null).map((kind) => (
    kind === 'pickup'
      ? { kind, type: 'crystal', count: targets[kind] }
      : { kind, count: targets[kind] }
  )),
}));

export function getMission(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}
