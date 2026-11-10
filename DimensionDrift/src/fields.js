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
 * A bar costs up to seven (two floor segments plus up to five beams), a
 * triangle four, a liner two, a fence panel one. 176 is 25 pods at the worst
 * case of the most expensive style.
 * The combat ring keeps a handful of squads of at most four pods near the
 * rider, so no style comes close; the cap is a guard against a pathological
 * frame, not a budget anyone will meet.
 */
const MAX_QUADS = 176;

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
 * ── TRIANGLE: HOW FAR THE POLYGON REACHES ─────────────────────────────────
 *
 * A multiple of the pod's height, like the liner's, but far larger: the ask
 * was explicitly for something covering a bigger area and NOT hugging the pod
 * that casts it. At 2.6 a pod hovering 4.5 m up throws its corners 6 to 14 m
 * out, so the polygon is a piece of ground you have to plan around rather than
 * a mark you flick past.
 *
 * That distance is also what makes the shape readable. A triangle drawn tight
 * under a drone is seen edge-on and reads as a smudge; thrown wide it is seen
 * in plan from the chase camera, which is the one view that shows a polygon as
 * a polygon.
 */
const TRI_REACH = 2.6;

/**
 * ── GREEN, WHICH IS A COLOUR THIS WORLD ALREADY SPENT ─────────────────────
 *
 * Asked for directly, and taken -- but it is worth recording that lime is the
 * REWARD in this game: the motes, the full-line callout and the time gates are
 * all 0xd6ff5a / 0x97d700, and the whole reason the barriers were moved off
 * pink was that a hazard wearing the reward's colour is the game lying.
 *
 * So this is deliberately NOT that green. It is a hard blue-leaning toxic
 * green, far from lime on the hue circle and much more saturated than anything
 * the reward palette uses, and the polygon carries the same diagonal hazard
 * banding the barriers do -- a second, non-chromatic channel that still works
 * for a player who cannot separate the two hues at all.
 */
const TRI_COLOR = 0x1fe85c;

/**
 * ── BARS: HOW FAR FROM THE POD THE LINE LANDS ─────────────────────────────
 *
 * A multiple of the pod's height, and deliberately the SMALLEST of the three
 * reaches this file has used -- the liner threw 1.62 and the polygon 2.6, and
 * the ask was for the pod's mark to sit closer to it. At 1.05 a pod at 4.5 m
 * drops its line about 4.7 m out: still clearly cast rather than worn, but
 * near enough that the pod and the thing it is doing are one object in the
 * frame instead of two.
 */
const BAR_REACH = 1.05;

/**
 * ── BARS: WHY THE LINE LIES ACROSS THE LANE ───────────────────────────────
 *
 * "so it will look good and clear like the wall does" -- and that is exactly
 * the right instinct, because the barriers already taught the player this
 * shape. A line drawn ACROSS the direction of travel is the one orientation a
 * rider can read instantly at speed: it has a length they must get past and
 * two ends they can get round, and they have met it before.
 *
 * A line lying ALONG the fall line would be the opposite -- it would be the
 * length of the course and no width at all, so it would never look like
 * something to be got past, only like something being ridden beside.
 *
 * The u axis IS world x (see `xAt`: centre line plus u), so across the lane is
 * along world x. `BAR_JITTER` leans each one a little off square, because a
 * field of perfectly parallel bars reads as printed-on rather than as cast by
 * the pods standing over them.
 */
const BAR_JITTER = 0.2;                // radians, scaled by the pod's own spin
/** Half the width of a bar, drawn and collided. */
const BAR_HALF = 1.15;

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

/** Is the rider's point inside the triangle a-b-c, in the ground plane? */
function pointInTri(px, pz, ax, az, bx, bz, cx, cz) {
  const d1 = (px - bx) * (az - bz) - (ax - bx) * (pz - bz);
  const d2 = (px - cx) * (bz - cz) - (bx - cx) * (pz - cz);
  const d3 = (px - ax) * (cz - az) - (cx - ax) * (pz - az);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

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

  if (vKind > 3.5) {
    // ── THE BAR ON THE SNOW ──────────────────────────────────────────────
    //
    // vAlong runs its length, vUp across its width. Burning along the spine
    // and falling off to the edges, so it reads as a drawn LINE rather than
    // as a thin rectangle -- the same reason the barriers put their light at
    // the gap posts: an edge states where a thing stops, a line states that
    // the thing is a line.
    float across = abs(vUp * 2.0 - 1.0);
    float spine = 1.0 - smoothstep(0.0, 0.8, across);
    // Capped at both ends rather than cut, so the ends read as deliberate.
    float ends = smoothstep(0.0, 0.05, vAlong) * (1.0 - smoothstep(0.95, 1.0, vAlong));
    float stripe = sin(vAlong * 46.0 - uTime * 2.6);
    float hazard = 0.7 + 0.3 * smoothstep(-0.35, 0.35, stripe);
    float pulse = 0.9 + 0.1 * sin(uTime * 4.2);

    // ── DARK AT THE CORE, BRIGHT AT THE RIM ──────────────────────────────
    //
    // The first cut lit the spine brightest and vanished. On this slope that
    // is the third time the same mistake has been made: the ground is near
    // white under an exposure that runs past 2.5, so ANY light colour at
    // partial alpha washes into it, and a thin mark washes out fastest of all.
    //
    // The only direction that reads here is DOWN. So the body of the bar is a
    // deep green that darkens the snow, and the bright green is spent on a
    // thin rim either side -- which also gives the line two visible edges
    // instead of one soft smear, and edges are what a rider steers against.
    float rim = smoothstep(0.55, 0.95, across) * (1.0 - smoothstep(0.95, 1.0, across));
    a = near * ends * pulse * hazard * (0.42 + 0.46 * spine + 0.5 * rim);
    col = mix(uColor * 0.32, uColor * 1.35, rim);
  } else if (vKind > 2.5) {
    // ── THE FLOOR POLYGON ────────────────────────────────────────────────
    //
    // vAlong and vUp carry two of the three barycentric coordinates, so the
    // third is free and the distance to the nearest EDGE is one min(). That
    // matters because the edge is the only part a rider negotiates with: the
    // middle of the polygon is somewhere you are already committed to being.
    float b0 = vAlong;
    float b1 = vUp;
    float b2 = 1.0 - b0 - b1;
    float edge = min(b0, min(b1, b2));
    float rim = 1.0 - smoothstep(0.0, 0.085, edge);

    // The same diagonal hazard banding the barriers carry. A second channel
    // that is not colour, which is the whole insurance policy on having been
    // asked for a green that this world already spends on rewards.
    float stripe = sin((b0 * 7.0 - b1 * 5.0) * 2.4 - uTime * 1.3);
    float hazard = 0.6 + 0.4 * smoothstep(-0.3, 0.3, stripe);
    float pulse = 0.86 + 0.14 * sin(uTime * 3.4 + b2 * 6.0);

    a = near * pulse * (hazard * 0.26 + rim * 0.72);
    col = uColor * (0.7 + 1.1 * rim);
  } else if (vKind > 1.5) {
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
    /** 'bars', 'triangle', 'liner' or 'fence'. See the header. */
    this.style = 'bars';

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
    this.tris = [];
    this.bars = [];
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
    this.style = (style === 'fence' || style === 'liner' || style === 'triangle')
      ? style : 'bars';
    // The colour belongs to the style, not to the file: the triangles were
    // asked for in green and the red is the barriers' vocabulary, so a build
    // that switches style and keeps the hue would be saying two things.
    this.mat.uniforms.uColor.value.setHex(
      (this.style === 'triangle' || this.style === 'bars') ? TRI_COLOR : COLOR);
    this.liners.length = 0;
    this.links.length = 0;
    this.tris.length = 0;
    this.bars.length = 0;
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

  /**
   * One BAR per pod: a line on the snow, lying across the lane, with two to
   * five beams raking down onto it from the pod that is drawing it.
   *
   * The beams are what make it legible as something being DONE to the ground
   * rather than something painted on it -- and how many there are is also how
   * long the line is, so a pod throwing five beams is visibly committing more
   * than one throwing two. The count is the only size cue the player needs.
   */
  _gatherBars(combat) {
    const out = this.bars;
    out.length = 0;
    for (const d of this._pods(combat)) {
      const podY = d.drawnY ?? d.y;
      const h = podY - meshHeight(this.terrain, d.x, d.z);
      if (!(h > 0.5)) continue;
      const sz = d.size ?? 1.2;
      const sp = d.spin ?? 1;
      // 2..5, from the pod's own fixed size. Deterministic per drone, so a
      // squad draws the same bars every time anyone rides this stretch.
      const n = 2 + (Math.floor((sz - 1.0) * 11.3) & 3);
      // Each beam claims about 2.6 m of line, plus a margin at the ends.
      const len = 2.6 * (n - 1) + 1.8;
      const ang = d.phase ?? 0;
      const reach = h * BAR_REACH;
      const bx = d.x + Math.cos(ang) * reach;
      const bz = d.z + Math.sin(ang) * reach;
      // ACROSS THE LANE: the u axis is world x. Leaned off square by the
      // pod's own spin so a field of them is not a set of parallel rules.
      const jit = sp * BAR_JITTER;
      const dx = Math.cos(jit);
      const dz = Math.sin(jit);
      const ax = bx - dx * len * 0.5;
      const az = bz - dz * len * 0.5;
      const cx = bx + dx * len * 0.5;
      const cz = bz + dz * len * 0.5;
      out.push({ d, podY, n, len, ax, az, cx, cz, dx, dz });
      if (out.length * (2 + 5) >= MAX_QUADS) return;
    }
  }

  /**
   * One triangle per pod, thrown wide across the snow.
   *
   * ── EVERY ONE IS A DIFFERENT SHAPE, AND NONE OF THEM IS RANDOM ──────────
   *
   * The corners are built from values the drone already carries -- `phase`,
   * `spin` and `size` -- which are fixed at the moment the squad is placed and
   * are themselves a pure function of the run's seed. So the polygons vary
   * from pod to pod the way the ask wanted, and a given squad throws the same
   * three shapes every time anyone rides that stretch of mountain.
   *
   * That second property is not a nicety. Every tuning pass in this project
   * depends on being able to ride the same hill twice, and a hazard that
   * reshuffled itself per frame -- or per run -- could never be judged, only
   * endured.
   */
  _gatherTris(combat) {
    const out = this.tris;
    out.length = 0;
    for (const d of this._pods(combat)) {
      const podY = d.drawnY ?? d.y;
      const h = podY - meshHeight(this.terrain, d.x, d.z);
      if (!(h > 0.5)) continue;
      const a0 = d.phase ?? 0;
      const sp = Math.abs(d.spin ?? 1);
      const sz = d.size ?? 1.2;
      const base = h * TRI_REACH;
      // Three corners, each at its own bearing and its own reach, so the
      // polygon is scalene -- an equilateral one read as a decal rather than
      // as a piece of ground, because nothing else on this hill is regular.
      const angs = [a0, a0 + 1.45 + sp * 0.75, a0 + 3.3 + sz * 0.6];
      const rads = [
        base * (0.52 + sz * 0.46),
        base * (0.86 + sp * 0.34),
        base * (0.64 + (sz - 1.0) * 1.5 + sp * 0.2),
      ];
      const pts = [];
      for (let i = 0; i < 3; i++) {
        const x = d.x + Math.cos(angs[i]) * rads[i];
        const z = d.z + Math.sin(angs[i]) * rads[i];
        pts.push([x, meshHeight(this.terrain, x, z) + 0.16, z]);
      }
      out.push({ d, podY, pts });
      if (out.length * 4 >= MAX_QUADS) return;
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
    if (this.style === 'bars') {
      for (const B of this.bars) {
        if (q + 2 + B.n > MAX_QUADS) break;
        // THE LINE, in two segments. One quad over 13 m would bridge straight
        // across every convex rise between its ends and hover; two halves
        // sample the middle and sit down on the hill. The same finding the
        // trees, the drones, the medkits and the boons each paid for once.
        const px = -B.dz * BAR_HALF;
        const pz = B.dx * BAR_HALF;
        const mx = (B.ax + B.cx) * 0.5;
        const mz = (B.az + B.cz) * 0.5;
        const halves = [[B.ax, B.az, mx, mz, 0, 0.5], [mx, mz, B.cx, B.cz, 0.5, 1]];
        for (const [sx, sz2, ex, ez, u0, u1] of halves) {
          this._quad(q++, [
            [sx + px, meshHeight(this.terrain, sx + px, sz2 + pz) + 0.15, sz2 + pz],
            [sx - px, meshHeight(this.terrain, sx - px, sz2 - pz) + 0.15, sz2 - pz],
            [ex - px, meshHeight(this.terrain, ex - px, ez - pz) + 0.15, ez - pz],
            [ex + px, meshHeight(this.terrain, ex + px, ez + pz) + 0.15, ez + pz],
          ], [u0, u0, u1, u1], [0, 1, 1, 0], 4);
        }
        // The rakes, landing evenly along the line.
        const d = B.d;
        for (let i = 0; i < B.n && q < MAX_QUADS; i++) {
          const t = B.n === 1 ? 0.5 : i / (B.n - 1);
          const tx = B.ax + (B.cx - B.ax) * t;
          const tz = B.az + (B.cz - B.az) * t;
          const ty = meshHeight(this.terrain, tx, tz) + 0.18;
          const vx = tx - d.x;
          const vz = tz - d.z;
          const m = Math.hypot(vx, vz) || 1;
          const qx = (-vz / m) * 0.24;
          const qz = (vx / m) * 0.24;
          this._quad(q++, [
            [d.x + qx, B.podY, d.z + qz],
            [d.x - qx, B.podY, d.z - qz],
            [tx - qx, ty, tz - qz],
            [tx + qx, ty, tz + qz],
          ], [0, 0, 1, 1], [0, 1, 1, 0], 1);
        }
      }
    } else if (this.style === 'triangle') {
      for (const T of this.tris) {
        if (q + 4 > MAX_QUADS) break;
        const [A, B, C] = T.pts;
        /**
         * THE POLYGON AS A DEGENERATE QUAD. Every primitive in this buffer is
         * four vertices and six indices; a triangle duplicates its last
         * corner, so the second of the two faces collapses to nothing. That
         * costs three unused indices and buys one index buffer, one draw call
         * and one code path for all three styles.
         *
         * aAlong and aUp carry the first two barycentric coordinates -- see
         * the floor-polygon branch of the shader for what it does with them.
         */
        this._quad(q++, [A, B, C, C], [1, 0, 0, 0], [0, 1, 0, 0], 3);
        // A beam from the pod down to each corner. These are what tie the
        // patch of ground to the thing responsible for it: without them a
        // player sees a green shape on the snow and has no reason to connect
        // it to the pod they could shoot to remove it.
        const d = T.d;
        for (const P of T.pts) {
          if (q >= MAX_QUADS) break;
          const vx = P[0] - d.x;
          const vz = P[2] - d.z;
          const m = Math.hypot(vx, vz) || 1;
          const px = (-vz / m) * 0.26;
          const pz = (vx / m) * 0.26;
          this._quad(q++, [
            [d.x + px, T.podY, d.z + pz],
            [d.x - px, T.podY, d.z - pz],
            [P[0] - px, P[1] + 0.04, P[2] - pz],
            [P[0] + px, P[1] + 0.04, P[2] + pz],
          ], [0, 0, 1, 1], [0, 1, 1, 0], 1);
        }
      }
    } else if (this.style === 'liner') {
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
      if (this.style === 'bars') {
        for (const B of this.bars) {
          // Crossed it between frames, or standing on it now. The first is
          // what catches a rider at speed, the second a rider who stopped.
          if (segCross(prev.x, prev.z, f.x, f.z, B.ax, B.az, B.cx, B.cz)
            || segDist2(B.ax, B.az, B.cx, B.cz, f.x, f.z) <= BAR_HALF * BAR_HALF) {
            bit = true;
            break;
          }
        }
      } else if (this.style === 'triangle') {
        for (const T of this.tris) {
          const [A, B, C] = T.pts;
          // INSIDE IT, OR ACROSS ANY EDGE OF IT. The containment test alone
          // would miss a rider who entered and left between two frames, which
          // at this mode's speeds is a polygon narrower than about eight
          // metres -- which most of them are at the thin corner.
          if (pointInTri(f.x, f.z, A[0], A[2], B[0], B[2], C[0], C[2])
            || segCross(prev.x, prev.z, f.x, f.z, A[0], A[2], B[0], B[2])
            || segCross(prev.x, prev.z, f.x, f.z, B[0], B[2], C[0], C[2])
            || segCross(prev.x, prev.z, f.x, f.z, C[0], C[2], A[0], A[2])) {
            bit = true;
            break;
          }
        }
      } else if (this.style === 'liner') {
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
      this.tris.length = 0;
      this.bars.length = 0;
    }
  }

  update(dt, combat, roster, live = true) {
    if (!this.enabled) return [];
    this.t += dt;
    if (this.style === 'bars') this._gatherBars(combat);
    else if (this.style === 'triangle') this._gatherTris(combat);
    else if (this.style === 'liner') this._gatherLiners(combat);
    else this._gatherLinks(combat);
    const events = live ? this._hit(roster) : [];
    this._draw();
    return events;
  }

  reset() {
    this._prev.clear();
    this.liners.length = 0;
    this.links.length = 0;
    this.tris.length = 0;
    this.bars.length = 0;
    this.t = 0;
    this.stats = { clipped: 0 };
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geo.dispose();
    this.mat.dispose();
  }
}
