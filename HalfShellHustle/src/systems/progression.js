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
  TIER_THRESHOLDS, TIER_STEP_AFTER_LAST, TIER_NAMES,
} from '../data/progression.js';

// Cumulative points needed to COMPLETE tier n (1-based). Past the authored list
// it keeps stepping by TIER_STEP_AFTER_LAST forever, so a long run never hits a
// wall the bar can only sit pinned against.
export function thresholdForTier(tier) {
  if (tier <= TIER_THRESHOLDS.length) return TIER_THRESHOLDS[tier - 1];
  const last = TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];
  return last + (tier - TIER_THRESHOLDS.length) * TIER_STEP_AFTER_LAST;
}

export function tierName(tier) {
  return TIER_NAMES[tier - 1] || `TIER ${tier}`;
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
  const span = next - start;
  const frac = span > 0 ? Math.min(1, Math.max(0, (points - start) / span)) : 1;
  return { tier, start, next, frac };
}
