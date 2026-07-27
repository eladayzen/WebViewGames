// Foot Soldier "bump-to-kill" enemy -- a new entity type (direct feedback's
// addition; not in the original build doc, pipeline/build-docs/
// HalfShellHustle.md). Unlike a lane-blocker obstacle (dodge it or the run
// ends), this is a TARGET: it stands still in its lane while the street
// scrolls it toward the camera exactly like an obstacle (same spawn/scroll/
// recycle shape as entities/obstacles.js's shared "lane obstacle" pattern),
// but on player lane+z overlap it's removed and dissolves into a particle
// poof (systems/vfx.js) instead of ending the run, and awards score.
//
// First pass, deliberately minimal: single combat-stance sprite frame (art
// v2 -- purple-accented armor, gripping a spiked club), no player-side
// auto-attack/swirl animation yet -- getting spawn/scroll/collide/dissolve/
// score working end-to-end comes first, that's explicit deferred follow-up.
// A ground shadow and a procedural idle breathing pulse ARE in this pass.

import * as THREE from 'three';
import {
  LANE_X, SPAWN_Z, DESPAWN_Z, OBSTACLE_COLLISION_HALF_Z, PLAYER_Z,
} from '../data/constants.js';
import { getTexture } from './textureLoader.js';
import { FOOT_SOLDIER_TEXTURE } from '../data/envArt.js';
import { getShadowTexture, PLAYER_SHADOW_WIDTH, PLAYER_SHADOW_DEPTH } from './contactShadow.js';

const POOL_SIZE = 5;

// The v2 combat-stance art (wide-legged, club raised to one side) has a very
// different bounding-box aspect than a plain standing pose, so this is sized
// by a fixed HEIGHT (roughly the player's own scale) with width following
// the art's own aspect ratio, rather than the barricade's width-first
// convention -- width-first would read as squat/tiny for this pose's tall
// narrow-ish torso plus wide stance.
const ENEMY_HEIGHT = 2.3;
const ENEMY_WIDTH = ENEMY_HEIGHT / FOOT_SOLDIER_TEXTURE.aspect;
const ENEMY_Y = ENEMY_HEIGHT / 2;

// Ground shadow -- 10% bigger than the player's own contact shadow, per
// direct feedback. Static (no jump/pulse behavior -- these enemies never
// leave the ground), just tracks the sprite's x/z every frame.
const SHADOW_SCALE = 1.1;
const SHADOW_WIDTH = PLAYER_SHADOW_WIDTH * SHADOW_SCALE;
const SHADOW_DEPTH = PLAYER_SHADOW_DEPTH * SHADOW_SCALE;

// Procedural idle "breathing" -- a slow, eased Y-axis-only scale pulse (NOT
// baked into the art, and not a sprite-swap animation): 1.5s to swell from
// scale 1 to 1.04, 1.5s back down, looping. A plain cosine wave is already
// eased in/out at both extremes (zero rate of change at the top and bottom
// of the curve) so it needs no separate easing curve on top. Compensates
// sprite.position.y by half the height delta so the swell grows from his
// feet/the ground plane, not from his sprite's center pivot.
const BREATHE_PERIOD = 3.0; // seconds, one full swell-and-settle cycle
const BREATHE_AMPLITUDE = 0.04;

function createSlot(scene) {
  const material = new THREE.SpriteMaterial({ map: getTexture(FOOT_SOLDIER_TEXTURE.url), transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(ENEMY_WIDTH, ENEMY_HEIGHT, 1);
  sprite.visible = false;
  scene.add(sprite);

  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: getShadowTexture(), transparent: true, depthWrite: false, fog: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(SHADOW_WIDTH, SHADOW_DEPTH), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015; // just above the street plane, matches contactShadow.js
  shadow.visible = false;
  scene.add(shadow);

  return {
    sprite,
    shadow,
    active: false,
    lane: 1,
    z: 0,
    breatheTimer: 0,
  };
}

export function createEnemyPool(scene) {
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) pool.push(createSlot(scene));
  return { pool };
}

export function resetEnemyPool(field) {
  for (const slot of field.pool) {
    slot.active = false;
    slot.sprite.visible = false;
    slot.shadow.visible = false;
  }
}

function spawnFootSoldier(slot, lane) {
  slot.active = true;
  slot.lane = lane;
  slot.z = SPAWN_Z;
  // Randomized phase so a pool's worth of enemies don't all breathe in
  // lockstep -- reads as more alive than a uniform pulse.
  slot.breatheTimer = Math.random() * BREATHE_PERIOD;
  slot.sprite.position.set(LANE_X[lane], ENEMY_Y, SPAWN_Z);
  slot.sprite.visible = true;
  slot.shadow.position.set(LANE_X[lane], slot.shadow.position.y, SPAWN_Z);
  slot.shadow.visible = true;
}

// Spawns exactly one Foot Soldier in a random lane.
export function spawnEnemy(field) {
  const slot = field.pool.find((s) => !s.active);
  if (!slot) return;
  spawnFootSoldier(slot, Math.floor(Math.random() * LANE_X.length));
}

export function updateEnemyPool(field, dt, speed) {
  for (const slot of field.pool) {
    if (!slot.active) continue;
    slot.z += speed * dt;
    slot.sprite.position.z = slot.z;
    slot.shadow.position.z = slot.z;

    if (slot.z > DESPAWN_Z) {
      slot.active = false;
      slot.sprite.visible = false;
      slot.shadow.visible = false;
      continue;
    }

    slot.breatheTimer = (slot.breatheTimer + dt) % BREATHE_PERIOD;
    const swell = 0.5 * (1 - Math.cos((2 * Math.PI * slot.breatheTimer) / BREATHE_PERIOD)); // 0 -> 1 -> 0, eased
    const scaleY = 1 + BREATHE_AMPLITUDE * swell;
    slot.sprite.scale.y = ENEMY_HEIGHT * scaleY;
    slot.sprite.position.y = ENEMY_Y + (scaleY - 1) * ENEMY_HEIGHT * 0.5;
  }
}

// Same lane-index + z-distance overlap shape as entities/collision.js's
// checkObstacleHit, but returns the hit SLOT (not a boolean) so the caller
// can read its position for the dissolve VFX before deactivating it.
export function checkEnemyHit(player, field) {
  for (const slot of field.pool) {
    if (!slot.active) continue;
    if (Math.abs(slot.z - PLAYER_Z) > OBSTACLE_COLLISION_HALF_Z) continue;
    if (slot.lane === player.laneIndex) return slot;
  }
  return null;
}

export function killEnemy(slot) {
  slot.active = false;
  slot.sprite.visible = false;
  slot.shadow.visible = false;
}
