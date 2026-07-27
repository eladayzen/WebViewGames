// Leonardo's POC art (build doc §2, §6, as amended by direct playtest
// feedback): a whole-body running cycle, viewed from behind, katana drawn
// in hand -- matching pipeline/build-docs/laneRunnerRef.png's look/
// character/sizes.
//
// The flowing mask-tail ribbon is a SEPARATE object (entities/ribbon.js)
// with its own 5-frame looping flutter cycle and independent side-to-side
// sway, rather than baked into the body frames -- this body art bakes in
// no ribbon at all (a flat knot only), and the ribbon object is currently
// disabled in main.js since there's nothing to attach it to differently
// from a knot yet.
//
// STYLE PIVOT: direct feedback asked to extract just the character from
// pipeline/build-docs/laneRunnerRef.png (via Kolbo, background/enemy/scene
// removed) and use that as the new primary design reference -- a real style
// change, from this project's original painterly cel-shaded Mutant Mayhem
// look to a bolder flat-cartoon look (clean thick black outlines, flat
// color blocks) matching that isolated extraction. Confirmed explicitly
// before proceeding (this ripples into environment art eventually, for a
// full art-direction pass, not done here). Generated across 3 models for
// comparison (nano-banana-pro, gpt-image-2, kling-image/o3) -- gpt-image-2
// was chosen; nano-banana-pro also matched the style reasonably but neither
// of its poses were distinct enough, and Kling ignored the brief entirely
// (rendered a side-view punching pose with no swords, likely its much
// shorter prompt-length cap mangling the instructions).
//
// FIXED CANVAS, not per-frame alpha-bbox crop: an asymmetric pose (e.g. one
// leg thrown forward, the other back) has a bounding box whose center
// doesn't line up with the torso the same way a symmetric pose's does, so
// cropping each frame to its own bbox made the billboard's center-anchor
// drift sideways frame to frame -- a real bug direct feedback caught, not
// a perceived one. Fixed at the root: all 4 frames are sliced from their
// shared source grid at the SAME cell rectangle and keyed transparent
// WITHOUT any per-frame crop, so every frame is an identical 640x480
// canvas. On top of that, each frame's shell was measured and horizontally
// shifted so its alpha-weighted centroid (top 45% of the canvas, the
// head+shell band, unaffected by leg pose) lands on the exact same X
// position -- belt-and-suspenders on top of the fixed canvas, since the
// model doesn't draw pixel-identical centering on its own.
//
// Poses -- KNEE-DRIVE / CONTACT breakdown. The first version of this style
// paired knee-drive with a "flying-leap" (both legs stretched out to the
// SIDES) -- direct feedback rejected that outright: it read as a side
// split, nothing to do with running. What running actually needs is a
// CONTACT frame: the leg that was driving up in the knee-drive frame comes
// down and plants on the ground, while the trailing leg folds up to begin
// its own swing:
//   0: Knee-drive-right -- right knee driven up past hip height, the top
//      of that thigh tucked behind/occluded by the shell from this angle;
//      left leg thrown straight back, low. (Unchanged from the first style
//      pass -- direct feedback approved this pose specifically.)
//   1: Contact-right -- the right leg (driving in frame 0) has landed and
//      planted on the ground; the left leg (trailing in frame 0) folds up
//      sharply, thigh+shin together, foot lifting behind him to begin its
//      swing. Torso leans forward, arms sweep back behind him (the anime/
//      manga dash-run silhouette) instead of held out to the sides.
//   2: Knee-drive-left -- mirror of frame 0.
//   3: Contact-left -- mirror of frame 1, leads back into frame 0 to loop.
// Frame 1 was only generated once and came back identical in both grid
// cells (no actual L/R mirroring), so frame 3 is a horizontal flip of
// frame 1 rather than a second independent generation -- a pixel-
// guaranteed mirror, avoiding a repeat of the same non-mirroring failure.
// Elbow/wrist/knee wraps are blue (matching the head mask) per direct
// feedback -- the extracted style reference had them brown/tan.
//
// ONE-LINEAGE REBUILD: direct feedback made a key process observation --
// stitching frames generated in separate, unrelated batches (as every
// version above did) keeps causing scale/canvas/style mismatches, because
// nothing guarantees two independent generations agree on anything. The
// approved contact-right frame was instead used as the SOLE seed for this
// version: one fresh unified 2x2 generation using it as style/arm-pose
// reference (arms sweep back behind him, not out to the sides -- the
// approved manga/anime dash-run look, kept in every frame this time), then
// -- since that grid's 4 cells again collapsed into near-duplicates, no
// real mirroring -- the actual 4 frames were built from a SINGLE clean
// frame of that generation via: a horizontal flip for its mirror (pixel-
// guaranteed, not regenerated) and one generate_image_edit pose-change
// (gpt-image/1.5-image-to-image, better suited to real pose changes per
// Kolbo's own model guidance) to derive the knee-drive variant from that
// same frame, mirrored the same way. Every frame's lineage traces to one
// image, not four independent generations -- this is what actually fixed
// the mismatches, not another round of prompt tweaking.
//   0: Knee-drive-right -- right knee driven up past hip height, tucked
//      behind/occluded by the shell; left leg thrown straight back low.
//   1: Contact-right -- right leg planted on the ground; left leg folds up
//      sharply behind him, beginning its swing.
//   2: Knee-drive-left -- mirror of frame 0 (horizontal flip).
//   3: Contact-left -- mirror of frame 1 (horizontal flip), loops to 0.
// Canvas grew to 800x760 (from 640x480) to fit the knee-drive pose's taller
// natural content without cropping the head -- same "grow the shared
// canvas, never shrink the character" principle as the prior version, the
// two source images were rescaled to a matching character size (arm-span
// width) before being placed into it since they came from a text-to-image
// generation and an edit at different native resolutions.
// Archived: art/originals/leo_run_base_sheet.png (the 4-cell generation
// this was seeded from) and leo_run_kneedrive_edit_source.png (the pose-
// edit output before rescale/recenter), plus leo_run_<n>_<pose>.png for
// each final frame; art/final/ mirrors what shipped to src/assets/.
// Superseded iterations (contact/down, moderate stride/passing, stride/
// fold x2, knee-drive/flying-leap, knee-drive/contact-v1) were deleted
// from both archive folders once this version landed.
// holdUnits back to equal (1) for every frame per direct feedback -- the
// earlier 3:1 knee-drive:contact ratio made the extreme poses linger too
// long. Left in place as a per-frame knob (not deleted) in case uneven
// timing is wanted again later.
//
// yOffset: a discrete, STEPPED per-frame vertical offset (world units) --
// NOT a smoothed/spline bob. Direct feedback explicitly rejected a
// continuous cosine wave in favor of a plain two-level snap, applied the
// instant a frame becomes active in entities/player.js, not eased toward.
// Both knee-drive frames now dip to the same lower position (the "stronger
// peak"), contact frames stay neutral.
//
// xOffset: same discrete-step idea, horizontal -- the contact frames each
// get a small opposite-sign push (the planted foot reads as slightly
// forward/back of the lane center depending on which side is grounded)
// instead of sitting dead-center every contact. Knee-drive frames stay
// neutral. Added on top of the lane-position easing in entities/player.js,
// not baked into it, so lane-changing still eases normally underneath.
const FRAMES_RAW = [
  { file: 'leo_run_0.png', holdUnits: 1, yOffset: -0.15, xOffset: 0 }, // knee-drive-right
  { file: 'leo_run_1.png', holdUnits: 1, yOffset: 0, xOffset: 0.15 }, // contact-right
  { file: 'leo_run_2.png', holdUnits: 1, yOffset: -0.15, xOffset: 0 }, // knee-drive-left
  { file: 'leo_run_3.png', holdUnits: 1, yOffset: 0, xOffset: -0.15 }, // contact-left
];

// All 4 frames share this exact canvas size (see the ONE-LINEAGE REBUILD
// note above) -- one shared aspect ratio for the whole cycle, not per-frame.
export const PLAYER_FRAME_ASPECT = 760 / 800;

export const PLAYER_RUN_FRAMES = FRAMES_RAW.map(({ file, holdUnits, yOffset, xOffset }) => ({
  url: new URL(`../assets/${file}`, import.meta.url).href,
  holdUnits,
  yOffset,
  xOffset,
}));

// Short labels for the temporary on-screen frame-debug readout (ui/hud.js,
// wired in core/main.js) -- lets direct feedback reference "frame 1"
// unambiguously instead of describing a pose in words.
export const FRAME_LABELS = ['knee-drive-R', 'contact-R', 'knee-drive-L', 'contact-L'];

// Seconds per hold-unit (see holdUnits above) -- one "contact" frame lasts
// exactly this long; one "knee-drive" frame lasts 3x this.
export const RUN_FRAME_DURATION = 0.102; // 0.12 * 0.85 -- 15% faster

// --- Spin attack (auto-triggered on a Foot Soldier kill, entities/enemy.js,
// entities/player.js's startPlayerAttack) -- direct feedback's addition, not
// in the original build doc: a super-fast in-place spin with both katana
// swirling, heavy hand-drawn swoosh/motion-blur linework, then straight back
// into the run cycle. One-lineage seeded from the existing contact-right run
// frame (leo_run_1.png) via a single gpt-image/1.5-image-to-image pose edit
// that generated all 4 frames together as one 2x2 grid (per the batch-
// prompt-character-sprite-sets rule -- separate one-by-one edits risk a
// frame drifting off-model), then sliced at a shared FIXED cell size with no
// per-frame alpha-bbox crop -- same "fixed canvas, never independently
// cropped" principle as the run cycle above (ONE-LINEAGE REBUILD), so the 4
// frames don't jitter/drift relative to each other despite wildly different
// motion-blur silhouette extents frame to frame.
//   0: wind-up -- torso starting to twist, blades sweeping outward.
//   1: mid-spin -- blades arcing in a near-full circle of motion-blur.
//   2: continuing spin -- blur whipping around the other side.
//   3: landing -- blades snap to a forward running-ready grip, untwisting
//      back toward the standard back-facing running pose, loops back into
//      the run cycle from here.
const ATTACK_FRAMES_RAW = [
  { file: 'leo_spin_0.png' },
  { file: 'leo_spin_1.png' },
  { file: 'leo_spin_2.png' },
  { file: 'leo_spin_3.png' },
];

// Square grid cells -- notably not PLAYER_FRAME_ASPECT. entities/player.js
// deliberately does NOT resize the billboard for this (that would reopen the
// exact per-frame-recompute bug the run cycle's fixed canvas fixed) -- a
// slight squash for ~0.2s under heavy motion-blur linework doesn't read.
export const ATTACK_FRAME_ASPECT = 1;

export const ATTACK_FRAMES = ATTACK_FRAMES_RAW.map(({ file }) => ({
  url: new URL(`../assets/${file}`, import.meta.url).href,
}));

// Seconds per frame -- "super fast" per direct feedback: the whole 4-frame
// spin should read as a quick flash of blurred sword-swirl, not a readable
// multi-pose beat. Slowed twice from the original 0.055 per direct feedback
// (too fast to register as playing) -- 30% to 0.0715, then another 20% to
// 0.0858 (~0.34s total) for visibility while testing.
export const ATTACK_FRAME_DURATION = 0.0858;
