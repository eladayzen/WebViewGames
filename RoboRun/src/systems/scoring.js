// One headline POINTS number, fed by everything the player collects.
//
// Direct feedback: "I know that in the background you keep a different type of
// score for each value, but I actually want those values to be summed up into
// one main points value." So the per-source tallies stay (they're what the
// game-over recap breaks down, and what a future mission/quest system would
// read), but the HUD shows exactly one number.
//
// TWO TOTALS, and the split is the whole point of this file:
//
//   `total`     -- authoritative, incremented the instant something is
//                  collected. Nothing visual depends on it.
//   `displayed` -- what the HUD actually shows. Only ever moves when a flying
//                  +N label physically lands on the counter (ui/pointsFly.js).
//
// Keeping them apart is what makes the feedback honest rather than decorative:
// the number goes up BECAUSE the points arrived, so the causal link the
// feedback is meant to teach ("this is what's giving me points, and how many")
// is real rather than a coincidence of timing. It also means a label in flight
// is never double-counted.
//
// The gap between them is bounded by one label's flight time (~0.8s), and
// settleScore() closes it instantly when a run ends so the final figure is
// never short.

import { POINTS_PER_ENEMY } from '../data/constants.js';

export function createScoreState() {
  return {
    total: 0,
    displayed: 0,
    enemiesKilled: 0,
    coinsCollected: 0, // physical coins, both types -- NOT their point value
  };
}

export function resetScoreState(s) {
  s.total = 0;
  s.displayed = 0;
  s.enemiesKilled = 0;
  s.coinsCollected = 0;
}

// Each award returns the points granted, so the caller can hand that exact
// number straight to the flying label without recomputing it from the type.
export function awardEnemyKill(s) {
  s.enemiesKilled += 1;
  s.total += POINTS_PER_ENEMY;
  return POINTS_PER_ENEMY;
}

export function awardCoin(s, coinType) {
  s.coinsCollected += 1;
  s.total += coinType.points;
  return coinType.points;
}

// Called by ui/pointsFly.js when a label reaches the counter.
export function creditDisplayed(s, points) {
  s.displayed = Math.min(s.displayed + points, s.total);
}

// End of run: whatever was still mid-flight is credited immediately, so the
// game-over figure always equals what was actually earned.
export function settleScore(s) {
  s.displayed = s.total;
}
