import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { createToonMaterial } from '../core/toonMaterial';
// Side-effect import: registers Mesh.prototype.createInstance(), used below.
import '@babylonjs/core/Meshes/instancedMesh';

// Two collectible types per GDD §4.4: coin (primary currency, common) and
// pizza slice (secondary/mission currency, rarer, higher value). Base meshes
// are created once and hidden; every pickup slot instances them -- no mesh
// is ever created or disposed after boot, same pooling discipline as
// entities/obstacles.js.
export const PICKUP_TYPES = { COIN: 'COIN', PIZZA: 'PIZZA' };
export const PICKUP_VALUES = { COIN: 25, PIZZA: 100 };

// How many simultaneous pickup points a single lane within one chunk can
// hold (enough for a short "line" arc per GDD §4.4) -- data/chunks.js
// templates must not place more than this many entries in one lane.
export const SLOTS_PER_LANE = 3;

let coinBase = null;
let pizzaBase = null;
let counter = 0;

function ensureBaseMeshes(scene) {
  if (coinBase) return;

  coinBase = CreateCylinder('coinBase', { diameter: 0.5, height: 0.08, tessellation: 16 }, scene);
  coinBase.material = createToonMaterial(scene, {
    name: 'coinMat',
    baseColor: new Color3(0.95, 0.8, 0.15),
    rimColor: new Color3(1, 0.95, 0.6),
    emissiveColor: new Color3(0.4, 0.3, 0.03),
  });
  coinBase.isVisible = false;

  // Triangular prism (3-sided cylinder) reads as a stylized pizza-slice
  // wedge once rotated flat -- cheap placeholder geometry, no art needed.
  pizzaBase = CreateCylinder('pizzaBase', { diameter: 0.55, height: 0.4, tessellation: 3 }, scene);
  pizzaBase.material = createToonMaterial(scene, {
    name: 'pizzaMat',
    baseColor: new Color3(0.95, 0.55, 0.15),
    rimColor: new Color3(1, 0.8, 0.4),
    emissiveColor: new Color3(0.3, 0.11, 0.01),
  });
  pizzaBase.isVisible = false;
}

// Creates one pickup "slot" for a given lane under a chunk's TransformNode:
// an instance of each pickup type, toggled visible per whichever chunk
// template is currently active, plus a `collected` flag so a slot hides for
// the rest of the current chunk cycle once picked up (reset on recycle).
export function createPickupSlot(scene, parent, laneX) {
  ensureBaseMeshes(scene);
  counter += 1;

  const coin = coinBase.createInstance(`coinInst_${counter}`);
  coin.parent = parent;
  coin.position.set(laneX, 0.9, 0);
  coin.rotation.x = Math.PI / 2;
  coin.isVisible = false;

  const pizza = pizzaBase.createInstance(`pizzaInst_${counter}`);
  pizza.parent = parent;
  pizza.position.set(laneX, 0.9, 0);
  pizza.rotation.x = Math.PI / 2;
  pizza.isVisible = false;

  const slot = {
    type: null,
    collected: false,
    setType(type, z = 0) {
      slot.type = type;
      slot.collected = false;
      coin.isVisible = type === PICKUP_TYPES.COIN;
      pizza.isVisible = type === PICKUP_TYPES.PIZZA;
      if (type === PICKUP_TYPES.COIN) coin.position.z = z;
      if (type === PICKUP_TYPES.PIZZA) pizza.position.z = z;
    },
    getHitPosition() {
      const mesh = slot.type === PICKUP_TYPES.PIZZA ? pizza : coin;
      const p = mesh.getAbsolutePosition();
      return { x: p.x, z: p.z };
    },
    collect() {
      slot.collected = true;
      coin.isVisible = false;
      pizza.isVisible = false;
    },
  };
  return slot;
}

// Lane + z-distance proximity check, same style as entities/collision.js but
// generous enough that pickups feel easy to grab rather than precise to
// dodge -- these reward the player, they don't end the run.
const HIT_RADIUS_Z = 0.9;
const LANE_HIT_RADIUS_X = 0.9;

export function checkPickupHit(player, pickupSlot) {
  if (!pickupSlot.type || pickupSlot.collected) return false;
  const pos = pickupSlot.getHitPosition();
  const dz = Math.abs(player.root.position.z - pos.z);
  if (dz > HIT_RADIUS_Z) return false;
  const dx = Math.abs(player.root.position.x - pos.x);
  return dx <= LANE_HIT_RADIUS_X;
}
