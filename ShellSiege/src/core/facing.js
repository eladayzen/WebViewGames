// WHICH WAY THE BODY POINTS, which is no longer the way it is walking.
//
// THIS IS THE DECISION THE FOUR-WAY WALK SET FORCES. A character who always
// faces the way he travels needs exactly one walk clip, because he is always
// walking forward; four of them -- forward, back, left, right -- only mean
// something if the body can face one way while the feet go another. So the
// clips are the design: Raphael turns to face WHAT HE IS SHOOTING AT and
// strafes around it, which is also how every game in this genre reads and
// fixes the thing flagged on TMNT Survivor, where the weapon pointed wherever
// the player happened to be walking.
//
// HE TURNS, HE DOES NOT SNAP. A body that instantly faces each new target
// reads as a glitch rather than as aiming -- and with a horde, the nearest
// enemy changes several times a second, so an un-eased facing would spin on
// the spot. The turn rate is deliberately fast enough to feel responsive and
// slow enough to be visible.

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return Number.isFinite(v) && QS.get(k) !== null ? v : d;
};

/** Radians per second the body can rotate. ?turn= */
export const TURN_RATE = num('turn', 9);

/**
 * HE KEEPS AIMING A LITTLE PAST THE RANGE HE CAN SHOOT.
 *
 * Without this, the body's aim and the gun's reach share one boundary, and
 * anything hovering on it makes him whip between facing the target and facing
 * his own travel -- a 150-degree swing, several times a second, measured on a
 * crate sitting at 721px against a 620px range. Aiming 25% further out means
 * that by the time something is shootable he is already pointed at it, and the
 * only thing that happens at the gun's own edge is that the stars start.
 *
 * It costs nothing: he is looking at something he cannot hit yet, which is
 * what a person does.
 */
export const AIM_RANGE_MUL = num('aimr', 1.25);

/** An angle folded into (-PI, PI]. */
export function wrapPi(a) {
  const t = (a + Math.PI) % (Math.PI * 2);
  return (t < 0 ? t + Math.PI * 2 : t) - Math.PI;
}

/**
 * Move `cur` toward `want` by at most `rate * dt`, the short way round.
 *
 * The short way matters: without it a turn from +179 to -179 degrees takes the
 * long way and the character spins almost all the way around to move two
 * degrees, which is the single most common bug in this kind of code.
 */
export function stepAngle(cur, want, dt, rate = TURN_RATE) {
  const d = wrapPi(want - cur);
  const m = rate * dt;
  if (Math.abs(d) <= m) return wrapPi(want);
  return wrapPi(cur + Math.sign(d) * m);
}

/**
 * Where the body WANTS to point this frame.
 *
 * At whatever it is shooting at, if anything is in range -- otherwise along
 * the direction of travel, and if he is not travelling either, wherever he
 * was already pointing. That last clause is why this takes `current`: facing
 * recomputed from a zero vector snaps to east every time the player stops.
 */
export function desiredFacing(player, target, moving, current) {
  if (target) return Math.atan2(target.y - player.y, target.x - player.x);
  if (moving) return player.facing;
  return current;
}
