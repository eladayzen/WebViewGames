// Flat, straight 3-lane city street (build doc §5.1, §9.1): a real 3D
// perspective scene -- reusing this repo's existing flat-3D-street precedent
// (CarRacer/src/road.js -- a flat road segment with fixed lane positions)
// rather than the tube/spline-corridor technique this pipeline also has
// (Astro_Tunnel/TmntSewerSlide) -- this game is a street, not a tube.
//
// Environment art (§0, §9.1's correction): the street/sidewalk surface,
// EVERY visible building face, and a distant skyline matte painting all use
// real Kolbo-illustrated 2D textures (data/envArt.js) via UNLIT
// MeshBasicMaterial. Direct playtest feedback flagged two things the first
// art pass got wrong, both fixed here:
//  1. Any face the camera can actually see must be textured, never a flat
//     placeholder color -- the depth-facing "end-cap" faces (+Z/-Z) turned
//     out to be clearly visible at this camera's angle (not hidden as
//     assumed), reading as jarring flat-purple gaps. Every visible face now
//     gets the SAME facade texture as the front, tiled vertically
//     (RepeatWrapping, sized to the texture's own aspect) to cover the
//     building's full height without the smeared stretch of the very first
//     pass. Only the truly-never-seen roof/floor/back faces stay a flat
//     color, and even that now matches the facade art's own average tone
//     (envArt.js's FACADE_BODY_COLORS) instead of an unrelated placeholder
//     hue -- a stray glimpse should read as "this building's own wall
//     color," not a procedural-looking flat fill.
//  2. The palette itself pivoted from the build doc's original sunset-to-
//     neon dusk vision to a bright, cheerful, semi-casual DAYLIGHT mood per
//     direct feedback -- the dusk pass read as grim/twilight, not alive.
//
// Buildings scroll toward the camera each frame and recycle at the far end
// (reusing CarRacer/src/pylons.js's per-slot scroll+wrap technique) -- the
// road/sidewalk plane doesn't need this (a single texture spanning its whole
// length shows no motion either way, though its own texture offset scrolls
// instead, see updateStreet). The skyline backdrop is fog-immune
// (material.fog = false) and never scrolls -- it's meant to read as
// infinitely distant, the same way a skybox is conventionally exempt from
// scene fog.

import * as THREE from 'three';
import { LANE_WIDTH, DESPAWN_Z } from '../data/constants.js';
import { getTexture } from '../entities/textureLoader.js';
import { STREET_TEXTURE, FACADE_TEXTURES, FACADE_BODY_COLORS, SKYLINE_TEXTURE } from '../data/envArt.js';

const STREET_LENGTH = 400;
const STREET_Z = -STREET_LENGTH / 2 + 20; // centered around the player, same convention as CarRacer/src/road.js
const ROAD_WIDTH = LANE_WIDTH * 3;
const SIDEWALK_WIDTH = 3.4;
const FULL_WIDTH = ROAD_WIDTH + SIDEWALK_WIDTH * 2;
// The street texture's own aspect dictates the undistorted tile length --
// forcing an arbitrary tile length would stretch/smear the art.
const STREET_TILE_LENGTH = FULL_WIDTH * STREET_TEXTURE.aspect;

// Raised from 22: packing buildings much closer together (see the gap
// pattern below) needs more of them to still cover the same STREET_LENGTH.
const BUILDING_COUNT_PER_SIDE = 42;
const BUILDING_RECYCLE_Z = DESPAWN_Z; // same "safe to recycle, past the camera" bound obstacles use
const BUILDING_BASE_X = ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 1.5;
// Sampled from street_tex.png's own sidewalk band (avg #d9caad) so the
// ground-filler strip (below) reads as a continuation of the same sidewalk,
// not a mismatched patch.
const SIDEWALK_FILLER_COLOR = 0xd9caad;
// Wide enough that its outer edge is never visible through even the
// largest building gap -- direct feedback flagged the sidewalk looking like
// it was "floating," which was the filler strip running out sideways.
const SIDEWALK_FILLER_WIDTH = 260;

// Building gaps: compressed way down per direct feedback -- the previous
// range's MINIMUM gap is now the MAXIMUM, and buildings are sometimes almost
// touching. Never fully 0, though -- exactly-touching boxes z-fight/clip at
// the shared seam, so there's always a small non-zero floor. Each side
// cycles through 1..6 (raw units, rescaled below) on a different stride/
// offset so left and right don't read as a mirrored or repeated motif.
function buildGapPattern(stride, offset) {
  const gaps = [];
  for (let i = 0; i < BUILDING_COUNT_PER_SIDE; i++) gaps.push(1 + ((i * stride + offset) % 6));
  return gaps;
}
const LEFT_GAP_PATTERN = buildGapPattern(7, 0);
const RIGHT_GAP_PATTERN = buildGapPattern(11, 3);

// Precomputes each building's {width, height, z} for one side, given its
// gap pattern -- widths/heights keep the original per-index formulas, only
// the spacing changes from a uniform slot to the irregular pattern above.
function layoutBuildingSlots(side, gapPattern) {
  const widths = [];
  const heights = [];
  for (let i = 0; i < BUILDING_COUNT_PER_SIDE; i++) {
    widths.push(6 + (i % 3));
    // Capped down from a ~4-story range (10-31) to ~3-story per direct
    // feedback -- buildings were reading too tall/high-rise for this street.
    heights.push(8 + ((i * 37 + (side > 0 ? 13 : 0)) % 10));
  }
  const widthSum = widths.reduce((a, b) => a + b, 0);
  const gapSum = gapPattern.reduce((a, b) => a + b, 0);
  const gapScale = (STREET_LENGTH - widthSum) / gapSum;

  const slots = [];
  let cursor = STREET_Z + STREET_LENGTH / 2;
  for (let i = 0; i < BUILDING_COUNT_PER_SIDE; i++) {
    const slotSize = widths[i] + gapPattern[i] * gapScale;
    slots.push({ width: widths[i], height: heights[i], z: cursor - slotSize / 2 });
    cursor -= slotSize;
  }
  return slots;
}

// Skyline backdrop placement: past the buildings' steady-state far bound
// (~-180) but inside camera.far, sized generously to fill the frame at that
// distance for the given vertical FOV/aspect (with margin for camera x-sway
// during lane changes) -- see main.js's CAMERA_FOV/ASPECT_W/H.
const SKYLINE_Z = -195;
const SKYLINE_WIDTH = 520;
const SKYLINE_HEIGHT = SKYLINE_WIDTH * SKYLINE_TEXTURE.aspect;
const SKYLINE_Y = 60;

// Builds a MeshBasicMaterial that tiles `texEntry` (an envArt.js entry, with
// its own real aspect ratio) vertically to cover `faceHeight`, sized against
// `faceWidth` so the art's own proportions stay undistorted -- the fix for
// the first pass's stretched-onto-the-whole-face look.
function tiledFacadeMaterial(texEntry, faceWidth, faceHeight) {
  const tex = getTexture(texEntry.url).clone();
  tex.needsUpdate = true;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  const tileHeight = faceWidth * texEntry.aspect;
  tex.repeat.set(1, faceHeight / tileHeight);
  return new THREE.MeshBasicMaterial({ map: tex });
}

export function createStreet(scene) {
  // Bright, cheerful daytime backdrop (§0/§9.1's correction plus the
  // daylight-mood pivot) -- fog color matches the skyline art's own sky tone
  // so buildings fading into the distance blend into it rather than a
  // mismatched hue.
  scene.background = new THREE.Color(0x8fc7e8);
  scene.fog = new THREE.Fog(0x9fd2ec, 70, 180);

  const group = new THREE.Group();

  // Distant skyline matte painting -- fog-immune so it stays fully visible
  // regardless of distance, filling in "beyond the last building" instead of
  // a flat color void.
  const skylineTex = getTexture(SKYLINE_TEXTURE.url);
  const skylineMat = new THREE.MeshBasicMaterial({ map: skylineTex, fog: false });
  const skyline = new THREE.Mesh(new THREE.PlaneGeometry(SKYLINE_WIDTH, SKYLINE_HEIGHT), skylineMat);
  skyline.position.set(0, SKYLINE_Y, SKYLINE_Z);
  scene.add(skyline);

  // Combined street cross-section (sidewalk + road + sidewalk in one plane,
  // matching how the generated texture itself depicts the full width) --
  // tiled vertically along the direction of travel via RepeatWrapping, at
  // the texture's OWN aspect ratio so the painted crack/grime detail reads
  // undistorted instead of stretched to an arbitrary tile length.
  const streetTexture = getTexture(STREET_TEXTURE.url);
  streetTexture.wrapS = THREE.ClampToEdgeWrapping;
  streetTexture.wrapT = THREE.RepeatWrapping;
  streetTexture.repeat.set(1, STREET_LENGTH / STREET_TILE_LENGTH);
  const streetMat = new THREE.MeshBasicMaterial({ map: streetTexture });
  const streetPlane = new THREE.Mesh(new THREE.PlaneGeometry(FULL_WIDTH, STREET_LENGTH), streetMat);
  streetPlane.rotation.x = -Math.PI / 2;
  streetPlane.position.set(0, 0, STREET_Z);
  group.add(streetPlane);

  // Ground filler: the sidewalk texture plane above stops at FULL_WIDTH/2,
  // short of where the building boxes actually start (buildingBaseX below) --
  // without this, that gap showed bare background/void at ground level
  // instead of continuous ground (direct playtest feedback: the sidewalk
  // must always be what's visible at a building's base, never a void).
  // Flat-colored, sampled from the sidewalk texture's own tone rather than
  // an unrelated placeholder color, so the join reads as a continuation of
  // the same sidewalk, not a seam.
  const fillerMat = new THREE.MeshBasicMaterial({ color: SIDEWALK_FILLER_COLOR });
  for (const side of [-1, 1]) {
    const filler = new THREE.Mesh(new THREE.PlaneGeometry(SIDEWALK_FILLER_WIDTH, STREET_LENGTH), fillerMat);
    filler.rotation.x = -Math.PI / 2;
    filler.position.set(side * (FULL_WIDTH / 2 + SIDEWALK_FILLER_WIDTH / 2 - 1), -0.01, STREET_Z);
    group.add(filler);
  }

  // Lane-divider stripes (flat planes, not part of the street texture -- the
  // generated art's own baked stripe was patched out locally since it was a
  // single 2-lane centerline, not this game's 2 dividers for 3 lanes) -- a
  // readability aid so the 3 lanes are unambiguous at a glance.
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.14, STREET_LENGTH), stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(side * LANE_WIDTH * 0.5, 0.02, STREET_Z);
    group.add(stripe);
  }

  // Building facades: boxes receding on both sides. EVERY face the camera
  // can plausibly see -- the street-facing wall AND both depth-facing end
  // caps -- gets the same facade texture, tiled vertically to cover the
  // building's full height undistorted. Only the true never-seen faces
  // (roof, floor, the far/back wall) stay a flat color, matched to that
  // facade's own average tone rather than an unrelated placeholder hue.
  // Each building is grouped so its z can scroll as one unit and recycle
  // (see updateStreet below).
  const buildingSlots = [];
  for (const side of [-1, 1]) {
    const layout = layoutBuildingSlots(side, side > 0 ? RIGHT_GAP_PATTERN : LEFT_GAP_PATTERN);
    for (let i = 0; i < BUILDING_COUNT_PER_SIDE; i++) {
      const { width, height, z } = layout[i];
      const depth = 8;
      const x = side * (BUILDING_BASE_X + width / 2);

      const facadeIdx = (i + (side > 0 ? 1 : 0)) % FACADE_TEXTURES.length;
      const texEntry = FACADE_TEXTURES[facadeIdx];
      const bodyColor = FACADE_BODY_COLORS[facadeIdx];

      const slotGroup = new THREE.Group();
      slotGroup.position.set(x, 0, z);
      group.add(slotGroup);

      // BoxGeometry material-array face order: [+X, -X, +Y, -Y, +Z, -Z].
      // The wall nearer the road is local -X for right-side buildings
      // (side > 0, whose group sits at a large +X, so the near face is at
      // local x = -width/2) and local +X for left-side buildings (center at
      // a large -X, near face local +X).
      const roadFacingIndex = side > 0 ? 1 : 0;
      const backIndex = roadFacingIndex === 0 ? 1 : 0;
      const neverSeenMat = new THREE.MeshBasicMaterial({ color: bodyColor });
      const materials = [null, null, neverSeenMat, neverSeenMat, null, null];
      materials[roadFacingIndex] = tiledFacadeMaterial(texEntry, depth, height);
      materials[backIndex] = neverSeenMat;
      materials[4] = tiledFacadeMaterial(texEntry, width, height); // +Z end cap
      materials[5] = tiledFacadeMaterial(texEntry, width, height); // -Z end cap

      const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials);
      building.position.set(0, height / 2, 0);
      slotGroup.add(building);

      buildingSlots.push({ slotGroup, z });
    }
  }

  scene.add(group);
  return { group, buildingSlots, streetTexture };
}

// Scrolls every building slot toward the camera at the given speed, wrapping
// each back out to the far end once it passes the recycle bound -- same
// per-slot scroll+wrap technique as CarRacer/src/pylons.js's pillar bands.
// Also scrolls the (static, never-recycled) street plane's own texture
// offset at the same speed -- the plane geometry itself never moves, so
// without this the road/sidewalk surface read as completely still while
// everything else scrolled.
export function updateStreet(street, dt, speed) {
  const scroll = speed * dt;
  for (const slot of street.buildingSlots) {
    slot.z += scroll;
    if (slot.z > BUILDING_RECYCLE_Z) slot.z -= STREET_LENGTH;
    slot.slotGroup.position.z = slot.z;
  }
  street.streetTexture.offset.y += scroll / STREET_TILE_LENGTH;
}
