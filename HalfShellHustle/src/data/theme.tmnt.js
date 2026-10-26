// THE TMNT THEME. Ships into StreamingAssets/HalfShellHustle.
//
// WHY THIS FILE EXISTS. The scrap-bot reskin (b660630, 14 Sep) overwrote the
// turtle art IN PLACE -- same filenames, new pictures -- so from that commit
// on, all-games could build RoboRun and only RoboRun. The TMNT game was still
// shipping in StreamingAssets but could not be rebuilt from the integration
// branch at all: its art existed only in history. That is the one thing this
// repo forbids in capitals, and it is why nobody could compress that game
// while every other one was being compressed.
//
// The 14 genuinely-turtle files in assets/tmnt/ were recovered from
// b660630^ and converted to WebP. The other 63 are COPIES OF THE ROBOT'S,
// deliberately, as placeholders.
//
// THE DUPLICATION IS THE POINT, not laziness. Elad, 26 Oct: all of this art
// gets replaced later, and "it has to be separated... so in the future when we
// get to replace the art, it will be simple and not break anything". A theme
// that falls back to the other theme's files for anything it is missing would
// make that replacement a code change -- find the fallback, remove it, hope
// nothing else used it. A theme that owns a complete set makes it a file drop:
// put the new picture in assets/tmnt/ under the same name and nothing else in
// the repo moves. RoboRun cannot be affected by it even by accident, because
// no build of RoboRun ever reads this directory.
//
// So: when real TMNT art arrives, overwrite files in assets/tmnt/. Do not
// touch this file, the code, or anything under assets/original/.
//
// SAME LEVELS AS THE ROBOT, by instruction -- same rotation, same count,
// different art eventually. There is no per-theme progression table and there
// should not be one; if the level lists ever diverge, that is a product
// decision to make deliberately, not a side effect of the art pipeline.

export const assetUrl = (file) => new URL(`../assets/tmnt/${file}`, import.meta.url).href;

/**
 * FOUR frames, not the robot's six, and this is real art rather than a stub.
 *
 * The turtle cycle shipped as four poses -- knee-drive-right, contact-right,
 * knee-drive-left, contact-left -- with even holds; the scrap-bot's six-frame
 * cycle with its 3-unit contact holds was authored later. Padding this out to
 * six by repeating frames would read as a stutter, and borrowing two robot
 * frames would put a robot inside the turtle's run. The hold/offset values are
 * the ones this art shipped with.
 */
export const RUN_FRAMES = [
  { file: 'leo_run_0.webp', holdUnits: 1, yOffset: -0.15, xOffset: 0 },
  { file: 'leo_run_1.webp', holdUnits: 1, yOffset: 0, xOffset: 0.15 },
  { file: 'leo_run_2.webp', holdUnits: 1, yOffset: -0.15, xOffset: 0 },
  { file: 'leo_run_3.webp', holdUnits: 1, yOffset: 0, xOffset: -0.15 },
];

/** Same shape as the robot's: dip, dip, then a held pose. Its own files. */
export const JUMP_FRAMES = ['leo_jump_0.webp', 'leo_jump_0.webp', 'leo_run_1.webp'];

/** The turtle frames share the robot's canvas size -- 800x760 either way. */
export const FRAME_ASPECT = 760 / 800;
