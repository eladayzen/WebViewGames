import * as THREE from 'three';
import { LANE_WIDTH } from './constants.js';

const ROAD_LENGTH = 400;
const ROAD_WIDTH = LANE_WIDTH * 2 + 3.4;
const ROAD_THICKNESS = 0.5;
const ROAD_Z = -ROAD_LENGTH / 2 + 20;

// Neon-void racetrack: dark glass-black surface and glowing cyan neon-tube
// barriers along both edges -- no center line (it interfered with reading
// traffic in the middle lane).
export function createRoad() {
  const topMat = new THREE.MeshStandardMaterial({ color: 0x0e0f18, roughness: 0.3, metalness: 0.25 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x08090f, roughness: 0.6 });
  const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];

  const road = new THREE.Mesh(
    new THREE.BoxGeometry(ROAD_WIDTH, ROAD_THICKNESS, ROAD_LENGTH),
    materials
  );
  road.position.set(0, -ROAD_THICKNESS / 2, ROAD_Z);

  const group = new THREE.Group();
  group.add(road);

  const barrierGeo = new THREE.CapsuleGeometry(0.12, ROAD_LENGTH - 1, 4, 8);
  const barrierMat = new THREE.MeshBasicMaterial({ color: 0x6ff0ff });
  for (const side of [-1, 1]) {
    const barrier = new THREE.Mesh(barrierGeo, barrierMat);
    barrier.rotation.x = Math.PI / 2;
    barrier.position.set(side * (ROAD_WIDTH / 2 + 0.15), 0.22, ROAD_Z);
    group.add(barrier);
  }

  return group;
}
