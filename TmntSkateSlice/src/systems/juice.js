// Cheap canvas-level "juice" (§1: "punchy juicy hit-feedback -- impact
// stars, swing whoosh, screen-shake on bomb hits -- over anything
// mechanically deep"). Plain primitives, no particle-system library, per
// the technical architecture note in §9.1.

import { SCORE_POPUP_TTL_SEC } from '../data/constants.js';

const GRAVITY_FRAC_PER_SEC2 = 1.6;
const FLOATER_RISE_FRAC_PER_SEC = 0.11; // how fast a "+N" popup drifts upward

export function createJuice() {
  return {
    particles: [], // { xFrac, yFrac, vxFrac, vyFrac, life, maxLife, color, shape, sizeFrac, rotationRad, rotationSpeedRadPerSec, glow }
    rings: [], // { xFrac, yFrac, life, maxLife, maxRadiusFrac, color } -- bomb shockwave only
    floaters: [], // { xFrac, yFrac, text, color, life, maxLife } -- retro "+N" score popups
    shakeTimer: 0,
    shakeMaxTimer: 0,
    shakeMagnitudeFrac: 0,
  };
}

export function resetJuice(juice) {
  juice.particles = [];
  juice.rings = [];
  juice.floaters = [];
  juice.shakeTimer = 0;
  juice.shakeMaxTimer = 0;
  juice.shakeMagnitudeFrac = 0;
}

// Retro floating score popup ("+10", "+25", ...) at a world position -- rises
// and fades over SCORE_POPUP_TTL_SEC (drawn as canvas text in render.js).
export function spawnScorePopup(juice, xFrac, yFrac, text, color = '#ffe066') {
  juice.floaters.push({
    xFrac,
    yFrac,
    text,
    color,
    life: SCORE_POPUP_TTL_SEC,
    maxLife: SCORE_POPUP_TTL_SEC,
  });
}

// Shared radial-burst-plus-gravity emitter -- pizza/ooze/bomb effects are
// all this same physics, tuned per material (count/speed/shape/palette)
// rather than three separate simulations.
function emitBurst(juice, xFrac, yFrac, opts) {
  const {
    count,
    colors,
    speedMin,
    speedMax,
    life,
    shape = 'circle',
    sizeMin = 0.01,
    sizeMax = 0.016,
    upBias = 0.15,
    glow = false,
  } = opts;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    juice.particles.push({
      xFrac,
      yFrac,
      vxFrac: Math.cos(angle) * speed,
      vyFrac: Math.sin(angle) * speed - upBias,
      life,
      maxLife: life,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape,
      sizeFrac: sizeMin + Math.random() * (sizeMax - sizeMin),
      rotationRad: Math.random() * Math.PI * 2,
      rotationSpeedRadPerSec: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3),
      glow,
    });
  }
}

// Pizza shattering into crust/sauce wedge fragments on a good catch.
// Colors per STYLE.md's reward palette (warm gold/red -- never reused for
// hazard feedback).
export function spawnPizzaBreak(juice, xFrac, yFrac) {
  emitBurst(juice, xFrac, yFrac, {
    count: 9,
    colors: ['#E8A23C', '#C4432A', '#E8A23C'],
    speedMin: 0.2,
    speedMax: 0.4,
    life: 0.5,
    shape: 'shard',
    sizeMin: 0.012,
    sizeMax: 0.02,
    upBias: 0.15,
  });
}

// Ooze canister splashing into glowing droplets on a power-up catch.
// Colors per STYLE.md's power-up palette (glowing green -- ooze only).
export function spawnOozeSplash(juice, xFrac, yFrac) {
  emitBurst(juice, xFrac, yFrac, {
    count: 16,
    colors: ['#1FC8D8', '#6FE8F0'],
    speedMin: 0.15,
    speedMax: 0.32,
    life: 0.5,
    shape: 'blob',
    sizeMin: 0.006,
    sizeMax: 0.011,
    upBias: 0.22,
    glow: true,
  });
}

// Bomb detonation -- hazard-only palette per STYLE.md (near-black body,
// amber hazard stripe, fuse-spark orange; must never read warm/friendly),
// plus an expanding shockwave ring for extra impact on top of the existing
// screen-shake (see triggerHit call site in core/main.js).
export function spawnBombExplosion(juice, xFrac, yFrac) {
  // Bigger, punchier than the original (feedback 2026-07-30), and glow:false
  // so the wave pickup can detonate several bombs at once without stacking
  // shadowBlur (the known in-WebView perf risk). Size/spread/rings carry the
  // "stronger" read instead of glow.
  emitBurst(juice, xFrac, yFrac, {
    count: 24,
    colors: ['#1B1B1F', '#F2C230', '#FF7A2E', '#FFD26A'],
    speedMin: 0.4,
    speedMax: 0.8,
    life: 0.55,
    shape: 'spark',
    sizeMin: 0.013,
    sizeMax: 0.028,
    upBias: 0.22,
    glow: false,
  });
  juice.rings.push({ xFrac, yFrac, life: 0.36, maxLife: 0.36, maxRadiusFrac: 0.24, color: '#FF7A2E' });
  juice.rings.push({ xFrac, yFrac, life: 0.28, maxLife: 0.28, maxRadiusFrac: 0.15, color: '#FFD26A' });
}

// Pizza-box completion celebration (progression update, 2026-07-30). A
// burst of the box's own color plus white sparkles, and an expanding ring
// in the box color -- deliberately glow:false (18 shard particles), since
// shadowBlur-glow particles are a known in-WebView perf risk this build has
// already chased once; box completions can fire mid-catch-streak.
export function spawnBoxComplete(juice, xFrac, yFrac, hex) {
  emitBurst(juice, xFrac, yFrac, {
    count: 18,
    colors: [hex, '#ffffff', hex],
    speedMin: 0.25,
    speedMax: 0.5,
    life: 0.6,
    shape: 'shard',
    sizeMin: 0.01,
    sizeMax: 0.018,
    upBias: 0.2,
    glow: false,
  });
  juice.rings.push({
    xFrac,
    yFrac,
    life: 0.4,
    maxLife: 0.4,
    maxRadiusFrac: 0.18,
    color: hex,
  });
}

// Shield block (special abilities, 2026-07-30) -- fires when a shielded
// player absorbs a bomb. Bright green spark burst + a ring, no shadowBlur.
// Reads as a satisfying deflect, not a hit.
export function spawnShieldBlock(juice, xFrac, yFrac) {
  emitBurst(juice, xFrac, yFrac, {
    count: 12,
    colors: ['#4CE05A', '#B6FFC0', '#ffffff'],
    speedMin: 0.2,
    speedMax: 0.45,
    life: 0.4,
    shape: 'spark',
    sizeMin: 0.01,
    sizeMax: 0.018,
    upBias: 0.15,
    glow: false,
  });
  juice.rings.push({ xFrac, yFrac, life: 0.3, maxLife: 0.3, maxRadiusFrac: 0.13, color: '#4CE05A' });
}

// Wave clear (special abilities) -- fires on catching the wave pickup, which
// instantly destroys every bomb on screen. A big orange spark burst plus two
// concentric expanding rings from the player for a screen-clear read. Capped
// (one burst regardless of how many bombs were cleared).
export function spawnWaveClear(juice, xFrac, yFrac) {
  emitBurst(juice, xFrac, yFrac, {
    count: 20,
    colors: ['#FF8A2E', '#FFC15A', '#ffffff'],
    speedMin: 0.35,
    speedMax: 0.7,
    life: 0.5,
    shape: 'spark',
    sizeMin: 0.008,
    sizeMax: 0.018,
    upBias: 0.1,
    glow: false,
  });
  juice.rings.push({ xFrac, yFrac, life: 0.45, maxLife: 0.45, maxRadiusFrac: 0.5, color: '#FF8A2E' });
  juice.rings.push({ xFrac, yFrac, life: 0.35, maxLife: 0.35, maxRadiusFrac: 0.32, color: '#FFC15A' });
}

// Small generic colored sparkle -- power-up catch confirmation, and the
// per-catch "ooze still active" cue (see the good-catch branch in
// core/main.js). Deliberately tiny + glow:false: it can fire on every catch
// during a buff window, the highest-catch-rate moment, so it must stay cheap.
export function spawnPickupSparkle(juice, xFrac, yFrac, hex) {
  emitBurst(juice, xFrac, yFrac, {
    count: 7,
    colors: [hex, '#ffffff'],
    speedMin: 0.15,
    speedMax: 0.35,
    life: 0.4,
    shape: 'circle',
    sizeMin: 0.006,
    sizeMax: 0.012,
    upBias: 0.2,
    glow: false,
  });
}

export function triggerScreenShake(juice, durationSec, magnitudeFrac) {
  juice.shakeTimer = durationSec;
  juice.shakeMaxTimer = durationSec;
  juice.shakeMagnitudeFrac = magnitudeFrac;
}

export function updateJuice(juice, dt) {
  for (let i = juice.particles.length - 1; i >= 0; i--) {
    const p = juice.particles[i];
    p.vyFrac += GRAVITY_FRAC_PER_SEC2 * dt;
    p.xFrac += p.vxFrac * dt;
    p.yFrac += p.vyFrac * dt;
    p.rotationRad += p.rotationSpeedRadPerSec * dt;
    p.life -= dt;
    if (p.life <= 0) juice.particles.splice(i, 1);
  }

  for (let i = juice.rings.length - 1; i >= 0; i--) {
    juice.rings[i].life -= dt;
    if (juice.rings[i].life <= 0) juice.rings.splice(i, 1);
  }

  for (let i = juice.floaters.length - 1; i >= 0; i--) {
    const f = juice.floaters[i];
    f.yFrac -= FLOATER_RISE_FRAC_PER_SEC * dt; // drift upward
    f.life -= dt;
    if (f.life <= 0) juice.floaters.splice(i, 1);
  }

  if (juice.shakeTimer > 0) juice.shakeTimer = Math.max(0, juice.shakeTimer - dt);
}

// Returns { x, y } shake offset IN FRACTION units for this frame.
export function getShakeOffsetFrac(juice) {
  if (juice.shakeTimer <= 0) return { x: 0, y: 0 };
  const t = juice.shakeTimer / juice.shakeMaxTimer;
  const mag = juice.shakeMagnitudeFrac * t;
  return {
    x: (Math.random() * 2 - 1) * mag,
    y: (Math.random() * 2 - 1) * mag,
  };
}
