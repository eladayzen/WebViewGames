import * as THREE from 'three';
import { tunnelCenterAt, THEME_HUE_CENTERS } from './tunnel.js';
import { GAME_CONFIG } from './gameConfig.js';

// --- Difficulty ramp -------------------------------------------------------
// Everything here is keyed off "elapsed run time in seconds at the moment a
// ring is created/recycled" — each ring locks in its own difficulty for its
// whole lifetime, so nothing changes shape while it's already on screen.
// Tunables live in gameConfig.js (GAME_CONFIG.difficulty).

// --- Pickups ---------------------------------------------------------------
// Up to maxSlots pickups per cluster, positioned as an offset (angle-
// fraction-through-the-gap, z-offset-from-the-ring) rather than always
// dead-center. Cluster spawn rate, spacing, and pattern shape are all
// tunable in gameConfig.js (GAME_CONFIG.pickups).

function pickupPattern(gapWidth) {
  const cfg = GAME_CONFIG.pickups;
  const { centered, offCenter } = cfg.clusterShapeWeights;
  const r = Math.random();
  if (r < centered) {
    return [{ angleFrac: 0.5, zOffset: 0 }]; // centered — the classic placement, kept as one option
  }
  if (r < centered + offCenter) {
    return [{ angleFrac: 0.15 + Math.random() * 0.7, zOffset: 0 }]; // off-center, not always in the middle
  }
  // A short scattered line the player sweeps through while adjusting angle.
  // Spread is an absolute angular cap (not a fraction of gapWidth) so it
  // stays reachable even when the gap is very wide early in a run.
  const spreadRad = Math.min(cfg.lineMaxAngularSpread, gapWidth * 0.8);
  const spreadFrac = spreadRad / gapWidth;
  const jitter = (Math.random() - 0.5) * 0.1;
  const margin = spreadFrac / 2 + 0.05;
  const center = THREE.MathUtils.clamp(0.5 + jitter, margin, 1 - margin);
  const startFrac = center - spreadFrac / 2;
  const endFrac = center + spreadFrac / 2;
  return [
    { angleFrac: startFrac, zOffset: -cfg.lineZSpan },
    { angleFrac: (startFrac + endFrac) / 2, zOffset: 0 },
    { angleFrac: endFrac, zOffset: cfg.lineZSpan },
  ];
}

const GATE_GEO = new THREE.SphereGeometry(0.16, 12, 12);
const GATE_MAT = new THREE.MeshBasicMaterial({ color: 0xdfffff });

const GEM_GEO = new THREE.OctahedronGeometry(0.42); // +20% from the original 0.35
const GEM_MAT = new THREE.MeshStandardMaterial({
  color: 0xffe082,
  emissive: 0xffb300,
  emissiveIntensity: 1,
  roughness: 0.25,
});

const HEART_GEO = createHeartGeometry();
const HEART_MAT = new THREE.MeshStandardMaterial({
  color: 0xff3d6b,
  emissive: 0xff1f57,
  emissiveIntensity: 1.3,
  roughness: 0.3,
});

function createHeartGeometry() {
  const s = 0.24 * 1.2; // +20% from the original 0.24
  const shape = new THREE.Shape();
  shape.moveTo(0, -s * 0.95);
  shape.bezierCurveTo(-s * 1.5, s * 0.4, -s * 0.6, s * 1.35, 0, s * 0.55);
  shape.bezierCurveTo(s * 0.6, s * 1.35, s * 1.5, s * 0.4, 0, -s * 0.95);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

// Walks the tier list to find which plateau `elapsedSeconds` falls in, and
// blends into the next one only during the last `transitionSeconds` of a
// tier's hold — see the tiers comment in gameConfig.js.
function tierAt(elapsedSeconds) {
  const { tiers, transitionSeconds } = GAME_CONFIG.difficulty;
  let start = 0;
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const next = tiers[i + 1];
    const end = start + tier.holdSeconds;
    if (!next || elapsedSeconds < end) {
      if (next) {
        const blendStart = end - transitionSeconds;
        if (elapsedSeconds >= blendStart) {
          const blendT = THREE.MathUtils.clamp((elapsedSeconds - blendStart) / transitionSeconds, 0, 1);
          return {
            gapWidth: THREE.MathUtils.lerp(tier.gapWidth, next.gapWidth, blendT),
            innerRadiusFactor: THREE.MathUtils.lerp(tier.innerRadiusFactor, next.innerRadiusFactor, blendT),
            spacingBonus: THREE.MathUtils.lerp(tier.spacingBonus, next.spacingBonus, blendT),
          };
        }
      }
      return tier;
    }
    start = end;
  }
  return tiers[tiers.length - 1];
}

// Every difficulty-dependent parameter a ring needs, derived from how far
// into the run it was born.
function difficultyParams(elapsedSeconds, ringRadius, baseSpacing) {
  const tier = tierAt(elapsedSeconds);
  return {
    gapWidth: tier.gapWidth,
    innerRadius: ringRadius * tier.innerRadiusFactor,
    spacing: baseSpacing + tier.spacingBonus,
  };
}

function randomGapAngle() {
  return Math.random() * Math.PI * 2;
}

// Sampled around the tunnel's current theme hue (see setThemeHue) rather
// than fully random, so obstacles read as belonging to whatever environment
// is currently active instead of clashing against it with arbitrary color.
function randomWallHue(themeHue) {
  return ((themeHue + (Math.random() - 0.5) * 0.18) % 1 + 1) % 1;
}

function wallGeometry(innerRadius, outerRadius, gapAngle, gapWidth) {
  return new THREE.RingGeometry(innerRadius, outerRadius, 64, 1, gapAngle + gapWidth, Math.PI * 2 - gapWidth);
}

// The wedge/rim geometry is built around its own local origin, so following
// the tunnel's bend is just translating the whole mesh to the centerline's
// offset at this ring's z — same trick used for gates/pickups below.
function placeWall(ring) {
  const c = tunnelCenterAt(ring.z);
  ring.mesh.position.set(c.x, c.y, ring.z);
  ring.rim.position.set(c.x, c.y, ring.z);
}

function placeGates(ring, radius) {
  const c = tunnelCenterAt(ring.z);
  const a1 = ring.gapAngle;
  const a2 = ring.gapAngle + ring.gapWidth;
  ring.gateA.position.set(c.x + Math.cos(a1) * radius, c.y + Math.sin(a1) * radius, ring.z);
  ring.gateB.position.set(c.x + Math.cos(a2) * radius, c.y + Math.sin(a2) * radius, ring.z);
}

// Each active slot has its own world z (ring.z + its own offset), so it gets
// its own tunnel-bend offset too — a 3-point trail spans enough z that the
// tunnel's curve can meaningfully differ between its first and last point.
function placePickupSlot(ring, slot, ringRadius) {
  const z = ring.z + slot.zOffset;
  const c = tunnelCenterAt(z);
  const angle = ring.gapAngle + slot.angleFrac * ring.gapWidth;
  slot.mesh.position.set(c.x + Math.cos(angle) * ringRadius, c.y + Math.sin(angle) * ringRadius, z);
  slot.z = z;
}

function placePickups(ring, ringRadius) {
  for (const slot of ring.pickups) {
    if (slot.active) placePickupSlot(ring, slot, ringRadius);
  }
}

export class ObstacleField {
  // `radius` is the tunnel wall's outer radius. `ringRadius` is the ship's
  // fixed travel radius — gates/pickups sit there, and it's also the
  // reference for how wide the early "thin band" obstacles are.
  constructor(scene, { radius, ringRadius, count, spacing, startZ }) {
    this.scene = scene;
    this.radius = radius;
    this.ringRadius = ringRadius;
    this.baseSpacing = spacing;
    this.themeHue = THEME_HUE_CENTERS[0];
    // Rings since the last spawned pickup cluster — starts high so the very
    // first eligible ring can spawn one right away (subject to spawnChance).
    this.ringsSincePickupCluster = GAME_CONFIG.pickups.minRingsBetweenClusters;
    this.rings = [];
    let z = startZ;
    for (let i = 0; i < count; i++) {
      const ring = this.createRing(z, 0);
      this.rings.push(ring);
      z -= difficultyParams(0, ringRadius, spacing).spacing;
    }
  }

  // Called from main.js whenever the tunnel's active theme changes, so
  // newly-created/recycled obstacle walls pick up the new palette.
  setThemeHue(hue) {
    this.themeHue = hue;
  }

  createPickupSlots() {
    const slots = [];
    for (let i = 0; i < GAME_CONFIG.pickups.maxSlots; i++) {
      slots.push({ mesh: new THREE.Mesh(GEM_GEO, GEM_MAT), active: false, angleFrac: 0.5, zOffset: 0, z: 0 });
      this.scene.add(slots[i].mesh);
    }
    return slots;
  }

  // Decides whether this ring gets a pickup cluster at all, gated by both a
  // minimum-spacing counter and a spawn chance (see gameConfig.js) — without
  // this gate every single ring spawned a cluster, leaving zero breathing
  // room between them.
  applyPickupPattern(ring, elapsedNow) {
    const cfg = GAME_CONFIG.pickups;
    const eligible = this.ringsSincePickupCluster >= cfg.minRingsBetweenClusters;
    const spawnsCluster = eligible && Math.random() < cfg.spawnChance;

    if (!spawnsCluster) {
      this.ringsSincePickupCluster += 1;
      ring.pickupType = 'gem';
      ring.pickups.forEach((slot) => {
        slot.active = false;
        slot.collected = false;
        slot.mesh.visible = false;
      });
      return;
    }

    this.ringsSincePickupCluster = 0;
    const isLife = elapsedNow >= cfg.lifeMinStartSeconds && Math.random() < cfg.lifeChance;
    ring.pickupType = isLife ? 'life' : 'gem';
    const points = pickupPattern(ring.gapWidth);
    ring.pickups.forEach((slot, i) => {
      const point = points[i];
      slot.active = Boolean(point);
      slot.collected = false;
      if (!point) {
        slot.mesh.visible = false;
        return;
      }
      slot.angleFrac = point.angleFrac;
      slot.zOffset = point.zOffset;
      slot.mesh.geometry = isLife ? HEART_GEO : GEM_GEO;
      slot.mesh.material = isLife ? HEART_MAT : GEM_MAT;
      slot.mesh.visible = true;
    });
  }

  createRing(z, elapsedNow) {
    const params = difficultyParams(elapsedNow, this.ringRadius, this.baseSpacing);
    const gapAngle = randomGapAngle();
    const hue = randomWallHue(this.themeHue);
    const mesh = new THREE.Mesh(
      wallGeometry(params.innerRadius, this.radius, gapAngle, params.gapWidth),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(hue, 0.7, 0.42),
        emissive: new THREE.Color().setHSL(hue, 0.9, 0.35),
        emissiveIntensity: 1.1,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
        roughness: 0.3,
        metalness: 0.2,
      }),
    );
    this.scene.add(mesh);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(this.radius, 0.08, 8, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue, 0.9, 0.65) }),
    );
    this.scene.add(rim);

    const gateA = new THREE.Mesh(GATE_GEO, GATE_MAT);
    const gateB = new THREE.Mesh(GATE_GEO, GATE_MAT);
    this.scene.add(gateA, gateB);

    const ring = {
      mesh,
      rim,
      gateA,
      gateB,
      pickups: this.createPickupSlots(),
      pickupType: 'gem',
      z,
      gapAngle,
      gapWidth: params.gapWidth,
      passed: false,
      spacing: params.spacing,
    };
    this.applyPickupPattern(ring, elapsedNow);
    placeWall(ring);
    placeGates(ring, this.ringRadius);
    placePickups(ring, this.ringRadius);
    return ring;
  }

  recycle(ring, newZ, elapsedNow) {
    const params = difficultyParams(elapsedNow, this.ringRadius, this.baseSpacing);
    const gapAngle = randomGapAngle();
    const hue = randomWallHue(this.themeHue);

    ring.mesh.geometry.dispose();
    ring.mesh.geometry = wallGeometry(params.innerRadius, this.radius, gapAngle, params.gapWidth);
    ring.mesh.material.color.setHSL(hue, 0.7, 0.42);
    ring.mesh.material.emissive.setHSL(hue, 0.9, 0.35);
    ring.rim.material.color.setHSL(hue, 0.9, 0.65);

    ring.gapAngle = gapAngle;
    ring.gapWidth = params.gapWidth;
    ring.spacing = params.spacing;
    ring.z = newZ;
    ring.passed = false;

    this.applyPickupPattern(ring, elapsedNow);
    placeWall(ring);
    placeGates(ring, this.ringRadius);
    placePickups(ring, this.ringRadius);
  }

  reset(startZ) {
    this.ringsSincePickupCluster = GAME_CONFIG.pickups.minRingsBetweenClusters;
    let z = startZ;
    this.rings.forEach((ring) => {
      this.recycle(ring, z, 0);
      z -= ring.spacing;
    });
  }

  update(speed, playerZ, playerX, playerY, elapsedNow, callbacks) {
    let farthestZ = Infinity;
    let farthestSpacing = this.baseSpacing;
    for (const ring of this.rings) {
      if (ring.z < farthestZ) {
        farthestZ = ring.z;
        farthestSpacing = ring.spacing;
      }
    }

    for (const ring of this.rings) {
      ring.z += speed;
      placeWall(ring);
      placeGates(ring, this.ringRadius);
      placePickups(ring, this.ringRadius);

      if (!ring.passed && ring.z >= playerZ) {
        ring.passed = true;
        const angle = Math.atan2(playerY, playerX);
        const norm = (((angle - ring.gapAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (norm < ring.gapWidth) {
          callbacks.onPass();
        } else {
          callbacks.onCollide();
        }
      }

      for (const slot of ring.pickups) {
        if (!slot.active || slot.collected) continue;
        const dz = slot.z - playerZ;
        const dx = slot.mesh.position.x - playerX;
        const dy = slot.mesh.position.y - playerY;
        if (Math.abs(dz) < GAME_CONFIG.pickups.collectZWindow && Math.hypot(dx, dy) < GAME_CONFIG.pickups.collectRadius) {
          slot.collected = true;
          slot.mesh.visible = false;
          if (ring.pickupType === 'life') {
            callbacks.onLife(slot.mesh.position.x, slot.mesh.position.y, slot.mesh.position.z);
          } else {
            callbacks.onGem(slot.mesh.position.x, slot.mesh.position.y, slot.mesh.position.z);
          }
        }
      }

      if (ring.z > playerZ + 10) {
        farthestZ -= farthestSpacing;
        this.recycle(ring, farthestZ, elapsedNow);
        farthestSpacing = ring.spacing;
      }
    }
  }
}
