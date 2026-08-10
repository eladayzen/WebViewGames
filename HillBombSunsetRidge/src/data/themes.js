// THEMES -- the look of a run, as data.
//
// The second of the three axes: a LOCATION is a course (what is on the road)
// plus a theme (what it looks like), and keeping them separate is the whole
// point. A mission wants a particular density of ramps; it does not care what
// colour the sky is, and a new palette should not require a new course.
//
// WHAT A THEME MAY AND MAY NOT CHANGE. It owns the world's colours -- sky,
// ground, markings, coping, speed lines, rim light -- and nothing else. It does
// not touch prop colours, and that restraint is deliberate: on this playfield
// hue carries MEANING. Violet launches you, green is grindable, cyan and gold
// are boosts, amber is a pickup, red is the player. A theme that recoloured
// those would make every location a new visual language to learn. So the world
// changes and the vocabulary on it stays fixed.
//
// The one exception is `skyTint`, which multiplies the painted panorama rather
// than replacing it. The matte is a real painting with towers and cloud banks in
// it; tinting keeps that structure and moves the time of day, where swapping in
// a flat gradient would throw away the only piece of real art in the sky.
//
// CONTRAST IS THE CONSTRAINT, not taste. The rider is red on a dark playfield
// and has to stay findable on a dim board-mounted screen, so every ground colour
// here is dark and low-saturation, and every marking is bright. A theme that
// merely looks nice on a monitor and loses the character at speed is a bug.

/**
 * @typedef {{
 *   id: string, name: string,
 *   skyTop: number, skyBottom: number, fog: number, skyTint: number,
 *   trough: number, floorLine: number, lip: number, guide: number,
 *   speedLine: number, rim: number,
 * }} Theme
 */

/** @type {Theme[]} */
export const THEMES = [
  {
    // The original, and still the reference the others are judged against.
    id: 'duskNeon',
    name: 'DUSK NEON',
    skyTop: 0x160e47, skyBottom: 0x401a5f, fog: 0x5b3070, skyTint: 0xffffff,
    trough: 0x2f2763, floorLine: 0x4ff0ff, lip: 0xff3ea5, guide: 0x76dcff,
    speedLine: 0x9fe9ff, rim: 0xa8ecff,
  },
  {
    // Cold and clean. The lip goes ice-blue rather than magenta, which is the
    // biggest single change to how a run reads -- the coping is the loudest
    // value break in frame.
    id: 'glacier',
    name: 'GLACIER',
    skyTop: 0x0b1f3a, skyBottom: 0x1d4b6b, fog: 0x2f6a86, skyTint: 0x9fd4ff,
    trough: 0x16304d, floorLine: 0xa8f0ff, lip: 0x7fe4ff, guide: 0xd6f4ff,
    speedLine: 0xdff6ff, rim: 0xcdeaff,
  },
  {
    // Hot and dry. Warm ground with a sharp lime marking, so the markings still
    // separate from the road by VALUE and not only by hue.
    id: 'emberFlats',
    name: 'EMBER FLATS',
    skyTop: 0x2a0f1e, skyBottom: 0x7a2a1e, fog: 0x9c4526, skyTint: 0xffb27a,
    trough: 0x3a1c22, floorLine: 0xffd166, lip: 0xff7a3d, guide: 0xffe6a8,
    speedLine: 0xffd9a8, rim: 0xffc48a,
  },
  {
    // Deep green, nearly black ground, with acid markings. The darkest of the
    // set -- the one that proves the rider still reads at low light.
    id: 'midnightPines',
    name: 'MIDNIGHT PINES',
    skyTop: 0x061a17, skyBottom: 0x0f3b30, fog: 0x1c5a49, skyTint: 0x8fd8bf,
    trough: 0x11291f, floorLine: 0xc9ff5e, lip: 0x5effc0, guide: 0xdcffb0,
    speedLine: 0xd6ffc9, rim: 0xb6ffd9,
  },
  {
    // Violet and rose. Closest to the original in mood, furthest in hue, so a
    // random draw never feels like it only has two real options.
    id: 'orchid',
    name: 'ORCHID',
    skyTop: 0x230b3d, skyBottom: 0x5e1f6b, fog: 0x8a3a86, skyTint: 0xffb8f0,
    trough: 0x2b1440, floorLine: 0xffa8e8, lip: 0xc07bff, guide: 0xffd6f6,
    speedLine: 0xffd0f4, rim: 0xf0b8ff,
  },
];

export const DEFAULT_THEME = 'duskNeon';

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

/**
 * A theme that is not the one just used.
 *
 * Avoiding an immediate repeat matters more than true randomness here: the
 * whole feature is "this run looks different from the last one", and a fair
 * coin hands you the same palette twice in a row often enough to read as the
 * feature being broken.
 */
let lastPicked = null;
export function pickRandomTheme() {
  const pool = THEMES.length > 1 ? THEMES.filter((t) => t.id !== lastPicked) : THEMES;
  const t = pool[Math.floor(Math.random() * pool.length)];
  lastPicked = t.id;
  return t;
}
