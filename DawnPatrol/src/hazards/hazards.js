// The four hazard types and the one trick target (§6.2).
//
// Every hazard is (worldX, h) and renders through wave.faceY -- nothing here
// carries a screen y of its own (§6). Collision is a 1D band overlap plus an x
// proximity test and nothing else: no spatial partitioning, no physics engine,
// no AABB library (§9.1).
//
// All four hazards are LETHAL ON CONTACT. One contact model, no damage tiers,
// no slowing hazards -- a single uniform rule is the legible choice and it
// keeps the fail state readable (§6.2).
//
// The seabird is NOT a hazard. It is scenery on the face and a TARGET in the
// air, and it is the only thing in this game that can be "hit" for a reward.

import {
  HAZARDS, PUFFER_TELEGRAPH_X, PUFFER_CLOSE_MULT, PLAYER_X,
  SEABIRD_H_RANGE, SEABIRD_HIT_X, SEABIRD_HIT_Y, DESIGN_W, DESIGN_H,
} from '../data/tuning.js';
import { pufferTelegraphFor } from '../systems/constraints.js';

export const HazardState = {
  RIDING: 'riding',       // rides the scroll passively
  TELEGRAPH: 'telegraph', // puffer holding station with the ! bubble
  CLOSING: 'closing',     // puffer closing on the player column
};

class Hazard {
  constructor() {
    this.active = false;
    this.reset();
  }

  reset() {
    this.type = 'jellyfish';
    this.worldX = 0;
    this.h = 0.5;
    this.drift = 0;
    this.band = 0.08;
    this.xHalf = 46;
    this.state = HazardState.RIDING;
    this.t = 0;
    this.telegraphDuration = 0;
    this.groupId = '';
    this.alpha = 1;
    this.bob = Math.random() * Math.PI * 2;
  }

  get hMin() { return this.h - this.band / 2; }
  get hMax() { return this.h + this.band / 2; }
}

export class HazardPool {
  constructor(size = 32) {
    this.items = [];
    for (let i = 0; i < size; i++) this.items.push(new Hazard());
    this.live = [];
  }

  clear() {
    for (const h of this.items) h.active = false;
    this.live.length = 0;
  }

  _take() {
    for (const h of this.items) {
      if (!h.active) return h;
    }
    // Pool exhausted -- grow rather than allocate per-spawn in the hot loop.
    const h = new Hazard();
    this.items.push(h);
    return h;
  }

  /**
   * Spawn one group template. `bodies` trail the head by their dxSec, which is
   * converted into world px at the CURRENT scroll speed so the shape the
   * template describes is the shape the player sees.
   */
  spawnGroup(template, wave, scrollSpeed) {
    const headX = wave.spawnWorldX;
    for (const body of template.bodies) {
      const spec = HAZARDS[body.type];
      const e = this._take();
      e.reset();
      e.active = true;
      e.type = body.type;
      e.groupId = template.id;
      e.worldX = headX + (body.dxSec || 0) * scrollSpeed;
      e.h = body.h;
      e.drift = body.drift || 0;
      e.band = spec.band;
      e.xHalf = spec.xHalf;
      if (body.type === 'puffer') {
        e.state = HazardState.RIDING;
        e.telegraphDuration = pufferTelegraphFor(scrollSpeed);
      }
      this.live.push(e);
    }
  }

  /** One fixed step over every live hazard. */
  update(dt, wave, scrollSpeed) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const e = this.live[i];
      e.t += dt;
      e.bob += dt;

      if (e.type === 'puffer') {
        this._updatePuffer(e, dt, wave, scrollSpeed);
      } else if (e.drift) {
        e.h = clamp01(e.h + e.drift * dt);
      }

      if (wave.isDespawned(e.worldX)) {
        e.active = false;
        this.live.splice(i, 1);
      }
    }
  }

  /**
   * The telegraphed set-piece (§6.2). It rides in, HOLDS STATION at x = 0.92
   * with a red `!` alert bubble, then closes at 1.35x the scroll while drifting
   * in h. Nothing in this game closes on the player without a telegraph.
   */
  _updatePuffer(e, dt, wave, scrollSpeed) {
    const x = wave.screenX(e.worldX);
    switch (e.state) {
      case HazardState.RIDING:
        if (x <= PUFFER_TELEGRAPH_X) {
          e.state = HazardState.TELEGRAPH;
          e.t = 0;
        }
        break;
      case HazardState.TELEGRAPH:
        // Hold station in SCREEN space: advance its world x with the scroll.
        e.worldX += scrollSpeed * dt;
        if (e.t >= e.telegraphDuration) {
          e.state = HazardState.CLOSING;
          e.t = 0;
        }
        break;
      case HazardState.CLOSING:
        // Closes at PUFFER_CLOSE_MULT x the scroll in screen space, i.e. it
        // loses (mult - 1) x scroll of world x per second.
        e.worldX -= (PUFFER_CLOSE_MULT - 1) * scrollSpeed * dt;
        e.h = clamp01(e.h + e.drift * dt);
        break;
      default:
        break;
    }
  }

  get liveCount() { return this.live.length; }

  hasPuffer() {
    for (const e of this.live) if (e.type === 'puffer') return true;
    return false;
  }

  /** Distinct occupied h bands among hazards currently on screen. */
  distinctBands(wave) {
    const centres = [];
    for (const e of this.live) {
      const x = wave.screenX(e.worldX);
      if (x < 0 || x > 1) continue;
      if (!centres.some((c) => Math.abs(c - e.h) < 0.04)) centres.push(e.h);
    }
    return centres.length;
  }
}

/**
 * THE collision test (§9.1). 1D in h, plus an x proximity window.
 * Written exactly as the doc states it, once, here.
 */
export function hits(entity, playerWorldX, playerH, playerHHalf, playerXHalf) {
  if (Math.abs(entity.worldX - playerWorldX) >= entity.xHalf + playerXHalf) return false;
  return playerH >= entity.hMin - playerHHalf && playerH <= entity.hMax + playerHHalf;
}

// ---------------------------------------------------------------------------
// The seabird -- a trick target, not a hazard (§6.2)
// ---------------------------------------------------------------------------

export class Seabird {
  constructor() {
    this.active = false;
    this.worldX = 0;
    this.h = 1.05;
    this.h0 = 1.05;
    this.amp = 0.03;
    this.phase = 0;
    this.hit = false;
    this.hitT = 0;
  }

  spawn(wave) {
    this.active = true;
    this.hit = false;
    this.hitT = 0;
    this.worldX = wave.spawnWorldX;
    // Clamped to SEABIRD_H_RANGE, whose upper bound is set so the bird's whole
    // traversal stays clear of the TOP RUN exclusion rect (§5.1). Only at
    // heights the airborne arc can actually reach.
    const lo = SEABIRD_H_RANGE[0], hi = SEABIRD_H_RANGE[1];
    this.h0 = lo + Math.random() * (hi - lo);
    this.amp = 0.015 + Math.random() * 0.015;
    this.phase = Math.random() * Math.PI * 2;
    this.h = this.h0;
  }

  update(dt, wave) {
    if (!this.active) return;
    this.phase += dt * 0.9;
    if (this.hit) {
      // Tumbles out of frame.
      this.hitT += dt;
      this.h = Math.max(-0.4, this.h - 1.6 * dt);
      if (this.hitT > 1.6) this.active = false;
      return;
    }
    // A shallow arc across the sky band, never above the range cap.
    this.h = Math.min(SEABIRD_H_RANGE[1], this.h0 + Math.sin(this.phase) * this.amp);
    if (wave.isDespawned(this.worldX)) this.active = false;
  }

  /**
   * The one sky-band collision in the game, and only while the player is
   * airborne. Resolved in screen space via wave.faceY, so /wave remains the
   * only geometry authority (§9.4).
   */
  intersectsAirborne(wave, playerScreenX, playerScreenY) {
    if (!this.active || this.hit) return false;
    const bx = wave.screenX(this.worldX);
    const by = wave.faceY(bx, this.h);
    const dx = Math.abs(bx - playerScreenX) * DESIGN_W;
    const dy = Math.abs(by - playerScreenY) * DESIGN_H;
    return dx < SEABIRD_HIT_X && dy < SEABIRD_HIT_Y;
  }
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
