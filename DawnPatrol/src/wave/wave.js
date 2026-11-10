// THE ONLY PLACE IN THE CODEBASE THAT KNOWS GEOMETRY (§9.3, §9.4).
//
// Nothing else -- not a hazard, not a pickup, not a particle, not a HUD
// element -- may compute its own y from the wave shape. If you find yourself
// wanting crestY() somewhere else, the answer is a function here.
//
// The wave silhouette is STATIC IN SCREEN SPACE (§5.2). What scrolls is the
// texture UV offset, the foam, the props, the parallax layers and the entities'
// world positions. The rail itself never moves and must never be animated.

import {
  DESIGN_W, DESIGN_H, PLAYER_X, SPAWN_X, DESPAWN_X, REACTION_SPAN_PX,
} from '../data/tuning.js';
import { faceRail } from '../data/faceRail.js';
import { barrelRail } from '../data/barrelRail.js';

/**
 * Scroll + rail bookkeeping. One instance per run, owned by the game state.
 */
export class Wave {
  constructor() {
    // Accumulated scrolled world pixels. This IS the player's world x, which
    // is what makes the fixed player column fall out for free (§5.2).
    this.scrolled = 0;
    this.speed = 0;

    // Rail blending. `railA` is what we are on, `railB` what we are heading
    // into, `railMix` in [0,1]. Outside a barrel transition railMix is 0 and
    // railB is ignored -- so the common case is a plain rail read.
    this.railA = faceRail;
    this.railB = barrelRail;
    this.railMix = 0;
  }

  reset() {
    this.scrolled = 0;
    this.speed = 0;
    this.railA = faceRail;
    this.railB = barrelRail;
    this.railMix = 0;
  }

  /** Advance the world by dt at the current scroll speed. */
  advance(dt, speed) {
    this.speed = speed;
    this.scrolled += speed * dt;
  }

  // -- rail selection ------------------------------------------------------

  /** Begin blending toward the barrel interior (or back out to the face). */
  setRailTarget(which) {
    const target = which === 'barrel' ? barrelRail : faceRail;
    if (this.railB === target) return;
    // Freeze whatever we currently look like as the new "from" rail so a
    // transition interrupted midway does not snap.
    const a = this.railA, b = this.railB, mix = this.railMix;
    if (mix > 0 && mix < 1) {
      const frozenCrest = (x) => a.crestY(x) * (1 - mix) + b.crestY(x) * mix;
      const frozenTrough = (x) => a.troughY(x) * (1 - mix) + b.troughY(x) * mix;
      this.railA = { crestY: frozenCrest, troughY: frozenTrough, name: 'blend' };
    } else if (mix >= 1) {
      this.railA = b;
    }
    this.railB = target;
    this.railMix = 0;
  }

  /** Drive the blend. `k` in [0,1]. */
  setRailMix(k) {
    this.railMix = Math.min(1, Math.max(0, k));
    if (this.railMix >= 1) {
      this.railA = this.railB;
      this.railMix = 0;
    }
  }

  crestY(x) {
    if (this.railMix <= 0) return this.railA.crestY(x);
    return this.railA.crestY(x) * (1 - this.railMix) + this.railB.crestY(x) * this.railMix;
  }

  troughY(x) {
    if (this.railMix <= 0) return this.railA.troughY(x);
    return this.railA.troughY(x) * (1 - this.railMix) + this.railB.troughY(x) * this.railMix;
  }

  /**
   * THE function. Normalized screen y for a point at normalized screen x and
   * face height h. h = 0 is the trough, h = 1 is the crest/lip.
   */
  faceY(x, h) {
    const t = this.troughY(x);
    const c = this.crestY(x);
    return t + (c - t) * h;
  }

  /** Design-space pixel y, for the render layer. */
  faceYpx(x, h) {
    return this.faceY(x, h) * DESIGN_H;
  }

  // -- world <-> screen ----------------------------------------------------

  /** Normalized screen x of a world-x (design px). */
  screenX(worldX) {
    return PLAYER_X + (worldX - this.scrolled) / DESIGN_W;
  }

  /** Design-space pixel x of a world-x. */
  screenXpx(worldX) {
    return this.screenX(worldX) * DESIGN_W;
  }

  /** The world x an entity spawning at the right spawn edge should be given. */
  get spawnWorldX() {
    return this.scrolled + REACTION_SPAN_PX;
  }

  /** True once an entity has scrolled off the left edge (§5.1). */
  isDespawned(worldX) {
    return this.screenX(worldX) < DESPAWN_X;
  }

  /** Distance in design px from the player column to a world x (signed). */
  dxToPlayer(worldX) {
    return worldX - this.scrolled;
  }
}

export { SPAWN_X, DESPAWN_X };
