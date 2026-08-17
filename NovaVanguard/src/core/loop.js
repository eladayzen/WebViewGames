// Fixed-timestep simulation at 60 Hz with an accumulator (§9.1).
//
// This is not a style preference. "The reaction-floor guarantees in §5.3 are
// expressed in seconds and must not drift with frame rate -- a variable-dt
// integration would make the pacing contract untestable." Every cap in this
// game (approach budget, aisle traverse speed, i-frame duration) is a claim
// about seconds, and the constraints validator checks those claims against
// authored numbers. If dt varied, the validator would be verifying something
// the simulation does not actually do.
//
// Note this file schedules nothing itself -- the render layer owns the frame
// callback (it is the thing that must also draw), and calls step() with the
// wall-clock delta. That keeps requestAnimationFrame -- and therefore the
// GoBalance rAF shim / window.__pumpFrames contract -- in exactly one place.

export const FIXED_DT = 1 / 60;

// If the page is backgrounded, or the WebView is occluded and Unity resumes
// pumping after a stall, the accumulated delta can be enormous. Clamp it, or
// the catch-up loop spirals and the game fast-forwards through a wave the
// player never saw.
const MAX_FRAME_S = 0.25;

export function createLoop(update) {
  let acc = 0;
  return {
    /** Advance the simulation by a wall-clock delta, in whole fixed steps.
     *  Returns the leftover fraction of a step, for render interpolation. */
    step(deltaS) {
      acc += Math.min(deltaS, MAX_FRAME_S);
      let steps = 0;
      while (acc >= FIXED_DT) {
        update(FIXED_DT);
        acc -= FIXED_DT;
        // Belt-and-braces against a pathological catch-up.
        if (++steps > 8) {
          acc = 0;
          break;
        }
      }
      return acc / FIXED_DT;
    },
    reset() {
      acc = 0;
    },
  };
}
