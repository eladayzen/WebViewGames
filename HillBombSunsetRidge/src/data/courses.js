// COURSES -- the shape of the ground a mode is played on.
//
// This is the CONTENT half of a location. The other half is the THEME (palette,
// sky, surface art), which is deliberately a separate axis: a mission may want
// "dense ramp course" while its theme is assigned, randomised or unlocked
// independently. Bundling them would force a new course every time you wanted a
// new look.
//
// TWO KINDS, ONE BUILT. Amit: have a way to get a finite course in when we want
// it, but do not build or support it yet. So ENDLESS is real and FINITE is a
// declared hook -- named, typed, and routed through the same descriptor, but it
// throws the moment anything tries to use it rather than half-working.
//
// The distinction matters more than it looks. Endless generation has no notion
// of "the end", so a finish line, a progress bar, a lap, or a race against
// competitors all need the finite path. Leaving the field here means the day we
// want one, the change is localised to world generation instead of being
// threaded back through every mode that assumed the world goes on forever.

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
};

export const DEFAULT_COURSE = 'sunsetRidge';

/**
 * @param {string} id
 * @returns {object} the course descriptor
 *
 * Finite courses fail LOUDLY here rather than quietly generating an endless
 * world that a race mode would then wait forever to finish.
 */
export function getCourse(id) {
  const c = COURSES[id] || COURSES[DEFAULT_COURSE];
  if (c.kind === COURSE_FINITE) {
    throw new Error(
      `Course "${c.id}" is FINITE, which is not implemented. The hook exists so a `
      + 'finish line can be added later; world generation, the end condition and '
      + 'any progress UI all still assume an endless course.',
    );
  }
  return c;
}
