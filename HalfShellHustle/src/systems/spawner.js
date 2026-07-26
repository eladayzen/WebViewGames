// Fixed-interval spawn timing (build doc §2, §5.4: POC has one constant
// pace throughout, no difficulty ramp -- that's MVP-only). A short initial
// delay gives the player a moment to read the scene before the first
// obstacle, per §10 milestone 1's "confirm the look... before adding
// obstacles" build order.

import { FIRST_SPAWN_DELAY_SEC, SPAWN_INTERVAL_SEC } from '../data/constants.js';

export function createSpawnerState() {
  return { timer: FIRST_SPAWN_DELAY_SEC };
}

export function resetSpawner(state) {
  state.timer = FIRST_SPAWN_DELAY_SEC;
}

// Calls onSpawn() once per interval elapsed; returns nothing -- caller passes
// the actual spawnObstacle(field) call in.
export function updateSpawner(state, dt, onSpawn) {
  state.timer -= dt;
  if (state.timer <= 0) {
    state.timer += SPAWN_INTERVAL_SEC;
    onSpawn();
  }
}
