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
import { THETA_MAX, TROUGH_RADIUS } from '../data/constants.js';

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
  return h * t;
}

/** Fraction along a launch prop where the rider leaves it. */
function apexFrac(profile) {
  return profile === 'hump' ? 0.5 : 1;
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

const BUILDERS = {
  kicker: buildKicker, bigKicker: buildKicker, bank: buildBank,
  rail: buildRail, longRail: buildRail, ledge: buildLedge,
  cone: buildCone, pothole: buildPothole, roadwork: buildRoadwork,
  lamp: buildLamp, hydrant: buildBlob,
};

export function createProps(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const pools = {}; // type -> array of free meshes
  const active = []; // { type, def, s, u, mesh, spent }
  let nextPatternS = 60; // leave the opening stretch clear
  let patternIndex = 0;

  const _v = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _x = new THREE.Vector3();
  const _z = new THREE.Vector3();
  const _basis = new THREE.Matrix4();
  const _frame = makeFrame();

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
    update(riderS) {
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
      }
    },

    /**
     * Interaction test. Returns the first prop the rider is overlapping this
     * frame, or null. Airborne riders only collide with nothing -- being in the
     * air is exactly what clears hazards.
     *
     * @param {number} s @param {number} theta @param {boolean} airborne
     * @param {number} sPrev where the rider was last frame, for the ramp-lip
     *   crossing test below
     */
    probe(s, theta, airborne, sPrev) {
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
        } else if (s < it.s - halfL || s > it.s + halfL) {
          continue;
        }
        const catchW = it.def.kind === 'grind'
          ? it.def.grind.catchWidth
          : w / 2 + 0.45;
        // Prop sizes stay authored in WORLD units; convert the angular gap to an
        // arc length so a prop is the same physical size wherever it sits on the
        // wall (and stays correct if the radius varies for funnels later).
        const arcGap = Math.abs(theta - it.theta) * TROUGH_RADIUS;
        if (arcGap > catchW) continue;
        // Airborne clears hazards and launchers, but you can still land INTO a
        // grind -- that's the good kind of accident.
        if (airborne && it.def.kind !== 'grind') continue;
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
