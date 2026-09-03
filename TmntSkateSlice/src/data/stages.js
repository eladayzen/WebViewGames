// Stage / difficulty-ramp definitions (build doc §5.2, §8, §12).
//
// 8 in-game stages (2026-08-06, up from the original MVP's 3 -- the future
// tuning pass the old comment here deferred). Rooftop -> Fire Escape ->
// Alley -> Subway -> Sewer -> Neon Street -> Warehouse Rooftop -> Docks,
// escalating from the doc's original rooftop/fire-escape/alley example
// order into a "descent into the city" arc that ends on the Docks as a
// finale set piece.
//
// All pacing numbers (fall speed, spawn interval, item-mix odds, thresholds)
// are DIRECTIONAL per §12 -- the source report could only loosely infer
// tempo from a sparse low-quality sample. Skewed conservative/slow on
// purpose, and tune-able here in one place once there's real on-device board
// feel to test against.
//
// fallSpeedFrac is expressed as "fractions of canvas height per second" so
// travel time (and therefore how much reaction time a falling item gives)
// stays consistent across canvas sizes.
//
// groundYFrac is PER STAGE, not global (2026-07-22) -- each background was
// painted at a different implied camera depth (the rooftop floor is a big
// close-up plane; the fire-escape deck recedes behind a railing close to
// camera; the alley recedes into a corridor), so one fixed ground line
// can't sit right against all three. PLAYER_HEIGHT_FRAC (constants.js), by
// contrast, is deliberately NOT per-stage -- Michelangelo is the same
// character at the same size no matter what level he's standing in;
// per-stage feedback about how he reads against a background is feedback
// on that background (groundYFrac, or the art itself), never a reason to
// resize him.
// Real production advanceScore thresholds restored (2026-08-06) after a
// playtest pass that temporarily lowered them (50/100/200/400/600/800/
// 1000) to reach all 8 stages quickly. Each stage's testing value is noted
// inline in a comment next to its real value in case another fast-pass
// playtest is needed later.
export const STAGES = [
  {
    id: 'rooftop',
    name: 'Rooftop',
    bannerLabel: 'STAGE 1',
    bg: 'bg_rooftop',
    groundYFrac: 0.87,
    fallSpeedFrac: 0.16,
    spawnIntervalSec: 1.4,
    bombChance: 0.24, // a bit more, not a lot (2026-08-05, was 0.20) -- see systems/bombPresence.js for the separate "never too long without one" floor
    // Highest power-up rate of any stage ON PURPOSE (raised 0.12 -> 0.16,
    // 2026-08-02): the early game should hand out the most help (now
    // shield-dominated -- see powerUps.js) so a new player survives the
    // learning curve; later stages lower this as skill ramps up.
    powerUpChance: 0.16,
    // pizzaChance is implicit: 1 - bombChance - powerUpChance - box-variant weights
    // Level advancement is SCORE-ONLY (2026-08-02): advanceTimeSec is Infinity
    // so a level changes at exactly its score threshold, never on a timer.
    // Cumulative thresholds; the per-level increment grows by 500 from L3 on:
    //   L1->L2 500 | L2->L3 3000 | L3->L4 4500 (+1500) | L4->L5 6500 (+2000)
    //   | L5->L6 9000 (+2500) | ... (+500 each level)
    // Only 2 transitions exist today (3 stages); the rest is the pattern for
    // any future stages.
    advanceScore: 500, // real value; testing value was 50 (2026-08-06)
    advanceTimeSec: Infinity,
  },
  {
    id: 'fire-escape',
    name: 'Fire Escape',
    bannerLabel: 'STAGE 2',
    bg: 'bg_fire_escape',
    // Zoomed + re-tuned (2026-08-06, see core/render.js's drawBackground):
    // the railing's perspective corner used to cross the floor line near
    // both edges. First pass only cropped it out of the reachable play
    // area (scale 1.1667); direct feedback (after the same fix on Subway)
    // wanted it gone from view ENTIRELY, so this crops the full canvas
    // edge-to-edge to the clean center of the source art instead (scale
    // 1.3889 = 1/0.72, where 0.14-0.86 was the verified-clear source
    // range) -- no railing-corner pixel is ever on screen, at any x.
    // Movement is NOT restricted -- the player can still walk the full
    // play area. Verified by compositing the sprite against the actual
    // re-cropped art at both edges and center before picking these numbers.
    bgScale: 1.3889,
    bgOffsetYFrac: -0.1,
    groundYFrac: 0.89,
    fallSpeedFrac: 0.21,
    spawnIntervalSec: 1.15,
    bombChance: 0.32, // a bit more, not a lot (2026-08-05, was 0.28)
    powerUpChance: 0.13,
    advanceScore: 2000, // retuned 2026-09-03 (was 3000)
    advanceTimeSec: Infinity, // score-only advancement
  },
  {
    id: 'alley',
    name: 'Alley',
    bannerLabel: 'STAGE 3',
    bg: 'bg_alley',
    // Zoomed (2026-08-06, see core/render.js's drawBackground): the raised
    // loading-dock curb used to cross the floor line near both edges (a
    // pre-existing issue, not one of the 5 new stages -- only found once a
    // live screenshot sweep checked the edges, not just center). Movement
    // is NOT restricted; the zoom crops the curb out of view instead.
    // Slight offsetX since the curb wasn't quite symmetric left/right.
    bgScale: 1.1667,
    bgOffsetXFrac: 0.012,
    groundYFrac: 0.87, // unchanged -- the zoom happened to land the floor at the same spot
    fallSpeedFrac: 0.26,
    spawnIntervalSec: 0.95,
    bombChance: 0.39, // a bit more, not a lot (2026-08-05, was 0.35)
    powerUpChance: 0.14,
    advanceScore: 4000, // retuned 2026-09-03 (was 4500)
    advanceTimeSec: Infinity,
  },
  {
    id: 'subway',
    name: 'Subway',
    bannerLabel: 'STAGE 4',
    bg: 'bg_subway',
    // Zoomed + re-tuned (2026-08-06, see core/render.js's drawBackground):
    // the flanking pillar bases sat right at both edges. First pass only
    // cropped them out of the reachable play area (scale 1.6154) but left
    // a sliver visible in the unreachable margins; direct feedback wanted
    // the poles gone from view ENTIRELY, so this crops the full canvas
    // edge-to-edge to the clean center of the source art (scale 1.9231 =
    // 1/0.52, where 0.24-0.76 was the verified-clear source range) --
    // no pole pixel is ever on screen, at any x, reachable or not.
    // bgOffsetYFrac pulls the crop down a bit (keeps the tunnel arch +
    // posters in frame; a purely centered crop pushed the top too close
    // and lost too much floor). Movement is NOT restricted -- the player
    // can walk the full play area. Verified by compositing the sprite
    // against the actual re-cropped art at both edges and center before
    // picking these numbers.
    bgScale: 1.9231,
    bgOffsetYFrac: -0.15,
    groundYFrac: 0.92,
    fallSpeedFrac: 0.30,
    spawnIntervalSec: 0.82,
    bombChance: 0.42,
    powerUpChance: 0.13,
    advanceScore: 6500, // real value; testing value was 400 (2026-08-06)
    advanceTimeSec: Infinity,
  },
  {
    id: 'sewer',
    name: 'Sewer',
    bannerLabel: 'STAGE 5',
    bg: 'bg_sewer',
    // Art edited (2026-08-06, Track B, see art/archive/pre-track-b-backgrounds/
    // for the original): the center water channel that used to split the
    // walkway into two islands is now a continuous flat floor across the
    // full width. Even after that edit, the round tunnel's curved walls
    // still crept in close enough to the reachable edges to look like
    // standing against the wall -- zoomed + re-tuned (see core/render.js's
    // drawBackground) the same way as fire-escape/subway, cropping the
    // full canvas edge-to-edge to the clean center of the art (scale
    // 1.5625 = 1/0.64, where 0.18-0.82 was the verified-clear range) so
    // no wall pixel is ever under his feet, at any x.
    bgScale: 1.5625,
    bgOffsetYFrac: -0.18,
    groundYFrac: 0.89,
    fallSpeedFrac: 0.33,
    spawnIntervalSec: 0.72,
    bombChance: 0.45,
    powerUpChance: 0.12,
    advanceScore: 9000, // real value; testing value was 600 (2026-08-06)
    advanceTimeSec: Infinity,
  },
  {
    id: 'neon-street',
    name: 'Neon Street',
    bannerLabel: 'STAGE 6',
    bg: 'bg_neon_street',
    groundYFrac: 0.89,
    fallSpeedFrac: 0.36,
    spawnIntervalSec: 0.64,
    bombChance: 0.47,
    powerUpChance: 0.12,
    advanceScore: 12000, // real value; testing value was 800 (2026-08-06)
    advanceTimeSec: Infinity,
  },
  {
    id: 'warehouse',
    name: 'Warehouse Rooftop',
    bannerLabel: 'STAGE 7',
    bg: 'bg_warehouse',
    // Art edited (2026-08-06, Track B, see art/archive/pre-track-b-backgrounds/
    // for the original): the pallets/cable coil that intruded deep into
    // both edges are now pushed to the margins and shrunk. groundYFrac
    // (0.89) already worked and needed no change -- re-verified at both
    // edges via the same sprite-composite check as every other stage.
    groundYFrac: 0.89,
    fallSpeedFrac: 0.38,
    spawnIntervalSec: 0.58,
    bombChance: 0.49,
    powerUpChance: 0.11,
    advanceScore: 15500, // real value; testing value was 1000 (2026-08-06)
    advanceTimeSec: Infinity,
  },
  {
    id: 'docks',
    name: 'Docks',
    bannerLabel: 'STAGE 8',
    bg: 'bg_docks',
    // Art edited (2026-08-06, Track B, see art/archive/pre-track-b-backgrounds/
    // for the original): the deck used to physically narrow away near the
    // right edge (no floor pixels past a point, just open under-pier
    // bracing over water); it now spans the full frame width, and the
    // rope-and-lantern guard rail was moved up/back out of the walkable
    // band. groundYFrac re-tuned + re-verified at both edges (and center)
    // via the same sprite-composite check as every other stage.
    groundYFrac: 0.89, // was 0.83
    fallSpeedFrac: 0.40,
    spawnIntervalSec: 0.52,
    bombChance: 0.50,
    powerUpChance: 0.11,
    // Last stage. Clearing it (crossing this cumulative score) FINISHES the
    // campaign -- see systems/difficulty.js's isFinalStageCleared and
    // core/main.js's completeCampaign (2026-09-03). Was Infinity (endless).
    advanceScore: 20000,
    advanceTimeSec: Infinity,
  },
];
