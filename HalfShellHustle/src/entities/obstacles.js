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
import { OBSTACLE_TYPES, LOW_OBSTACLE_ENABLED, LOW_OBSTACLE_SPAWN_CHANCE } from '../data/obstacleTypes.js';

// Sized with headroom above the theoretical concurrent-obstacle count
// ((DESPAWN_Z - SPAWN_Z) / FORWARD_SPEED / SPAWN_INTERVAL_SEC ~= 6 at the
// current SPAWN_INTERVAL_SEC=1.6) so a spawn is never silently dropped for
// lack of a free pooled slot. Bumped from 7 alongside the SPAWN_INTERVAL_SEC
// difficulty increase, same reasoning entities/enemy.js's own POOL_SIZE
// bump used.
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
  // Weighted, not uniform -- see data/obstacleTypes.js's
  // LOW_OBSTACLE_SPAWN_CHANCE (a difficulty knob, not just variety).
  return Math.random() < LOW_OBSTACLE_SPAWN_CHANCE ? 'low' : 'medium';
}

// Spawns exactly one obstacle in a random lane. `typeKey` forces a specific
// type (data/obstacleTypes.js); omitted, it picks randomly (weighted). `z`
// defaults to the far SPAWN_Z (normal gameplay spawning) but can be
// overridden -- data/introSequence.js's run-start ramp-up window needs
// obstacles to spawn closer than usual so they don't take their full ~9s
// travel time to arrive while the spawn pipeline is still empty.
export function spawnObstacle(field, typeKey = null, z = SPAWN_Z) {
  const slot = field.pool.find((s) => !s.active);
  if (!slot) return;
  const key = typeKey || resolveRandomType();
  const lane = Math.floor(Math.random() * LANE_X.length);
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
