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

// SCRAP-BOT SKIN: the pylon's glowing rings USED to be baked into the art
// itself (envArt.js/data/enemyTypes.js have the full history of what this
// prop used to be). Direct feedback: baked-in rings "looked too frozen" --
// a static texture can't actually move. Regenerated the art without them
// (same 4 files, rings edited out, everything else pixel-identical -- see
// art/final/alt/foot_soldier_*_v3_pylon_baked_rings.png for the version
// this replaced) and rebuilt the rings as real dt-driven sprites instead:
// two per slot, each looping a vertical trip up the glowing core with a
// fade in/out at both ends of the trip (so the loop point never pops), on
// a half-cycle phase offset from each other so they never travel in
// lockstep -- reads as a continuous flow of energy up the tower rather
// than a single pulse. Tinted per-type from that type's own poofColors[0]
// (systems/vfx.js's kill-poof color, already matches each variant's glow)
// rather than a new data field -- one fewer number to keep in sync.
function createRingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  // Hollow annulus: transparent center AND transparent outer edge, bright
  // in a thin band at ~65% radius -- reads as a glowing ring, not a disc.
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.48, 'rgba(255,255,255,0)');
  grad.addColorStop(0.62, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.72, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.86, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
let cachedRingTexture = null;
function getRingTexture() {
  if (!cachedRingTexture) cachedRingTexture = createRingTexture();
  return cachedRingTexture;
}

// Seconds for one full bottom-to-top trip.
const RING_TRAVEL_PERIOD = 2.6;
// Fraction of a full bottom-to-top trip spent fading in (mirrored at the
// top for fading out) -- keeps the loop seam invisible.
const RING_FADE_FRACTION = 0.18;
// Vertical span the rings travel, as a fraction of the prop's own height,
// measured from the ground -- matches roughly where the glowing core
// column actually sits in the art (clear of the base plate/frame and the
// top housing).
const RING_TRAVEL_MIN_FRAC = 0.14;
const RING_TRAVEL_MAX_FRAC = 0.82;
// Ring sprite size, as fractions of the prop's own height -- scales
// automatically with it (data/enemyTypes.js's PYLON_HEIGHT) rather than
// being a fixed world-unit size that would look wrong if that ever changes
// again.
const RING_WIDTH_FRACTION = 0.34;
const RING_DEPTH_FRACTION = 0.1;

function createRingSprite(scene) {
  const material = new THREE.SpriteMaterial({
    map: getRingTexture(), transparent: true, depthWrite: false, fog: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.visible = false;
  scene.add(sprite);
  return sprite;
}

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

  // Two independent rings, not one -- a half-cycle phase offset (set on
  // spawn) between ringTravel[0]/[1] is what sells "continuous flow" rather
  // than a single pulse. See the block above for the full why.
  const ring0 = createRingSprite(scene);
  const ring1 = createRingSprite(scene);

  return {
    sprite,
    shadow,
    ring0,
    ring1,
    ringTravel: [0, 0.5], // 0..1 position in the current trip, per ring
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
    slot.ring0.visible = false;
    slot.ring1.visible = false;
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
  // + type.floatHeight: a purely VISUAL lift (data/enemyTypes.js's own
  // comment has the why) -- collision reads slot.elevationY, never this, so
  // a floating chest still bumps at normal street-running height.
  slot.sprite.position.set(LANE_X[lane], type.height / 2 + type.floatHeight, z);
  slot.sprite.visible = true;

  slot.shadow.scale.set(type.shadowWidth, type.shadowDepth, 1);
  slot.shadow.position.set(LANE_X[lane], slot.shadow.position.y, z);
  slot.shadow.visible = true;

  // Rings: tinted from this type's own poof color (matches its core glow),
  // sized off this type's own height so they scale with it. Randomized
  // travel start (not just the fixed 0/0.5 phase split) so a pool's worth
  // of pylons don't all pulse in the same rhythm -- same "randomized phase"
  // idiom as breatheTimer above.
  const ringColor = type.poofColors[0];
  const ringWidth = type.height * RING_WIDTH_FRACTION;
  const ringDepth = type.height * RING_DEPTH_FRACTION;
  const ringStart = Math.random();
  slot.ringTravel[0] = ringStart;
  slot.ringTravel[1] = (ringStart + 0.5) % 1;
  for (const ring of [slot.ring0, slot.ring1]) {
    ring.material.color.setHex(ringColor);
    ring.scale.set(ringWidth, ringDepth, 1);
    ring.position.set(LANE_X[lane], 0, z); // y set for real in updateEnemyPool
    ring.visible = true;
  }
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
    slot.ring0.position.z = slot.z;
    slot.ring1.position.z = slot.z;

    if (slot.z > DESPAWN_Z) {
      slot.active = false;
      slot.sprite.visible = false;
      slot.shadow.visible = false;
      slot.ring0.visible = false;
      slot.ring1.visible = false;
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
    // at street level) -- orthogonal to the swell/pivot math. type.floatHeight
    // is the same kind of purely-visual additive term (data/enemyTypes.js's
    // own comment) -- deliberately absent from slot.elevationY, so
    // checkEnemyHit's collision math is untouched by it.
    slot.sprite.position.y = baseHeight / 2 + (scaleY - 1) * baseHeight * 0.5
      + type.floatHeight + slot.elevationY;
    slot.shadow.position.y = 0.015 + slot.elevationY;

    // Rings: each independently advances its own 0..1 trip position, wraps
    // (the modulo), and fades in/out at both ends of the trip so the wrap
    // itself is never visible. Positioned along the SAME baseHeight/
    // elevationY/floatHeight stack as the sprite above, so a ring rides a
    // platform deck or a future float change exactly like the pylon itself
    // does.
    const rings = [slot.ring0, slot.ring1];
    for (let i = 0; i < rings.length; i++) {
      slot.ringTravel[i] = (slot.ringTravel[i] + dt / RING_TRAVEL_PERIOD) % 1;
      const travel = slot.ringTravel[i];
      const frac = RING_TRAVEL_MIN_FRAC + travel * (RING_TRAVEL_MAX_FRAC - RING_TRAVEL_MIN_FRAC);
      let opacity = 1;
      if (travel < RING_FADE_FRACTION) opacity = travel / RING_FADE_FRACTION;
      else if (travel > 1 - RING_FADE_FRACTION) opacity = (1 - travel) / RING_FADE_FRACTION;
      rings[i].material.opacity = opacity;
      rings[i].position.y = baseHeight * frac + type.floatHeight + slot.elevationY;
    }
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
  slot.ring0.visible = false;
  slot.ring1.visible = false;
}
