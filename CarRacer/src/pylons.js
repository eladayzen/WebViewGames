import * as THREE from 'three';
import { SPAWN_Z, DESPAWN_Z, LANE_WIDTH } from './constants.js';
import { createToonMaterial } from './toon.js';

// Giant roadside support pillars: we never see their base -- they run from
// far below the visible frame up past the bridge -- so the road reads as
// impossibly high in the sky. They scroll faster than actual road speed
// (pure background flair, not gameplay-relevant) for an exaggerated sense
// of speed as they whip past close to the track.
const PER_SIDE = 20;
const SPACING = 13;
const ROAD_GAP = LANE_WIDTH * 2 + 3.5;
const X_SPREAD = 10;
const SPEED_MULT = 2.4;

const BASE_DEPTH = -140; // pillar bottom, always far below frame
const TOP_MIN = 14; // height above the road the pillar reaches
const TOP_MAX = 55;
const RADIUS_MIN = 0.5;
const RADIUS_MAX = 0.9;

const HUE = 0.9;
const SAT = 0.7;
const LIGHT_MIN = 0.5;
const LIGHT_MAX = 0.72;
const CAP_COLOR = 0xff8bf0;

function makePillarGeometry() {
  const g = new THREE.CylinderGeometry(1, 1, 1, 8);
  g.translate(0, 0.5, 0); // pivot at base
  return g;
}
function makeCapGeometry() {
  return new THREE.TorusGeometry(1, 0.14, 6, 12);
}

function makeSlots() {
  const slots = [];
  for (let i = 0; i < PER_SIDE * 2; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const rank = Math.floor(i / 2);
    slots.push({
      side,
      z: SPAWN_Z + rank * SPACING + (Math.random() - 0.5) * 2,
      xOffset: Math.random() * X_SPREAD,
      top: TOP_MIN + Math.random() * (TOP_MAX - TOP_MIN),
      radius: RADIUS_MIN + Math.random() * (RADIUS_MAX - RADIUS_MIN),
      lightness: LIGHT_MIN + Math.random() * (LIGHT_MAX - LIGHT_MIN),
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
  color.setHSL(HUE, SAT, slot.lightness);
  mesh.setColorAt(index, color);
}

function applyCapTransform(mesh, index, slot) {
  const x = slot.side * (ROAD_GAP + slot.xOffset);
  dummy.position.set(x, slot.top, slot.z);
  dummy.rotation.set(Math.PI / 2, 0, 0);
  dummy.scale.setScalar(slot.radius * 1.3);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

export function createPylons(scene) {
  const pillarMesh = new THREE.InstancedMesh(makePillarGeometry(), createToonMaterial(0xffffff), PER_SIDE * 2);
  const capMesh = new THREE.InstancedMesh(
    makeCapGeometry(),
    new THREE.MeshBasicMaterial({ color: CAP_COLOR }),
    PER_SIDE * 2
  );
  pillarMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  capMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(pillarMesh, capMesh);

  const slots = makeSlots();
  slots.forEach((slot, i) => { applyPillarTransform(pillarMesh, i, slot); applyCapTransform(capMesh, i, slot); });
  pillarMesh.instanceMatrix.needsUpdate = true;
  capMesh.instanceMatrix.needsUpdate = true;
  pillarMesh.instanceColor.needsUpdate = true;

  return { slots, meshes: { pillarMesh, capMesh } };
}

export function updatePylons(pylons, dt, speed) {
  const { slots, meshes } = pylons;
  const span = (slots.length / 2) * SPACING;
  for (const slot of slots) {
    slot.z += speed * SPEED_MULT * dt;
    if (slot.z > DESPAWN_Z) slot.z -= span;
  }
  slots.forEach((slot, i) => { applyPillarTransform(meshes.pillarMesh, i, slot); applyCapTransform(meshes.capMesh, i, slot); });
  meshes.pillarMesh.instanceMatrix.needsUpdate = true;
  meshes.capMesh.instanceMatrix.needsUpdate = true;
}
