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
//     color, matched to that theme's facade average tone instead of an
//     unrelated placeholder hue -- a stray glimpse should read as "this
//     building's own wall color," not a procedural-looking flat fill.
//  2. The palette itself pivoted from the build doc's original sunset-to-
//     neon dusk vision to a bright, cheerful, semi-casual DAYLIGHT mood per
//     direct feedback -- the dusk pass read as grim/twilight, not alive.
//
// THEMES (data/envArt.js's THEMES map, §5.4's per-block re-theming): every
// piece of environment art AND the building size/spacing profile comes from
// the active theme, so a new theme (e.g. a "central city" reskin with
// longer/taller buildings and denser facade detail) can be built alongside
// an existing one without touching its numbers -- createStreet(scene,
// themeKey) picks one.
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
import { THEMES } from '../data/envArt.js';

const STREET_LENGTH = 400;
const STREET_Z = -STREET_LENGTH / 2 + 20; // centered around the player, same convention as CarRacer/src/road.js
const ROAD_WIDTH = LANE_WIDTH * 3;
const SIDEWALK_WIDTH = 3.4;
const FULL_WIDTH = ROAD_WIDTH + SIDEWALK_WIDTH * 2;

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

// Building gaps (buildingProfile.gapMin/gapRange/*GapStride/*GapOffset):
// compressed way down per direct feedback -- buildings are sometimes almost
// touching. Never fully 0, though -- exactly-touching boxes z-fight/clip at
// the shared seam, so there's always a small non-zero floor (gapMin). Each
// side cycles through gapMin..gapMin+gapRange-1 (raw units, rescaled below)
// on its own stride/offset so left and right don't read as a mirrored or
// repeated motif.
function buildGapPattern(count, gapMin, gapRange, stride, offset) {
  const gaps = [];
  for (let i = 0; i < count; i++) gaps.push(gapMin + ((i * stride + offset) % gapRange));
  return gaps;
}

// Precomputes each building's {width, height, z} for one side, per the
// active theme's buildingProfile. Raw gap units get rescaled so
// width+gap sums to exactly STREET_LENGTH -- required for the per-building
// recycle-by-400 wrap (updateStreet) to tile seamlessly with no seam-point
// overlap/stretch.
function layoutBuildingSlots(side, profile) {
  const { count, widthCycle, heightBase, heightMod, heightSideOffset } = profile;
  const gapPattern = buildGapPattern(
    count, profile.gapMin, profile.gapRange,
    side > 0 ? profile.rightGapStride : profile.leftGapStride,
    side > 0 ? profile.rightGapOffset : profile.leftGapOffset,
  );

  const widths = [];
  const heights = [];
  for (let i = 0; i < count; i++) {
    widths.push(widthCycle[i % widthCycle.length]);
    heights.push(heightBase + ((i * 37 + (side > 0 ? heightSideOffset : 0)) % heightMod));
  }
  const widthSum = widths.reduce((a, b) => a + b, 0);
  const gapSum = gapPattern.reduce((a, b) => a + b, 0);
  const gapScale = (STREET_LENGTH - widthSum) / gapSum;

  const slots = [];
  let cursor = STREET_Z + STREET_LENGTH / 2;
  for (let i = 0; i < count; i++) {
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

export function createStreet(scene, themeKey = 'centralCity') {
  const theme = THEMES[themeKey];

  // Bright, cheerful daytime backdrop (§0/§9.1's correction plus the
  // daylight-mood pivot) -- fog color matches the skyline art's own sky tone
  // so buildings fading into the distance blend into it rather than a
  // mismatched hue. Shared across themes for now (every theme is daylight
  // per direct confirmation) -- move into the theme data if a future theme
  // needs its own mood.
  scene.background = new THREE.Color(0x8fc7e8);
  // THREE.Fog has no direct alpha/opacity control -- its blend-toward-
  // fog-color factor is linear in 1/(far-near), so per direct feedback
  // ("the tint's too strong, cut it by half") the span is doubled here
  // (110 -> 220) rather than the color touched: that scales the blend
  // factor down by exactly half at every distance, same near falloff start.
  scene.fog = new THREE.Fog(0x9fd2ec, 70, 290);

  const group = new THREE.Group();

  // Distant skyline matte painting -- fog-immune so it stays fully visible
  // regardless of distance, filling in "beyond the last building" instead of
  // a flat color void.
  const skylineTex = getTexture(theme.skyline.url);
  const skylineMat = new THREE.MeshBasicMaterial({ map: skylineTex, fog: false });
  const skylineHeight = SKYLINE_WIDTH * theme.skyline.aspect;
  const skyline = new THREE.Mesh(new THREE.PlaneGeometry(SKYLINE_WIDTH, skylineHeight), skylineMat);
  skyline.position.set(0, SKYLINE_Y, SKYLINE_Z);
  // Added to `group`, NOT `scene` directly -- this is what lets disposeStreet
  // below tear down an entire theme (skyline included) with one scene.remove
  // call, now that the level-transition environment swap needs to do exactly
  // that. Purely a bookkeeping change: nothing about where the skyline renders
  // moves, since `group` itself sits at the scene's own origin.
  group.add(skyline);

  // Combined street cross-section (sidewalk + road + sidewalk in one plane,
  // matching how the generated texture itself depicts the full width) --
  // tiled vertically along the direction of travel via RepeatWrapping, at
  // the texture's OWN aspect ratio so the painted crack/grime detail reads
  // undistorted instead of stretched to an arbitrary tile length.
  const streetTexture = getTexture(theme.street.url);
  const streetTileLength = FULL_WIDTH * theme.street.aspect;
  streetTexture.wrapS = THREE.ClampToEdgeWrapping;
  streetTexture.wrapT = THREE.RepeatWrapping;
  streetTexture.repeat.set(1, STREET_LENGTH / streetTileLength);
  const streetMat = new THREE.MeshBasicMaterial({ map: streetTexture });
  const streetPlane = new THREE.Mesh(new THREE.PlaneGeometry(FULL_WIDTH, STREET_LENGTH), streetMat);
  streetPlane.rotation.x = -Math.PI / 2;
  streetPlane.position.set(0, 0, STREET_Z);
  group.add(streetPlane);

  // Ground filler: the sidewalk texture plane above stops at FULL_WIDTH/2,
  // short of where the building boxes actually start -- without this, that
  // gap showed bare background/void at ground level instead of continuous
  // ground (direct playtest feedback: the sidewalk must always be what's
  // visible at a building's base, never a void). Flat-colored, sampled from
  // the sidewalk texture's own tone rather than an unrelated placeholder
  // color, so the join reads as a continuation of the same sidewalk.
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
  // (see updateStreet below). Width/height/gap all come from the theme's
  // buildingProfile (data/envArt.js).
  const profile = theme.buildingProfile;
  const buildingSlots = [];
  for (const side of [-1, 1]) {
    const layout = layoutBuildingSlots(side, profile);
    for (let i = 0; i < profile.count; i++) {
      const { width, height, z } = layout[i];
      const depth = profile.depth;
      const x = side * (BUILDING_BASE_X + depth / 2); // depth is the across-road extent now

      const facadeIdx = (i + (side > 0 ? 1 : 0)) % theme.facades.length;
      const { tex: texEntry, bodyColor } = theme.facades[facadeIdx];

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

      // AXES: `width` is the FRONTAGE -- the building's extent ALONG the street
      // (Z), which is both what layoutBuildingSlots reserves per slot and the
      // horizontal span of the road-facing wall the player actually looks at.
      // `depth` is the thickness away from the road (X).
      //
      // These were previously swapped: the box was built as (width, height,
      // depth) = (X, Y, Z), which put `width` across the road and `depth` along
      // it -- so every slot reserved `width` of street while the box only filled
      // `depth`, and the visible frontage was driven by the field named "depth".
      // Harmless-looking while the two numbers happened to be close (8 vs 6-8 on
      // sunnyStreet), but it meant the frontage dial was the wrong field, and it
      // left a ~1-unit phantom gap per building.
      materials[roadFacingIndex] = tiledFacadeMaterial(texEntry, width, height);
      materials[backIndex] = neverSeenMat;
      materials[4] = tiledFacadeMaterial(texEntry, depth, height); // +Z end cap
      materials[5] = tiledFacadeMaterial(texEntry, depth, height); // -Z end cap

      const building = new THREE.Mesh(new THREE.BoxGeometry(depth, height, width), materials);
      building.position.set(0, height / 2, 0);
      slotGroup.add(building);

      buildingSlots.push({ slotGroup, z });
    }
  }

  scene.add(group);
  return { group, buildingSlots, streetTexture, streetTileLength };
}

// Tears down a whole theme -- the level-transition environment swap
// (core/main.js's startNextLevel) is the only caller: it's the one moment the
// screen is fully covered, so a teardown+rebuild here is free where it would
// be a visible stutter mid-run.
//
// Disposes every geometry and material under `street.group` (the skyline
// included, now that it's a child of group rather than the scene -- see
// createStreet's comment on that). Deliberately does NOT dispose any
// texture. Every texture reaching this code came from entities/
// textureLoader.js's getTexture(), which caches forever by URL specifically
// so a texture is loaded once and reused -- centralCity and sunnyStreet
// currently even share one street_tex.png through that cache. Disposing a
// cached texture here would leave the cache Map holding a dead reference
// that silently breaks every FUTURE getTexture() call for that URL,
// including a theme being switched back INTO later. The cost of leaving
// textures resident is bounded (this game has a handful of art files total)
// and is the correct trade against that failure mode.
export function disposeStreet(scene, street) {
  scene.remove(street.group);
  street.group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of materials) if (m) m.dispose();
    }
  });
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
  street.streetTexture.offset.y += scroll / street.streetTileLength;
}
