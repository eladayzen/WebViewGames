// THE STREET.
//
// What this replaces is a Graphics grid: lines every 240px plus a red
// rectangle for the world edge. That grid was never art, it was a coordinate
// readout -- it existed so that movement could be seen at all before there
// was anything to see. It also made the game unreadable in the one way that
// mattered: the Foot are drawn in near-black, and on a near-black field they
// were only visible by their red sashes.
//
// So the floor is now real illustrated art, per the house rule that
// environment surfaces are drawn, never generated procedurally in canvas --
// the Astro_Tunnel and TmntSewerSlide floors are the anti-pattern. One
// hand-inked asphalt tile, made to wrap by offsetting it half a tile and
// healing the seam (tools note: scripts/seamless.py), tiled across the whole
// 7680x4320 world by a single TilingSprite rather than by thousands of
// quads.
//
// On top of it go scattered decals -- manholes, lane paint, puddles, litter.
// They are not decoration. A uniform texture gives the eye nothing to track,
// so a player crossing it cannot tell how fast they are moving or whether
// they have been here before; the decals are the landmarks that make the
// world navigable. They are placed from a SEEDED generator so the same world
// comes back every run, which is what makes a bug in it reproducible.

import { Assets, Sprite, TilingSprite, Container, Graphics } from 'pixi.js';
import { WORLD } from '../core/world.js';

const SRC = {
  road:    new URL('../../assets/road_tile.webp',    import.meta.url).href,
  manhole: new URL('../../assets/decal_manhole.webp', import.meta.url).href,
  paint:   new URL('../../assets/decal_paint.webp',   import.meta.url).href,
  puddle:  new URL('../../assets/decal_puddle.webp',  import.meta.url).href,
  litter:  new URL('../../assets/decal_litter.webp',  import.meta.url).href,
};

/** World px covered by one tile. Smaller repeats more; larger blurs. */
const TILE_PX = 560;

/**
 * One decal per cell of this size, jittered inside it.
 *
 * Poisson-ish by construction and far cheaper: a cell grid cannot clump, and
 * clumping is the only thing that would read as a mistake. 7680x4320 at 640
 * gives ~81 decals, which is enough to always have one in view and few enough
 * that they stay incidental.
 */
const CELL_PX = 640;

/** Relative frequency. Litter is common, a manhole is an event. */
export const DECAL_KINDS = ['litter', 'paint', 'puddle', 'manhole'];

const MIX = [
  ['litter', 4],
  ['paint', 3],
  ['puddle', 2],
  ['manhole', 1],
];

const tex = {};

export async function loadGround() {
  const keys = Object.keys(SRC);
  const loaded = await Promise.all(keys.map((k) => Assets.load(SRC[k])));
  keys.forEach((k, i) => { tex[k] = loaded[i]; });
}

/**
 * A small deterministic generator (mulberry32).
 *
 * Math.random would re-scatter the street on every run, so a decal sitting
 * exactly where a player keeps dying could never be looked at twice. Seeded
 * means the world is a fixed place.
 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand) {
  const total = MIX.reduce((s, [, wgt]) => s + wgt, 0);
  let r = rand() * total;
  for (const [key, wgt] of MIX) {
    r -= wgt;
    if (r <= 0) return key;
  }
  return MIX[0][0];
}

/**
 * Where every decal goes, as plain data.
 *
 * SEPARATE FROM THE SPRITES ON PURPOSE. The claim this module makes is that
 * the street is the same street every run; a claim like that is worth a test,
 * and a test cannot be written against a tree of display objects. So the
 * placement is a pure function of the seed and the sprites are built from
 * what it returns.
 *
 * @param {number} seed same seed, same street.
 * @returns {Array<{key:string,x:number,y:number,rotation:number,scale:number,alpha:number}>}
 */
export function decalPlan(seed = 20261101) {
  const rand = rng(seed);
  const plan = [];
  for (let cy = 0; cy < Math.ceil(WORLD.height / CELL_PX); cy++) {
    for (let cx = 0; cx < Math.ceil(WORLD.width / CELL_PX); cx++) {
      const d = {
        key: pick(rand),
        // Jittered inside its own cell, which is what keeps them apart: a
        // cell grid cannot clump, and clumping is the only arrangement that
        // would read as a mistake.
        x: (cx + 0.12 + rand() * 0.76) * CELL_PX,
        y: (cy + 0.12 + rand() * 0.76) * CELL_PX,
        // Decals are the one thing here that IS seen from directly above, so
        // unlike the characters they may be rotated freely -- and must be, or
        // the lane paint all points the same way and the grid becomes visible.
        rotation: rand() * Math.PI * 2,
        scale: 0.75 + rand() * 0.6,
        // Held well back. A decal that competes with an enemy for attention
        // is worse than no decal: the horde has to stay the most legible
        // thing on the screen at all times.
        alpha: 0.3 + rand() * 0.22,
      };
      // THE GRID OVERRUNS THE WORLD. 4320 / 640 is 6.75, so the last row of
      // cells sits partly past the bottom edge, and a decal landing there is
      // drawn outside the kerb -- on ground the player can see but can never
      // reach. Drop those. Every random is still drawn first, so skipping
      // one does not shift the street.
      if (d.x <= WORLD.width && d.y <= WORLD.height) plan.push(d);
    }
  }
  return plan;
}

/**
 * Build the floor. Returns a container to drop in at the bottom of the world.
 *
 * @param {number} seed same seed, same street.
 */
export function createGround(seed = 20261101) {
  const root = new Container();

  const road = new TilingSprite({
    texture: tex.road,
    width: WORLD.width,
    height: WORLD.height,
  });
  road.tileScale.set(TILE_PX / tex.road.width);
  root.addChild(road);

  const decals = new Container();
  for (const d of decalPlan(seed)) {
    const s = new Sprite(tex[d.key]);
    s.anchor.set(0.5);
    s.x = d.x;
    s.y = d.y;
    s.rotation = d.rotation;
    s.scale.set(d.scale);
    s.alpha = d.alpha;
    decals.addChild(s);
  }
  root.addChild(decals);

  // THE EDGE OF THE WORLD, which the player can walk into and must be able to
  // see coming. A kerb line rather than the old red rectangle: bright enough
  // to read at a glance, dark enough not to pull the eye while the horde is
  // on screen.
  const edge = new Graphics()
    .rect(0, 0, WORLD.width, WORLD.height)
    .stroke({ width: 14, color: 0x2b3444, alignment: 1 })
    .rect(7, 7, WORLD.width - 14, WORLD.height - 14)
    .stroke({ width: 5, color: 0xf2c14e, alpha: 0.5, alignment: 1 });
  root.addChild(edge);

  return root;
}
