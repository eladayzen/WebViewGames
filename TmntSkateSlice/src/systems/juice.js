// Cheap canvas-level "juice" (§1: "punchy juicy hit-feedback -- impact
// stars, swing whoosh, screen-shake on bomb hits -- over anything
// mechanically deep"). Plain primitives, no particle-system library, per
// the technical architecture note in §9.1.

const GRAVITY_FRAC_PER_SEC2 = 1.6;

export function createJuice() {
  return {
    particles: [], // { xFrac, yFrac, vxFrac, vyFrac, life, maxLife, color, shape, sizeFrac, rotationRad, rotationSpeedRadPerSec, glow }
    rings: [], // { xFrac, yFrac, life, maxLife, maxRadiusFrac, color } -- bomb shockwave only
    shakeTimer: 0,
    shakeMaxTimer: 0,
    shakeMagnitudeFrac: 0,
  };
}

export function resetJuice(juice) {
  juice.particles = [];
  juice.rings = [];
  juice.shakeTimer = 0;
  juice.shakeMaxTimer = 0;
  juice.shakeMagnitudeFrac = 0;
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
    count: 7,
    colors: ['#4CFF7A', '#8CE05A'],
    speedMin: 0.15,
    speedMax: 0.3,
    life: 0.55,
    shape: 'blob',
    sizeMin: 0.014,
    sizeMax: 0.022,
    upBias: 0.22,
    glow: true,
  });
}

// Bomb detonation -- hazard-only palette per STYLE.md (near-black body,
// amber hazard stripe, fuse-spark orange; must never read warm/friendly),
// plus an expanding shockwave ring for extra impact on top of the existing
// screen-shake (see triggerHit call site in core/main.js).
export function spawnBombExplosion(juice, xFrac, yFrac) {
  emitBurst(juice, xFrac, yFrac, {
    count: 14,
    colors: ['#1B1B1F', '#F2C230', '#FF7A2E'],
    speedMin: 0.3,
    speedMax: 0.55,
    life: 0.45,
    shape: 'spark',
    sizeMin: 0.01,
    sizeMax: 0.02,
    upBias: 0.2,
    glow: true,
  });
  juice.rings.push({
    xFrac,
    yFrac,
    life: 0.3,
    maxLife: 0.3,
    maxRadiusFrac: 0.14,
    color: '#FF7A2E',
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
