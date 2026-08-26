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
  // MISSION 1 IS RAMPS, and only ramps. Amit, moving back to the ridge after
  // parking the open face: "first mission should be around ramps, taking like
  // 15 ramps. Also put in some pink barriers. For now hide or remove the
  // glides, the green glides, any kind of pickup. And the existing ramps -- try
  // to move them a little bit to the side so they won't all be so close to the
  // center."
  //
  // `push` is what does that last part and why it exists: four of the ridge's
  // nine ramp placements sit at exactly u = 0, and a multiplier leaves anything
  // at zero exactly where it was. 1.3 spreads what is already spread; the 0.25
  // push moves the centre ones off it. Together the ramps land between a fifth
  // and two thirds of the way out instead of piled on the centreline.
  //
  // 'wall' is in kinds so the pink barriers appear; the course itself does not
  // allow that kind, so no other ridge mission sees them and none of their
  // measured star thresholds move.
  ['firstDrop',   'FIRST DROP',    'Ramps, and something to go around.',        80,
    { launch: 15 }, undefined,
    // woodWall is excluded BY TYPE: it shares the 'wall' kind with the blocker,
    // so allowing the kind brought the race's timber plank along with the pink
    // barrier. Only one of them is what was asked for.
    { kinds: ['launch', 'wall', 'scenery'], without: ['woodWall'],
      density: 1, spread: 1.3, push: 0.25 }],
  // 2 -- RAILS. Adds the green metal on top of mission 1's ramps; the
  // objective is rails and nothing else.
  ['railRunner',  'RAIL RUNNER',   'Green metal. Get on it and stay on.',       90,
    { grind: 6 }, undefined,
    { kinds: ['launch', 'grind', 'wall', 'scenery'], without: ['woodWall'],
      density: 1, feature: ['grind'] }],
  // 3 -- CRYSTALS. Idols are excluded by type: they are their own lesson two
  // missions later, and a rare thing met before it is introduced is just a
  // confusing crystal.
  ['crystalRun',  'CRYSTAL RUN',   'Now there is something to collect.',        90,
    { pickup: 22 }, undefined,
    { kinds: ['launch', 'grind', 'wall', 'scenery', 'pickup'],
      without: ['woodWall', 'statue'], density: 1, feature: ['pickup'] }],
  // 4 -- SPEED GATES. Crystals come OUT for this one, the same way they did on
  // the open face: a mission about riding arches should not also be a mission
  // about collecting, or the objective is not what the player is doing.
  ['speedGates',  'SPEED GATES',   'Ride the arches. They give the hill back.', 95,
    { boost: 6 }, undefined,
    { kinds: ['launch', 'grind', 'wall', 'scenery', 'boost'],
      without: ['woodWall'], density: 1, feature: ['boost'] }],
  // 5 -- IDOLS. Crystals out, idols in and forced to every showing of their
  // pattern -- the authored "every now and then" cadence is for something met
  // incidentally, and this is the one thing the mission is about.
  ['idolHunt',    'IDOL HUNT',     'Ten of them, and never where you already are.', 130,
    { idol: 10 }, undefined,
    { kinds: ['launch', 'grind', 'wall', 'scenery', 'pickup'],
      without: ['woodWall', 'crystal', 'highCrystal'],
      density: 1, rareAlways: true, feature: ['pickup'] }],
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
  // A TEACHING LADDER, not a difficulty ramp. Amit: "first mission should be
  // only ramps, and you should not have glides at all on the screen -- and of
  // course blockers. Then the next mission should be glides, then pickups. But
  // in the first two we shouldn't have pickups at all. Every time you add some
  // component, to show the variety of stuff."
  //
  // So each of the first five introduces exactly one thing, and -- the part
  // that matters -- the ones before it do not have that thing ON THE GROUND.
  // A mission teaching ramps with rails lying around is not teaching ramps; the
  // player cannot tell what the mission is about from what they can see. That
  // is why `content` exists and why it filters at SPAWN rather than only
  // deciding what gets counted.
  //
  // Blockers are in every one of them. They are not a component to introduce --
  // they are the reason to steer at all, and a hill without them is a hill you
  // hold one line down.
  //
  // NO AIRTIME OBJECTIVES anywhere. Amit: "don't do airtime, because airtime is
  // not something you choose." Exactly right -- it is a consequence of the line
  // you took and the ground you took it on, so asking for it asks the player to
  // aim at something they do not directly hold.
  //
  // Targets are derived from what each hill offers per minute, against the
  // fraction the twenty measured ridge missions ask for. See the note above.
  ['faceRamps',   'RAMP SCHOOL',   'Nothing but takeoffs. Hit them.',           80,
    // `feature` exempts ramps from the course's thinning, so the lesson's
    // subject is continuous rather than sampled. Without it the back half of
    // this mission had stretches with no ramp in sight.
    // The ridge's own level and its own ramp placements, at full density --
    // see faceRidgeMatch.
    //
    // RAMPS AND NOTHING ELSE. Amit: "remove everything from there that is not
    // a ramp -- completely." No barriers, no cones, no crystals, not even the
    // lip lamps: 'launch' is the only kind that reaches the ground.
    //
    // Which makes this the cleanest test the project has. The level is one
    // already known to be fun, the ramp placements are identical to the
    // original's to the digit, and every other variable is gone -- so whatever
    // it feels like is the CONTROLLER, and nothing else.
    { launch: 12 }, FACE,
    { kinds: ['launch'], density: 1 },
    'faceRidgeMatch'],

  ['faceGlides',  'RAIL SCHOOL',   'Green metal. Get on it and stay on.',       90,
    { grind: 5 }, FACE,
    { kinds: ['launch', 'grind', 'wall', 'scenery'], feature: ['grind'] }, 'faceBasin'],

  ['facePickups', 'CRYSTAL RUN',   'Now there is something to collect.',        90,
    { pickup: 16 }, FACE,
    // Crystals, but not idols yet -- the rare thing gets its own mission.
    { kinds: ['launch', 'grind', 'wall', 'scenery', 'pickup'], without: ['statue'],
      feature: ['pickup'] }, 'faceLongRun'],

  ['faceBoosts',  'SPEED GATES',   'Ride the arches. They give the hill back.', 95,
    { boost: 5 }, FACE,
    { kinds: ['launch', 'grind', 'wall', 'scenery', 'boost'], feature: ['boost'] },
    'faceGorge'],

  ['faceIdols',   'IDOL HUNT',     'Ten of them, and never where you already are.', 130,
    // TEN, per Amit. Five was set when all three idol placements sat past 86%
    // out and the only one anyone met was a rim idol. Spread across the hill
    // and measured on The Amphitheatre at 10.5 a minute, about 22 pass by in
    // 130s -- so ten is a little under half of them. A hunt rather than a
    // sweep, and rather than the lottery two would have been at the old rate.
    { idol: 10 }, FACE,
    // Idols ONLY among the pickups, and every showing rather than the authored
    // "every now and then" -- that cadence is for something met incidentally,
    // and this is the one thing the mission is about.
    { kinds: ['launch', 'wall', 'scenery', 'pickup'], without: ['crystal'],
      rareAlways: true, feature: ['pickup'] }, 'faceAmphitheatre'],

  // --- and now the mixing ----------------------------------------------------
  ['faceMix1',    'BOTH RIMS',     'Left, right, and back again.',              95,
    { pickup: 18, launch: 10 }, FACE, undefined, 'faceSwitchback'],

  ['faceMix2',    'FULL KIT',      'Ramps, rails, crystals. All of it.',       100,
    { pickup: 18, grind: 3, launch: 12 }, FACE, undefined, 'faceChute'],

  ['faceMix3',    'THE WHOLE FACE','Everything the mountain has.',             120,
    { pickup: 20, grind: 3, launch: 12, boost: 4, idol: 2 }, FACE,
    { kinds: ['launch', 'grind', 'wall', 'scenery', 'pickup', 'boost'],
      rareAlways: true }, 'faceStaircase'],
];

// Objective order on screen: collect, ride, launch, score. Consistent across
// every mission so the eye learns where to look rather than re-reading the list.
const KIND_ORDER = ['pickup', 'idol', 'grind', 'launch', 'boost', 'score'];

/** @type {Mission[]} */
export const MISSIONS = AUTHORED.map(([id, name, brief, seconds, targets, course, content, terrain], i) => ({
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
  /**
   * What is allowed on the ground, or undefined to let the course decide.
   * {kinds:string[], without?:string[], rareAlways?:boolean}
   */
  content,
  /**
   * WHICH MOUNTAIN. Undefined means the course's default, which is every ridge
   * mission. The face's levels each name their own, so pressing go on mission 4
   * is a different place from mission 3 rather than the same hill with
   * different furniture on it.
   */
  terrain,
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
