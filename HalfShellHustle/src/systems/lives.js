// Lives + post-hit invulnerability -- direct feedback: an obstacle should
// cost ONE life rather than ending the run outright.
//
// Ported near-verbatim from TmntSewerSlide/src/systems/lives.js (which in
// turn credits Astro_Tunnel's handleHit). Four sibling games in this repo
// converged on this exact model -- 3 lives, a ~1.2s grace window, an
// absolute `invulnerableUntil` deadline -- so this reuses it rather than
// inventing a fifth variant. The {hit, dead} return is the useful part: it
// collapses "absorbed by the grace window", "took damage" and "died" into
// one call, so each collision site stays a few lines.
//
// THE GRACE WINDOW IS LOAD-BEARING, NOT POLISH. A barricade's collision
// window is 2 * OBSTACLE_COLLISION_HALF_Z / speed -- ~0.30s at the run's
// starting speed, i.e. ~18 frames at 60fps. Without invulnerability a single
// barricade would drain all three lives in one pass.
//
// It's also speed-ramp-proof by construction: the window covers 1.2 * v
// world units while the minimum obstacle spacing is 1.6 * v, and BOTH scale
// with v, so the ratio is 0.75 at any point on the ramp (worst case 0.85 for
// an entity spawned at t=0 and arriving much later at a higher speed). An
// i-frame can therefore never grant a free pass on the following obstacle,
// at any speed.

import { LIVES_START, LIVES_SOFTCAP, HIT_INVULNERABILITY_SEC } from '../data/constants.js';

export function createLivesState() {
  return { lives: LIVES_START, invulnerableUntil: 0 };
}

export function resetLivesState(state) {
  state.lives = LIVES_START;
  state.invulnerableUntil = 0;
}

// `nowSeconds` is the RUN's own elapsed clock (core/main.js's gameTime), not
// wall time -- so the grace window freezes correctly while paused instead of
// silently expiring behind a pause screen.
//
// Returns { hit, dead }: `hit: false` means the grace window absorbed this
// one entirely (no life lost, no feedback should fire).
export function tryHit(state, nowSeconds) {
  if (nowSeconds < state.invulnerableUntil) return { hit: false, dead: false };
  state.invulnerableUntil = nowSeconds + HIT_INVULNERABILITY_SEC;
  state.lives -= 1;
  return { hit: true, dead: state.lives <= 0 };
}

export function isInvulnerable(state, nowSeconds) {
  return nowSeconds < state.invulnerableUntil;
}

// Scaffolding for a future health pickup (deliberately not wired to anything
// yet -- no pickup entity exists). Clamped to LIVES_SOFTCAP rather than to
// LIVES_MAX_SUPPORTED: pickups top you back up to the normal cap, they don't
// push past it. Raising the cap is a separate (future) upgrade concern.
// Returns whether it actually granted anything, so a caller can skip the
// pickup's reward VFX when the player was already full.
export function gainLife(state) {
  if (state.lives >= LIVES_SOFTCAP) return false;
  state.lives += 1;
  return true;
}
