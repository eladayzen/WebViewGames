// Foot Soldier "bump-to-kill" enemy -- a new entity type (direct feedback's
// addition; not in the original build doc, pipeline/build-docs/
// HalfShellHustle.md). Unlike a lane-blocker obstacle (dodge it or the run
// ends), this is a TARGET: it stands still in its lane while the street
// scrolls it toward the camera exactly like an obstacle (same spawn/scroll/
// recycle shape as entities/obstacles.js's shared "lane obstacle" pattern),
// but on player lane+z overlap it's removed and dissolves into a particle
// poof (systems/vfx.js) instead of ending the run, and awards score.
//
// Data-driven per type (data/enemyTypes.js), not hardcoded here -- size,
// shadow dimensions, breathing amplitude/period, and poof color all come
// from the spawned slot's resolved type config, since more enemy types
// (different weapon, different scale, bigger monsters) are coming and each
// needs its own numbers. Every pool slot's sprite/shadow is a plain unit
// quad scaled at spawn time (never geometry-recreated), so any slot can
// spawn any type on a later respawn, not just the type it first spawned.
//
// Elevation-aware (entities/platform.js's per-lane height system, mirroring
// entities/player.js's own elevationY pattern): an enemy can now genuinely
// stand on top of a platform's deck (entities/platform.js's
// findDeckPlacements, wired in below), riding its elevation live every
// frame -- direct feedback: they used to always render/collide at street
// level regardless of any platform nearby.

import * as THREE from 'three';
import {
  LANE_X, SPAWN_Z, DESPAWN_Z, OBSTACLE_COLLISION_HALF_Z, PLAYER_Z,
} from '../data/constants.js';
import { getTexture } from './textureLoader.js';
import { getShadowTexture } from './contactShadow.js';
import { ENEMY_TYPES } from '../data/enemyTypes.js';
import {
  findOpenLane, findDeckPlacements, getWorldElevationAt,
} from './platform.js';
import { PLATFORM_HEIGHT } from '../data/platformSequence.js';
import { ENEMY_ON_PLATFORM_CHANCE } from '../data/spawnConfig.js';

// TEMPORARY demo bump (direct feedback: "twice as much enemies", plus
// data/introSequence.js's 3-wide wall needs at least LANE_X.length free
// slots at once on top of whatever's already scrolling) -- normal value
// was 5, doubled to 10, then 14 for the speed ramp.
//
// 14, not 10, because the ramp's slower start keeps every slot occupied
// ~14.1s instead of ~9.5s -- ~7.1 concurrent at a 2.0s interval, and the peak
// is worse than the average: around t=1-2.5s the 3 intro-wall enemies haven't
// cleared yet while all the seeded ones are already in flight, which was 9 of
// the old 10 slots.
const POOL_SIZE = 14;

// Same threshold entities/collision.js's checkObstacleHit uses for the
// player-vs-obstacle case, kept as its own local constant here rather than
// shared across files (matches that file's existing convention).
const ELEVATION_MATCH_THRESHOLD = 0.3;

function createSlot(scene) {
  const material = new THREE.SpriteMaterial({ transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.visible = false;
  scene.add(sprite);

  // Unit (1x1) plane, actual size applied via mesh.scale at spawn time
  // (matches the sprite's own unit-quad-scaled-by-`scale` convention) so a
  // respawned slot can size its shadow differently per type without
  // recreating geometry.
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
    breatheTimer: 0,
    elevationY: 0, // current entities/platform.js height offset -- 0 at street level, see updateEnemyPool
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

function spawnOfType(slot, lane, typeKey, z) {
  const type = ENEMY_TYPES[typeKey];
  const width = type.height / type.texture.aspect;

  slot.active = true;
  slot.type = type;
  slot.lane = lane;
  slot.z = z;
  slot.elevationY = 0; // recomputed for real on this same frame's updateEnemyPool pass
  // Randomized phase so a pool's worth of enemies don't all breathe in
  // lockstep -- reads as more alive than a uniform pulse.
  slot.breatheTimer = Math.random() * type.breathePeriod;

  slot.sprite.material.map = getTexture(type.texture.url);
  slot.sprite.scale.set(width, type.height, 1);
  slot.sprite.position.set(LANE_X[lane], type.height / 2, z);
  slot.sprite.visible = true;

  slot.shadow.scale.set(type.shadowWidth, type.shadowDepth, 1);
  slot.shadow.position.set(LANE_X[lane], slot.shadow.position.y, z);
  slot.shadow.visible = true;
}

const ENEMY_TYPE_KEYS = Object.keys(ENEMY_TYPES);

// Spawns one enemy. `typeKey` forces a specific type (data/enemyTypes.js);
// omitted, it picks randomly among all of them -- direct feedback: seeing
// the weapon/stance/color variety is the point, not always the same type.
// `z` defaults to SPAWN_Z (normal gameplay spawning) but can be overridden.
//
// `lane` defaults to null, the normal random-pick path: first rolls
// entities/platform.js's findDeckPlacements (direct feedback: enemies
// should sometimes actually stand on a platform deck) -- if any platform
// currently offers one AND the ENEMY_ON_PLATFORM_CHANCE roll succeeds, the
// enemy spawns THERE instead (both lane and z overridden to the deck's own
// position, claiming that platform so at most one enemy ever lands on it).
// Otherwise falls back to the normal footprint-clear random lane at the
// caller's own z (entities/platform.js's findOpenLane), skipping the spawn
// entirely if every lane is currently blocked.
//
// An explicit `lane` bypasses ALL of the above -- data/introSequence.js's
// start-of-run wall needs one enemy in EVERY lane at the same close z
// regardless of any platform (there's never one active that early anyway).
export function spawnEnemy(field, platformField, typeKey = null, lane = null, z = SPAWN_Z) {
  const slot = field.pool.find((s) => !s.active);
  if (!slot) return;

  let resolvedLane = lane;
  let resolvedZ = z;
  if (lane === null) {
    const deckCandidates = findDeckPlacements(platformField);
    const onDeck = deckCandidates.length > 0 && Math.random() < ENEMY_ON_PLATFORM_CHANCE
      ? deckCandidates[Math.floor(Math.random() * deckCandidates.length)]
      : null;
    if (onDeck) {
      onDeck.claim();
      resolvedLane = onDeck.lane;
      resolvedZ = onDeck.z;
    } else {
      resolvedLane = findOpenLane(platformField, z);
      if (resolvedLane === null) return;
    }
  }

  const key = typeKey || ENEMY_TYPE_KEYS[Math.floor(Math.random() * ENEMY_TYPE_KEYS.length)];
  spawnOfType(slot, resolvedLane, key, resolvedZ);
}

export function updateEnemyPool(field, dt, speed, platformField) {
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

    // Rides entities/platform.js's elevation live every frame, same
    // pattern as entities/player.js's own elevationY -- correct whether
    // this slot ended up on a deck deliberately (spawnEnemy's
    // findDeckPlacements branch) or just happens to be street-level (0
    // there, a no-op).
    slot.elevationY = getWorldElevationAt(platformField, slot.lane, slot.z) * PLATFORM_HEIGHT;

    const { type } = slot;
    const baseHeight = type.height;
    slot.breatheTimer = (slot.breatheTimer + dt) % type.breathePeriod;
    // 0 -> 1 -> 0 over the period, eased at both ends for free (a cosine's
    // rate of change is zero at its peak/trough) -- no separate easing
    // curve needed on top.
    const swell = 0.5 * (1 - Math.cos((2 * Math.PI * slot.breatheTimer) / type.breathePeriod));
    const scaleY = 1 + type.breatheAmplitude * swell;
    slot.sprite.scale.y = baseHeight * scaleY;
    // Compensates position.y by half the height delta so the swell grows
    // from his feet/the ground plane (pivots at the legs), not from the
    // sprite's center anchor -- otherwise scaling up would sink his feet
    // below the street by half the growth amount. elevationY is a separate
    // additive world-space offset on top (platform.js's deck height, or 0
    // at street level) -- orthogonal to the swell/pivot math.
    slot.sprite.position.y = baseHeight / 2 + (scaleY - 1) * baseHeight * 0.5 + slot.elevationY;
    slot.shadow.position.y = 0.015 + slot.elevationY;
  }
}

// Same lane-index + z-distance overlap shape as entities/collision.js's
// checkObstacleHit, but elevation-COMPARED against this specific enemy's
// own elevationY rather than assuming it's always at street level (direct
// feedback: enemies can now stand on a platform deck) -- close enough in
// elevation to actually be touching it, not just "player is elevated at
// all." Returns the hit SLOT (not a boolean) so the caller can read its
// position/type for the dissolve VFX before deactivating it.
export function checkEnemyHit(player, field) {
  for (const slot of field.pool) {
    if (!slot.active) continue;
    if (Math.abs(slot.z - PLAYER_Z) > OBSTACLE_COLLISION_HALF_Z) continue;
    if (slot.lane !== player.laneIndex) continue;
    if (Math.abs(player.elevationY - slot.elevationY) >= ELEVATION_MATCH_THRESHOLD) continue;
    return slot;
  }
  return null;
}

export function killEnemy(slot) {
  slot.active = false;
  slot.sprite.visible = false;
  slot.shadow.visible = false;
}
