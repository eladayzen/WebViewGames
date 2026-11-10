// Hazard GROUP TEMPLATES (§6.2). Groups, not individual spawns, are the
// authoring unit -- that is what lets /systems/constraints.js check the gap
// floor statically instead of hoping a random spawner never produces a wall.
//
// Each template declares:
//   id     - stable name, used in the validator's failure messages
//   tier   - 'base' | 'open'   (see STAND_STILL_SEC below)
//   size   - how many bodies; the ramp gates which sizes are eligible (§5.10)
//   bodies - [{ type, h, dxSec, drift }]
//              type   a key of HAZARDS in tuning.js
//              h      centre of its occupied band
//              dxSec  seconds of scroll this body trails the group's head by
//              drift  h units/second, signed; |drift| <= the type's own max
//
// TIERS AND THE STAND-STILL RULE (§5.3, §0.3):
//   'base'  groups are the only ones the spawn director may draw before
//           STAND_STILL_SEC of ride time, and EVERY ONE of them leaves the trim
//           band (H_TRIM +/- PLAYER_H_HALF) clear even after its worst-case
//           drift across a full reaction window. That is what makes "hold trim,
//           never lean, survive >= 45 s" true by construction rather than by
//           luck. §5.10's on-ramp wants early hazards NEAR the trim line: these
//           are near it, and never across it.
//   'open'  groups may cross the trim line and become eligible after
//           STAND_STILL_SEC. They still obey the gap floor, the reachability
//           rule and the density caps -- those are floors, not levers (§5.10).
//
// The validator asserts all of the above at boot. If you add a template, do not
// hand-check it: add it and let the validator tell you.

export const HAZARD_GROUPS = [
  // -- base tier: the trim band stays clear -------------------------------

  { id: 'jelly-high', tier: 'base', size: 1, bodies: [
    { type: 'jellyfish', h: 0.66, dxSec: 0, drift: 0 },
  ] },
  { id: 'jelly-low', tier: 'base', size: 1, bodies: [
    { type: 'jellyfish', h: 0.24, dxSec: 0, drift: 0 },
  ] },
  { id: 'jelly-drift-low', tier: 'base', size: 1, bodies: [
    { type: 'jellyfish', h: 0.22, dxSec: 0, drift: 0.06 },
  ] },
  { id: 'jelly-drift-high', tier: 'base', size: 1, bodies: [
    { type: 'jellyfish', h: 0.70, dxSec: 0, drift: -0.06 },
  ] },
  { id: 'rock-high', tier: 'base', size: 1, bodies: [
    { type: 'rock', h: 0.78, dxSec: 0, drift: 0 },
  ] },
  { id: 'rock-low', tier: 'base', size: 1, bodies: [
    { type: 'rock', h: 0.16, dxSec: 0, drift: 0 },
  ] },
  { id: 'timber-high', tier: 'base', size: 1, bodies: [
    { type: 'timber', h: 0.72, dxSec: 0, drift: 0 },
  ] },
  { id: 'timber-low', tier: 'base', size: 1, bodies: [
    { type: 'timber', h: 0.22, dxSec: 0, drift: 0 },
  ] },
  // THE TROUGH IS SAFE, NOT EMPTY. §0.3 and §5.8 both describe the bottom of
  // the face as "low-scoring and HAZARD-DENSE, but safe" -- safe meaning there
  // is no trough FAIL STATE, not that nothing is down there. Without anything
  // occupying h < 0.06, pinning the board hard right and never moving again was
  // literally immortal: tools/sim-harness.js rode the floor for 243 s without a
  // scratch. These put real bodies on the floor, so camping it is a genuine
  // score-floor trade rather than a free win, and they still leave the whole
  // rest of the face clear.
  // onRamp:false keeps it out of the first ONRAMP_SEC. §5.10 wants the on-ramp
  // to put hazards NEAR THE TRIM LINE so a walk-up player learns the mapping;
  // a jellyfish on the floor teaches nothing, it just uses up a beat.
  { id: 'jelly-floor', tier: 'base', onRamp: false, size: 1, bodies: [
    { type: 'jellyfish', h: 0.05, dxSec: 0, drift: 0 },
  ] },

  { id: 'jelly-pair-wide', tier: 'base', size: 2, bodies: [
    { type: 'jellyfish', h: 0.20, dxSec: 0, drift: 0 },
    { type: 'jellyfish', h: 0.74, dxSec: 0.35, drift: 0 },
  ] },
  { id: 'rock-low-jelly-high', tier: 'base', size: 2, bodies: [
    { type: 'rock', h: 0.14, dxSec: 0, drift: 0 },
    { type: 'jellyfish', h: 0.76, dxSec: 0.30, drift: 0 },
  ] },
  { id: 'timber-low-jelly-high', tier: 'base', size: 2, bodies: [
    { type: 'timber', h: 0.18, dxSec: 0, drift: 0 },
    { type: 'jellyfish', h: 0.72, dxSec: 0.45, drift: 0 },
  ] },
  { id: 'jelly-drift-ladder', tier: 'base', size: 2, bodies: [
    // Both drift the same way, so the clear band TRANSLATES rather than
    // narrowing -- following it is one committed lean, not a squeeze (§5.3).
    { type: 'jellyfish', h: 0.16, dxSec: 0, drift: 0.06 },
    { type: 'jellyfish', h: 0.78, dxSec: 0.40, drift: 0.06 },
  ] },

  // -- open tier: may cross the trim line ---------------------------------

  { id: 'rock-mid', tier: 'open', size: 1, bodies: [
    { type: 'rock', h: 0.45, dxSec: 0, drift: 0 },
  ] },
  { id: 'timber-mid', tier: 'open', size: 1, bodies: [
    { type: 'timber', h: 0.46, dxSec: 0, drift: 0 },
  ] },
  { id: 'rock-floor', tier: 'open', size: 1, bodies: [
    { type: 'rock', h: 0.10, dxSec: 0, drift: 0 },
  ] },
  { id: 'rock-floor-jelly-high', tier: 'open', size: 2, bodies: [
    { type: 'rock', h: 0.10, dxSec: 0, drift: 0 },
    { type: 'jellyfish', h: 0.80, dxSec: 0.35, drift: 0 },
  ] },

  { id: 'rock-mid-jelly-low', tier: 'open', size: 2, bodies: [
    { type: 'rock', h: 0.52, dxSec: 0, drift: 0 },
    { type: 'jellyfish', h: 0.14, dxSec: 0.30, drift: 0 },
  ] },
  { id: 'rock-high-timber-low', tier: 'open', size: 2, bodies: [
    { type: 'rock', h: 0.80, dxSec: 0, drift: 0 },
    { type: 'timber', h: 0.30, dxSec: 0.40, drift: 0 },
  ] },
  { id: 'rock-pair-split', tier: 'open', size: 2, bodies: [
    { type: 'rock', h: 0.20, dxSec: 0, drift: 0 },
    { type: 'rock', h: 0.72, dxSec: 0.35, drift: 0 },
  ] },
  { id: 'timber-double', tier: 'open', size: 2, bodies: [
    { type: 'timber', h: 0.30, dxSec: 0, drift: 0 },
    { type: 'timber', h: 0.62, dxSec: 0.50, drift: 0 },
  ] },

  { id: 'jelly-trio-split', tier: 'open', size: 3, bodies: [
    { type: 'jellyfish', h: 0.13, dxSec: 0, drift: 0 },
    { type: 'jellyfish', h: 0.44, dxSec: 0.30, drift: 0 },
    { type: 'jellyfish', h: 0.76, dxSec: 0.60, drift: 0 },
  ] },
  { id: 'rock-low-timber-mid-jelly-high', tier: 'open', size: 3, bodies: [
    { type: 'rock', h: 0.12, dxSec: 0, drift: 0 },
    { type: 'timber', h: 0.56, dxSec: 0.35, drift: 0 },
    { type: 'jellyfish', h: 0.86, dxSec: 0.65, drift: 0 },
  ] },
  { id: 'timber-mid-jelly-pair', tier: 'open', size: 3, bodies: [
    { type: 'timber', h: 0.44, dxSec: 0, drift: 0 },
    { type: 'jellyfish', h: 0.10, dxSec: 0.30, drift: 0 },
    { type: 'jellyfish', h: 0.90, dxSec: 0.55, drift: 0 },
  ] },
  { id: 'rock-mid-jelly-pair', tier: 'open', size: 3, bodies: [
    { type: 'rock', h: 0.50, dxSec: 0, drift: 0 },
    { type: 'jellyfish', h: 0.13, dxSec: 0.35, drift: 0 },
    { type: 'jellyfish', h: 0.88, dxSec: 0.60, drift: 0 },
  ] },

  // Four bodies at four distinct bands -- exactly the §5.3 caps, and the
  // "dense-looking but individually trackable" ceiling the report measured off
  // the reference. Two clusters, one wide aisle: trade count for size, never
  // for a narrower gap.
  { id: 'jelly-clusters', tier: 'open', size: 4, bodies: [
    { type: 'jellyfish', h: 0.10, dxSec: 0, drift: 0 },
    { type: 'jellyfish', h: 0.20, dxSec: 0.25, drift: 0 },
    { type: 'jellyfish', h: 0.70, dxSec: 0.50, drift: 0 },
    { type: 'jellyfish', h: 0.80, dxSec: 0.75, drift: 0 },
  ] },
  { id: 'rock-low-cluster-high', tier: 'open', size: 4, bodies: [
    { type: 'rock', h: 0.14, dxSec: 0, drift: 0 },
    { type: 'jellyfish', h: 0.72, dxSec: 0.30, drift: 0 },
    { type: 'jellyfish', h: 0.82, dxSec: 0.55, drift: 0 },
    { type: 'timber', h: 0.30, dxSec: 0.80, drift: 0 },
  ] },
];

// The urchin-puffer's own templates. It is spawned on its own schedule (§5.10),
// never as part of a group, and never more than one at a time (§5.3). Its
// station-keeping telegraph plus its close is a >= 2.6 s budget (§6.2).
export const PUFFER_GROUPS = [
  // BASE-TIER PUFFERS. §5.10 lets the urchin-puffer appear from t = 25 s, but
  // §5.3's stand-still rule guarantees a player who never leans survives 45 s --
  // and the first version of this file had only mid/high/low puffers that cross
  // or drift into the trim band, so a standing player was reliably killed at
  // ~28 s. (tools/sim-harness.js found it: 60/60 trials.) Rather than delay the
  // set-piece to 45 s and lose the doc's authored 25 s, the FIRST puffers a run
  // sees are these two: they station clear of the trim band and they do not
  // drift, so the telegraph and the close still read exactly the same while the
  // trim line stays survivable. The mid/high/low variants take over at 45 s.
  { id: 'puffer-low-base', tier: 'base', size: 1, bodies: [
    { type: 'puffer', h: 0.22, dxSec: 0, drift: 0 },
  ] },
  { id: 'puffer-high-base', tier: 'base', size: 1, bodies: [
    { type: 'puffer', h: 0.76, dxSec: 0, drift: 0 },
  ] },

  { id: 'puffer-mid', tier: 'open', size: 1, bodies: [
    { type: 'puffer', h: 0.50, dxSec: 0, drift: 0.10 },
  ] },
  { id: 'puffer-low', tier: 'open', size: 1, bodies: [
    { type: 'puffer', h: 0.28, dxSec: 0, drift: 0.12 },
  ] },
  { id: 'puffer-high', tier: 'open', size: 1, bodies: [
    { type: 'puffer', h: 0.70, dxSec: 0, drift: -0.12 },
  ] },
];

export const ALL_GROUPS = HAZARD_GROUPS.concat(PUFFER_GROUPS);
