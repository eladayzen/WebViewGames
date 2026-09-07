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

/* EVERY OPPONENT MOVES FAST. None of them is beaten by being slow.
 *
 * They are beaten by being wrong in the way a person on a balance board is
 * wrong -- committing hard to a lean, sailing past the ball, hauling back,
 * overshooting again, and changing their mind on the way. `speed` is a ceiling
 * they all share roughly; `accel` is what actually separates them, because low
 * acceleration against a high ceiling is exactly what over-leaning feels like.
 *
 * Read the table down the `accel` column, not the `speed` one.
 *
 *   approach  how hard it converges on the target. Higher brakes earlier;
 *             lower means it keeps its foot down and overshoots further.
 */
export const OPPONENTS = [
  {
    id: 'rook',
    name: 'ROOK',
    css: '#9be564',
    blurb: 'Lunges. Sails straight past it. Every time.',
    speed: 0.95,
    accel: 1.00,
    approach: 2.2,
    error: 0.30,
    reaction: 0.55,
    rethink: 0.30,
  },
  {
    id: 'vex',
    name: 'VEX',
    css: '#ffa14a',
    blurb: 'Gets there. Usually a beat late, usually wobbling.',
    speed: 1.05,
    accel: 2.10,
    approach: 3.4,
    error: 0.19,
    reaction: 0.36,
    rethink: 0.50,
  },
  {
    id: 'nyx',
    name: 'NYX',
    css: '#f48dd4',
    blurb: 'Settles where the ball is going, and waits there.',
    speed: 1.20,
    accel: 3.60,
    approach: 5.0,
    error: 0.095,
    reaction: 0.20,
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
