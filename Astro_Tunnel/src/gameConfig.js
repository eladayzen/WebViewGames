// Central tuning file for gameplay difficulty and pickups.
// Edit values here and save — Vite's dev server hot-reloads automatically,
// no need to touch main.js/obstacles.js/tunnel.js for these kinds of changes.

export const GAME_CONFIG = {
  difficulty: {
    // Ordered plateaus the run steps through. Each tier's numbers hold
    // essentially constant for `holdSeconds` — so the player sees many
    // rings at the same difficulty in a row — then blend smoothly into the
    // next tier over `transitionSeconds` before holding flat again.
    // Previously this was a single 16s linear ramp end-to-end, so every
    // ring was already a little harder than the last one and no
    // intermediate difficulty was seen more than once or twice. The final
    // tier's holdSeconds is Infinity: once reached, difficulty stops
    // changing for the rest of the run.
    //   gapWidth           — obstacle wall opening, radians (bigger = easier)
    //   innerRadiusFactor  — how far the wall reaches toward the tunnel's
    //                        center, as a fraction of the ship's lane radius
    //                        (0 = thin band near the ship, 1 = full wall)
    //   spacingBonus       — extra world-units between rings at this tier
    tiers: [
      { gapWidth: Math.PI * 1.5, innerRadiusFactor: 0.78, spacingBonus: 16, holdSeconds: 25 }, // ~270° open — barely a blocker
      { gapWidth: Math.PI * 1.15, innerRadiusFactor: 0.55, spacingBonus: 10, holdSeconds: 35 }, // ~half-screen blocker
      { gapWidth: Math.PI * 0.85, innerRadiusFactor: 0.3, spacingBonus: 5, holdSeconds: 35 }, // ~60%-screen blocker
      { gapWidth: Math.PI / 2.2, innerRadiusFactor: 0, spacingBonus: 0, holdSeconds: Infinity }, // ~82° — today's full "big blocker" wall, final tier
    ],
    // Seconds spent smoothly blending from one tier's numbers into the
    // next's (taken out of the tail end of the earlier tier's holdSeconds).
    transitionSeconds: 8,
  },

  pickups: {
    // Chance (0-1) that any single eligible ring spawns a pickup cluster at
    // all. Cranked way up so the player is almost always chasing something
    // — was 0.45 (and briefly, before that, an implicit 1.0 with no gating
    // at all, which is what made clusters feel back-to-back with zero
    // breathing room instead of a deliberate constant stream).
    spawnChance: 0.95,
    // Minimum number of pickup-less rings required between two pickup
    // clusters, even if spawnChance would allow it sooner. Was 2 (real
    // breathing room between occasional clusters) — now 0, since the goal
    // is near-continuous gems, not spaced-out ones.
    minRingsBetweenClusters: 0,
    // Of rings that DO spawn a cluster, chance it's a life/heart instead of
    // a gem. This is intentionally much lower than before (was 0.14) —
    // spawnChance going from 0.45 to 0.95 alone would have quadrupled how
    // often hearts show up too, and hearts are meant to stay just as rare
    // as they were before this change, not scale up with gem density. Gem
    // volume is entirely controlled by spawnChance/minRingsBetweenClusters
    // above; this only controls the rare exception among those clusters.
    lifeChance: 0.035,
    // No life pickups at all before this many seconds into the run — keeps
    // hearts from showing up two or three at once in the player's very
    // first view of the tunnel.
    lifeMinStartSeconds: 25,
    // Slots available per cluster (the "scattered line" pattern uses all 3).
    maxSlots: 3,
    // How forgiving pickup collection is (world units).
    collectRadius: 1.05,
    collectZWindow: 1.5,
    // Shape of a spawned cluster — cumulative-style weights (don't need to
    // sum to 1; "line" is whatever's left over). Shifted hard toward the
    // 3-gem line so "tons of pickups" means bigger clusters too, not just
    // more-frequent single gems.
    clusterShapeWeights: {
      centered: 0.1, // single gem, dead center of the gap
      offCenter: 0.15, // single gem, random position in the gap
      // line (remaining ~0.75): 3-point scattered line, see lineMaxAngularSpread/lineZSpan below
    },
    // Max absolute angular spread (radians) of a 3-point scattered line,
    // capped independent of the ring's current gap width. Previously this
    // was a *fraction of gapWidth*, so early in a run — when gaps are wide
    // — the three pickups could end up ~150 degrees apart: a swing the
    // player physically can't make in the couple hundred milliseconds it
    // takes them to scroll past. This cap keeps every line reachable at
    // normal turn speed no matter how wide the gap currently is.
    lineMaxAngularSpread: Math.PI / 3, // 60 degrees
    // World-units between the first/last point of a scattered line and its
    // center point (so total z-span is 2x this).
    lineZSpan: 5,
  },
};
