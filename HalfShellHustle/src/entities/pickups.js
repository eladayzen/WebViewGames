// Ability pickups (magnet, extra life) -- the falling-into-the-world half of
// two abilities that already worked but had nothing to grant them:
// entities/player.js's grantMagnet and systems/lives.js's gainLife. See
// data/pickupTypes.js for the type table and the icon art.
//
// Structurally the simplest entity in the game: a pool of billboard sprites
// that scroll toward the player and are collected on lane + z + reach overlap,
// exactly like entities/coins.js -- but ONE at a time rather than in clusters,
// because that's what makes a pickup an event. Everything else here follows
// coins.js's proven shape:
//
//   - slot.baseHeight is a height above WHATEVER SURFACE IS UNDER IT, re-queried
//     live every frame, so one number works on street, deck, and ramp slope.
//   - collection is a body-SPAN overlap, not a point test.
//   - placement refuses lanes with a nearby obstacle or an active platform
//     footprint (the "nothing on ramps" rule).
//
// WHAT IT DELIBERATELY DOESN'T DO: react to the magnet. Direct feedback scoped
// that ability to "only the gold coins", and a magnet that hoovered up the next
// magnet would be self-feeding. So pickups carry no magnetPull and
// entities/coins.js's applyMagnetPull never sees this pool.

import * as THREE from 'three';
import {
  LANE_X, SPAWN_Z, DESPAWN_Z, PLAYER_Z,
} from '../data/constants.js';
import { PLATFORM_HEIGHT } from '../data/platformSequence.js';
import { PICKUP_TYPES } from '../data/pickupTypes.js';
import { getTexture } from './textureLoader.js';
import { getWorldElevationAt, isPlatformFootprintBlocked } from './platform.js';
import { PLAYER_COLLECT_REACH } from './player.js';
import {
  PICKUP_POOL_SIZE, PICKUP_BASE_HEIGHT, PICKUP_REACH_GRACE,
  PICKUP_OBSTACLE_CLEARANCE, PICKUP_PULSE_PERIOD, PICKUP_PULSE_SCALE_AMPLITUDE,
  PICKUP_ROCK_RADIANS,
} from '../data/spawnConfig.js';

// Own copy rather than the shared OBSTACLE_COLLISION_HALF_Z, matching the
// per-file collision-constant convention entities/collision.js, enemy.js and
// coins.js all follow. Slightly wider than a coin's 1.1: a pickup is rare
// enough that a near-miss on the z window would feel like a bug.
const PICKUP_COLLECT_HALF_Z = 1.4;
// Same value/semantics as the copies in collision.js / enemy.js / coins.js --
// "is the player standing on the same surface as this thing".
const ELEVATION_MATCH_THRESHOLD = 0.3;

// fog: false and depthWrite: false for the same reasons coins.js documents (a
// pickup must stay legible arriving from a distance, and it's a soft
// transparent sprite), but depthTest stays ON so one behind a platform's solid
// deck box is correctly hidden by it.
function createSlot(scene) {
  const material = new THREE.SpriteMaterial({
    transparent: true, depthWrite: false, fog: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.visible = false;
  scene.add(sprite);
  return {
    sprite,
    type: null,
    typeKey: null,
    active: false,
    lane: 1,
    z: 0,
    baseHeight: PICKUP_BASE_HEIGHT,
    pulseTimer: 0,
  };
}

export function createPickupPool(scene) {
  const pool = [];
  for (let i = 0; i < PICKUP_POOL_SIZE; i++) pool.push(createSlot(scene));
  return { pool };
}

export function resetPickupPool(field) {
  for (const slot of field.pool) {
    slot.active = false;
    slot.sprite.visible = false;
  }
}

export function despawnPickup(slot) {
  slot.active = false;
  slot.sprite.visible = false;
}

// Would a pickup here bait the player into an obstacle? Identical reasoning to
// entities/coins.js's own obstacle clearance -- and it matters MORE here, since
// a rare pickup is a far stronger lane magnet than a coin row.
function hasObstacleNear(obstacleField, lane, z) {
  for (const slot of obstacleField.pool) {
    if (!slot.active || slot.lane !== lane) continue;
    if (Math.abs(slot.z - z) <= PICKUP_OBSTACLE_CLEARANCE) return true;
  }
  return false;
}

// A lane that can host a pickup at this z, or null. Shuffled enumeration (not
// a single random pick) so a blocked lane retries the others instead of
// silently dropping the spawn -- same approach as coins.js's pickClusterLane.
function pickLane(platformField, obstacleField, z) {
  const lanes = [];
  for (let i = 0; i < LANE_X.length; i++) lanes.push(i);
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  for (const lane of lanes) {
    if (hasObstacleNear(obstacleField, lane, z)) continue;
    // Keeps pickups off ramps and off the deck's approach entirely -- the
    // locked-in "nothing is ever placed on a ramp" rule.
    if (isPlatformFootprintBlocked(platformField, lane, z)) continue;
    return lane;
  }
  return null;
}

// Spawns one pickup of the given type, or nothing if the pool is full or no
// lane works. Silent no-op on failure, like every other spawner here -- the
// caller's interval timer just tries again.
export function spawnPickup(field, platformField, obstacleField, typeKey, z = SPAWN_Z) {
  const slot = field.pool.find((s) => !s.active);
  if (!slot) return;
  const lane = pickLane(platformField, obstacleField, z);
  if (lane === null) return;

  const type = PICKUP_TYPES[typeKey];
  slot.active = true;
  slot.type = type;
  slot.typeKey = typeKey;
  slot.lane = lane;
  slot.z = z;
  slot.baseHeight = PICKUP_BASE_HEIGHT;
  slot.pulseTimer = 0;
  // Untinted: material.color MULTIPLIES the texture, so leaving it white is
  // what keeps the painted art's own colours intact. Swapping the map is the
  // whole type change.
  slot.sprite.material.map = getTexture(type.texture.url);
  slot.sprite.material.needsUpdate = true;
  slot.sprite.material.rotation = 0;
  slot.sprite.scale.set(type.width, type.width * type.texture.aspect, 1);
  slot.sprite.position.set(LANE_X[lane], PICKUP_BASE_HEIGHT, z);
  slot.sprite.visible = true;
}

export function updatePickupPool(field, dt, speed, platformField) {
  for (const slot of field.pool) {
    if (!slot.active) continue;
    slot.z += speed * dt;
    if (slot.z > DESPAWN_Z) {
      despawnPickup(slot);
      continue;
    }
    slot.sprite.position.z = slot.z;
    // The live surface re-query that makes one baseHeight work on street, deck
    // and ramp slope alike (see coins.js's header for the full reasoning).
    slot.sprite.position.y = getWorldElevationAt(platformField, slot.lane, slot.z) * PLATFORM_HEIGHT
      + slot.baseHeight;

    // Cosmetic only, never fed into collectPickups below -- the same swell/
    // separation coins.js and enemy.js both keep. A pickup pulses HARDER than a
    // coin (and bobs) because it has to win attention against a screen that may
    // already have a five-coin row on it.
    slot.pulseTimer = (slot.pulseTimer + dt) % PICKUP_PULSE_PERIOD;
    const swell = 0.5 * (1 - Math.cos((2 * Math.PI * slot.pulseTimer) / PICKUP_PULSE_PERIOD));
    const w = slot.type.width * (1 + PICKUP_PULSE_SCALE_AMPLITUDE * swell);
    slot.sprite.scale.set(w, w * slot.type.texture.aspect, 1);
    // Rocks around upright rather than rolling continuously -- these icons have
    // an obvious "up" now that they're real art (see PICKUP_ROCK_RADIANS).
    // Driven off the same phase as the swell, a quarter-cycle out, so the tilt
    // peaks as the scale passes through its middle instead of both hitting at
    // once.
    slot.sprite.material.rotation = PICKUP_ROCK_RADIANS
      * Math.sin((2 * Math.PI * slot.pulseTimer) / PICKUP_PULSE_PERIOD);
  }
}

// Every pickup the player is touching this frame. Returns an array for the same
// reason coins.js does (two could theoretically be inside the window at once);
// does NOT deactivate them, so the caller can read type/position for VFX before
// calling despawnPickup -- mirroring the checkEnemyHit/killEnemy split.
//
// The two tests are coins.js's, unchanged: same surface, and within the
// player's vertical body span. No magnet bypass -- see this file's header.
export function collectPickups(player, field, platformField) {
  const collected = [];
  const surfaceY = getWorldElevationAt(platformField, player.laneIndex, PLAYER_Z) * PLATFORM_HEIGHT;
  if (Math.abs(player.elevationY - surfaceY) >= ELEVATION_MATCH_THRESHOLD) return collected;

  const reachLow = player.airHeight - PICKUP_REACH_GRACE;
  const reachHigh = player.airHeight + PLAYER_COLLECT_REACH + PICKUP_REACH_GRACE;
  for (const slot of field.pool) {
    if (!slot.active) continue;
    if (Math.abs(slot.z - PLAYER_Z) > PICKUP_COLLECT_HALF_Z) continue;
    if (slot.lane !== player.laneIndex) continue;
    if (slot.baseHeight < reachLow || slot.baseHeight > reachHigh) continue;
    collected.push(slot);
  }
  return collected;
}
