// Lives + post-hit invulnerability -- direct feedback: an obstacle should
// cost ONE life rather than ending the run outright.
//
// Ported near-verbatim from TmntSewerSlide/src/systems/lives.js (which in
// turn credits Astro_Tunnel's handleHit). Four sibling games in this repo
// converged on this exact model -- a ~1.2s grace window and an absolute
// `invulnerableUntil` deadline -- so this reuses it rather than inventing a
// fifth variant. (The life COUNT has since diverged: this game starts at 5,
// direct feedback, where the siblings start at 3.) The {hit, dead} return is
// the useful part: it collapses "absorbed by the grace window", "took damage"
// and "died" into one call, so each collision site stays a few lines.
//
// THE GRACE WINDOW IS LOAD-BEARING, NOT POLISH. A barricade's collision
// window is 2 * OBSTACLE_COLLISION_HALF_Z / speed -- ~0.30s at the run's
// starting speed, i.e. ~18 frames at 60fps. Without invulnerability a single
// barricade would drain every life in one pass.
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

// Health pickup (entities/pickups.js's 'life' type, dispatched in
// core/main.js). No longer scaffolding -- there's a real heart in the world now.
// Clamped to LIVES_SOFTCAP: a pickup tops you back up to the normal cap, it
// never pushes past it. Returns whether it actually granted anything, so the
// caller can skip the reward feedback when the player was already full -- though
// in practice that path is nearly dead, since core/main.js won't even spawn a
// heart unless a life is missing.
export function gainLife(state) {
  if (state.lives >= LIVES_SOFTCAP) return false;
  state.lives += 1;
  return true;
}
