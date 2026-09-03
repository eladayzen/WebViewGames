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
 * SCORE ON THE HILL, per mission. The measured ceiling: every point-bearing
 * prop that spawns over the 1800 m course under that mission's OWN content
 * filter, added up. Counted by walking each mission's hill in 25 m steps and
 * summing the point value of everything that appeared -- ramps and pickups at
 * face value, and a rail at its pointsPerSecond over the time it takes to ride
 * its length at the measured ~29 m/s.
 *
 * RE-MEASURED after the payout changes: no more passive distance score, ramps
 * flattened to 200/250/300/420, the idol down from 1,800 to 300. Removing the
 * passive score is what makes these numbers mean something -- while it existed
 * roughly 3,400 points of every run came from the clock rather than the hill,
 * so a census of the props was never the whole score. Now it is.
 *
 * This exists because star thresholds used to come from the CLOCK alone --
 * 200 and 371 points per second, from a 70s mission that had measured
 * 14k/26k. That rate was true of a mission with everything on the hill. It was
 * never true of the teaching missions, which exist precisely to strip the hill
 * down to one thing:
 *
 *     mission 1  ramps only, no pickups, no rails    ceiling  9,040
 *     mission 2  ramps and rails, no pickups         ceiling 13,798
 *     mission 4  ramps, rails and gates, no pickups  ceiling 15,658
 *     mission 6+ the full hill                       ceiling ~28,000
 *
 * Against a 2-star bar of 16,000 on mission 1. Not hard -- arithmetically
 * impossible, and 3 stars more so. An autopilot that took every ramp on that
 * mission scored 7,570. Amit: "it's easy enough to finish them, but I am
 * always getting 1 star, sometimes 2, and it's not clear why."
 *
 * Which is the real defect: a threshold the player cannot reach reads as the
 * game being broken, not as a challenge, because nothing they do moves it.
 */
const CEILING = {
  firstDrop: 9040, railRunner: 13798, crystalRun: 25158, speedGates: 15658,
  idolHunt: 17798, crystalHaul: 27918, ironLine: 27918, fastLane: 28218,
  fullPlate: 28818, ridgeMaster: 27918, doubleDown: 28618, steelRush: 27918,
  highRoller: 27918, sweep: 28218, launchParty: 28818, goldRush: 27918,
  grindCity: 28618, topSpeed: 27918, gauntlet: 27918, lastLight: 28218,
  // 21-40, measured the same way. All ride the full hill, so they land in the
  // same 27.9k-28.8k band as 6-20 -- the variety in the back half is the
  // terrain-and-layout pairing and the size of the ask, not what the ground
  // pays. Listed individually rather than defaulted, because a mission that
  // later restricts its content needs its own number and a shared constant
  // would hide that it had stopped being true.
  nightShift: 28218, freeFall: 28818, stoneStep: 27918, deepEnd: 28618,
  loosePack: 27918, switchHouse: 27918, pinchPoint: 28218, longHaul: 28818,
  stepLadder: 27918, stormChase: 28618,
  ironWill: 27918, fastCurrent: 27918, cleanSweep: 28218, bigNumbers: 28818,
  nervePlay: 27918, skyLine: 28618, tightRope: 27918, fullTilt: 27918,
  lastCall: 28218, sundown: 28818,
};

/**
 * Star thresholds from what the mission can actually PAY, not from its clock.
 *
 * 55% of the ceiling for two stars, 85% for three. Both are below it because
 * the ceiling assumes a run that takes everything and misses nothing, which is
 * not a thing to ask of a player on a balance board -- and because two sources
 * sit outside the count and only ever help: the time bonus (25 a second for
 * whatever is left on the clock) and the trick chain, which multiplies air
 * awards. The autopilot's 7,570 on a 6,920 ceiling is those two, and it is why
 * 85% is a real target rather than a demand for perfection.
 *
 * A mission with no measured ceiling falls back to the old clock rate, so
 * adding one to the list does not silently give it a bar of zero.
 *
 * Still rounded to the nearest 500: a threshold of 18,932 implies a precision
 * none of this has.
 */
/**
 * HOW MUCH OF WHAT IS AUTHORED IS ACTUALLY ASKED FOR.
 *
 * Amit: "the difficulty is generally too high on the missions -- reduce it by
 * 30% for all, because with the controller it will be much harder."
 *
 * Which is the real point and not a fudge. Every target in this file was set
 * against a hill measured with a KEYBOARD, where carve is an instant hard +-1
 * and the rider goes exactly where they are told. On the GoBalance board the
 * same input is a person shifting their weight: it arrives late, it overshoots,
 * it drifts back when they stop thinking about it, and holding a line costs
 * real effort. The number of crystals on the road did not change; the cost of
 * reaching each one did.
 *
 * ONE SCALAR, applied at build time to every ask -- objective counts, score
 * targets and both star thresholds -- rather than thirty edited numbers. That
 * matters because this is a guess that will be revisited after board testing:
 * the whole ladder has to move together, and a single constant can be tuned in
 * one place without anyone having to remember which rows were touched.
 *
 * It deliberately does NOT scale the clock. Giving more time makes a mission
 * longer, not easier -- the player is still asked for the same thing and simply
 * grinds at it. Asking for less is the thing that actually lowers the demand.
 */
const DIFFICULTY = 0.7;

/** Scale a count. Never below 1 -- an objective of zero is already complete. */
const easeCount = (n) => Math.max(1, Math.round(n * DIFFICULTY));

/** Scale a score. Kept on the 500 grid the thresholds already use. */
const easeScore = (n) => Math.round((n * DIFFICULTY) / 500) * 500;

function starTiers(seconds, id) {
  const round = (n) => Math.round(n / 500) * 500;
  const ceiling = CEILING[id];
  // Stars are an ASK too, so they move with everything else -- leaving them put
  // while the objectives came down would have made three stars the hard part of
  // a mission that is otherwise easy, which is the opposite of the intent.
  if (!ceiling) {
    return [round(200 * seconds * DIFFICULTY), round(371 * seconds * DIFFICULTY)];
  }
  return [round(0.55 * ceiling * DIFFICULTY), round(0.85 * ceiling * DIFFICULTY)];
}

/**
 * The list. Targets are chosen against the measured per-minute rates at the top
 * of this file -- roughly half of the ceiling early, up to ~85% late, so the
 * curve comes from the clock tightening rather than from asking for the
 * impossible.
 */
/**
 * THE SIX RIDGES, in ladder order. Missions 1-6 get one each and 7 onward
 * cycle back through them -- Amit: "you can do just six of them and then we
 * can use them again in level 7, 8 and so on."
 *
 * Six distinct hills authored well is worth more than twenty lightly varied
 * ones, and it is far less to get right. A player meets all six in the first
 * six missions and then meets them again carrying harder objectives, which is
 * a fair trade for the alternative -- twenty places that all feel like one.
 */
// Exported because the race shuffles the same six hills -- see
// modes/speedRace.js. One list, so a hill added here turns up in both.
export const RIDGE_CYCLE = [
  'ridgeDrops',      // 1  the ridge as it was, with the ground giving way
  'ridgeWeave',      // 2  switchbacks, banked hard
  'ridgeNarrows',    // 3  tight and pinching
  'ridgeLongFall',   // 4  rare drops, the deepest
  'ridgeStaircase',  // 5  shallow drops, constantly
  'ridgeBowl',       // 6  wide and deep-walled
];

/**
 * PER-MISSION LAYOUT, cycling on a different length to the terrain.
 *
 * The same hill laid out two ways is two levels: everything pushed to the rims
 * plays nothing like the same content clustered down the middle. Five entries
 * against six terrains on purpose -- the two cycles fall out of step, so
 * mission 7 is not mission 1 again, it is ridge 1 with a layout it has not had.
 *
 * `push` is the one that matters most and the one a multiplier cannot do:
 * anything authored at u = 0 stays at 0 however hard it is scaled.
 */
const RIDGE_LAYOUTS = [
  { spread: 1.30, push: 0.25 },  // off the centreline, moderately wide
  { spread: 1.60, push: 0.10 },  // pushed out to the rims
  { spread: 0.75, push: 0.05 },  // clustered tight, for the narrow hills
  { spread: 1.15, push: 0.35 },  // centre emptied hard, edges left alone
  { spread: 1.00, push: 0 },     // as authored -- the reference layout
];

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
  ['firstDrop',   'FIRST DROP',    'Ramps, and ground that gives way.',         80,
    // 8 ramps once DIFFICULTY is applied (11 x 0.7 = 7.7). Amit: "8 ramps are
    // enough." Authored rather than hard-set so it still moves with the global
    // scalar -- if the board wants another easing pass, this comes down with
    // everything else instead of being the one row that does not.
    { launch: 11 }, undefined,
    // woodWall is excluded BY TYPE: it shares the 'wall' kind with the blocker,
    // so allowing the kind brought the race's timber plank along with the pink
    // barrier. Only one of them is what was asked for.
    { kinds: ['launch', 'wall', 'scenery'], without: ['woodWall'],
      density: 1, spread: 1.3, push: 0.25 },
    // THE RIDGE, WITH DROPS. Nothing needed supporting for this -- the drop
    // system reads terrain fields the half-pipe simply had switched off. It is
    // its own preset so the other nineteen ridge missions keep ground that does
    // not move, and their measured star thresholds with it.
    'ridgeDrops'],
  // 2 -- RAILS. Adds the green metal on top of mission 1's ramps; the
  // objective is rails and nothing else.
  ['railRunner',  'RAIL RUNNER',   'Green metal. Get on it and stay on.',       90,
    // 6 rails once DIFFICULTY is applied (9 x 0.7 = 6.3). Amit: "level 2, six
    // grinds instead of four." Authored rather than hard-set so it still moves
    // with the global scalar.
    { grind: 9 }, undefined,
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
    // ITS OWN LAYOUT, overriding the cycle. Amit: "the speed gates are too
    // high -- if they're touching the colour zone above, or even close to it,
    // it's an area where it's really hard for the player to navigate and stay
    // because of the gravity."
    //
    // The gates were lowered at the source, but this mission's cycled layout
    // was adding a 0.35 rad push on top, which put them back at three quarters
    // of the way up the wall -- into the coping, where the pendulum is fighting
    // you the whole time you are there. A small push keeps them off the
    // centreline without climbing.
    { kinds: ['launch', 'grind', 'wall', 'scenery', 'boost'],
      without: ['woodWall'], density: 1, feature: ['boost'],
      spread: 1.1, push: 0.08 }],
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
  // 30k, down from 44k. Amit: "the score in level 8 is too hard, lower it to
  // 30K." The hill's measured ceiling is 29,100 -- every ramp, crystal and gate
  // on it, taken perfectly -- so 44,000 was asking for half again more than
  // existed, reachable only by stacking a deep trick chain on top. 30,000 is
  // just above the ceiling, so it still wants a chain, but a couple of good
  // ones rather than a flawless run.
  ['fastLane',    'FAST LANE',     'Tuck low and let the hill do the work.',    75, { score: 20000 }],
  // EASED: 24/4/10 down to 16/3/8. Amit: "09 full plate is too hard, lower
  // expectations a bit."
  //
  // No single number was out of line -- measured against what its 95s actually
  // reaches (55 ramps, 114 crystals, 32 rails) it asked for 21% / 12% / 18%,
  // where the single-objective missions around it ask 24-42% of one thing. The
  // problem is the CONJUNCTION: this is the first mission wanting three things
  // at once, and all three must be met, which is far worse than three times one
  // -- chasing crystals costs you ramp alignment and lining up a rail costs you
  // both.
  //
  // It also draws the worst hill for it. Mission 9 is ridgeNarrows, the
  // tightest trough of the six, carrying the layout with the hardest push off
  // the centreline (0.35). Narrowest hill, most spread-out content, three
  // demands. That is not authored -- it is where the six-terrain and
  // five-layout cycles happen to collide.
  //
  // 14% / 9% / 15% now: plainly the gentle introduction to combination
  // missions, with THE GAUNTLET at 19 as the hard version of the same idea.
  ['fullPlate',   'FULL PLATE',    'A bit of everything, and no time to spare.', 95, { pickup: 16, grind: 3, launch: 8 }],
  ['ridgeMaster', 'RIDGE MASTER',  'Prove you have learned the whole ridge.',  100, { score: 22000, pickup: 28 }],
  ['doubleDown',  'DOUBLE DOWN',   'Twice the crystals, twice the ramps.',      90, { pickup: 29, launch: 13 }],
  ['steelRush',   'STEEL RUSH',    'Rails pay, and they pay while you are on them.', 105, { grind: 5, score: 23000 }],
  ['highRoller',  'HIGH ROLLER',   'One number matters. Make it big.',          85, { score: 21000 }],
  ['sweep',       'SWEEP',         'Sweep the hill, gates and all.',           100, { pickup: 30, boost: 17 }],
  ['launchParty', 'LAUNCH PARTY',  'Hit every ramp you can find.',              95, { launch: 23 }],
  ['goldRush',    'GOLD RUSH',     'Crystals, and the idols among them.',      105, { pickup: 30, idol: 6 }],
  ['grindCity',   'GRIND CITY',    'Metal first, everything else after.',      110, { grind: 5, pickup: 36 }],
  // A speed mission that is finally ABOUT speed: the gates are the mechanic,
  // so asking for them is asking for the thing the mission is named after.
  ['topSpeed',    'TOP SPEED',     'Ride every gate you can reach.',            90, { score: 20000, boost: 21 }],
  ['gauntlet',    'THE GAUNTLET',  'All three, all at once, all downhill.',    110, { pickup: 36, grind: 5, launch: 18 }],
  ['lastLight',   'LAST LIGHT',    'The last run before the sun goes.',        120, { score: 24000, pickup: 36, grind: 5 }],

  // === MISSIONS 21-40 =========================================================
  //
  // TWENTY MORE, and the reason they are not twenty more of the same is the
  // cycle arithmetic. Six terrains against five layouts gives THIRTY unique
  // pairings before anything repeats, so 21-30 are ten hills the player has
  // genuinely never ridden -- a new mountain with a new spread of content on it
  // every time. That comes free and it is most of what makes the block work.
  //
  // 31-40 have no new ground to offer: they land back on the pairings from
  // missions 1-10. So they earn their place a different way -- they are the
  // hard ladder. The asks climb from roughly a third of what a hill holds to
  // over half, and the clocks tighten rather than lengthen, because time
  // pressure is the one difficulty lever that does not depend on the terrain
  // being new.
  //
  // WHAT ESCALATES, and what deliberately does not:
  //
  //   PICKUPS AND SCORE climb hardest. Both scale with how much of the hill a
  //   player actually sweeps, so they reward route-reading, and there is enough
  //   of both on the ground to ask for more without it becoming a lottery.
  //
  //   GRINDS DO NOT. Rails are the scarcest thing on the hill and entering one
  //   needs a committed line, so they stay at 5-7 authored throughout. Asking
  //   for more would not be harder, it would be luck about where the rails fell.
  //
  //   CLOCKS SHORTEN toward the end -- 120s down to 80s on the last few, with
  //   the same or larger asks. A mission you could clear with time to spare at
  //   110s is a different mission at 85s, on the same hill.
  //
  // Every number here is AUTHORED and passes through DIFFICULTY (0.7), so the
  // player sees roughly 70% of what is written. The authored values are what
  // state the intent.
  ['nightShift',  'NIGHT SHIFT',   'The idols are out tonight.',               100,
    { idol: 11, grind: 5 }, undefined, { rareAlways: true }],
  ['freeFall',    'FREE FALL',     'Let the ground do the work.',               90, { launch: 20, score: 20000 }],
  ['stoneStep',   'STONE STEP',    'Ramp to gate, all the way down.',          105, { launch: 14, boost: 17 }],
  ['deepEnd',     'DEEP END',      'High walls. Use them.',                     95, { score: 26000 }],
  ['loosePack',   'LOOSE PACK',    'Everything on the hill is worth points.',  110, { pickup: 38, grind: 5, launch: 16 }],
  ['switchHouse', 'SWITCH HOUSE',  'The road never lets you settle.',          100, { pickup: 34, boost: 8 }],
  ['pinchPoint',  'PINCH POINT',   'Narrow, and the gates are on the edges.',   85, { boost: 21, launch: 14 }],
  ['longHaul',    'LONG HAUL',     'Wide open and a long way down.',           115, { score: 27000, grind: 6 }],
  ['stepLadder',  'STEP LADDER',   'Every drop pays if you land it.',          100, { launch: 24, score: 22000 }],
  ['stormChase',  'STORM CHASE',   'Idols in the bowl. Go and get them.',      110,
    { idol: 14, grind: 6 }, undefined, { rareAlways: true }],
  // --- 31-40: the pairings come back around, so the demands take over --------
  ['ironWill',    'IRON WILL',     'Rails first. Everything else after.',       95, { grind: 7, pickup: 32 }],
  ['fastCurrent', 'FAST CURRENT',  'Never stop accelerating.',                  80, { boost: 26, score: 20000 }],
  ['cleanSweep',  'CLEAN SWEEP',   'Leave nothing on the hill.',               105, { pickup: 44 }],
  ['bigNumbers',  'BIG NUMBERS',   'Chain it. That is the only way.',           90, { score: 30000 }],
  ['nervePlay',   'NERVE PLAY',    'Three demands, one short clock.',           90, { pickup: 34, grind: 6, launch: 18 }],
  ['skyLine',     'SKY LINE',      'Every ramp, every time.',                   95, { launch: 28 }],
  ['tightRope',   'TIGHT ROPE',    'Idols on the tightest hill there is.',      85,
    { idol: 9, grind: 6 }, undefined, { rareAlways: true }],
  ['fullTilt',    'FULL TILT',     'Nothing held back.',                        85, { score: 30000, launch: 20 }],
  ['lastCall',    'LAST CALL',     'Everything you have learned, at once.',    100, { pickup: 42, grind: 6, launch: 22 }],
  // The finale asks for the two things Amit calls the most fun, plus a score
  // that needs the chain -- so the last mission is the game at its best rather
  // than its longest crystal sweep.
  ['sundown',     'SUNDOWN',       'Everything the ridge has, one last time.', 115,
    { idol: 13, boost: 21, score: 26000 }, undefined, { rareAlways: true }],

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
let ridgeIndex = -1;

export const MISSIONS = AUTHORED.map(([id, name, brief, seconds, targets, course, content, terrain], i) => {
  // Ridge missions cycle through the six hills and the five layouts. A mission
  // that named its own terrain or set its own layout keeps them -- authored
  // intent always beats the cycle.
  if (!course) {
    ridgeIndex += 1;
    terrain = terrain || RIDGE_CYCLE[ridgeIndex % RIDGE_CYCLE.length];
    const lay = RIDGE_LAYOUTS[ridgeIndex % RIDGE_LAYOUTS.length];
    content = content
      ? { spread: lay.spread, push: lay.push, ...content }
      : { spread: lay.spread, push: lay.push };
  }
  return {
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
  stars: starTiers(seconds, id),
  // Every count and every score here is the AUTHORED value scaled by
  // DIFFICULTY -- see the note on that constant. The authored numbers are left
  // as written so the intent of each mission stays readable.
  objectives: KIND_ORDER.filter((k) => targets[k] != null).map((kind) => (
    kind === 'score'
      ? { kind, count: easeScore(targets[kind]) }
      : kind === 'pickup'
        ? { kind, type: 'crystal', count: easeCount(targets[kind]) }
      // An idol is a pickup with a different type, not a different kind -- the
      // objective matcher already filters on p.type, so this needs no new
      // tracking. Authored as its own key purely so a mission can ask for both
      // in one line without the two counts colliding.
        : kind === 'idol'
          ? { kind: 'pickup', type: 'idol', count: easeCount(targets[kind]) }
          : { kind, count: easeCount(targets[kind]) }
  )),
  };
});

export function getMission(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}
