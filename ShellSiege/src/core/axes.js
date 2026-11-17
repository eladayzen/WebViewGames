// WHICH WAY IS "RIGHT" WHEN THE CAMERA IS TURNED 45 DEGREES.
//
// This is the one piece of this port that is easy to get subtly wrong and
// impossible to argue about from a desk, so it lives on its own and is tested.
//
// The sim thinks in screen space, exactly as the 2D game did: +x is right, +y
// is DOWN the screen. The board and the keyboard both speak that language --
// systems/input.js already flips the board's y, which reports lean-forward as
// positive while a screen's y points down (see the long note there; this is
// Nova Vanguard's finding and the hardware is the authority).
//
// But the scene's ground plane is not the screen. The camera sits at an
// azimuth of 45 degrees, so walking "up the screen" is walking diagonally
// across the world, and feeding raw input straight into world x/z would send
// the player off at 45 degrees to the lean. On a stick nobody would tolerate
// that; on a balance board, where the player is already fighting the deadzone
// and half a second of body weight, it would be unplayable.
//
// So: rotate the input by the camera's azimuth, once, here.
//
// WHY THE RESULT IS STILL CALLED x/y. Everything downstream -- the walk, the
// bounds, the facing, the targeting, the bullets -- is the 2D game's code and
// still thinks in the plane. The renderer maps y to z at the very last step.
// Keeping one name for one plane is what lets those modules port untouched.

/**
 * Turn a screen-space lean into a world-space direction on the ground plane.
 *
 * @param {{x:number,y:number}} input  -1..1 per axis, +y is down the screen
 * @param {number} yaw                 camera azimuth in radians (see render/view.js)
 * @returns {{x:number,y:number}}      world ground direction, same magnitude
 */
export function screenToWorld(input, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  // Screen-right on the ground is (sin yaw, -cos yaw) -- the camera's forward
  // vector crossed with world up.
  //
  // Screen-DOWN is (cos yaw, sin yaw), which is the camera's forward vector
  // NEGATED, and that minus sign is the whole trap. The camera sits at
  // `target + dist * (cos yaw, ., sin yaw)`, so its forward vector points
  // AWAY from the viewer and into the scene -- travelling along it walks the
  // player UP the screen, not down. The first cut of this file mapped
  // input.y = +1 onto forward, which inverted the axis: holding ArrowUp
  // walked him toward the camera. It was caught by driving the real browser
  // and projecting the player through the real camera matrix, and NOT by the
  // unit test, which had been written from the same wrong premise and so
  // agreed with the bug. Hence the projection assertions in
  // test/axes.test.mjs, which check against the camera's POSITION and can
  // only be satisfied by the right answer.
  return {
    x: input.x * s + input.y * c,
    y: -input.x * c + input.y * s,
  };
}
