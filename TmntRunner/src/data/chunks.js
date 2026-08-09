// Chunk templates are data-only (GDD §9.2/§4.3/§4.4): which lane(s) have
// which obstacle type, and which lane(s) have coin/pizza pickups, at which
// local z-offset within the chunk. No mesh creation happens here --
// track/chunkPool.js applies these to pre-instanced slots.
export const CHUNK_LENGTH_UNITS = 26;

export const BREATHER_TEMPLATE = {
  obstacles: [],
  pickups: [
    { lane: 1, type: 'COIN', z: 6 },
    { lane: 1, type: 'COIN', z: 9 },
    { lane: 1, type: 'COIN', z: 12 },
  ],
};

export const CHUNK_TEMPLATES = [
  BREATHER_TEMPLATE,
  {
    obstacles: [{ lane: 0, type: 'BLOCKER', z: 14 }],
    pickups: [
      { lane: 1, type: 'COIN', z: 6 },
      { lane: 1, type: 'COIN', z: 9 },
      { lane: 2, type: 'COIN', z: 6 },
    ],
  },
  {
    obstacles: [{ lane: 2, type: 'BLOCKER', z: 14 }],
    pickups: [
      { lane: 0, type: 'COIN', z: 6 },
      { lane: 1, type: 'COIN', z: 9 },
      { lane: 1, type: 'COIN', z: 12 },
    ],
  },
  {
    obstacles: [{ lane: 1, type: 'LOW', z: 12 }],
    pickups: [
      { lane: 1, type: 'COIN', z: 4 },
      { lane: 1, type: 'COIN', z: 20 },
      { lane: 2, type: 'PIZZA', z: 12 },
    ],
  },
  {
    obstacles: [{ lane: 0, type: 'LOW', z: 10 }, { lane: 2, type: 'BLOCKER', z: 18 }],
    pickups: [
      { lane: 1, type: 'COIN', z: 4 },
      { lane: 1, type: 'COIN', z: 8 },
      { lane: 1, type: 'COIN', z: 22 },
    ],
  },
  {
    obstacles: [{ lane: 1, type: 'BLOCKER', z: 8 }, { lane: 0, type: 'LOW', z: 20 }],
    pickups: [
      { lane: 2, type: 'COIN', z: 4 },
      { lane: 2, type: 'COIN', z: 12 },
      { lane: 2, type: 'PIZZA', z: 20 },
    ],
  },
  {
    obstacles: [{ lane: 2, type: 'LOW', z: 9 }, { lane: 1, type: 'BLOCKER', z: 19 }],
    pickups: [
      { lane: 0, type: 'COIN', z: 4 },
      { lane: 0, type: 'COIN', z: 12 },
      { lane: 0, type: 'COIN', z: 22 },
    ],
  },
];

export function pickTemplate() {
  return CHUNK_TEMPLATES[Math.floor(Math.random() * CHUNK_TEMPLATES.length)];
}
