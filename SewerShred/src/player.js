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
const SEAT_BACK = 0.14;  // shift toward the tail
// Enter the Spin Flip Kick just before the strike (foot peaks at 2.13 s),
// blend in, reach the kick quickly, then play EVERYTHING after it at the
// original speed to the clip's end (Elad: the cut-short version looked lame).
const KICK = { start: 1.72, peak: 2.13, fast: 1.7, slow: 1.0, blendIn: 0.12, blendOut: 0.3 };   // metres, feet to head

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
        o.material = new THREE.MeshLambertMaterial({ map: m.map, color: 0xffffff, emissive: 0x1a2a1a });
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
      if (Number.isFinite(low)) this.model.position.y += DECK_TOP - low;
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
   * Contact-to-kick ≈ 0.24 s; then the original follow-through, ~1.6 s.
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
    // trick spin decays to zero (full 360 around the pipe axis when triggered)
    if (this.trickSpin !== 0) {
      const step = Math.sign(this.trickSpin) * Math.min(Math.abs(this.trickSpin), dt * 16);
      this.trickSpin -= step;
      this.bank.rotation.y += step;
    } else {
      this.bank.rotation.y += (0 - wrapPI(this.bank.rotation.y)) * Math.min(1, dt * 8);
    }
    if (this.mixer) this.mixer.update(dt);
    if (this.kicking) {
      const a = this.actions.flip;
      if (a.time >= KICK.peak) a.timeScale = KICK.slow;
      if (a.time >= a.getClip().duration - KICK.blendOut || !a.isRunning()) {
        this.kicking = false;
        a.fadeOut(KICK.blendOut);
        this.actions.ride.reset().fadeIn(KICK.blendOut).play();
      }
    }
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
