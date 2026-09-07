/* The opponents.
 *
 * THEY ARE NOT SLOW. An earlier version made them easy by capping paddle
 * speed, and a paddle that barely moves is embarrassing to play against --
 * it looks broken rather than beaten, and beating it means nothing.
 *
 * What they are instead is WRONG, in the specific way a person steering by
 * leaning on a balance board is wrong. That player moves plenty. What they
 * cannot do is stop where they meant to: leaning is a physical commitment with
 * momentum in it, so they overshoot the ball, feel it, lean back, overshoot
 * again, and arrive wobbling around the right place a moment after the ball
 * has gone past. They also misread the angle, and they change their mind
 * halfway.
 *
 * So difficulty here is built from four wrongnesses, all of which leave the
 * paddle moving at a believable pace:
 *
 *   accel     how fast it can change its lean. THE ONE THAT MATTERS. Low
 *             acceleration with a high speed cap is precisely the board feel:
 *             it commits hard, cannot arrest, and sails past.
 *   error     how far off the true intercept it aims.
 *   reaction  how long before it commits to a ball that just turned around.
 *   rethink   how often it re-picks a target mid-approach, so it visibly
 *             changes its mind rather than tracking one smooth line.
 *
 * `speed` stays high for everyone. It is a ceiling, not the difficulty.
 */

import { SIDE_FAR, clamp } from './world.js';
import { predictAcross } from './physics.js';

export function stepAI(w, dt) {
  const pad = w.paddles[SIDE_FAR];
  const ai = w.ai;
  const b = w.ball;

  const approaching = b.live && b.vAlong > 0;

  if (approaching) {
    if (ai.reactionLeft > 0) {
      ai.reactionLeft -= dt;
    } else {
      // Re-aim periodically rather than continuously. Continuous tracking of a
      // wrong-but-fixed point looks like a machine with a bug; re-picking a
      // fresh wrong point every fraction of a second looks like someone who
      // keeps second-guessing where the ball is going.
      ai.rethinkLeft -= dt;
      if (ai.rethinkLeft <= 0) {
        ai.rethinkLeft = ai.rethink;
        ai.errorOffset = (w.rng() * 2 - 1) * ai.error;
        ai.target = predictAcross(w, pad.along) + ai.errorOffset;
      }
    }
  } else {
    // Drift back toward the middle between points, the same thing a player
    // does, so the paddle does not defend wherever the last point left it.
    ai.target = 0.5;
  }

  const want = clamp(ai.target, pad.half, w.A - pad.half);

  /* Momentum, not teleportation.
   *
   * The paddle steers toward a velocity proportional to how far off it is,
   * but can only CHANGE velocity at `accel`. That single limit is what
   * produces the overshoot-and-wobble: by the time it is on target it is
   * still travelling, so it sails past and has to haul itself back. */
  const desired = clamp((want - pad.across) * ai.approach, -ai.speed, ai.speed);
  const dv = clamp(desired - ai.vel, -ai.accel * dt, ai.accel * dt);
  ai.vel += dv;

  let next = pad.across + ai.vel * dt;

  // Walls stop it dead rather than bouncing it -- a paddle jammed against the
  // edge for a moment is another thing a real over-leaner does.
  const lo = pad.half;
  const hi = w.A - pad.half;
  if (next <= lo) {
    next = lo;
    ai.vel = 0;
  } else if (next >= hi) {
    next = hi;
    ai.vel = 0;
  }
  pad.across = next;
}

/* Called when a new rally starts. Velocity is deliberately NOT zeroed -- the
 * paddle carries its lean through the serve, exactly as a person would. */
export function resetAIForRally(w) {
  w.ai.reactionLeft = w.ai.reaction;
  w.ai.rethinkLeft = 0;
  w.ai.errorOffset = (w.rng() * 2 - 1) * w.ai.error;
}
