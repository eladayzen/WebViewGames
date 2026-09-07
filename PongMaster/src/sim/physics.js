/* Ball motion, walls, paddle contact, goals -- all in axis space.
 *
 * Written once and shared by both orientations. If anything in here ever needs
 * to know which way the court faces, something has been modelled wrong.
 */

import { SHARED, PROFILES, PLAYER_ASSIST } from '../data/tuning.js';
import { SIDE_NEAR, SIDE_FAR, clamp } from './world.js';

/* A paddle a person is steering. In two player that is both of them; in one
 * player only the near side, because the assist below is help for a human and
 * would be cheating if the opponent had it. */
function isHuman(w, side) {
  return side === SIDE_NEAR || w.twoPlayer;
}

/* How far either side of its centre a paddle can reach this step.
 *
 * Returns a SPAN rather than a radius, because a paddle that swept across the
 * court during the frame covered everything it passed through -- judging it
 * only where it ended up is what makes a well-timed reach read as a miss. */
function reachSpan(w, side, ballAcross) {
  const pad = w.paddles[side];
  let reach = pad.half + SHARED.ballRadius;

  if (w.assist && isHuman(w, side)) {
    reach += PLAYER_ASSIST.reachBonus;
    // Momentum credit, only when closing on the ball. Moving away, or
    // standing still, earns nothing -- this rewards having committed to the
    // reach, it does not widen the paddle in general.
    const closing = Math.sign(ballAcross - pad.across) === Math.sign(pad.vAcross);
    if (closing) reach += Math.abs(pad.vAcross) * PLAYER_ASSIST.graceSec;
  }

  // The swept path: where the paddle started this frame, to where it is now.
  const lo = Math.min(pad.prevAcross, pad.across) - reach;
  const hi = Math.max(pad.prevAcross, pad.across) + reach;
  return { lo, hi };
}

/* Reflect a value into [lo, hi] as many times as it takes, and report whether
 * the number of reflections was odd -- which is exactly when the velocity
 * along that axis has to flip.
 *
 * Doing it this way rather than with an `if` means a ball fast enough to cross
 * the court in a single step still lands somewhere legal, instead of escaping
 * through a wall the step happened to skip over.
 */
function fold(v, lo, hi) {
  const span = hi - lo;
  if (span <= 0) return { v: lo, flipped: false };
  const period = span * 2;
  let x = (((v - lo) % period) + period) % period;
  let flipped = false;
  if (x > span) {
    x = period - x;
    flipped = true;
  }
  return { v: lo + x, flipped };
}

/* Where the ball's CENTRE is when it touches a paddle's face. */
export function contactPlane(w, side) {
  const pad = w.paddles[side];
  const off = SHARED.paddleThickness / 2 + SHARED.ballRadius;
  return side === SIDE_NEAR ? pad.along + off : pad.along - off;
}

/* Advance the ball. Returns null, or {scoredBy} when a goal was crossed.
 *
 * `depth` guards the recursion that continues a step after a paddle hit --
 * without a cap, a ball wedged against a paddle by an orientation switch could
 * bounce forever inside one frame.
 */
export function stepBall(w, dt, depth = 0) {
  const b = w.ball;
  if (!b.live || dt <= 0 || depth > 4) return null;

  const r = SHARED.ballRadius;
  const prevAlong = b.along;
  const prevAcross = b.across;
  const rawAlong = prevAlong + b.vAlong * dt;
  const rawAcross = prevAcross + b.vAcross * dt;

  // --- paddle contact -----------------------------------------------------
  // Tested against the UNFOLDED across path, so a ball that bounces off a side
  // wall and reaches the paddle within the same step is still judged at the
  // right place. Folding first would compare against a position the ball never
  // actually travelled through.
  const side = b.vAlong < 0 ? SIDE_NEAR : SIDE_FAR;
  const plane = contactPlane(w, side);
  const crossed =
    side === SIDE_NEAR ? prevAlong > plane && rawAlong <= plane : prevAlong < plane && rawAlong >= plane;

  if (crossed) {
    const denom = rawAlong - prevAlong;
    const t = denom === 0 ? 0 : clamp((plane - prevAlong) / denom, 0, 1);
    const acrossAtRaw = prevAcross + (rawAcross - prevAcross) * t;
    const landed = fold(acrossAtRaw, r, w.A - r);
    const span = reachSpan(w, side, landed.v);

    if (landed.v >= span.lo && landed.v <= span.hi) {
      bounceOffPaddle(w, side, landed.v, landed.flipped);
      b.along = plane;
      b.across = landed.v;
      return stepBall(w, dt * (1 - t), depth + 1);
    }
  }

  // --- walls + travel -----------------------------------------------------
  const folded = fold(rawAcross, r, w.A - r);
  b.across = folded.v;
  if (folded.flipped) b.vAcross = -b.vAcross;
  b.along = rawAlong;

  // --- goals --------------------------------------------------------------
  if (b.along < -r) {
    b.live = false;
    b.parked = false;
    return { scoredBy: SIDE_FAR };
  }
  if (b.along > w.L + r) {
    b.live = false;
    b.parked = false;
    return { scoredBy: SIDE_NEAR };
  }
  return null;
}

/* Classic Pong's one piece of skill expression: where on the paddle the ball
 * lands decides the angle it leaves at, so a player is aiming, not just
 * blocking. Paddle motion at the moment of contact adds to that -- a
 * deliberate swipe sends the ball somewhere a parked paddle cannot.
 */
function bounceOffPaddle(w, side, acrossAt, wallFlipped) {
  const p = PROFILES[w.orientation];
  const b = w.ball;
  const pad = w.paddles[side];

  w.lastHitBy = side;
  if (wallFlipped) b.vAcross = -b.vAcross;

  const u = clamp((acrossAt - pad.across) / pad.half, -1, 1);
  const angle = u * SHARED.maxBounceAngle;

  b.speed = Math.min(b.speed * SHARED.speedUpPerHit, p.ballSpeedMax);

  const dir = side === SIDE_NEAR ? 1 : -1;
  b.vAlong = Math.cos(angle) * b.speed * dir;
  b.vAcross = Math.sin(angle) * b.speed + pad.vAcross * SHARED.spinFromPaddle;

  // Spin can push the total past the intended speed, so renormalise and let
  // the angle absorb it. Without this a few swiped returns compound into a
  // ball travelling faster than ballSpeedMax was ever meant to allow.
  const mag = Math.hypot(b.vAlong, b.vAcross);
  if (mag > 0) {
    b.vAlong = (b.vAlong / mag) * b.speed;
    b.vAcross = (b.vAcross / mag) * b.speed;
  }

  // A ball leaving almost parallel to the paddle takes an age to cross and
  // reads as a stall. Force a minimum share of the speed onto the goal axis.
  const minAlong = Math.cos(SHARED.maxBounceAngle) * b.speed;
  if (Math.abs(b.vAlong) < minAlong) {
    b.vAlong = dir * minAlong;
    const rest = Math.sqrt(Math.max(0, b.speed * b.speed - minAlong * minAlong));
    b.vAcross = Math.sign(b.vAcross || 1) * rest;
  }
}

/* The ball's path from here to a given goal-axis position, as the corner
 * points of its wall bounces. What the TRAJECTORY perk draws.
 *
 * Straight-line segments folded off the side walls -- exact, because nothing
 * changes the ball's velocity between paddles. It stops at the paddle plane
 * rather than continuing, since what happens after the return depends on where
 * the paddle is by then, which is precisely what the player is deciding.
 */
export function predictPath(w, targetAlong) {
  const b = w.ball;
  const pts = [{ along: b.along, across: b.across }];
  if (!b.live || b.vAlong === 0) return pts;

  let remaining = (targetAlong - b.along) / b.vAlong;
  if (remaining <= 0) return pts;

  const r = SHARED.ballRadius;
  const lo = r;
  const hi = w.A - r;
  let along = b.along;
  let across = b.across;
  let vAcross = b.vAcross;

  for (let guard = 0; guard < 16 && remaining > 0; guard++) {
    let tWall = Infinity;
    if (vAcross > 0) tWall = (hi - across) / vAcross;
    else if (vAcross < 0) tWall = (lo - across) / vAcross;

    if (tWall < remaining) {
      along += b.vAlong * tWall;
      across += vAcross * tWall;
      pts.push({ along, across });
      vAcross = -vAcross;
      remaining -= tWall;
    } else {
      along += b.vAlong * remaining;
      across += vAcross * remaining;
      pts.push({ along, across });
      break;
    }
  }
  return pts;
}

/* Where the ball will cross a given goal axis position, with wall bounces
 * accounted for. Used by the AI to aim, and by nothing else.
 */
export function predictAcross(w, atAlong) {
  const b = w.ball;
  if (b.vAlong === 0) return b.across;
  const t = (atAlong - b.along) / b.vAlong;
  if (t < 0) return b.across;
  const r = SHARED.ballRadius;
  return fold(b.across + b.vAcross * t, r, w.A - r).v;
}
