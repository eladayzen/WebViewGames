// COURSES -- the shape of the ground a mode is played on.
//
// This is the CONTENT half of a location. The other half is the THEME (palette,
// sky, surface art), which is deliberately a separate axis: a mission may want
// "dense ramp course" while its theme is assigned, randomised or unlocked
// independently. Bundling them would force a new course every time you wanted a
// new look.
//
// BOTH KINDS ARE REAL NOW. Finite was a declared hook for a long time -- named,
// typed, routed through the same descriptor, and throwing if anything touched
// it -- on the principle that a half-working finish line is worse than none.
// The race is what needed it, so it is built.
//
// A finite course is not a different world: the road still generates ahead of
// the rider exactly as before. What `length` adds is a FINISH DISTANCE that a
// mode can put a line at and end on. Keeping it that narrow is why the change
// stayed inside the mode and one new entity rather than spreading through world
// generation -- nothing downstream has to stop assuming the road continues,
// because it does.

export const COURSE_ENDLESS = 'endless';
export const COURSE_FINITE = 'finite';

export const COURSES = {
  /** The only course that exists today: generates ahead of the rider forever. */
  sunsetRidge: {
    id: 'sunsetRidge',
    name: 'Sunset Ridge',
    kind: COURSE_ENDLESS,
    /** null is what makes it endless. A finite course would put metres here. */
    length: null,
    /** Which prop kinds may spawn. Hazards deliberately absent -- see props.js. */
    allowedKinds: ['launch', 'grind', 'scenery', 'pickup'],
  },

  /**
   * The same hill, dressed for a race. Crystals are OUT and boost pads are IN --
   * a contest decided by speed should not also be asking you to detour for
   * points, and the two pickups would compete for the same glance.
   */
  sunsetRidgeRace: {
    id: 'sunsetRidgeRace',
    name: 'Sunset Ridge · Race',
    kind: COURSE_FINITE,
    /**
     * Metres to the finish. Chosen against the measured field rather than
     * picked: the pack runs 24-32 u/s, so 2600 m is a little over 90 seconds
     * for the leader -- about the length the timed version ran, but now ended
     * by arriving somewhere instead of by a clock running out.
     */
    length: 2600,
    allowedKinds: ['launch', 'grind', 'scenery', 'boost'],
  },
};

export const DEFAULT_COURSE = 'sunsetRidge';
export const RACE_COURSE = 'sunsetRidgeRace';

/**
 * @param {string} id
 * @returns {object} the course descriptor
 *
 * Finite courses fail LOUDLY here rather than quietly generating an endless
 * world that a race mode would then wait forever to finish.
 */
export function getCourse(id) {
  const c = COURSES[id] || COURSES[DEFAULT_COURSE];
  // A finite course MUST carry a length -- that is the entire difference between
  // the two kinds, and one without it would generate forever while a mode waited
  // for a finish that never arrives.
  if (c.kind === COURSE_FINITE && !(c.length > 0)) {
    throw new Error(`Course "${c.id}" is FINITE but has no length.`);
  }
  return c;
}
