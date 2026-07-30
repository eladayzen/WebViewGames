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
import { PLATFORM_BOX_TEXTURE, PLATFORM_RAMP_TEXTURE } from '../data/envArt.js';
import { PLATFORM_FOOTPRINT_EXCLUSION_BUFFER, PLATFORM_DECK_PLACEMENT_MAX_Z } from '../data/spawnConfig.js';
import { getTexture } from './textureLoader.js';

const POOL_SIZE = 6;
const PLATFORM_WIDTH = LANE_WIDTH * 0.85; // fits within one lane, matches entities/obstacles.js's barricade-width convention

const clamp01 = (t) => Math.max(0, Math.min(1, t));
// Smoothstep -- eased at both ends (zero rate of change at t=0 and t=1), so
// a rise/fall reads as a curve, not a linear ramp with hard corners at the
// transitions.
const smoothstep = (t) => t * t * (3 - 2 * t);

// Real Kolbo-illustrated art (data/envArt.js's PLATFORM_BOX_TEXTURE /
// PLATFORM_RAMP_TEXTURE), replacing the earlier flat-color placeholders
// (blue ramp, near-white box, both of which read as too close in hue/
// luminance to street.js's pale sky-blue fog/background -- direct feedback:
// platforms were "appearing all of a sudden" instead of being visible
// approaching from a distance). Both textures are warm/dark/saturated by
// design specifically to stay legible against that fog at any distance.
//
// Tiles `texEntry` along a mesh axis whose UV runs 0..1 CLAMPED across
// `crossSpan` (no repeat -- exactly one undistorted texture-width fits
// there) and 0..1 REPEATED across `tiledSpan` -- same technique as
// street.js's tiledFacadeMaterial (its building end-caps have the identical
// U-clamped/V-tiled axis layout this needs), just factored locally here
// since platform.js is its only caller. Used for the ramp's slope (UV
// authored below) and the box's top face (BoxGeometry's own default UV has
// +Y's U on the box's width axis, V on its depth/length axis -- the same
// clamped/tiled split).
function tiledLengthMaterial(texEntry, crossSpan, tiledSpan) {
  const tex = getTexture(texEntry.url).clone();
  tex.needsUpdate = true;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  const tileSpan = crossSpan * texEntry.aspect;
  tex.repeat.set(1, tiledSpan / tileSpan);
  return new THREE.MeshBasicMaterial({ map: tex });
}

// Mirrored version for the box's +X/-X side walls: BoxGeometry maps those
// faces' U to the box's depth/length axis and V to its height axis -- the
// tile axis is on U here instead of V, so wrapS/wrapT (and which span feeds
// the repeat count vs. the clamp) swap accordingly.
function tiledSideMaterial(texEntry, crossSpan, tiledSpan) {
  const tex = getTexture(texEntry.url).clone();
  tex.needsUpdate = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  const tileSpan = crossSpan / texEntry.aspect;
  tex.repeat.set(tiledSpan / tileSpan, 1);
  return new THREE.MeshBasicMaterial({ map: tex });
}

function createRampMaterial() {
  // PLATFORM_WIDTH is the clamped (undistorted, no-repeat) cross axis,
  // PLATFORM_RAMP_LENGTH the tiled axis -- matches the UV buildWedgeGeometry
  // authors on the slope face (u: 0..1 across width, v: 0..1 low->high).
  const mat = tiledLengthMaterial(PLATFORM_RAMP_TEXTURE, PLATFORM_WIDTH, PLATFORM_RAMP_LENGTH);
  mat.side = THREE.DoubleSide; // unchanged from the placeholder -- see buildWedgeGeometry's winding-order history
  return mat;
}

// Box faces that are never actually seen (bottom -- flush with the street;
// front/back -- flush against the entry/exit wedge or the far edge) get a
// flat color sampled from the box texture's own average tone instead of an
// unrelated placeholder hue -- same "never a procedural-looking flat fill"
// convention street.js's building bodyColor already established.
const BOX_NEVER_SEEN_COLOR = 0x613318;

// Kill barrier: still the flat black placeholder -- out of scope for this
// art pass (disabled via PLATFORM_KILL_TYPE_ENABLED anyway), but kept
// visually distinct from the now-illustrated ramp/box so it'd still read
// unmistakably as "this one kills you" if re-enabled.
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
  // UV, one pair per vertex (this is an indexed geometry with shared
  // vertices, not one vertex per face-corner, so a single UV per vertex has
  // to serve every triangle that reuses it -- see the per-vertex layout
  // comment above). The SLOPE face (0,4,5 / 0,5,1) is the one that has to be
  // exactly right: it uses only v0,v1,v4,v5, and their UVs below form a
  // clean, correctly-oriented unit square on it --
  //   v0 (0,0) ---- v1 (1,0)   <- low/ground end (z=0, y=0), v=0
  //     |              |
  //   v4 (0,1) ---- v5 (1,1)   <- high end (z=length, y=height, butts the box), v=1
  // u runs 0->1 left(-w2)->right(w2) at both ends, matching createRampMaterial's
  // clamped width axis; v runs 0->1 low->high, matching its repeated length
  // axis -- so the texture reads bottom-to-top as ground-to-box, right-side
  // up. v2/v3 (bottom-back/never-seen bottom+back faces, plus the two
  // triangular end caps 0,2,4 / 1,3,5) aren't used by the slope face at all,
  // so their UVs just need to be non-degenerate for those never/rarely-seen
  // faces, not aesthetically tuned.
  const uv = new Float32Array([
    0, 0, // v0
    1, 0, // v1
    1, 0, // v2
    0, 0, // v3
    0, 1, // v4
    1, 1, // v5
  ]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(v, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
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
  // BoxGeometry material-array face order: [+X, -X, +Y, -Y, +Z, -Z]. Only
  // +Y (the walkable top deck) is a face the player actually looks at/stands
  // on; +X/-X (the long side walls, visible at an angle from an adjacent
  // lane) get the same crate art tiled the other way (tiledSideMaterial);
  // -Y (bottom, flush with the street) and +Z/-Z (front/back, flush against
  // the entry/exit wedge or the far despawn edge) are never seen and stay a
  // flat color matched to the texture's own tone (BOX_NEVER_SEEN_COLOR),
  // same convention as street.js's building bodyColor.
  const boxTopMat = tiledLengthMaterial(PLATFORM_BOX_TEXTURE, PLATFORM_WIDTH, PLATFORM_DECK_LENGTH);
  const boxSideMat = tiledSideMaterial(PLATFORM_BOX_TEXTURE, PLATFORM_HEIGHT, PLATFORM_DECK_LENGTH);
  const boxNeverSeenMat = new THREE.MeshBasicMaterial({ color: BOX_NEVER_SEEN_COLOR });
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(PLATFORM_WIDTH, PLATFORM_HEIGHT, PLATFORM_DECK_LENGTH),
    [boxSideMat, boxSideMat, boxTopMat, boxNeverSeenMat, boxNeverSeenMat, boxNeverSeenMat],
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
    // deckStartZ..deckEndZ is the ONLY z-range on a platform slot that any
    // entity-placement logic (enemies, obstacles) may ever spawn something
    // into -- direct feedback's rule: nothing gets placed on a ramp
    // (entryStartZ..deckStartZ, or deckEndZ..exitEndZ on the exit side),
    // only on the flat box/deck itself. Ramps are a climbing transition,
    // not stable stand-ground. entities/enemy.js's findDeckPlacements is
    // the only thing that currently exercises this (obstacles still avoid
    // the whole footprint entirely, see isPlatformFootprintBlocked).
    deckStartZ: 0, // where the flat top begins (full height from here on)
    deckEndZ: 0, // where the flat top ends
    exitEndZ: 0, // ramp-type: where the exit wedge finishes descending to 0; kill-type: === deckEndZ (still a hard step, entities/player.js's gravity handles that fall)
    cleared: false, // kill-type only: sticky once airborne-at-contact, see getPlayerElevationAt
    deckEnemyPlaced: false, // ramp-type only: caps findDeckPlacements at one enemy per platform, see spawnEnemy's deck-placement branch
    rampCoinsPlaced: false, // ramp-type only: caps findActiveRampSpans at one coin trail per platform -- separate from deckEnemyPlaced on purpose, a deck enemy and ramp coins can coexist
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
  slot.deckEnemyPlaced = false;
  slot.rampCoinsPlaced = false;

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

// Direct feedback: obstacles/enemies must never spawn overlapping an active
// platform's footprint (ramps OR the deck in between) in the same lane --
// two reasons stacked together: forced onto a ramp while also dodging/
// fighting something doesn't work visually or as a fair dodge, AND the deck
// is a solid, opaque box (y=0..PLATFORM_HEIGHT) -- a street-level sprite
// spawned inside that same footprint would render entirely hidden behind
// it, an invisible hazard. entities/obstacles.js and entities/enemy.js call
// findOpenLane (below) at their own spawn time to pick a lane that's
// actually clear (or skip the spawn attempt entirely if every lane is
// blocked) -- same "checked once at spawn time, holds for the entity's
// whole lifetime" reasoning as MIN_ENEMY_OBSTACLE_GAP_SEC
// (data/spawnConfig.js): every active entity scrolls at the same
// FORWARD_SPEED, so once the later-spawning one's relative gap is clear
// here, it never changes.
//
// PLATFORM_FOOTPRINT_EXCLUSION_BUFFER (data/spawnConfig.js) pads both ends
// of the WHOLE span beyond its own length, so there's real dodge room, not
// a razor-thin gap at the platform's actual edge. Checks every active slot
// regardless of type -- kill-type has no ramp span (entryStartZ ===
// deckStartZ) but is still a solid box needing the same exclusion.
export function isPlatformFootprintBlocked(field, lane, z) {
  for (const slot of field.pool) {
    if (!slot.active || slot.lane !== lane) continue;
    if (z >= slot.entryStartZ - PLATFORM_FOOTPRINT_EXCLUSION_BUFFER
      && z <= slot.exitEndZ + PLATFORM_FOOTPRINT_EXCLUSION_BUFFER) return true;
  }
  return false;
}

// Shared by entities/obstacles.js and entities/enemy.js (both used to
// duplicate this exact loop locally) -- a random lane among those NOT
// currently blocked by isPlatformFootprintBlocked at this z, or null if
// every lane is blocked (caller should skip the spawn attempt entirely).
export function findOpenLane(field, z) {
  const open = [];
  for (let lane = 0; lane < LANE_X.length; lane++) {
    if (!isPlatformFootprintBlocked(field, lane, z)) open.push(lane);
  }
  if (open.length === 0) return null;
  return open[Math.floor(Math.random() * open.length)];
}

// Direct feedback: enemies should actually stand on top of an elevated
// platform's deck sometimes, not just avoid platforms entirely. Platforms/
// obstacles/enemies all default-spawn at the same fixed SPAWN_Z and scroll
// at the same FORWARD_SPEED, so a deck's z-range (always entryStartZ +
// PLATFORM_RAMP_LENGTH or later) can never reach back to SPAWN_Z itself --
// a normal spawn can never coincidentally land on an EXISTING platform's
// deck. This is the deliberate path that does it on purpose, used by
// entities/enemy.js's spawnEnemy.
//
// Returns one candidate per eligible active ramp-type slot (kill-type
// excluded -- no exit ramp, out of scope here), each a random z within the
// deck's own span minus a small margin so the enemy doesn't spawn right at
// the ramp/deck seam. Eligibility is bounded by the FARTHEST z this could
// possibly produce (deckEndZ - margin), not deckStartZ, so a placement can
// never land closer than PLATFORM_DECK_PLACEMENT_MAX_Z regardless of when
// in its window the roll happens -- this also naturally excludes ramp-up-
// window platforms (their deckStartZ already starts too close), keeping
// that already-busy intro stretch from also gaining this mechanic.
// `claim()` sets deckEnemyPlaced on that slot (rather than exposing the
// slot itself) so at most one enemy ever lands on a given platform's deck,
// no matter how many spawn attempts land inside the eligibility window.
const DECK_PLACEMENT_MARGIN = 3; // world units, both ends
export function findDeckPlacements(field) {
  const candidates = [];
  for (const slot of field.pool) {
    if (!slot.active || slot.type !== 'ramp' || slot.deckEnemyPlaced) continue;
    const usableStart = slot.deckStartZ + DECK_PLACEMENT_MARGIN;
    const usableEnd = slot.deckEndZ - DECK_PLACEMENT_MARGIN;
    if (usableEnd <= usableStart) continue;
    if (usableEnd >= PLATFORM_DECK_PLACEMENT_MAX_Z) continue;
    candidates.push({
      lane: slot.lane,
      z: usableStart + Math.random() * (usableEnd - usableStart),
      claim: () => { slot.deckEnemyPlaced = true; },
    });
  }
  return candidates;
}

// Every currently-placeable RAMP WEDGE span (entry and exit both) across
// active ramp-type platforms -- used by entities/coins.js to lay a coin
// trail up/down a slope. Direct feedback explicitly wants collectibles
// "climbing on ramps"; note this is a deliberate carve-out from the
// otherwise-standing rule that nothing gets PLACED on a ramp (an enemy or
// obstacle standing on an incline reads wrong -- a floating coin doesn't,
// and a player on a ramp is carried up it automatically, so ramp coins need
// no jump at all).
//
// A separate function rather than a generalization of findDeckPlacements
// above: that returns a single random POINT plus an enemy-specific claim,
// this returns a SPAN and covers both wedges -- parameterizing both
// differences would make each caller harder to read, not easier.
//
// Guards mirror findDeckPlacements' reasoning:
//  - Eligibility is bounded on each span's NEAR end (its larger z, the edge
//    that reaches the player first), so the answer can't depend on when
//    inside its window the caller happens to roll -- same
//    PLATFORM_DECK_PLACEMENT_MAX_Z "must still be far enough away to be
//    seen arriving, not pop in mid-journey" rule.
//  - claim() sets its OWN rampCoinsPlaced flag (not deckEnemyPlaced) so at
//    most one coin trail lands per platform, while still allowing a
//    deck-placed enemy on the same platform -- those two are perfectly
//    compatible and shouldn't block each other. Both wedges of one platform
//    share the flag, so claiming either consumes the whole platform.
//
// Kill-type slots are excluded (as everywhere else here): they have no
// wedge at all -- entryStartZ === deckStartZ, a hard vertical step -- so a
// coin crossing that z would teleport 3.5 units rather than ride a slope.
// Inert while PLATFORM_KILL_TYPE_ENABLED is false, noted so it isn't
// rediscovered as a bug later.
export function findActiveRampSpans(field) {
  const spans = [];
  for (const slot of field.pool) {
    if (!slot.active || slot.type !== 'ramp' || slot.rampCoinsPlaced) continue;
    const claim = () => { slot.rampCoinsPlaced = true; };
    const wedges = [
      [slot.entryStartZ, slot.deckStartZ], // climbing up
      [slot.deckEndZ, slot.exitEndZ], // climbing down
    ];
    for (const [startZ, endZ] of wedges) {
      if (endZ >= PLATFORM_DECK_PLACEMENT_MAX_Z) continue; // near end already too close
      spans.push({ lane: slot.lane, startZ, endZ, claim });
    }
  }
  return spans;
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
