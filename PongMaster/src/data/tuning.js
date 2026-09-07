/* Every number that decides how the game feels, in one file.
 *
 * Sim units: the paddle-travel span (`across`) is always exactly 1.0, so every
 * length here reads as a fraction of it and transfers between the two
 * orientations unchanged. The goal-axis span is `courtRatio` in the same
 * units. Speeds are units per second.
 *
 * The two orientation profiles are SEPARATE on purpose. They are not the same
 * game at two rotations: the court proportions differ, and the axis the player
 * steers on differs in how much lean it takes and how much unintended drift it
 * collects. One shared tuning table would be wrong for at least one of them.
 */

import { CLASSIC, LATERAL } from './orientation.js';

// The letterbox every shipped game in this repo draws into.
export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

export const SHARED = {
  ballRadius: 0.019,
  // Chunky on purpose. A thin bar is the arcade-authentic look and the wrong
  // one here: this is read at a glance, from standing height, by someone whose
  // attention is mostly on not falling off a board.
  paddleThickness: 0.038,
  // Gap between the goal line and the paddle plane. Non-zero so a ball that
  // beats a paddle visibly passes it rather than vanishing into the wall.
  paddleInset: 0.05,

  // Steepest angle off a paddle, measured from the goal axis. 60 degrees: past
  // about this the ball spends so long crossing the court sideways that
  // rallies stop reading as rallies.
  maxBounceAngle: Math.PI / 3,
  // Serve angles stay shallow so a point always opens with a readable ball.
  maxServeAngle: Math.PI / 7,

  // The rally's own escalation, and the only thing that guarantees a point
  // ends. Once both paddles can cover the court a rally is a stalemate until
  // the ball outruns one of them, so this is not flavour -- a harness run with
  // a weak ramp sat at 0.6 points after ten simulated minutes.
  speedUpPerHit: 1.05,
  // How much of the paddle's own motion is inherited by the ball. This is what
  // makes a deliberate swipe at contact feel different from parking the paddle
  // in the ball's path, and it is the one skill expression classic Pong has.
  spinFromPaddle: 0.30,

  servePauseSec: 0.9,
  pointPauseSec: 1.1,
};

/* PLAYER ASSIST -- deliberately one-sided, and deliberately invisible.
 *
 * "I got there in time and it went past me" is usually true. Three things
 * conspire against a player who did reach the ball:
 *
 *   1. Contact is judged at the instant the ball crosses the paddle plane. A
 *      paddle that arrives one frame later missed, by 16ms, which no player
 *      can perceive as anything but the game being wrong.
 *   2. Reach is exact. Being 2mm short is a miss, and 2mm is far below what
 *      anyone can control by shifting their weight on a board.
 *   3. A paddle mid-sweep is judged only at the position it happens to hold
 *      when the ball arrives, ignoring the ground it covered getting there.
 *
 * All three fail in the same direction -- against the player -- and the game
 * is already hard, because steering by leaning is hard. So the paddle gets:
 *
 *   reachBonus   a flat invisible extension, about a quarter of a half-length
 *   graceSec     momentum credit: sweeping TOWARD the ball earns extra reach
 *                proportional to how fast you are closing. "You were on your
 *                way and would have made it."
 *
 * plus a swept test (physics.js) that credits the whole path the paddle
 * travelled during the frame rather than only where it ended up.
 *
 * The opponent gets NONE of this. It is help, not physics.
 */
export const PLAYER_ASSIST = {
  reachBonus: 0.024,
  graceSec: 0.13,
};

export const PROFILES = {
  /* Paddles on the left and right walls; the player steers fore/aft.
   *
   * A wide court is affordable here because the goal axis lies along the long
   * screen edge. It is also wanted: long ball flight is what buys reaction
   * time on the axis that is hardest to be precise on.
   */
  [CLASSIC]: {
    courtRatio: 1.70,
    paddleHalf: 0.090,
    // 30% down from the original 1.00 / 2.10 (playtest, 2026-09-07). Same
    // reason the ladder moved down a rung: a paddle steered by leaning is
    // slower to commit than one steered by a key, so ball speeds that read as
    // brisk on a keyboard read as unreturnable on a board.
    ballSpeed: 0.70,
    // The cap is a SEPARATE knob from the start speed, and it is deliberately
    // not 30% down with it: the start speed is what a player feels on every
    // serve, while the cap only matters ~30 exchanges in, where its whole job
    // is to end a rally nobody is losing.
    ballSpeedMax: 2.40,

    // Fore/aft collects unintended lean from a rider simply keeping balance,
    // so this axis gets a bigger deadzone and a gentler gain than the lateral
    // one. GOBALANCE_SDK.md's brake-threshold note is the same problem seen
    // from the other side.
    deadzone: 0.15,
    absGain: 1.25,
    rateSpeed: 1.45,
    smoothing: 16,
  },

  /* Paddles on the top and bottom walls; the player steers left/right.
   *
   * courtRatio is close to CLASSIC's on purpose even though the goal axis now
   * lies along the SHORT screen edge -- which means the court cannot span the
   * frame and gets real margins either side. That is the deliberate trade: a
   * court stretched to fill a 16:9 frame in this orientation would have a
   * goal-to-paddle proportion near 0.56, and Pong at that shape is all
   * turnaround and no rally.
   */
  [LATERAL]: {
    courtRatio: 1.45,
    paddleHalf: 0.090,
    ballSpeed: 0.70,
    // The cap is a SEPARATE knob from the start speed, and it is deliberately
    // not 30% down with it: the start speed is what a player feels on every
    // serve, while the cap only matters ~30 exchanges in, where its whole job
    // is to end a rally nobody is losing.
    ballSpeedMax: 2.40,

    deadzone: 0.07,
    absGain: 1.05,
    rateSpeed: 1.55,
    smoothing: 20,
  },
};

/* Input mapping -- the second half of the same experiment as orientation.
 *
 * ABSOLUTE: lean angle IS paddle position. The direct, obvious mapping, and
 *   the one that feels like Pong. Its failure mode is drift: a rider's neutral
 *   point wanders as they settle, and the paddle then sits permanently off
 *   centre with no way to correct it short of leaning back the other way and
 *   holding it there.
 *
 * RATE: lean is paddle VELOCITY. Immune to neutral drift by construction --
 *   letting go returns to "not moving", not "wrong place" -- at the cost of
 *   feeling one step removed from the board.
 *
 * Expectation going in is that ABSOLUTE wins on feel and drift decides against
 * it on the fore/aft axis, which would make the answer differ per orientation.
 * Both are built because that guess is cheap to test now and expensive to
 * retrofit later; the input layer is the one place the choice touches.
 */
export const ABSOLUTE = 'absolute';
export const RATE = 'rate';
export const MAPPINGS = [ABSOLUTE, RATE];

export const DEFAULT_MAPPING = {
  [CLASSIC]: ABSOLUTE,
  [LATERAL]: ABSOLUTE,
};

/* Auto-recenter: the direct answer to neutral drift, and useful under either
 * mapping. When the tilt sits still for a moment, treat wherever it is as the
 * new zero. The window is generous enough that a player holding a lean to
 * chase a ball is never recentred mid-rally.
 */
export const RECENTER = {
  enabled: true,
  stillnessSec: 0.75,
  // Tilt has to stay inside this band for the whole window to count as still.
  stillnessBand: 0.05,
  // Never adopt a neutral further than this from true zero, or a player who
  // leans and holds through the whole window teaches the game a bad centre.
  maxOffset: 0.40,
};

/* One-player ladder.
 *
 * A run is a series of matches against progressively harder opponents --
 * in-run progression, which is the kind PIPELINE.md explicitly wants, as
 * opposed to the cross-session unlock webs it permanently rules out. The run
 * ends the first time an opponent takes a match, or when the last one is
 * beaten.
 *
 * Who the opponents actually are lives in data/opponents.js.
 */
export const LADDER = {
  pointsPerMatch: 7,
  pointsForRallyWin: 1,
  bonusPerMatchWon: 10,
};
