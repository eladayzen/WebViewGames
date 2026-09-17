// Tier progression arithmetic. All of it -- data/progression.js holds only the
// numbers, and nothing else in the game computes a threshold for itself.
//
// Tiers are 1-based in everything the player sees ("TIER 1" is the one you
// start inside). Thresholds are cumulative lifetime totals, so tier 1 spans
// 0 -> 300, tier 2 spans 300 -> 900, and so on; see data/progression.js for why
// they're expressed that way.
//
// Deliberately pure and stateless: no run state, no caching. `progressAt` is
// called only when the displayed score actually changes (a flying label
// landing), not per frame, so there is nothing here worth memoising and a
// cache would just be a second thing that can disagree with the config.

import {
  TIER_THRESHOLDS, TIER_STEP_AFTER_LAST, TIER_NAMES, TIER_THEMES,
  TIER_OBSTACLE_INTERVAL_STEP_SEC, TIER_OBSTACLE_INTERVAL_FLOOR_SEC,
} from '../data/progression.js';

// Cumulative points needed to COMPLETE tier n (1-based). Past the authored list
// it keeps stepping by TIER_STEP_AFTER_LAST forever, so a long run never hits a
// wall the bar can only sit pinned against.
export function thresholdForTier(tier) {
  if (tier <= TIER_THRESHOLDS.length) return TIER_THRESHOLDS[tier - 1];
  const last = TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];
  return last + (tier - TIER_THRESHOLDS.length) * TIER_STEP_AFTER_LAST;
}

// Wraps rather than falling back to "TIER n" past the end of the authored
// list. Harmless safety net now that progressAt (below) caps tier at
// TIER_THEMES.length before it ever reaches this far -- kept rather than
// simplified in case something someday calls tierName with a raw,
// uncapped tier number.
export function tierName(tier) {
  if (TIER_NAMES.length === 0) return `TIER ${tier}`;
  return TIER_NAMES[(tier - 1) % TIER_NAMES.length];
}

// The environment key a tier plays in (data/envArt.js's THEMES). Wraps back
// to index 0 past the end of TIER_THEMES rather than returning null, same
// harmless-safety-net reasoning as tierName above -- core/main.js never
// actually calls this with a tier past TIER_THEMES.length in practice
// anymore, since progressAt caps there and isFinalTierCleared ends the run
// instead of ever requesting a tier-up past it (2026-09-17: "an end screen
// after our current last theme", superseding the earlier "rotate back to
// the first theme forever" design).
export function themeForTier(tier) {
  if (TIER_THEMES.length === 0) return null;
  return TIER_THEMES[(tier - 1) % TIER_THEMES.length];
}

// Obstacle spawn interval for a given tier -- tightens (harder) by
// TIER_OBSTACLE_INTERVAL_STEP_SEC per tier past the first, clamped at
// TIER_OBSTACLE_INTERVAL_FLOOR_SEC so it never chokes out the enemy
// spawner (see that constant's own comment). `baseIntervalSec` is tier 1's
// own value (data/spawnConfig.js's OBSTACLE_SPAWN_INTERVAL_SEC) -- passed
// in rather than imported here, so this stays pure arithmetic over a
// caller-supplied number, same spirit as thresholdForTier above.
export function obstacleIntervalForTier(tier, baseIntervalSec) {
  const tightened = baseIntervalSec - (tier - 1) * TIER_OBSTACLE_INTERVAL_STEP_SEC;
  return Math.max(TIER_OBSTACLE_INTERVAL_FLOOR_SEC, tightened);
}

// Everything the HUD needs for one score, in one object:
//   tier   1-based tier currently being worked through
//   start  points at which this tier began
//   next   points that complete it
//   frac   0..1 across the bar
//
// The loop is bounded by the score itself rather than `while (true)`: with a
// misconfigured TIER_STEP_AFTER_LAST of 0 every threshold past the list would
// be identical and a naive loop would never terminate. Guarded rather than
// assumed, because that config file is meant to be edited casually.
//
// CAPPED at the last AUTHORED tier (TIER_THEMES.length) -- direct request,
// 2026-09-17: "an end screen after our current last theme." Past that point
// the run is heading toward isFinalTierCleared/completeRun (core/main.js),
// not another tier-up transition, so this pins the return at the final tier
// with a full bar and no next threshold to show -- the same "no bar on the
// last stage" convention every other GoBalance game's finite campaign uses
// (see e.g. TmntSkateSlice's getScoreBand). TIER_STEP_AFTER_LAST still
// computes tiers past the authored TIER_THRESHOLDS list internally (tier 4
// onward derive from it), it just never surfaces past TIER_THEMES.length now.
export function progressAt(points) {
  let tier = 1;
  let start = 0;
  let next = thresholdForTier(1);
  while (points >= next && tier < 1000) {
    tier += 1;
    start = next;
    const t = thresholdForTier(tier);
    // A non-advancing threshold means the config is broken; stop here and let
    // the bar pin rather than hanging the frame.
    if (t <= start) { next = start; break; }
    next = t;
  }

  const maxTier = TIER_THEMES.length;
  if (maxTier > 0 && tier > maxTier) {
    return { tier: maxTier, start: thresholdForTier(maxTier), next: Infinity, frac: 1 };
  }

  const span = next - start;
  const frac = span > 0 ? Math.min(1, Math.max(0, (points - start) / span)) : 1;
  return { tier, start, next, frac };
}

// True the moment the LAST authored tier's own threshold is crossed -- i.e.
// the whole run is won (2026-09-17, direct request: "an end screen after our
// current last theme, very celebrative"). Checked directly against
// thresholdForTier rather than through progressAt's now-capped tier number,
// so it stays a plain score comparison independent of that pinning.
export function isFinalTierCleared(points) {
  return TIER_THEMES.length > 0 && points >= thresholdForTier(TIER_THEMES.length);
}
