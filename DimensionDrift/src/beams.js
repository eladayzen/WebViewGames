// ── BEAM CURTAINS: THE FIRST HAZARD IN THIS GAME THAT DOES NOT CHASE YOU ───
//
// Everything that threatened the rider in the shoulder mode reacted to the
// rider. The drones acquire, aim, lead and fire; even the telegraph laser,
// before it was made to commit, re-pointed at the player at 21 m/s against a
// board whose best lateral speed is 6.2. A hazard that tracks faster than you
// move is not a hazard, it is weather: there is no read, no answer, and no
// reason to believe anything you did mattered. Measured eight ways, moving was
// WORSE than holding the fall line, which is the exact opposite of what the
// mode was promising.
//
// A beam curtain is the other kind of threat. It stands across the course at a
// fixed distance down the hill with ONE GAP in it, and it does not care where
// the rider is. Some of them move; none of them follow. The whole instruction
// set is visible from a long way off and it is the oldest readable thing in
// games: THERE IS A HOLE, GO THROUGH THE HOLE.
//
// That is deliberately the least clever mechanic available, because the
// complaint it answers was not "this is too hard", it was "I do not understand
// what I should do". A curtain with a hole in it cannot be misunderstood.
//
// ── WHY A SHADER AND NOT GEOMETRY ─────────────────────────────────────────
//
// The gap moves on a sweeping curtain, and cutting a moving hole out of a mesh
// means rebuilding vertices every frame. So the mesh is a FULL-WIDTH strip,
// baked once per band to the terrain it stands on, and the gap is a discard in
// the fragment shader against a per-vertex lateral offset. Sweep moves two
// uniforms; pulse fades a third. No geometry churn, one draw per curtain, and
// the same strip serves all three kinds.
//
// Baked to `meshHeight`, not `terrain.height`: off the centre line the drawn
// surface sags below the analytic one, and a curtain measured against the
// analytic height floats over every convex rise. That finding has now cost
// this project a round on its trees, its drones, its medkits and its boons,
// and it is not going to cost one here.
//
// ── THE SECOND MECHANIC LIVES HERE TOO ────────────────────────────────────
//
// A curtain can be OWNED by a drone (`owner`). An owned curtain dies with its
// drone, which is the whole of mechanic two: the thing in your way is also a
// thing you can shoot, so every curtain is a question -- ride it, or spend a
// shot and delete it. See `attach` and `update`.
import * as THREE from 'three';
import { HALF, VIEW, meshHeight, channelHalf } from './mountain.js';
import { makeLitMaterial } from './lit.js';
import { mulberry32, range, clamp } from './rng.js';

const BAND = 110;
/** Per band, so a curtain every ~175 m of descent. */
const CHANCE = 0.63;
const START_JITTER = 70;

/**
 * ── THE CURTAIN RUNS WALL TO WALL, SO SPAN IS NOT A NUMBER HERE ───────────
 *
 * It was HALF * 0.78, then HALF * 1.36, and both were wrong in the same way:
 * a curtain narrower than the corridor can be answered by holding one side of
 * the course and never looking at the hole, and a curtain wider than it is
 * drawn where nobody can go. Neither is a gate.
 *
 * It is now exactly the channel -- `channelHalf()`, which the mode sets and
 * the rider is clamped to. The curtain ends where the world ends, so the hole
 * is the only way past it. That is the whole design, and tying the two to one
 * number is what makes it true by construction rather than by tuning.
 */
function span() { return channelHalf(); }

const GAP = 9.0;
/** Where the HOLE may sit: inside the channel, never flush against a wall. */
function gapLimit() { return Math.max(0, span() - GAP * 0.5 - 1.5); }

const HEIGHT = 14.0;
const SEG = 30;                       // samples across, for the terrain fit

/**
 * How hard a curtain hits. 100 HP, so eight of them.
 *
 * It was 18 -- five clips and dead -- chosen when the curtain was the only
 * threat being thought about. With drone fire on top, and with a player still
 * learning to read the hole, that is a run that ends before the lesson lands.
 * A clip has to hurt enough to be worth avoiding and little enough that the
 * run survives the mistake you learn from.
 */
const DAMAGE = 12;

/** Pulse: seconds per cycle, and the fraction of it the curtain is lethal. */
const PULSE_PERIOD = 1.75;
const PULSE_DUTY = 0.56;
/** Seconds of visible fade in and out, so it never blinks on with no warning. */
const PULSE_EDGE = 0.22;

/**
 * ── EVERY CURTAIN IS STATIC, AND THAT IS A DECISION, NOT A STUB ───────────
 *
 * There were three kinds: static, a `sweep` whose hole slid across the course,
 * and a `pulse` that blinked the whole curtain on and off. Elad called the
 * sweep on sight: it is too hard for this controller, and he is right in a way
 * that is worth writing down rather than just obeying. This board reverses a
 * carve in 0.72 s and crosses at 6.2 m/s. A hole that moves while you are
 * travelling to it means solving an intercept with a control that cannot
 * correct, and the player cannot tell a hole they misjudged from a hole that
 * ran away -- which is the same illegibility the tracking laser had, wearing a
 * different costume.
 *
 * The pulse is parked with it. It does not move, but it adds a timing layer on
 * top of a mechanic whose entire job right now is to answer "I do not
 * understand what to do". One thing at a time. `_state` still knows how to
 * drive both, so bringing either back is a line in this table.
 */
const KINDS = [
  { id: 'static', weight: 1 },
];
const KIND_TOTAL = KINDS.reduce((sum, k) => sum + k.weight, 0);
function rollKind(r) {
  let acc = r * KIND_TOTAL;
  for (const k of KINDS) { acc -= k.weight; if (acc <= 0) return k.id; }
  return KINDS[0].id;
}
/**
 * ── PURE RED, AND THE FIRST CHOICE HERE WAS A REAL BUG ────────────────────
 *
 * It was hot pink (0xff2f8e), picked by reasoning about what was already on
 * screen: lime is reward, the bolts are red-orange, the slope runs
 * violet-green, so pink looked like the one free corner of the wheel.
 *
 * THE GATES WERE IN THAT CORNER. They draw in 0xff9db4 and 0xd6a6dc -- pink
 * and lilac (course.js). So the one thing in this mode that must never be
 * ridden through was wearing the colour of the thing you are rewarded for
 * riding through, AND the same silhouette: two bright uprights with a space
 * between them. Elad reported it as "there are some gates, when I pass through
 * them the run ends", and he was describing a barrier the whole time.
 *
 * That is the worst class of mistake this file can make. A hazard that is hard
 * to see is a difficulty problem; a hazard that looks like a reward is a game
 * telling the player the opposite of the truth.
 *
 * Pure saturated red, which no gate, pickup, mote or boon uses, and which the
 * drones' orange bolts do not read as at speed.
 */
const COLOR = 0xff2436;

const VERT = `
attribute float aU;
varying float vU;
varying float vV;
varying float vDist;
void main() {
  vU = aU;
  vV = uv.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

// NO BACKTICKS ANYWHERE BELOW. A backtick inside this template literal ends
// the string, and this project has lost three separate rounds to exactly that
// -- in a GLSL comment every time. Refer to uniforms by bare name.
const FRAG = `
uniform float uGapLo;
uniform float uGapHi;
uniform float uOn;
uniform float uTime;
uniform vec3 uColor;
varying float vU;
varying float vV;
varying float vDist;
void main() {
  // THE HOLE. Everything else about this shader is decoration on top of one
  // discard, which is the entire mechanic.
  if (vU > uGapLo && vU < uGapHi) discard;

  // The lip either side of the hole burns brighter, because the edge is the
  // thing the player is actually steering against. A curtain of even
  // brightness states that it is dangerous; a curtain with lit edges states
  // where it stops being dangerous, which is the useful half.
  float edge = min(abs(vU - uGapLo), abs(vU - uGapHi));
  float fringe = exp(-edge * 0.5);

  // Heavier at the base. A curtain solid to the top reads as a wall and hides
  // the slope behind it, which matters because the next curtain is usually
  // already in view behind this one.
  float vert = mix(1.0, 0.18, vV);

  // ── HAZARD STRIPES ──────────────────────────────────────────────────────
  //
  // Diagonal bands, drifting slowly. Colour alone was not enough to separate
  // this from a gate once it was already the wrong colour, and a second,
  // non-chromatic channel means it still separates for a player who cannot
  // tell these two hues apart at all. Nothing else on this mountain is
  // striped; the gates are flat panels and the boons are flat discs.
  float stripe = sin((vU * 1.15 + vV * 3.4) * 1.5 - uTime * 0.9);
  float hazard = 0.72 + 0.28 * smoothstep(-0.25, 0.25, stripe);

  float scan = (0.88 + 0.12 * sin(uTime * 6.5 + vV * 10.0 + vU * 0.35)) * hazard;

  // ── THE DISTANCE FADE, WHICH IS NOT A COSMETIC ──────────────────────────
  //
  // Five or six curtains are in view at once down a straight. Drawn at full
  // strength they stack into one opaque sheet and the slope disappears behind
  // the furthest of them, which is the exact opposite of a readable hazard --
  // the one you have to act on is the NEAREST, and it was the hardest to pick
  // out. Far curtains fade back to a hint and the near one owns the frame.
  float near = 1.0 - smoothstep(90.0, 300.0, vDist);

  float a = uOn * near * vert * scan * (0.34 + 0.44 * fringe);
  vec3 col = uColor * (0.85 + 0.5 * fringe);

  // ── ARROWS, POINTING AT THE WAY THROUGH ─────────────────────────────────
  //
  // Chevrons marching across the face of the wall toward the opening, from
  // BOTH sides, so whichever half of the barrier is in front of you is telling
  // you which way to go.
  //
  // This is the piece the barrier was missing. A wall with a hole in it tells
  // a player that there is a way through; it does not tell them WHICH WAY, and
  // at this speed, with the gap often off-screen behind the wall's own glow,
  // that is a guess. An arrow is the one symbol that needs no learning at all.
  //
  // YELLOW, which is the last unspoken colour on this mountain -- red is the
  // hazards, green the drone marks, lime the rewards, pink and lilac the old
  // gates. It is also the only one of them that is not already a thing you
  // must do something about, which is right: this is not an object, it is an
  // instruction.
  float dirSign = (vU < uGapLo) ? 1.0 : -1.0;
  float gapEdge = (vU < uGapLo) ? uGapLo : uGapHi;
  // Metres from the opening, always positive, whichever side we are on.
  float s = (gapEdge - vU) * dirSign;
  // The chevron: a band in a repeating coordinate, bent by height so it comes
  // to a point. The apex sits at the SMALLEST s -- nearest the gap -- so the
  // arrow points at the hole rather than away from it, and the whole pattern
  // drifts the same way as time runs.
  float p = fract(s * 0.13 + uTime * 0.5 - abs(vV - 0.46) * 1.15);
  float band = smoothstep(0.0, 0.14, p) * (1.0 - smoothstep(0.32, 0.48, p));
  // Kept off the top of the wall, where it would be read against the sky, and
  // off the gap edge itself, where the posts already say everything.
  float arrow = band * (1.0 - smoothstep(0.5, 0.92, vV)) * step(1.2, s) * uOn * near;
  col = mix(col, vec3(1.0, 0.82, 0.12), arrow);
  a = max(a, arrow * 0.92);

  // ── THE DOOR POSTS ──────────────────────────────────────────────────────
  //
  // A near-solid vertical bar down each side of the hole, at full height and
  // without the fade that the rest of the curtain gets.
  //
  // This is the whole readability of the mechanic. A translucent sheet with a
  // translucent absence in it is a texture; two hard vertical edges are a
  // DOORWAY, and a doorway is understood from across the valley by someone who
  // has never played the game. It is also the one element that survives this
  // place's haze, because a vertical is the only thing on this slope that is
  // not already lying along the fall line.
  float post = 1.0 - smoothstep(0.0, 1.35, edge);
  a = max(a, post * uOn * mix(0.95, 0.55, vV));
  col = mix(col, uColor * 1.45 + vec3(0.18), post);

  gl_FragColor = vec4(col, a);
}
`;

/**
 * ── THE SIDE WALLS ────────────────────────────────────────────────────────
 *
 * Elad's call, and it closes a hole in the design rather than decorating one:
 * the corridor already ENDED somewhere -- the rider has always been clamped --
 * but the clamp was invisible and sat 44.8 m out, so a player could ride wide
 * and never meet a curtain at all. A boundary you cannot see is a boundary you
 * learn by being confused.
 *
 * These are the clamp, drawn. They do not damage anyone and they never will:
 * they are not a hazard, they are the edge of the room. Everything dangerous
 * in this mode is pink; the walls are deliberately not, because the one thing
 * they must never do is read as something you have to avoid.
 */
const WALL_H = 22.0;
/**
 * ── THE DRAWN WALL STANDS BACK FROM THE CLAMP ─────────────────────────────
 *
 * Metres outboard of `channelHalf()`. The clamp and the wall were the same
 * number, which is correct as geometry and wrong on screen: the rider is held
 * exactly ON the surface, so the board and the camera pass through it and you
 * watch yourself clipping into the thing that is supposed to be stopping you.
 *
 * The margin costs nothing -- the clamp is still the clamp, nobody can reach
 * the wall, and now nobody can intersect it either. It only has to be wider
 * than the rider plus whatever the camera swings through on a hard lean.
 */
const WALL_OUT = 3.0;

/**
 * ── THE BANK: HOW FAR THE TOP LEANS OUT FROM THE FOOT ─────────────────────
 *
 * Metres. The drawn boundary is no longer a sheet of light but a CUT BANK --
 * the side of an excavation, which is what a site road actually runs between.
 *
 * It leans rather than standing vertical, and the amount is small on purpose.
 * A vertical face is read as a wall whatever it is made of, and this has to be
 * read as EARTH: earth cannot stand at ninety degrees, so a face that does
 * tells the eye it is looking at concrete or at a texture. Four metres of lean
 * over seventeen of rise is about seventy-six degrees -- steeper than any real
 * spoil heap, which is the point, but visibly not plumb.
 */
const BANK_OUT = 4.0;
const WALL_BACK = 70;                 // metres of wall kept behind the rider
const WSEG = 64;                      // samples along the course, per wall
const WALL_COLOR = 0x1b2c52;
/** Churned earth, a shade off the route's own so the edge separates. */
const BANK_COLOR = 0x6b5944;

const WALL_VERT = `
varying float vV;
varying float vDist;
void main() {
  vV = uv.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

// NO BACKTICKS BELOW. See the note on the curtain shader.
const WALL_FRAG = `
uniform vec3 uColor;
uniform float uTime;
varying float vV;
varying float vDist;
void main() {
  // Solid at the base, open at the top. A wall opaque to its full height
  // would box the mountain in and take the horizon away, and the horizon is
  // most of why this place looks like anywhere.
  float vert = mix(0.92, 0.0, pow(vV, 0.9));

  // ── THE RAIL, WHICH IS WHAT ACTUALLY MAKES IT A WALL ────────────────────
  //
  // A bright line along the TOP edge. Without it the wall is a dark gradient
  // lying along a slope that is already full of dark gradients -- geometrically
  // present, visually absent, which is exactly how the first cut came back in
  // the screenshot. The rail gives it a hard silhouette against the sky, and a
  // silhouette is the only thing at this range that says "the world stops
  // here" rather than "the ground is shaded differently here".
  float rail = smoothstep(0.80, 0.985, vV) * (1.0 - smoothstep(0.985, 1.0, vV));

  // Uprights, so it reads as something built rather than a wash of colour.
  float post = smoothstep(0.86, 1.0, sin(vDist * 0.22 + uTime * 0.0));

  float near = 1.0 - smoothstep(190.0, 520.0, vDist);
  float a = max(vert, rail * 0.95) * near;
  vec3 col = mix(uColor, vec3(0.42, 0.72, 0.95), rail) + post * 0.05;
  gl_FragColor = vec4(col, a);
}
`;

export class Beams {
  /**
   * @param {object} terrain
   * @param {THREE.Scene} scene
   * @param {number} seed
   */
  constructor(terrain, scene, mood, seed = 1) {
    this.terrain = terrain;
    this.scene = scene;
    this.seed = (seed ^ 0x2b91f7) >>> 0;
    this.enabled = false;
    this.bands = Math.ceil(VIEW / BAND) + 2;

    /** @type {Array<object|null>} one curtain per band slot, or none. */
    this.beams = new Array(this.bands).fill(null);
    /** @type {THREE.Mesh[]} */
    this.meshes = [];
    const col = new THREE.Color(COLOR);
    for (let i = 0; i < this.bands; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 2), 2));
      geo.setAttribute('aU', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2), 1));
      const idx = [];
      for (let s = 0; s < SEG; s++) {
        const a = s * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      geo.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uGapLo: { value: -GAP * 0.5 },
          uGapHi: { value: GAP * 0.5 },
          uOn: { value: 1 },
          uTime: { value: 0 },
          uColor: { value: col.clone() },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        /**
         * ── NORMAL, NOT ADDITIVE, AND THE SCREENSHOT DECIDED IT ────────────
         *
         * The first cut was additive, like the bolts and the aiming laser.
         * On this slope it arrived as white haze: the place is pale ice under
         * an ACES curve whose exposure runs past 2.5, the frame then goes
         * through bloom at 0.72, and five curtains in view each added their
         * own light to an already-bright background until the mountain behind
         * them was gone. Additive light cannot darken, and against a white
         * slope darkening is the only way a pink wall is going to read.
         *
         * Normal blending makes it a coloured surface instead of a glow,
         * which is also what it IS -- a wall you must not touch, not a beam of
         * light that happens to be lethal.
         */
        blending: THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      scene.add(mesh);
      this.meshes.push(mesh);
    }

    /** The drawn boundary. Two strips, rebuilt each frame around the rider. */
    this.walls = [];
    for (let w = 0; w < 2; w++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((WSEG + 1) * 2 * 3), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((WSEG + 1) * 2 * 2), 2));
      // NORMALS, which the energy shader never needed and a lit one cannot do
      // without. They are written by `_walls` along with the positions.
      geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((WSEG + 1) * 2 * 3), 3));
      const widx = [];
      for (let k = 0; k < WSEG; k++) {
        const a = k * 2;
        widx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      geo.setIndex(widx);
      const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(WALL_COLOR) }, uTime: { value: 0 } },
        vertexShader: WALL_VERT,
        fragmentShader: WALL_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }));
      mesh.frustumCulled = false;
      mesh.visible = false;
      scene.add(mesh);
      this.walls.push(mesh);
    }

    /**
     * ── TWO BOUNDARIES, ONE GEOMETRY ──────────────────────────────────────
     *
     * The energy wall above is KEPT WHOLE and is one call to `setWallStyle`
     * away -- asked for explicitly, because it may be the right boundary for a
     * level that is not a building site.
     *
     * Both styles write into the same strips; only the material and the lean
     * differ, so there is one piece of geometry code and no second ring to
     * keep in step. The lit one is registered in `materials` so main's shared
     * sun and fog reach it, the way the boons do it.
     */
    this.matBank = makeLitMaterial(mood, {
      color: BANK_COLOR, wrap: 0.42, gloss: 10, specular: 0.06, snowCap: 0,
    });
    this.materials = [this.matBank];
    /** @type {THREE.Material[]} the glow, kept so a swap back costs nothing. */
    this._matEnergy = this.walls.map((m) => m.material);
    this.wallStyle = 'bank';

    this.baseBand = NaN;
    this.t = 0;
    this.stats = { crossed: 0, clipped: 0 };
    /** Last frame's descent and world x per fighter, for the swept test. */
    this._prevP = new Map();
    this._prevX = new Map();
    this.setEnabled(false);
  }

  /** Pure in (band, seed): the same band rebuilt later comes back identical. */
  _buildBand(bandIdx) {
    const slot = ((bandIdx % this.bands) + this.bands) % this.bands;
    this.beams[slot] = null;
    this.meshes[slot].visible = false;
    const rand = mulberry32((this.seed ^ Math.imul(bandIdx + 7717, 0x9e3779b1)) >>> 0);
    if (rand() >= CHANCE) return;

    const p = bandIdx * BAND + range(rand, 0, START_JITTER);
    const z = -p;
    const kind = rollKind(rand());
    const lim = gapLimit();
    const base = clamp(range(rand, -lim, lim), -lim, lim);

    const sp = span();
    const mesh = this.meshes[slot];
    const pos = mesh.geometry.attributes.position.array;
    const uvs = mesh.geometry.attributes.uv.array;
    const aU = mesh.geometry.attributes.aU.array;
    for (let s = 0; s <= SEG; s++) {
      const u = -sp + (2 * sp * s) / SEG;
      const x = this.terrain.xAt(u, z);
      const y0 = meshHeight(this.terrain, x, z);
      const o = s * 6;
      pos[o] = x; pos[o + 1] = y0; pos[o + 2] = z;
      pos[o + 3] = x; pos[o + 4] = y0 + HEIGHT; pos[o + 5] = z;
      const q = s * 4;
      uvs[q] = s / SEG; uvs[q + 1] = 0;
      uvs[q + 2] = s / SEG; uvs[q + 3] = 1;
      aU[s * 2] = u;
      aU[s * 2 + 1] = u;
    }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.attributes.uv.needsUpdate = true;
    mesh.geometry.attributes.aU.needsUpdate = true;

    this.beams[slot] = {
      p, z, slot, kind, base,
      phase: rand() * Math.PI * 2,
      /**
       * WHAT TO CALL THIS WHEN IT KILLS SOMEONE. Read by the fighter's
       * `onDamage` in main.js. Without it every death in this mode reads as
       * the same anonymous event -- Elad's exact report was "I was just killed
       * by something, I have no idea why", on a build where a curtain took 18
       * of 100 health with the same sound a 6-damage bolt makes.
       */
      hitLabel: 'BARRIER',
      /** Set by `attach`: a drone whose death takes this curtain with it. */
      owner: null,
      dead: false,
      /** Resolved every frame by `_state`. */
      gapLo: base - GAP * 0.5,
      gapHi: base + GAP * 0.5,
      on: 1,
    };
  }

  /**
   * Where the hole is, and how lethal the curtain is, at time t.
   *
   * TIME, NOT THE RIDER. A sweep that took the rider's position as an input
   * would be the tracking laser again wearing a different hat.
   */
  _state(b) {
    let centre = b.base;
    let on = 1;
    if (b.kind === 'pulse') {
      const cyc = ((this.t + b.phase) % PULSE_PERIOD + PULSE_PERIOD) % PULSE_PERIOD;
      const live = PULSE_PERIOD * PULSE_DUTY;
      // Ramped at both ends rather than switched. A curtain that appears
      // between two frames is a curtain that was never avoidable, which is the
      // thing this whole file exists to stop happening.
      if (cyc > live) on = 0;
      else on = Math.min(1, Math.min(cyc, live - cyc) / PULSE_EDGE);
    }
    b.gapLo = centre - GAP * 0.5;
    b.gapHi = centre + GAP * 0.5;
    b.on = on;
    return b;
  }

  /**
   * Hand a curtain to a drone. MECHANIC TWO: the obstacle is also the target.
   *
   * Called by whatever owns the drones, once they exist for a band. The
   * curtain keeps its own placement -- it is not moved onto the drone -- so
   * what the player learns is "that pod is projecting that wall", which is
   * readable at range in a way that a wall following a pod around is not.
   */
  attach(p, drone) {
    const b = this.beams[((Math.floor(p / BAND) % this.bands) + this.bands) % this.bands];
    if (b && !b.owner) b.owner = drone;
    return b ?? null;
  }

  /**
   * Did anyone ride into a live curtain this frame?
   *
   * SWEPT IN p, not sampled. At this mode's speeds the rider covers metres
   * between frames and a point test would ride through a wall it never saw.
   */
  _cross(roster) {
    const events = [];
    for (const f of roster.fighters) {
      if (!f.alive) continue;
      const now = f.p;
      const was = this._prevP.get(f.id);
      this._prevP.set(f.id, now);
      if (was === undefined || now <= was || now - was > 200) continue;
      for (let s = 0; s < this.bands; s++) {
        const b = this.beams[s];
        if (!b || b.dead) continue;
        if (b.p <= was || b.p > now) continue;    // not crossed this frame
        this._state(b);
        this.stats.crossed++;
        // Lethal only while it is actually up, and only outside the hole.
        if (b.on < 0.5) continue;
        // The rider's lateral offset AT THE CROSSING, interpolated -- taking
        // it at the end of the frame would forgive a rider who was through the
        // wall and out the other side.
        const k = (b.p - was) / Math.max(1e-3, now - was);
        /**
         * BOTH SAMPLES MEASURED AT THE CURTAIN'S OWN z, which is not where
         * either of them was taken.
         *
         * `u` is the offset from the centre LINE, and the centre line wanders
         * across the mountain. Measuring this frame's offset at this frame's z
         * and last frame's at last frame's z compares two numbers taken
         * against two different origins, and then interpolates between them as
         * though they shared one. The error is the centre line's drift over a
         * frame of descent -- small, but it is signed, it is biased in
         * whichever direction the course is turning, and it lands exactly
         * where a player is trying to thread a hole.
         *
         * Taking both x values against the curtain's centre line costs one
         * subtraction and makes the test mean what it says.
         */
        const cx = this.terrain.centerX(b.z);
        const u = f.x - cx;
        const uPrev = (this._prevX.get(f.id) ?? f.x) - cx;
        const uAt = uPrev + (u - uPrev) * k;
        if (uAt > b.gapLo && uAt < b.gapHi) continue;   // through the hole
        if (Math.abs(uAt) > span() + 2) continue;       // outside the world entirely
        if (f.damage(DAMAGE, b)) {
          this.stats.clipped++;
          events.push({ type: 'beam', kind: b.kind, slot: f.slot, u: uAt, p: b.p });
        }
      }
    }
    for (const f of roster.fighters) this._prevX.set(f.id, f.x);
    return events;
  }

  _hide(slot) { this.meshes[slot].visible = false; }

  _ring(p) {
    const want = Math.floor(p / BAND) - 1;
    if (want === this.baseBand) return;
    if (!(want - this.baseBand >= 0) || want - this.baseBand >= this.bands || want < this.baseBand) {
      for (let i = 0; i < this.bands; i++) this._buildBand(want + i);
    } else {
      for (let k = this.baseBand; k < want; k++) this._buildBand(k + this.bands);
    }
    this.baseBand = want;
  }

  /**
   * Rebuilt every frame rather than band-recycled.
   *
   * The curtains are recycled because each one is a placed object with state.
   * A wall is not: it is the same two lines all the way down the mountain, and
   * 130 vertices a frame is cheaper than the bookkeeping that would avoid
   * writing them. It also means the wall is always exactly on the clamp, so a
   * mode that changes the channel mid-run cannot leave a visible lie behind.
   */
  /**
   * 'bank' for a cut face of earth, 'energy' for the glowing rail.
   *
   * The energy wall is NOT dead code. It is the boundary this mode shipped
   * with, it reads unmistakably as a limit, and a level that is not made of
   * dirt will want it back -- which is why it is a switch rather than a
   * deletion. Both styles write the same strips; only the material and the
   * lean differ.
   */
  /**
   * Hide the drawn boundary entirely.
   *
   * For a mode whose edge is cut into the TERRAIN (see `setCut` in
   * mountain.js): the ground already states where the course ends, and a rail
   * drawn on top of it is a second boundary saying the same thing.
   */
  setWallsVisible(v) {
    this.wallsOn = v !== false;
    if (!this.wallsOn) for (const w of this.walls) w.visible = false;
  }

  setWallStyle(style) {
    this.wallStyle = style === 'energy' ? 'energy' : 'bank';
    for (let i = 0; i < this.walls.length; i++) {
      this.walls[i].material = this.wallStyle === 'energy'
        ? this._matEnergy[i] : this.matBank;
    }
  }

  _walls(p) {
    const sp = span() + WALL_OUT;
    for (let w = 0; w < 2; w++) {
      const sgn = w === 0 ? -1 : 1;
      const mesh = this.walls[w];
      const pos = mesh.geometry.attributes.position.array;
      const uvs = mesh.geometry.attributes.uv.array;
      const nrm = mesh.geometry.attributes.normal.array;
      const bank = this.wallStyle === 'bank';
      // The top of a bank sits FURTHER OUT than its foot. The face therefore
      // leans away from the rider, which is the one thing that makes it read
      // as a cut in the ground rather than as a board stood on edge.
      const lean = bank ? BANK_OUT : 0;
      // Face normal for the lit material: horizontal component pointing back
      // in at the rider, vertical component from the lean. Constant along the
      // strip, which is correct -- the face is a ruled surface and its normal
      // only turns with the lean, not with the ground under it.
      const nLen = Math.hypot(WALL_H, lean) || 1;
      const nx = -sgn * (WALL_H / nLen);
      const ny = lean / nLen;
      for (let k = 0; k <= WSEG; k++) {
        const pp = p - WALL_BACK + ((VIEW + WALL_BACK) * k) / WSEG;
        const z = -pp;
        const xFoot = this.terrain.xAt(sgn * sp, z);
        const xTop = this.terrain.xAt(sgn * (sp + lean), z);
        // The foot is BURIED a little, so no sliver of daylight shows under a
        // bank standing on ground that is never quite where the strip samples.
        const y0 = meshHeight(this.terrain, xFoot, z) - 1.0;
        const yTop = meshHeight(this.terrain, xTop, z) + WALL_H;
        const o = k * 6;
        pos[o] = xFoot; pos[o + 1] = y0; pos[o + 2] = z;
        pos[o + 3] = xTop; pos[o + 4] = yTop; pos[o + 5] = z;
        const q = k * 4;
        uvs[q] = k / WSEG; uvs[q + 1] = 0;
        uvs[q + 2] = k / WSEG; uvs[q + 3] = 1;
        const n = k * 6;
        nrm[n] = nx; nrm[n + 1] = ny; nrm[n + 2] = 0;
        nrm[n + 3] = nx; nrm[n + 4] = ny; nrm[n + 5] = 0;
      }
      mesh.geometry.attributes.normal.needsUpdate = true;
      mesh.geometry.attributes.position.needsUpdate = true;
      mesh.geometry.attributes.uv.needsUpdate = true;
      mesh.material.uniforms.uTime.value = this.t;
      mesh.visible = this.enabled && this.wallsOn !== false;
    }
  }

  _animate() {
    for (let s = 0; s < this.bands; s++) {
      const b = this.beams[s];
      const mesh = this.meshes[s];
      if (!b) { mesh.visible = false; continue; }
      // MECHANIC TWO, RESOLVED. A curtain whose drone is dead is gone, and the
      // player who spent the shot sees the wall go out.
      if (b.owner && (b.owner.dead || b.owner.gone)) b.dead = true;
      if (b.dead) { mesh.visible = false; continue; }
      this._state(b);
      const u = mesh.material.uniforms;
      u.uGapLo.value = b.gapLo;
      u.uGapHi.value = b.gapHi;
      u.uOn.value = b.on;
      u.uTime.value = this.t;
      mesh.visible = this.enabled;
    }
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) {
      for (let i = 0; i < this.bands; i++) this._hide(i);
      for (const w of this.walls) w.visible = false;
    }
  }

  update(dt, roster, live = true) {
    if (!this.enabled) return [];
    this.t += dt;
    const lead = roster.fighters.find((f) => f.alive) ?? roster.fighters[0];
    if (!lead) return [];
    this._ring(lead.p);
    const events = live ? this._cross(roster) : [];
    this._animate();
    this._walls(lead.p);
    return events;
  }

  reset(p) {
    const first = Math.floor(p / BAND) - 1;
    for (let i = 0; i < this.bands; i++) this._buildBand(first + i);
    this.baseBand = first;
    this._prevP.clear();
    this._prevX.clear();
    this.t = 0;
    this.stats = { crossed: 0, clipped: 0 };
  }

  dispose() {
    for (const m of this.meshes) {
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    this.meshes.length = 0;
    for (const w of this.walls) {
      this.scene.remove(w);
      w.geometry.dispose();
      w.material.dispose();
    }
    this.walls.length = 0;
  }
}
