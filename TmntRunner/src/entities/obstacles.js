import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { createToonMaterial } from '../core/toonMaterial';
// Side-effect import: registers Mesh.prototype.createInstance(), used below.
import '@babylonjs/core/Meshes/instancedMesh';

// Two obstacle behaviors per GDD §4.3: a full-lane blocker (must lane-change)
// and a low overhead obstacle (must jump). Base meshes are created once and
// hidden; every chunk slot instances them via createInstance -- no mesh is
// ever created or disposed after boot (GDD §9.2, WebView memory constraint).
export const OBSTACLE_TYPES = { BLOCKER: 'BLOCKER', LOW: 'LOW' };

let blockerBase = null;
let lowBase = null;
let instanceCounter = 0;

function ensureBaseMeshes(scene) {
  if (blockerBase) return;

  blockerBase = CreateBox('obstacleBlockerBase', { width: 1.7, height: 1.2, depth: 0.6 }, scene);
  blockerBase.material = createToonMaterial(scene, {
    name: 'blockerMat',
    baseColor: new Color3(0.9, 0.5, 0.1),
    rimColor: new Color3(1, 0.85, 0.5),
  });
  blockerBase.isVisible = false;

  lowBase = CreateBox('obstacleLowBase', { width: 1.7, height: 0.32, depth: 0.4 }, scene);
  lowBase.material = createToonMaterial(scene, {
    name: 'lowMat',
    baseColor: new Color3(0.92, 0.82, 0.15),
    rimColor: new Color3(1, 0.95, 0.6),
  });
  lowBase.isVisible = false;
}

// Creates one obstacle "slot" for a given lane under a chunk's TransformNode:
// an instance of each obstacle type, toggled visible/invisible per whichever
// chunk template is currently active.
export function createObstacleSlot(scene, parent, laneX) {
  ensureBaseMeshes(scene);
  instanceCounter += 1;

  const blocker = blockerBase.createInstance(`blockerInst_${instanceCounter}`);
  blocker.parent = parent;
  blocker.position.set(laneX, 0.6, 0);
  blocker.isVisible = false;

  const low = lowBase.createInstance(`lowInst_${instanceCounter}`);
  low.parent = parent;
  low.position.set(laneX, 1.45, 0);
  low.isVisible = false;

  const slot = {
    laneX,
    type: null,
    setType(type, z = 0) {
      slot.type = type;
      blocker.isVisible = type === OBSTACLE_TYPES.BLOCKER;
      low.isVisible = type === OBSTACLE_TYPES.LOW;
      if (type === OBSTACLE_TYPES.BLOCKER) blocker.position.z = z;
      if (type === OBSTACLE_TYPES.LOW) low.position.z = z;
    },
    getHitPosition() {
      const mesh = slot.type === OBSTACLE_TYPES.LOW ? low : blocker;
      const p = mesh.getAbsolutePosition();
      return { x: p.x, z: p.z };
    },
  };
  return slot;
}
