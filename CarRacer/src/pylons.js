import * as THREE from 'three';
import { SPAWN_Z, DESPAWN_Z, LANE_WIDTH } from './constants.js';

// Neon void backdrop: giant glowing tube "pillars" that run from far below
// the visible frame up past the bridge (base never seen -- sells the "road
// is impossibly high in the sky" read), plus a scatter of short crossing
// diagonal neon lines for the Beat-Saber-style laser-grid look. Both scroll
// faster than actual road speed -- pure background flair, not gameplay, for
// an exaggerated sense of speed as they whip past close to the track.
const PER_SIDE = 20;
const SPACING = 13;
const ROAD_GAP = LANE_WIDTH * 2 + 3.5;
const X_SPREAD = 10;
const SPEED_MULT = 2.4;

const BASE_DEPTH = -140; // pillar bottom, always far below frame
const TOP_MIN = 14; // height above the road the pillar reaches
const TOP_MAX = 55;
const TUBE_RADIUS_MIN = 0.14;
const TUBE_RADIUS_MAX = 0.24;

const ACCENT_COUNT = 60;
const ACCENT_SPACING = 7;
const ACCENT_LENGTH_MIN = 4;
const ACCENT_LENGTH_MAX = 11;
const ACCENT_RADIUS_MIN = 0.05;
const ACCENT_RADIUS_MAX = 0.1;

const NEON_COLORS = [0x6ff0ff, 0xff6ff0]; // cyan, magenta

function makePillarGeometry() {
  const g = new THREE.CylinderGeometry(1, 1, 1, 6);
  g.translate(0, 0.5, 0); // pivot at base
  return g;
}
function makeAccentGeometry() {
  return new THREE.CylinderGeometry(1, 1, 1, 5); // centered, no translate
}

function makePillarSlots() {
  const slots = [];
  for (let i = 0; i < PER_SIDE * 2; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const rank = Math.floor(i / 2);
    slots.push({
      side,
      z: SPAWN_Z + rank * SPACING + (Math.random() - 0.5) * 2,
      xOffset: Math.random() * X_SPREAD,
      top: TOP_MIN + Math.random() * (TOP_MAX - TOP_MIN),
      radius: TUBE_RADIUS_MIN + Math.random() * (TUBE_RADIUS_MAX - TUBE_RADIUS_MIN),
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
      xOffset: (ROAD_GAP - 2) + Math.random() * (X_SPREAD + 8),
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

function applyPillarTransform(mesh, index, slot) {
  const x = slot.side * (ROAD_GAP + slot.xOffset);
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

export function createPylons(scene) {
  const pillarMesh = new THREE.InstancedMesh(makePillarGeometry(), neonMaterial(), PER_SIDE * 2);
  const accentMesh = new THREE.InstancedMesh(makeAccentGeometry(), neonMaterial(), ACCENT_COUNT);
  pillarMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  accentMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(pillarMesh, accentMesh);

  const pillarSlots = makePillarSlots();
  const accentSlots = makeAccentSlots();
  pillarSlots.forEach((slot, i) => applyPillarTransform(pillarMesh, i, slot));
  accentSlots.forEach((slot, i) => applyAccentTransform(accentMesh, i, slot));
  pillarMesh.instanceMatrix.needsUpdate = true;
  accentMesh.instanceMatrix.needsUpdate = true;
  pillarMesh.instanceColor.needsUpdate = true;
  accentMesh.instanceColor.needsUpdate = true;

  return { pillarSlots, accentSlots, meshes: { pillarMesh, accentMesh } };
}

export function updatePylons(pylons, dt, speed) {
  const { pillarSlots, accentSlots, meshes } = pylons;
  const scroll = speed * SPEED_MULT * dt;

  const pillarSpan = (pillarSlots.length / 2) * SPACING;
  for (const slot of pillarSlots) {
    slot.z += scroll;
    if (slot.z > DESPAWN_Z) slot.z -= pillarSpan;
  }
  pillarSlots.forEach((slot, i) => applyPillarTransform(meshes.pillarMesh, i, slot));
  meshes.pillarMesh.instanceMatrix.needsUpdate = true;

  const accentSpan = accentSlots.length * ACCENT_SPACING;
  for (const slot of accentSlots) {
    slot.z += scroll;
    if (slot.z > DESPAWN_Z) slot.z -= accentSpan;
  }
  accentSlots.forEach((slot, i) => applyAccentTransform(meshes.accentMesh, i, slot));
  meshes.accentMesh.instanceMatrix.needsUpdate = true;
}
