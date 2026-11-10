// THE FACE RAIL (§5.1). This file owns both curves and nothing else in the
// codebase defines the wave's geometry.
//
// The wave is a diagonal, so the playfield is not an axis-aligned rectangle.
// It is two authored curves spanning the frame width plus a normalized height
// parameter h between them:
//
//     faceY(x, h) = lerp( troughY(x), crestY(x), h )      // h=0 trough, h=1 lip
//
// Every entity in the world is stored as (worldX, h) and rendered through that
// one function -- §9.4 calls this the one abstraction to get right first, and
// it is what makes the barrel a rail swap rather than a second game.
//
// Both rails are cubics, not straight lines, with a gentle downward sag toward
// the right so the face reads as a real wave rather than a wedge. They are
// authored here as three anchor points (left edge / player column / right edge,
// exactly the §5.1 table) plus one sag coefficient; the cubic that passes
// through all three is solved at module load so the table stays the artifact
// you edit.

/**
 * Solve y = k*x^3 + a*x^2 + b*x + c through the three anchors, for a chosen
 * cubic term k. Anchors are [y at x=0, y at x=0.25, y at x=1].
 */
function solveCubicRail(y0, y25, y1, k) {
  const c = y0;
  // k + a + b = y1 - c
  // 0.015625k + 0.0625a + 0.25b = y25 - c
  const r1 = y1 - c - k;
  const r2 = y25 - c - 0.015625 * k;
  // b = r1 - a  ->  0.0625a + 0.25(r1 - a) = r2
  const a = (r2 - 0.25 * r1) / (0.0625 - 0.25);
  const b = r1 - a;
  return { k, a, b, c };
}

function evalRail(p, x) {
  return ((p.k * x + p.a) * x + p.b) * x + p.c;
}

// §5.1's table. Usable face height at the player column is 0.955 - 0.235 =
// 0.72 of frame height (778 px) -- deliberately taller than the concept frames
// draw it (§1's correction), because the h-axis needs the room to be
// expressive.
export const CREST_ANCHORS = { left: 0.20, player: 0.235, right: 0.30 };
export const TROUGH_ANCHORS = { left: 0.92, player: 0.955, right: 1.00 };

const RAIL_SAG = 0.03; // the cubic term: a gentle extra sag toward the right

const CREST = solveCubicRail(CREST_ANCHORS.left, CREST_ANCHORS.player, CREST_ANCHORS.right, RAIL_SAG);
const TROUGH = solveCubicRail(TROUGH_ANCHORS.left, TROUGH_ANCHORS.player, TROUGH_ANCHORS.right, RAIL_SAG);

/** Top of the usable face (the lip) at normalized screen x. */
export function crestY(x) {
  return evalRail(CREST, x);
}

/** Bottom of the usable face (the trough) at normalized screen x. */
export function troughY(x) {
  return evalRail(TROUGH, x);
}

export const faceRail = { crestY, troughY, name: 'face' };
