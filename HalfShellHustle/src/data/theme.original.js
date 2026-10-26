// THE SCRAP-BOT THEME. Ships into StreamingAssets/RoboRun.
//
// See theme.tmnt.js for why there are two of these and what the rules are.
// This one is the theme the game has been built and tuned against since the
// reskin, so it is the reference: if the two files disagree about anything
// structural, this is the one that is right.

/**
 * Every image this theme draws, resolved against ITS OWN directory.
 *
 * THE LITERAL PATH IS THE WHOLE MECHANISM, not a style choice. Vite turns
 * `new URL('../assets/original/' + f, import.meta.url)` into a glob over that
 * ONE directory and emits exactly those files. Build the directory name from a
 * variable instead -- `../assets/${dir}/${f}` -- and the glob widens to every
 * subdirectory, every theme's art lands in every build, and the separation is
 * gone while still appearing to work. Keep the folder name written out.
 */
export const assetUrl = (file) => new URL(`../assets/original/${file}`, import.meta.url).href;

/**
 * The run cycle: six frames, with per-frame hold and offset.
 *
 * `holdUnits` is in units of RUN_FRAME_DURATION -- a 3 holds three times as
 * long as a 1 -- so the contact poses sit and the knee-drives flick past.
 */
export const RUN_FRAMES = [
  { file: 'leo_run_0.webp', holdUnits: 1, yOffset: -0.05, xOffset: 0 },
  { file: 'leo_run_1.webp', holdUnits: 3, yOffset: 0.2, xOffset: 0.1 },
  { file: 'leo_run_2.webp', holdUnits: 1, yOffset: 0, xOffset: 0 },
  { file: 'leo_run_3.webp', holdUnits: 1, yOffset: -0.05, xOffset: 0 },
  { file: 'leo_run_4.webp', holdUnits: 3, yOffset: 0.2, xOffset: -0.1 },
  { file: 'leo_run_5.webp', holdUnits: 1, yOffset: 0, xOffset: 0 },
];

/** Played once across the rise, then the last entry holds for the fall. */
export const JUMP_FRAMES = ['leo_jump_0.webp', 'leo_jump_0.webp', 'leo_run_1.webp'];

/** 760x800 for every frame in the cycle -- one shared aspect, not per-frame. */
export const FRAME_ASPECT = 760 / 800;
