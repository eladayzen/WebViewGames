// Leonardo's POC placeholder art (build doc §2, §6, as amended by direct
// playtest feedback: a real running sequence, viewed from behind, katana
// drawn in hand -- matching pipeline/build-docs/laneRunnerRef.png's look/
// character/sizes, not its enemy or exact prop set). Generated via Kolbo
// (gpt-image-2, back-view TMNT Mutant Mayhem cel-shaded style, referenced
// against laneRunnerRef.png + the Mutant Mayhem style stills in
// /Users/eladayzen/Documents/tmnt/), background-cut locally per
// KOLBO_ASSET_PIPELINE.md (Kolbo's own removebg is broken). The cutout-rig
// replacement (separate per-part sprites) is still an MVP requirement
// (§2, §9.1) -- this is a 4-frame whole-body run cycle, one step further
// than a single static billboard, not that rig.
//
// Each frame was cropped independently to its own alpha bounding box, so
// widths/heights differ slightly frame to frame (natural for a run cycle --
// contact frames are taller/leg-extended, passing frames are shorter/legs
// tucked) -- ASPECT carries each frame's own height/width ratio so
// entities/player.js can hold sprite width constant and recompute height per
// frame, keeping feet anchored to the ground instead of popping.
const FRAMES_RAW = [
  { file: 'leo_run_0.png', w: 640, h: 558 },
  { file: 'leo_run_1.png', w: 640, h: 503 },
  { file: 'leo_run_2.png', w: 640, h: 582 },
  { file: 'leo_run_3.png', w: 640, h: 491 },
];

export const PLAYER_RUN_FRAMES = FRAMES_RAW.map(({ file, w, h }) => ({
  url: new URL(`../assets/${file}`, import.meta.url).href,
  aspect: h / w,
}));

// Seconds per frame -- tuned to a readable, not-too-frantic run cadence at
// this game's deliberately-slower-than-native-genre pace (§1, §11).
export const RUN_FRAME_DURATION = 0.12;
