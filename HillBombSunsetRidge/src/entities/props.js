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
import { PROP_TYPES, PATTERNS, FACE_PATTERNS } from '../data/propTypes.js';
import {
  toWorld, surfaceUp, frameAt, makeFrame, radiusAt, dropLipsBetween,
} from '../world/trough.js';
import { RAMP_ARROW_COLOR } from '../data/constants.js';
// Patterns are authored as FRACTIONS of the ridable half-width, so the rim angle
// they are handed has to be the live one -- a pattern laid out against the
// half-pipe's 1.15 rad would put half its props past the edge of a shallower,
// wider open face.
import { TERRAIN } from '../data/terrain.js';

const SPAWN_AHEAD = 340; // keep the field populated this far down the road
const RECYCLE_BEHIND = 40;

// Deterministic per-index shuffle so the descent varies but a given run is
// reproducible. Math.random would also work, but this keeps the layout stable
// if the same stretch is ever regenerated.
/**
 * Which content table this terrain plays. The street set was authored for the
 * half-pipe; the face set is authored for a wide hill and must not also be
 * scaled (see FACE_PATTERNS). Read per call rather than cached, for the same
 * reason everything else here reads TERRAIN live -- a course change must not
 * leave the previous hill's content table in place.
 */
function patternSet() {
  return TERRAIN.patternSet === 'face' ? FACE_PATTERNS : PATTERNS;
}

function hash(n) {
  let x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * A seeded generator, so a run's layout is decided once and then replayed
 * identically for the rest of that run -- patterns are emitted lazily as the
 * road unrolls, and an unseeded Math.random() would make the course depend on
 * WHEN a pattern happened to spawn rather than on the run itself.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

/**
 * Is the rider inside a boost gate's ARCH, vertically?
 *
 * Derived from the gate's own geometry rather than a separately tuned reach.
 * The two had drifted: an air gate hangs at 2.6 with a 2.9-tall arch, so it
 * VISUALLY spans 2.6 to 5.5, while the old symmetric test accepted 0.9 to 4.3.
 * A backflip peaks around 5.0-5.6, which put the rider squarely inside the arch
 * on screen and outside the collider.
 *
 * One rule for both kinds: a gate is taken by passing through its arch, and
 * whether that arch sits on the road or hangs over a landing is just where its
 * base is. The margin is generous on purpose -- clipping the frame counts, the
 * same way it does laterally.
 */
function withinGateArch(def, height) {
  const base = def.boost.height || 0;
  const margin = 0.55;
  return height >= base - margin && height <= base + def.size.h + margin;
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

// A SPEED GATE. Two lit pylons and an arch you ride through, with a stack of
// floating chevrons inside it and a glowing strip on the road beneath.
//
// It started as a flat chevroned decal painted on the road, which was legible
// from directly above and almost invisible from where the player actually
// looks -- a shallow forward camera flattens anything lying on the ground to a
// sliver by about thirty metres. Anything the player has to STEER FOR has to be
// readable at the range where the decision is still available, and that means
// vertical geometry: an arch breaks the horizon and keeps its silhouette all the
// way in. The arch is also the collider made visible -- ride between the posts
// and you have it -- rather than a shape you have to learn the hitbox of.
function buildBoostPad(def) {
  const { w, l } = def.size;
  const h = 2.9;
  const g = new THREE.Group();
  const glow = new THREE.MeshBasicMaterial({ color: def.colour });

  // Posts, set at the catch width so the gap you can see IS the gap that counts.
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, h, 0.22), glow);
    post.position.set(side * w * 0.5, h / 2, 0);
    g.add(post);
  }
  // Lintel across the top.
  const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.22, 0.22, 0.22), glow);
  top.position.y = h;
  g.add(top);

  // THREE ARROWS GOING UP, in the plane of the gate. buildChevrons lays its
  // chevrons along the line (z0,y0)->(z1,y1), so the previous call -- which ran
  // from z=+0.35 to z=-0.35 at y=0 -- laid them flat on the ROAD, which is
  // exactly where they were still being seen. A line with no z component and a
  // rising y puts them upright in the gap instead, which is the only place they
  // read as "go through here, fast".
  g.add(buildChevrons(w * 0.55, 0, 0.55, 0, h - 0.5, 3, def.accent));

  // Nothing on the floor. The gate IS the sign; a decal underneath only
  // competes with it and is invisible from the angle the player rides at.
  return g;
}

// A plank wall. Horizontal boards with a visible gap between them and two
// uprights, because a solid slab reads as scenery at speed while boards read as
// something built to stop you.
/**
 * A carved stone idol: a tapered plinth, a body, shoulders and a head. Built
 * from boxes rather than a mesh because it has to read as a SILHOUETTE from
 * several hundred units away -- the decision to go for one is made long before
 * any detail resolves -- and a tall stepped shape against a wide empty hill is
 * about as legible as a silhouette gets.
 */
function buildStatue(def) {
  const { w, h, l } = def.size;
  const g = new THREE.Group();
  const stone = new THREE.MeshBasicMaterial({ color: def.colour });
  const lit = new THREE.MeshBasicMaterial({ color: def.accent });
  const parts = [
    { w: w, h: h * 0.16, l: l, y: h * 0.08, m: lit },
    { w: w * 0.62, h: h * 0.52, l: l * 0.62, y: h * 0.42, m: stone },
    { w: w * 0.80, h: h * 0.10, l: l * 0.80, y: h * 0.73, m: lit },
    { w: w * 0.44, h: h * 0.24, l: l * 0.44, y: h * 0.90, m: stone },
  ];
  for (const q of parts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(q.w, q.h, q.l), q.m);
    m.position.y = q.y;
    g.add(m);
  }
  return g;
}

/**
 * THE BLOCKER -- a lit barrier with a hard X across it.
 *
 * This replaces a set of low-poly rocks. Amit: "I think the rocks look bad. I
 * prefer using the blockers that we've built before... you can have like a big
 * X on them, something in the vibe of this neon-like style we've built." He is
 * right about the rocks for a reason worth writing down: everything else on this
 * hill is flat unlit colour and hard edges, and a jittered stone lump is the one
 * object trying to be naturalistic. It read as an asset from a different game.
 *
 * SAME BONES AS woodWall -- two posts and a panel between them, because that
 * silhouette already means "you do not go through this" here. What changes is
 * the surface: a dark slab carrying a bright X, with a lit rail along the top.
 *
 * MAGENTA, and not a new hue. The palette assigns meaning by colour -- cyan
 * paint, violet launcher, green grindable, gold pickup -- and magenta is already
 * the BOUNDARY, the coping at the edge of the ridable world. A barrier planted
 * mid-hill is exactly that: the edge of where you may go, in a place you did not
 * expect one. Inventing a seventh hue for it would be teaching the player a new
 * word for something the language already says.
 *
 * The X does the work at distance. By the time the panel resolves you have
 * already had to choose a side, so what matters is the shape read at range, and
 * two crossed bars is about the most unambiguous "not here" there is.
 */
function buildBlocker(def) {
  const { w, h, l } = def.size;
  const g = new THREE.Group();
  const slab = new THREE.MeshBasicMaterial({ color: def.colour });
  const lit = new THREE.MeshBasicMaterial({ color: def.accent });

  // The dark face the X sits on. Kept well darker than the ground so the bright
  // bars have something to break against rather than glowing off open hillside.
  const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.82, l), slab);
  panel.position.y = h * 0.41;
  g.add(panel);

  // Crossed bars, on BOTH faces -- the rider sees the front on approach and the
  // back for as long as it is behind them, and a blank rear face reads as the
  // barrier having switched off once passed.
  const diag = Math.hypot(w, h * 0.82);
  for (const side of [-1, 1]) {
    for (const dir of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(diag * 0.98, h * 0.13, 0.06), lit);
      bar.position.set(0, h * 0.41, side * (l / 2 + 0.04));
      bar.rotation.z = dir * Math.atan2(h * 0.82, w);
      g.add(bar);
    }
  }

  // Lit rail along the top, and lit post caps: the horizontal line is what
  // reads first at a distance, before the X resolves.
  const rail = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, h * 0.11, l * 1.25), lit);
  rail.position.y = h * 0.87;
  g.add(rail);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, h, l * 1.3), slab);
    post.position.set(side * (w / 2 + 0.13), h / 2, 0);
    g.add(post);
  }
  return g;
}

function buildWall(def) {
  const { w, h, l } = def.size;
  const g = new THREE.Group();
  const plank = new THREE.MeshBasicMaterial({ color: def.colour });
  const post = new THREE.MeshBasicMaterial({ color: def.accent });

  const boards = 3;
  const boardH = h / (boards + (boards - 1) * 0.35);
  for (let i = 0; i < boards; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, boardH, l), plank);
    b.position.y = boardH / 2 + i * boardH * 1.35;
    g.add(b);
  }
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, h, l * 1.3), post);
    p.position.set(side * (w / 2 - 0.11), h / 2, 0);
    g.add(p);
  }
  return g;
}

const BUILDERS = {
  kicker: buildKicker, bigKicker: buildKicker, bank: buildBank, barrel: buildBarrel,
  airGate: buildBoostPad,
  rail: buildRail, longRail: buildRail, ledge: buildLedge,
  cone: buildCone, pothole: buildPothole, roadwork: buildRoadwork,
  lamp: buildLamp, hydrant: buildBlob,
  crystal: buildCrystal, highCrystal: buildCrystal, boostPad: buildBoostPad,
  statue: buildStatue,
  woodWall: buildWall, blocker: buildBlocker,
};

export function createProps(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const pools = {}; // type -> array of free meshes
  const active = []; // { type, def, s, u, mesh, spent }
  // Which prop kinds may spawn. Hazards excluded by default; see add().
  let allowedKinds = new Set(['launch', 'grind', 'scenery', 'pickup']);
  let nextPatternS = 60; // leave the opening stretch clear
  // Separate frontier from the patterns'. Lip ramps are placed against the
  // TERRAIN, which has its own spacing and knows nothing about how long a
  // pattern happens to be -- driving both off one cursor would make whether a
  // drop got a ramp depend on where a pattern boundary happened to fall.
  let nextLipS = 60;
  /** Emissions per pattern name this run -- drives the `rare` cadence. */
  let emitsOf = Object.create(null);
  /**
   * Fraction of a pattern's content actually emitted, 0..1.
   *
   * A COURSE property rather than a terrain or pattern one, and that is the
   * whole reason it exists: the free descent and the mission course ride the
   * same hill with the same patterns, and want different amounts on it. Amit,
   * on the full-density face: "that's a very packed layout... in missions I
   * think we need less fully packed environments."
   *
   * Thinning here rather than authoring a second sparser table keeps ONE set of
   * patterns as the source of truth for how the hill is laid out. The
   * distribution across the width -- which took several passes to get right --
   * is preserved automatically, because dropping items uniformly at random
   * thins every band and every kind in the same proportion.
   */
  let density = 1;
  // --- route variation ------------------------------------------------------
  // Off unless the course asks for it (see data/courses.js). When off, every
  // one of these is inert and the course is byte-for-byte the fixed layout the
  // missions were measured on.
  let vary = false;
  let rng = mulberry32(1);
  /** Indices left in the current shuffled bag -- see nextPattern(). */
  let bag = [];
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
    if (pool.length) {
      const reused = pool.pop();
      // RESET THE MESH, not just the record. Collecting a pickup hides its mesh
      // (`mesh.visible = false`) and marks the record spent; the record is
      // rebuilt on the next spawn but the MESH is pooled and comes back exactly
      // as it was left. So a replayed mission handed out invisible crystals that
      // still scored -- collectable, and impossible to see.
      //
      // Anything a collision may mutate on a pooled mesh has to be undone here.
      // Position and orientation are rewritten every frame by update(), so
      // visibility is the only survivor today; the point of doing it in acquire()
      // is that it stays the one place to add to.
      reused.visible = true;
      return reused;
    }
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

  /**
   * Which set-piece comes next.
   *
   * Fixed courses walk the list in order, which is what makes a mission the
   * same mission every time. A varying course draws from a BAG -- a shuffled
   * copy of the list, refilled when empty -- rather than picking at random each
   * time, so every pattern still appears once per cycle and you never get the
   * same one twice running. Pure random would happily deal 'breather' three
   * times in a row and hide 'big air' for a whole race.
   */
  function nextPattern() {
    const SET = patternSet();
    if (!vary) return SET[patternIndex++ % SET.length];
    if (!bag.length) {
      // Indices into the ACTIVE set, not into PATTERNS. The face set is
      // shorter, so a bag built from the street table would deal indices past
      // its end and hand back undefined.
      bag = SET.map((_, i) => i);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return SET[bag.pop()];
  }

  /**
   * A RAMP ON THE EDGE OF A DROP -- the two air systems stacked.
   *
   * The launcher throws the rider, and then the ground is not there when they
   * come down, so the flight is the ramp's arc plus the whole depth of the
   * drop. It is by a distance the biggest air the game can produce, and it
   * costs nothing to build because both halves already exist: this only decides
   * WHERE to put a kicker.
   *
   * OFF-CENTRE, ALTERNATING SIDES. A ramp spanning the lip would make the drop a
   * jump and nothing else; pushed out to a third of the way across, the same
   * lip is a jump on one side and a clean roll-in on the other, and which one
   * you get is a line you chose several seconds earlier.
   *
   * NOT ON THE WIDE SHALLOW ONES. A drop long enough that the terrain will not
   * launch you is a drop you are meant to flow over -- putting a kicker on it
   * takes away the one shape in the cycle that is about carrying speed rather
   * than leaving the ground.
   */
  function emitLipRamps(throughS) {
    if (nextLipS >= throughS) return;
    for (const lip of dropLipsBetween(nextLipS, throughS)) {
      // Deterministic per drop index, so a given lip is the same every time it
      // is regenerated and does not flicker as the frontier passes it.
      if (hash(lip.index * 7.3 + 11) > TERRAIN.lipRamps) continue;
      if (lip.drop.width > 0.24) continue; // the flow ones stay clean
      const side = lip.index % 2 === 0 ? 1 : -1;
      const u = side * TERRAIN.thetaMax * 0.34;
      // A few metres BEFORE the edge, so the rider is leaving the ramp exactly
      // as the ground goes. On the lip itself the takeoff happens after the
      // hill has already started to fall and the ramp does half its job.
      // The deepest lips get the VERT WALL. It is the only launcher whose own
      // power reaches the flip bar, and stacking it on the biggest drop is the
      // most air the game can produce -- which is precisely the moment that
      // should be a backflip.
      const type = lip.drop.depth >= 7 ? 'barrel'
        : lip.drop.depth >= 4 ? 'bigKicker' : 'kicker';
      add(type, lip.s - 7, u);
    }
    nextLipS = throughS;
  }

  /** Emit the next authored pattern, plus roadside scenery for that stretch. */
  function emitPattern() {
    const p = nextPattern();
    const start = nextPatternS;
    // MIRRORED half the time. Free variety, and it means recognising a pattern
    // still does not tell you which side of the road to be on -- the shape is
    // familiar, the line through it is not.
    const flip = vary && rng() < 0.5 ? -1 : 1;
    const rim = TERRAIN.thetaMax;
    if (emitsOf[p.name] === undefined) emitsOf[p.name] = 0;
    let itemIndex = 0;
    for (const item of p.build(rim)) {
      // Deterministic per (pattern position, item), NOT random: a mission
      // course is a fixed layout, and a star means nothing if the same mission
      // thins differently on a replay. Keyed off the pattern's absolute start
      // so the same stretch of hill always drops the same items.
      const keep = density >= 1 || hash(start * 0.37 + (itemIndex++) * 13.7) < density;
      if (!keep) continue;
      // RARE placements appear in one of every `rare` emissions OF THIS
      // PATTERN. Per-pattern, not global: counted against the global emission
      // index, a rare:3 inside a pattern that itself only comes up every fifth
      // emission needs both cadences to coincide, which fires about one time in
      // fifteen -- measured, that put two idols in an entire 1800m descent with
      // a 53-second hole between them.
      //
      // Counted rather than rolled so the cadence is something a player can
      // come to feel, instead of a coin that can hide an idol for a whole run
      // or deal three in a row.
      // `rarePhase` staggers patterns that share a cadence. Without it every
      // rare:2 placement in the set fires on the same emissions and they arrive
      // in clumps -- measured, six idols in a descent landed as three early,
      // a 1000m gap, then three late.
      if (item.rare && (emitsOf[p.name] % item.rare) !== (item.rarePhase || 0)) continue;
      // SPREAD pushes an authored layout out toward the edges of a wider hill
      // (see data/terrain.js). Clamped at the rim: on a wall terrain the rim is
      // a solid barrier, and a prop scaled past it would be embedded in it.
      // Clamping rather than dropping keeps the pattern's shape -- the outermost
      // items pile onto the edge instead of vanishing, which is what "all the
      // way across the field" should look like.
      const u = Math.max(-rim, Math.min(rim, item.u * TERRAIN.spread));
      add(item.type, start + item.ds, u * flip);  // item.u is an ANGLE
    }

    // Roadside dressing across the same stretch. Deterministic per index so the
    // world doesn't reshuffle, but varied enough not to read as a repeat.
    const W = TERRAIN.thetaMax;
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
      // Lamps line the pipe's lip like coping lights. A terrain that ends in a
      // rendered wall says where the edge is far better than a row of posts
      // does, and two edge markers is one too many -- so on those hills the
      // lamps are simply not emitted. Amit: "we can lose the headlights."
      if (!TERRAIN.lipLamps) continue;
      for (const side of [-1, 1]) {
        const r2 = hash(s * 1.7 + side * 31);
        if (r2 < 0.5) add('lamp', s + r * 8, (W + 0.14) * side);
      }
    }
    nextPatternS += p.length;
    emitsOf[p.name] = (emitsOf[p.name] || 0) + 1;
    return p.name;
  }

  return {
    group,
    active,

    /**
     * @param {number} [startS] where this run begins on the hill.
     *
     * A varying course starts at a DIFFERENT DISTANCE each run, and that one
     * number changes more than the props: the trough's funnels (760 m period),
     * its roll wave and all the roadside dressing are functions of ABSOLUTE s,
     * so a different start puts the pinches, the banking and the scenery
     * somewhere else entirely. The same set-piece sits on different road.
     */
    /** @param {number} d fraction of authored content to emit, 0..1 */
    setDensity(d) {
      density = (typeof d === 'number' && d > 0) ? Math.min(1, d) : 1;
    },

    reset(startS = 0) {
      while (active.length) release(active.pop());
      nextPatternS = startS + 60; // leave the opening stretch clear
      nextLipS = startS + 60;
      emitsOf = Object.create(null);
      patternIndex = 0;
      bag = [];
    },

    /**
     * @param {boolean} on
     * @param {number} seed
     * Called once per run, before reset().
     */
    setVariation(on, seed) {
      vary = !!on;
      rng = mulberry32(Math.floor(seed * 0xffffffff) || 1);
      bag = [];
    },

    /** Keep the field populated ahead and recycled behind. */
    update(riderS, dt = 0) {
      spinT += dt;
      while (nextPatternS < riderS + SPAWN_AHEAD) emitPattern();
      emitLipRamps(riderS + SPAWN_AHEAD);
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
        if (it.def.kind === 'boost' && it.def.boost.height > 0) {
          // Hung at the height the probe tests against, so what you see is what
          // you have to fly through.
          it.mesh.position.addScaledVector(_up, it.def.boost.height);
        }

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
      let collectablesFirst;
      // COLLECTABLES GET FIRST REFUSAL.
      //
      // probe() returns the first match in SPAWN ORDER, which is arbitrary, so
      // whichever prop happens to share a stretch of road wins. A long rail's
      // window is +-7 m -- wide enough to sit under a crystal or a gate hanging
      // twenty feet above it -- and being earlier in the array was enough to
      // mask them completely. Measured: probing a high crystal's exact position
      // returned "longRail". That is where "collecting the yellow pickup during
      // a backflip sometimes does not work" actually came from; the height band
      // was a second, smaller bug on top of it.
      //
      // A pickup or a gate is something you pass THROUGH; a rail or a ramp is
      // something you land ON. When both are in range, the collectable is
      // unambiguously what the rider touched.
      //
      // Deliberately a PRE-PASS over the same loop rather than a sort: the tests
      // below are the definition of a hit, and a second copy of them here is
      // exactly how the gate rule drifted out of step in the first place.
      collectablesFirst = true;
      for (let pass = 0; pass < 2; pass++, collectablesFirst = false) {
      for (const it of active) {
        if (it.spent || it.def.kind === 'scenery') continue;
        const collectable = it.def.kind === 'pickup' || it.def.kind === 'boost';
        if (collectable !== collectablesFirst) continue;
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
        } else if (it.def.kind === 'wall') {
          // A wall is a thin slab across the road -- half a metre deep -- so an
          // overlap test on its own length is barely one frame wide at 30 u/s.
          // Its catch width is used along s as well, for the same reason a
          // pickup's is: an obstacle that can be stepped clean over is not one.
          if (Math.abs(s - it.s) > it.def.wall.catchWidth) continue;
        } else if (it.def.kind === 'boost') {
          if (Math.abs(s - it.s) > it.def.boost.catchWidth) continue;
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
        const catchW = it.def.kind === 'wall' ? it.def.wall.catchWidth
          : it.def.kind === 'grind' ? it.def.grind.catchWidth
          : it.def.kind === 'pickup' ? it.def.pickup.catchWidth
          : it.def.kind === 'boost' ? it.def.boost.catchWidth
          : w / 2 + 0.45;
        // Prop sizes stay authored in WORLD units; convert the angular gap to an
        // arc length so a prop is the same physical size wherever it sits on the
        // wall (and stays correct if the radius varies for funnels later).
        // THE TROUGH IS NOT A CONSTANT RADIUS. It funnels -- radiusAt() pinches
        // to 0.46 of full at a throat -- so converting the angular gap with the
        // nominal TROUGH_RADIUS overstated the real distance by up to 2.2x
        // wherever the road narrows. The visible effect was that a prop had to
        // be hit dead centre to register: you would ride through the frame of a
        // boost gate and collect nothing. Worse, it came and went with the
        // funnels, so it read as flaky rather than as wrong.
        // catchScale keeps an authored collider the same SHARE of the road on a
        // hill of a different radius -- see data/terrain.js. It is 1 on the
        // half-pipe, so nothing this was ever tuned against moves.
        const arcGap = Math.abs(theta - it.theta) * radiusAt(it.s);
        if (arcGap > catchW * TERRAIN.catchScale) continue;
        // Airborne clears hazards and launchers, but you can still land INTO a
        // grind -- that's the good kind of accident -- and you can still collect
        // PICKUPS, which is the entire point of placing them off a ramp.
        // A GROUND gate is on the road and an AIR gate is not. Height is what
        // separates them: a gate hung over a ramp's landing can only be taken by
        // being airborne at the right moment, which is the whole point of it.
        if (it.def.kind === 'boost') {
          if (!withinGateArch(it.def, height)) continue;
        } else if (it.def.kind === 'wall') {
          // YOU CAN JUMP IT, and height is what decides -- not the airborne
          // flag. Being airborne at all would clear a wall you had only just
          // left the ground for, and a ramp deck that carries you over one
          // would not count at all. Above its clear height you are over it;
          // below, you hit it, arc or no arc.
          if (height > it.def.wall.clearHeight) continue;
        } else if (airborne && it.def.kind !== 'grind' && it.def.kind !== 'pickup') continue;
        // A pickup floating three metres up is not collectable from the road.
        if (it.def.kind === 'pickup'
            && Math.abs(height - it.def.pickup.height) > it.def.pickup.reach) continue;
        return it;
      }
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
    /**
     * Height of the tallest ramp surface under (s, theta), or 0.
     * @param {object} [ignore] a prop to skip -- the ramp the rider just
     *   launched FROM. A bank's takeoff is its middle, so the rider is still
     *   over its back half for a moment afterwards; without this they would
     *   collide with the ramp they had just left, on the frame they left it.
     */
    rampHeightAt(s, theta, ignore) {
      let best = 0;
      for (const it of active) {
        if (it === ignore) continue;
        if (it.def.kind !== 'launch') continue;
        const { l, w, h } = it.def.size;
        const halfL = Math.max(l, 1.2) / 2;
        const base = it.s - halfL;
        if (s < base || s > it.s + halfL) continue;
        const arcGap = Math.abs(theta - it.theta) * radiusAt(it.s);
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
