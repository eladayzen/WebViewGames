// ========================================================================
// TIER THRESHOLDS -- the "how far to the next environment" dial
// ========================================================================
// Direct feedback: the points counter should read as progress toward a next
// tier, and "those tiers are supposed to be when I'm moving to the next
// environment... to give me like an accomplishment sense and then change the
// environment and the look of the game." Now fully wired -- see
// LEVEL_SWAPS_ENVIRONMENT and TIER_THEMES below.
//
// "Those values need to be in a config file that's really easy to change as we
// go", so this file is nothing but the numbers. All the arithmetic lives in
// systems/progression.js, and nothing else in the game hardcodes a threshold.
//
// THESE ARE CUMULATIVE LIFETIME TOTALS, not per-tier costs. Reaching 200 points
// in a run means tier 2 is complete, not that tier 2 cost 200 on top of tier 1.
// It's what the HUD shows -- the bar reads "points / next threshold" directly,
// with no running subtraction to get wrong.
//
// To retune: edit the list. To add a tier: add a number (and a TIER_NAMES /
// TIER_THEMES entry if it should announce or swap into something). To change
// how the open-ended tail behaves: edit TIER_STEP_AFTER_LAST.
//
// QA's temporary 100/200/300 values (fast-cycled theme checking) are done
// with -- back to the real production numbers, direct feedback.
export const TIER_THRESHOLDS = [300, 800, 1500];

// Every tier past the end of that list needs this many more points than the
// one before it -- so tier 4 lands at 2500, tier 5 at 3500, tier 6 (the
// last authored one, TIER_THEMES.length) at 4500. That final number IS the
// run's maximum now (2026-09-17: the run ends in victory there instead of
// looping) -- this constant is what still derives it, not a step toward an
// unbounded tail anymore.
export const TIER_STEP_AFTER_LAST = 1000;

// ========================================================================
// PER-TIER OBSTACLE DENSITY -- the "does it actually get harder" dial
// ========================================================================
// Direct feedback: "level 2 feels easier than level 1." Diagnosed as two
// separate bugs stacked together, both fixed by this system:
//
//   1. Nothing scaled obstacle density UP by tier at all. data/spawnConfig.js's
//      OBSTACLE_SPAWN_INTERVAL_SEC was a flat constant every tier read
//      identically -- there was no "harder" axis past tier 1, only the speed
//      ramp (systems/speed.js), which tops out ~45s into a RUN, long before
//      most players reach tier 2.
//   2. data/spawnConfig.js's LEVEL_RESTART_EASE_IN_DURATION_SEC grace period
//      re-widened spacing at the START of every level, tier 2+ included -- so
//      a level that just finished tier 1 at full settled density opened tier
//      2 measurably SPARSER for its first ~15s. core/main.js clamps against
//      this now (see its own comment) using tier 1's threshold below.
//
// Interval TIGHTENS (harder) by this many seconds per tier past the first,
// down to a floor -- tier 1 keeps data/spawnConfig.js's authored
// OBSTACLE_SPAWN_INTERVAL_SEC exactly as tuned (that value already reflects
// the "make it easier" pass earlier this session; this system only ever
// tightens FROM there, never independently of it). See systems/
// progression.js's obstacleIntervalForTier for the arithmetic.
//
// Obstacles only, matching data/spawnConfig.js's own established
// philosophy (the ease-in dial right above it in that file): obstacles are
// the one thing that costs a life. Enemies/coins/platforms are NOT scaled
// by tier -- enemies are rewarding to hit, coins are pure upside, and
// thinning either would make higher tiers emptier rather than harder,
// which was already litigated once ("we need difficulty but we need
// interest as well").
export const TIER_OBSTACLE_INTERVAL_STEP_SEC = 0.2;
// Floor keeps real headroom above data/spawnConfig.js's
// MIN_ENEMY_OBSTACLE_GAP_SEC (0.9s) -- at 1.3s that's a ~0.4s/31% open
// window, comfortably clear of the ~0.1s/6% choke this repo has already
// measured once (see that constant's own history in spawnConfig.js). Don't
// lower this without re-reading that note.
export const TIER_OBSTACLE_INTERVAL_FLOOR_SEC = 1.3;

// Shown in the bar. The count of names does NOT limit how many tiers exist --
// past the end, systems/progression.js's tierName WRAPS back to index 0 (see
// TIER_THEMES below, which wraps in lockstep).
//
// ORDER, direct feedback: sunnyStreet "doesn't look good enough at all" next
// to the now-fixed centralCity, so it moved to tier 3 to buy room for its own
// art upgrade (see envArt.js), and a brand-new theme -- HARBOR DOCKS -- was
// inserted at tier 2, deliberately different from both in palette, material
// language and building typology (industrial waterfront rather than another
// street of storefronts).
//
// A second attempt at "two more themes" (SUBWAY PLATFORM, ROOFTOP BRIDGE) was
// built, wired, and then explicitly rejected on sight: "completely bad...
// not in the right direction at all... closer to regular streets like the
// first one." Not a tunable detail this time -- underground/elevated settings
// are the wrong CONCEPT for this game, not an execution miss. Reverted rather
// than patched. Their art and theme definitions are left in envArt.js,
// unreferenced here, rather than deleted -- shelved, not lost, in case a
// street-level reframing of either ever makes sense; see the SHELVED note
// there for why they're inert.
// FINAL ORDER v2, direct request: "switch theme 3 and 4. first the city,
// then the harbour" -- CENTRAL CITY is back in rotation (was shelved in the
// v1 order below this comment's predecessor), slotted ahead of Harbor
// Docks; Sunny Street pushed later rather than dropped. spaceCity isn't
// built yet ("another theme for later") -- its slot is reserved in the
// comment below but can't be added to the arrays until real art exists for
// it, or themeForTier would resolve to an undefined THEMES entry.
// v4, direct request once Space City's art was built: asked where it should
// slot in rather than assuming (per this comment's own prior instruction),
// offered append/insert/replace -- answer was "replace Sunny Street" (tier
// 6). SUNNY STREET is now OUT of the rotation -- its theme definition stays
// in envArt.js, unreferenced, shelved the same way SUBWAY PLATFORM/ROOFTOP
// BRIDGE are (see that file's own SHELVED note), in case it's ever wanted
// back rather than lost.
export const TIER_NAMES = [
  'BIG WAREHOUSES -- UNDER ROOF', // "warehouse indoor"
  'BIG WAREHOUSES', // "warehouse outdoor"
  'CENTRAL CITY', // "the city"
  'HARBOR DOCKS', // "the harbour"
  'FUNKY FOREST',
  'SPACE CITY',
];

// --- Level transition (core/main.js's level-complete flow) ---------------
// Reaching a tier ends the level: everything freezes, an overlay announces
// what's next, and after a countdown the world restarts fresh while points,
// tier, lives and SPEED all carry over. Chosen over transforming the
// environment mid-run, which would need ~50 meshes torn down and rebuilt
// without a frame spike; behind a covered screen that cost is free.
export const LEVEL_COUNTDOWN_SECONDS = 5;

// How far into that countdown ui/hud.js's TMNT-graphic curtain panels START
// sliding closed (core/main.js's tick). Direct feedback: close them over the
// scene "so it will be easier to replace the backgrounds below it" -- the
// overlay's own radial-gradient background above is NOT fully opaque at its
// center, so the environment swap (disposeStreet/createStreet) was never
// actually hidden the way the comment above assumed; the curtains are what
// makes that true now. 2s gives the headline/confetti beat above a clear
// moment to itself before the curtains close over it.
// MUST stay under LEVEL_COUNTDOWN_SECONDS or the curtains never close at all.
export const LEVEL_CURTAIN_CLOSE_DELAY_SEC = 2;

// How long that close (and the matching open) animation itself takes --
// MUST match src/style.css's .lc-curtain transition duration exactly, since
// nothing enforces the two staying in sync automatically. core/main.js
// waits this long AFTER LEVEL_CURTAIN_CLOSE_DELAY_SEC before doing the
// environment swap below -- direct feedback, a second black-frame report:
// the first fix moved the swap to fire the instant the CLOSE was
// triggered, but the curtains were still mid-slide at that exact frame, so
// the swap's own stutter was visible peeking around them. Waiting for the
// close to actually finish first is what the "closed" in "swap while
// closed" was supposed to mean. LEVEL_CURTAIN_CLOSE_DELAY_SEC +
// LEVEL_CURTAIN_TRANSITION_SEC (2.6s) MUST stay comfortably under
// LEVEL_COUNTDOWN_SECONDS (5s), or the swap has no hidden window left to
// happen in before the curtains reopen.
export const LEVEL_CURTAIN_TRANSITION_SEC = 0.6;

// Wired: core/main.js's tick calls street.js's disposeStreet + createStreet
// when the reached tier's theme differs from the current one, once the
// curtains have fully closed.
export const LEVEL_SWAPS_ENVIRONMENT = true;

// Maps EACH TIER to the environment it plays in. Index 0 = tier 1. Keys must
// match data/envArt.js's THEMES map exactly, and this order must match
// TIER_NAMES above -- they describe the same sequence from two angles (what to
// call it, what to render).
//
// v5, direct request (2026-09-17): "an end screen after our current last
// theme, very celebrative." SUPERSEDES the earlier "loop forever" design --
// this list's length is now THE END OF THE RUN. Reaching this array's last
// entry's own tier threshold triggers core/main.js's completeRun (the
// victory screen), not a tier-up into a 7th environment; see systems/
// progression.js's progressAt (caps here) and isFinalTierCleared. Nothing
// past index length-1 is ever reached in practice anymore.
export const TIER_THEMES = ['warehouseRoof', 'warehouse', 'centralCity', 'harborDocks', 'funkyForest', 'spaceCity']; // see TIER_NAMES above
