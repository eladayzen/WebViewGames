// Deterministic seeded RNG (mulberry32).
//
// The POC scenario must run IDENTICAL content in both framing modes (§0.1,
// §5.2) -- that identity is the entire basis of the A/B, so content order and
// placement cannot come from Math.random(). Every scenario decision draws from
// a run-scoped stream reseeded from POC_SCENARIO.seed, which means toggling
// the mode mid-session replays the same squadrons in the same places.
//
// Purely cosmetic jitter (particles, prop scatter shimmer) may use Math.random
// freely -- it does not affect what the player has to survive.

export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Float in [lo, hi). */
    range: (lo, hi) => lo + next() * (hi - lo),
    /** Integer in [lo, hi]. */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** Re-seed in place, so a scenario restart replays exactly. */
    reseed: (s) => {
      a = s >>> 0;
    },
  };
}
