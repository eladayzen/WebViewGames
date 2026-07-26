// Pipe-section-driven wave spawner (§5.5, §5.6, §9.3 "systems" layer): owns
// *when/where* obstacles and pickups appear; entities/obstacles.js and
// entities/pickups.js own the pooled mechanics themselves. A wave always
// reserves one genuinely reachable gap before placing anything else --
// "never a wave that spans the entire valid theta range with no dodge
// available" (§5.5) -- and a pizza pickup, when one spawns, lands in that
// same reserved gap (so it never overlaps an obstacle's tolerance window,
// §5.6, trivially).

import { CROSS_SECTIONS } from '../tunnel/crossSection.js';
import { spawnObstacle, deactivateAllObstacles } from '../entities/obstacles.js';
import { spawnPickup, deactivateAllPickups } from '../entities/pickups.js';
import { SPAWN_START_Z } from '../data/constants.js';

// Angular width of the guaranteed dodge gap -- comfortably larger than any
// single obstacle type's combined tolerance diameter (widest is the girder
// at ~0.57 rad) plus reaction margin.
const GUARANTEED_GAP_RAD = 0.65;
const MIN_OBSTACLE_SEPARATION_RAD = 0.5;
const ARC_EDGE_MARGIN_FRAC = 0.06;
const PICKUP_Z_OFFSET = -2.2; // pizza drifts in slightly behind its wave's obstacles

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function spawnWave(obstaclePool, pickupPool, sectionParams, z) {
  const range = CROSS_SECTIONS[sectionParams.crossSection];
  const width = range.max - range.min;
  const margin = width * ARC_EDGE_MARGIN_FRAC;
  const usableMin = range.min + margin;
  const usableMax = range.max - margin;
  const usableWidth = usableMax - usableMin;

  const gapHalf = Math.min(GUARANTEED_GAP_RAD, usableWidth * 0.7) / 2;
  const gapCenter = usableMin + gapHalf + Math.random() * Math.max(0.001, usableWidth - gapHalf * 2);

  const segments = [
    { min: usableMin, max: gapCenter - gapHalf },
    { min: gapCenter + gapHalf, max: usableMax },
  ].filter((s) => s.max - s.min > 0.08);

  const n = segments.length === 0 ? 0 : pickOne(sectionParams.obstaclesPerWave);
  const thetas = [];
  for (let i = 0; i < n; i++) {
    const seg = pickOne(segments);
    let theta;
    let tries = 0;
    do {
      theta = seg.min + Math.random() * (seg.max - seg.min);
      tries += 1;
    } while (thetas.some((t) => Math.abs(t - theta) < MIN_OBSTACLE_SEPARATION_RAD) && tries < 6);
    thetas.push(theta);
  }

  for (const theta of thetas) {
    const typeKey = pickOne(sectionParams.obstacleTypes);
    spawnObstacle(obstaclePool, typeKey, theta, z);
  }

  if (Math.random() < sectionParams.pickupChance) {
    spawnPickup(pickupPool, 'pizza', gapCenter, z + PICKUP_Z_OFFSET);
  }
}

export function createSpawnerState() {
  return { distanceSinceLastWave: 0 };
}

export function resetSpawner(state, obstaclePool, pickupPool, sectionParams) {
  deactivateAllObstacles(obstaclePool);
  deactivateAllPickups(pickupPool);
  state.distanceSinceLastWave = 0;
  // Pre-seed a few waves ahead so the tunnel doesn't read as an empty
  // runway for the first several seconds of a run.
  const preSeedCount = 3;
  for (let i = 0; i < preSeedCount; i++) {
    spawnWave(obstaclePool, pickupPool, sectionParams, SPAWN_START_Z - i * sectionParams.obstacleSpacing);
  }
}

export function updateSpawner(state, obstaclePool, pickupPool, sectionParams, zDelta) {
  state.distanceSinceLastWave += zDelta;
  if (state.distanceSinceLastWave >= sectionParams.obstacleSpacing) {
    state.distanceSinceLastWave -= sectionParams.obstacleSpacing;
    spawnWave(obstaclePool, pickupPool, sectionParams, SPAWN_START_Z);
  }
}
