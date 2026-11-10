// The spawn director (§5.3, §5.5, §5.10).
//
// It picks WHAT to spawn and WHEN, and it is the last line of defence on the
// pacing contract. The group templates are already proven safe statically by
// /systems/constraints.js; what this module adds is the LIVE checks the static
// pass cannot make: how many bodies are already on screen, how many distinct
// bands they occupy, whether a puffer is already out, whether the minimum
// world-x gap between consecutive groups has elapsed, and whether a coin arc
// would be routed too close to a hazard already in flight.
//
// "Trade hazard COUNT for hazard SIZE: dense-looking but individually
// trackable. If a pattern needs more bodies to feel dangerous, it is the wrong
// pattern." (§5.3)

import {
  CAP_HAZARDS_ON_SCREEN, CAP_DISTINCT_BANDS, CAP_PICKUP_STRINGS,
  MIN_GROUP_GAP_SEC, H_GAP_MIN, H_TRIM, H_LAUNCH,
} from '../data/tuning.js';
import { HAZARD_GROUPS, PUFFER_GROUPS } from '../data/hazardGroups.js';
import { COIN_ARCS, arcSpan } from '../data/coinArcs.js';
import { HAZARDS } from '../data/tuning.js';

const HAZARD_BANDS = Object.fromEntries(
  Object.entries(HAZARDS).map(([k, v]) => [k, v.band])
);

// Orbs sit at deliberately awkward heights more often than coins do (§5.6).
const ORB_HEIGHTS = [0.86, 0.80, 0.10, 0.16, 0.72, 0.24, 0.62, 0.34];

export class SpawnDirector {
  constructor() {
    this.reset();
  }

  reset() {
    this.groupTimer = 0;
    this.coinTimer = 2.2;   // the first arc arrives shortly after the drop-in
    this.orbTimer = 6.0;
    this.pufferTimer = 0;
    this.seabirdTimer = 12;
    this.lastGroupTime = -Infinity;
    this.elapsed = 0;
    this._orbIndex = 0;
    this._lastGroupId = '';
  }

  /**
   * One fixed step. Mutates the pools directly and returns a small event bag
   * so the caller can trigger audio/VFX without this module knowing about them.
   */
  update(dt, ctx) {
    const { ramp, wave, hazards, pickups, seabird, paused } = ctx;
    if (paused) return;

    this.elapsed += dt;
    this.groupTimer -= dt;
    this.coinTimer -= dt;
    this.orbTimer -= dt;
    this.seabirdTimer -= dt;
    if (ramp.pufferAllowed) this.pufferTimer -= dt;

    const speed = ramp.scrollSpeed;

    // -- hazard groups -----------------------------------------------------
    if (this.groupTimer <= 0) {
      const sinceLast = this.elapsed - this.lastGroupTime;
      if (sinceLast >= MIN_GROUP_GAP_SEC) {
        const template = this._pickGroup(ramp, hazards, pickups, wave, speed);
        if (template) {
          hazards.spawnGroup(template, wave, speed);
          this.lastGroupTime = this.elapsed;
          this._lastGroupId = template.id;
          this.groupTimer = ramp.groupInterval;
        } else {
          // Nothing safe to spawn right now; try again shortly rather than
          // forcing a group through the caps.
          this.groupTimer = 0.25;
        }
      } else {
        this.groupTimer = MIN_GROUP_GAP_SEC - sinceLast;
      }
    }

    // -- the urchin-puffer, on its own schedule, never in a group ----------
    if (ramp.pufferAllowed && this.pufferTimer <= 0 && !hazards.hasPuffer()) {
      if (hazards.liveCount + 1 <= CAP_HAZARDS_ON_SCREEN) {
        // The puffer obeys the same tier gate as every other group. Before
        // STAND_STILL_SEC only the base-tier variants are eligible, which is
        // what keeps "hold trim, never lean, survive 45 s" true once the
        // set-piece starts appearing at t = 25 s.
        const pool = PUFFER_GROUPS.filter((g) => ramp.tier === 'open' || g.tier === 'base');
        if (pool.length) hazards.spawnGroup(pool[(Math.random() * pool.length) | 0], wave, speed);
      }
      this.pufferTimer = ramp.pufferInterval;
    }

    // -- coin arcs ---------------------------------------------------------
    if (this.coinTimer <= 0) {
      if (pickups.stringCount < CAP_PICKUP_STRINGS) {
        const arc = this._pickCoinArc(hazards, wave);
        if (arc) pickups.spawnCoinArc(arc, wave, speed);
      }
      this.coinTimer = ramp.coinInterval;
    }

    // -- multiplier orbs ---------------------------------------------------
    if (this.orbTimer <= 0) {
      let placed = false;
      if (pickups.stringCount < CAP_PICKUP_STRINGS) {
        // Try several of the authored awkward heights, not just the next one.
        // With only one attempt, a blocked slot cost a FULL orb interval, which
        // pushed the effective orb rate past SLOT_HOLD and made the barrel
        // essentially unreachable -- tools/sim-harness.js counted zero barrels
        // in ten minutes of play. The barrel is the ceiling of the whole design
        // (§5.7); it has to be reachable by a player who takes the orbs.
        for (let i = 0; i < ORB_HEIGHTS.length && !placed; i++) {
          const h = ORB_HEIGHTS[this._orbIndex++ % ORB_HEIGHTS.length];
          if (this._heightIsClear(h, 0.06, hazards, wave)) {
            pickups.spawnOrb(wave, h);
            placed = true;
          }
        }
      }
      // A blocked attempt retries shortly rather than burning the interval.
      this.orbTimer = placed ? ramp.orbInterval : 0.4;
    }

    // -- the seabird (scenery on the face, a target in the air) ------------
    if (this.seabirdTimer <= 0) {
      if (!seabird.active) seabird.spawn(wave);
      this.seabirdTimer = ctx.seabirdInterval;
    }
  }

  _pickGroup(ramp, hazards, pickups, wave, speed) {
    const tier = ramp.tier;
    const maxSize = ramp.groupSize;
    const bandsUsed = hazards.distinctBands(wave);
    const room = CAP_HAZARDS_ON_SCREEN - hazards.liveCount;

    let pool = HAZARD_GROUPS.filter((g) => {
      if (g.size > maxSize) return false;
      if (g.size > room) return false;
      if (bandsUsed + g.size > CAP_DISTINCT_BANDS + 1) return false;
      if (tier === 'base' && g.tier !== 'base') return false;
      // The on-ramp is jellyfish only, one at a time (§5.10).
      if (ramp.inOnRamp && (g.size !== 1 || g.bodies[0].type !== 'jellyfish' || g.onRamp === false)) return false;
      // ...and it must not be about to land on top of a coin arc that is
      // already in flight. The static validator cannot see this: it is the
      // INTERACTION of two independently-safe spawns, and it is exactly how
      // "choose between a coin and a wipeout" would sneak back in (§5.5).
      if (!this._groupClearsPickups(g, pickups, wave, speed)) return false;
      return true;
    });

    // Don't repeat the same template back to back if there is any alternative.
    if (pool.length > 1) {
      const varied = pool.filter((g) => g.id !== this._lastGroupId);
      if (varied.length) pool = varied;
    }

    if (!pool.length) return null;
    return pool[(Math.random() * pool.length) | 0];
  }

  /**
   * §5.5's routing rule: arcs are deliberately routed PAST hazards -- over a
   * rock, under a drift timber -- so "where should I be" is a risk question.
   * But the arc's route must always leave H_GAP_MIN clearance from every hazard
   * it passes: the player should be able to take the whole arc cleanly with
   * good control, never be forced to choose between a coin and a wipeout.
   */
  _pickCoinArc(hazards, wave) {
    const candidates = shuffled(COIN_ARCS);
    for (const arc of candidates) {
      const { lo, hi } = arcSpan(arc);
      if (hi >= H_LAUNCH) continue;
      if (this._extentIsClear(lo, hi, hazards, wave)) return arc;
    }
    return null;
  }

  /**
   * True if none of the template's bodies would come within H_GAP_MIN of a
   * pickup that is still near the spawn edge -- i.e. one whose world-x window
   * this group would share.
   */
  _groupClearsPickups(template, pickups, wave, speed) {
    for (const p of pickups.live) {
      const x = wave.screenX(p.worldX);
      if (x < 0.55) continue; // already well inside the frame; no overlap
      for (const b of template.bodies) {
        const half = 0.5 * (HAZARD_BANDS[b.type] || 0.08);
        const drifted = b.h + (b.drift || 0) * (template.bodies.length ? 1.5 : 0);
        const lo = Math.min(b.h, drifted) - half - H_GAP_MIN;
        const hi = Math.max(b.h, drifted) + half + H_GAP_MIN;
        if (p.h > lo && p.h < hi) {
          // Only a conflict if their world-x windows actually overlap.
          const bodyX = wave.spawnWorldX + (b.dxSec || 0) * speed;
          if (Math.abs(bodyX - p.worldX) < 1.2 * speed) return false;
        }
      }
    }
    return true;
  }

  _extentIsClear(lo, hi, hazards, wave) {
    for (const e of hazards.live) {
      // Only hazards still to the right of the player column can share a
      // world-x window with an arc spawning now.
      if (wave.screenX(e.worldX) < 0.25) continue;
      const eLo = e.hMin - H_GAP_MIN;
      const eHi = e.hMax + H_GAP_MIN;
      if (hi > eLo && lo < eHi) return false;
    }
    return true;
  }

  _heightIsClear(h, band, hazards, wave) {
    return this._extentIsClear(h - band / 2, h + band / 2, hazards, wave);
  }
}

function shuffled(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export { H_TRIM };
