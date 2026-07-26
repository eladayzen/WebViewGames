// Environment art (build doc §0, §9.1's environment-art correction): real
// Kolbo-illustrated 2D textures for the street/sidewalk surface, building
// facades, and a distant skyline matte painting -- replacing the flat-
// colored placeholder materials from the initial POC pass. Used UNLIT
// (MeshBasicMaterial) in street.js so the painted-in shading/lighting reads
// as intended instead of getting re-shaded by the scene's real-time lights.
//
// Bright, cheerful, semi-casual DAYLIGHT palette per direct playtest
// feedback -- an explicit pivot away from the build doc's original sunset-
// to-neon dusk vision (§1); the first dusk-toned art pass read as grim/
// twilight rather than alive and happy.
//
// Each entry carries its real pixel dimensions so street.js can size its
// tile/decal geometry to the art's OWN aspect ratio instead of stretching it
// to fit an unrelated shape -- that mismatch (a portrait shopfront crop
// forced onto an extremely tall/narrow box face, a portrait street-cross-
// section image forced onto a wide/short tile cell) is what caused the
// smeared, distorted first pass.
function envTexture(file, w, h) {
  return { url: new URL(`../assets/${file}`, import.meta.url).href, w, h, aspect: h / w };
}

export const STREET_TEXTURE = envTexture('street_tex.png', 576, 768);

// Two facade variants (a flower-boxed brick tenement with a mural-painted
// shutter, a cheerful "Sunny Day Books & Gifts" shopfront) -- alternated
// across building instances by index for cheap variety without generating a
// full per-building library (§2 "keep art generation minimal" instinct).
// Average color of each sampled below for BUILDING_BODY_COLORS in street.js
// -- a warm brick/tan tone matching each facade instead of a generic
// (previously purple, explicitly flagged as looking "procedurally
// generated") placeholder color for the faces the decal doesn't cover.
export const FACADE_TEXTURES = [
  envTexture('facade_a.png', 628, 768), // brick tenement, avg #935534
  envTexture('facade_b.png', 621, 768), // Sunny Day shopfront, avg #988549
];
export const FACADE_BODY_COLORS = [0x935534, 0x988549];

// Distant skyline matte painting -- a wide backdrop sitting far past the
// buildings' recycle range, rendered fog-immune (material.fog = false, set
// in street.js) so it stays fully visible instead of fading to the fog
// color at that distance, the same way a skybox is conventionally exempted
// from scene fog. Bright daylight blue-sky version (matching the street/
// facade mood) -- an orange dusk/matte-painting variant referencing
// pipeline/build-docs/laneRunnerRef.png was tried and reverted: it clashed
// badly against the cheerful daylight foreground, reading as an ominous
// burning-city backdrop rather than depth/atmosphere. Don't reintroduce that
// warm-toned skyline without also reconsidering the foreground palette.
export const SKYLINE_TEXTURE = envTexture('skyline.png', 1600, 906);

// Barricade lane-blocker obstacle -- real Kolbo art matching laneRunnerRef's
// orange/white A-frame design (§5.3, §6), replacing the flat solid-color
// placeholder sprite.
export const BARRICADE_TEXTURE = envTexture('barricade.png', 640, 585);
