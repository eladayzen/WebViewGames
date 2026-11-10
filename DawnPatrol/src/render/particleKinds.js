// Particle kind ids, split out of particles.js so that /core and /systems can
// name a particle without importing the renderer.
//
// This is not fussiness: it is what keeps the simulation genuinely
// renderer-free, which is what lets tools/sim-harness.js run thousands of
// seconds of the real game loop in Node with no browser and no PixiJS -- the
// only practical way to actually TEST the §5.3 pacing contract (the
// stand-still rule especially) rather than assert it and hope.

export const KINDS = { SPRAY: 0, FOAM: 1, BUBBLE: 2 };
