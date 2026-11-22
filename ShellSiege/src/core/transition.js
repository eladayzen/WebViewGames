// THE MOMENT BETWEEN ROOMS, as numbers.
//
// Elad, 22 Nov: every room "feels underwhelming ... always the same", and the
// end of one should be "a moment" -- a fade to black or a graphic. So clearing
// a room is now a short sequence rather than a state change:
//
//   last kill   a beat of slow motion and a white flash
//   cleared     "ROOM CLEAR" slams in; the black IRIS closes in on the turtle
//   roll        the pizza box plays on the black
//   intro       the next room is already swapped in, UNDER the black; the iris
//               opens on it and its banner lands
//
// THE SWAP IS HIDDEN BY THE BLACK, which is the point of an iris over a cut:
// the floor and the layout change while the screen is closed, so nothing ever
// visibly pops.
//
// THE IRIS, NOT A PLAIN FADE. A circle closing on the character is the
// cartoon's own way of ending a scene, which suits this art; and it points the
// eye at the turtle at the one moment the player is about to be handed a
// reward. `IRIS_FADE_ONLY` turns it into a plain fade if that proves wrong.
//
// ALL OF IT IS A FUNCTION OF `run.phase` AND `run.t`. Nothing here keeps a
// timer of its own, so it cannot drift out of step with the run -- and it can
// be tested without a browser.
import { RUN } from './run.js';

export const TRANS = {
  closeS: 0.55,      // the iris closing, at the end of the "cleared" hold
  openS: 0.70,       // ...and opening again on the next room
  slowS: 0.60,       // real seconds of slow motion after the last kill
  slowScale: 0.35,   // how slow
  flashS: 0.14,      // the white flash on the last kill
};

const clamp01 = (k) => Math.max(0, Math.min(1, k));
/** Smoothstep: gentle at both ends, so neither the close nor the open snaps. */
const ease = (k) => { const x = clamp01(k); return x * x * (3 - 2 * x); };

/**
 * How open the screen is: 1 is the whole game visible, 0 is black.
 *
 * Continuous at every phase boundary (cleared -> roll -> intro -> fight), which
 * is what stops a frame of the old room or a frame of the new one showing
 * through the black.
 */
export function irisOpen(run) {
  switch (run.phase) {
    case 'intro':   return ease(run.t / TRANS.openS);
    case 'fight':   return 1;
    case 'cleared': return 1 - ease((run.t - (RUN.clearHoldS - TRANS.closeS)) / TRANS.closeS);
    default:        return 0;    // 'roll' and 'won' both stay on black
  }
}

/** Slow motion after the last kill: a factor on the simulation's clock. */
export const slowFactor = (remainingS) => (remainingS > 0 ? TRANS.slowScale : 1);

/**
 * The hole's radius in pixels for an open fraction, centred on (cx, cy) in a
 * w x h screen. Fully open must clear the FARTHEST corner, or a sliver of black
 * is left in one corner after the iris has "finished" opening.
 */
export function irisRadiusPx(open, cx, cy, w, h) {
  const far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
  return clamp01(open) * far;
}
