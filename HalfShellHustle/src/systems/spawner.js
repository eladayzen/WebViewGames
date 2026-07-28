// Fixed-interval spawn timing (build doc §2, §5.4: POC has one constant
// pace throughout, no difficulty ramp -- that's MVP-only). A short initial
// delay gives the player a moment to read the scene before the first
// obstacle, per §10 milestone 1's "confirm the look... before adding
// obstacles" build order.

import { OBSTACLE_FIRST_SPAWN_DELAY_SEC, OBSTACLE_SPAWN_INTERVAL_SEC } from '../data/spawnConfig.js';

// firstDelay/interval default to the obstacle spawner's own constants (every
// existing call site keeps working unchanged) but are overridable so a
// second spawner (entities/enemy.js's Foot Soldiers) can run on its own pace
// through this same timer, instead of a duplicated copy of this file.
export function createSpawnerState(firstDelay = OBSTACLE_FIRST_SPAWN_DELAY_SEC) {
  return { timer: firstDelay };
}

export function resetSpawner(state, firstDelay = OBSTACLE_FIRST_SPAWN_DELAY_SEC) {
  state.timer = firstDelay;
}

// Calls onSpawn() once per interval elapsed; returns nothing -- caller passes
// the actual spawnObstacle(field) call in.
export function updateSpawner(state, dt, onSpawn, interval = OBSTACLE_SPAWN_INTERVAL_SEC) {
  state.timer -= dt;
  if (state.timer <= 0) {
    state.timer += interval;
    onSpawn();
  }
}
