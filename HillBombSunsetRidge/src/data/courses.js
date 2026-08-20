// COURSES -- the shape of the ground a mode is played on.
//
// This is the CONTENT axis of a location. There are three:
//
//   COURSE   what is on the ground, and where it ends        (this file)
//   THEME    what it looks like                              (data/themes.js)
//   TERRAIN  the shape of the ground itself                  (data/terrain.js)
//
// They are separate on purpose. A mission may want "dense ramp course" while
// its theme is assigned, randomised or unlocked independently, and bundling
// them would force a new course every time you wanted a new look. TERRAIN
// joined them when the open face needed a genuinely different cross-section:
// a course NAMES a terrain (`terrain: 'openFace'`) and inherits the half-pipe
// if it says nothing, so every course that existed before keeps the exact
// ground it was tuned on.
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
    /**
     * FIXED LAYOUT. Missions are measured against this course -- star
     * thresholds came from timed runs on it -- and a replayed mission has to be
     * the same mission. Rolling an easier or harder layout would make a star
     * mean nothing.
     */
    variation: false,
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
    // 'wall' is here and nowhere else: real obstacles are a race idea for now.
    // A mission is a checklist against a clock and being stopped dead by a wall
    // makes its targets a lottery; a race already has rivals to lose ground to,
    // which is exactly what a wall should cost you.
    allowedKinds: ['launch', 'grind', 'scenery', 'boost', 'wall'],
    /**
     * A DIFFERENT HILL EVERY RUN. Nothing here is scored against a fixed
     * benchmark -- you are racing the riders beside you, and they ride whatever
     * you ride -- so the layout is free to change, and it should: the whole
     * point of a race is not knowing what is round the next bend.
     */
    variation: true,
  },

  /**
   * THE OPEN FACE -- a different hill, not a different set of props on the same
   * one. `terrain` is the new third field on a course, and this is the first
   * course to use it: the cross-section itself changes (data/terrain.js), so the
   * ground is roughly 40% wider, considerably shallower, and cheap enough to
   * ride away from the centreline that the whole width is worth using.
   *
   * FINITE, because a face is something you descend. 1800m is a little over a
   * minute at the measured 24-32 u/s -- shorter than the race on purpose: this
   * is a prototype meant to be ridden repeatedly to answer one question ("does
   * it stop feeling cramped"), and a 90-second lap between attempts is most of
   * the cost of asking it.
   *
   * No boosts and no walls. Both are race furniture -- one hands you speed you
   * did not carve for, the other takes it away -- and the thing being tested
   * here is whether the SHAPE is fun on its own. Crystals stay, because
   * something has to be worth crossing the face for; on a hill this wide, a
   * pickup out near the rim is the cheapest possible test of whether the width
   * reads as an opportunity or as dead ground.
   */
  openFace: {
    id: 'openFace',
    name: 'Open Face',
    kind: COURSE_FINITE,
    length: 1800,
    terrain: 'openFace',
    allowedKinds: ['launch', 'grind', 'scenery', 'pickup'],
    variation: true,
  },
};

export const DEFAULT_COURSE = 'sunsetRidge';
export const RACE_COURSE = 'sunsetRidgeRace';
export const OPEN_FACE_COURSE = 'openFace';

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
