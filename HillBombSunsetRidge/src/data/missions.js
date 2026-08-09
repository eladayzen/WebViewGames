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
// tucks for speed and takes the ramps scores ~34k. That 3.7x spread is the
// whole design space, and the first guessed pair (9k/15k) sat entirely in the
// bottom of it -- a bare clear came out at two stars and three was routine.
// Mission 1 is measured; 2-4 are scaled from it by duration and are the obvious
// thing to re-measure once they are actually played.
//
// OBJECTIVE KINDS. Each names an event and, optionally, a filter on its payload:
//
//   pickup   {type}   collect N of a pickup type
//   trick    {trick}  land N of a SPECIFIC trick ('backflip' | 'spin')
//   anyTrick          land N tricks of any kind
//   launch            leave N ramps (any launcher)
//   grind             complete N grinds
//   air      {min}    land N jumps that cleared `min` metres
//   score             reach N points
//
// Adding a kind means adding one entry to KIND_SPECS in modes/missions.js and
// nothing else -- deliberately, so missions stay data.

/**
 * @typedef {{kind:string, count:number, type?:string, trick?:string, min?:number, label?:string}} Objective
 * @typedef {{id:string, name:string, brief:string, seconds:number, stars:[number,number], objectives:Objective[]}} Mission
 */

/** @type {Mission[]} */
export const MISSIONS = [
  {
    id: 'firstDrop',
    name: 'FIRST DROP',
    brief: 'Learn the ridge. Grab what shines.',
    seconds: 70,
    /** score thresholds for stars 2 and 3; star 1 is finishing. */
    stars: [14000, 26000],
    // ONE objective. The first mission teaches one thing -- go and get the
    // crystals -- and a second line beside it would split the attention of a
    // player still working out how the board turns.
    objectives: [
      { kind: 'pickup', type: 'crystal', count: 10 },
    ],
  },
  {
    id: 'railRunner',
    name: 'RAIL RUNNER',
    brief: 'The metal is faster than the paint.',
    seconds: 75,
    /** score thresholds for stars 2 and 3; star 1 is finishing. */
    stars: [16000, 30000],
    objectives: [
      { kind: 'grind', count: 4 },
      { kind: 'pickup', type: 'crystal', count: 8 },
    ],
  },
  {
    id: 'flipShow',
    name: 'FLIP SHOW',
    brief: 'Big ramps only. Land them clean.',
    seconds: 80,
    /** score thresholds for stars 2 and 3; star 1 is finishing. */
    stars: [17000, 32000],
    objectives: [
      { kind: 'trick', trick: 'backflip', count: 3 },
      { kind: 'air', count: 4 }, // "huge" is the popup's own threshold, not a separate one
    ],
  },
  {
    id: 'sunsetRun',
    name: 'SUNSET RUN',
    brief: 'Everything you know, before the light goes.',
    seconds: 90,
    /** score thresholds for stars 2 and 3; star 1 is finishing. */
    stars: [20000, 36000],
    objectives: [
      { kind: 'anyTrick', count: 6 },
      { kind: 'grind', count: 3 },
      { kind: 'pickup', type: 'crystal', count: 10 },
    ],
  },
];

export function getMission(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}
