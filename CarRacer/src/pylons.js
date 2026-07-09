import * as THREE from 'three';
import { SPAWN_Z, DESPAWN_Z, LANE_WIDTH } from './constants.js';

// Neon void backdrop: giant glowing tube "pillars" that run from far below
// the visible frame up past the bridge (base never seen -- sells the "road
// is impossibly high in the sky" read), plus a scatter of short crossing
// diagonal neon lines for the Beat-Saber-style laser-grid look. Two pillar
// bands -- a near one close to the track and a far one spread wide out to
// the sides -- so distance perspective reads as real parallax (the far
// band visibly crawls across the screen slower than the near one, for
// free, just from being farther away) instead of the world feeling like a
// narrow strip hugging the road. Both scroll faster than actual road
// speed -- pure background flair, not gameplay.
const SPEED_MULT = 2.4;
const BASE_DEPTH = -140; // pillar bottom, always far below frame
const NEON_COLORS = [0x6ff0ff, 0xff6ff0]; // cyan, magenta

// perSide cut ~40% (too dense per feedback); spacing raised to compensate
// so the same overall depth range is still covered, just with fewer, more
// spread-out pillars rather than a shorter visible stretch of them.
const NEAR_BAND = {
  perSide: 12, spacing: 22, roadGap: LANE_WIDTH * 2 + 3.5, xSpread: 10,
  topMin: 14, topMax: 55, radiusMin: 0.5, radiusMax: 0.9,
};
const FAR_BAND = {
  perSide: 16, spacing: 26, roadGap: 50, xSpread: 140,
  topMin: 25, topMax: 90, radiusMin: 1.4, radiusMax: 2.4,
};

const ACCENT_COUNT = 60;
const ACCENT_SPACING = 7;
const ACCENT_LENGTH_MIN = 4;
const ACCENT_LENGTH_MAX = 11;
const ACCENT_RADIUS_MIN = 0.05;
const ACCENT_RADIUS_MAX = 0.1;
const ACCENT_ROAD_GAP = NEAR_BAND.roadGap;
const ACCENT_X_SPREAD = NEAR_BAND.xSpread;

function makePillarGeometry() {
  const g = new THREE.CylinderGeometry(1, 1, 1, 6);
  g.translate(0, 0.5, 0); // pivot at base
  return g;
}
function makeAccentGeometry() {
  return new THREE.CylinderGeometry(1, 1, 1, 5); // centered, no translate
}

function makePillarSlots(band) {
  const slots = [];
  for (let i = 0; i < band.perSide * 2; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const rank = Math.floor(i / 2);
    slots.push({
      side,
      z: SPAWN_Z + rank * band.spacing + (Math.random() - 0.5) * 2,
      xOffset: Math.random() * band.xSpread,
      top: band.topMin + Math.random() * (band.topMax - band.topMin),
      radius: band.radiusMin + Math.random() * (band.radiusMax - band.radiusMin),
      colorIdx: Math.random() < 0.5 ? 0 : 1,
    });
  }
  return slots;
}

function makeAccentSlots() {
  const slots = [];
  for (let i = 0; i < ACCENT_COUNT; i++) {
    slots.push({
      side: Math.random() < 0.5 ? -1 : 1,
      z: SPAWN_Z + i * ACCENT_SPACING + Math.random() * ACCENT_SPACING,
      xOffset: (ACCENT_ROAD_GAP - 2) + Math.random() * (ACCENT_X_SPREAD + 8),
      y: Math.random() * 32,
      length: ACCENT_LENGTH_MIN + Math.random() * (ACCENT_LENGTH_MAX - ACCENT_LENGTH_MIN),
      radius: ACCENT_RADIUS_MIN + Math.random() * (ACCENT_RADIUS_MAX - ACCENT_RADIUS_MIN),
      rotX: (Math.random() - 0.5) * 0.6,
      rotZ: (Math.random() - 0.5) * Math.PI * 0.7,
      colorIdx: Math.random() < 0.5 ? 0 : 1,
    });
  }
  return slots;
}

const dummy = new THREE.Object3D();
const color = new THREE.Color();

function applyPillarTransform(mesh, index, slot, band) {
  const x = slot.side * (band.roadGap + slot.xOffset);
  dummy.position.set(x, BASE_DEPTH, slot.z);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(slot.radius, slot.top - BASE_DEPTH, slot.radius);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
  color.setHex(NEON_COLORS[slot.colorIdx]);
  mesh.setColorAt(index, color);
}

function applyAccentTransform(mesh, index, slot) {
  const x = slot.side * slot.xOffset;
  dummy.position.set(x, slot.y, slot.z);
  dummy.rotation.set(slot.rotX, 0, slot.rotZ);
  dummy.scale.set(slot.radius, slot.length, slot.radius);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
  color.setHex(NEON_COLORS[slot.colorIdx]);
  mesh.setColorAt(index, color);
}

function neonMaterial() {
  return new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
}

function createPillarBand(scene, band) {
  const mesh = new THREE.InstancedMesh(makePillarGeometry(), neonMaterial(), band.perSide * 2);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  const slots = makePillarSlots(band);
  slots.forEach((slot, i) => applyPillarTransform(mesh, i, slot, band));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;

  return { slots, mesh, band };
}

function updatePillarBand(pillarBand, scroll) {
  const { slots, mesh, band } = pillarBand;
  const span = (slots.length / 2) * band.spacing;
  for (const slot of slots) {
    slot.z += scroll;
    if (slot.z > DESPAWN_Z) slot.z -= span;
  }
  slots.forEach((slot, i) => applyPillarTransform(mesh, i, slot, band));
  mesh.instanceMatrix.needsUpdate = true;
}

export function createPylons(scene) {
  const nearPillars = createPillarBand(scene, NEAR_BAND);
  const farPillars = createPillarBand(scene, FAR_BAND);

  const accentMesh = new THREE.InstancedMesh(makeAccentGeometry(), neonMaterial(), ACCENT_COUNT);
  accentMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(accentMesh);
  const accentSlots = makeAccentSlots();
  accentSlots.forEach((slot, i) => applyAccentTransform(accentMesh, i, slot));
  accentMesh.instanceMatrix.needsUpdate = true;
  accentMesh.instanceColor.needsUpdate = true;

  return { nearPillars, farPillars, accentSlots, meshes: { accentMesh } };
}

export function updatePylons(pylons, dt, speed) {
  const { nearPillars, farPillars, accentSlots, meshes } = pylons;
  const scroll = speed * SPEED_MULT * dt;

  updatePillarBand(nearPillars, scroll);
  updatePillarBand(farPillars, scroll);

  const accentSpan = accentSlots.length * ACCENT_SPACING;
  for (const slot of accentSlots) {
    slot.z += scroll;
    if (slot.z > DESPAWN_Z) slot.z -= accentSpan;
  }
  accentSlots.forEach((slot, i) => applyAccentTransform(meshes.accentMesh, i, slot));
  meshes.accentMesh.instanceMatrix.needsUpdate = true;
}
