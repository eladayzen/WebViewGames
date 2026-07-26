// Shared "scrolling obstacle" data (§6, §9.3) -- adding a new obstacle type
// is a data addition here, not new placement/collision logic (see
// entities/obstacles.js). `textureUrl` starts null (placeholder flat-color
// billboard); the art pass (build milestone 9) fills these in with real
// sprites without touching any other file.

export const OBSTACLE_TYPES = {
  crate: {
    key: 'crate',
    width: 1.5,
    height: 1.52, // matches art/final/crate.png's ~505x511 aspect
    // Angular half-width used for the theta-tolerance-window collision
    // check (§5.5) -- derived from world width at RING_RADIUS, plus a small
    // shared player-body allowance, tuned by hand against feel.
    toleranceRad: 0.155,
    spin: false,
    color: 0x8a6a3c,
    textureUrl: new URL('../assets/crate.png', import.meta.url).href,
  },
  drum: {
    key: 'drum',
    width: 1.9,
    height: 1.13, // matches drum.png's wide ~512x306 aspect
    toleranceRad: 0.165,
    spin: true,
    spinSpeed: 3.2, // radians/sec, in-plane billboard spin (§6: rotating billboard, never modeled 3D)
    color: 0x8d97a3,
    textureUrl: new URL('../assets/drum.png', import.meta.url).href,
  },
  girder: {
    key: 'girder',
    width: 2.2,
    height: 2.41, // matches girder.png's tall ~468x512 aspect
    toleranceRad: 0.235, // wider/taller -- reads as a bigger, more deliberate dodge (§6)
    spin: false,
    color: 0x5b6570,
    textureUrl: new URL('../assets/girder.png', import.meta.url).href,
  },
};
