import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { createObstacleSlot } from '../entities/obstacles';
import { createPickupSlot, SLOTS_PER_LANE } from '../entities/pickups';
import { createChunkDressing } from './cityDressing';
import { LANE_X } from './lanes';
import { CHUNK_LENGTH_UNITS, BREATHER_TEMPLATE, pickTemplate } from '../data/chunks';

// Object-pooled chunks per GDD §9.2: a fixed pool of TransformNodes is
// created once; recycling repositions a chunk to the back of the queue and
// re-populates its pre-instanced obstacle/pickup slots from a new template,
// rather than creating/disposing meshes at runtime (WebView memory
// constraint).
const POOL_SIZE = 8;
const RECYCLE_MARGIN = 6; // world units behind the player before a chunk recycles
const SAFE_STARTING_CHUNKS = 2; // guaranteed obstacle-free runway after boot/reset

// The first couple of chunks are always clear of obstacles, both at boot and
// on restart -- otherwise a random template can drop an obstacle right on
// top of the player's spawn point with no reaction time.
function templateForIndex(i) {
  return i < SAFE_STARTING_CHUNKS ? BREATHER_TEMPLATE : pickTemplate();
}

function applyTemplate(chunk, template) {
  chunk.slots.forEach((slot) => slot.setType(null));
  template.obstacles.forEach(({ lane, type, z }) => {
    chunk.slots[lane].setType(type, z);
  });

  chunk.pickupsByLane.forEach((laneSlots) => laneSlots.forEach((slot) => slot.setType(null)));
  const laneCursor = [0, 0, 0];
  template.pickups.forEach(({ lane, type, z }) => {
    const idx = laneCursor[lane];
    if (idx >= SLOTS_PER_LANE) return; // template exceeds the per-lane slot cap, drop silently
    chunk.pickupsByLane[lane][idx].setType(type, z);
    laneCursor[lane] += 1;
  });

  chunk.dressing.reroll();
}

export function createChunkPool(scene) {
  const chunks = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const root = new TransformNode(`chunk_${i}`, scene);
    root.position.z = i * CHUNK_LENGTH_UNITS;
    const slots = LANE_X.map((x) => createObstacleSlot(scene, root, x));
    const pickupsByLane = LANE_X.map((x) =>
      Array.from({ length: SLOTS_PER_LANE }, () => createPickupSlot(scene, root, x))
    );
    const dressing = createChunkDressing(scene, root);
    const chunk = { root, slots, pickupsByLane, dressing };
    applyTemplate(chunk, templateForIndex(i));
    chunks.push(chunk);
  }
  return { chunks, nextZ: POOL_SIZE * CHUNK_LENGTH_UNITS };
}

export function updateChunkPool(pool, playerZ) {
  for (const chunk of pool.chunks) {
    const chunkEndZ = chunk.root.position.z + CHUNK_LENGTH_UNITS;
    if (chunkEndZ < playerZ - RECYCLE_MARGIN) {
      chunk.root.position.z = pool.nextZ;
      pool.nextZ += CHUNK_LENGTH_UNITS;
      applyTemplate(chunk, pickTemplate());
    }
  }
}

export function resetChunkPool(pool) {
  pool.chunks.forEach((chunk, i) => {
    chunk.root.position.z = i * CHUNK_LENGTH_UNITS;
    applyTemplate(chunk, templateForIndex(i));
  });
  pool.nextZ = pool.chunks.length * CHUNK_LENGTH_UNITS;
}

export function getActiveObstacleSlots(pool) {
  return pool.chunks.flatMap((c) => c.slots);
}

export function getActivePickupSlots(pool) {
  return pool.chunks.flatMap((c) => c.pickupsByLane.flat());
}
