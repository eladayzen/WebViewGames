// Leonardo's POC art (build doc §2, §6, as amended by direct playtest
// feedback): a 6-frame whole-body running cycle, viewed from behind, katana
// drawn in hand -- matching pipeline/build-docs/laneRunnerRef.png's look/
// character/sizes. Regenerated from the original 4-frame set to fix broken/
// warped-looking swords and give a fuller stride (contact/recoil/high-knee-
// lift, both legs) -- generated with an explicit "same size, same
// horizontal center in every cell" instruction so frame-swapping doesn't
// jitter the character sideways.
//
// The flowing mask-tail ribbon is a SEPARATE object (entities/ribbon.js)
// with its own 5-frame looping flutter cycle and independent side-to-side
// sway, rather than baked into the body frames -- this body art only bakes
// in a short neutral mask-knot.
//
// Generated via Kolbo (gpt-image-2, back-view TMNT Mutant Mayhem cel-shaded
// style, referenced against laneRunnerRef.png), background-cut locally per
// KOLBO_ASSET_PIPELINE.md (Kolbo's own removebg is broken). The cutout-rig
// replacement (separate per-part sprites) is still an MVP requirement
// (§2, §9.1) -- this is a step further than that first single-frame
// placeholder, not that rig.
//
// Each frame was cropped independently to its own alpha bounding box, so
// widths/heights differ slightly frame to frame (natural for a run cycle --
// contact frames are taller/leg-extended, passing frames are shorter/legs
// tucked) -- ASPECT carries each frame's own height/width ratio so
// entities/player.js can hold sprite width constant and recompute height per
// frame, keeping feet anchored to the ground instead of popping.
//
// The original 4-frame run cycle (poses unchanged throughout), fixed in
// place via TWO consistent generate_image_edit passes across all 4 frames
// together (not per-frame, to avoid inconsistent results across the set):
// pass 1 shortened the long flowing ribbon to a knot and did a first sword
// pass; direct feedback caught that the swords were still visibly kinked/
// bent mid-blade (not just cropped) and that the ribbon needed to be fully
// gone, not just shortened. Pass 2 (this version) baked generous margin
// into each frame locally BEFORE editing (so spacing didn't depend on the
// model's judgment), redrew both katana as single straight rigid blades in
// every frame, and removed the ribbon down to a flat knot with zero
// trailing fabric. Since this body art has no ribbon at all now,
// entities/ribbon.js's separate looping flutter object could be re-enabled
// alongside it (currently still disabled in main.js).
const FRAMES_RAW = [
  { file: 'leo_run_0.png', w: 640, h: 509 },
  { file: 'leo_run_1.png', w: 640, h: 508 },
  { file: 'leo_run_2.png', w: 640, h: 520 },
  { file: 'leo_run_3.png', w: 640, h: 509 },
];

export const PLAYER_RUN_FRAMES = FRAMES_RAW.map(({ file, w, h }) => ({
  url: new URL(`../assets/${file}`, import.meta.url).href,
  aspect: h / w,
}));

// Seconds per frame -- 0.06 read too fast, backed off per direct feedback.
export const RUN_FRAME_DURATION = 0.08;
