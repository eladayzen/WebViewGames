// Elevated "platform stretch" entity (direct feedback's height system, see
// data/platformSequence.js for the full rationale/config). Each active pool
// slot is one stretch: an entry (either an automatic full-width ramp, or a
// gap the player must jump to reach), a flat elevated deck, and a down-ramp
// back to street level -- built once as a single THREE.Group of placeholder
// flat-colored meshes at fixed LOCAL z-offsets, then scrolled as one rigid
// unit each frame (group.position.z = the stretch's own entryStartZ) rather
// than repositioning every mesh individually.
//
// Two elevation queries are exposed, and they are NOT the same thing:
//   - getWorldElevationAt(field, z): the deck's actual physical height at a
//     given z, ignoring anyone's input -- what entities/obstacles.js and
//     entities/enemy.js should sit at, and what the player follows on a
//     ramp-type entry (forced, everyone who reaches that z rises together).
//   - getPlayerElevationAt(field, z): the PLAYER's own elevation, which for
//     a jump-type entry depends on whether they actually pressed jump
//     (triggerPlatformJump below) -- skip it and they stay grounded while
//     that stretch's deck (and anything on it) passes overhead, unused.

import * as THREE from 'three';
import { LANE_WIDTH, SPAWN_Z, DESPAWN_Z } from '../data/constants.js';
import {
  PLATFORM_HEIGHT, PLATFORM_RAMP_LENGTH, PLATFORM_DECK_LENGTH, PLATFORM_JUMP_RISE_LENGTH,
} from '../data/platformSequence.js';

const POOL_SIZE = 3;
const PLATFORM_WIDTH = LANE_WIDTH * 3 + 1.2; // full street width plus a little edge margin, not clipped tight to the outer lanes
const PILLAR_SPACING = 26; // world units between support pillars along the deck
const PILLAR_SIZE = 0.6;

const clamp01 = (t) => Math.max(0, Math.min(1, t));
// Smoothstep -- eased at both ends (zero rate of change at t=0 and t=1), so
// a ramp's rise/fall reads as a curve, not a linear ramp with hard corners
// at the transitions.
const smoothstep = (t) => t * t * (3 - 2 * t);

function buildStretchGroup(scene, type) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const deckMat = new THREE.MeshBasicMaterial({ color: 0x8a93a8 }); // placeholder flat rooftop/deck grey-blue
  const rampMat = new THREE.MeshBasicMaterial({ color: 0x767f92 }); // slightly darker, reads as the sloped surface
  const pillarMat = new THREE.MeshBasicMaterial({ color: 0x565d6c });
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffcf4a, transparent: true, opacity: 0.85 });

  let cursor = 0; // local z, matches the group's own entryStartZ-relative frame

  let upRamp = null;
  if (type === 'ramp') {
    // A tilted plane bridging street level (0) up to PLATFORM_HEIGHT over
    // PLATFORM_RAMP_LENGTH. PlaneGeometry lies flat in XY by default; tilt
    // it about X so its length runs along Z and its far edge sits at the
    // target height, then offset up by half the rise so its LOW edge (not
    // its center) is what's at group-local z=0/y=0.
    const rampGeo = new THREE.PlaneGeometry(PLATFORM_WIDTH, PLATFORM_RAMP_LENGTH);
    upRamp = new THREE.Mesh(rampGeo, rampMat);
    const angle = Math.atan2(PLATFORM_HEIGHT, PLATFORM_RAMP_LENGTH);
    // -angle (not +angle) -- ground level at local z=0 (entryStartZ),
    // rising to deck level at local z=PLATFORM_RAMP_LENGTH (entryEndZ).
    // Matches the down-ramp's own rotation sign below, which needed no
    // fix since its start (deck-height) / end (ground-height) direction
    // happened to already match this same formula.
    upRamp.rotation.x = -Math.PI / 2 - angle;
    upRamp.position.set(0, PLATFORM_HEIGHT / 2, cursor + PLATFORM_RAMP_LENGTH / 2);
    group.add(upRamp);
  } else {
    // Jump-type entry: no physical ramp, just a glowing floor marker on the
    // street prompting the jump -- the deck itself starts abruptly (a hard
    // ledge edge) at the end of this span, see the deck block below.
    const markerGeo = new THREE.PlaneGeometry(LANE_WIDTH * 0.9, 1.4);
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(0, 0.03, cursor + PLATFORM_RAMP_LENGTH / 2);
    group.add(marker);
  }
  cursor += PLATFORM_RAMP_LENGTH;

  // Flat elevated deck.
  const deckGeo = new THREE.PlaneGeometry(PLATFORM_WIDTH, PLATFORM_DECK_LENGTH);
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, PLATFORM_HEIGHT, cursor + PLATFORM_DECK_LENGTH / 2);
  group.add(deck);

  // Support pillars beneath the deck, visible from street level as the
  // stretch approaches/passes overhead -- sells the height from below per
  // direct feedback ("ground street stays visible below").
  const pillarGeo = new THREE.BoxGeometry(PILLAR_SIZE, PLATFORM_HEIGHT, PILLAR_SIZE);
  for (let pz = cursor; pz < cursor + PLATFORM_DECK_LENGTH; pz += PILLAR_SPACING) {
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(side * (PLATFORM_WIDTH / 2 - PILLAR_SIZE), PLATFORM_HEIGHT / 2, pz);
      group.add(pillar);
    }
  }
  cursor += PLATFORM_DECK_LENGTH;

  // Down-ramp -- every stretch gets one regardless of entry type, since
  // anyone who ends up on the deck (forced via ramp, or via a successful
  // jump-trigger) rides the same way back down.
  const downGeo = new THREE.PlaneGeometry(PLATFORM_WIDTH, PLATFORM_RAMP_LENGTH);
  const downRamp = new THREE.Mesh(downGeo, rampMat);
  const downAngle = Math.atan2(PLATFORM_HEIGHT, PLATFORM_RAMP_LENGTH);
  downRamp.rotation.x = -Math.PI / 2 - downAngle;
  downRamp.position.set(0, PLATFORM_HEIGHT / 2, cursor + PLATFORM_RAMP_LENGTH / 2);
  group.add(downRamp);
  cursor += PLATFORM_RAMP_LENGTH;

  return { group, totalLength: cursor };
}

function createSlot(scene) {
  return {
    active: false,
    type: 'ramp',
    entryStartZ: 0,
    entryEndZ: 0,
    deckEndZ: 0,
    exitEndZ: 0,
    triggered: false,
    triggerZ: 0,
    rampGroup: buildStretchGroup(scene, 'ramp'),
    jumpGroup: buildStretchGroup(scene, 'jump'),
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
    slot.rampGroup.group.visible = false;
    slot.jumpGroup.group.visible = false;
  }
}

// Spawns one stretch at the far spawn point (same SPAWN_Z as obstacles/
// enemies -- consistent, plenty of travel time to see it coming).
export function spawnPlatform(field, type) {
  const slot = field.pool.find((s) => !s.active);
  if (!slot) return;

  slot.active = true;
  slot.type = type;
  slot.entryStartZ = SPAWN_Z;
  slot.entryEndZ = SPAWN_Z + PLATFORM_RAMP_LENGTH;
  slot.deckEndZ = slot.entryEndZ + PLATFORM_DECK_LENGTH;
  slot.exitEndZ = slot.deckEndZ + PLATFORM_RAMP_LENGTH;
  slot.triggered = false;
  slot.triggerZ = 0;

  const activeVisual = type === 'ramp' ? slot.rampGroup : slot.jumpGroup;
  const idleVisual = type === 'ramp' ? slot.jumpGroup : slot.rampGroup;
  activeVisual.group.visible = true;
  activeVisual.group.position.z = slot.entryStartZ;
  idleVisual.group.visible = false;
}

export function updatePlatformField(field, dt, speed) {
  const dz = speed * dt;
  for (const slot of field.pool) {
    if (!slot.active) continue;
    slot.entryStartZ += dz;
    slot.entryEndZ += dz;
    slot.deckEndZ += dz;
    slot.exitEndZ += dz;

    const activeVisual = slot.type === 'ramp' ? slot.rampGroup : slot.jumpGroup;
    activeVisual.group.position.z = slot.entryStartZ;

    // entryStartZ (the BACK edge, furthest from camera) is the last point
    // of the whole stretch to clear the despawn line -- exitEndZ (the
    // FRONT edge, 124 units further along) clears it first, ~7.75s
    // earlier, which was the actual bug here: checking exitEndZ recycled
    // the entire stretch (and hid its geometry) while its back half was
    // still ~110 units away, long before the player could ever reach it.
    if (slot.entryStartZ > DESPAWN_Z) {
      slot.active = false;
      slot.rampGroup.group.visible = false;
      slot.jumpGroup.group.visible = false;
    }
  }
}

function findSlotAt(field, z) {
  for (const slot of field.pool) {
    if (!slot.active) continue;
    if (z >= slot.entryStartZ && z <= slot.exitEndZ) return slot;
  }
  return null;
}

// Physical deck height at `z`, ignoring any player input -- what obstacles/
// enemies sit at (entities/obstacles.js, entities/enemy.js), and what the
// player follows automatically on a ramp-type entry.
export function getWorldElevationAt(field, z) {
  const slot = findSlotAt(field, z);
  if (!slot) return 0;

  if (z < slot.entryEndZ) {
    if (slot.type === 'jump') return 0; // gap -- deck hasn't started yet
    return smoothstep(clamp01((z - slot.entryStartZ) / PLATFORM_RAMP_LENGTH));
  }
  if (z < slot.deckEndZ) return 1;
  return 1 - smoothstep(clamp01((z - slot.deckEndZ) / PLATFORM_RAMP_LENGTH));
}

// The PLAYER's own elevation at `z` -- identical to getWorldElevationAt for
// a ramp-type stretch (forced), but for a jump-type stretch only rises if
// they actually triggered it (see triggerPlatformJump), from the exact z
// they pressed jump, over PLATFORM_JUMP_RISE_LENGTH -- independent of where
// the deck's own edge happens to be.
export function getPlayerElevationAt(field, z) {
  const slot = findSlotAt(field, z);
  if (!slot) return 0;
  if (slot.type === 'ramp') return getWorldElevationAt(field, z);

  if (!slot.triggered) return 0;
  if (z < slot.deckEndZ) {
    return smoothstep(clamp01((z - slot.triggerZ) / PLATFORM_JUMP_RISE_LENGTH));
  }
  return 1 - smoothstep(clamp01((z - slot.deckEndZ) / PLATFORM_RAMP_LENGTH));
}

// Called on the player's jump-press (core/main.js) -- if `playerZ` currently
// falls within an active, not-yet-triggered jump-type entry's pre-deck
// span, marks it triggered from this exact z. A press outside any jump
// entry's window, or on a ramp-type stretch, or a second press on an
// already-triggered one, is simply ignored (falls through to the player's
// normal jump arc, entities/player.js's startPlayerJump).
export function triggerPlatformJump(field, playerZ) {
  const slot = findSlotAt(field, playerZ);
  if (!slot || slot.type !== 'jump' || slot.triggered) return false;
  if (playerZ >= slot.deckEndZ) return false; // too late, already past the deck edge
  slot.triggered = true;
  slot.triggerZ = playerZ;
  return true;
}
