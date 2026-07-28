// Per-lane elevated platform entity (direct feedback's height system, see
// data/platformSequence.js for the full rationale). Each active pool slot
// is one platform, confined to a single lane, built once as a real 3D
// THREE.Group (not a billboard sprite -- needs to read correctly as a wall
// or a ramp from any viewing angle) and scrolled as one rigid unit each
// frame (group.position.z = the slot's own entryStartZ).
//
// A box (the walkable deck) is never bare -- it's always preceded by
// either a ramp (automatic, forced rise) or a black kill barrier (a
// physical jump-timing check, see checkPlatformKillBarrierHit). Two
// elevation queries are exposed, and they are NOT the same thing:
//   - getWorldElevationAt(field, lane, z): the object's actual physical
//     height at a given (lane, z), ignoring anyone's input -- what
//     entities/obstacles.js and entities/enemy.js should sit at, and what
//     the player follows automatically on a ramp-type (forced, no jump
//     needed, "no way through it, only above it").
//   - getPlayerElevationAt(field, lane, z, isJumping): the PLAYER's own
//     elevation -- identical to getWorldElevationAt for a ramp-type
//     (forced), but for a kill-type only matches the box's height if
//     they're actually airborne (isJumping) at that z; grounded there is 0,
//     and checkPlatformKillBarrierHit below is what turns that into a hit.

import * as THREE from 'three';
import {
  LANE_X, LANE_WIDTH, SPAWN_Z, DESPAWN_Z, PLAYER_Z, OBSTACLE_COLLISION_HALF_Z,
} from '../data/constants.js';
import { PLATFORM_HEIGHT, PLATFORM_RAMP_LENGTH, PLATFORM_DECK_LENGTH } from '../data/platformSequence.js';

const POOL_SIZE = 6;
const PLATFORM_WIDTH = LANE_WIDTH * 0.85; // fits within one lane, matches entities/obstacles.js's barricade-width convention

const clamp01 = (t) => Math.max(0, Math.min(1, t));
// Smoothstep -- eased at both ends (zero rate of change at t=0 and t=1), so
// a rise/fall reads as a curve, not a linear ramp with hard corners at the
// transitions.
const smoothstep = (t) => t * t * (3 - 2 * t);

// Plain/blank placeholder material for now (direct feedback: "I don't care"
// about art yet, real illustrated PNGs are the next pass once the shapes
// themselves read right).
// TEMPORARY debug color (direct feedback: "make the triangles always blue
// so we understand what's a triangle and what's a box") -- swap back to
// matching the box's 0xf2f2f2 once the shapes themselves are confirmed
// working, this is purely to tell the two apart while testing.
function createRampMaterial() {
  return new THREE.MeshBasicMaterial({ color: 0x4a90d9, side: THREE.DoubleSide });
}

// Kill barrier: black, distinct from both the ramp's blue and the box's
// white, so it reads unmistakably as "this one kills you" while testing.
const KILL_BARRIER_HEIGHT = 2.2; // shorter than the box -- a barrier, not another climbable deck
const KILL_BARRIER_DEPTH = 1.0;
function createKillBarrierMaterial() {
  return new THREE.MeshBasicMaterial({ color: 0x0a0a0a, side: THREE.DoubleSide });
}

// Solid triangular-prism wedge -- direct feedback, put aside after the
// tilted-flat-PlaneGeometry ramp kept having visibility problems from
// certain angles (a single flat plane only ever renders one true face; the
// earlier fix of adding DoubleSide papered over that instead of fixing the
// actual shape). Built from EXPLICIT vertices in the exact final
// orientation, not a flat plane + rotation -- this is also what sidesteps
// the earlier rotation-sign mistake (the up-ramp plane briefly tilted
// backwards): there is no rotation to get wrong here, the six corners are
// just placed directly where they belong. z=0 is the low/ground end, z is
// where it meets the box.
function buildWedgeGeometry(width, length, height) {
  const w2 = width / 2;
  // 0,1: bottom-front (ground, low end)   2,3: bottom-back (ground, high end)
  // 4,5: top-back (high end, top, butts the box)
  const v = new Float32Array([
    -w2, 0, 0, w2, 0, 0,
    -w2, 0, length, w2, 0, length,
    -w2, height, length, w2, height, length,
  ]);
  const idx = [
    0, 1, 3, 0, 3, 2, // bottom (touches the street, never actually seen)
    2, 3, 5, 2, 5, 4, // back, vertical (touches the box, never actually seen)
    0, 4, 5, 0, 5, 1, // slope -- the one visible ramp surface. Hand-verified
    // outward normal via cross product: edges (4-0)x(5-0) = (0, L, -h),
    // i.e. up and toward the approaching player -- the (0,1,5)/(0,5,4)
    // order this replaces computed to (0,-L,h) instead, facing down and
    // into the box, the wrong way, which is what made this only visible
    // from the far/downhill side.
    0, 2, 4, // left triangular end cap
    1, 3, 5, // right triangular end cap
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(v, 3));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  return geometry;
}

// One real, closed, solid platform: always a box (the walkable deck, full
// height from the street up -- "closed shape... don't need to see 3D
// elements below it"), always preceded by exactly one guard -- a solid
// wedge leading up to it (hasRamp) or a thin black kill barrier flush
// against its front face (!hasRamp). Direct feedback: "a box never appears
// without a blue ramp before it -- attached to it, or ... a Kill Barrier."
//
// Ramp-type only, direct feedback (trying an all-ramp pass, kill-type
// disabled meanwhile): also gets a MIRRORED exit wedge flush against the
// box's far face, so leaving the deck is a climb-down, not a fall -- "a
// ramp on each side, climbing on and climbing off." Built from the exact
// same geometry as the entry wedge, just Z-flipped (scale.z = -1, safe with
// MeshBasicMaterial + DoubleSide -- unlit, so the winding flip that comes
// with a negative scale has no visible effect) rather than a second
// hand-authored vertex set.
function buildPlatformGroup(hasRamp) {
  const group = new THREE.Group();
  group.visible = false;

  let deckStartCursor = 0;
  if (hasRamp) {
    const entryWedge = new THREE.Mesh(
      buildWedgeGeometry(PLATFORM_WIDTH, PLATFORM_RAMP_LENGTH, PLATFORM_HEIGHT),
      createRampMaterial(),
    );
    entryWedge.position.z = 0;
    group.add(entryWedge);
    deckStartCursor = PLATFORM_RAMP_LENGTH;
  } else {
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(PLATFORM_WIDTH, KILL_BARRIER_HEIGHT, KILL_BARRIER_DEPTH),
      createKillBarrierMaterial(),
    );
    // Flush against the box's own front face (deckStartCursor stays 0),
    // sitting just ahead of it so it's the first thing reached.
    barrier.position.set(0, KILL_BARRIER_HEIGHT / 2, -KILL_BARRIER_DEPTH / 2);
    group.add(barrier);
  }

  const boxFarCursor = deckStartCursor + PLATFORM_DECK_LENGTH;
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(PLATFORM_WIDTH, PLATFORM_HEIGHT, PLATFORM_DECK_LENGTH),
    new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }),
  );
  box.position.set(0, PLATFORM_HEIGHT / 2, deckStartCursor + PLATFORM_DECK_LENGTH / 2);
  group.add(box);

  if (hasRamp) {
    const exitWedge = new THREE.Mesh(
      buildWedgeGeometry(PLATFORM_WIDTH, PLATFORM_RAMP_LENGTH, PLATFORM_HEIGHT),
      createRampMaterial(),
    );
    // scale.z = -1 keeps the mesh's own low/ground point at its local z=0
    // and moves its high/box-touch point to local z=-PLATFORM_RAMP_LENGTH;
    // positioning that z=0 point at boxFarCursor + PLATFORM_RAMP_LENGTH
    // (the far ground point) puts the high point exactly at boxFarCursor
    // (flush against the box's far face).
    exitWedge.scale.z = -1;
    exitWedge.position.z = boxFarCursor + PLATFORM_RAMP_LENGTH;
    group.add(exitWedge);
  }

  return group;
}

function createSlot(scene) {
  const killGroup = buildPlatformGroup(false);
  const rampGroup = buildPlatformGroup(true);
  scene.add(killGroup, rampGroup);
  return {
    active: false,
    type: 'ramp',
    lane: 1,
    entryStartZ: 0, // where the object/ramp begins (0 height here)
    deckStartZ: 0, // where the flat top begins (full height from here on)
    deckEndZ: 0, // where the flat top ends
    exitEndZ: 0, // ramp-type: where the exit wedge finishes descending to 0; kill-type: === deckEndZ (still a hard step, entities/player.js's gravity handles that fall)
    cleared: false, // kill-type only: sticky once airborne-at-contact, see getPlayerElevationAt
    killGroup,
    rampGroup,
  };
}

export function createPlatformField(scene) {
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) pool.push(createSlot(scene));
  return { pool };
}

export function resetPlatformField(field) {
  for (const slot of field.pool) {
    slot.active = false;
    slot.killGroup.visible = false;
    slot.rampGroup.visible = false;
  }
}

// Spawns one platform in `lane` (random if omitted). `z` defaults to the
// far SPAWN_Z (normal gameplay spawning) but can be overridden -- same
// data/introSequence.js ramp-up treatment as entities/obstacles.js and
// entities/enemy.js, so platforms also become something to engage with
// soon after run start instead of only ever arriving via a ~9s far-travel.
export function spawnPlatform(field, type, lane = null, z = SPAWN_Z) {
  const slot = field.pool.find((s) => !s.active);
  if (!slot) return;

  const resolvedLane = lane !== null ? lane : Math.floor(Math.random() * LANE_X.length);

  slot.active = true;
  slot.type = type;
  slot.lane = resolvedLane;
  slot.entryStartZ = z;
  slot.deckStartZ = type === 'kill' ? z : z + PLATFORM_RAMP_LENGTH;
  slot.deckEndZ = slot.deckStartZ + PLATFORM_DECK_LENGTH;
  slot.exitEndZ = type === 'kill' ? slot.deckEndZ : slot.deckEndZ + PLATFORM_RAMP_LENGTH;
  slot.cleared = false;

  const activeVisual = type === 'kill' ? slot.killGroup : slot.rampGroup;
  const idleVisual = type === 'kill' ? slot.rampGroup : slot.killGroup;
  activeVisual.visible = true;
  activeVisual.position.set(LANE_X[resolvedLane], 0, slot.entryStartZ);
  idleVisual.visible = false;
}

export function updatePlatformField(field, dt, speed) {
  const dz = speed * dt;
  for (const slot of field.pool) {
    if (!slot.active) continue;
    slot.entryStartZ += dz;
    slot.deckStartZ += dz;
    slot.deckEndZ += dz;
    slot.exitEndZ += dz;

    const activeVisual = slot.type === 'kill' ? slot.killGroup : slot.rampGroup;
    activeVisual.position.z = slot.entryStartZ;

    // entryStartZ (the BACK edge, furthest from camera) is the last point
    // to clear the despawn line -- the front edge clears first, well before
    // the player could reach it, which was the exact bug an earlier pass
    // had checking the wrong edge.
    if (slot.entryStartZ > DESPAWN_Z) {
      slot.active = false;
      slot.killGroup.visible = false;
      slot.rampGroup.visible = false;
    }
  }
}

function findSlotAt(field, lane, z) {
  for (const slot of field.pool) {
    if (!slot.active || slot.lane !== lane) continue;
    if (z >= slot.entryStartZ && z <= slot.exitEndZ) return slot;
  }
  return null;
}

// True across a ramp-type's ENTIRE active span (entry wedge, deck, and now
// the exit wedge too) -- entities/player.js uses this to tell "still riding
// a scripted ramp surface, direct-follow the target even though it's
// decreasing" apart from "genuinely unsupported, fall under real gravity"
// (stepped off the side, or past a kill-type's deckEndZ, which has no exit
// ramp). Without this, the exit wedge's smooth descent curve would only
// ever get reached by chance, since a decreasing target on its own always
// reads as "not supported" to the rise-vs-fall branch in updatePlayer.
export function isRampSupported(field, lane, z) {
  const slot = findSlotAt(field, lane, z);
  return !!slot && slot.type === 'ramp';
}

// The object's actual physical height at (lane, z), ignoring any player
// input -- what obstacles/enemies sit at, and what the player follows
// automatically on a ramp-type (forced -- everyone in this lane at this z
// rises together, no jump needed, both on the way up AND the way down now
// that every box gets a ramp on each side). Kill-type still steps to 0
// immediately past deckEndZ (exitEndZ === deckEndZ for it) -- direct
// feedback: that descent used to be a smoothstep tied to distance, which
// read as a translate/elevator ride instead of a real fall, and
// entities/player.js's gravity is what turns "the supported height just
// dropped to 0" into an actual fall for that case. This function only ever
// answers "what's physically here."
export function getWorldElevationAt(field, lane, z) {
  const slot = findSlotAt(field, lane, z);
  if (!slot) return 0;
  if (z >= slot.exitEndZ) return 0; // past the object entirely (incl. any exit ramp) -- nothing here

  if (z < slot.deckStartZ) {
    if (slot.type === 'kill') return 0; // never reached here for kill (deckStartZ === entryStartZ), guard anyway
    return smoothstep(clamp01((z - slot.entryStartZ) / PLATFORM_RAMP_LENGTH));
  }
  if (z < slot.deckEndZ) return 1; // flat deck top
  // Exit-ramp zone -- kill-type never reaches this (exitEndZ === deckEndZ
  // means the z >= slot.exitEndZ guard above already caught it).
  return 1 - smoothstep(clamp01((z - slot.deckEndZ) / PLATFORM_RAMP_LENGTH));
}

// The PLAYER's own elevation at (lane, z) -- identical to
// getWorldElevationAt for a ramp-type (forced, both directions). For a
// kill-type, purely a physical jump-timing read: `isJumping` is the
// player's own actual jumpElapsed !== null state at this instant, nothing
// else -- no separate trigger/window mechanic (direct feedback: "the jump
// should be completely physical ... no extra mechanic to it"). Airborne
// here -> matches the box's real height (you cleared it, you're on top);
// grounded here -> 0, and checkPlatformKillBarrierHit below is what turns
// that into a hit. `cleared` latches true (sticky for the rest of this
// deck) the first frame isJumping is true while active here, rather than
// re-deriving live every frame -- otherwise the player would drop straight
// back off the box the instant the cosmetic jump arc ends mid-deck, well
// before actually reaching its far edge.
export function getPlayerElevationAt(field, lane, z, isJumping) {
  const slot = findSlotAt(field, lane, z);
  if (!slot) return 0;
  if (z >= slot.exitEndZ) return 0;
  if (slot.type === 'ramp') return getWorldElevationAt(field, lane, z);
  if (z >= slot.deckEndZ) return 0; // kill-type: deckEndZ === exitEndZ anyway, guard for clarity
  if (isJumping) slot.cleared = true;
  return slot.cleared ? getWorldElevationAt(field, lane, z) : 0;
}

// Direct feedback: switching lanes into an active platform's body used to
// just look up "what height is over there" and apply it instantly -- an
// unearned teleport onto a ramp/box you never actually rode or jumped.
// core/main.js calls this before applying a lane-change input and simply
// refuses the switch if the destination is meaningfully taller than the
// player's CURRENT elevation (walking across two adjacent same-height
// decks stays allowed -- the gap there is ~0, under the threshold; the
// player is free to step SIDEWAYS into a lower/empty lane too, which
// entities/player.js's gravity fall handles once they're there).
const LANE_BLOCK_THRESHOLD = 0.5; // world units
export function isPlatformLaneBlocked(field, lane, z, currentElevation) {
  return getWorldElevationAt(field, lane, z) * PLATFORM_HEIGHT > currentElevation + LANE_BLOCK_THRESHOLD;
}

// Kill-type-only hit check, same consequence as entities/collision.js's
// checkObstacleHit (the caller should endRun() on true) -- a plain physical
// jump-or-die check at the barrier's actual contact point, exactly like a
// barricade: not airborne (`grounded`, the player's own jumpElapsed ===
// null at this instant) at contact -> dead. No jump-in-time/trigger window
// -- direct feedback explicitly dropped that in favor of "either I jump
// over it or I don't."
//
// Kept at a tight OBSTACLE_COLLISION_HALF_Z tolerance around entryStartZ
// (the barrier's own leading edge), same tolerance entities/collision.js's
// checkObstacleHit uses for a barricade -- direct feedback previously
// caught this firing 2+ seconds early when it instead spanned the whole
// object.
export function checkPlatformKillBarrierHit(player, field, grounded) {
  if (!grounded) return false;
  for (const slot of field.pool) {
    if (!slot.active || slot.type !== 'kill' || slot.lane !== player.laneIndex) continue;
    if (Math.abs(slot.entryStartZ - PLAYER_Z) > OBSTACLE_COLLISION_HALF_Z) continue;
    return true;
  }
  return false;
}
