// Theta-tolerance-window collision (§5.5): same *shape* of check
// Astro_Tunnel's ring-gap system already uses (angle-normalized compare
// against a valid/invalid range) -- reused here as a proven collision
// technique, not copied game logic.

// Shortest signed angular difference, normalized to (-PI, PI], so a compare
// near the wrap point (e.g. theta close to -PI vs PI) never reads as a huge
// false distance. Our clamped arcs never actually reach the wrap seam, but
// this keeps the helper correct regardless.
export function angularDelta(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function isWithinTolerance(playerTheta, targetTheta, tolerance) {
  return Math.abs(angularDelta(playerTheta, targetTheta)) < tolerance;
}
