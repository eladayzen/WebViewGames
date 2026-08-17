// The interceptor (§6.1) -- movement, roll state, auto-fire, damage/i-frames.
//
// Nose-north, roll-only, auto-firing. Three hard rules from §0.2/§4 live here:
//   1. Roll is PRESENTATIONAL. It changes the sprite and nothing else -- not
//      the hitbox, not the heading, not the gun direction.
//   2. The guns always fire straight up. There is no aim.
//   3. There is no fire input, no bomb input, and no input that changes rate.

import {
  PLAYER,
  INPUT,
  PLAYER_CLAMP_X,
  PLAYER_CLAMP_Y,
  BANDS,
  DESIGN_W,
  DESIGN_H,
  FX,
} from '../data/tuning.js';
import { alloc } from '../core/state.js';

export function updatePlayer(w, input, dt, fx) {
  const p = w.player;

  // --- movement (§4) ------------------------------------------------------
  p.vx = input.carve * INPUT.lateralMax;
  p.vy = input.nudge * INPUT.verticalMax;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  const minX = PLAYER_CLAMP_X.min * DESIGN_W;
  const maxX = PLAYER_CLAMP_X.max * DESIGN_W;
  if (p.x < minX) {
    p.x = minX;
    p.vx = 0;
  }
  if (p.x > maxX) {
    p.x = maxX;
    p.vx = 0;
  }

  // Clamped to PLAYER_CLAMP_Y, not to the raw band. The band is the design's
  // statement about where the player LIVES; the clamp additionally keeps the
  // hull on screen, exactly as PLAYER_CLAMP_X keeps it out from under the HUD
  // gauges. See PLAYER_CLAMP_Y in tuning.js for why this changes no pacing
  // number.
  const minY = PLAYER_CLAMP_Y.min * DESIGN_H;
  const maxY = PLAYER_CLAMP_Y.max * DESIGN_H;
  if (p.y < minY) {
    p.y = minY;
    p.vy = 0;
  }
  if (p.y > maxY) {
    p.y = maxY;
    p.vy = 0;
  }

  // --- roll state, with hysteresis (§6.1) ---------------------------------
  // Without hysteresis the sprite strobes whenever the player parks the lean
  // right on the threshold, which on a board is most of the time.
  const c = input.carve;
  const a = Math.abs(c);
  if (p.roll === 0) {
    if (a > INPUT.rollOn) p.roll = Math.sign(c);
  } else if (a < INPUT.rollOff || Math.sign(c) !== p.roll) {
    p.roll = a > INPUT.rollOn ? Math.sign(c) : 0;
  }

  // --- timers -------------------------------------------------------------
  if (p.invulnT > 0) p.invulnT = Math.max(0, p.invulnT - dt);
  if (p.hitFlashT > 0) p.hitFlashT = Math.max(0, p.hitFlashT - dt);

  // --- auto-fire (§4) -----------------------------------------------------
  // Unconditional. No cooldown the player can affect, no input that changes
  // it. POC pins rank at 1 -> single bolt (§8.1).
  p.fireT -= dt;
  while (p.fireT <= 0) {
    p.fireT += PLAYER.fire.rank1IntervalS;
    fireBolt(w, p);
  }
}

function fireBolt(w, p) {
  const b = alloc(w.playerBolts);
  if (!b) return;
  b.alive = true;
  b.x = p.x;
  b.y = p.y + PLAYER.fire.muzzleOffsetY;
  // Straight up, always. There is no aim in this game (§0.2).
  b.vy = -PLAYER.fire.boltSpeed;
  b.r = PLAYER.fire.boltRadius;
  w.stats.shotsFired++;
}

export function updatePlayerBolts(w, dt) {
  const pool = w.playerBolts;
  for (let i = 0; i < pool.length; i++) {
    const b = pool[i];
    if (!b.alive) continue;
    b.y += b.vy * dt;
    // Retire above the HUD strip -- a bolt must never be drawn into the boss
    // bar's band (§5.1).
    if (b.y < BANDS.hudStrip.bottom * DESIGN_H - 40) b.alive = false;
  }
}

/**
 * Apply damage. Attrition, not lives (§5.10): a hit costs a segment and the
 * score chain, nothing else. Rank is NEVER lost to damage -- that compounds
 * failure and punishes the player exactly when they are already losing, and
 * is deliberately not in this design.
 *
 * Returns true if the hit actually landed (i.e. was not absorbed by i-frames).
 */
export function damagePlayer(w, segments, fx) {
  const p = w.player;
  if (p.invulnT > 0 || !p.alive) return false;

  p.shield -= segments;
  p.invulnT = PLAYER.invulnS;
  p.hitFlashT = 0.35;
  w.stats.damageTaken += segments;
  w.director.hitsThisWave++;

  w.fx.shakeT = FX.screenShake.hitDurationS;
  w.fx.shakeMag = FX.screenShake.hitMagnitude;
  w.fx.flashT = 0.12;

  if (p.shield <= 0) {
    p.shield = 0;
    p.alive = false;
  }
  return true;
}
