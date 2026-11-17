// WHICH WALK CLIP, AND HOW FAST ITS FEET GO.
//
// Four clips -- forward, back, left, right -- blended by where the player is
// travelling RELATIVE TO WHERE THE BODY IS POINTING. See core/facing.js for
// why those are two different angles.
//
// THE FEET DO NOT SLIDE, and that is measured rather than tuned. Each clip
// carries how far its root actually travelled in one cycle (tools/extract-
// clips.mjs writes `strideFemurs`, in femurs, because a bone's rest length is
// the one unit the FBX and the glb agree on). Dividing the player's real
// speed by the stride gives the cycles per second at which the feet land where
// the ground is going. The alternative -- picking a playback rate that looks
// about right -- is how a walk ends up looking like it is on ice, and it
// cannot survive anyone changing the walk speed afterwards.

/** Local heading: 0 is straight ahead, +PI/2 is the character's own right. */
export function localHeading(moveAngle, faceAngle) {
  const t = (moveAngle - faceAngle + Math.PI) % (Math.PI * 2);
  return (t < 0 ? t + Math.PI * 2 : t) - Math.PI;
}

/**
 * How much of each of the four clips, for a local heading.
 *
 * Normalised by |cos| + |sin| rather than by the vector length, so a diagonal
 * is an even half-and-half of two clips instead of 0.707 of each adding up to
 * 1.41 times the motion. The weights always sum to exactly 1, which is what
 * keeps the blended pose from drifting toward the bind pose.
 */
export function blendWeights(localAngle) {
  const c = Math.cos(localAngle);
  const s = Math.sin(localAngle);
  const f = Math.max(0, c), b = Math.max(0, -c);
  const r = Math.max(0, s), l = Math.max(0, -s);
  const sum = f + b + r + l;
  if (sum <= 1e-9) return { f: 1, b: 0, l: 0, r: 0 };
  return { f: f / sum, b: b / sum, l: l / sum, r: r / sum };
}

/** The stride this blend covers in one cycle, in whatever units the parts are in. */
export function blendedStride(w, stride) {
  return w.f * stride.f + w.b * stride.b + w.l * stride.l + w.r * stride.r;
}

/**
 * Cycles per second so that one stride carries the body exactly as far as it
 * is actually moving. Zero stride (an in-place clip) would divide by nothing,
 * so it is clamped rather than allowed to produce Infinity.
 */
export function cadenceHz(speedUnitsS, strideUnits) {
  if (!(strideUnits > 1e-4)) return 0;
  return speedUnitsS / strideUnits;
}
