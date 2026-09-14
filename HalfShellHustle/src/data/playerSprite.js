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
// SCRAP-BOT SKIN, POC, take 2: direct feedback caught that the old frame 0
// (crouch-dip) "has nothing to do with the run" -- it read as a jump
// anticipation pose, not a stride. Reassigned rather than regenerated: it's
// now PLAYER_JUMP_FRAMES[0] instead (see below). The run cycle is the
// three actual running poses from the old 12-frame set (former run_1/2/3:
// push-off, peak-hop-right, descend) plus a horizontally-mirrored copy of
// each (a pixel-guaranteed flip, not a second AI generation -- guarantees
// the left/right pair actually matches, same technique this project's
// turtle-era run cycle used for its own L/R mirror). 6 frames total.
//   0: push-off            -- launching, stretching taller
//   1: peak hop, right leg forward -- airborne, right leg forward
//   2: descending          -- falling, right leg reaching down
//   3: push-off, mirrored  -- same beat, flipped
//   4: peak hop, left leg forward  -- mirror of 1
//   5: descending, mirrored -- mirror of 2, loops back to 0
// holdUnits 3 on both peak-hop frames (1 and 4, the L/R mirrored pair):
// direct request -- the airborne moment reads better held a beat longer
// than the push-off/descend transitions around it.
const FRAMES_RAW = [
  { file: 'leo_run_0.png', holdUnits: 1, yOffset: -0.05, xOffset: 0 },
  { file: 'leo_run_1.png', holdUnits: 3, yOffset: 0.2, xOffset: 0.1 },
  { file: 'leo_run_2.png', holdUnits: 1, yOffset: 0, xOffset: 0 },
  { file: 'leo_run_3.png', holdUnits: 1, yOffset: -0.05, xOffset: 0 },
  { file: 'leo_run_4.png', holdUnits: 3, yOffset: 0.2, xOffset: -0.1 },
  { file: 'leo_run_5.png', holdUnits: 1, yOffset: 0, xOffset: 0 },
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
export const FRAME_LABELS = [
  'push-off', 'peak-R', 'descend', 'push-off-mirror', 'peak-L', 'descend-mirror',
];

// Seconds per hold-unit (see holdUnits above). 0.75 was a deliberate
// slow-motion value for diagnosing the frame sequence (now fixed, see the
// FRAMES_RAW reassignment note above) -- back to a real gameplay pace, in
// the same ballpark as the old 4-frame cycle's 0.102/frame.
export const RUN_FRAME_DURATION = 0.09;

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
// SCRAP-BOT SKIN, POC (halfshellhustle-hero-skin branch): direct request --
// this hero doesn't fight, so no dedicated attack art was made for him.
// "I don't care that the attack seq will be exactly like the run" -- so
// every attack sequence just plays the run cycle instead of leo_spin/
// leo_turn/leo_lunge (those files are still turtle art, left in place but
// unreferenced). Same aspect as the run cycle now, not a separate square
// one, since there's no independent art driving its own proportions anymore.
export const ATTACK_FRAME_ASPECT = PLAYER_FRAME_ASPECT;

export const ATTACK_SEQUENCES = [0, 1, 2].map((i) => ({
  key: `run-reuse-${i}`,
  frameDuration: RUN_FRAME_DURATION,
  frames: PLAYER_RUN_FRAMES.map((f) => ({ url: f.url })),
}));

// --- Jump frames (art only -- not wired into core/main.js's frame-debug
// HUD). entities/player.js plays PLAYER_JUMP_FRAMES once, evenly sliced
// across JUMP_RISE_DURATION, then holds the LAST entry for the rest of the
// jump (hold and fall). After PASS 3 below shipped, the game code was
// briefly simplified to show only ONE static pose for the entire jump
// (PLAYER_JUMP_FRAMES shrank to 1 entry, no art regenerated for it) --
// direct feedback has since reversed that and asked for a real 3-frame
// launch progression again, this time with much more specific per-frame
// direction than PASS 1/2 got (PASS 4 below). player.js's 3-frame
// rise-slice logic was restored to match. This section's full history is
// kept for lineage/context even though only PASS 4's 3 frames ship now.
//
// PASS 1 (3-frame launch/mid-ascent/peak progression, symmetric forward-V
// blade grip): one-lineage seeded from leo_run_1.png (primary, camera
// angle/build/style) + leo_lunge_1.png (secondary, "blades held forward"
// grip concept only) via a 2x2-grid generate_image_edit
// (gpt-image/1.5-image-to-image). First attempt merged both blades into
// one hand (other arm missing); one follow-up edit restored a second
// visible arm/hand. Shipped as art/originals/leo_jump_grid.png.
//
// PASS 2 (BLADE-ORIENTATION FIX): direct feedback rejected the symmetric
// forward-V as reading like a jumping-jack/balance pose, not an attack.
// Pushed blades forward/down and roughly parallel instead -- adapting
// leo_lunge_1.png's forward-parallel grip. Overwrote the same
// leo_jump_grid.png (two chained edits, same merged-hand bug hit and
// fixed again).
//
// PASS 3 (this one -- single held pose, NEW composite lineage, not another
// edit off leo_jump_grid.png): direct feedback gave much more specific
// correction after PASS 2 drifted the camera into a 3/4 angle with blades
// swept to one side and symmetric hanging legs -- all rejected. Rather than
// editing the increasingly-drifted grid lineage again, this pose was
// generated fresh from TWO existing shipped run-cycle/attack frames as dual
// source_images (gpt-image/1.5-image-to-image, per KOLBO_ASSET_PIPELINE.md's
// guidance for a meaningful pose change):
//   - leo_run_0.png (knee-drive-right) as the PRIMARY reference, called out
//     explicitly as the literal source of truth for BOTH the camera angle
//     (straight-on back view, shell flat-on, no rotation -- the #1 thing
//     the prior pass got wrong) AND the leg pose (one knee driven up,
//     trailing leg extended low -- an asymmetric jump-appropriate leg
//     silhouette that already existed in the run cycle, not reinvented).
//   - leo_lunge_1.png (peak lunge) as a SECONDARY reference for the
//     "blades held close together near the body" grip idea only --
//     explicitly prompted to ignore its horizontal dive body angle.
// Generated 3 candidates in one call (not committing to the first result,
// per this pass's own risk of repeating the camera-angle drift) and
// visually checked each against leo_run_0.png's body/shell angle before
// picking one. Two of the three drifted the sword-cross up above/behind
// the head (arms spread wide, closer to the rejected "swept to one side"
// failure mode); the third had the swords crossed close to the body but
// too high, near the neck rather than the chest. ONE follow-up
// generate_image_edit, chained off that third candidate (not back off the
// original dual-reference call), asked only to lower the arm/blade-cross
// point down to chest height while explicitly preserving the camera angle
// and leg pose -- landed the final pose: swords crossed in an X directly
// in front of his chest, forearms/grips tucked close to and overlapping
// his own torso silhouette, only the blade tips extending past his
// shoulders (not the full blade length out in open space).
//
// FIXED CANVAS, matching PLAYER_FRAME_ASPECT exactly (not a new constant):
// background-keyed locally the same way as KOLBO_ASSET_PIPELINE.md's
// white-key cutout (near-white threshold 245, feather from 225), cropped to
// its own alpha bbox (only one frame this time -- no sibling frames to keep
// canvas-aligned against, so a per-frame bbox crop doesn't reopen the
// run-cycle's multi-frame centroid-drift bug), then scaled by a single
// factor to a content height of 695px -- chosen to match leo_run_0.png's
// own alpha-bbox content height (728-33=695) so the character reads at the
// same on-screen scale as the run cycle -- and placed onto a fresh 800x760
// canvas with its bbox horizontally centered on the canvas's horizontal
// center (x=400, the same convention the prior jump-frame pass used) and a
// 33px top margin (matching leo_run_0.png's own top margin). The result is
// visibly narrower than leo_run_0.png's bbox (blades point up/in rather
// than out to the sides) -- expected and correct, not a bug: it's the
// direct visual signature of "tucked in close to the body" instead of the
// old wide flying-V silhouette.
//
// Archived (superseded by PASS 4 below, deleted along with everything else
// PASS 3 produced per this file's no-accumulation convention):
// art/originals/leo_jump_pose_source.png.
//
// PASS 4 (this one -- real 3-frame progression again, much more precise
// direct feedback than PASS 1/2 got): direct feedback gave an exact,
// per-frame breakdown this time -- squeeze-down, launching-up, then a main
// pose described as "basically close to [leo_run_1.png, the contact-right
// run frame] but the back should be a bit more stretched, ... heads a
// little bit up like looking up, but the arms should be in front hidden by
// the torso and shield, ... crossed but most of them hidden ... showing a
// little bit from the sides of the head." A real change of direction from
// PASS 3's approach (which built the main pose off leo_run_0's knee-drive
// leg pose): this time leo_run_1's CONTACT leg stance is the explicit base
// for frame 2, kept "essentially as-is."
//
// ONE-LINEAGE, single call: rather than PASS 3's dual-reference-plus-
// chained-edit process, all 3 frames were generated together in ONE
// gpt-image/1.5-image-to-image call (per the batch-prompt-character-
// sprite-sets rule) as three side-by-side panels in a single 3:2-aspect
// image, with leo_run_1.png as the SOLE source_image (flattened onto a
// real white RGB background first, per KOLBO_ASSET_PIPELINE.md's
// upload_media gotcha -- re-uploading an RGBA PNG as-is risks the
// transparent area re-encoding into a non-white noisy fill). The prompt
// called out leo_run_1's exact pose/build/style as the reference for all
// three panels' camera angle, described panel 3 (main pose) with the
// direct-feedback language above, and explicitly required the swords to
// stay MOSTLY HIDDEN behind the torso/shell with only small blade-tip
// hints near the head -- not the large visible crossed-blade shape PASS 3
// ended up with. Landed on the first attempt: no follow-up edit was
// needed, unlike every prior pass.
//
// PLACEMENT -- shared-anchor method, NOT independent per-frame content-
// bbox scaling (that's the "anchor drift" bug documented at length above
// in the run-cycle notes: an asymmetric/varying-height pose's bbox center
// doesn't line up with a sibling frame's the same way, so naively scaling
// each frame to a fixed content HEIGHT would erase the real height
// difference between a crouch and an extended launch, or shift the
// character sideways). Instead, each of the 3 panels was locally
// white-keyed (KOLBO_ASSET_PIPELINE.md's threshold-245/feather-225
// cutout), then placed using two anchors that are physically stable across
// a launch progression -- unlike the full-body bbox, which isn't:
//   - HEADBAND WIDTH as the scale anchor: the blue headband is present,
//     roughly constant-sized, and easy to isolate by color in all 3 poses
//     (unlike full-character-height, which SHOULD differ -- crouched is
//     shorter, launching is taller, that's the point). Each frame was
//     scaled so its own headband width matches leo_run_0/1's headband
//     width in their shared 800x760 canvas (96px) -- confirmed beforehand
//     that all 3 raw panels already had near-identical headband widths
//     (111-114px in source-panel space), i.e. the single generation call
//     already held character scale consistent on its own; per-frame scale
//     was still computed independently off each frame's own measurement
//     rather than one shared number, since normalizing head size is the
//     goal, not blindly reusing one frame's factor.
//   - HEADBAND-CENTER X as the horizontal anchor (same "top-band centroid"
//     principle as the run cycle's shell-centroid alignment above, just
//     using the headband specifically since it's a tighter, more reliably
//     detectable landmark than a generic top-45%-of-bbox region) -- each
//     frame's headband center was placed at the shared canvas center,
//     x=400.
//   - GROUND LINE at canvas y=728 for every frame's bbox BOTTOM -- matches
//     leo_run_0.png/leo_run_1.png/the old leo_jump_0.png's own content
//     bottom exactly, so a foot-plant reads at the same height turn to
//     turn instead of popping vertically on the swap.
// Net effect: all 3 frames share one 800x760 canvas, one horizontal
// anchor, and one ground line, while still legitimately growing taller
// frame to frame as the launch extends -- the crouch is visibly shortest,
// frame 2 visibly tallest, exactly as a real launch should read, without
// any of it coming from inconsistent/independent cropping.
//
// Archived: art/originals/leo_jump_grid.png (the raw 3-panel generation
// before per-panel white-key/scale/placement, matching the existing
// leo_spin_grid.png / leo_turn_grid.png / leo_lunge_grid.png naming
// convention for a batch source). art/final/ mirrors what shipped to
// src/assets/.
// SCRAP-BOT SKIN, POC, take 3: direct request -- keep the crouch-dip
// takeoff frame, but replace the rest of the launch/hold progression with
// a single held pose: the run cycle's own peak-hop-right frame
// (leo_run_1.png, PLAYER_RUN_FRAMES[1]), reused directly rather than
// duplicated as a separate asset. entities/player.js's rise-slice logic
// (Math.floor(riseT * PLAYER_JUMP_FRAMES.length), clamped) already handles
// any array length -- with 2 entries that's a quick flash of frame 0 at
// takeoff, then frame 1 held for the rest of the rise, hang, and fall.
// leo_jump_1/2/3.png are now unreferenced (left in place, not deleted).
// Frame 0 repeated 2x, not a holdUnits value: the rise-slice logic above
// has no hold-duration concept of its own (unlike the run cycle), it just
// divides JUMP_RISE_DURATION evenly across however many entries are here --
// so repeating the same URL is what gives crouch-dip 2/3 of that budget
// before leo_run_1 takes over for the last 1/3 and then holds (last entry).
export const PLAYER_JUMP_FRAMES = [
  { file: 'leo_jump_0.png' }, // crouch-dip (was the run cycle's old frame 0)
  { file: 'leo_jump_0.png' },
  { file: 'leo_run_1.png' }, // peak-hop-right, held for the rest of the jump
].map(({ file }) => ({
  url: new URL(`../assets/${file}`, import.meta.url).href,
}));
