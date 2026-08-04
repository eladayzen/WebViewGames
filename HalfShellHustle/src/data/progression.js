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
// one before it, forever -- so tier 4 lands at 2500, tier 5 at 3500, and so
// on. This exists because a run has no maximum: without it the last
// authored threshold would be a wall the bar sits pinned against.
export const TIER_STEP_AFTER_LAST = 1000;

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
export const TIER_NAMES = [
  'CENTRAL CITY',
  'HARBOR DOCKS',
  'SUNNY STREET',
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
// Past the end of this list, systems/progression.js's themeForTier WRAPS back
// to index 0 rather than leaving the theme unchanged -- direct feedback:
// "rotation after the last actual theme is being presented. The next one
// will start out from the first one." So tier 4 replays centralCity, tier 5
// harborDocks, and so on, forever -- which is also what lets TIER_THRESHOLDS
// keep an open-ended tail without ever needing art for a district that
// doesn't exist yet: the tail just re-tours the ones that do. tierName wraps
// the exact same way, so the "NEXT: X" announcement always matches.
export const TIER_THEMES = ['centralCity', 'harborDocks', 'sunnyStreet'];
