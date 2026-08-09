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
 * @typedef {{id:string, name:string, brief:string, seconds:number, objectives:Objective[]}} Mission
 */

/** @type {Mission[]} */
export const MISSIONS = [
  {
    id: 'firstDrop',
    name: 'FIRST DROP',
    brief: 'Learn the ridge. Grab what shines.',
    seconds: 70,
    objectives: [
      { kind: 'pickup', type: 'crystal', count: 6 },
      { kind: 'launch', count: 3 },
    ],
  },
  {
    id: 'railRunner',
    name: 'RAIL RUNNER',
    brief: 'The metal is faster than the paint.',
    seconds: 75,
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
    objectives: [
      { kind: 'trick', trick: 'backflip', count: 3 },
      { kind: 'air', min: 2.2, count: 4 },
    ],
  },
  {
    id: 'sunsetRun',
    name: 'SUNSET RUN',
    brief: 'Everything you know, before the light goes.',
    seconds: 90,
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
