/* The ladder, as three opponents rather than a difficulty number.
 *
 * The same escalation used to be an anonymous "rung" -- the paddle simply got
 * faster and the score line still said CPU. Giving each step a name, a colour
 * and a manner turns "the CPU got harder" into "I beat Rook, now I'm up
 * against Vex", which is the difference between a slider and a ladder. It also
 * gives the run a shape: three opponents is a campaign you can finish, and
 * finishing is one of the three endings the run model already has a screen for.
 *
 * Difficulty is three separate levers, and they are what make an opponent read
 * as a character rather than as a multiplier:
 *
 *   speed     how fast its paddle can travel, in across-units per second.
 *             Below the ball's own pace means it genuinely cannot reach
 *             everything.
 *   error     how far off the true intercept it aims, in across-units. Fixed
 *             per rally rather than resampled per frame, so it commits to a
 *             wrong spot and gets beaten cleanly instead of jittering around
 *             the right one.
 *   reaction  how long it ignores a ball that has just changed direction.
 *
 * THE WHOLE LADDER SITS LOWER THAN IT FIRST DID (playtest, 2026-09-07). The
 * original opening opponent turned out to be about right as the FINAL one, so
 * its numbers are now NYX's and the two below it were rebuilt underneath.
 * Steering a paddle by leaning on a board is far slower and far less precise
 * than steering one with a keyboard, and difficulty picked against a keyboard
 * reads as brutal on the board -- which is the only place this actually gets
 * played.
 *
 * ROOK is meant to be genuinely bad, not politely easy: slow enough to be
 * outrun, sloppy enough to aim at the wrong place entirely, and late on every
 * turnaround. Its job is to let someone who has never stood on a board finish
 * a match and understand the game.
 */

/* CALM, AND SLOWER THAN THE BALL. Reference Pong, not a twitching machine.
 *
 * This has now been wrong in both directions, and both are worth remembering.
 * Capping speed alone made them barely move, which looked broken rather than
 * beaten. Fixing that with high speed, low acceleration and a target re-picked
 * three times a second made them hectic -- constantly darting, correcting and
 * changing their mind, which is exhausting to watch and to play against.
 *
 * Reference Pong's opponent simply tracks the ball toward where it is going,
 * at a capped speed, and loses because that cap is not quite enough. It reads
 * as deliberate. That is the target here: the wrongness stays, but it is
 * committed to rather than re-rolled -- ONE read of the angle per approach,
 * held, so the paddle travels one clean line and is beaten by being in the
 * wrong place rather than by flailing between two.
 *
 *   speed     the cap. Under the ball's own pace, so it cannot cover
 *             everything -- this is the main difficulty lever again.
 *   accel     high enough now to arrive smoothly rather than oscillate.
 *   rethink   long. One committed read per approach, occasionally corrected,
 *             instead of a new guess every few frames.
 */
export const OPPONENTS = [
  {
    id: 'rook',
    name: 'ROOK',
    css: '#9be564',
    blurb: 'Reads it late, and never quite gets across.',
    speed: 0.40,
    accel: 2.40,
    approach: 3.0,
    error: 0.17,
    reaction: 0.46,
    rethink: 1.20,
  },
  {
    id: 'vex',
    name: 'VEX',
    css: '#ffa14a',
    blurb: 'Covers the middle. Give it a corner and it is gone.',
    speed: 0.52,
    accel: 3.20,
    approach: 3.8,
    error: 0.155,
    reaction: 0.33,
    rethink: 1.00,
  },
  {
    id: 'nyx',
    name: 'NYX',
    css: '#f48dd4',
    blurb: 'Settles where the ball is going, and waits there.',
    speed: 0.62,
    accel: 4.20,
    approach: 4.6,
    error: 0.115,
    reaction: 0.22,
    rethink: 0.85,
  },
];

/* Pixi wants a number, CSS wants a string. One source of truth, converted
 * here, rather than two hex literals that can drift apart. */
export function tint(opponent) {
  return parseInt(String(opponent.css).slice(1), 16);
}

export function opponentFor(index) {
  return OPPONENTS[Math.min(Math.max(index, 0), OPPONENTS.length - 1)];
}

export function isLastOpponent(index) {
  return index >= OPPONENTS.length - 1;
}
