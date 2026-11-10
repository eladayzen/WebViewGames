// The barrel section's rail pair (§5.7).
//
// Inside the wave the same h axis is bounded by the tube's inner wall instead
// of the face rail: a rocky ceiling above, a sandy floor below. NOTHING ELSE IN
// THE MOVEMENT MODEL CHANGES -- /wave swaps which rail pair faceY() reads and
// the player, the pickups and the collision test are all unchanged. That is the
// whole point of §9.4's "all positions are (worldX, h)".
//
// The interior is deliberately a little tighter than the open face and it
// undulates the other way (the ceiling rises toward the right, toward the
// barrel mouth), so the section reads as an enclosure rather than as the same
// wave with a filter over it.

function solveCubicRail(y0, y25, y1, k) {
  const c = y0;
  const r1 = y1 - c - k;
  const r2 = y25 - c - 0.015625 * k;
  const a = (r2 - 0.25 * r1) / (0.0625 - 0.25);
  const b = r1 - a;
  return { k, a, b, c };
}

function evalRail(p, x) {
  return ((p.k * x + p.a) * x + p.b) * x + p.c;
}

export const CEILING_ANCHORS = { left: 0.30, player: 0.295, right: 0.24 };
export const FLOOR_ANCHORS = { left: 0.88, player: 0.895, right: 0.93 };

const CEIL = solveCubicRail(CEILING_ANCHORS.left, CEILING_ANCHORS.player, CEILING_ANCHORS.right, -0.02);
const FLOOR = solveCubicRail(FLOOR_ANCHORS.left, FLOOR_ANCHORS.player, FLOOR_ANCHORS.right, 0.02);

export function barrelCrestY(x) {
  return evalRail(CEIL, x);
}

export function barrelTroughY(x) {
  return evalRail(FLOOR, x);
}

export const barrelRail = { crestY: barrelCrestY, troughY: barrelTroughY, name: 'barrel' };
