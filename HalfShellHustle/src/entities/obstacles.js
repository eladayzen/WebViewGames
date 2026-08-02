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
import { getShadowTexture } from './contactShadow.js';
import { OBSTACLE_TYPES } from '../data/obstacleTypes.js';
import { LOW_OBSTACLE_ENABLED, LOW_OBSTACLE_SPAWN_CHANCE } from '../data/spawnConfig.js';
import { findOpenLane } from './platform.js';

// Sized with headroom above the theoretical concurrent-obstacle count. That
// count is set by how long an entity LIVES -- (DESPAWN_Z - SPAWN_Z) / speed --
// so the SLOWER end of the speed ramp is the sizing case, not the faster end:
// at SPEED_START a slot is occupied ~14.1s instead of ~10.6s at SPEED_MAX,
// which is ~8.8 concurrent at OBSTACLE_SPAWN_INTERVAL_SEC=1.6, plus the
// data/introSequence.js seeds still in flight early on. 10 -> 14 restores the
// ~1.6x headroom the pre-ramp value had; without it a spawn gets silently
// dropped for lack of a free slot.
const POOL_SIZE = 14;

function createSlot(scene) {
  const material = new THREE.SpriteMaterial({ transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.visible = false;
  scene.add(sprite);

  // Contact shadow, built exactly like entities/enemy.js's: a unit (1x1) plane
  // whose real size is applied via mesh.scale at spawn time, so a recycled slot
  // can size its shadow for a different type without recreating geometry. Same
  // shared texture as the player's and the enemies' (contactShadow.js), so
  // every grounded thing in the game casts the same style of shadow.
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: getShadowTexture(), transparent: true, depthWrite: false, fog: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015; // just above the street plane, matches contactShadow.js
  shadow.visible = false;
  scene.add(shadow);

  return {
    sprite,
    shadow,
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
    slot.shadow.visible = false;
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

  // No elevation term anywhere in this file, unlike enemy.js's: spawnObstacle
  // picks its lane via findOpenLane, which refuses any lane with a platform
  // footprint, so an obstacle is ALWAYS at street level. If that ever changes,
  // this and the sprite's y both need platform.js's elevation the way
  // updateEnemyPool does it.
  slot.shadow.scale.set(type.shadowWidth, type.shadowDepth, 1);
  slot.shadow.position.set(LANE_X[lane], slot.shadow.position.y, z);
  slot.shadow.visible = true;
}

function resolveRandomType() {
  if (!LOW_OBSTACLE_ENABLED) return 'medium';
  // Weighted, not uniform -- see data/spawnConfig.js's
  // LOW_OBSTACLE_SPAWN_CHANCE (a difficulty knob, not just variety).
  return Math.random() < LOW_OBSTACLE_SPAWN_CHANCE ? 'low' : 'medium';
}

// Spawns exactly one obstacle in a random (footprint-clear) lane. `typeKey`
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
  const lane = findOpenLane(platformField, z);
  if (lane === null) return;
  const key = typeKey || resolveRandomType();
  spawnOfType(slot, lane, key, z);
}

export function updateObstaclePool(field, dt, speed) {
  for (const slot of field.pool) {
    if (!slot.active) continue;
    slot.z += speed * dt;
    slot.sprite.position.z = slot.z;
    slot.shadow.position.z = slot.z;

    if (slot.z > DESPAWN_Z) {
      slot.active = false;
      slot.sprite.visible = false;
      slot.shadow.visible = false;
    }
  }
}
