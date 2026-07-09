// Hand-authored spawn templates, grouped by difficulty tier. Each entry is a
// list of {type, lane, zOffset} relative to a spawn baseline. Templates are
// authored so at least one lane is always clear at any z-slice within the
// template -- fairness is guaranteed by construction, not solved at runtime.

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
    { type: 'traffic', lane: 1, zOffset: -10 },
  ],
  [
    { type: 'traffic', lane: 2, zOffset: 0 },
    { type: 'traffic', lane: 1, zOffset: -10 },
  ],
];

const HARD = [
  [
    { type: 'traffic', lane: 0, zOffset: 0 },
    { type: 'traffic', lane: 1, zOffset: -7 },
    { type: 'traffic', lane: 2, zOffset: -14 },
  ],
  [
    { type: 'traffic', lane: 2, zOffset: 0 },
    { type: 'traffic', lane: 1, zOffset: -7 },
    { type: 'traffic', lane: 0, zOffset: -14 },
  ],
  [
    { type: 'traffic', lane: 0, zOffset: 0 },
    { type: 'traffic', lane: 2, zOffset: 0 },
    { type: 'coin', lane: 1, zOffset: -3 },
    { type: 'traffic', lane: 1, zOffset: -12 },
  ],
];

export function pickTemplate(elapsed) {
  let pool = EASY;
  if (elapsed > 80) pool = EASY.concat(MEDIUM, HARD);
  else if (elapsed > 45) pool = EASY.concat(MEDIUM, HARD.slice(0, 1));
  else if (elapsed > 20) pool = EASY.concat(MEDIUM);
  return pool[Math.floor(Math.random() * pool.length)];
}
