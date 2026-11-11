// ── THE BLOCKS EITHER SIDE OF THE LOT ─────────────────────────────────────
//
// "high new york buildings far in the distance AND IN THE SIDES AROUND ME."
//
// `range.js` answers the first half: a city profile of flat-topped towers a
// kilometre out, which is a SILHOUETTE and never passes the player. It can
// only ever read as backdrop, because it does not move relative to anything.
//
// This is the second half, and it is a different job. These stand just beyond
// the cut bank, close enough that they slide past at speed -- which is the
// only thing that makes a route feel like it is going somewhere. A skyline
// that never moves is a painted wall; blocks that sweep past the shoulder are
// a city you are travelling through.
//
// ── WHY IT IS NOT PART OF range.js ────────────────────────────────────────
//
// The range is three static rings of 27,648 triangles, uploaded once and
// rotated with the player. Nothing in it is placed in `p`, and nothing in it
// can be: it has no concept of the course at all. Anything that has to arrive,
// pass and recycle belongs in a BAND, which is how the scatter, the drones,
// the medkits, the boons and the barriers all work -- and so does this.
//
// ── AND NOT PART OF scatter.js ────────────────────────────────────────────
//
// The scatter is props ON the rideable surface, and its whole placement model
// is about staying off the racing line. These are the opposite: they must be
// nowhere near it, they stand on ground the rider can never reach, and they
// are the one thing here big enough that getting their footing wrong is
// visible from a hundred metres.
import * as THREE from 'three';
import { makeLitMaterial } from './lit.js';
import { VIEW, meshHeight, channelHalf } from './mountain.js';
import { mulberry32, range } from './rng.js';

const BAND = 62;
/**
 * Per band per side. Raised with the push outwards: a tower 200 m away covers
 * a fraction of the view that one on the rim did, so the same count reads as a
 * scatter of lonely slabs rather than as a city.
 */
const CHANCE = 0.94;

/**
 * How far out they stand, as metres beyond the top of the cut bank.
 *
 * NOT an absolute `u`, because the channel is a mode's to set and the bank
 * moves with it. Tying this to `channelHalf()` keeps the city at a constant
 * remove from the trench however wide the trench is.
 */
const OUT = [62, 215];

/**
 * ── THEY STAND WELL BACK FROM THE CUT NOW ─────────────────────────────────
 *
 * Was [11, 34], which put towers right on the lip of the bank. "the buildings
 * should not be close to the tunnel -- lets invest more in the far away
 * buildings."
 *
 * He is right, and the reason is the cut itself. Once the banks are up the
 * route reads as a TUNNEL, and the whole value of that is being enclosed. A
 * tower standing on the rim is in the same glance as the wall it stands on, so
 * it argues with the enclosure instead of being the city beyond it. Pushed
 * back past sixty metres they sit above and behind the bank where they belong:
 * you see the skyline over the edge of the trench, which is what you see from
 * the bottom of a real one.
 *
 * Far things have to be BIG or they read as near things that are small, so
 * every dimension grows with the distance.
 */
const H = [70, 260];
const W = [20, 52];
const D = [24, 64];

/**
 * ── THEY ARE SUNK INTO THE HILL ON PURPOSE ────────────────────────────────
 *
 * Metres of the box buried below the surface it stands on.
 *
 * The ground out here is the cut bank still climbing, so it is STEEP, and a
 * box set on a single sampled height stands on ONE CORNER with daylight under
 * the other three -- visible in the first screenshot as blocks hanging off the
 * bank.
 *
 * 3.2 m was not nearly enough. Over a footprint up to 32 m deep on a face that
 * climbs several metres per metre, the corners disagree by more than a storey,
 * so the burial has to swallow the worst of that: 14 m is about half a tower's
 * width and is still invisible, because it is underground.
 *
 * THE BURIAL IS ADDED BACK TO THE HEIGHT. Sinking a box without growing it
 * just makes every building shorter by the sink, which would have quietly
 * undone the whole point of putting towers here. `h` stays what the silhouette
 * is; the box is `h + SINK` tall and starts `SINK` below the ground.
 */
const SINK = 14.0;

/**
 * ── WINDOWS ───────────────────────────────────────────────────────────────
 *
 * "dark buildings with lights in the windows."
 *
 * One canvas, shared by every block, read as the lit material's `map`. The
 * trick that makes it work is in lit.js: the fragment is
 *
 *     col = albedo * (direct + ambient) + albedo * uEmissive
 *
 * and `albedo` has already been multiplied by the texture. So a texture whose
 * walls are near-black and whose windows are warm, driven with a high
 * `emissive`, gives GLOWING WINDOWS AND DARK WALLS from one map -- the walls
 * have nothing for the emissive term to multiply. No second material, no
 * second pass, and the result still hazes with distance because it is still
 * the lit shader.
 *
 * It is one texture for boxes of every size, so the grid stretches on the big
 * ones. At sixty to two hundred metres that is invisible, and it is the whole
 * reason this is acceptable here when it would not have been on the rim.
 */
function makeWindowTexture() {
  const px = 256;
  const c = document.createElement('canvas');
  c.width = px;
  c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0d12';
  g.fillRect(0, 0, px, px);
  const cols = 8;
  const rows = 14;
  const wW = px / cols;
  const wH = px / rows;
  const rand = mulberry32(0x9e3a71);
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      /**
       * ── EVERY PANE IS LIT ─────────────────────────────────────────────
       *
       * Asked for: "make all of the buildings with lighted window all of the
       * time." It was 38% before, which is what a real tower looks like at
       * night and is NOT what this needs -- at the distance these now stand,
       * a third-lit tower is mostly a dark slab with a sprinkle on it, and
       * reads as derelict rather than as a city working late.
       *
       * The variation moves from LIT/UNLIT to brightness and hue instead, so
       * the grid still has life in it without any pane going dark. A tower of
       * identical squares reads as a texture; a tower of warm ones at
       * different strengths reads as windows.
       */
      const warm = rand();
      const dim = 0.55 + rand() * 0.45;
      const base = warm < 0.70 ? [255, 215, 154]
        : (warm < 0.89 ? [255, 243, 207] : [191, 224, 255]);
      g.fillStyle = `rgb(${Math.round(base[0] * dim)},${Math.round(base[1] * dim)},${Math.round(base[2] * dim)})`;
      g.fillRect(k * wW + wW * 0.22, r * wH + wH * 0.24, wW * 0.56, wH * 0.48);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 5);
  t.anisotropy = 4;
  return t;
}

/**
 * Dark at night, and only just different from each other. The map carries all
 * the detail now; these only stop every tower being cut from one cloth.
 */
const TINTS = [
  [0.62, 0.62, 0.68],
  [0.52, 0.50, 0.52],
  [0.70, 0.66, 0.60],
  [0.48, 0.54, 0.64],
];

export class SideCity {
  /**
   * @param {object} terrain
   * @param {THREE.Scene} scene
   * @param {import('./mood.js').Mood} mood
   * @param {number} seed
   */
  constructor(terrain, scene, mood, seed = 1) {
    this.terrain = terrain;
    this.scene = scene;
    this.seed = (seed ^ 0x3fd21b) >>> 0;
    this.enabled = false;
    this.bands = Math.ceil(VIEW / BAND) + 2;
    /** Two sides, one block each at most. */
    this.capacity = this.bands * 2;

    this.mat = makeLitMaterial(mood, {
      color: 0xffffff, wrap: 0.30, gloss: 8, specular: 0.05, snowCap: 0,
      map: makeWindowTexture(),
      mapTint: 1,
      // High, and it is the windows that spend it -- see makeWindowTexture.
      // The walls are near-black in the map, so there is nothing there for
      // this to light up.
      emissive: 1.25,
    });
    /** Appended to main's `litMaterials`, so the shared sun and fog reach it. */
    this.materials = [this.mat];

    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = new THREE.InstancedMesh(geo, this.mat, this.capacity);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // `aTint` is a REQUIRED instanced attribute under USE_INSTANCING in
    // lit.js. Without it the shader has no vColor and the draw is a black
    // hole in the frame -- this file's neighbours have each paid for that
    // lesson once.
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3);
    geo.setAttribute('aTint', this.tint);
    this.mesh.visible = false;
    scene.add(this.mesh);

    /** @type {Array<object|null>} one block per slot. */
    this.blocks = new Array(this.capacity).fill(null);
    this.baseBand = NaN;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.setEnabled(false);
  }

  /** Pure in (band, side, seed): the same band rebuilt comes back identical. */
  _buildBand(bandIdx) {
    for (let side = 0; side < 2; side++) {
      const slot = (((bandIdx % this.bands) + this.bands) % this.bands) * 2 + side;
      this.blocks[slot] = null;
      const rand = mulberry32(
        (this.seed ^ Math.imul(bandIdx * 2 + side + 9173, 0x9e3779b1)) >>> 0);
      if (rand() >= CHANCE) { this._hide(slot); continue; }

      const sgn = side === 0 ? -1 : 1;
      const p = bandIdx * BAND + range(rand, 0, BAND);
      const z = -p;
      const u = sgn * (channelHalf() + range(rand, OUT[0], OUT[1]));
      const x = this.terrain.xAt(u, z);
      // meshHeight, not terrain.height: off the centre line the drawn surface
      // sags below the analytic one, and a building measured against the
      // analytic height hovers over every convex rise. Five modules in this
      // codebase have now been bitten by that exact difference.
      const ground = meshHeight(this.terrain, x, z);
      const h = range(rand, H[0], H[1]);
      const w = range(rand, W[0], W[1]);
      const d = range(rand, D[0], D[1]);
      // A little off square, and only a little. Real blocks line up with
      // streets; a scatter of randomly spun boxes reads as rubble.
      const yaw = range(rand, -0.22, 0.22);
      const t = TINTS[(rand() * TINTS.length) | 0];
      this.blocks[slot] = { x, z, ground, h, w, d, yaw, t };
      this._write(slot);
    }
  }

  _write(slot) {
    const b = this.blocks[slot];
    if (!b) return this._hide(slot);
    // `h` is the height ABOVE ground, so the box itself is taller by the sink
    // and its centre drops by half of it. See the note on SINK.
    const total = b.h + SINK;
    this._p.set(b.x, b.ground - SINK + total * 0.5, b.z);
    this._q.setFromAxisAngle({ x: 0, y: 1, z: 0 }, b.yaw);
    this._s.set(b.w, total, b.d);
    this._m.compose(this._p, this._q, this._s);
    this.mesh.setMatrixAt(slot, this._m);
    this.tint.setXYZ(slot, b.t[0], b.t[1], b.t[2]);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.tint.needsUpdate = true;
    return undefined;
  }

  _hide(slot) {
    this._m.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(slot, this._m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  _ring(p) {
    const want = Math.floor(p / BAND) - 1;
    if (want === this.baseBand) return;
    if (!(want - this.baseBand >= 0) || want - this.baseBand >= this.bands
      || want < this.baseBand) {
      for (let i = 0; i < this.bands; i++) this._buildBand(want + i);
    } else {
      for (let k = this.baseBand; k < want; k++) this._buildBand(k + this.bands);
    }
    this.baseBand = want;
  }

  setEnabled(v) {
    this.enabled = v;
    this.mesh.visible = v;
  }

  update(p) {
    if (!this.enabled) return;
    this._ring(p);
  }

  reset(p) {
    const first = Math.floor(p / BAND) - 1;
    for (let i = 0; i < this.bands; i++) this._buildBand(first + i);
    this.baseBand = first;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
