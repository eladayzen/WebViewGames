// Environment art (build doc §0, §9.1's environment-art correction, §5.4's
// per-block re-theming): real Kolbo-illustrated 2D textures for the street/
// sidewalk surface, building facades, and a distant skyline matte painting --
// replacing the flat-colored placeholder materials from the initial POC
// pass. Used UNLIT (MeshBasicMaterial) in street.js so the painted-in
// shading/lighting reads as intended instead of getting re-shaded by the
// scene's real-time lights.
//
// THEMES: everything environment-reskin-related (street/facade/skyline art
// plus the building size/spacing profile) is grouped per named theme, keyed
// by THEMES[key], so a new theme can be built alongside an existing one
// without disturbing it -- direct feedback explicitly asked to "lock" the
// first theme (sunnyStreet) while a second (centralCity, still pending its
// own art) gets built. street.js's createStreet(scene, themeKey) picks one;
// nothing about an existing theme's numbers changes when a new one is added.
//
// Each texture entry carries its real pixel dimensions so street.js can size
// its tile/decal geometry to the art's OWN aspect ratio instead of
// stretching it to fit an unrelated shape -- that mismatch (a portrait
// shopfront crop forced onto an extremely tall/narrow box face, a portrait
// street-cross-section image forced onto a wide/short tile cell) is what
// caused the smeared, distorted first pass.
function envTexture(file, w, h) {
  return { url: new URL(`../assets/${file}`, import.meta.url).href, w, h, aspect: h / w };
}

// Barricade lane-blocker obstacle -- real Kolbo art matching laneRunnerRef's
// orange/white A-frame design (§5.3, §6). A gameplay prop, not an
// environment reskin, so it's shared across every theme rather than
// duplicated per-theme.
export const BARRICADE_TEXTURE = envTexture('barricade.png', 640, 585);

// Foot Soldier -- new "bump-to-kill" enemy entity type (direct feedback's
// addition, not in the original build doc): a Foot Clan grunt standing in a
// lane, scrolled toward the camera like an obstacle, but dissolves into a
// particle poof + awards score on player contact instead of ending the run.
// Single idle-standing frame for this first pass, matching the barricade's
// single-static-frame pattern -- an idle breathing-loop sequence and a
// hit-reaction are deliberately deferred (see entities/enemy.js).
export const FOOT_SOLDIER_TEXTURE = envTexture('foot_soldier_0.png', 784, 900);

export const THEMES = {
  // Bright, cheerful, semi-casual DAYLIGHT palette per direct playtest
  // feedback -- an explicit pivot away from the build doc's original
  // sunset-to-neon dusk vision (§1); the first dusk-toned art pass read as
  // grim/twilight rather than alive and happy. LOCKED per direct feedback --
  // tune centralCity (or a future theme) instead of changing these numbers.
  sunnyStreet: {
    street: envTexture('street_tex.png', 576, 768),
    // Two facade variants (a flower-boxed brick tenement with a mural-
    // painted shutter, a cheerful "Sunny Day Books & Gifts" shopfront) --
    // alternated across building instances by index for cheap variety
    // without generating a full per-building library (§2 "keep art
    // generation minimal" instinct). bodyColor is each facade's own sampled
    // average tone, used on the never-seen box faces instead of a generic
    // (previously purple, explicitly flagged as looking "procedurally
    // generated") placeholder color.
    facades: [
      { tex: envTexture('facade_a.png', 628, 768), bodyColor: 0x935534 },
      { tex: envTexture('facade_b.png', 621, 768), bodyColor: 0x988549 },
    ],
    // Distant skyline matte painting -- fog-immune (material.fog = false,
    // set in street.js) so it stays fully visible at that distance, the same
    // way a skybox is conventionally exempted from scene fog. An orange
    // dusk/matte-painting variant referencing laneRunnerRef.png was tried
    // and reverted here: it clashed badly against this theme's cheerful
    // daylight foreground, reading as an ominous burning-city backdrop
    // rather than depth/atmosphere.
    skyline: envTexture('skyline.png', 1600, 906),
    buildingProfile: {
      widthCycle: [6, 7, 8], // building width (along the street) cycles through these
      depth: 8, // building depth (perpendicular to the street)
      heightBase: 8, heightMod: 10, heightSideOffset: 13, // height = heightBase + (i*37 + (side>0 ? heightSideOffset : 0)) % heightMod
      count: 42, // buildings per side
      gapMin: 1, gapRange: 6, // gap = gapMin + (i*stride + offset) % gapRange, rescaled to sum exactly to STREET_LENGTH
      leftGapStride: 7, leftGapOffset: 0,
      rightGapStride: 11, rightGapOffset: 3,
    },
  },

  // "Central City" -- first-pass, NOT YET ACTIVE (main.js still defaults to
  // sunnyStreet; nothing currently on screen changes until this is wired
  // in). Direct feedback: closer to laneRunnerRef.png's actual downtown-
  // street proportions/detail-scale, not sunnyStreet's boutique side-street.
  // Same bright daylight mood as sunnyStreet (kept per explicit
  // confirmation, not re-litigating time-of-day).
  //
  // STYLE CAVEAT: this facade pair nails the requested density (a real
  // small-scale multi-floor window grid, finally reading as a proper
  // downtown tower instead of 1-2 giant windows repeated by tiling), but
  // came back more photoreal-architectural than this game's cel-shaded
  // illustration style -- worth a restyle pass before shipping, not a
  // silent style regression to build around.
  //
  // No dedicated street/sidewalk texture yet -- reusing sunnyStreet's for
  // now (visibly a placeholder call, not a matched downtown-avenue surface).
  centralCity: {
    street: envTexture('street_tex.png', 576, 768), // TODO: dedicated downtown avenue texture
    facades: [
      { tex: envTexture('facade_c1.png', 626, 768), bodyColor: 0x8c7b61 }, // tan concrete office tower
      { tex: envTexture('facade_c2.png', 626, 768), bodyColor: 0x76503e }, // red-brick apartment tower
    ],
    skyline: envTexture('skyline.png', 1600, 906), // reused -- already a fitting daylight city skyline
    buildingProfile: {
      // Longer (bigger footprint along the street) and a bit taller than
      // sunnyStreet, with a genuinely diverse size spread (a 4-value cycle,
      // not just a narrower/wider uniform range) per direct feedback.
      widthCycle: [10, 14, 18, 13],
      depth: 13, // deeper than sunnyStreet's 8 -- a proper downtown block, not a thin storefront
      heightBase: 11, heightMod: 13, heightSideOffset: 17, // height range ~11-23, moderately taller than sunnyStreet's 8-17
      count: 20, // fewer than sunnyStreet's 42 -- these buildings are ~2x wider on average
      gapMin: 1, gapRange: 6, // same tight-gap feel as sunnyStreet, just re-scaled for the bigger widths
      leftGapStride: 7, leftGapOffset: 0,
      rightGapStride: 11, rightGapOffset: 3,
    },
  },
};
