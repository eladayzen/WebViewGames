// Shared "lane obstacle" behavior (build doc §5.3, §6, §9.3, as amended by
// direct POC-playtest feedback): lane-blocking obstacles, one lane wide,
// dodged by lane-switching, and now jumpable too (see data/obstacleTypes.js).
// The original 3-lane-spanning jump-obstacle was dropped entirely per
// feedback (not tuned, removed) along with the jump mechanic it existed
// for; jump's return (entities/player.js) is unrelated to that old
// obstacle, driven instead by entities/platform.js's kill barriers and this
// file's jumpable types.
//
// data/obstacleTypes.js's 'low' type exists but is currently DISABLED
// (LOW_OBSTACLE_ENABLED) -- direct feedback, not needed for now.
// resolveRandomType below always falls back to 'medium' while that's off.
//
// Data-driven per type (data/obstacleTypes.js), mirroring entities/enemy.js's
// ENEMY_TYPES/spawnOfType pattern -- every pool slot's sprite is a plain
// unit-scaled sprite set at spawn time (never geometry-recreated), so any
// slot can spawn any type on a later respawn, not just the type it first
// spawned.
//
// Reuses this repo's established scrolling-obstacle-field pattern
// (CarRacer/src/traffic.js: pooled/recycled sprites, not created/disposed
// per spawn) rather than copying that file's car-racing specifics.

import * as THREE from 'three';
import { LANE_X, SPAWN_Z, DESPAWN_Z } from '../data/constants.js';
import { getTexture } from './textureLoader.js';
import { OBSTACLE_TYPES } from '../data/obstacleTypes.js';
import { LOW_OBSTACLE_ENABLED, LOW_OBSTACLE_SPAWN_CHANCE } from '../data/spawnConfig.js';
import { isRampZoneBlocked } from './platform.js';

// Sized with headroom above the theoretical concurrent-obstacle count
// ((DESPAWN_Z - SPAWN_Z) / FORWARD_SPEED / OBSTACLE_SPAWN_INTERVAL_SEC ~= 6
// at the current OBSTACLE_SPAWN_INTERVAL_SEC=1.6, data/spawnConfig.js) so a
// spawn is never silently dropped for lack of a free pooled slot. Bumped
// from 7 alongside that difficulty increase, same reasoning entities/
// enemy.js's own POOL_SIZE bump used.
const POOL_SIZE = 10;

function createSlot(scene) {
  const material = new THREE.SpriteMaterial({ transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.visible = false;
  scene.add(sprite);
  return {
    sprite,
    type: null,
    active: false,
    lane: 1,
    z: 0,
  };
}

export function createObstaclePool(scene) {
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) pool.push(createSlot(scene));
  return { pool };
}

export function resetObstaclePool(field) {
  for (const slot of field.pool) {
    slot.active = false;
    slot.sprite.visible = false;
  }
}

function spawnOfType(slot, lane, typeKey, z) {
  const type = OBSTACLE_TYPES[typeKey];

  slot.active = true;
  slot.type = type;
  slot.lane = lane;
  slot.z = z;

  // A recycled slot may have last been the OTHER kind (textured medium vs
  // color-only low placeholder) -- both `map` and `color` must be reset
  // every spawn, not just whichever this type actually uses, or a stale
  // tint/texture bleeds through from the slot's previous life. `needsUpdate`
  // is required specifically when `map` presence itself toggles (null <->
  // set), since SpriteMaterial compiles a different shader variant
  // depending on whether a map is bound.
  if (type.texture) {
    slot.sprite.material.map = getTexture(type.texture.url);
    slot.sprite.material.color.set(0xffffff);
  } else {
    slot.sprite.material.map = null;
    slot.sprite.material.color.set(type.color);
  }
  slot.sprite.material.needsUpdate = true;

  slot.sprite.scale.set(type.width, type.height, 1);
  slot.sprite.position.set(LANE_X[lane], type.height / 2, z);
  slot.sprite.visible = true;
}

function resolveRandomType() {
  if (!LOW_OBSTACLE_ENABLED) return 'medium';
  // Weighted, not uniform -- see data/spawnConfig.js's
  // LOW_OBSTACLE_SPAWN_CHANCE (a difficulty knob, not just variety).
  return Math.random() < LOW_OBSTACLE_SPAWN_CHANCE ? 'low' : 'medium';
}

// Picks a random lane among those NOT overlapping an active platform's ramp
// zone at this z (entities/platform.js's isRampZoneBlocked) -- null if
// every lane is currently blocked, telling the caller to skip this spawn
// attempt entirely rather than force an obstacle onto a ramp.
function resolveOpenLane(platformField, z) {
  const open = [];
  for (let lane = 0; lane < LANE_X.length; lane++) {
    if (!isRampZoneBlocked(platformField, lane, z)) open.push(lane);
  }
  if (open.length === 0) return null;
  return open[Math.floor(Math.random() * open.length)];
}

// Spawns exactly one obstacle in a random (ramp-clear) lane. `typeKey`
// forces a specific type (data/obstacleTypes.js); omitted, it picks
// randomly (weighted). `z` defaults to the far SPAWN_Z (normal gameplay
// spawning) but can be overridden -- data/introSequence.js's run-start
// ramp-up window needs obstacles to spawn closer than usual so they don't
// take their full ~9s travel time to arrive while the spawn pipeline is
// still empty. Silently skips (no free lane, or no free pool slot) rather
// than forcing a spawn -- the spawner's own timer just tries again next
// interval, same as data/spawnConfig.js's MIN_ENEMY_OBSTACLE_GAP_SEC skip.
export function spawnObstacle(field, platformField, typeKey = null, z = SPAWN_Z) {
  const slot = field.pool.find((s) => !s.active);
  if (!slot) return;
  const lane = resolveOpenLane(platformField, z);
  if (lane === null) return;
  const key = typeKey || resolveRandomType();
  spawnOfType(slot, lane, key, z);
}

export function updateObstaclePool(field, dt, speed) {
  for (const slot of field.pool) {
    if (!slot.active) continue;
    slot.z += speed * dt;
    slot.sprite.position.z = slot.z;

    if (slot.z > DESPAWN_Z) {
      slot.active = false;
      slot.sprite.visible = false;
    }
  }
}
