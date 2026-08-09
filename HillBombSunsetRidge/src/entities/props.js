// Prop field: spawning, placement and interaction.
//
// Props live in road space as (s, u) pairs -- distance down the road and lateral
// offset -- exactly like the rider, so collision is a cheap 2D overlap and never
// needs a physics engine (build doc §9.1).
//
// Content is emitted in authored PATTERNS from data/propTypes.js, one group at a
// time as the rider advances, and recycled once well behind. Nothing is
// allocated per frame: meshes come from a pool keyed by prop type.

import * as THREE from 'three';
import { PROP_TYPES, PATTERNS } from '../data/propTypes.js';
import { toWorld, surfaceUp, frameAt, makeFrame } from '../world/trough.js';
import { THETA_MAX, TROUGH_RADIUS, RAMP_ARROW_COLOR } from '../data/constants.js';

const SPAWN_AHEAD = 340; // keep the field populated this far down the road
const RECYCLE_BEHIND = 40;

// Deterministic per-index shuffle so the descent varies but a given run is
// reproducible. Math.random would also work, but this keeps the layout stable
// if the same stretch is ever regenerated.
function hash(n) {
  let x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

// --- geometry builders, one per visual family -------------------------------

/**
 * Centre an extruded profile on X and Z while leaving Y alone (so it still sits
 * on the ground at y=0). Measured rather than hand-derived: rotateY(PI/2) maps
 * x -> -z and z -> x, and reasoning that through by hand is exactly how the
 * ramps ended up shoved off their own origin the first time.
 */
function centreOnXZ(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
}

// --- RAMP CHEVRONS ----------------------------------------------------------
// White arrow markings up the face of every launcher, like the painted
// direction arrows in a real skatepark or on a road. They do two jobs at once:
// they make a ramp instantly legible as "ride UP this, that way" rather than as
// a coloured wedge, and they give the surface some graphic interest without a
// texture.
//
// Built as separate geometry laid ON the face, the same approach the trough's
// guide stripes use, rather than painted into a texture map. ExtrudeGeometry's
// UVs on a swept profile are not something to rely on for placing artwork, and
// separate geometry stays crisp at any ramp size.
//
// The face is described by its start and end in the prop's local (z, y) plane,
// so the same builder serves the straight wedge of a kicker and the straight
// lower face of a bank -- which rise to different places -- without either
// caller knowing how the marking is constructed.
function buildChevrons(w, z0, y0, z1, y1, count, colour) {
  const g = new THREE.Group();
  const dz = z1 - z0, dy = y1 - y0;
  const len = Math.hypot(dz, dy);
  if (len < 0.01) return g;

  // Orthonormal frame ON the ramp face: +Y runs up the slope, +Z is the face
  // normal, +X stays the width axis.
  const up = new THREE.Vector3(0, dy / len, dz / len);
  const nrm = new THREE.Vector3(0, -dz / len, dy / len);
  const right = new THREE.Vector3(1, 0, 0);
  const basis = new THREE.Matrix4().makeBasis(right, up, nrm);
  const quat = new THREE.Quaternion().setFromRotationMatrix(basis);

  const mat = new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide });
  // ELONGATED UP THE SLOPE on purpose. Seen from directly above these are
  // well-proportioned arrows, but the game camera looks at a ramp face almost
  // edge-on and foreshortens them into flat stripes. Real road chevrons are
  // stretched lengthwise for exactly this reason -- drawn "correct" they read
  // squashed from a driver's eye height.
  const halfW = w * 0.26;
  const rise = len * 0.22;
  const thick = rise * 0.38;

  for (let i = 0; i < count; i++) {
    // Evenly spaced up the face, inset from both ends so no chevron hangs off
    // the lip or buries itself in the ground at the base.
    const t = (i + 0.9) / (count + 0.9);
    const shape = new THREE.Shape();
    shape.moveTo(-halfW, 0);
    shape.lineTo(0, rise);
    shape.lineTo(halfW, 0);
    shape.lineTo(halfW - thick * 0.9, 0);
    shape.lineTo(0, rise - thick);
    shape.lineTo(-halfW + thick * 0.9, 0);
    shape.lineTo(-halfW, 0);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
    m.quaternion.copy(quat);
    m.position.set(0, y0 + dy * t, z0 + dz * t)
      // Lift clear of the face so it never z-fights the ramp it sits on.
      .addScaledVector(nrm, 0.02);
    g.add(m);
  }
  return g;
}

function buildKicker(def) {
  const { w, h, l } = def.size;
  const g = new THREE.Group();
  // A wedge: triangular side profile rising toward the far (down-road) end.
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(l, 0);
  shape.lineTo(l, h);
  shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  geo.rotateY(Math.PI / 2);
  centreOnXZ(geo);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: def.colour, side: THREE.DoubleSide,
  }));
  g.add(mesh);
  // Lip so the top edge reads against the road.
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.12, 0.5),
    new THREE.MeshBasicMaterial({ color: def.accent }),
  );
  lip.position.set(0, h, -l / 2 + 0.25);
  g.add(lip);
  // Face runs from the base (z = +l/2, y = 0) up to the lip (z = -l/2, y = h).
  g.add(buildChevrons(w, l / 2, 0, -l / 2, h, 3, RAMP_ARROW_COLOR));
  return g;
}

// --- RAMP RIDING SURFACE ----------------------------------------------------
// The height of a launch prop's deck at fraction f along it (0 = the near base,
// 1 = the far end), and where along it the takeoff actually is.
//
// This exists because the launch moved from the ramp's leading edge to its
// takeoff point. Popping at the base meant the rider never touched the wedge --
// they were already airborne over it -- so nothing had to know its shape. Now
// they travel its whole length on the ground first, and without a surface to
// climb they simply pass THROUGH the geometry (verified: at 35% along a big
// kicker only the head and shoulders cleared the deck).
//
// The two shapes are genuinely different and it matters:
//   'wedge' (kicker, bigKicker) -- buildKicker's triangle, rising all the way
//       to the far end. Takeoff IS the far end.
//   'hump'  (bank) -- buildBank's profile runs (0,0) -> straight up to an apex
//       at the MIDDLE -> quadratic back down to zero at the far end. Its
//       takeoff is the apex at f=0.5; firing at the far end would launch the
//       rider from ground level off the back of the hump.
function rampHeight(profile, h, f) {
  const t = Math.max(0, Math.min(1, f));
  if (profile === 'hump') {
    if (t <= 0.5) return h * (t / 0.5); // straight face up to the apex
    const b = (t - 0.5) / 0.5;
    return h * (1 - b * b); // curved back side
  }
  // A vert wall: shallow where you meet it, near-vertical at the lip. Squaring
  // t is what makes it read as a transition rather than a taller wedge -- the
  // rider is barely lifted for the first half and then thrown.
  if (profile === 'curve') return h * t * t;
  return h * t;
}

/** Fraction along a launch prop where the rider leaves it. */
function apexFrac(profile) {
  return profile === 'hump' ? 0.5 : 1;
}

// The vert wall. Its rideable face is the concave curve from the base up to the
// lip; the back is a flat drop the rider never touches. Built as one extruded
// side profile like the other launchers so it sits in the same basis and the
// chevrons can use the same helper.
function buildBarrel(def) {
  const { w, h, l } = def.size;
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  // Control point pulled low and late, so the curve sags BELOW the straight
  // line from base to lip -- concave, the way a transition actually is. A
  // control point above that line would bulge it into a dome and launch the
  // rider early.
  shape.quadraticCurveTo(l * 0.74, h * 0.07, l, h);
  shape.lineTo(l, 0);
  shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  geo.rotateY(Math.PI / 2);
  centreOnXZ(geo);
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: def.colour, side: THREE.DoubleSide,
  })));

  // A bright coping along the lip. This is the one launcher whose top edge the
  // player has to judge from a distance -- it decides whether they get a flip --
  // so it gets a marker the wedges do not.
  const coping = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, w, 8),
    new THREE.MeshBasicMaterial({ color: def.accent }),
  );
  coping.rotation.z = Math.PI / 2;
  coping.position.set(0, h, -l / 2);
  g.add(coping);

  // Chevrons up the face, following the same base->lip line the rider rides.
  g.add(buildChevrons(w * 0.8, l / 2, 0, -l / 2, h, 4, RAMP_ARROW_COLOR));
  return g;
}

function buildRail(def) {
  const { w, h, l } = def.size;
  const g = new THREE.Group();
  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(w, w, l, 8),
    new THREE.MeshBasicMaterial({ color: def.colour }),
  );
  bar.rotation.x = Math.PI / 2;
  bar.position.y = h;
  g.add(bar);
  const postMat = new THREE.MeshBasicMaterial({ color: def.accent });
  for (const t of [-0.42, 0, 0.42]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(w * 1.4, h, w * 1.4), postMat);
    post.position.set(0, h / 2, t * l);
    g.add(post);
  }
  return g;
}

function buildLedge(def) {
  const { w, h, l } = def.size;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(
    new THREE.BoxGeometry(w, h, l),
    new THREE.MeshBasicMaterial({ color: def.colour }),
  ).translateY(h / 2));
  // Coping strip along the grindable top edge.
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.06, 0.1, l),
    new THREE.MeshBasicMaterial({ color: def.accent }),
  );
  cap.position.y = h;
  g.add(cap);
  return g;
}

function buildBank(def) {
  const { w, h, l } = def.size;
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(l, 0);
  shape.quadraticCurveTo(l * 0.55, h * 0.15, l * 0.5, h);
  shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  geo.rotateY(Math.PI / 2);
  centreOnXZ(geo);
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: def.colour, side: THREE.DoubleSide,
  })));
  // The bank's rideable face is the STRAIGHT edge from its base up to the apex
  // at the MIDDLE (shape x = l/2 -> local z = 0), not the curved back half the
  // rider never touches -- see rampHeight()'s 'hump' profile.
  g.add(buildChevrons(w, l / 2, 0, 0, h, 3, RAMP_ARROW_COLOR));
  return g;
}

function buildCone(def) {
  const { w, h } = def.size;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(
    new THREE.ConeGeometry(w, h, 8),
    new THREE.MeshBasicMaterial({ color: def.colour }),
  ).translateY(h / 2));
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(w * 0.62, w * 0.72, 0.16, 8),
    new THREE.MeshBasicMaterial({ color: def.accent }),
  );
  band.position.y = h * 0.45;
  g.add(band);
  return g;
}

function buildPothole(def) {
  const { w, l } = def.size;
  const g = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(w, l) / 2, 12),
    new THREE.MeshBasicMaterial({ color: def.colour, side: THREE.DoubleSide }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.02;
  g.add(disc);
  return g;
}

function buildRoadwork(def) {
  const { w, h } = def.size;
  const g = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(w, h * 0.42, 0.16),
    new THREE.MeshBasicMaterial({ color: def.colour }),
  );
  board.position.y = h * 0.72;
  g.add(board);
  const legMat = new THREE.MeshBasicMaterial({ color: def.accent });
  for (const dx of [-w * 0.4, w * 0.4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.7, 0.12), legMat);
    leg.position.set(dx, h * 0.35, 0);
    g.add(leg);
  }
  return g;
}

function buildLamp(def) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, def.size.h, 6),
    new THREE.MeshBasicMaterial({ color: def.colour }),
  );
  pole.position.y = def.size.h / 2;
  g.add(pole);
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.12, 0.12),
    new THREE.MeshBasicMaterial({ color: def.colour }),
  );
  arm.position.set(0.8, def.size.h, 0);
  g.add(arm);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.2, 0.32),
    new THREE.MeshBasicMaterial({ color: def.accent }),
  );
  head.position.set(1.5, def.size.h - 0.12, 0);
  g.add(head);
  return g;
}

function buildBlob(def) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(def.size.w / 2, 7, 5),
    new THREE.MeshBasicMaterial({ color: def.colour }),
  );
  m.scale.y = def.size.h / def.size.w;
  m.position.y = def.size.h * 0.45;
  g.add(m);
  return g;
}

// A floating gem. The scene is UNLIT, so a plain octahedron in one flat colour
// renders as a featureless silhouette -- on screen it read as a pale card, not
// as a faceted crystal. Facet brightness is therefore baked into VERTEX COLOURS
// from each face's own normal, which buys real gem shading with no light in the
// scene and no second material.
function buildCrystal(def) {
  const { w, h } = def.size;
  const g = new THREE.Group();

  const geo = new THREE.OctahedronGeometry(w * 0.68, 0);
  geo.scale(1, h / w, 1);
  // OctahedronGeometry is non-indexed, so every triangle owns its 3 vertices --
  // exactly what flat per-face shading needs.
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color(def.accent);
  const a = new THREE.Vector3(); const b = new THREE.Vector3(); const cc = new THREE.Vector3();
  const n = new THREE.Vector3();
  // A fixed key direction rather than the camera's: the crystal spins, so a
  // camera-relative key would make every facet flicker at the same rate and
  // cancel the sense of rotation this shading is meant to sell.
  const key = new THREE.Vector3(0.4, 0.75, 0.53).normalize();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    cc.fromBufferAttribute(pos, i + 2);
    n.crossVectors(b.sub(a), cc.sub(a)).normalize();
    // The FLOOR matters more than the range. Shading down to 0.55 was fine on a
    // small gem, but once the crystal doubled in size its dark faces filled
    // enough screen to set the whole read -- amber at 55% against a near-black
    // playfield lands as brown, and it looked like a cardboard box. Keeping the
    // darkest facet at 0.74 preserves the faceting while never letting any face
    // fall out of the gold.
    const k = 0.74 + 0.26 * Math.max(0, n.dot(key));
    for (let j = 0; j < 3; j++) {
      colours[(i + j) * 3] = c.r * k;
      colours[(i + j) * 3 + 1] = c.g * k;
      colours[(i + j) * 3 + 2] = c.b * k;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true })));

  // Larger, dimmer shell: a cheap glow that needs no post-processing, and the
  // thing that separates a crystal from the white chevrons painted on the ramps
  // at a glance.
  // Sized just proud of the core (0.68 -> 0.82). At 1.05 it stood far enough off
  // the gem to read as a dull solid shell of its own rather than as a glow.
  const halo = new THREE.Mesh(
    new THREE.OctahedronGeometry(w * 0.82, 0),
    new THREE.MeshBasicMaterial({
      color: def.colour, transparent: true, opacity: 0.42,
      depthWrite: false, side: THREE.BackSide,
    }),
  );
  halo.scale.y = h / w;
  g.add(halo);
  return g;
}

const BUILDERS = {
  kicker: buildKicker, bigKicker: buildKicker, bank: buildBank, barrel: buildBarrel,
  rail: buildRail, longRail: buildRail, ledge: buildLedge,
  cone: buildCone, pothole: buildPothole, roadwork: buildRoadwork,
  lamp: buildLamp, hydrant: buildBlob,
  crystal: buildCrystal, highCrystal: buildCrystal,
};

export function createProps(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const pools = {}; // type -> array of free meshes
  const active = []; // { type, def, s, u, mesh, spent }
  // Which prop kinds may spawn. Hazards excluded by default; see add().
  let allowedKinds = new Set(['launch', 'grind', 'scenery', 'pickup']);
  let nextPatternS = 60; // leave the opening stretch clear
  let spinT = 0; // drives the pickup spin/bob
  let patternIndex = 0;

  const _v = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _x = new THREE.Vector3();
  const _z = new THREE.Vector3();
  const _basis = new THREE.Matrix4();
  const _frame = makeFrame();
  const _spin = new THREE.Quaternion(); // pickup spin, composed onto the basis

  function acquire(type) {
    const pool = pools[type] || (pools[type] = []);
    if (pool.length) return pool.pop();
    const mesh = BUILDERS[type](PROP_TYPES[type]);
    mesh.frustumCulled = false;
    return mesh;
  }

  function release(item) {
    group.remove(item.mesh);
    (pools[item.type] || (pools[item.type] = [])).push(item.mesh);
  }

  function add(type, s, theta) {
    const def = PROP_TYPES[type];
    if (!def) return;
    // KIND FILTER. Hazards (cones, potholes) are off by default -- Amit wants
    // the punishing encounters gone for now, but explicitly may want them back
    // for a future game mode. So they are filtered at SPAWN rather than deleted
    // from the catalogue or stripped out of the authored patterns: the content
    // survives intact and a mode can switch it back on with one flag, instead
    // of someone having to re-author eight patterns from a git history.
    if (!allowedKinds.has(def.kind)) return;
    const mesh = acquire(type);
    group.add(mesh);
    active.push({ type, def, s, theta, mesh, spent: false });
  }

  /** Emit the next authored pattern, plus roadside scenery for that stretch. */
  function emitPattern() {
    const p = PATTERNS[patternIndex % PATTERNS.length];
    patternIndex++;
    const start = nextPatternS;
    for (const item of p.build(THETA_MAX)) {
      add(item.type, start + item.ds, item.u);  // item.u is authored as an ANGLE now
    }

    // Roadside dressing across the same stretch. Deterministic per index so the
    // world doesn't reshuffle, but varied enough not to read as a repeat.
    const W = THETA_MAX;
    for (let d = 0; d < p.length; d += 16) {
      const s = start + d;
      const r = hash(s);
      // NO palms, bushes or buildings. They were roadside furniture inherited
      // from the flat-road version and made no sense once the world became a
      // half-pipe suspended in a sky-city -- trees growing out of the lip of a
      // giant trough read as a mistake, not as scenery. The sky matte painting
      // is what fills this space in phase 3.
      //
      // Lamps stay for now: they line the lip like coping lights, which is at
      // least plausible, and they give the eye something to read speed against
      // until the real art lands.
      for (const side of [-1, 1]) {
        const r2 = hash(s * 1.7 + side * 31);
        if (r2 < 0.5) add('lamp', s + r * 8, (W + 0.14) * side);
      }
    }
    nextPatternS += p.length;
    return p.name;
  }

  return {
    group,
    active,

    reset() {
      while (active.length) release(active.pop());
      nextPatternS = 60;
      patternIndex = 0;
    },

    /** Keep the field populated ahead and recycled behind. */
    update(riderS, dt = 0) {
      spinT += dt;
      while (nextPatternS < riderS + SPAWN_AHEAD) emitPattern();
      for (let i = active.length - 1; i >= 0; i--) {
        const it = active[i];
        if (it.s < riderS - RECYCLE_BEHIND) {
          release(it);
          active.splice(i, 1);
          continue;
        }
        // Place on the trough SURFACE at (s, theta) and orient to the local
        // frame, so a prop part-way up the wall stands out of the wall rather
        // than staying world-upright. Basis is built explicitly rather than via
        // lookAt, whose axis convention differs between cameras and meshes.
        toWorld(it.s, it.theta, _v);
        it.mesh.position.copy(_v);
        surfaceUp(it.s, it.theta, _up);
        const f = frameAt(it.s, _frame);
        _z.copy(f.tangent);
        // RAMPS (kind 'launch': kicker/bigKicker/bank) are wedges whose tall lip
        // is authored at local -Z (see buildKicker/buildBank) -- the intent
        // written there was "rising toward the far, down-road end", but mapping
        // local +Z straight to the tangent put the lip at -tangent instead, i.e.
        // facing BACKWARD toward the approaching rider. That's exactly the bug:
        // you meet the tall face first instead of rolling up a low edge and
        // launching off the lip ahead of you. Flipping z here (and re-deriving x
        // so the basis stays orthonormal) puts local -Z -- the lip -- at
        // +tangent, ahead of the rider, where a launch is supposed to happen.
        if (it.def.kind === 'launch') _z.negate();
        _x.crossVectors(_up, _z).normalize();
        _basis.makeBasis(_x, _up, _z);
        it.mesh.quaternion.setFromRotationMatrix(_basis);

        // Pickups turn and bob. Motion is what separates "collect me" from
        // "part of the scenery" at a glance, and it costs one rotation per
        // frame. Phase is derived from the prop's own position so neighbouring
        // crystals are not locked in step.
        if (it.def.kind === 'pickup') {
          // Spin about the SURFACE normal, composed onto the basis above --
          // writing mesh.rotation.y here instead would overwrite the whole
          // quaternion and stand the crystal world-upright on a rolled section.
          _spin.setFromAxisAngle(_up, spinT * 1.8 + it.s * 0.7);
          it.mesh.quaternion.premultiply(_spin);
          // Float it off the surface, along that same normal. The height is the
          // one the probe tests against, so what you see is what you can reach.
          it.mesh.position.addScaledVector(
            _up, it.def.pickup.height + Math.sin(spinT * 2.2 + it.s) * 0.16,
          );
        }
      }
    },

    /**
     * Interaction test. Returns the first prop the rider is overlapping this
     * frame, or null. Airborne riders only collide with nothing -- being in the
     * air is exactly what clears hazards.
     *
     * @param {number} s @param {number} theta @param {boolean} airborne
     * @param {number} sPrev @param {number} height rider's height above the
     *   surface -- pickups are the only kind that cares, but a low crystal and
     *   a high one are otherwise indistinguishable to this test.
     * @param {number} sPrev where the rider was last frame, for the ramp-lip
     *   crossing test below
     */
    /**
     * Choose which prop kinds spawn from here on. Takes effect for newly
     * emitted patterns; anything already in the world stays until it recycles.
     * @param {string[]} kinds e.g. ['launch','grind','scenery','hazard']
     */
    setAllowedKinds(kinds) {
      allowedKinds = new Set(kinds);
    },

    probe(s, theta, airborne, sPrev, height = 0) {
      for (const it of active) {
        if (it.spent || it.def.kind === 'scenery') continue;
        const { l, w } = it.def.size;
        const halfL = (it.def.kind === 'grind' ? l : Math.max(l, 1.2)) / 2;
        if (it.def.kind === 'launch') {
          // LAUNCH AT THE TAKEOFF, NOT THE BASE. A plain overlap test fires on
          // the ramp's leading edge, so the rider popped the instant they
          // touched the bottom and then sailed over the wedge instead of riding
          // up it. The takeoff point comes from the prop's own profile -- the
          // far end for a wedge, the mid apex for a bank (see rampHeight).
          //
          // This is a CROSSING test rather than a "near the end" zone on
          // purpose. At 35 u/s the rider covers ~0.6 units per frame, and more
          // on a slow one, so any fixed zone narrow enough to read as "the end"
          // of a 3.4-unit kicker can be stepped clean over -- an occasional
          // ramp that silently does nothing. Asking whether the takeoff fell
          // BETWEEN last frame's position and this one cannot miss, at any
          // speed or frame rate.
          const takeoff = it.s - halfL + 2 * halfL * apexFrac(it.def.launch.profile);
          if (!(sPrev < takeoff && s >= takeoff)) continue;
        } else if (it.def.kind === 'pickup') {
          // A SPHERE, not a slice. A crystal is barely half a metre long, and at
          // 30 u/s the rider covers half a metre per frame -- an overlap test on
          // a window that small collected nothing at all over 890 m (measured),
          // and a bare crossing test is worse, because it gives exactly ONE
          // frame in which the rider must also happen to be laterally on it.
          // Using the catch width along the road as well turns that into a
          // grab radius roughly six frames wide, which is what makes reaching
          // for a crystal a question of carving rather than of frame timing.
          if (Math.abs(s - it.s) > it.def.pickup.catchWidth) continue;
        } else if (s < it.s - halfL || s > it.s + halfL) {
          continue;
        }
        const catchW = it.def.kind === 'grind' ? it.def.grind.catchWidth
          : it.def.kind === 'pickup' ? it.def.pickup.catchWidth
          : w / 2 + 0.45;
        // Prop sizes stay authored in WORLD units; convert the angular gap to an
        // arc length so a prop is the same physical size wherever it sits on the
        // wall (and stays correct if the radius varies for funnels later).
        const arcGap = Math.abs(theta - it.theta) * TROUGH_RADIUS;
        if (arcGap > catchW) continue;
        // Airborne clears hazards and launchers, but you can still land INTO a
        // grind -- that's the good kind of accident -- and you can still collect
        // PICKUPS, which is the entire point of placing them off a ramp.
        if (airborne && it.def.kind !== 'grind' && it.def.kind !== 'pickup') continue;
        // A pickup floating three metres up is not collectable from the road.
        if (it.def.kind === 'pickup'
            && Math.abs(height - it.def.pickup.height) > it.def.pickup.reach) continue;
        return it;
      }
      return null;
    },

    /**
     * Height of the launch ramp the rider is currently standing on, or 0.
     *
     * The counterpart to the takeoff-crossing test above: now that the rider
     * travels the ramp's full length on the ground before popping, they need
     * its deck to stand on, or they ride straight through the wedge.
     *
     * Deliberately geometric and un-eased -- the board should track the face
     * exactly, not lag behind it. Smoothing belongs on the way back DOWN after
     * launch, which is the caller's business (see main.js's rampLift).
     *
     * @param {number} s @param {number} theta
     */
    rampHeightAt(s, theta) {
      let best = 0;
      for (const it of active) {
        if (it.def.kind !== 'launch') continue;
        const { l, w, h } = it.def.size;
        const halfL = Math.max(l, 1.2) / 2;
        const base = it.s - halfL;
        if (s < base || s > it.s + halfL) continue;
        const arcGap = Math.abs(theta - it.theta) * TROUGH_RADIUS;
        if (arcGap > w / 2 + 0.45) continue;
        // Overlapping ramps are not authored today, but taking the highest
        // keeps this correct if a pattern ever stacks them.
        const y = rampHeight(it.def.launch.profile, h, (s - base) / (2 * halfL));
        if (y > best) best = y;
      }
      return best;
    },
  };
}
