// Cheap canvas-level "juice" (§1: "punchy juicy hit-feedback -- impact
// stars, swing whoosh, screen-shake on bomb hits -- over anything
// mechanically deep"). Plain primitives, no particle-system library, per
// the technical architecture note in §9.1.

const GRAVITY_FRAC_PER_SEC2 = 1.6;

export function createJuice() {
  return {
    particles: [], // { xFrac, yFrac, vxFrac, vyFrac, life, maxLife, color }
    shakeTimer: 0,
    shakeMaxTimer: 0,
    shakeMagnitudeFrac: 0,
  };
}

export function resetJuice(juice) {
  juice.particles = [];
  juice.shakeTimer = 0;
  juice.shakeMaxTimer = 0;
  juice.shakeMagnitudeFrac = 0;
}

export function spawnHitBurst(juice, xFrac, yFrac, color) {
  const count = 6;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = 0.25 + Math.random() * 0.2;
    juice.particles.push({
      xFrac,
      yFrac,
      vxFrac: Math.cos(angle) * speed,
      vyFrac: Math.sin(angle) * speed - 0.15,
      life: 0.45,
      maxLife: 0.45,
      color,
    });
  }
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
    p.life -= dt;
    if (p.life <= 0) juice.particles.splice(i, 1);
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
