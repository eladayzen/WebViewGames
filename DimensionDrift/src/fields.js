// ── LASER FIELDS: THE SQUAD IS THE FENCE ──────────────────────────────────
//
// A curtain (beams.js) is a wall with a hole in it, placed on the mountain and
// indifferent to everyone. This is the other half of the same idea, and it is
// the one the gun is for.
//
// A drone squad flies as a chevron: three or four pods strung out across the
// piste and down it. Between each neighbouring pair, a panel of light. The
// pods are the POSTS and the squad is a fence, and the only way through a
// fence is a gap in it -- which means either a gap the formation already left
// you, or one you MAKE, by shooting a post out.
//
// That is the whole reason this exists. Every other hazard in this mode is
// answered by steering; this one can also be answered by the weapon, so the
// gun stops being a scoring device and becomes a tool for opening doors. It
// also gives a squad a reason to be feared now that the drones no longer
// shoot: before this they were scenery with hit points.
//
// ── IT COSTS NOTHING TO AIM AT ────────────────────────────────────────────
//
// A section drops the instant either of its posts dies, which is read live off
// the drone records rather than cached. No bookkeeping, no ownership, no
// teardown path: a dead pod is a dead link because the link is nothing but the
// two pods it is drawn between.
import * as THREE from 'three';
import { meshHeight } from './mountain.js';

/**
 * How many panels can be in the air at once.
 *
 * Squads are at most four pods, so three links each, and the combat ring keeps
 * a handful of squads near the rider. 18 covers every squad that could
 * plausibly be in front of the player with room to spare, and the cap is a
 * guard against a pathological frame rather than a budget anyone will meet.
 */
const MAX_LINKS = 18;

/**
 * The panel hangs from the pods DOWN TO THE SNOW.
 *
 * A fence that floated at pod height would be no fence at all: this board
 * steers and does nothing else -- it cannot duck, and its jump is not a
 * control the player aims with. A hazard it can only answer by going around
 * has to stand on the ground, or it is decoration.
 *
 * `LIFT` is how far above the posts the light carries, which is purely so the
 * top edge is a line rather than a row of pods with light between their feet.
 */
const LIFT = 1.1;
const FOOT = 0.2;

/**
 * Links longer than this are not drawn.
 *
 * Two pods at opposite ends of a chevron are 30 m apart with nothing between
 * them, and a 30 m sheet of light strung across that gap is not a fence, it is
 * a wall that happens to have drones at the ends -- it removes the formation's
 * own shape, which is the thing the player is supposed to be reading. Only
 * NEIGHBOURS get a panel, and only when they are actually near each other.
 */
const MAX_SPAN = 17.0;

/** What riding into one costs. Less than a curtain: these are escapable twice. */
const DAMAGE = 10;

/** Pure red with hazard stripes, exactly as beams.js -- one vocabulary. */
const COLOR = 0xff2436;

const VERT = `
attribute float aAlong;
attribute float aUp;
varying float vAlong;
varying float vUp;
varying float vDist;
void main() {
  vAlong = aAlong;
  vUp = aUp;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

// NO BACKTICKS BELOW. A backtick ends this template literal, and this project
// has lost four separate rounds to exactly that, in a GLSL comment every time.
const FRAG = `
uniform vec3 uColor;
uniform float uTime;
varying float vAlong;
varying float vUp;
varying float vDist;
void main() {
  // Brightest at the posts and thinnest in the middle of the span, which is
  // the opposite of how a solid wall would be lit and is the point: it says
  // the ENDS are the real things and the light between them is what they are
  // doing. Shoot an end and the light goes.
  float post = max(1.0 - vAlong, vAlong);
  float anchor = pow(post, 3.0);

  // Heavier at the foot. The top is where the pods are and the player can see
  // them perfectly well; the bottom is where the board is going.
  float vert = mix(0.95, 0.22, pow(vUp, 0.8));

  // The same diagonal hazard banding the curtains carry, so a player who has
  // learned one has learned the other.
  float stripe = sin((vAlong * 9.0 + vUp * 3.0) * 1.6 - uTime * 1.6);
  float hazard = 0.68 + 0.32 * smoothstep(-0.3, 0.3, stripe);

  float near = 1.0 - smoothstep(110.0, 340.0, vDist);
  float a = near * hazard * (vert * 0.46 + anchor * 0.5);
  gl_FragColor = vec4(uColor * (0.85 + 0.55 * anchor), a);
}
`;

/**
 * Do the segments a-b and c-d cross, in the ground plane?
 *
 * SWEPT, because the rider covers metres between frames at this mode's speeds
 * and a point test would walk straight through a sheet of light it never saw.
 * That finding has already been paid for twice in this codebase -- by the
 * motes and then by the curtains -- and it is not being paid for a third time.
 */
function segCross(ax, az, bx, bz, cx, cz, dx, dz) {
  const r1 = bx - ax;
  const r2 = bz - az;
  const s1 = dx - cx;
  const s2 = dz - cz;
  const den = r1 * s2 - r2 * s1;
  if (Math.abs(den) < 1e-9) return false;          // parallel
  const qx = cx - ax;
  const qz = cz - az;
  const t = (qx * s2 - qz * s1) / den;
  const u = (qx * r2 - qz * r1) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export class Fields {
  /**
   * @param {object} terrain
   * @param {THREE.Scene} scene
   */
  constructor(terrain, scene) {
    this.terrain = terrain;
    this.scene = scene;
    this.enabled = false;

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(MAX_LINKS * 4 * 3), 3));
    this.geo.setAttribute('aAlong',
      new THREE.BufferAttribute(new Float32Array(MAX_LINKS * 4), 1));
    this.geo.setAttribute('aUp',
      new THREE.BufferAttribute(new Float32Array(MAX_LINKS * 4), 1));
    {
      const idx = [];
      const al = this.geo.attributes.aAlong.array;
      const up = this.geo.attributes.aUp.array;
      for (let i = 0; i < MAX_LINKS; i++) {
        const a = i * 4;
        idx.push(a, a + 1, a + 2, a, a + 2, a + 3);
        // Corner order per quad: foot-near, top-near, top-far, foot-far. The
        // attributes never change, only the positions, so they are written
        // once here rather than every frame.
        al[a] = 0; up[a] = 0;
        al[a + 1] = 0; up[a + 1] = 1;
        al[a + 2] = 1; up[a + 2] = 1;
        al[a + 3] = 1; up[a + 3] = 0;
      }
      this.geo.setIndex(idx);
    }
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(COLOR) }, uTime: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);

    /** The live links this frame, as flat coordinates for the hit test. */
    this.links = [];
    this.t = 0;
    this.stats = { clipped: 0 };
    /** Last frame's ground position per fighter, for the swept test. */
    this._prev = new Map();
    this.setEnabled(false);
  }

  /** Gather every neighbouring pair of living pods, nearest squads first. */
  _gather(combat) {
    const links = this.links;
    links.length = 0;
    const squads = combat?.squads;
    if (!squads) return;
    for (const sq of squads) {
      if (!sq) continue;                           // the ring has empty slots
      const ds = sq.drones;
      if (!ds) continue;
      for (let i = 0; i + 1 < ds.length; i++) {
        const a = ds[i];
        const b = ds[i + 1];
        // BOTH ENDS LIVE, read now. This is the mechanic: one shot and the
        // section is gone, with nothing to notify and nothing to clean up.
        if (!a || !b || a.dead || a.gone || b.dead || b.gone) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        if (dx * dx + dz * dz > MAX_SPAN * MAX_SPAN) continue;
        links.push(a, b);
        if (links.length >= MAX_LINKS * 2) return;
      }
    }
  }

  _draw() {
    const pos = this.geo.attributes.position.array;
    const n = this.links.length / 2;
    let o = 0;
    for (let i = 0; i < n; i++) {
      const a = this.links[i * 2];
      const b = this.links[i * 2 + 1];
      const ay = (a.drawnY ?? a.y) + LIFT;
      const by = (b.drawnY ?? b.y) + LIFT;
      const ag = meshHeight(this.terrain, a.x, a.z) + FOOT;
      const bg = meshHeight(this.terrain, b.x, b.z) + FOOT;
      // foot-near, top-near, top-far, foot-far
      pos[o] = a.x; pos[o + 1] = ag; pos[o + 2] = a.z;
      pos[o + 3] = a.x; pos[o + 4] = ay; pos[o + 5] = a.z;
      pos[o + 6] = b.x; pos[o + 7] = by; pos[o + 8] = b.z;
      pos[o + 9] = b.x; pos[o + 10] = bg; pos[o + 11] = b.z;
      o += 12;
    }
    // The unused tail collapses to a degenerate point rather than being
    // deleted: resizing a buffer every frame as squads recycle would be a
    // reallocation per frame for something nobody can see.
    for (let i = n; i < MAX_LINKS; i++) {
      for (let k = 0; k < 12; k++) pos[o + k] = 0;
      o += 12;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.mat.uniforms.uTime.value = this.t;
    this.mesh.visible = this.enabled && n > 0;
  }

  _hit(roster) {
    const events = [];
    const n = this.links.length / 2;
    for (const f of roster.fighters) {
      if (!f.alive) continue;
      const prev = this._prev.get(f.id);
      this._prev.set(f.id, { x: f.x, z: f.z });
      if (!prev) continue;
      const dx = f.x - prev.x;
      const dz = f.z - prev.z;
      // A jump this large is a seek or a respawn, not a ride.
      if (dx * dx + dz * dz > 40000) continue;
      for (let i = 0; i < n; i++) {
        const a = this.links[i * 2];
        const b = this.links[i * 2 + 1];
        if (!segCross(prev.x, prev.z, f.x, f.z, a.x, a.z, b.x, b.z)) continue;
        if (f.damage(DAMAGE, { hitLabel: 'LASER FIELD' })) {
          this.stats.clipped++;
          events.push({ type: 'field', slot: f.slot, x: f.x, z: f.z });
        }
        break;                                     // one bite per frame
      }
    }
    return events;
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) { this.mesh.visible = false; this.links.length = 0; }
  }

  update(dt, combat, roster, live = true) {
    if (!this.enabled) return [];
    this.t += dt;
    this._gather(combat);
    const events = live ? this._hit(roster) : [];
    this._draw();
    return events;
  }

  reset() {
    this._prev.clear();
    this.links.length = 0;
    this.t = 0;
    this.stats = { clipped: 0 };
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geo.dispose();
    this.mat.dispose();
  }
}
