// Leonardo's mask-tail ribbon (build doc §6, §9.1): a separate looping
// flutter-cycle billboard, independent of the body run-cycle frames (per
// direct feedback -- previously baked into the body art, now its own
// object so it can sway side-to-side on its own rather than being locked to
// the body's run-cycle timing).
//
// All 5 frames share the exact same (untrimmed) canvas size on purpose --
// unlike the body frames, these were kept at a fixed frame size (no per-
// frame alpha-bbox crop) so the knot anchor point stays pixel-consistent
// across frames; cropping each frame to its own bbox (as the body frames
// do) would shift the anchor around as the ribbon's flowing shape changes
// size frame to frame.
const FRAME_COUNT = 5;
const FRAME_W = 141;
const FRAME_H = 400;

export const RIBBON_FRAMES = Array.from({ length: FRAME_COUNT }, (_, i) => ({
  url: new URL(`../assets/ribbon_${i}.png`, import.meta.url).href,
}));
export const RIBBON_ASPECT = FRAME_H / FRAME_W;

// Seconds per frame -- a bit slower than the run cycle since it's a looser,
// looping cloth-flutter motion, not tied to footfall timing.
export const RIBBON_FRAME_DURATION = 0.14;
