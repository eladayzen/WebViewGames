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
// without disturbing it. street.js's createStreet(scene, themeKey) picks one;
// nothing about an existing theme's numbers changes when a new one is added.
//
// centralCity is now the ACTIVE theme (createStreet's default). sunnyStreet is
// unchanged and still selectable by name -- it was explicitly LOCKED earlier and
// stays that way, as the fallback and as the second district once the level
// transition starts swapping environments (data/progression.js's
// LEVEL_SWAPS_ENVIRONMENT).
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

// Coin collectibles (data/coinTypes.js) -- real Kolbo art, replacing the
// procedurally-drawn radial-gradient glow blobs the first pass used. Direct
// feedback: "they're just like HTML spheres... I want them to be good looking
// 2D hand-drawn art, like in the language of the characters." Painted in the
// same bold-ink-outline, cel-shaded, brush-textured style as Leo and the
// barricade, and generated as ONE sheet then split, so the two can't drift
// apart stylistically.
//
// Gameplay props like BARRICADE_TEXTURE above, so shared across every theme.
export const COIN_COMMON_TEXTURE = envTexture('coin_common.png', 506, 512);
// The bonus coin is the SAME coin as above -- same silhouette, same rim, same
// turtle-shell emblem -- re-rendered as a faceted crystal rather than solid
// gold metal, and in a completely different colour. Direct feedback arrived in
// two passes: first "let's just take the exact same gold and do it like in a
// gem style render", then, once that shipped in amber, "the blue coins need to
// look more different than the gold coins... the base needs to be like blue or
// green or pink."
//
// That second note was right and the amber version was a genuine mistake:
// keeping the gem gold left MATERIAL and SIZE as the only cues, and neither
// survives distance. The crystal centre is now vivid sapphire while the RIM
// stays gold -- which is what lets it read as unmistakably different without
// ceasing to look like the same currency. Checked by compositing gold/blue/green
// at near/mid/far sizes over the three backgrounds a coin is actually seen
// against (pale sky, grey road, red brick): the gold rim is load-bearing, it is
// what keeps the blue legible against street.js's pale blue sky.
//
// A vivid emerald cut of the same coin is kept at art/final/
// coin_bonus_green_alt.png -- swapping is one file copy plus the sparkleColor
// hex in data/coinTypes.js. It measured marginally stronger against the sky and
// the red brick; blue was chosen as the stated preference.
export const COIN_BONUS_TEXTURE = envTexture('coin_bonus.png', 512, 512);

// Ability pickups (data/pickupTypes.js). Real Kolbo art in the same inked,
// cel-shaded language as everything else, replacing the canvas-drawn shapes
// the first pass used -- direct feedback: "let's change the icons for the
// magnet and the life."
//
// NO GLOW HALO baked in, and none drawn at runtime any more. The first pass
// leaned on a coloured halo to separate each icon from the background and to
// tell the two apart; both jobs are now done better by the art itself -- a
// thick black ink outline separates from any background, and an arch reads
// nothing like a heart. A halo was tried here and measured against the real
// sky colour: the magnet's cool-blue one was flatly invisible against
// street.js's pale blue sky, which is the one place it would have mattered.
export const PICKUP_MAGNET_TEXTURE = envTexture('pickup_magnet.png', 458, 512);
export const PICKUP_LIFE_TEXTURE = envTexture('pickup_life.png', 512, 450);

// Per-lane elevated platform art (entities/platform.js) -- the box (walkable
// deck) and ramp (incline) are gameplay props like BARRICADE_TEXTURE above,
// not environment reskins, so they're shared across every theme too. First
// real Kolbo art pass, replacing the flat placeholder colors (blue ramp,
// near-white box). Two deliberate, distinct material families so the two
// stay tellable-apart at a glance the way the old blue-vs-white split was:
// a warm dark-brown weathered wood shipping crate for the box, a dark metal
// diamond-plate ramp with orange/black hazard stripes for the ramp. Both
// biased hard toward warm/dark/saturated tones on purpose -- street.js's fog
// (0x9fd2ec) and scene.background (0x8fc7e8) are both a pale, cool sky-blue,
// and platforms spawn far enough out (SPAWN_Z=-140) to already be
// substantially fogged; a pale or cool-toned texture would blend into that
// fog/sky and only "pop in" late, which is exactly what direct feedback
// flagged against the old placeholder colors. Both PNGs are plain repeating
// swatches (no isolated-subject/white-background cutout needed -- these are
// tiled straight onto the mesh, see entities/platform.js's tiledLengthMaterial/
// tiledSideMaterial) -- verified locally to tile seamlessly along their own
// vertical axis before saving (the horizontal-plank / horizontal-stripe
// motifs both repeat cleanly; an earlier diagonal-stripe ramp attempt was
// discarded for showing a visible phase-mismatch seam when tiled).
export const PLATFORM_BOX_TEXTURE = envTexture('platform_box.png', 640, 640);
export const PLATFORM_RAMP_TEXTURE = envTexture('platform_ramp.png', 480, 640);

// Foot Soldier -- new "bump-to-kill" enemy entity type (direct feedback's
// addition, not in the original build doc): a Foot Clan grunt standing in a
// lane, scrolled toward the camera like an obstacle, but dissolves into a
// particle poof + awards score on player contact instead of ending the run.
// v2 art: purple-accented armor, combat stance gripping a spiked club.
// Single static frame for this first pass -- a real idle animation sequence
// (multiple frames) and a hit-reaction pose are deliberately deferred; see
// data/enemyTypes.js for this type's size/shadow/breathing/poof-color
// tuning and entities/enemy.js for how a spawned enemy uses it.
export const FOOT_SOLDIER_TEXTURE = envTexture('foot_soldier_0.png', 784, 900);

// Weapon/color variants -- same character/style/lineage as FOOT_SOLDIER_
// TEXTURE (one edit call, seeded from that exact asset, generated together
// as a 3-panel set for the same reason the run-cycle/attack frames are
// batched -- avoids one variant drifting off-model), each with a clearly
// different stance, weapon, and accent color (+ matching mask ribbon) for a
// real feeling of variety, not just a recolor. See data/enemyTypes.js.
export const FOOT_SOLDIER_SWORD_TEXTURE = envTexture('foot_soldier_sword.png', 476, 669);
export const FOOT_SOLDIER_NUNCHAKU_TEXTURE = envTexture('foot_soldier_nunchaku.png', 507, 680);
export const FOOT_SOLDIER_STAFF_TEXTURE = envTexture('foot_soldier_staff.png', 480, 697);

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

  // "Central City" -- now the ACTIVE theme (street.js defaults to it).
  // Direct feedback: build this out properly from laneRunnerRef.png's actual
  // downtown proportions, and make it the first theme for now.
  //
  // The facades are a fresh Kolbo pass generated AGAINST that reference image,
  // replacing a first attempt that came back photoreal-architectural -- a grey
  // office tower with a monotonous window grid, flagged in this file at the time
  // as "worth a restyle pass before shipping, not a silent style regression to
  // build around". These are cel-shaded to match Leo and the barricade: bold ink
  // outlines, flat saturated fills, bright daylight, with the detail that makes
  // a street read as a city -- storefronts and awnings at ground level, fire
  // escapes, a graffiti roll-down shutter, a neon marquee, window boxes.
  //
  // Generated as ONE sheet and split, so the pair cannot drift apart
  // stylistically -- the same reason the coin and pickup sets were batched.
  // Deliberately no readable signage: these tile vertically, and repeated
  // legible text reads as a printing error rather than a city.
  centralCity: {
    street: envTexture('street_tex.png', 576, 768), // TODO: dedicated downtown avenue texture
    facades: [
      { tex: envTexture('facade_c1.png', 1309, 1410), bodyColor: 0x886255 }, // red-brick walk-up over a green shopfront + graffiti shutter
      { tex: envTexture('facade_c2.png', 1214, 1413), bodyColor: 0x968569 }, // mustard commercial block over a diner, neon marquee
    ],
    skyline: envTexture('skyline.png', 1600, 906), // reused -- already a fitting daylight city skyline
    buildingProfile: {
      // widthCycle is the FRONTAGE along the street -- the span of the wall the
      // player actually looks at (see street.js's axis note; this field used to
      // be applied across the road instead, which is why the frontage dial was
      // previously the one named "depth").
      //
      // ~2x sunnyStreet's 6-8 per direct feedback: "buildings ~2x wider is
      // important, especially the side that is facing the street." A 4-value
      // cycle rather than a wider uniform range, so the block has a genuinely
      // varied rhythm instead of one repeated size.
      widthCycle: [12, 17, 22, 15],
      depth: 13, // thickness away from the road -- barely seen, only the end caps
      heightBase: 11, heightMod: 13, heightSideOffset: 17, // ~11-23, taller than sunnyStreet's 8-17
      // Halved from sunnyStreet's 42 because each building is now ~2.3x its
      // frontage -- STREET_LENGTH is fixed at 400, so the count has to come down
      // or the gap scaling goes negative and buildings overlap.
      count: 18,
      gapMin: 1, gapRange: 6, // same tight-gap feel, rescaled for the bigger frontages
      leftGapStride: 7, leftGapOffset: 0,
      rightGapStride: 11, rightGapOffset: 3,
    },
  },
};
