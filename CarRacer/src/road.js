import * as THREE from 'three';
import { LANE_WIDTH } from './constants.js';

const ROAD_LENGTH = 400;
const ROAD_WIDTH = LANE_WIDTH * 2 + 3.4;
const ROAD_THICKNESS = 0.5;
const ROAD_Z = -ROAD_LENGTH / 2 + 20;

function createGlowStripMaterial(colorHex, opacity) {
  return new THREE.MeshBasicMaterial({
    color: colorHex, transparent: true, opacity, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  });
}

// Sci-fi racetrack: glossy magenta surface, a glowing energy line down the
// center (not lane paint -- a single stylized strip, not traffic markings),
// and pale rounded curb barriers along both edges.
export function createRoad() {
  const topMat = new THREE.MeshStandardMaterial({ color: 0x8a2fb0, roughness: 0.35, metalness: 0.2 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x5a1f78, roughness: 0.6 });
  const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];

  const road = new THREE.Mesh(
    new THREE.BoxGeometry(ROAD_WIDTH, ROAD_THICKNESS, ROAD_LENGTH),
    materials
  );
  road.position.set(0, -ROAD_THICKNESS / 2, ROAD_Z);

  const group = new THREE.Group();
  group.add(road);

  const coreLine = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, ROAD_LENGTH),
    createGlowStripMaterial(0xff8bf0, 0.95)
  );
  coreLine.rotation.x = -Math.PI / 2;
  coreLine.position.set(0, 0.015, ROAD_Z);
  group.add(coreLine);

  const softGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, ROAD_LENGTH),
    createGlowStripMaterial(0xd25cff, 0.22)
  );
  softGlow.rotation.x = -Math.PI / 2;
  softGlow.position.set(0, 0.012, ROAD_Z);
  group.add(softGlow);

  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xf0eef7, roughness: 0.4 });
  const barrierGeo = new THREE.CapsuleGeometry(0.22, ROAD_LENGTH - 1, 4, 8);
  for (const side of [-1, 1]) {
    const barrier = new THREE.Mesh(barrierGeo, barrierMat);
    barrier.rotation.x = Math.PI / 2;
    barrier.position.set(side * (ROAD_WIDTH / 2 + 0.15), 0.22, ROAD_Z);
    group.add(barrier);
  }

  return group;
}
