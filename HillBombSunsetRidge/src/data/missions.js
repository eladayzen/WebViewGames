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
// wishful. Re-measured after the controller retune, because the ceilings moved
// and that is exactly why the list had become too easy -- carving costs 8% of
// your distance now instead of 42%, so steering for a pickup is a fraction of
// what it used to be. Per minute of clock, with a bot that is actually trying:
//
//                     when first set    now
//     crystals             13            26
//     score            ~25,000        ~47,500
//     launches             15            19  (ramp-focused)
//     grinds                3             4  (rail-focused)
//
// So crystals and score genuinely support DOUBLING; launches and grinds do not,
// and were raised by about a third instead. Doubling those would have asked for
// more rails than the course contains. Every target below is checked against
// rate x duration and kept at or under ~80% of it -- above that a mission stops
// being demanding and starts depending on a perfect course roll.
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
/** The open face's mission course -- see data/courses.js. */
const FACE = 'openFaceMissions';

const AUTHORED = [
  ['firstDrop',   'FIRST DROP',    'Learn the ridge. Grab what shines.',        70, { pickup: 20 }],
  ['railRunner',  'RAIL RUNNER',   'The metal is faster than the paint.',       90, { grind: 4, pickup: 16 }],
  ['bigScore',    'BIG SCORE',     'Everything pays. Go and get paid.',         80, { score: 38000, launch: 7 }],
  ['sunsetRun',   'SUNSET RUN',    'Everything you know, before the light goes.', 90, { pickup: 24, grind: 3, score: 48000 }],
  ['airTime',     'AIR TIME',      'Feet off the ground as much as possible.',  75, { launch: 13 }],
  ['crystalHaul', 'CRYSTAL HAUL',  'Leave nothing shining behind you.',         85, { pickup: 26 }],
  ['ironLine',    'IRON LINE',     'Find the rails. Ride them properly.',      100, { grind: 5, launch: 8 }],
  ['fastLane',    'FAST LANE',     'Tuck low and let the hill do the work.',    75, { score: 44000 }],
  ['fullPlate',   'FULL PLATE',    'A bit of everything, and no time to spare.', 95, { pickup: 24, grind: 4, launch: 10 }],
  ['ridgeMaster', 'RIDGE MASTER',  'Prove you have learned the whole ridge.',  100, { score: 60000, pickup: 28 }],
  ['doubleDown',  'DOUBLE DOWN',   'Twice the crystals, twice the ramps.',      90, { pickup: 29, launch: 13 }],
  ['steelRush',   'STEEL RUSH',    'Rails pay, and they pay while you are on them.', 105, { grind: 5, score: 64000 }],
  ['highRoller',  'HIGH ROLLER',   'One number matters. Make it big.',          85, { score: 52000 }],
  ['sweep',       'SWEEP',         'Clean the hill out on the way down.',      100, { pickup: 33, grind: 5 }],
  ['launchParty', 'LAUNCH PARTY',  'Hit every ramp you can find.',              95, { launch: 23 }],
  ['goldRush',    'GOLD RUSH',     'The ridge is paved with the stuff.',       105, { pickup: 36 }],
  ['grindCity',   'GRIND CITY',    'Metal first, everything else after.',      110, { grind: 5, pickup: 36 }],
  ['topSpeed',    'TOP SPEED',     'No brakes. No hesitation.',                 90, { score: 56000 }],
  ['gauntlet',    'THE GAUNTLET',  'All three, all at once, all downhill.',    110, { pickup: 36, grind: 5, launch: 18 }],
  ['lastLight',   'LAST LIGHT',    'The last run before the sun goes.',        120, { score: 74000, pickup: 36, grind: 5 }],

  // --- THE OPEN FACE ---------------------------------------------------------
  //
  // The ladder changes hill here. Everything above is the ridge -- a narrow
  // trough with a fast line down the middle -- and everything below is the wide
  // face, where there is no fast line, the whole width is ridable, and the
  // ground itself drops away and throws you.
  //
  // TARGETS ARE DERIVED, NOT GUESSED, and the derivation matters because the
  // face offers a different amount of everything. Sweeping both hills at their
  // own densities gives what each puts in front of you per minute:
  //
  //     ridge        pickup 68    launch 32    grind 20
  //     face @0.55   pickup 49    launch 25    grind 13
  //
  // and the twenty missions above -- whose thresholds came from real timed runs
  // -- ask for 16-30% of the pickups on offer, 15-45% of the launches, and
  // 10-15% of the grinds. Applying those same fractions to what the face offers
  // is what sets the numbers below. Copying the ridge's raw targets across would
  // have made every one of these quietly harder, most of all the grinds, where
  // the face offers a third less.
  //
  // Each one introduces something, per Amit: a mission should bring in new
  // content rather than re-ask the last one with bigger numbers.
  ['openGround',  'OPEN GROUND',   'A whole mountain. Go wide.',                80, { pickup: 12 }, FACE],
  ['wideLines',   'WIDE LINES',    'The edges pay better than the middle.',     90, { pickup: 15, launch: 8 }, FACE],
  ['theDrops',    'THE DROPS',     'Let the hill throw you. It will.',          85, { launch: 14 }, FACE],
  ['ironEdge',    'IRON EDGE',     'Rails, out where the ground runs out.',     95, { grind: 3, pickup: 14 }, FACE],
  ['theIdol',     'THE IDOL',      'Something out there is worth the detour.', 100, { idol: 1, pickup: 14 }, FACE],
  ['bothRims',    'BOTH RIMS',     'Left, right, and back again.',              90, { pickup: 20, launch: 12 }, FACE],
  ['wholeFace',   'THE WHOLE FACE','Everything the mountain has.',             100, { pickup: 20, grind: 3, launch: 14 }, FACE],
  ['idolHunt',    'IDOL HUNT',     'Take the long way. Twice.',                110, { idol: 1, pickup: 22, launch: 12 }, FACE],
];

// Objective order on screen: collect, ride, launch, score. Consistent across
// every mission so the eye learns where to look rather than re-reading the list.
const KIND_ORDER = ['pickup', 'idol', 'grind', 'launch', 'score'];

/** @type {Mission[]} */
export const MISSIONS = AUTHORED.map(([id, name, brief, seconds, targets, course], i) => ({
  id,
  /**
   * Which hill this mission is played on. Undefined means the ridge, which is
   * every mission authored before the open face existed -- so the twenty that
   * already have measured star thresholds keep the exact ground they were
   * measured on, and nothing about them moves.
   *
   * ONE PROGRESSION, TWO HILLS. Amit chose "added alongside" over moving the
   * whole mode: the face missions extend the same list rather than forking a
   * second track, so a player walks one ladder that happens to change terrain
   * partway up.
   */
  course,
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
      // An idol is a pickup with a different type, not a different kind -- the
      // objective matcher already filters on p.type, so this needs no new
      // tracking. Authored as its own key purely so a mission can ask for both
      // in one line without the two counts colliding.
      : kind === 'idol'
        ? { kind: 'pickup', type: 'idol', count: targets[kind] }
        : { kind, count: targets[kind] }
  )),
}));

export function getMission(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}
