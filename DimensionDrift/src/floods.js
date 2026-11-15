// ── FLOODLIGHT MASTS ──────────────────────────────────────────────────────
//
// Site lighting: a mast on each bank every so often, with a lit head on it,
// and a real pool of light on the ground underneath.
//
// ── WHY THIS NEEDED SHADER WORK AND NOT JUST A BRIGHT BOX ─────────────────
//
// Everything in this game is lit by ONE sun direction. There is no light list,
// so until now nothing in the world could light anything else -- a lamp was
// only ever a bright object, and the dirt beside it stayed exactly as dark as
// the dirt a hundred metres away. At noon nobody notices. On a night level it
// is the whole problem: the lot had no sources in it, so it was evenly dim
// everywhere and read as a dark room rather than as a place with lights in it.
//
// So `lit.js` and the snow shader both carry four point lights now, and this
// file decides which four. The masts themselves are the cheap half.
//
// FOUR IS THE BUDGET, and it is why the masts are placed in PAIRS at a fixed
// spacing rather than scattered: a pair either side of the course means the
// four nearest are always the pair you are passing and the pair ahead, which
// is every mast that can measurably reach the player anyway.
import * as THREE from 'three';
import { makeLitMaterial } from './lit.js';
import { VIEW, meshHeight, channelHalf } from './mountain.js';
import { mulberry32, range } from './rng.js';

/** Metres between pairs. Sparse on purpose -- see the note on darkness below. */
/**
 * 115 -> 74. With the camera in close and the lamp leading, the stretch a
 * player can actually read is short, and masts a hundred metres apart meant
 * long runs with nothing in them -- the alternation the small pool was chosen
 * for needs something to alternate WITH. Closer together, the course now
 * passes through a lit patch often enough to feel lit at all.
 */
const BAND = 74;
const START_JITTER = 40;

/** How far outside the channel a mast stands, so it is up the bank behind you. */
const OUT = 4.5;

/**
 * ── THE BOOM, AND WHY THE POOLS WERE NOT LANDING ON THE ROAD ──────────────
 *
 * Metres the head hangs INWARD from the top of its pole.
 *
 * Without it the light sat directly above the pole: 19.5 m out laterally, on a
 * bank that is already eight metres up by then, with another ten metres of
 * mast above that. The head was therefore about twenty-nine metres from the
 * middle of the course -- essentially all of its range -- so by the time its
 * falloff reached the floor there was nothing left, and the masts lit the bank
 * they stood on and nothing else. They read as glowing props, which is exactly
 * what Elad saw.
 *
 * A real site floodlight is on an arm leaning out over the work. The head now
 * does the same: the pole stays on the bank, the lamp hangs over the road, and
 * the pool lands where the player actually rides.
 */
const BOOM = 8.5;

const MAST_H = [9.5, 13.5];
const MAST_R = 0.34;
const HEAD_R = 1.05;

/**
 * ── THE POOL IS SMALLER THAN IT LOOKS LIKE IT SHOULD BE ───────────────────
 *
 * Range in metres. A real floodlight on a site throws much further than this,
 * and a range that covered the course would have been the mistake: the point
 * of putting lights in a dark level is the CONTRAST between lit and unlit, and
 * a lamp whose pool reaches the next lamp's pool just raises the floor
 * everywhere and gives back the evenly-dim room this file exists to fix.
 *
 * It still has to stop well short of the next pair, which is what keeps the
 * alternation between lit and dark that the whole arrangement is for. 46 m
 * against 74 m between pairs does that -- and it is bigger than the first
 * number because the lamp now has to reach DOWN as well as across: the head
 * hangs eighteen-odd metres above the road even with the boom.
 */
const RANGE = 46;
const COLOR = 0xffd9a0;
/** What the shaders multiply by. See the four-light loop in lit.js. */
const STRENGTH = 1.05;

export class Floods {
  /**
   * @param {object} terrain
   * @param {THREE.Scene} scene
   * @param {import('./mood.js').Mood} mood
   * @param {number} seed
   */
  constructor(terrain, scene, mood, seed = 1) {
    this.terrain = terrain;
    this.scene = scene;
    this.seed = (seed ^ 0x77c1a9) >>> 0;
    this.enabled = false;
    this.bands = Math.ceil(VIEW / BAND) + 2;
    /** Two masts per band, one each side. */
    this.capacity = this.bands * 2;

    this.matMast = makeLitMaterial(mood, {
      color: 0x3a3d44, wrap: 0.4, gloss: 20, specular: 0.2, snowCap: 0,
    });
    this.materials = [this.matMast];

    const poleGeo = new THREE.CylinderGeometry(MAST_R, MAST_R * 1.5, 1, 6);
    this.poles = new THREE.InstancedMesh(poleGeo, this.matMast, this.capacity);
    this.poles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.poles.frustumCulled = false;
    // `aTint` is REQUIRED under USE_INSTANCING in lit.js.
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3);
    poleGeo.setAttribute('aTint', this.tint);
    for (let i = 0; i < this.capacity; i++) this.tint.setXYZ(i, 1, 1, 1);
    scene.add(this.poles);

    /**
     * The head is UNLIT. It is a lamp: what it shows is the light it is
     * making, not light falling on it, and a lit material would have the sun
     * deciding how bright a lamp looks -- which on this level means "not at
     * all". Same argument as the drone's eye.
     */
    this.heads = new THREE.InstancedMesh(
      new THREE.SphereGeometry(HEAD_R, 10, 7),
      new THREE.MeshBasicMaterial({ color: COLOR }),
      this.capacity,
    );
    this.heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.heads.frustumCulled = false;
    scene.add(this.heads);

    /** @type {Array<object|null>} */
    this.masts = new Array(this.capacity).fill(null);
    /** The four the shaders are currently being fed. */
    this.lights = [];
    this.baseBand = NaN;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._col = new THREE.Color(COLOR).multiplyScalar(STRENGTH);
    this.setEnabled(false);
  }

  _buildBand(bandIdx) {
    const rand = mulberry32((this.seed ^ Math.imul(bandIdx + 4421, 0x9e3779b1)) >>> 0);
    const p = bandIdx * BAND + range(rand, 0, START_JITTER);
    const z = -p;
    const h = range(rand, MAST_H[0], MAST_H[1]);
    for (let side = 0; side < 2; side++) {
      const slot = (((bandIdx % this.bands) + this.bands) % this.bands) * 2 + side;
      const sgn = side === 0 ? -1 : 1;
      const u = sgn * (channelHalf() + OUT);
      const x = this.terrain.xAt(u, z);
      const foot = meshHeight(this.terrain, x, z);
      // The head leans in over the course on its boom. See BOOM.
      const headX = this.terrain.xAt(u - sgn * BOOM, z);
      this.masts[slot] = { x, headX, z, foot, h, p };
      this._write(slot);
    }
  }

  _write(slot) {
    const m = this.masts[slot];
    if (!m) {
      this._m.makeScale(0, 0, 0);
      this.poles.setMatrixAt(slot, this._m);
      this.heads.setMatrixAt(slot, this._m);
    } else {
      // The pole is sunk a metre, for the reason the side blocks are sunk far
      // further: the bank is steep and a cylinder set exactly on one sampled
      // height stands clear of the ground on its downhill side.
      this._p.set(m.x, m.foot - 1 + m.h * 0.5, m.z);
      this._q.identity();
      this._s.set(1, m.h, 1);
      this._m.compose(this._p, this._q, this._s);
      this.poles.setMatrixAt(slot, this._m);
      this._p.set(m.headX, m.foot + m.h, m.z);
      this._s.set(1, 1, 1);
      this._m.compose(this._p, this._q, this._s);
      this.heads.setMatrixAt(slot, this._m);
    }
    this.poles.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
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

  /**
   * The four masts nearest the rider, as the shaders want them.
   *
   * Sorted by distance IN p rather than in 3-D, which is cheaper and is the
   * same answer here: the masts sit at a fixed offset either side of a course
   * the rider is always on, so the one nearest down the hill is the one
   * nearest full stop.
   */
  _pick(p) {
    const out = this.lights;
    out.length = 0;
    for (const m of this.masts) {
      if (!m) continue;
      const d = Math.abs(m.p - p);
      if (d > RANGE + 30) continue;
      out.push({ x: m.headX, y: m.foot + m.h, z: m.z, range: RANGE, color: this._col, d });
    }
    out.sort((a, b) => a.d - b.d);
    out.length = Math.min(out.length, 4);
    return out;
  }

  setEnabled(v) {
    this.enabled = v;
    this.poles.visible = v;
    this.heads.visible = v;
    if (!v) this.lights.length = 0;
  }

  update(p) {
    if (!this.enabled) { this.lights.length = 0; return this.lights; }
    this._ring(p);
    return this._pick(p);
  }

  reset(p) {
    const first = Math.floor(p / BAND) - 1;
    for (let i = 0; i < this.bands; i++) this._buildBand(first + i);
    this.baseBand = first;
    this.lights.length = 0;
  }

  dispose() {
    this.scene.remove(this.poles);
    this.scene.remove(this.heads);
    this.poles.geometry.dispose();
    this.heads.geometry.dispose();
    this.heads.material.dispose();
    this.matMast.dispose();
  }
}
