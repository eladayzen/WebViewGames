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

// --- Attack sequences (auto-triggered on a Foot Soldier kill, entities/
// enemy.js, via entities/player.js's startPlayerAttack) -- direct feedback's
// addition, not in the original build doc: a super-fast in-place attack
// beat with heavy hand-drawn swoosh/motion-blur linework, then straight back
// into the run cycle. Multiple sequences rotate kill to kill (core/main.js
// tracks the rotation index) rather than always playing the same one.
//
// Every sequence is one-lineage seeded from the existing contact-right run
// frame (leo_run_1.png) via a single gpt-image/1.5-image-to-image pose edit
// that generated all 4 of ITS frames together as one 2x2 grid (per the
// batch-prompt-character-sprite-sets rule -- separate one-by-one edits risk
// a frame drifting off-model), then sliced at a shared FIXED cell size with
// no per-frame alpha-bbox crop -- same "fixed canvas, never independently
// cropped" principle as the run cycle above (ONE-LINEAGE REBUILD), so a
// sequence's 4 frames don't jitter/drift relative to each other despite
// wildly different motion-blur silhouette extents frame to frame.
//
// Square grid cells -- notably not PLAYER_FRAME_ASPECT. entities/player.js
// deliberately does NOT resize the billboard for these (that would reopen
// the exact per-frame-recompute bug the run cycle's fixed canvas fixed) -- a
// slight squash for a fraction of a second under heavy motion-blur linework
// doesn't read.
export const ATTACK_FRAME_ASPECT = 1;

const ATTACK_SEQUENCE_DEFS = [
  {
    key: 'swirl',
    filePrefix: 'leo_spin',
    // 0: wind-up -- torso starting to twist, blades sweeping outward.
    // 1: mid-spin -- blades arcing in a near-full circle of motion-blur.
    // 2: continuing spin -- blur whipping around the other side.
    // 3: landing -- blades snap to a forward running-ready grip, untwisting
    //    back toward the standard back-facing running pose.
    frameCount: 4,
    // Reached via 0.055 -> 0.0715 -> 0.0858 across direct feedback (each
    // step "too fast to register as playing").
    frameDuration: 0.0858,
  },
  {
    key: 'turn',
    filePrefix: 'leo_turn',
    // Bigger than 'swirl' -- a full turn-around rather than an over-the-
    // shoulder blur, briefly showing his front.
    // 0: starting the spin, same back view as the run pose, blades
    //    beginning to swing out wide to both sides.
    // 1: mid-turn -- rotated ~180 degrees, his FRONT (face/belly) visible,
    //    blades held out wide, peak motion-blur.
    // 2: continuing the rotation past the front, turning back toward a
    //    rear 3/4 view, blur easing off.
    // 3: landing -- back to the run pose, blades settling forward.
    frameCount: 4,
    // Slower than 'swirl' per direct feedback -- the bigger turn needs more
    // time to register. Dialed back from 0.12 -> 0.10 (direct feedback: "a
    // bit faster"), still slower than 'swirl's 0.0858 on purpose.
    frameDuration: 0.10,
    // Playback order direct feedback landed on after reviewing the frames
    // slowed way down (0, 1, 2, 3 read wrong) -- generated-frame index 2
    // first, then 1, then 0, then 3. Source files/comments above still
    // describe each frame by its generated index, not its playback order.
    frameOrder: [2, 1, 0, 3],
  },
  {
    key: 'lunge',
    filePrefix: 'leo_lunge',
    // A forward lunge-thrust rather than an in-place spin -- launches
    // forward low with both blades pointed straight ahead as the one big
    // dramatic peak frame, then tucks into a fast recovery roll back up
    // into his stride.
    // 0: wind-up -- crouching low, coiled backward, blades pulled in tight.
    // 1: peak lunge -- launched forward and low, body stretched horizontal,
    //    both blades held together pointed straight ahead like a spear.
    // 2: recovery roll -- tucked into a ball, shell leading, blades in.
    // 3: landing -- popping back up into the standard running pose.
    frameCount: 4,
    frameDuration: 0.0858, // same pace as 'swirl' for now
  },
];

export const ATTACK_SEQUENCES = ATTACK_SEQUENCE_DEFS.map((def) => {
  const order = def.frameOrder || Array.from({ length: def.frameCount }, (_, i) => i);
  return {
    key: def.key,
    frameDuration: def.frameDuration,
    frames: order.map((i) => ({
      url: new URL(`../assets/${def.filePrefix}_${i}.png`, import.meta.url).href,
    })),
  };
});
