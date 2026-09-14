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
 *     ramps only, no pickups, no rails        ceiling  9,340
 *     ramps and rails, no pickups             ceiling 14,398
 *     ramps, rails and gates, no pickups      ceiling 15,658
 *     the full hill                           ceiling ~28,000
 *
 * Against a 2-star bar of 16,000 on the ramps-only one. Not hard --
 * arithmetically impossible, and 3 stars more so. An autopilot that took every
 * ramp on that mission scored 7,570. Amit: "it's easy enough to finish them,
 * but I am always getting 1 star, sometimes 2, and it's not clear why."
 *
 * Which is the real defect: a threshold the player cannot reach reads as the
 * game being broken, not as a challenge, because nothing they do moves it.
 *
 * RE-MEASURED AGAIN for the first three, which swapped hills when Amit
 * reordered them (see AUTHORED). A ceiling belongs to a mission ON A HILL, not
 * to a mission, so moving one invalidates its number -- and these are the
 * teaching missions, where a stale ceiling is exactly the unreachable-threshold
 * bug above. The rows above are described by their CONTENT rather than by a
 * mission number for the same reason: the numbers move, the shapes do not.
 *
 *     crystalRun  25,158 -> 24,258   ridgeNarrows -> ridgeDrops   (and a wider
 *                                     layout, 0.75/0.05 -> 1.3/0.25)
 *     firstDrop    9,040 ->  9,340   ridgeDrops   -> ridgeWeave
 *     railRunner  13,798 -> 14,398   ridgeWeave   -> ridgeNarrows
 *
 * The other three of the first six were re-run unchanged as a control and came
 * back byte-identical -- speedGates 15,658, idolHunt 17,798, crystalHaul 27,918
 * -- which is what says the difference above is the hill and not the method.
 */
const CEILING = {
  crystalRun: 24258, firstDrop: 9340, railRunner: 14398, speedGates: 15658,
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

/**
 * THE FIRST THREE ARE COLLECT, RAMPS, RAILS -- IN THAT ORDER.
 *
 * Amit: "we need to switch mission number 3, should be number 1. And then
 * current one should be 2, current 2 should be 3."
 *
 * So CRYSTAL RUN leads, FIRST DROP follows, RAIL RUNNER third. It is the right
 * teaching order and the old one was mine, not designed: collecting is the only
 * one of the three that asks nothing of the player's technique -- ride past a
 * thing and it is yours -- while a ramp asks them to aim and a rail asks them
 * to aim, land on a line and hold it. Opening on ramps put the second-hardest
 * verb first.
 *
 * REORDERING MOVES THE HILLS, WHICH IS THE POINT. Terrain and layout come from
 * each mission's POSITION in this array (see the cycle below MISSIONS), not from
 * the mission, so these three swap ground as well as places:
 *
 *     1 CRYSTAL RUN   ridgeDrops     duskNeon       violet ground, cyan lines
 *     2 FIRST DROP    ridgeWeave     midnightPines  dark green, acid lines
 *     3 RAIL RUNNER   ridgeNarrows   glacier        ice, pale blue lines
 *
 * And that is the fix to the second thing Amit raised in the same breath:
 * "number 3, we might change the background, because learning to go for the
 * lights which are green when the background is green doesn't work that good."
 *
 * Exactly right, and it was the worst possible pairing. The rails are spring
 * green (0x5cff9e) BECAUSE green means grindable in this palette; RAIL RUNNER
 * was played on midnightPines, whose ground is dark green and whose road
 * markings are acid green (0xc9ff5e). The one mission that exists to teach
 * "aim for the green metal" was the one where green also meant ground, and
 * paint. Landing it on glacier instead puts those rails on ice with pale blue
 * markings -- and glacier is also the gentlest ground in the set (two drops,
 * 4.5 deep, against ridgeWeave's three at 6.5), which a third mission wants
 * anyway.
 *
 * The green hill goes to FIRST DROP, where nothing is green: its ramps are
 * violet and its objective never mentions a rail.
 *
 * ALL SIX HILLS STILL APPEAR IN THE FIRST SIX MISSIONS -- this is a rotation of
 * three, not an insertion, so 4-6 keep the ground and the numbers they had.
 * The three that moved were re-measured; see CEILING.
 */

/**
 * HOW MISSIONS 10-40 WERE SIZED: DIFFICULTY POINTS.
 *
 * Amit, after playing to 9: "we need a more methodical approach for how much
 * difficulty points per rail, per ramp, per crystal and gate and idol... some
 * way to compare them, and then not exceed some of it."
 *
 * The problem with sizing by feel is that the kinds are not comparable by
 * count. Fourteen crystals and four rails are not the same job, and a score
 * target paired with ramps is not the same job as the same target paired with
 * crystals -- because the ramps you are already hitting pay for most of it.
 *
 * THE UNIT. Every objective costs DP:
 *
 *     crystal 1   ramp 2   rail 4   gate 4   idol 5      (Amit's numbers)
 *
 * A crystal is the baseline: it falls on your line and has a 3.4-wide catch.
 * A ramp must be aimed at -- the one thing you cannot collect incidentally.
 * A rail asks three things: aim, land on the line, hold it. Amit set gates
 * level with rails and idols just above.
 *
 * SCORE is measured against what the hill actually pays (the same census that
 * produced CEILING), and crucially NET of the points the mission's other
 * objectives hand you on the way -- so "10 ramps + 11k" is scored as the 11k
 * minus the ~2,800 those ramps pay by themselves.
 *
 * MIXING MULTIPLIES. Amit: "the more you mix, the more difficult it is."
 * One objective x1.0, two x1.30, three x1.70. Switching tasks costs a line you
 * cannot optimise for either.
 *
 * SWEEP. If an ask exceeds 40% of what exists on that hill, it stops being
 * "collect some" and becomes "hunt them all", and the excess is penalised.
 * Only GOLD RUSH triggers it now, at 57% of the idols -- which is what makes
 * it a hunt rather than a haul.
 *
 * THE BUDGET, from Amit: under 50 through the middle, and only the last ten
 * climb, to 60 at most. Missions 1-9 are untouched -- he has played them and
 * they are the calibration set, spanning 8 DP (CRYSTAL RUN) to 46 (FULL PLATE).
 *
 * TWO STRUCTURAL RESULTS FELL OUT OF THE ARITHMETIC, and they shaped the list
 * more than any single number:
 *
 *   A THREE-OBJECTIVE MISSION CANNOT BE GENTLE. The smallest sensible one --
 *   10 crystals, 3 rails, 5 ramps -- is 32 raw and 54 after mixing. So three
 *   objectives can only live in the last ten. Missions 19, 20, 25 and 35 were
 *   three-objective in the middle and each dropped its weakest leg, which was
 *   rails in all four; that also ended the inversion where late missions asked
 *   fewer rails than RAIL RUNNER teaches at mission 3.
 *
 *   A ONE-OBJECTIVE MISSION CANNOT BE HARD. Reaching 55 DP on crystals alone
 *   needs 54 of them. So CLEAN SWEEP, SKY LINE, HIGH ROLLER, DEEP END and BIG
 *   NUMBERS are deliberately breathers at 30-40 DP rather than absurd asks --
 *   rest points in the back half, not mistakes.
 *
 * Score is capped at 15k everywhere, per Amit, which is why the three
 * score-only missions land where they do.
 *
 * Sizes are in EFFECTIVE terms above; the numbers below are authored, and
 * DIFFICULTY scales them. To re-derive any of this, the supply census and the
 * model live in the session notes -- but the short version is that every
 * denominator here was measured on the actual hill, not assumed.
 */
const AUTHORED = [
  // 1 -- CRYSTALS, and the gentlest verb in the game. Idols are excluded by
  // type: they are their own lesson at mission 5, and a rare thing met before
  // it is introduced is just a confusing crystal.
  ['crystalRun',  'CRYSTAL RUN',   'Something to collect, and a hill to do it on.', 90,
    // 8 crystals once DIFFICULTY is applied (11 x 0.7 = 7.7). Amit, on the
    // first three now that they lead the ladder: "they need to be easier --
    // 8 crystals, 5 ramps, 4 rails." Down from 15, which was authored when
    // this was mission 3 and a player arriving at it had already been taught
    // ramps and rails. First is a different job: it has to be finishable by
    // someone still working out what the board does.
    { pickup: 11 }, undefined,
    { kinds: ['launch', 'grind', 'wall', 'scenery', 'pickup'],
      without: ['woodWall', 'statue'], density: 1, feature: ['pickup'] }],
  // MISSION 2 IS RAMPS, and only ramps. Amit, moving back to the ridge after
  // parking the open face: "first mission should be around ramps, taking like
  // 15 ramps. Also put in some pink barriers. For now hide or remove the
  // glides, the green glides, any kind of pickup. And the existing ramps -- try
  // to move them a little bit to the side so they won't all be so close to the
  // center."
  //
  // That was written when this was mission 1; the ramps-only shape of it is
  // what he was describing and it still holds where it now sits.
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
    // 5 ramps once DIFFICULTY is applied (7 x 0.7 = 4.9). Authored rather than
    // hard-set so it still moves with the global scalar -- if the board wants
    // another easing pass, this comes down with everything else instead of
    // being the one row that does not.
    //
    // Down from 8. "8 ramps are enough" was Amit's number when this was mission
    // ONE and the ladder opened on it; from second, behind a crystal sweep,
    // the teaching job is smaller and 5 is his: "5 ramps."
    { launch: 7 }, undefined,
    // woodWall is excluded BY TYPE: it shares the 'wall' kind with the blocker,
    // so allowing the kind brought the race's timber plank along with the pink
    // barrier. Only one of them is what was asked for.
    //
    // spread/push are authored here rather than taken from the layout cycle, so
    // this row keeps the exact spacing Amit asked for wherever it sits in the
    // list. That is why moving it to 2 changed its ground but not its layout.
    { kinds: ['launch', 'wall', 'scenery'], without: ['woodWall'],
      density: 1, spread: 1.3, push: 0.25 }],
    // NO TERRAIN PIN ANY MORE. This used to name 'ridgeDrops' -- which was
    // cycle position 1 regardless, so the pin only ever restated where it
    // already was, and it is what would have put missions 1 and 2 on the same
    // hill once CRYSTAL RUN took the front. The name still tells the truth on
    // ridgeWeave: three drops, 6.5 deep, so the ground gives way there too.
  // 3 -- RAILS, on ice rather than on green. Adds the green metal on top of
  // mission 2's ramps; the objective is rails and nothing else.
  ['railRunner',  'RAIL RUNNER',   'Green metal. Get on it and stay on.',       90,
    // 4 rails once DIFFICULTY is applied (6 x 0.7 = 4.2). Authored rather than
    // hard-set so it still moves with the global scalar.
    //
    // Down from 6, and this one reverses a specific earlier instruction rather
    // than just easing a number: "level 2, six grinds instead of four" raised
    // it TO six back when rails were mission 2. Amit's own correction now that
    // rails are third and on a new hill: "4 rails." Landing on a rail is the
    // hardest of the three verbs -- aim, land on a line, hold it -- so it is
    // the one that least wants a long count in the teaching block.
    { grind: 6 }, undefined,
    { kinds: ['launch', 'grind', 'wall', 'scenery'], without: ['woodWall'],
      density: 1, feature: ['grind'] }],
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
  // EASED to 12,000. Amit: "mission 8 too hard -- reduce to 12,000." Authored
  // 17,000 because easeScore lands it on the 500 grid: 17000 * 0.7 = 11,900 ->
  // 12,000. Down from 14,000, which was 50% of what this hill actually pays
  // (28,218 measured); 12,000 is 43%, and this is the first mission that asks
  // for score and nothing else, so it is where a player meets the idea.
  ['fastLane',    'FAST LANE',     'Tuck low and let the hill do the work.',    75, { score: 17000 }],
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
  /**
   * EASED A SECOND TIME, ramps only. Amit: "mission 09 too hard -- reduce to
   * 4 ramps." launch 8 -> 6, which is 4 once DIFFICULTY is applied.
   *
   * ONLY THE RAMPS MOVED, though the whole mission was called hard. He named
   * one number, and this is the mission that teaches "several things at once"
   * -- cutting every leg turns one manageable combination into three trivial
   * jobs. The ramps were also the right leg to cut: they were the densest ask
   * of the three, and a ramp is the one objective a player cannot collect
   * incidentally, since crystals fall on your line and the rails are only two.
   *
   * If it is still hard, the crystals are the next cut -- they are the longest
   * job in it. Note the note above: this mission draws the tightest trough of
   * the six AND the layout with the hardest push off the centreline, which is
   * a collision of two cycles rather than anything authored.
   */
  ['fullPlate',   'FULL PLATE',    'A bit of everything, and no time to spare.', 95, { pickup: 16, grind: 3, launch: 6 }],
  ['ridgeMaster', 'RIDGE MASTER',  'Prove you have learned the whole ridge.',  100, { pickup: 23, score: 12000 }],
  ['doubleDown',  'DOUBLE DOWN',   'Twice the crystals, twice the ramps.',      90, { pickup: 23, launch: 10 }],
  ['steelRush',   'STEEL RUSH',    'Rails pay, and they pay while you are on them.', 105, { grind: 5, score: 11500 }],
  ['highRoller',  'HIGH ROLLER',   'One number matters. Make it big.',          85, { score: 21500 }],
  ['sweep',       'SWEEP',         'Sweep the hill, gates and all.',           100, { pickup: 14, boost: 7 }],
  ['launchParty', 'LAUNCH PARTY',  'Hit every ramp you can find.',              95, { launch: 28 }],
  /**
   * THREE IDOLS, NOT FOUR -- the one mission the difficulty budget could not
   * fit, and the reason is worth keeping.
   *
   * This hill grows SEVEN idols. It does not set rareAlways, unlike IDOL HUNT,
   * NIGHT SHIFT and STORM CHASE, and that is deliberate: the note on the idol
   * placements calls this "the scarce version on purpose... a hunt among the
   * crystals rather than a sweep". So the denominator here is 7, not the ~19
   * the rareAlways missions get.
   *
   * At four, that is 57% of every idol on the hill -- past the 40% line where
   * an ask stops being "collect some" and becomes "find nearly all of them",
   * which the budget penalises and which put this mission at 53 DP against a
   * target of 41. At three it is 43%, the penalty all but vanishes, and it
   * lands on 41 exactly.
   *
   * THE FIX IS THE COUNT, NOT rareAlways. Flooding the hill with idols would
   * also solve the arithmetic -- 4 of 19 is no sweep at all -- and would throw
   * away the only mission that asks the player to hunt scarce ones. Three of
   * seven is still a hunt; four of seven was a sweep wearing a hunt's name.
   */
  ['goldRush',    'GOLD RUSH',     'Crystals, and the idols among them.',      105, { pickup: 23, idol: 4 }],
  ['grindCity',   'GRIND CITY',    'Metal first, everything else after.',      110, { pickup: 31, grind: 4 }],
  // A speed mission that is finally ABOUT speed: the gates are the mechanic,
  // so asking for them is asking for the thing the mission is named after.
  ['topSpeed',    'TOP SPEED',     'Ride every gate you can reach.',            90, { boost: 5, score: 11500 }],
  ['gauntlet',    'THE GAUNTLET',  'All three, all at once, all downhill.',    110, { pickup: 23, launch: 11 }],
  ['lastLight',   'LAST LIGHT',    'The last run before the sun goes.',        120, { pickup: 25, score: 15500 }],

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
    { idol: 7, grind: 4 }, undefined, { rareAlways: true }],
  ['freeFall',    'FREE FALL',     'Let the ground do the work.',               90, { launch: 13, score: 13500 }],
  ['stoneStep',   'STONE STEP',    'Ramp to gate, all the way down.',          105, { launch: 7, boost: 8 }],
  ['deepEnd',     'DEEP END',      'High walls. Use them.',                     95, { score: 21500 }],
  ['loosePack',   'LOOSE PACK',    'Everything on the hill is worth points.',  110, { pickup: 27, launch: 11 }],
  ['switchHouse', 'SWITCH HOUSE',  'The road never lets you settle.',          100, { pickup: 25, boost: 5 }],
  ['pinchPoint',  'PINCH POINT',   'Narrow, and the gates are on the edges.',   85, { launch: 7, boost: 10 }],
  ['longHaul',    'LONG HAUL',     'Wide open and a long way down.',           115, { grind: 7, score: 14000 }],
  ['stepLadder',  'STEP LADDER',   'Every drop pays if you land it.',          100, { launch: 14, score: 15500 }],
  ['stormChase',  'STORM CHASE',   'Idols in the bowl. Go and get them.',      110,
    { idol: 7, grind: 4 }, undefined, { rareAlways: true }],
  // --- 31-40: the pairings come back around, so the demands take over --------
  ['ironWill',    'IRON WILL',     'Rails first. Everything else after.',       95, { pickup: 31, grind: 5 }],
  ['fastCurrent', 'FAST CURRENT',  'Never stop accelerating.',                  80, { boost: 7, score: 12000 }],
  ['cleanSweep',  'CLEAN SWEEP',   'Leave nothing on the hill.',               105, { pickup: 43 }],
  ['bigNumbers',  'BIG NUMBERS',   'Chain it. That is the only way.',           90, { score: 21500 }],
  ['nervePlay',   'NERVE PLAY',    'Three demands, one short clock.',           90, { pickup: 28, launch: 15 }],
  ['skyLine',     'SKY LINE',      'Every ramp, every time.',                   95, { launch: 28 }],
  ['tightRope',   'TIGHT ROPE',    'Idols on the tightest hill there is.',      85,
    { idol: 7, grind: 5 }, undefined, { rareAlways: true }],
  ['fullTilt',    'FULL TILT',     'Nothing held back.',                        85, { launch: 17, score: 17500 }],
  ['lastCall',    'LAST CALL',     'Everything you have learned, at once.',    100, { pickup: 14, grind: 4, launch: 7 }],
  // The finale asks for the two things Amit calls the most fun, plus a score
  // that needs the chain -- so the last mission is the game at its best rather
  // than its longest crystal sweep.
  /**
   * THE HARDEST MISSION ON THE LADDER, EASED BY ONE GATE. Amit, looking at the
   * finished budget: "take the hardest one, and make it a bit less hard."
   * 59 DP -> 53, which is a gate off the ask and nothing else.
   *
   * THE GATE RATHER THAN THE IDOL, deliberately, though both cost about the
   * same to remove. Idols are already at 5 here against the 7 that IDOL HUNT
   * asks at mission 5 -- an inversion the 60-DP ceiling forces, since IDOL
   * HUNT alone is 35 DP -- and taking a fourth would widen a gap that is
   * already the wrong way round. Gates have no such constraint: 4 is still
   * comfortably above the 4 that SPEED GATES teaches, and the idols are what
   * this mission is remembered for.
   */
  ['sundown',     'SUNDOWN',       'Everything the ridge has, one last time.', 115,
    { idol: 7, boost: 6 }, undefined, { rareAlways: true }],

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
  //
  // ONE SCALAR AGAIN, and deliberately so. A second back-half scalar briefly
  // lived here (counts x0.70, scores x0.85 from mission 10) as a quick way to
  // ease everything Amit had not yet played. It is gone: a flat percentage is
  // exactly the wrong instrument, because it cuts a 25-crystal ask and a
  // 4-rail ask by the same proportion, and rounding then drops the small one
  // to something below its own teaching mission. Missions 10-40 are now sized
  // individually against a measured difficulty budget -- see AUTHORED.
  objectives: KIND_ORDER.filter((k) => targets[k] != null).map((kind) => {
    return kind === 'score'
      ? { kind, count: easeScore(targets[kind]) }
      : kind === 'pickup'
        ? { kind, type: 'crystal', count: easeCount(targets[kind]) }
      // An idol is a pickup with a different type, not a different kind -- the
      // objective matcher already filters on p.type, so this needs no new
      // tracking. Authored as its own key purely so a mission can ask for both
      // in one line without the two counts colliding.
        : kind === 'idol'
          ? { kind: 'pickup', type: 'idol', count: easeCount(targets[kind]) }
          : { kind, count: easeCount(targets[kind]) };
  }),
  };
});

export function getMission(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}
