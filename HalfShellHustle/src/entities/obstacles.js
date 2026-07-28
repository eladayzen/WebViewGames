// Shared "lane obstacle" behavior (build doc §5.3, §6, §9.3, as amended by
// direct POC-playtest feedback): only lane-blocking obstacles exist -- the
// barricade, one lane wide, dodged purely by lane-switching. The original
// 3-lane-spanning jump-obstacle was dropped entirely per feedback (not
// tuned, removed), along with the jump mechanic it existed for. Real Kolbo
// art (data/envArt.js's BARRICADE_TEXTURE, matching laneRunnerRef.png's
// orange/white A-frame design) replaces the original flat solid-color
// placeholder sprite.
//
// Reuses this repo's established scrolling-obstacle-field pattern
// (CarRacer/src/traffic.js: pooled/recycled sprites, not created/disposed
// per spawn) rather than copying that file's car-racing specifics.

import * as THREE from 'three';
import { LANE_X, LANE_WIDTH, SPAWN_Z, DESPAWN_Z } from '../data/constants.js';
import { getTexture } from './textureLoader.js';
import { BARRICADE_TEXTURE } from '../data/envArt.js';

// Sized with headroom above the theoretical concurrent-obstacle count
// ((DESPAWN_Z - SPAWN_Z) / FORWARD_SPEED / SPAWN_INTERVAL_SEC ~= 5) so a
// spawn is never silently dropped for lack of a free pooled slot.
const POOL_SIZE = 7;

const BARRICADE_WIDTH = LANE_WIDTH * 0.82;
// Height follows the art's own aspect ratio (not squashed to a fixed value)
// so the barricade doesn't distort.
const BARRICADE_HEIGHT = BARRICADE_WIDTH * BARRICADE_TEXTURE.aspect;
const BARRICADE_Y = BARRICADE_HEIGHT / 2;

function createSlot(scene) {
  const material = new THREE.SpriteMaterial({ map: getTexture(BARRICADE_TEXTURE.url), transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(BARRICADE_WIDTH, BARRICADE_HEIGHT, 1);
  sprite.visible = false;
  scene.add(sprite);
  return {
    sprite,
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

function spawnBarricade(slot, lane, z) {
  slot.active = true;
  slot.lane = lane;
  slot.z = z;
  slot.sprite.position.set(LANE_X[lane], BARRICADE_Y, z);
  slot.sprite.visible = true;
}

// Spawns exactly one barricade in a random lane. `z` defaults to the far
// SPAWN_Z (normal gameplay spawning) but can be overridden --
// data/introSequence.js's run-start ramp-up window needs obstacles to spawn
// closer than usual so they don't take their full ~9s travel time to
// arrive while the spawn pipeline is still empty.
export function spawnObstacle(field, z = SPAWN_Z) {
  const slot = field.pool.find((s) => !s.active);
  if (!slot) return;
  spawnBarricade(slot, Math.floor(Math.random() * LANE_X.length), z);
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
