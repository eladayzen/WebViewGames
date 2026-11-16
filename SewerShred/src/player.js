// Raphael on a board, riding the inside of the pipe.
//
// THE FEEL. Lean is a FORCE around the pipe, not a position. Gravity always
// pulls you back toward the floor, so the pipe behaves like a half-pipe that
// never ends: lean and you climb the wall, ease off and you swing back down
// through the bottom and up the other side. Holding a spot high on the wall
// costs a held lean; the floor is free. That is the whole skill — and it maps
// to the board's comfortable axis only (left/right), with neutral = restful.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { R, frameAt, pointAt, wallQuat } from './track.js';

export const PHYS = {
  leanAccel: 11.0,      // rad/s² at full lean
  gravity: 7.5,         // pull back toward the floor, × sin θ
  damping: 2.4,         // rad/s² per rad/s
  maxOmega: 3.6,
};

const RIDER_H = 1.55;
export const SIZE = 1.3;
const DECK_TOP = 0.175;   // board-local y of the grip tape
const BOARD_SCALE = 1.2;  // board 20% bigger (Elad 2026-11-16); the rider stands on the scaled deck
const SEAT_BACK = 0.14;  // shift toward the tail
// Enter the Spin Flip Kick just before the strike (foot peaks at 2.13 s),
// blend in, reach the kick quickly, then play EVERYTHING after it at the
// original speed to the clip's end (Elad: the cut-short version looked lame).
const KICK = { start: 1.72, peak: 2.13, fast: 1.7, slow: 1.0, blendIn: 0.12, landed: 2.7, blendOut: 0.24 };
// The flip is nearly upright by ~2.7 s (handing off there, Elad: "sooner and faster") but turned ~270° (tools/clip-pose.mjs:
// hips yaw runs 22° → −268°). Blending straight back to the ride pose would
// unwind him the short way. Instead: at 2.9 s hand off to the ride loop and
// keep spinning the SAME way one full extra turn (−2π on the bank), so the
// blend's −90° plus the spin lands him square on the board, facing forward.
const LAND_SPIN = -Math.PI * 2;
// DEV attack audition (Elad 2026-11-15), keyed by the clip's number 1–10.
// Times are in clip seconds; foot peaks measured with tools/kick-timing.mjs.
const ATTACK_CUTS = {
  1: { start: 0.4 },                         // Kicking: drop the 0.4 s windup (kick lands 0.60 s) — Elad: perfect
  2: { start: 0.6, end: 1.5, speed: 2.4 },   // Hurricane Kick: ×2 faster, the half around the 1.13 s spin — keep
  3: {},                                     // Armada — keep
  4: { skip: true },                         // Sword Inward Slash: THROW — not for this game
  5: { start: 0.15, speed: 1.5 },            // Flying Kick: −10% start (of 1.50 s), faster
  6: { start: 0.13, speed: 1.5 },            // Martelo 2: −10% start (of 1.30 s), faster
  7: { skip: true },                         // Melee Downward: THROW — not relevant here
  8: {},                                     // Melee Horizontal: THROW-style, but relevant — keep
  9: { start: 0.4, speed: 2.2 },             // Macaco Side: much faster, windup trimmed (foot peaks 0.60 s)
  10: { skip: true },                        // Mutant Punch: not for this game
};   // metres, feet to head

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();     // placed on the wall every frame
    this.bank = new THREE.Group();     // banks into the turn, pops on tricks
    this.root.add(this.bank);
    // rider, board and bubble all 30% bigger (Elad, 2026-11-11)
    this.bank.scale.setScalar(SIZE);
    scene.add(this.root);

    this.board = makeBoard();
    this.board.scale.setScalar(BOARD_SCALE);
    this.bank.add(this.board);

    this.shield = makeShieldBubble();
    this.shield.visible = false;
    this.bank.add(this.shield);

    this.f = frameAt(0);
    this.mixer = null;
    this.actions = {};
    this.reset();
  }

  async load(url, clipsUrl) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;
    // Measure the skinned bind height in WORLD space (the glb carries its scale
    // on the scene root, and the accessor bounds lie — see DimensionDrift's
    // make-rider.mjs).
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    const h = box.max.y - box.min.y;
    const k = RIDER_H / h;
    this.model = new THREE.Group();
    this.model.add(model);
    this.model.scale.setScalar(k);
    this.model.position.y = 0.16 - box.min.y * k;   // feet on the deck
    model.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        o.castShadow = false;
        const m = o.material;
        // Toon-ish: lambert with a bump of emissive so he never drops into the sewer's murk.
        // look test: a bit more lit (Elad 2026-11-16) — self-light from his own colours, not a flat green lift
        o.material = new THREE.MeshLambertMaterial({ map: m.map, color: 0xffffff, emissive: m.map ? 0xffffff : 0x1a2a1a, emissiveMap: m.map || null, emissiveIntensity: m.map ? 0.28 : 1 });
        if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
      }
    });
    this.bank.add(this.model);

    const clipsJson = await (await fetch(clipsUrl)).json();
    this.mixer = new THREE.AnimationMixer(model);
    for (const [name, json] of Object.entries(clipsJson)) {
      const clip = THREE.AnimationClip.parse(json);
      const a = this.mixer.clipAction(clip);
      this.actions[name] = a;
    }
    const ride = this.actions.ride;
    if (ride) { ride.play(); ride.timeScale = 0.75; }

    // SEAT HIM ON THE DECK. The bind-pose bounding box put the feet where the
    // T-pose feet are, but the ride clip crouches — he hovered. Sample the ride
    // loop, find the lowest the feet ever get (in board space), and drop the
    // model so that lowest point sits on the deck's top. Then nudge him toward
    // the tail (+Z, downstream is -Z) so he stands over the back truck.
    if (ride) {
      const feet = ['mixamorigLeftToeBase', 'mixamorigRightToeBase', 'mixamorigLeftFoot', 'mixamorigRightFoot']
        .map((n) => model.getObjectByName(n)).filter(Boolean);
      let low = Infinity;
      const v = new THREE.Vector3();
      this.root.updateMatrixWorld(true);
      for (let t = 0; t <= ride.getClip().duration; t += 1 / 15) {
        this.mixer.setTime(t);
        this.model.updateMatrixWorld(true);
        for (const b of feet) { this.bank.worldToLocal(b.getWorldPosition(v)); low = Math.min(low, v.y); }
      }
      this.mixer.setTime(0);
      if (Number.isFinite(low)) this.model.position.y += DECK_TOP * BOARD_SCALE - low;
    }
    this.model.position.z += SEAT_BACK;
    for (const n of ['flip', 'kick', 'spin', 'push']) {
      const a = this.actions[n];
      if (!a) continue;
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    this.mixer.addEventListener('finished', (e) => {
      if (this.dead) return;
      if (e.action !== this.actions.ride) {
        e.action.fadeOut(0.25);
        this.actions.ride.reset().fadeIn(0.25).play();
      }
    });
    // Mixamo characters face +Z; downstream here is -Z, so turn him around —
    // the camera should see his shell, not his face.
    this.model.rotation.y = Math.PI;
  }

  reset() {
    this.s = 0;
    this.theta = 0;
    this.omega = 0;
    this.speed = 0;
    this.dead = false;
    this.invuln = 0;
    this.shieldOn = false;
    this.hop = 0; this.hopV = 0;
    this.trickSpin = 0;
    this.spinY = 0;
    this.kicking = false;
    this.bank.rotation.set(0, 0, 0);
    this.shield.visible = false;
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.actions.ride?.reset().play();
    }
    this.place();
  }

  play(name, fade = 0.12, timeScale = 1) {
    const a = this.actions[name];
    if (!a) return;
    a.reset();
    a.timeScale = timeScale;
    a.fadeIn(fade).play();
    this.actions.ride?.fadeOut(fade);
  }

  /**
   * The Spin Flip Kick, cut to the hit. The raw clip spends 2.1 s winding up
   * before the foot peaks (measured: tools/kick-timing.mjs → left foot highest
   * at t=2.13 s of 3.70 s). So: jump in just before the strike, race to the
   * peak, ease through the follow-through, then hand back to the ride loop.
   * Contact-to-kick ≈ 0.24 s; the original flip to its landing (2.9 s), then
   * a spin back into the ride stance.
   */
  playKick() {
    const a = this.actions.flip;
    if (!a) return;
    a.reset();
    a.time = KICK.start;
    a.timeScale = KICK.fast;
    a.setEffectiveWeight(1);
    a.fadeIn(KICK.blendIn).play();
    this.actions.ride?.fadeOut(KICK.blendIn);
    this.kicking = true;
  }

  /**
   * DEV (Elad 2026-11-15): audition the 10 Mixamo fight clips from
   * ~/Documents/3d/fightAnimations as the attack, one after the other, so we
   * can see which ones work. Animation only — extracted by
   * tools/extract-attacks.mjs into attacks.json.
   */
  async loadAttacks(url) {
    const list = await (await fetch(url)).json();
    this.attacks = [];
    list.forEach((json, i) => {
      const cut = ATTACK_CUTS[i + 1] || {};
      if (cut.skip) return;
      const a = this.mixer.clipAction(THREE.AnimationClip.parse(json));
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      const start = cut.start ?? 0, end = cut.end ?? json.duration;
      this.attacks.push({ action: a, label: json.label, n: i + 1, start, end, speed: cut.speed ?? 1.2 });
    });
    this.attackIdx = 0;
  }

  /** Play the next attack in the rotation; returns {n, label} for the dev tag. */
  playNextAttack() {
    if (!this.attacks?.length) return null;
    // a squad kicked in quick succession must not cut the current clip short
    // — let each audition clip mostly play out before the next one starts
    if (this.attacks.some((at) => at.action.isRunning() && at.action.time < at.start + (at.end - at.start) * 0.6)) return null;
    const at = this.attacks[this.attackIdx % this.attacks.length];
    this.attackIdx++;
    for (const o of this.attacks) if (o.action.isRunning()) o.action.fadeOut(0.08);
    const a = at.action;
    a.reset();
    a.time = at.start;
    a.timeScale = at.speed;
    a.setEffectiveWeight(1);
    a.fadeIn(0.1).play();
    this.actions.ride?.fadeOut(0.1);
    this.attackOn = at;
    return { n: at.n, label: at.label };
  }

  /** Physics step. `lean` in [-1, 1], positive = right. */
  step(dt, lean) {
    const a = lean * PHYS.leanAccel - PHYS.gravity * Math.sin(this.theta) - PHYS.damping * this.omega;
    this.omega = THREE.MathUtils.clamp(this.omega + a * dt, -PHYS.maxOmega, PHYS.maxOmega);
    this.theta += this.omega * dt;
    this.s += this.speed * dt;

    // little hop (bumps, slime launches) — radial, purely visual + i-frames
    if (this.hop > 0 || this.hopV > 0) {
      this.hopV -= 30 * dt;
      this.hop = Math.max(0, this.hop + this.hopV * dt);
      if (this.hop === 0) this.hopV = 0;
    }
    if (this.invuln > 0) this.invuln -= dt;
  }

  /**
   * DIRECT mode (no gravity): the rider goes where he's told and stays there.
   * `target` is an absolute angle; a critically-damped spring chases it, so
   * there's no swing, no overshoot and nothing pulling you to the floor.
   */
  stepDirect(dt, target) {
    const k = 70, c = 2 * Math.sqrt(k);
    const a = k * (target - this.theta) - c * this.omega;
    this.omega = THREE.MathUtils.clamp(this.omega + a * dt, -PHYS.maxOmega * 1.4, PHYS.maxOmega * 1.4);
    this.theta += this.omega * dt;
    this.s += this.speed * dt;
    if (this.hop > 0 || this.hopV > 0) {
      this.hopV -= 30 * dt;
      this.hop = Math.max(0, this.hop + this.hopV * dt);
      if (this.hop === 0) this.hopV = 0;
    }
    if (this.invuln > 0) this.invuln -= dt;
  }

  place() {
    const f = frameAt(this.s, this.f);
    pointAt(this.s, this.theta, R - 0.02 - this.hop, this.root.position, f);
    wallQuat(f, this.theta, this.root.quaternion);
  }

  animate(dt, time) {
    // bank into the carve (around the board's forward axis) and lean the body
    const targetBank = -this.omega * 0.16;
    this.bank.rotation.z += (targetBank - this.bank.rotation.z) * Math.min(1, dt * 10);
    // trick spins turn the RIDER only — the board stays planted under him
    // (Elad: "does the board have to spin with the character?" — no).
    if (this.trickSpin !== 0) {
      const step = Math.sign(this.trickSpin) * Math.min(Math.abs(this.trickSpin), dt * 24);
      this.trickSpin -= step;
      this.spinY += step;
    } else {
      this.spinY += (0 - wrapPI(this.spinY)) * Math.min(1, dt * 8);
    }
    if (this.model) this.model.rotation.y = Math.PI + this.spinY;
    if (this.mixer) this.mixer.update(dt);
    // an audition attack with a trimmed end hands back to the ride loop there
    const at = this.attackOn;
    if (at && at.end < at.action.getClip().duration - 1e-3 && at.action.isRunning() && at.action.time >= at.end) {
      at.action.fadeOut(0.15);
      this.actions.ride.reset().fadeIn(0.15).play();
      this.attackOn = null;
    }
    if (this.kicking) {
      const a = this.actions.flip;
      if (a.time >= KICK.peak) a.timeScale = KICK.slow;
      if (a.time >= KICK.landed || !a.isRunning()) {
        this.kicking = false;
        a.fadeOut(KICK.blendOut);
        this.actions.ride.reset().fadeIn(KICK.blendOut).play();
        this.trickSpin += LAND_SPIN;
      }
    }
    // The bubble shows ONLY while a shield is held or during the post-hit stun.
    // (Bug: it used to be switched on and never off, so after the first pop or
    // hit it hung around looking like protection that wasn't there.)
    this.shield.visible = this.shieldOn || this.invuln > 0;
    // shield bubble shimmer
    if (this.shield.visible) {
      this.shield.rotation.y += dt * 1.7;
      this.shield.rotation.x += dt * 0.9;
      const p = 1 + Math.sin(time * 9) * 0.04;
      this.shield.scale.setScalar(p);
      const flick = this.invuln > 0 && !this.shieldOn ? (Math.sin(time * 40) > 0 ? 0.85 : 0.25) : 0.6;
      this.shield.material.uniforms.uAlpha.value = flick;
      this.shield.material.uniforms.uTime.value = time;
    }
    // invulnerable blink on the model itself
    if (this.model) this.model.visible = !(this.invuln > 0 && !this.shieldOn && Math.sin(time * 38) > 0.4);
  }

  boardWorld(out = new THREE.Vector3()) {
    return this.board.getWorldPosition(out);
  }
}

function wrapPI(a) {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

// A chunky deck: red grip, yellow trucks, glowing green wheels.
function makeBoard() {
  const g = new THREE.Group();
  const deckShape = new THREE.Shape();
  const L = 0.55, W = 0.2, r = 0.19;
  deckShape.moveTo(-W, -L + r);
  deckShape.quadraticCurveTo(-W, -L, 0, -L);
  deckShape.quadraticCurveTo(W, -L, W, -L + r);
  deckShape.lineTo(W, L - r);
  deckShape.quadraticCurveTo(W, L, 0, L);
  deckShape.quadraticCurveTo(-W, L, -W, L - r);
  deckShape.closePath();
  const deckGeo = new THREE.ExtrudeGeometry(deckShape, { depth: 0.045, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
  deckGeo.rotateX(-Math.PI / 2);
  const deck = new THREE.Mesh(deckGeo, [
    new THREE.MeshLambertMaterial({ color: 0x2a1b17, emissive: 0x0a0505 }),
    new THREE.MeshLambertMaterial({ color: 0xc8322b, emissive: 0x2a0806 }),
  ]);
  deck.position.y = 0.11;
  g.add(deck);
  const truckMat = new THREE.MeshLambertMaterial({ color: 0xf2c230, emissive: 0x2a2000 });
  const wheelMat = new THREE.MeshBasicMaterial({ color: 0x7dff6a });
  const wheelGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.06, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const z of [-0.34, 0.34]) {
    const truck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.06), truckMat);
    truck.position.set(0, 0.075, z);
    g.add(truck);
    for (const x of [-0.17, 0.17]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(x, 0.065, z);
      g.add(w);
    }
  }
  return g;
}

// The "shell shield": a fresnel bubble, brighter at the rim, with a hex shimmer.
function makeShieldBubble() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uAlpha: { value: 0.6 }, uTime: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vec4 mv = modelViewMatrix*vec4(position,1.0);
        vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position;
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uAlpha; uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float fr = pow(1.0 - abs(dot(vN, vV)), 2.2);
        float hex = abs(sin(vP.x*9.0 + uTime*2.0) * sin(vP.y*9.0 - uTime*1.3) * sin(vP.z*9.0));
        float lines = smoothstep(0.85, 1.0, hex);
        vec3 col = mix(vec3(0.35,0.75,1.0), vec3(0.75,1.0,0.6), fr);
        gl_FragColor = vec4(col, (fr*0.9 + lines*0.35 + 0.05) * uAlpha);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 16), mat);
  m.position.y = 0.85;
  return m;
}
