// ========================================================================
// TIER THRESHOLDS -- the "how far to the next environment" dial
// ========================================================================
// Direct feedback: the points counter should read as progress toward a next
// tier, and "those tiers are supposed to be when I'm moving to the next
// environment... to give me like an accomplishment sense and then change the
// environment and the look of the game." The environment swap itself does not
// exist yet -- street.js has a THEMES table with one live theme -- so reaching
// a tier currently fires its celebration and nothing else. That hook is
// core/main.js's startNextLevel, which is where the theme change will go.
//
// "Those values need to be in a config file that's really easy to change as we
// go", so this file is nothing but the numbers. All the arithmetic lives in
// systems/progression.js, and nothing else in the game hardcodes a threshold.
//
// THESE ARE CUMULATIVE LIFETIME TOTALS, not per-tier costs. Reaching 900 points
// in a run means tier 2 is complete, not that tier 2 cost 900 on top of tier 1.
// Written that way because it's how the values were given ("first tier at 300,
// second one 900, third one 1500") and because it's what the HUD shows -- the
// bar reads "points / next threshold" directly, with no running subtraction to
// get wrong.
//
// To retune: edit the list. To add a tier: add a number. To change how the
// open-ended tail behaves: edit TIER_STEP_AFTER_LAST. Nothing else to touch.
//
// (A temporary 50/100/150 set was in effect for a while so level transitions
// could be reached in seconds while the transition itself was being built and
// tested. These are the real values, restored.)
export const TIER_THRESHOLDS = [300, 900, 1500];

// Every tier past the end of that list needs this many more points than the
// one before it, forever -- so tier 4 lands at 3000, tier 5 at 4500, and so on.
// This exists because a run has no maximum: without it the last authored
// threshold would be a wall the bar sits pinned against.
export const TIER_STEP_AFTER_LAST = 1500;

// FAST-TEST VALUES, if a level transition needs reaching quickly again:
//     export const TIER_THRESHOLDS = [50, 100, 150];
//     export const TIER_STEP_AFTER_LAST = 150;

// Shown in the bar. Purely cosmetic; the count of names does NOT limit how many
// tiers exist -- past the end it falls back to "TIER n" (see
// systems/progression.js's tierName). These are placeholders until the
// environments they're meant to announce actually exist.
// Ordered to match the themes that actually exist, so the bar never announces a
// district the player isn't in: centralCity is the active theme now, and
// sunnyStreet is the locked fallback lined up as the second district once
// LEVEL_SWAPS_ENVIRONMENT is switched on. ROOFTOPS is still aspirational (the
// build doc's back-alley -> market street -> rooftop arc), with no art yet.
export const TIER_NAMES = [
  'CENTRAL CITY',
  'SUNNY STREET',
  'ROOFTOPS',
];

// --- Level transition (core/main.js's level-complete flow) ---------------
// Reaching a tier ends the level: everything freezes, an overlay announces
// what's next, and after a countdown the world restarts fresh while points,
// tier, lives and SPEED all carry over. Chosen over transforming the
// environment mid-run, which would need ~50 meshes torn down and rebuilt
// without a frame spike; behind a covered screen that cost is free.
export const LEVEL_COUNTDOWN_SECONDS = 5;

// The environment swap this is all FOR is not wired yet -- deliberately, so
// the transition itself can be felt and tuned first. Flip to true once a
// second theme has art (data/envArt.js's centralCity is stubbed but has no
// street/facade textures of its own), and hook the actual swap at
// core/main.js's startNextLevel.
export const LEVEL_SWAPS_ENVIRONMENT = false;
