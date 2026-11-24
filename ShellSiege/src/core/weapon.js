// WHAT HE THROWS, AND WHETHER IT COMES BACK.
//
// Two weapons, switched from the URL, because they are two different abilities
// and the only way to find out which one the game wants is to play both.
//
//   ?weapon=sai    Raphael's sai. Fast, and it RETURNS -- it buries itself in
//                  whatever it hits, bounces off, and arcs back to his hand.
//   ?weapon=star   the shuriken. Thrown, travels, expires. Kept, not replaced.
//
// WHY THE RETURN IS AN ARC AND NOT A STRAIGHT LINE. A blade that retraces its
// own path reads as the animation being played backwards; it is the one shape
// the eye reads as "rewind" rather than as "coming back". A bow to one side
// makes the outbound and the return two different journeys, which is what a
// thrown-and-caught weapon looks like. The arc also gets the blade out from
// behind whatever it just hit, so the return is not spent hidden inside a crate.
//
// THE RETURN CHASES THE PLAYER, because the player is moving. The curve is
// rebuilt every frame against where he is NOW, so the weapon lands in his hand
// rather than at the spot he was standing when he threw it.

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return Number.isFinite(v) && QS.get(k) !== null ? v : d;
};

export const WEAPONS = {
  star: {
    name: 'star',
    speedMul: 1,
    returns: false,
    // Drawn as a square, because a shuriken is one.
    aspect: 1,
    sizePx: num('starpx', 42),
    spinRadS: 26,
  },
  sai: {
    name: 'sai',
    // MUCH faster, per the brief. The sai is a stab that happens to be
    // airborne; the star is a thrown disc. They should not read as the same
    // projectile in a different coat.
    speedMul: num('saispd', 2.6),
    returns: true,
    // How quickly it comes home. Slower than the throw on purpose -- the
    // return is the part the player watches, and it is also the window in
    // which the weapon is unavailable.
    returnSpeedPxS: num('sairet', 1500),
    // How far the return bows out, as a fraction of the distance home.
    bow: num('saibow', 0.38),
    aspect: 320 / 107,
    // 38, not 64. At 64 the blade came out 1.9 units long against a 1.55-unit
    // turtle -- the weapon read as bigger than the character holding it, which
    // is funny once and wrong every time after.
    sizePx: num('saipx', 30.4),      // 38 -> 30.4: 20% smaller (Elad, 24 Nov); the held dagger follows it
    spinRadS: 11,
  },
};

export const WEAPON = WEAPONS[QS.get('weapon')] || WEAPONS.sai;

/**
 * A point along a quadratic arc from (x0,y0) to (x2,y2).
 *
 * The control point is the midpoint pushed sideways by `bow x distance`, so
 * the curve's depth scales with how far the weapon has to come -- a short
 * return is a small flick, a long one is a wide sweep, and neither needs its
 * own number. `side` is +1 or -1 so consecutive throws bow opposite ways and
 * two weapons in the air do not trace the same line.
 */
export function arcPoint(x0, y0, x2, y2, t, bow, side = 1) {
  const dx = x2 - x0;
  const dy = y2 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const cx = (x0 + x2) / 2 + (-dy / len) * bow * len * side;
  const cy = (y0 + y2) / 2 + (dx / len) * bow * len * side;
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * cx + t * t * x2,
    y: u * u * y0 + 2 * u * t * cy + t * t * y2,
  };
}
