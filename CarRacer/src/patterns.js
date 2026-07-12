// Hand-authored spawn templates, grouped by difficulty tier. Each entry is a
// list of {type, lane, zOffset} relative to a spawn baseline. Templates are
// authored so at least one lane is always clear at any z-slice within the
// template -- fairness is guaranteed by construction, not solved at runtime.
//
// Weave-step spacing (the zOffset gap between consecutive lane-change
// obstacles) is sized for reaction time, not just raw distance: at current
// speeds the closing rate on traffic averages ~25 units/s, and the runner
// controller's own lane-settle easing takes ~0.3s on top of however long a
// touch/tap input takes to register (slower than a keyboard tap). A ~18-unit
// gap gives roughly 0.7s between required lane changes -- comfortably above
// both. These were tuned for a lower top speed originally and never
// revisited after the speed pass; that's why they were too tight.

const EASY = [
  [{ type: 'traffic', lane: 0, zOffset: 0 }],
  [{ type: 'traffic', lane: 2, zOffset: 0 }],
  [{ type: 'traffic', lane: 1, zOffset: 0 }],
  [
    { type: 'coin', lane: 1, zOffset: 0 },
    { type: 'coin', lane: 1, zOffset: -4 },
    { type: 'coin', lane: 1, zOffset: -8 },
  ],
  [
    { type: 'coin', lane: 0, zOffset: 0 },
    { type: 'coin', lane: 0, zOffset: -4 },
  ],
];

const MEDIUM = [
  [
    { type: 'traffic', lane: 0, zOffset: 0 },
    { type: 'traffic', lane: 2, zOffset: 0 },
    { type: 'coin', lane: 1, zOffset: 0 },
  ],
  [
    { type: 'traffic', lane: 1, zOffset: 0 },
    { type: 'coin', lane: 0, zOffset: -6 },
    { type: 'coin', lane: 2, zOffset: -6 },
  ],
  [
    { type: 'traffic', lane: 0, zOffset: 0 },
    { type: 'traffic', lane: 1, zOffset: -16 },
  ],
  [
    { type: 'traffic', lane: 2, zOffset: 0 },
    { type: 'traffic', lane: 1, zOffset: -16 },
  ],
];

const HARD = [
  [
    { type: 'traffic', lane: 0, zOffset: 0 },
    { type: 'traffic', lane: 1, zOffset: -18 },
    { type: 'traffic', lane: 2, zOffset: -36 },
  ],
  [
    { type: 'traffic', lane: 2, zOffset: 0 },
    { type: 'traffic', lane: 1, zOffset: -18 },
    { type: 'traffic', lane: 0, zOffset: -36 },
  ],
  [
    { type: 'traffic', lane: 0, zOffset: 0 },
    { type: 'traffic', lane: 2, zOffset: 0 },
    { type: 'coin', lane: 1, zOffset: -3 },
    { type: 'traffic', lane: 1, zOffset: -18 },
  ],
];

export function pickTemplate(elapsed) {
  let pool = EASY;
  if (elapsed > 80) pool = EASY.concat(MEDIUM, HARD);
  else if (elapsed > 45) pool = EASY.concat(MEDIUM, HARD.slice(0, 1));
  else if (elapsed > 20) pool = EASY.concat(MEDIUM);
  return pool[Math.floor(Math.random() * pool.length)];
}
