// Seeded RNG and value noise. Everything about the mountain — its meander, its
// relief, where the trees stand, where the kickers are cut — comes from one seed,
// so a run is reproducible and a bad piece of terrain can be re-hit on demand.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform in [lo, hi). */
export function range(rand, lo, hi) {
  return lo + rand() * (hi - lo);
}

/** Random element of `arr`. */
export function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length) % arr.length];
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function mix(a, b, t) {
  return a + (b - a) * t;
}

// ── Value noise ─────────────────────────────────────────────────────────────
// Hash-based rather than table-based: no permutation array to carry around, and
// the same integer lattice can be sampled from anywhere without shared state,
// which is what lets terrain chunks be built in any order and still match.

function hash2i(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value noise in [0,1). */
export function vnoise(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2i(ix, iy, seed);
  const b = hash2i(ix + 1, iy, seed);
  const c = hash2i(ix, iy + 1, seed);
  const d = hash2i(ix + 1, iy + 1, seed);
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
}

/** Fractal value noise in roughly [-1,1]. */
export function fbm(x, y, octaves = 3, seed = 0) {
  let amp = 1;
  let sum = 0;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i++) {
    sum += (vnoise(fx, fy, seed + i * 1013) * 2 - 1) * amp;
    norm += amp;
    amp *= 0.5;
    fx *= 2.03;
    fy *= 2.07;
  }
  return sum / norm;
}
