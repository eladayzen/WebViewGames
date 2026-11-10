// ── LASER FIELDS: WHAT A DRONE PUTS IN YOUR WAY ───────────────────────────
//
// Two styles live here, and only one is switched on. See `setStyle`.
//
// ── 'liner' (LIVE) ────────────────────────────────────────────────────────
//
// Every pod rakes a single beam diagonally down to the snow. The beam is not
// the hazard so much as the PATCH OF GROUND IT LANDS ON: it leaves the pod
// above head height, passes through the height a rider occupies somewhere
// along its length, and ends in a burning spot on the floor. What the player
// is reading is a scattering of hot spots, each tied by a visible line to the
// pod that is making it -- so the instruction is "do not ride there", and the
// answer to "why" is drawn in the same picture.
//
// It is the quieter of the two on purpose. A squad becomes a field of
// individually small, individually dodgeable marks rather than one structure,
// so the player picks a way between them instead of solving a single gate.
//
// ── 'fence' (PARKED, kept whole) ──────────────────────────────────────────
//
// A panel of light strung between each neighbouring pair of pods: the pods are
// posts, the squad is a fence, and the way through is either the gap the
// formation left you or one you shoot open. It works, and shooting a post to
// drop a section is the best use the gun has been put to in this mode -- but
// with barriers already across the course it reads as a second wall arriving
// in the same sentence, and Elad called it confusing. That is a composition
// problem, not a fault, so it is parked rather than removed: one argument to
// `setStyle` brings it back.
//
// ── WHAT BOTH SHARE ───────────────────────────────────────────────────────
//
// Neither owns anything. Both are read live off the drone records each frame,
// so a dead pod takes its light with it with nothing to notify and nothing to
// tear down, and the gun answers both.
import * as THREE from 'three';
import { meshHeight } from './mountain.js';

/**
 * How many quads the whole system may draw.
 *
 * A liner costs two -- the beam and the scorch -- and a fence panel costs one,
 * so this is 28 pods or 56 panels. The combat ring keeps a handful of squads
 * of at most four pods near the rider, so neither style comes close; the cap
 * is a guard against a pathological frame, not a budget anyone will meet.
 */
const MAX_QUADS = 56;

/**
 * FENCE: the panel hangs from the pods DOWN TO THE SNOW.
 *
 * A fence floating at pod height would be no fence at all: this board steers
 * and does nothing else -- it cannot duck, and its jump is not a control the
 * player aims with. A hazard it can only answer by going around has to stand
 * on the ground, or it is decoration.
 */
const LIFT = 1.1;
const FOOT = 0.2;

/**
 * FENCE: links longer than this are not drawn.
 *
 * Two pods at opposite ends of a chevron are 30 m apart with nothing between
 * them, and a sheet strung across that gap is not a fence -- it erases the
 * formation's own shape, which is the thing the player is supposed to read.
 */
const MAX_SPAN = 17.0;

/**
 * ── LINER: HOW FAR THE BEAM REACHES ACROSS THE GROUND ─────────────────────
 *
 * As a multiple of the pod's height, so every beam in the field leans at the
 * same angle and the whole thing reads as one system rather than as a mess of
 * unrelated sticks.
 *
 * 1.62 is a little over 31 degrees off the snow, which is as shallow as this
 * can go before the beam stops looking like it is coming DOWN and starts
 * looking like it is lying on the hill. At the pods' 3.4-5.8 m it puts the
 * burning spot 5.5 to 9.4 m out -- far enough from the pod that shooting the
 * pod and avoiding its mark are two different problems in two different
 * places, which is the whole reason to have both.
 */
const LINER_REACH = 1.62;

/**
 * ── LINER: THE HEIGHT A RIDER ACTUALLY OCCUPIES ───────────────────────────
 *
 * The beam only threatens where it is low enough to hit someone. Above this it
 * passes over the player's head and is pure telegraph -- it says where the
 * dangerous end is going to be, from a long way off, without being dangerous
 * itself. That split is what makes a diagonal beam fair: the part you can see
 * first is the part that cannot hurt you.
 */
const RIDER_H = 2.0;

/** LINER: radius of the scorch on the snow, and of its collision. */
const SPOT_R = 1.5;

/**
 * What riding into one costs.
 *
 * Under a barrier's 12, and the reason is the number of them: a barrier is one
 * decision every 175 m and a liner field is a dozen small ones in the same
 * stretch. A hazard you meet twelve times as often cannot cost the same.
 */
const DAMAGE = 8;

/** Pure red with hazard stripes, exactly as beams.js -- one vocabulary. */
const COLOR = 0xff2436;

const VERT = `
attribute float aAlong;
attribute float aUp;
attribute float aKind;
varying float vAlong;
varying float vUp;
varying float vKind;
varying float vDist;
void main() {
  vAlong = aAlong;
  vUp = aUp;
  vKind = aKind;
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
varying float vKind;
varying float vDist;
void main() {
  float near = 1.0 - smoothstep(110.0, 340.0, vDist);
  float a;
  vec3 col = uColor;

  if (vKind > 1.5) {
    // ── THE SCORCH ON THE SNOW ───────────────────────────────────────────
    //
    // This is the part that actually matters, so it is the part that is drawn
    // loudest. A rider reads the FLOOR -- the beam above it is an explanation.
    float r = length(vec2(vAlong, vUp));
    if (r > 1.0) discard;
    float ring = smoothstep(0.55, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r));
    float core = 1.0 - smoothstep(0.0, 0.85, r);
    float pulse = 0.82 + 0.18 * sin(uTime * 5.0 + vAlong * 2.0);
    a = near * pulse * (core * 0.42 + ring * 0.9);
    col = uColor * (0.85 + 0.85 * ring);
  } else if (vKind > 0.5) {
    // ── THE BEAM ─────────────────────────────────────────────────────────
    //
    // Faint where it leaves the pod, bright where it meets the ground. The
    // top of a diagonal beam passes over the player's head and cannot hurt
    // them; drawing it at full strength all the way up would make the
    // harmless end the loudest thing in the frame.
    float low = pow(vAlong, 2.2);
    float edge = 1.0 - abs(vUp * 2.0 - 1.0);
    float shimmer = 0.8 + 0.2 * sin(uTime * 7.0 - vAlong * 14.0);
    a = near * shimmer * edge * (0.16 + 0.62 * low);
    col = uColor * (0.8 + 0.7 * low);
  } else {
    // ── THE FENCE PANEL (parked style) ───────────────────────────────────
    float post = max(1.0 - vAlong, vAlong);
    float anchor = pow(post, 3.0);
    float vert = mix(0.95, 0.22, pow(vUp, 0.8));
    float stripe = sin((vAlong * 9.0 + vUp * 3.0) * 1.6 - uTime * 1.6);
    float hazard = 0.68 + 0.32 * smoothstep(-0.3, 0.3, stripe);
    a = near * hazard * (vert * 0.46 + anchor * 0.5);
    col = uColor * (0.85 + 0.55 * anchor);
  }
  gl_FragColor = vec4(col, a);
}
`;

/** Squared distance from point p to segment a-b, in the ground plane. */
function segDist2(ax, az, bx, bz, px, pz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = dx * dx + dz * dz;
  let t = len > 1e-9 ? ((px - ax) * dx + (pz - az) * dz) / len : 0;
  t = t < 0 ? 0 : (t > 1 ? 1 : t);
  const qx = ax + dx * t - px;
  const qz = az + dz * t - pz;
  return qx * qx + qz * qz;
}

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
    /** 'liner' or 'fence'. See the header. */
    this.style = 'liner';

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(MAX_QUADS * 4 * 3), 3));
    this.geo.setAttribute('aAlong',
      new THREE.BufferAttribute(new Float32Array(MAX_QUADS * 4), 1));
    this.geo.setAttribute('aUp',
      new THREE.BufferAttribute(new Float32Array(MAX_QUADS * 4), 1));
    this.geo.setAttribute('aKind',
      new THREE.BufferAttribute(new Float32Array(MAX_QUADS * 4), 1));
    {
      const idx = [];
      for (let i = 0; i < MAX_QUADS; i++) {
        const a = i * 4;
        idx.push(a, a + 1, a + 2, a, a + 2, a + 3);
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

    /**
     * What is live this frame.
     *
     * `liners` holds the dangerous SUB-SEGMENT of each beam -- the stretch low
     * enough to hit a rider -- plus its scorch, which is all the hit test ever
     * needs. `links` holds fence pairs. Only one is ever populated.
     */
    this.liners = [];
    this.links = [];
    this.quads = 0;
    this.t = 0;
    this.stats = { clipped: 0 };
    /** Last frame's ground position per fighter, for the swept test. */
    this._prev = new Map();
    this.setEnabled(false);
  }

  /**
   * Choose what the pods project. See the header for what each one is and why
   * the fence is parked rather than deleted.
   *
   * @param {'liner'|'fence'} style
   */
  setStyle(style) {
    this.style = style === 'fence' ? 'fence' : 'liner';
    this.liners.length = 0;
    this.links.length = 0;
  }

  /** Every living pod the combat ring is holding near the rider. */
  * _pods(combat) {
    const squads = combat?.squads;
    if (!squads) return;
    for (const sq of squads) {
      if (!sq || !sq.drones) continue;            // the ring has empty slots
      for (const d of sq.drones) {
        if (!d || d.dead || d.gone) continue;
        yield d;
      }
    }
  }

  /**
   * One beam per pod, raked down to the snow.
   *
   * THE DIRECTION IS THE POD'S OWN `phase`, which is already a fixed random
   * per drone. So a beam never moves of its own accord -- the same reason the
   * curtains' sweeping gap was cut: a hazard that moves while the player is
   * travelling to it asks for an intercept this controller cannot solve. What
   * movement there is comes from the pod drifting, which the player can see.
   */
  _gatherLiners(combat) {
    const out = this.liners;
    out.length = 0;
    for (const d of this._pods(combat)) {
      const podY = d.drawnY ?? d.y;
      const gy0 = meshHeight(this.terrain, d.x, d.z);
      const h = podY - gy0;
      if (!(h > 0.5)) continue;
      const ang = d.phase ?? 0;
      const reach = h * LINER_REACH;
      const gx = d.x + Math.cos(ang) * reach;
      const gz = d.z + Math.sin(ang) * reach;
      const gy = meshHeight(this.terrain, gx, gz);
      // Where the beam drops below head height. Above this it passes over the
      // rider and is telegraph only -- see RIDER_H.
      let t0 = 1 - RIDER_H / h;
      if (t0 < 0) t0 = 0;
      out.push({
        d, podY, gx, gy, gz, ang, reach,
        // the dangerous stretch, in the ground plane
        lx: d.x + (gx - d.x) * t0,
        lz: d.z + (gz - d.z) * t0,
      });
      if (out.length * 2 >= MAX_QUADS) return;
    }
  }

  /** Fence style: every neighbouring pair of living pods. See the header. */
  _gatherLinks(combat) {
    const links = this.links;
    links.length = 0;
    const squads = combat?.squads;
    if (!squads) return;
    for (const sq of squads) {
      if (!sq || !sq.drones) continue;
      const ds = sq.drones;
      for (let i = 0; i + 1 < ds.length; i++) {
        const a = ds[i];
        const b = ds[i + 1];
        if (!a || !b || a.dead || a.gone || b.dead || b.gone) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        if (dx * dx + dz * dz > MAX_SPAN * MAX_SPAN) continue;
        links.push(a, b);
        if (links.length / 2 >= MAX_QUADS) return;
      }
    }
  }

  _quad(o, pts, along, up, kind) {
    const pos = this.geo.attributes.position.array;
    const al = this.geo.attributes.aAlong.array;
    const uu = this.geo.attributes.aUp.array;
    const kk = this.geo.attributes.aKind.array;
    for (let i = 0; i < 4; i++) {
      pos[o * 12 + i * 3] = pts[i][0];
      pos[o * 12 + i * 3 + 1] = pts[i][1];
      pos[o * 12 + i * 3 + 2] = pts[i][2];
      al[o * 4 + i] = along[i];
      uu[o * 4 + i] = up[i];
      kk[o * 4 + i] = kind;
    }
  }

  _draw() {
    let q = 0;
    if (this.style === 'liner') {
      for (const L of this.liners) {
        if (q + 2 > MAX_QUADS) break;
        const d = L.d;
        const px = -Math.sin(L.ang) * 0.30;
        const pz = Math.cos(L.ang) * 0.30;
        // The beam: a narrow ribbon standing along the rake of the shot.
        this._quad(q++, [
          [d.x + px, L.podY, d.z + pz],
          [d.x - px, L.podY, d.z - pz],
          [L.gx - px, L.gy + 0.12, L.gz - pz],
          [L.gx + px, L.gy + 0.12, L.gz + pz],
        ], [0, 0, 1, 1], [0, 1, 1, 0], 1);
        // The scorch: flat on the snow, sampled per corner so it lies on the
        // hill instead of hovering over every convex rise.
        const r = SPOT_R;
        const c = [[-r, -r], [-r, r], [r, r], [r, -r]];
        this._quad(q++, c.map(([ox, oz]) => [
          L.gx + ox, meshHeight(this.terrain, L.gx + ox, L.gz + oz) + 0.14, L.gz + oz,
        ]), [-1, -1, 1, 1], [-1, 1, 1, -1], 2);
      }
    } else {
      const n = this.links.length / 2;
      for (let i = 0; i < n && q < MAX_QUADS; i++) {
        const a = this.links[i * 2];
        const b = this.links[i * 2 + 1];
        this._quad(q++, [
          [a.x, meshHeight(this.terrain, a.x, a.z) + FOOT, a.z],
          [a.x, (a.drawnY ?? a.y) + LIFT, a.z],
          [b.x, (b.drawnY ?? b.y) + LIFT, b.z],
          [b.x, meshHeight(this.terrain, b.x, b.z) + FOOT, b.z],
        ], [0, 0, 1, 1], [0, 1, 1, 0], 0);
      }
    }
    // The unused tail collapses to a degenerate point rather than being
    // deleted: resizing a buffer every frame as squads recycle would be a
    // reallocation per frame for something nobody can see.
    const pos = this.geo.attributes.position.array;
    for (let i = q; i < MAX_QUADS; i++) {
      for (let k = 0; k < 12; k++) pos[i * 12 + k] = 0;
    }
    this.quads = q;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlong.needsUpdate = true;
    this.geo.attributes.aUp.needsUpdate = true;
    this.geo.attributes.aKind.needsUpdate = true;
    this.mat.uniforms.uTime.value = this.t;
    this.mesh.visible = this.enabled && q > 0;
  }

  _hit(roster) {
    const events = [];
    for (const f of roster.fighters) {
      if (!f.alive) continue;
      const prev = this._prev.get(f.id);
      this._prev.set(f.id, { x: f.x, z: f.z });
      if (!prev) continue;
      const dx = f.x - prev.x;
      const dz = f.z - prev.z;
      // A jump this large is a seek or a respawn, not a ride.
      if (dx * dx + dz * dz > 40000) continue;
      let bit = false;
      if (this.style === 'liner') {
        for (const L of this.liners) {
          // The beam where it is low enough to matter, OR the scorch it
          // lands in -- the two things the player can actually see.
          const crossed = segCross(prev.x, prev.z, f.x, f.z, L.lx, L.lz, L.gx, L.gz);
          const inSpot = segDist2(prev.x, prev.z, f.x, f.z, L.gx, L.gz) <= SPOT_R * SPOT_R;
          if (!crossed && !inSpot) continue;
          bit = true;
          break;
        }
      } else {
        const n = this.links.length / 2;
        for (let i = 0; i < n; i++) {
          const a = this.links[i * 2];
          const b = this.links[i * 2 + 1];
          if (!segCross(prev.x, prev.z, f.x, f.z, a.x, a.z, b.x, b.z)) continue;
          bit = true;
          break;
        }
      }
      if (bit && f.damage(DAMAGE, { hitLabel: 'LASER' })) {
        this.stats.clipped++;
        events.push({ type: 'field', slot: f.slot, x: f.x, z: f.z });
      }
    }
    return events;
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) {
      this.mesh.visible = false;
      this.liners.length = 0;
      this.links.length = 0;
    }
  }

  update(dt, combat, roster, live = true) {
    if (!this.enabled) return [];
    this.t += dt;
    if (this.style === 'liner') this._gatherLiners(combat);
    else this._gatherLinks(combat);
    const events = live ? this._hit(roster) : [];
    this._draw();
    return events;
  }

  reset() {
    this._prev.clear();
    this.liners.length = 0;
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
