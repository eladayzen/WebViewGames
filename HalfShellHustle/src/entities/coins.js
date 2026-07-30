// Coin collectibles -- direct feedback's addition: a second, purely
// POSITIVE thing to chase during a run (the only other one is bumping a
// Foot Soldier, entities/enemy.js), against three punishing ones
// (obstacles, kill barriers, falls). Mechanically "pretty much the same as
// enemies" per that feedback -- pooled billboard sprites scrolling toward a
// fixed player, collected on lane+z overlap -- but arranged in SHAPES
// rather than scattered singles, which is the actual point:
//   - row: 3-5 in a line, collectible just by running through them
//   - arc: laid out along the player's REAL jump trajectory, so a jump
//     timed to the first coin sweeps the whole thing
//   - ramp climb: a trail up (or down) an active platform's wedge
//
// Data-driven per type (data/coinTypes.js) and per shape
// (data/spawnConfig.js), following this project's established conventions.
//
// KEY IDEA -- `slot.baseHeight` is a height above WHATEVER SURFACE IS UNDER
// THE COIN, never an absolute world Y. updateCoinPool re-queries that
// surface live every frame (entities/platform.js's getWorldElevationAt,
// exactly as entities/enemy.js already does for deck-standing enemies), so
// a single row pattern works unchanged on the street, on a platform deck,
// and riding a ramp's slope, with zero branching at spawn time.

import * as THREE from 'three';
import {
  LANE_X, SPAWN_Z, DESPAWN_Z, PLAYER_Z, FORWARD_SPEED,
} from '../data/constants.js';
import { PLATFORM_HEIGHT } from '../data/platformSequence.js';
import { COIN_TYPES, DEFAULT_COIN_TYPE } from '../data/coinTypes.js';
import {
  getWorldElevationAt, isPlatformFootprintBlocked, findActiveRampSpans,
} from './platform.js';
import { PLAYER_COLLECT_REACH, sampleJumpArc } from './player.js';
import {
  COIN_POOL_SIZE, COIN_BASE_HEIGHT, COIN_REACH_GRACE, COIN_BONUS_TYPE_CHANCE,
  COIN_PATTERN_ROW_WEIGHT, COIN_PATTERN_ARC_WEIGHT,
  COIN_ROW_MIN, COIN_ROW_MAX, COIN_ROW_SPACING,
  COIN_ARC_SAMPLE_FRACTIONS, COIN_RAMP_COUNT, COIN_RAMP_MARGIN,
  COIN_PULSE_PERIOD, COIN_PULSE_SCALE_AMPLITUDE, COIN_PULSE_OPACITY_MIN,
  COIN_PULSE_PHASE_STEP, COIN_OBSTACLE_CLEARANCE,
} from '../data/spawnConfig.js';

// Own local threshold rather than the shared OBSTACLE_COLLISION_HALF_Z
// (1.5): coins are packed ~2.2-2.5 apart, so a 1.5 half-window would have
// two coins inside it essentially always. Per-file collision constants are
// the established convention here (entities/collision.js and
// entities/enemy.js each keep their own copy too).
const COIN_COLLECT_HALF_Z = 1.1;
// Same value//semantics as entities/collision.js's and entities/enemy.js's
// own copies -- "is the player standing on the same surface as this thing".
const ELEVATION_MATCH_THRESHOLD = 0.3;

// Soft radial glow, built once and shared -- same cached-canvas-texture
// recipe as entities/contactShadow.js's getShadowTexture (and
// systems/vfx.js's dot texture), NOT entities/textureLoader.js's getTexture
// (that's URL-keyed, for real art files).
//
// GRAYSCALE on purpose: each coin's own SpriteMaterial tints this via
// material.color (data/coinTypes.js), so one texture serves every type and
// adding a type needs no new art. The brightness ramp is what reads as
// "glowing"; the DARK outer ring is what keeps it readable -- see the
// blending note on createSlot below.
function createCoinTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const r = size / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); // hot core
  grad.addColorStop(0.34, 'rgba(245,245,245,1)');
  grad.addColorStop(0.60, 'rgba(190,190,190,1)'); // body
  grad.addColorStop(0.80, 'rgba(70,70,70,1)'); // dark rim -- the contrast that survives any background
  grad.addColorStop(0.92, 'rgba(45,45,45,0.6)');
  grad.addColorStop(1, 'rgba(45,45,45,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

let cachedCoinTexture = null;
function getCoinTexture() {
  if (!cachedCoinTexture) cachedCoinTexture = createCoinTexture();
  return cachedCoinTexture;
}

// NOTE on blending -- deliberately NORMAL, not additive, despite additive
// being the obvious choice for a "glow". street.js's fog and background are
// both pale sky-blue (0x9fd2ec / 0x8fc7e8), and an arc-peak coin sits high
// enough to be silhouetted against exactly that: additive gold on pale blue
// saturates straight to white, losing the coin's color identity precisely
// where it's most visible, and making a gold 'common' indistinguishable
// from a cyan 'bonus'. This project has already been burned by this same
// class of problem once (see entities/platform.js's note on its flat
// placeholder colors vanishing into the sky). A dark rim + normal blending
// reads as a glowing coin against any background, at one draw call.
//
// fog: false for the same reason everything soft here sets it -- a coin at
// SPAWN_Z is ~34% fogged toward pale blue otherwise, and coins need to be
// legible arriving from a distance. depthWrite off (it's a soft transparent
// sprite) but depthTest ON, unlike systems/vfx.js's ParticlePool -- a coin
// behind a platform's solid box should be correctly hidden by it.
function createSlot(scene) {
  const material = new THREE.SpriteMaterial({
    map: getCoinTexture(), transparent: true, depthWrite: false, fog: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.visible = false;
  scene.add(sprite);
  return {
    sprite,
    type: null,
    active: false,
    lane: 1,
    z: 0,
    baseHeight: 0,
    pulseTimer: 0,
  };
}

export function createCoinPool(scene) {
  const pool = [];
  for (let i = 0; i < COIN_POOL_SIZE; i++) pool.push(createSlot(scene));
  return { pool };
}

export function resetCoinPool(field) {
  for (const slot of field.pool) {
    slot.active = false;
    slot.sprite.visible = false;
  }
}

export function despawnCoin(slot) {
  slot.active = false;
  slot.sprite.visible = false;
}

function placeCoin(slot, lane, z, baseHeight, typeKey, pulsePhase) {
  const type = COIN_TYPES[typeKey];
  slot.active = true;
  slot.type = type;
  slot.lane = lane;
  slot.z = z;
  slot.baseHeight = baseHeight;
  slot.pulseTimer = pulsePhase % COIN_PULSE_PERIOD;
  slot.sprite.material.color.setHex(type.color);
  slot.sprite.scale.set(type.size, type.size, 1);
  // y is corrected against the live surface on this same frame's
  // updateCoinPool pass -- baseHeight alone is only right over flat street.
  slot.sprite.position.set(LANE_X[lane], baseHeight, z);
  slot.sprite.visible = true;
}

export function updateCoinPool(field, dt, speed, platformField) {
  for (const slot of field.pool) {
    if (!slot.active) continue;
    slot.z += speed * dt;
    if (slot.z > DESPAWN_Z) {
      despawnCoin(slot);
      continue;
    }
    slot.sprite.position.z = slot.z;
    // The live surface re-query that makes one baseHeight work on street,
    // deck, and ramp slope alike (see this file's header).
    slot.sprite.position.y = getWorldElevationAt(platformField, slot.lane, slot.z) * PLATFORM_HEIGHT
      + slot.baseHeight;

    // Cosmetic pulse only -- NEVER fed into collectCoins below, same
    // separation entities/enemy.js keeps between its breathing swell and
    // checkEnemyHit. 0 -> 1 -> 0 over the period, eased at both ends for
    // free (a cosine's rate of change is zero at its peak/trough).
    slot.pulseTimer = (slot.pulseTimer + dt) % COIN_PULSE_PERIOD;
    const swell = 0.5 * (1 - Math.cos((2 * Math.PI * slot.pulseTimer) / COIN_PULSE_PERIOD));
    const scale = slot.type.size * (1 + COIN_PULSE_SCALE_AMPLITUDE * swell);
    slot.sprite.scale.set(scale, scale, 1);
    slot.sprite.material.opacity = COIN_PULSE_OPACITY_MIN + (1 - COIN_PULSE_OPACITY_MIN) * swell;
  }
}

// Returns EVERY coin the player is touching this frame (an array, not one
// slot like entities/enemy.js's checkEnemyHit): at arc spacing two coins
// are routinely inside the z window on the same frame, and returning only
// the first would let the other slide out of the window untested. Does not
// deactivate them -- the caller reads position/type for VFX and score, then
// calls despawnCoin, mirroring enemy.js's checkEnemyHit/killEnemy split.
//
// Two INDEPENDENT tests, neither of which recomputes a height anyone else
// already owns:
//
//  1. Same surface? Compares the player's own elevationY against the
//     surface height at HIS z -- identical semantics to enemy.js's check.
//     Note elevationY is NOT simply getWorldElevationAt * PLATFORM_HEIGHT
//     in general (entities/player.js derives it from getPlayerElevationAt
//     plus gravity integration, so it legitimately diverges mid-fall), which
//     is exactly why this compares against it rather than re-deriving it.
//     Hoisted out of the loop: it depends only on the player.
//
//  2. Within reach? Purely SURFACE-RELATIVE: the coin's baseHeight against
//     the player's vertical body span, [airHeight, airHeight + reach].
//     Being surface-relative is what makes ramp coins work -- on a slope
//     the absolute elevation at the coin's own z can differ from the
//     elevation at PLAYER_Z by up to ~0.79 world units (well past
//     ELEVATION_MATCH_THRESHOLD), so any absolute-height comparison would
//     break on exactly the pattern that needs it most.
//
// A body-SPAN overlap rather than a single-point tolerance also means a
// mid-jump player legitimately flies OVER a chest-height row and gets
// nothing -- standard for the genre, and the same fact that makes the arc
// pattern's jump-only middle coins work at all.
export function collectCoins(player, field, platformField) {
  const collected = [];
  const surfaceY = getWorldElevationAt(platformField, player.laneIndex, PLAYER_Z) * PLATFORM_HEIGHT;
  if (Math.abs(player.elevationY - surfaceY) >= ELEVATION_MATCH_THRESHOLD) return collected;

  const reachLow = player.airHeight - COIN_REACH_GRACE;
  const reachHigh = player.airHeight + PLAYER_COLLECT_REACH + COIN_REACH_GRACE;
  for (const slot of field.pool) {
    if (!slot.active) continue;
    if (slot.lane !== player.laneIndex) continue;
    if (Math.abs(slot.z - PLAYER_Z) > COIN_COLLECT_HALF_Z) continue;
    if (slot.baseHeight < reachLow || slot.baseHeight > reachHigh) continue;
    collected.push(slot);
  }
  return collected;
}

// --- Cluster placement -------------------------------------------------

function resolveClusterType() {
  return Math.random() < COIN_BONUS_TYPE_CHANCE ? 'bonus' : DEFAULT_COIN_TYPE;
}

// Would a cluster spanning farZ..nearZ in this lane bait the player into an
// obstacle? See COIN_OBSTACLE_CLEARANCE (data/spawnConfig.js) for why coins
// specifically need this when enemies don't.
function hasObstacleNear(obstacleField, lane, farZ, nearZ) {
  for (const slot of obstacleField.pool) {
    if (!slot.active || slot.lane !== lane) continue;
    if (slot.z >= farZ - COIN_OBSTACLE_CLEARANCE && slot.z <= nearZ + COIN_OBSTACLE_CLEARANCE) return true;
  }
  return false;
}

// Random lane that can actually host a cluster spanning farZ..nearZ, or
// null if none can. Not entities/platform.js's findOpenLane: that picks one
// random open lane knowing nothing about obstacles, so a rejection here
// couldn't retry a different lane. Enumerating in shuffled order tries
// every lane exactly once instead.
//
// requireFlat is for the arc pattern only, whose height math assumes flat
// ground. Testing the span's two ENDS is provably enough to prove the whole
// span clear: a padded platform footprint is 10+10+30+10+10 = 70 units
// long, so it cannot fit strictly between two points ~16 apart without
// containing one of them.
function pickClusterLane(platformField, obstacleField, farZ, nearZ, requireFlat) {
  const lanes = [];
  for (let i = 0; i < LANE_X.length; i++) lanes.push(i);
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  for (const lane of lanes) {
    if (hasObstacleNear(obstacleField, lane, farZ, nearZ)) continue;
    if (requireFlat
      && (isPlatformFootprintBlocked(platformField, lane, nearZ)
        || isPlatformFootprintBlocked(platformField, lane, farZ))) continue;
    return lane;
  }
  return null;
}

// Reserves slots for the WHOLE cluster up front, or places nothing at all.
// Every other spawner in this game grabs one free slot and no-ops if none
// is free, which for a multi-coin cluster would silently truncate the shape
// mid-row (shipping a parabola with a hole in it, actively misleading the
// player about where to jump) -- so this is all-or-nothing instead. A
// skipped cluster just means the spawner tries again next interval, same as
// entities/obstacles.js's documented "silently skips rather than forcing a
// spawn".
function reserveAndPlace(field, placements, typeKey) {
  const free = field.pool.filter((slot) => !slot.active);
  if (free.length < placements.length) return false;
  placements.forEach((p, i) => {
    // Phase STEPPED by index (nearest coin first) rather than randomized --
    // sends a travelling pulse wave down the chain, reading as one
    // connected trail. See COIN_PULSE_PHASE_STEP.
    placeCoin(free[i], p.lane, p.z, p.baseHeight, typeKey, i * COIN_PULSE_PHASE_STEP);
  });
  return true;
}

// Index 0 is always the NEAREST coin (largest z, reached first) in every
// pattern below -- keeps the pulse wave travelling toward the player and
// keeps the "never closer to camera than anchorZ" invariant easy to see.

function buildRow(lane, anchorZ) {
  const count = COIN_ROW_MIN + Math.floor(Math.random() * (COIN_ROW_MAX - COIN_ROW_MIN + 1));
  const placements = [];
  for (let i = 0; i < count; i++) {
    placements.push({ lane, z: anchorZ - i * COIN_ROW_SPACING, baseHeight: COIN_BASE_HEIGHT });
  }
  return placements;
}

// The arc: a coin `elapsed` seconds' worth of travel FURTHER away
// (anchorZ - elapsed * FORWARD_SPEED, minus because larger z arrives
// sooner) is reached exactly `elapsed` after the first one -- so sampling
// the player's own jump curve at matching times makes the shape line up
// under a real jump pressed as coin 0 arrives.
//
// + COIN_BASE_HEIGHT is load-bearing, not decoration: without it a grounded
// player's body span already reaches 4 of the 5 arc coins and the jump is
// pointless (measured). With it, only the two endpoint coins stay
// collectible on foot.
function buildArc(lane, anchorZ) {
  return sampleJumpArc(COIN_ARC_SAMPLE_FRACTIONS).map((sample) => ({
    lane,
    z: anchorZ - sample.elapsed * FORWARD_SPEED,
    baseHeight: COIN_BASE_HEIGHT + sample.height,
  }));
}

// A trail along one ramp wedge. No jump needed and no slope math here --
// the wedge's own rise is applied live by updateCoinPool's surface query,
// so these just need z positions inside the span.
function buildRampClimb(span) {
  const nearZ = span.endZ - COIN_RAMP_MARGIN;
  const farZ = span.startZ + COIN_RAMP_MARGIN;
  const usable = nearZ - farZ;
  if (usable <= 0) return null;
  const placements = [];
  for (let i = 0; i < COIN_RAMP_COUNT; i++) {
    const t = COIN_RAMP_COUNT === 1 ? 0.5 : i / (COIN_RAMP_COUNT - 1);
    placements.push({ lane: span.lane, z: nearZ - t * usable, baseHeight: COIN_BASE_HEIGHT });
  }
  return placements;
}

// Spawns one cluster in a randomly-chosen shape. `anchorZ` is where the
// cluster's NEAREST coin goes for the row/arc patterns (defaults to the far
// SPAWN_Z, like every other spawner) -- ramp-climb ignores it, since it
// attaches to wherever an existing platform's wedge currently is, exactly
// as entities/platform.js's findDeckPlacements already does for
// deck-standing enemies (bounded there by PLATFORM_DECK_PLACEMENT_MAX_Z so
// it still can't pop in on top of the player).
//
// Silently places nothing if no lane/span works or the pool is too full --
// the spawner's own timer just tries again next interval.
export function spawnCoinCluster(field, platformField, obstacleField, anchorZ = SPAWN_Z) {
  const typeKey = resolveClusterType();
  const roll = Math.random();

  if (roll >= COIN_PATTERN_ROW_WEIGHT + COIN_PATTERN_ARC_WEIGHT) {
    // Ramp climb, when a platform is currently offering an eligible wedge.
    const spans = findActiveRampSpans(platformField)
      .filter((span) => !hasObstacleNear(obstacleField, span.lane, span.startZ, span.endZ));
    if (spans.length > 0) {
      const span = spans[Math.floor(Math.random() * spans.length)];
      const placements = buildRampClimb(span);
      if (placements && reserveAndPlace(field, placements, typeKey)) {
        span.claim();
        return;
      }
    }
    // No eligible ramp (common -- platforms are sparse): fall through to a
    // row rather than spawning nothing, so the cadence stays steady.
  }

  const isArc = roll >= COIN_PATTERN_ROW_WEIGHT && roll < COIN_PATTERN_ROW_WEIGHT + COIN_PATTERN_ARC_WEIGHT;
  if (isArc) {
    const placements = buildArc(0, anchorZ); // lane filled in below
    const farZ = placements[placements.length - 1].z;
    const lane = pickClusterLane(platformField, obstacleField, farZ, anchorZ, true);
    if (lane === null) return;
    placements.forEach((p) => { p.lane = lane; });
    reserveAndPlace(field, placements, typeKey);
    return;
  }

  const placements = buildRow(0, anchorZ); // lane filled in below
  const farZ = placements[placements.length - 1].z;
  const lane = pickClusterLane(platformField, obstacleField, farZ, anchorZ, false);
  if (lane === null) return;
  placements.forEach((p) => { p.lane = lane; });
  reserveAndPlace(field, placements, typeKey);
}
