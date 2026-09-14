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

// SCRAP-BOT SKIN, POC: this pool used to spawn a Foot Clan grunt ("Foot
// Soldier") -- combat doesn't fit a non-fighting collector hero. First
// reskin pass replaced it with a floating treasure chest; direct feedback
// rejected that too, on two counts -- "designed as an item, not good" (a
// chest reads small/collectible, not a tall standing presence like the
// original grunt did), and "too much fantasy... we have a robot" (wood/
// gems/a padlock is medieval-fantasy iconography that clashes with a
// scrap-tech world). Round 3: a tall standing ENERGY CORE PYLON -- a
// riveted scrap-metal scaffold frame around a glowing vertical power
// core, standing directly on a base plate on the ground (not floating --
// see data/enemyTypes.js, the float mechanism from round 2 is zeroed out,
// not removed). Modern sci-fi, ties to the hero's own magnet-hands
// identity (drawn to a power source, not a soldier) instead of generic
// loot. The FOOT_SOLDIER_* export names, data/enemyTypes.js's ENEMY_TYPES
// keys, and entities/enemy.js's bump-to-destroy/poof/score mechanic are
// ALL still unchanged -- this remains a pure art reskin of an existing
// mechanic, not a new entity kind. Generated as one 2x2 grid (one call,
// same lineage) so all 4 color variants share the exact same pylon shape/
// proportions -- only the core glow color differs. Earlier art archived at
// art/final/alt/foot_soldier_*_v1_soldier.png (original grunt) and
// _v2_chest.png (the rejected chest).
export const FOOT_SOLDIER_TEXTURE = envTexture('foot_soldier_0.png', 2028, 2028); // purple glow

// Same lineage/style as FOOT_SOLDIER_TEXTURE (one batch generation, not
// four independent ones -- avoids one variant drifting off-model), each
// with a different core-glow color matching this type's own poof-color
// family in data/enemyTypes.js, for a real feeling of variety, not just a
// single reused prop.
export const FOOT_SOLDIER_SWORD_TEXTURE = envTexture('foot_soldier_sword.png', 2028, 2028); // red
export const FOOT_SOLDIER_NUNCHAKU_TEXTURE = envTexture('foot_soldier_nunchaku.png', 2028, 2028); // green
export const FOOT_SOLDIER_STAFF_TEXTURE = envTexture('foot_soldier_staff.png', 2028, 2028); // teal

export const THEMES = {
  // Bright, cheerful, semi-casual DAYLIGHT palette per direct playtest
  // feedback -- an explicit pivot away from the build doc's original
  // sunset-to-neon dusk vision (§1); the first dusk-toned art pass read as
  // grim/twilight rather than alive and happy. The BUILDING PROFILE below is
  // still LOCKED per that same direct feedback -- tune a different theme's
  // numbers instead of these.
  //
  // THE FACADE ART, unlike the profile, is not locked -- it just went through
  // its own fix pass, once centralCity's now-fixed quality bar made this
  // theme's flaws obvious by comparison: "sunny street doesn't look good
  // enough at all." Inspecting the actual files (not just the memory of them)
  // turned up three concrete problems, all predating every lesson this
  // project has since learned the hard way:
  //   - a DIAGONAL fire escape -- the exact illusion-breaking shape
  //     centralCity's own facades were fixed for.
  //   - a deep SCALLOPED awning with a shaded underside -- same category.
  //   - a large READABLE sign ("SUNNY DAY BOOKS & GIFTS") baked into the
  //     texture -- which TILES vertically, so it would repeat down the whole
  //     building like a printing error, not just look busy.
  // Also generally softer/more airbrushed than the flat cel-shaded ink-line
  // language centralCity settled into.
  //
  // Regenerated keeping the SAME identity (the floral-mural brick tenement,
  // the cosy book-and-gift shopfront) so the theme is still itself, with all
  // three problems fixed by name: vertical ladder, flat straight-edged
  // awning, the readable sign replaced with icon-only signage (a sun, a
  // plant -- nothing to tile badly). Needed 3 candidates to land one with the
  // fire escape actually vertical -- 2 of 3 still came back diagonal despite
  // an explicit instruction, same unreliability rate as every other batch
  // this session. Original pre-fix pair archived at art/final/alt/
  // facade_a_v1_original.png / facade_b_v1_original.png.
  sunnyStreet: {
    street: envTexture('street_tex.png', 576, 768),
    // Two facade variants -- alternated across building instances by index
    // for cheap variety without generating a full per-building library (§2
    // "keep art generation minimal" instinct). bodyColor is each facade's own
    // sampled average tone, used on the never-seen box faces instead of a
    // generic (previously purple, explicitly flagged as looking
    // "procedurally generated") placeholder color.
    facades: [
      { tex: envTexture('facade_a.png', 1342, 1514), bodyColor: 0x95624d }, // red-brick tenement, floral mural, vertical fire-escape ladder
      { tex: envTexture('facade_b.png', 1304, 1517), bodyColor: 0x957547 }, // golden-yellow book-and-gift shopfront, icon-only signage
    ],
    // Distant skyline matte painting -- fog-immune (material.fog = false,
    // set in street.js) so it stays fully visible at that distance, the same
    // way a skybox is conventionally exempted from scene fog. An orange
    // dusk/matte-painting variant referencing laneRunnerRef.png was tried
    // and reverted here: it clashed badly against this theme's cheerful
    // daylight foreground, reading as an ominous burning-city backdrop
    // rather than depth/atmosphere.
    //
    // Was skyline.png (centralCity's own backdrop, reused) until direct
    // feedback -- tier 3 was showing the exact same skyline the player
    // already saw at tier 1. Replaced with a skyline of its own: warm
    // brick/brownstone low-rise rooftops and water towers matching this
    // theme's own facade language (facade_a's brick tenement, fire escape),
    // staying bright daylight per the note above -- not the rejected orange
    // dusk direction -- with real atmospheric depth (nearest rooftops crisp
    // and saturated, background fading to a hazy blue-grey downtown
    // silhouette) applying the depth lesson harborDocks' skyline fix
    // learned. Alt candidate archived at art/final/alt/skyline_sunny_v1_alt.png.
    skyline: envTexture('skyline_sunny.png', 3168, 1344),
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
  // FIX PASS (direct feedback, playtested): two elements in the first facade
  // pass had implied 3D depth painted into a flat texture, which conflicts with
  // the real camera perspective and reads as obviously pasted-on --
  // "the outer staircases... break the 3D illusion" and the storefront awnings
  // "when it's wide, like when it's deep, it's also breaking the illusion."
  // Not a redo -- targeted edits on the SAME art, keeping everything else (the
  // brick, the storefronts, the graffiti shutter, the mural, the neon sign)
  // pixel-identical. The original pre-fix pair is archived at
  // art/final/alt/facade_c1_v1_original.png / facade_c2_v1_original.png.
  //
  //   FIRE ESCAPE (facade_c1 only -- facade_c2 has none): the diagonal
  //   zigzag staircase was replaced with a straight VERTICAL drop-ladder.
  //   The diagonal was the actual offender -- its own implied recession is a
  //   second, conflicting perspective inside a flat-shaded scene, most visible
  //   at the raking angle these walls are viewed at down the street corridor.
  //   A vertical line has no such implied direction, so it reads as a flat
  //   graphic at any viewing angle. Balcony platforms (plain horizontal bars)
  //   were already flat and are untouched.
  //
  //   AWNING (both facades): the scalloped valance + shaded underside implied
  //   a canopy projecting outward. Replaced with a straight-edged flat striped
  //   band -- no scallop, no visible soffit -- so it reads as paint on the wall
  //   rather than an object jutting into space.
  //
  //   Getting the image model to actually apply either fix took real
  //   iteration: the first attempts (asking it to "flatten the perspective")
  //   silently returned near-identical images despite explicit instructions.
  //   What worked was replacing the vague ask with a concrete alternative
  //   shape (vertical ladder; straight-edged band) and isolating one fix per
  //   edit call rather than requesting both at once -- combined requests kept
  //   dropping one of the two fixes. The final assets were built by chaining
  //   two independently-verified single-fix edits.
  centralCity: {
    street: envTexture('street_tex.png', 576, 768), // TODO: dedicated downtown avenue texture
    // 2 -> 4 facades, direct feedback after playtesting the fix pass: "I think
    // maybe we need a bit more variation inside the theme." With only 2 facades
    // cycling across 18 buildings per side, each one repeated 9 TIMES down a
    // single block -- measured, not a guess.
    //
    // c3/c4 were regenerated once already, and the first pass (still archived
    // at art/final/alt/facade_c3_v1_flawed.png / facade_c4_v1_flawed.png) was
    // rejected on direct feedback for being "off language" and having its own
    // instance of the exact illusion-breaking problem the earlier fix pass had
    // just solved -- a receding row of washing machines drawn WITH perspective
    // inside the laundromat's glass, and a handful of oversized, individually-
    // legible stickers instead of the dense small texture the rest of the
    // block uses. Root cause, on inspection: that batch referenced the
    // ALREADY-EDITED facade_c1 as a second style anchor (chained edits drift
    // from the original clean render) and dropped this prompt's own
    // "NOT a photograph... no realistic lighting or glass reflections" line,
    // which is exactly the guardrail that would have stopped the glass depth
    // issue. This batch went back to referencing ONLY the photo reference,
    // restored the full original style block, and fixed both problems by name
    // in text rather than by image reference -- "flat iconographic" glass
    // interiors, explicitly small/dense stickers. Still needed 3 candidates to
    // get one with vertical (not diagonal) fire escapes on both buildings, so
    // the convention remains a per-batch check, not something the model can be
    // trusted to hold from an instruction alone.
    facades: [
      { tex: envTexture('facade_c1.png', 2048, 2048), bodyColor: 0x886255 }, // red-brick walk-up over a green shopfront + graffiti shutter
      { tex: envTexture('facade_c2.png', 2048, 2048), bodyColor: 0x968569 }, // mustard commercial block over a diner, neon marquee
      { tex: envTexture('facade_c3.png', 1052, 1350), bodyColor: 0x6f7272 }, // blue-grey walk-up over a bodega/fruit-stand + sticker gate
      { tex: envTexture('facade_c4.png', 1243, 1351), bodyColor: 0x5b5950 }, // charcoal-brass block over a laundromat, rooftop AC units
    ],
    skyline: envTexture('skyline.png', 1600, 906), // reused -- already a fitting daylight city skyline
    buildingProfile: {
      // widthCycle is the FRONTAGE along the street -- the span of the wall the
      // player actually looks at (see street.js's axis note; this field used to
      // be applied across the road instead, which is why the frontage dial was
      // previously the one named "depth").
      //
      // ~2x sunnyStreet's 6-8 per direct feedback: "buildings ~2x wider is
      // important, especially the side that is facing the street." A 5-value
      // cycle rather than a wider uniform range, so the block has a genuinely
      // varied rhythm instead of one repeated size.
      //
      // DELIBERATELY 5 values, not 4, now that facades.length is also 4: both
      // widthCycle and the facade picker (street.js's facadeIdx) are separate
      // mod cycles walking the same building index, so if they were the SAME
      // length every facade would always get paired with the exact same width
      // -- facade 0 always narrow, facade 2 always wide, forever. 5 and 4 are
      // coprime, so the combined (width, facade) pattern doesn't repeat until
      // index 20 -- past all 18 buildings on a side, so no repeating pattern is
      // ever visible within one block.
      widthCycle: [12, 17, 22, 15, 19],
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

  // "Harbor Docks" -- the brand-new middle district (tier 2, between
  // centralCity and sunnyStreet). Direct feedback: put a third theme in
  // between the other two, "really different from both of them" -- the build
  // doc itself already named this as the natural next district (its own "more
  // block/district themes" list: "subway platform, harbor docks, rooftop-
  // chase finale"), so it wasn't invented from nothing.
  //
  // DIFFERENT ON EVERY AXIS a runner actually sees, not just the facades:
  //   - GROUND: weathered wood dock planking + a cracked concrete quay,
  //     rope-and-cleat trim -- centralCity/sunnyStreet both use the same
  //     cream-paver sidewalk + grey asphalt street_tex.png (a real
  //     leftover placeholder, still marked TODO on centralCity above). The
  //     ground plane is in frame every single frame, so reusing it here would
  //     have undercut "really different" more than any facade choice could.
  //   - SKYLINE: cargo cranes, a container ship, a striped lighthouse --
  //     replacing both themes' shared downtown skyline.png.
  //   - PALETTE: weathered teal, rust-orange, driftwood tan, deep navy --
  //     a genuinely different hue family from centralCity's brick/mustard/
  //     charcoal and sunnyStreet's red-brick/golden-yellow.
  //   - BUILDING TYPOLOGY: dockside warehouses and a harbor-master shack
  //     instead of another street of storefronts -- and deliberately NEITHER
  //     building has a fire escape (warehouses/shacks don't have residential
  //     ones), which sidesteps this project's single least-reliable art
  //     convention entirely rather than gambling on it a third time.
  //
  // Same locked daylight mood as both other themes (never re-litigated) --
  // "different" is carried by palette and material language, not time of day.
  harborDocks: {
    street: envTexture('street_harbor.png', 1792, 2400),
    // 2752x1265 -> 3136x1344 with the atmospheric-depth pass below -- dims
    // here MUST track the actual file exactly or street.js's skyline plane
    // (SKYLINE_WIDTH is a fixed world-unit constant, height derived from
    // this aspect ratio) stretches/misscales and gaps open up at the frame
    // edges. Learned the hard way: PASS 1 of this fix asked the edit call
    // for a 16:9 aspect ratio (0.4597 -> 0.5581, h/w) instead of matching
    // the original panoramic ~2.18:1 shape, which recomposed the scene onto
    // a taller canvas and shifted where the painted content sat relative to
    // what the street-level building geometry expected -- visible in-game
    // as a flat light-blue gap clipping in at the top-left, direct feedback
    // caught via screenshot. PASS 2 fixed it by passing aspect_ratio:
    // "auto" instead (preserves the source's own shape) rather than trying
    // to hand-pick a matching preset.
    skyline: envTexture('skyline_harbor.png', 3136, 1344),
    // ATMOSPHERIC DEPTH PASS (direct feedback): "I need to feel a little bit
    // more in the distance. I have too much big details over there. It
    // feels like I'm about to reach it." The crane/ship/warehouse cluster
    // was rendered at uniform crisp linework and full saturation regardless
    // of implied distance -- only the back mountain silhouette had real
    // atmospheric perspective. Redone so the FOREGROUND (the two leftmost
    // cranes, the dockside warehouses) stays crisp and saturated, while
    // everything further back -- the ship, the rest of the crane row, the
    // structures behind them -- desaturates and hazes toward the mountains'
    // own blue-grey, same composition/content otherwise (same cranes, same
    // ship, same lighthouse, same count of everything). Also dropped the
    // "MV HARMONY" text painted on the ship's hull, a readable-text
    // violation missed in the original pass. 3 candidates generated on the
    // (correct, aspect-preserving) second pass -- one played the haze too
    // safe (barely different from the original), another had a visible
    // hard seam banding across the sky -- both rejected; this one nailed
    // the depth grading with no artifacts. Originals archived: art/final/
    // alt/skyline_harbor_v1_flat.png (pre-fix) and
    // art/originals/harbordocks_skyline_atmospheric_depth.jpg (the
    // wrong-aspect pass-1 output, kept for the record, never shipped).
    // SCALE FIX, PASS 2 (direct feedback, playtested twice): a first pass
    // shrank the small decorative marks (stencils, notes) but left the HERO
    // elements -- the roll-up door, all 7 portholes, the shopfront/chalkboard,
    // the fish crates -- at single-building-portrait scale. Still read as "a
    // handful of big clear things" rather than texture. Pass 2: "all the
    // details... about half those sizes" -- both facades redrawn pulled back,
    // showing roughly twice as much building (an extra wall band above h1's
    // portholes, an extra floor above h2's balcony) with every element,
    // including the door/portholes/shopfront/crates, roughly half its former
    // size and twice as numerous (14 portholes not 7, 6 fish crates not 3).
    // Not a redo -- same identity, palette, material language both times.
    // Archived: art/final/alt/facade_h1_v1_toobig.png / facade_h2_v1_toobig.png
    // (pre-pass-1) and facade_h1_v2_stilltoobig.png / facade_h2_v2_stilltoobig.png
    // (pass 1, still too big). Pass 2 used the PASS-1-ORIGINAL (v1) crops as
    // the edit reference, not the pass-1 output, per this project's own
    // established rule against referencing an already-edited derivative.
    //
    // GAP FILL, PASS 3, facade_h2 only (direct feedback): the pass-2 regen
    // left two areas of plain white background showing through instead of
    // finished wall -- a large rectangular gap between the two rope-railing
    // balconies, and a smaller triangular one at the top-left corner behind
    // the left gable. Two rounds of targeted edits (the rectangular gap
    // closed on the first pass; the top-left corner needed a dedicated
    // second pass after the first left it unfixed) -- pure completion, no
    // other change. Archived: art/final/alt/facade_h2_v3_whitegaps.png.
    //
    // GAP FILL, PASS 4, facade_h2 only, much later (direct feedback during
    // final QA prep: "there is still one asset that has a solid white
    // area"): a THIRD gap, never caught by the pass-3 review, at the
    // top-right corner where the lighthouse cupola meets the wall -- pixel-
    // measured at 7.25% of the canvas before the fix, 0.18% after (the
    // remainder is legitimate small white details elsewhere, like the
    // pinned note and window glass, not gap). Same targeted-edit approach:
    // extend the existing clapboard siding into the white area only,
    // nothing else touched. Archived: art/final/alt/facade_h2_v4_topright_whitegap.png.
    facades: [
      { tex: envTexture('facade_h1.png', 2048, 2048), bodyColor: 0x69746c }, // teal corrugated-metal cargo warehouse, roll-up door, portholes
      { tex: envTexture('facade_h2.png', 2048, 2048), bodyColor: 0x8b8884 }, // weathered clapboard harbor-master shack, lighthouse cupola, bait counter
    ],
    buildingProfile: {
      // A 5-value cycle against only 2 facades (not the 4 centralCity has) --
      // still deliberately NOT a length that shares a factor with 2 wherever
      // avoidable, for the same reason as centralCity's own note: a matching
      // period would lock each facade to always the same width forever. 5 vs
      // 2 gives a 10-building repeat period rather than a 2-building one --
      // not a full guarantee across all 16, but far better than lockstep.
      //
      // Wider average (20.2) than centralCity's 17 -- big industrial slabs on
      // a working waterfront, not shop-sized storefronts.
      widthCycle: [18, 26, 15, 22, 20],
      depth: 14,
      // Shorter/blockier than either other theme's height range (centralCity
      // ~11-23, sunnyStreet ~8-17) -- warehouses read as squat and wide, not
      // tall, which is its own point of visual contrast against two themes
      // built around apartment-height towers.
      heightBase: 8, heightMod: 7, heightSideOffset: 11,
      // Fewer than centralCity's 18 -- these are big buildings on a working
      // waterfront with real yard space between them, not a packed block.
      count: 16,
      gapMin: 1, gapRange: 9, // a bit more gap-size variety -- irregular loading-bay spacing, not a tidy shop-front rhythm
      leftGapStride: 7, leftGapOffset: 0,
      rightGapStride: 11, rightGapOffset: 3,
    },
  },

  // "Subway Platform" -- tier 3. Direct feedback: "let's do two more themes,
  // not only one" -- the build doc's own third named district (alongside
  // harbor docks and the rooftop chase below), and the one place a real
  // fluorescent-lit underground corridor gives a genuinely different feel
  // from every above-ground street theme without breaking the locked
  // "bright, not dark/moody" mood -- clean tile and warm platform lights
  // carry that instead of sunlight.
  //
  // FIRE ESCAPE risk sidestepped again, same trick as harborDocks: the
  // "buildings" here are subway wall infrastructure -- mosaic tile bays, a
  // support pillar, turnstiles, a newsstand kiosk -- none of which has any
  // reason to have one.
  //
  // Ground and skyline are both bespoke rather than reused, same reasoning as
  // harborDocks: the ground plane is in frame every single frame. The
  // "skyline" here is a receding platform/tunnel corridor rather than a
  // literal sky -- street.js's SKYLINE_Z placement (behind the buildings,
  // fog-immune) works exactly the same for "the corridor keeps going into the
  // distance" as it does for a real skyline.
  // SHELVED -- not referenced by data/progression.js's TIER_THEMES, so this
  // theme never plays. Built, wired, then rejected on sight: "completely
  // bad... not in the right direction at all... closer to regular streets
  // like the first one." Underground/elevated settings are the wrong CONCEPT
  // for this game, not an execution miss (unlike harborDocks' earlier
  // too-big-details pass, which WAS a fixable execution issue). Left in place
  // rather than deleted in case a street-level reframing of the idea is worth
  // trying later; the art files it references (facade_s1/s2, street_subway,
  // skyline_subway) are likewise still on disk, just orphaned.
  subwayPlatform: {
    street: envTexture('street_subway.png', 1792, 2400),
    skyline: envTexture('skyline_subway.png', 2752, 1536),
    facades: [
      { tex: envTexture('facade_s1.png', 1316, 1438), bodyColor: 0x5e6d58 }, // teal/cream mosaic tile bay, riveted mustard support pillar, tunnel arch
      { tex: envTexture('facade_s2.png', 1316, 1438), bodyColor: 0x727060 }, // turnstiles + newsstand kiosk, cream/green tile, flat striped overhang
    ],
    buildingProfile: {
      widthCycle: [16, 20, 14, 18, 22], // 5 values against 2 facades, same anti-lockstep reasoning as harborDocks
      depth: 11,
      // DELIBERATELY the shortest range of any theme -- a subway platform has
      // a low corridor ceiling, not multi-storey height, and that squatness
      // is itself part of what makes this read as underground rather than
      // just another palette swap of a street.
      heightBase: 6, heightMod: 4, heightSideOffset: 5,
      count: 16,
      gapMin: 1, gapRange: 6,
      leftGapStride: 7, leftGapOffset: 0,
      rightGapStride: 11, rightGapOffset: 3,
    },
  },

  // "Rooftop Bridge" -- tier 4. The build doc's third named district
  // ("rooftop-chase finale"), reframed to fit this game's fixed structural
  // format (a road flanked by box-geometry "buildings"): a wide rooftop
  // crossing linking several buildings, with rooftop EQUIPMENT -- a water
  // tower, a mechanical/stairwell shed -- standing in for the buildings
  // themselves. Classic TMNT rooftop-chase imagery, and neither structure
  // has any reason to carry a fire escape either (same sidestep as the other
  // two new themes).
  //
  // Ground is a tar-paper-and-catwalk-grating mix (with faded chalk hopscotch
  // marks -- a small human touch, this is still someone's roof); skyline is
  // the city seen from ABOVE rather than from the street -- nearby rooftops
  // with water towers and clotheslines, taller towers rising behind them --
  // which is a real, felt difference in vantage from every ground-level
  // theme, not just a reskin.
  // SHELVED -- same rejection as subwayPlatform above, not referenced by
  // TIER_THEMES. Kept for the same reason; art files (facade_r1/r2,
  // street_rooftop, skyline_rooftop) are likewise orphaned on disk.
  rooftopBridge: {
    street: envTexture('street_rooftop.png', 1792, 2400),
    skyline: envTexture('skyline_rooftop.png', 2752, 1521),
    facades: [
      { tex: envTexture('facade_r1.png', 1324, 1481), bodyColor: 0x60797b }, // wooden water tower on X-braced legs, vertical ladder, pigeon coop
      { tex: envTexture('facade_r2.png', 1428, 1536), bodyColor: 0x77878d }, // rooftop mechanical shed, HVAC unit, small abstract graffiti mural, flat safety railing
    ],
    buildingProfile: {
      widthCycle: [14, 20, 11, 17, 15], // 5 values against 2 facades, same anti-lockstep reasoning as the other themes
      depth: 12,
      // Between subwayPlatform's squat range and centralCity's full towers --
      // these are rooftop STRUCTURES (a tower, a shed), not whole buildings,
      // but still need to read as substantial against a skyline seen from up here.
      heightBase: 9, heightMod: 8, heightSideOffset: 13,
      count: 18,
      gapMin: 1, gapRange: 7,
      leftGapStride: 7, leftGapOffset: 0,
      rightGapStride: 11, rightGapOffset: 3,
    },
  },

  // "Funky Forest" -- SCRAP-BOT SKIN, POC. Direct request: try a genuinely
  // non-street setting again, this time NOT enclosed (open sky, not the
  // underground/enclosed idea explicitly ruled out first).
  //
  // FACADES, take 2: the first pass tried giant tree TRUNKS standing in for
  // buildings and it was the wrong call, direct feedback caught it
  // immediately -- "this won't work with trees, the way we built this game
  // is with shapes of buildings, of the boxes." Every facade in this engine
  // is a flat rectangular wall texture tiled onto box geometry
  // (street.js's tiledFacadeMaterial); an organic, tapering, forking trunk
  // can never sit cleanly on a box no matter how it's cropped -- confirmed
  // firsthand, a visible background gap kept bleeding through at the
  // repeat-wrap seam no matter where the crop line went, because the
  // SOURCE shape itself isn't a rectangle. Buildings still work as
  // buildings here -- forest CABINS/treehouses, box-shaped wood structures
  // (plank siding, porthole windows, a rope ladder), just themed for a
  // forest instead of a city. This is exactly the trick that already made
  // harborDocks/sunnyStreet read as clearly distinct themes without
  // needing a different silhouette -- reskin the box, don't abandon it.
  // (Not what sank the shelved subwayPlatform theme either, see its own
  // SHELVED note above -- that kept the box shape and still read as "a
  // smaller street"; the fix there would be a different problem than this
  // one.) The SKYLINE below is a flat, non-tiled backdrop plane, not box
  // geometry, so it has none of this constraint -- organic tree silhouettes
  // are exactly right there, and stayed.
  //
  // "Funky" concept: a bright, cheerful (not dark/mossy-horror) magical
  // forest -- vivid non-naturalistic canopy colors (magenta/teal/gold
  // instead of plain green), glowing bioluminescent mushrooms and fireflies
  // as the small recurring motif (mirrors how every other theme has ONE
  // small signature detail -- centralCity's water towers, harborDocks'
  // industrial scale, sunnyStreet's murals).
  //
  // Ground/skyline are bespoke, not reused, same reasoning as every other
  // theme's own note: the ground plane is in frame every frame, and the
  // skyline needs to actually look like a forest horizon, not a street's.
  funkyForest: {
    street: envTexture('street_forest.png', 1792, 2400),
    skyline: envTexture('skyline_forest.png', 3168, 1344),
    // Two forest-cabin wall facades -- same one-generation-call-then-split
    // technique as every other theme's paired facades (avoids one variant
    // drifting off-model against the other), this time split top/bottom
    // (the generation came back as two stacked panels, not side-by-side).
    // bodyColor sampled from each wall's own wood tone, used on the
    // never-seen box faces instead of a generic placeholder. Rejected
    // tree-trunk originals archived at
    // art/final/alt/facade_f{1,2}_v1_treetrunk.png.
    //
    // Cropped with a wider inset than the first attempt: that pass left a
    // ~27px pale border strip from the source panel's own divider along
    // both left/right edges of each file, invisible on its own but tiled
    // vertically onto a building's road-facing face it became a solid
    // bright line running the whole height of every wall's corner --
    // direct feedback: "white lines in the corners of the walls." Verified
    // this time by sampling every ~20 rows for a stray near-white column
    // before shipping, not just spot-checking one row.
    facades: [
      { tex: envTexture('facade_f1.png', 1722, 1130), bodyColor: 0xb07a3e }, // warm honey-brown plank wall, teal glowing mushrooms/moss
      { tex: envTexture('facade_f2.png', 1722, 1130), bodyColor: 0x8c887e }, // cool weathered-grey plank wall, magenta glowing mushrooms/moss
    ],
    buildingProfile: {
      // Wider variety and looser gaps than a tidy city block, but still
      // real BUILDING proportions (comparable to centralCity's own
      // widthCycle) -- cabins in a clearing, not a street grid, but not the
      // rejected trunk pass's forest-canopy-scale spacing either.
      widthCycle: [12, 17, 10, 20, 14],
      depth: 11,
      // MUCH taller than centralCity's own range -- direct request: "why
      // not? Tall tall buildings... it's fantasy anyway" (this theme is
      // already a funky/vivid non-naturalistic take, not aiming for
      // realism). heightBase/heightMod roughly tripled from the previous
      // building-scale pass.
      heightBase: 26, heightMod: 24, heightSideOffset: 20,
      count: 18,
      gapMin: 1, gapRange: 8, // a bit more irregular than a city block, short of the trunk pass's wide-open spacing
      leftGapStride: 7, leftGapOffset: 0,
      rightGapStride: 11, rightGapOffset: 3,
    },
  },

  // "Big Warehouses" -- SCRAP-BOT SKIN, POC. Direct request: "big
  // warehouses -- the first one can be regular with walls of boxes, and
  // then maybe later we can make weird ones." A deliberately plain,
  // straightforward pass first (a real industrial cargo warehouse, not a
  // stylized take) -- distinct from harborDocks (a waterfront/dockside
  // theme) by being purely a landlocked cargo-storage district, and
  // literally answering "walls of boxes": rows of stacked shipping crates
  // built into the base of each facade, not just an industrial palette.
  //
  // Facade edge-to-edge fill was verified by measurement (sampled every 40
  // rows across the full height, both panels) before cropping this time --
  // direct lesson from funkyForest's white-corner-line bug, caused by an
  // unverified border strip left over from an earlier crop.
  //
  // Skyline, round 2: direct feedback -- "the houses in the mat-painting
  // need to look much smaller." The first pass put a few large, close-
  // reading buildings right at the bottom edge; regenerated with the same
  // palette/mood but shrunk and multiplied many times over, then cropped
  // from a much hazier/farther band of that same image (skipping past the
  // near, still-large foreground rows entirely) so nothing in frame reads
  // as close-up. Only 2048x868 now, not the original 3168x1344 -- the edit
  // came back square and this is what a correctly-composed (real sky
  // margin, not just buildings filling the frame) crop of it yielded. Old
  // too-big version archived at art/final/alt/skyline_warehouse_v1_toobig.png.
  warehouse: {
    street: envTexture('street_warehouse.png', 1792, 2400),
    skyline: envTexture('skyline_warehouse.png', 2048, 868),
    facades: [
      { tex: envTexture('facade_w1.png', 1780, 1188), bodyColor: 0x8f97a0 }, // galvanized steel-grey corrugated panel, rust-orange crate stacks
      { tex: envTexture('facade_w2.png', 1780, 1188), bodyColor: 0xd8c49a }, // warm tan/cream corrugated panel, blue crate stacks
    ],
    buildingProfile: {
      // Wide, blocky warehouse proportions -- wider average than
      // centralCity's storefronts, matching harborDocks' own "big
      // industrial slabs, not shop-sized" instinct.
      widthCycle: [20, 28, 17, 24, 22],
      depth: 15,
      // Squat and wide rather than tall -- a warehouse reads as a big box,
      // not a tower. Deliberately the "regular" pass per direct request;
      // a later weirder theme can go tall/strange instead.
      heightBase: 10, heightMod: 8, heightSideOffset: 9,
      count: 16,
      gapMin: 1, gapRange: 6, // tighter, more regular spacing than funkyForest -- a tidy depot yard, not a wood
      leftGapStride: 7, leftGapOffset: 0,
      rightGapStride: 11, rightGapOffset: 3,
    },
  },

  // "Big Warehouses -- Under Roof" -- direct request: "keep the environment
  // the same, just the matte painting should look like a roof above us --
  // maybe we can play with lighting a bit." Reuses warehouse's street
  // UNCHANGED (same envTexture entry, not a copy). The skyline is redrawn
  // as the underside of a vast hangar roof (steel trusses, skylights,
  // hanging lamps) instead of a horizon, so it reads as looking up into a
  // roof far overhead rather than out at a receding skyline -- same
  // fog-immune backdrop-plane trick every theme's skyline already uses,
  // just aimed at a ceiling instead of a horizon. "Lighting" is painted
  // into the art itself (warm sunbeam shafts through the skylights, cooler
  // shadowed steel) since every material in this engine is unlit
  // (MeshBasicMaterial, by design -- see street.js's own header comment)
  // -- there's no real scene light to adjust, the mood has to come from
  // the matte painting.
  //
  // Facades, round 2: direct follow-up once the roof was seen in motion --
  // "the walls there [need to be] giant piles of boxes, could be
  // colorful." No longer shares warehouse's corrugated-panel facades;
  // these are dense, floor-to-ceiling stacks of shipping crates/boxes.
  // Round 3: direct feedback the first colorful pass was "too colourful,
  // tone it down a lot" -- redrawn keeping the exact same box pile/
  // composition/panel layout but with a much more muted, believable
  // cardboard-and-weathered-wood palette, only soft accent colors left
  // (dusty blue-grey top panel, warm tan/mustard bottom), not a saturated
  // rainbow. Same edge-to-edge-fill verification by measurement before
  // cropping as every facade since the funkyForest lesson. Original
  // too-saturated pass archived at art/final/alt/facade_wb{1,2}_v1_toocolorful.png.
  warehouseRoof: {
    street: envTexture('street_warehouse.png', 1792, 2400),
    skyline: envTexture('skyline_warehouse_roof.png', 3168, 1344),
    facades: [
      { tex: envTexture('facade_wb1.png', 2036, 1012), bodyColor: 0x9aa3ac }, // muted cool box pile: dusty blue-grey, tan
      { tex: envTexture('facade_wb2.png', 2036, 1012), bodyColor: 0xb08c5e }, // muted warm box pile: tan, weathered wood, mustard
    ],
    buildingProfile: {
      widthCycle: [20, 28, 17, 24, 22],
      depth: 15,
      heightBase: 10, heightMod: 8, heightSideOffset: 9,
      count: 16,
      gapMin: 1, gapRange: 6,
      leftGapStride: 7, leftGapOffset: 0,
      rightGapStride: 11, rightGapOffset: 3,
    },
  },

  // SPACE CITY -- direct request: "another theme for later - space city."
  // Sleek chrome/glass sci-fi towers under a vivid nebula sky (stars,
  // ringed planets, streaking ships) rather than dark/moody deep-space --
  // same "bright, cheerful" house style every other theme holds to. Tier 6,
  // replacing SUNNY STREET in the rotation -- see progression.js's
  // TIER_NAMES/TIER_THEMES comment for that swap.
  //
  // Street art, round 1, was rejected before shipping: the first generation
  // came back as a vertical wall-panel texture, not the top-down
  // center-lane-plus-side-border ground texture every other theme's street
  // asset actually is (see street_warehouse.png/street_harbor.png for the
  // convention -- flanking border treatment framing a walkable center
  // lane). Regenerated correctly as a top-down chrome/concrete walkway with
  // a glowing cyan center strip and grated, hazard-striped side borders.
  //
  // Facades came back as a stacked top/bottom pair (this project's usual
  // batching convention), split at the midline and edge-to-edge verified by
  // pixel measurement before cropping (0px margin on both, per the
  // funkyForest lesson) -- worst-case white-pixel fraction elsewhere in
  // each (10.1% / 0.9%) is legitimate glowing-porthole/light-panel content,
  // not gap.
  spaceCity: {
    street: envTexture('street_space.png', 896, 1200),
    skyline: envTexture('skyline_space.png', 3168, 1344),
    facades: [
      { tex: envTexture('facade_sp1.png', 1792, 1200), bodyColor: 0xaab4d6 }, // cool chrome/lavender panel wall, cyan glowing portholes, satellite dish
      { tex: envTexture('facade_sp2.png', 1792, 1200), bodyColor: 0x8f8a80 }, // warm grey panel wall, amber glowing portholes, magenta trim piping
    ],
    buildingProfile: {
      // Narrower frontage than centralCity's storefronts, taller than
      // anything else in rotation -- reads as slim sci-fi towers rather
      // than street-level blocks.
      widthCycle: [11, 16, 13, 19, 14],
      depth: 13,
      heightBase: 16, heightMod: 14, heightSideOffset: 12, // ~16-42, tallest theme yet
      count: 18,
      gapMin: 1, gapRange: 6,
      leftGapStride: 7, leftGapOffset: 0,
      rightGapStride: 11, rightGapOffset: 3,
    },
  },
};
