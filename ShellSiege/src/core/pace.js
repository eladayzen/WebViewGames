// HOW FAST THE WHOLE WORLD MOVES, as one number.
//
// Elad, 1 Nov, after playing it: "right now it feels like everything is
// moving too fast - the enemies, me, the projectiles - because our input is
// so hard to control."
//
// THE DIAGNOSIS IN THAT SENTENCE IS THE IMPORTANT PART, and it is not about
// any one of those three. A thumbstick answers instantly: you push, and the
// character is already going the other way. A balance board cannot. Changing
// direction means shifting your body weight, the deadzone eats the first
// part of the lean, and the forward/back axis engages later than sideways --
// so between deciding to turn and the game responding there is somewhere
// around half a second during which the player is still travelling the way
// they were.
//
// At the old 520 px/s that half-second carried the player about 260px -- an
// eighth of the screen -- after they had already decided to stop. Everything
// else was tuned against that 520, so everything else inherited it. Nothing
// was individually wrong. The SCALE was wrong, and a scale is one number.
//
// WHY A MULTIPLIER AND NOT NEW CONSTANTS. The constants in this game carry
// hard-won reasoning -- the 200 enemy speed alone took two wrong answers to
// find, and the shot speed is written as ENEMY.speedPxS * 1.2 precisely so
// the relationship cannot drift. Editing each of them by hand would throw
// all of that away and leave a set of numbers whose ratios nobody chose. A
// single scale moves the whole system and keeps every ratio exactly as it
// was argued.
//
// WHAT IS DELIBERATELY NOT PACED:
//   - the gem magnet. It is feedback for a kill, not something the player
//     reacts to; a reward that drifts in slowly is a reward that feels worse.
//   - the katana's sweep, the fire rate, the spawn rate, the level-up hold.
//     Those are rhythms measured in seconds, not travel measured in pixels,
//     and slowing them would be a different decision about pacing that
//     nobody has asked for.
//   - every DISTANCE: ranges, the standoff, the magnet radius, how far a
//     shot travels before it expires. Those are the geometry of a dodge and
//     the geometry is not what was wrong. Note the consequence, because it
//     is real: a slower shot covering the same distance is alive for longer,
//     so there are more of them in the air at once. They are also slow
//     enough to walk around, which is the trade being made.
//
// 0.7 IS A STARTING POINT AND IS EXPECTED TO MOVE. It is the first value
// that should be tried on a board, not the answer -- ?pace=0.6 and
// ?pace=0.85 are one reload away, and this prototype's actual deliverable is
// the number that felt right standing on the thing.

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

const raw = Number(QS.get('pace'));
export const PACE = Number.isFinite(raw) && raw > 0 ? raw : 0.7;

/** Scale a speed in px/sec by the global pace. Distances are NOT scaled. */
export function paced(pxPerSecond) {
  return pxPerSecond * PACE;
}
