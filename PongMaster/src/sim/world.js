/* The world, entirely in (along, across) axis space.
 *
 * Nothing in this file or physics.js knows what a pixel is, which way is up,
 * or which orientation is running. That is the whole point: rotating the game
 * a quarter turn changes the projection and the tuning profile, not the
 * simulation.
 */

import { GameState } from '../core/state.js';
import { SHARED, PROFILES, LADDER } from '../data/tuning.js';
import { opponentFor } from '../data/opponents.js';

export const SIDE_NEAR = 0; // defends along = 0. Always this device's board.
export const SIDE_FAR = 1;  // defends along = L. AI in one-player, board two otherwise.

export function createWorld(orientation, rng) {
  const p = PROFILES[orientation];
  const w = {
    orientation,
    rng,
    L: p.courtRatio,
    A: 1,

    state: GameState.SERVING,
    stateAge: 0,
    timer: SHARED.servePauseSec,
    paused: false,

    twoPlayer: false,
    // Whether the human paddle gets the one-sided help in physics.js. Driven
    // from the dev panel so it can be felt on and off back to back.
    assist: true,

    ball: {
      along: p.courtRatio / 2,
      across: 0.5,
      vAlong: 0,
      vAcross: 0,
      speed: p.ballSpeed,
      // `live` drives physics; `parked` means the ball is sitting on the
      // server's paddle waiting to launch. Split so the renderer can show a
      // ball that is not moving without the simulation having to step it.
      live: false,
      parked: false,
    },

    paddles: [makePaddle(SHARED.paddleInset, p), makePaddle(p.courtRatio - SHARED.paddleInset, p)],

    // Points inside the current match.
    score: [0, 0],
    // One-player ladder progress.
    matchIndex: 0,
    matchesWon: 0,
    rallyPointsWon: 0,
    // Who puts the next ball into play. The WINNER of a point serves, and
    // serves off their own paddle -- so a point you just won hands you the
    // ball where you are standing rather than dropping it back in the middle.
    server: SIDE_NEAR,
    lastPointTo: -1,

    // Who is on the far side of the net. Null in two-player, where the far
    // paddle is a person rather than a rung.
    opponent: opponentFor(0),
    // `vel` is the opponent's own lean momentum -- the thing that makes it
    // overshoot instead of arriving neatly. See sim/ai.js.
    ai: { target: 0.5, vel: 0, reactionLeft: 0, rethinkLeft: 0, errorOffset: 0, ...opponentFor(0) },
  };
  return w;
}

function makePaddle(along, profile) {
  return {
    along,
    across: 0.5,
    prevAcross: 0.5,
    vAcross: 0,
    half: profile.paddleHalf,
  };
}

/* Re-fit the world to a different orientation WITHOUT ending the run.
 *
 * This exists so the orientation switch can be thrown mid-session on a real
 * board and the difference felt back to back, which is the only way the
 * question it exists to answer actually gets answered. Positions are carried
 * across as fractions rather than absolutes, because the goal-axis span
 * changes with the profile.
 */
export function applyOrientation(w, orientation) {
  const p = PROFILES[orientation];
  const alongFrac = w.ball.along / w.L;

  w.orientation = orientation;
  w.L = p.courtRatio;

  w.ball.along = alongFrac * w.L;
  w.paddles[SIDE_NEAR].along = SHARED.paddleInset;
  w.paddles[SIDE_FAR].along = w.L - SHARED.paddleInset;
  for (const pad of w.paddles) {
    pad.half = p.paddleHalf;
    pad.across = clamp(pad.across, pad.half, w.A - pad.half);
    pad.prevAcross = pad.across;
    pad.vAcross = 0;
  }

  // Ball speed is expressed in across-units/sec, which do not change, so the
  // ball keeps its pace. Only its direction is re-derived, since the along
  // component now means a different fraction of a different court.
  const s = w.ball.speed;
  const ang = Math.atan2(w.ball.vAcross, w.ball.vAlong);
  w.ball.vAlong = Math.cos(ang) * s;
  w.ball.vAcross = Math.sin(ang) * s;
}

export function setState(w, state, timer = 0) {
  w.state = state;
  w.stateAge = 0;
  w.timer = timer;
}

/* Sit the ball on the server's paddle, not moving.
 *
 * Called every frame of the serve pause, so the ball TRACKS the paddle while
 * the player settles into a stance -- the ball is visibly theirs, and where it
 * launches from is something they are already steering before it launches.
 */
export function parkBall(w, side) {
  const b = w.ball;
  const pad = w.paddles[side];
  const off = SHARED.paddleThickness / 2 + SHARED.ballRadius;
  b.along = side === SIDE_NEAR ? pad.along + off : pad.along - off;
  b.across = pad.across;
  b.vAlong = 0;
  b.vAcross = 0;
  b.live = false;
  b.parked = true;
}

/* Launch the parked ball toward the other side.
 *
 * It leaves from wherever the server's paddle actually is rather than from the
 * middle of the court, so winning a point hands the ball back at the spot you
 * won it. The spread is small and random, so a serve is a real ball to return
 * and not a fixed opening the player can learn to stand on.
 */
export function serve(w, side) {
  const p = PROFILES[w.orientation];
  const b = w.ball;

  parkBall(w, side);
  b.speed = p.ballSpeed;
  b.live = true;
  b.parked = false;

  const angle = (w.rng() * 2 - 1) * SHARED.maxServeAngle;
  const dir = side === SIDE_NEAR ? 1 : -1;
  b.vAlong = Math.cos(angle) * b.speed * dir;
  b.vAcross = Math.sin(angle) * b.speed;

  w.ai.reactionLeft = w.ai.reaction;
  w.ai.rethinkLeft = 0;
  w.ai.errorOffset = (w.rng() * 2 - 1) * w.ai.error;
}

export function resetMatch(w) {
  w.score = [0, 0];
  w.server = SIDE_NEAR;
  w.lastPointTo = -1;
  for (const pad of w.paddles) {
    pad.across = 0.5;
    pad.prevAcross = 0.5;
    pad.vAcross = 0;
  }
}

export function resetRun(w) {
  resetMatch(w);
  w.matchIndex = 0;
  w.matchesWon = 0;
  w.rallyPointsWon = 0;
  w.opponent = opponentFor(0);
  Object.assign(w.ai, w.opponent);
  w.ball.live = false;
  w.ball.parked = false;
  setState(w, GameState.SERVING, SHARED.servePauseSec);
}

/* Beat one opponent, face the next. The caller checks first whether there IS
 * a next one -- running off the end of the ladder is the campaign ending, not
 * something to clamp silently. */
export function advanceLadder(w) {
  w.matchesWon += 1;
  w.matchIndex += 1;
  w.opponent = opponentFor(w.matchIndex);
  Object.assign(w.ai, w.opponent);
  resetMatch(w);
}

/* The run's single ranked number.
 *
 * submitScore takes one integer per run, so a two-player versus result has
 * nowhere to go -- see notes in main.js. This is the one-player figure.
 */
export function runScore(w) {
  return w.rallyPointsWon * LADDER.pointsForRallyWin + w.matchesWon * LADDER.bonusPerMatchWon;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
