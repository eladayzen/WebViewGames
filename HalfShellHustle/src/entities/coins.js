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
  LANE_X, SPAWN_Z, DESPAWN_Z, PLAYER_Z,
  MAGNET_RANGE_Z, MAGNET_COLLECT_PULL_THRESHOLD, MAGNET_EASE_RATE,
  MAGNET_LATCH_THRESHOLD, MAGNET_PULL_ACCELERATION_POWER,
} from '../data/constants.js';
import { distanceTraveledBy, speedAfterTraveling } from '../systems/speed.js';
import { PLATFORM_HEIGHT } from '../data/platformSequence.js';
import { COIN_TYPES, DEFAULT_COIN_TYPE } from '../data/coinTypes.js';
import { getTexture } from './textureLoader.js';
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

// ART: real Kolbo-painted textures per type (data/coinTypes.js -> envArt.js),
// loaded through the shared URL-keyed cache in entities/textureLoader.js like
// every other real art file in the game. This REPLACED a procedurally-drawn
// radial-gradient glow blob -- direct feedback: "they're just like HTML
// spheres... I want them to be good looking 2D hand-drawn art, like in the
// language of the characters."
//
// Consequences of that swap, both deliberate:
//   - material.color is never touched now. It MULTIPLIES the texture, so the
//     old per-type tint would muddy painted art; the two types differ by being
//     different pictures instead.
//   - the sprite is scaled to the ART'S OWN ASPECT (width, width * aspect)
//     rather than as a square, so the taller bonus stack isn't squashed. Same
//     convention data/obstacleTypes.js already uses for the barricade.
//
// fog: false is kept from the glow version, for the same reason -- a coin at
// SPAWN_Z would otherwise be ~34% washed toward street.js's pale blue fog, and
// coins need to be legible arriving from a distance. depthWrite off (soft
// transparent edges) but depthTest ON, so a coin behind a platform's solid box
// is correctly hidden by it.
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
    active: false,
    lane: 1,
    z: 0,
    baseHeight: 0,
    pulseTimer: 0,
    // Magnet state, all recomputed by applyMagnetPull -- and deliberately kept
    // OFF slot.lane, which stays immutable authored data (see that function's
    // note on why reassigning it would break the surface query).
    magnetPull: 0,       // raw 0..1 grip from z-proximity
    magnetInfluence: 0,  // that grip eased -- the only thing that MOVES the coin
    magnetLatched: false, // committed: pull may never fall again
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
  slot.magnetPull = 0;
  slot.magnetInfluence = 0;
  slot.magnetLatched = false;
  slot.sprite.material.map = getTexture(type.texture.url);
  slot.sprite.material.needsUpdate = true;
  slot.sprite.scale.set(type.width, type.width * type.texture.aspect, 1);
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
    const w = slot.type.width * (1 + COIN_PULSE_SCALE_AMPLITUDE * swell);
    slot.sprite.scale.set(w, w * slot.type.texture.aspect, 1);
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
// A sufficiently magnetized coin (applyMagnetPull below) BYPASSES both the
// lane test and the reach test. That's not a shortcut around the rules -- it
// is what a magnet IS: it overrides "you must be in this lane" and "it must
// be at your height". A magnet that visibly yanks a coin to your chest and
// then still refuses to collect it would be the wrong behaviour. The z window
// still applies either way; the coin is never pulled forward in z.
export function collectCoins(player, field, platformField) {
  const collected = [];
  const surfaceY = getWorldElevationAt(platformField, player.laneIndex, PLAYER_Z) * PLATFORM_HEIGHT;
  if (Math.abs(player.elevationY - surfaceY) >= ELEVATION_MATCH_THRESHOLD) return collected;

  const reachLow = player.airHeight - COIN_REACH_GRACE;
  const reachHigh = player.airHeight + PLAYER_COLLECT_REACH + COIN_REACH_GRACE;
  for (const slot of field.pool) {
    if (!slot.active) continue;
    if (Math.abs(slot.z - PLAYER_Z) > COIN_COLLECT_HALF_Z) continue;
    const magnetized = slot.magnetInfluence >= MAGNET_COLLECT_PULL_THRESHOLD;
    if (!magnetized && slot.lane !== player.laneIndex) continue;
    if (!magnetized && (slot.baseHeight < reachLow || slot.baseHeight > reachHigh)) continue;
    collected.push(slot);
  }
  return collected;
}

// Timed magnet ability (entities/player.js's grantMagnet/isMagnetActive) --
// pulls nearby coins toward the player visually and, past
// MAGNET_COLLECT_PULL_THRESHOLD, makes them collectible regardless of lane or
// height (see collectCoins above).
//
// Runs as its OWN pass from core/main.js, strictly between updateCoinPool and
// collectCoins: after, so its x/y writes aren't overwritten by the pool's own
// surface-follow; before, so the pull strength collection reads is current on
// the same frame. Same separate-pass shape TmntSkateSlice uses for its magnet.
//
// WHY THIS DOESN'T TOUCH slot.lane, which would be the obvious way to make a
// pulled coin collectible: `lane` is also the key for the coin's surface-height
// query in updateCoinPool (getWorldElevationAt(platformField, slot.lane, ...)).
// Reassigning it would snap the coin's surface term by up to a full
// PLATFORM_HEIGHT in one frame the moment the player's lane has a deck under
// it -- and it's irreversible: if the buff expires or the player moves away,
// the coin is stranded in a lane it was never authored in. So `lane` stays
// immutable authored data, and a separate 0..1 `magnetPull` scalar carries the
// influence. Fully reversible, no surface discontinuity.
//
// Called every frame regardless of whether the buff is up. An UNCOMMITTED coin
// (one the field only just started to bend) eases back to its own lane when the
// buff drops; a COMMITTED one never does -- see MAGNET_LATCH_THRESHOLD.
//
// TWO SEPARATE NUMBERS, and keeping them apart is what makes both behaviours
// possible:
//
//   slot.magnetPull      -- raw 0..1 grip, driven by z-proximity. Rises
//                           linearly as the coin closes in. Monotonic once
//                           committed.
//   slot.magnetInfluence -- that grip run through an ease-in curve, and the
//                           only thing that ever moves a coin or decides
//                           whether it's collectible.
//
// Direct feedback drove both: coins used to be dragged back to their lane the
// instant the buff lapsed ("it should keep on moving until it gets to me"), and
// they used to travel at a flat rate because the raw grip WAS the displacement
// ("it should have some kind of acceleration").
export function applyMagnetPull(field, player, dt, active) {
  // The centre of the player's collectible band, in world y. Reuses his own
  // elevationY (already resolved this frame) rather than re-querying the
  // surface -- see collectCoins' note on why those two aren't interchangeable.
  const pullTargetY = player.elevationY + player.airHeight + PLAYER_COLLECT_REACH / 2;
  const ease = Math.min(1, MAGNET_EASE_RATE * dt);

  for (const slot of field.pool) {
    if (!slot.active) continue;

    // Proximity grip, independent of the buff -- a committed coin keeps reading
    // it after the buff is gone, which is what lets it carry on closing under
    // its own momentum instead of freezing at whatever value it lapsed on.
    const dz = Math.abs(slot.z - PLAYER_Z);
    const proximity = dz < MAGNET_RANGE_Z ? 1 - dz / MAGNET_RANGE_Z : 0;
    let target = active ? proximity : 0;

    // THE COMMITMENT. Not "hold the pull steady" but "never let it fall": the
    // coin carries on along the exact curve it was already following, because
    // proximity keeps climbing as the world scrolls it toward the player. That's
    // why an expiring buff is now invisible -- nothing about the coin's motion
    // changes at the moment it lapses. Freezing the pull instead would stall the
    // coin part-way across; snapping it to 1 would make it lurch.
    if (slot.magnetLatched) target = Math.max(target, proximity, slot.magnetPull);

    slot.magnetPull += (target - slot.magnetPull) * ease;
    if (!slot.magnetLatched && slot.magnetPull < 0.002) slot.magnetPull = 0;
    if (slot.magnetPull >= MAGNET_LATCH_THRESHOLD) slot.magnetLatched = true;

    // Ease-in: displacement is the grip CURVED, so the coin creeps out of its
    // lane and then rushes the last stretch. Since the grip rises linearly with
    // time, a power of 2 makes displacement go as t^2 -- literally constant
    // acceleration, not a curve that merely looks like one.
    slot.magnetInfluence = slot.magnetPull ** MAGNET_PULL_ACCELERATION_POWER;

    const laneX = LANE_X[slot.lane];
    if (slot.magnetInfluence > 0) {
      // player.laneX, NOT sprite.position.x -- the latter carries the
      // per-frame foot-plant xOffset bob, which would make every pulled coin
      // jitter in sympathy with his stride.
      slot.sprite.position.x = laneX + (player.laneX - laneX) * slot.magnetInfluence;
      // updateCoinPool re-resolved this to the surface height earlier THIS
      // frame, so it's a clean lerp from the coin's own resting height rather
      // than an accumulating chase of a moving target.
      const restY = slot.sprite.position.y;
      slot.sprite.position.y = restY + (pullTargetY - restY) * slot.magnetInfluence;
    } else {
      slot.sprite.position.x = laneX;
    }
  }
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
// (anchorZ - elapsed * speed, minus because larger z arrives sooner) is
// reached exactly `elapsed` after the first one -- so sampling the player's
// own jump curve at matching times makes the shape line up under a real jump
// pressed as coin 0 arrives.
//
// WHICH speed is the subtle part. This converts a TIME into a DISTANCE, and
// the conversion is only right if the speed used here equals the speed the
// player is travelling at when he actually jumps over it -- which, on a speed
// ramp, is NOT the speed right now at spawn time. The cluster spawns ~140
// units out and takes >10s to arrive, and the world is faster by then, so
// laying it out at today's speed makes the arc arrive compressed in time and
// the player over-jumps it. So: work out how far the world will have scrolled
// in total by the time this cluster reaches the player, and ask
// systems/speed.js what the speed is at that point.
//
// + COIN_BASE_HEIGHT is load-bearing, not decoration: without it a grounded
// player's body span already reaches 4 of the 5 arc coins and the jump is
// pointless (measured). With it, only the two endpoint coins stay
// collectible on foot.
function buildArc(lane, anchorZ, gameTime) {
  const arrivalSpeed = speedAfterTraveling(distanceTraveledBy(gameTime) + Math.abs(anchorZ));
  return sampleJumpArc(COIN_ARC_SAMPLE_FRACTIONS).map((sample) => ({
    lane,
    z: anchorZ - sample.elapsed * arrivalSpeed,
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
export function spawnCoinCluster(field, platformField, obstacleField, gameTime, anchorZ = SPAWN_Z) {
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
    const placements = buildArc(0, anchorZ, gameTime); // lane filled in below
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
