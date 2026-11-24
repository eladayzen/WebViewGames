// The 3D turtle: the same Raphael model the other games use (Mixamo rig), with
// every red on his texture -- mask, ribbons, wrist and knee wraps -- turned
// purple, which makes him Donatello. Faces +X, the run direction.
//
// ANIMATION: clips.json holds three.js AnimationClips for this rig. A clip
// named `run` is used when present (CC0 Quaternius clips retargeted by ShellSiege
// tools/make-rival.mjs: run, jog, roll, jump_*); otherwise a sped-up walk stands in.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER } from '../game/constants.js';

const PURPLE_HUE = 272 / 360;

/** Every saturated red pixel -> the same lightness and saturation, purple hue. */
function recolorRedToPurple(image) {
  const c = document.createElement('canvas');
  c.width = image.width; c.height = image.height;
  const g = c.getContext('2d');
  g.drawImage(image, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i] / 255, gg = a[i + 1] / 255, b = a[i + 2] / 255;
    const max = Math.max(r, gg, b), min = Math.min(r, gg, b);
    if (max !== r) continue;                       // red must dominate
    const l = (max + min) / 2, dd = max - min;
    if (dd < 0.18) continue;
    const s = dd / (1 - Math.abs(2 * l - 1));
    let h = ((gg - b) / dd) / 6; if (h < 0) h += 1;
    if (!(h > 0.93 || h < 0.04) || s < 0.4) continue;
    // HSL -> RGB with the new hue, lightness nudged up a little (purple reads darker)
    const L = Math.min(0.85, l * 1.08), S = Math.min(1, s * 0.85);
    const q = L < 0.5 ? L * (1 + S) : L + S - L * S, pp = 2 * L - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
    a[i] = f(PURPLE_HUE + 1 / 3) * 255; a[i + 1] = f(PURPLE_HUE) * 255; a[i + 2] = f(PURPLE_HUE - 1 / 3) * 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}

export class Turtle {
  constructor(scene) {
    this.root = new THREE.Group();      // at the turtle's feet, in world space
    this.body = new THREE.Group();      // squash, tilt, spin
    this.root.add(this.body);
    scene.add(this.root);
    this.mixer = null; this.run = null;
    this.spin = 0;
  }

  async load(url, clipsUrl) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    const k = PLAYER.H / (box.max.y - box.min.y);
    const holder = new THREE.Group();
    holder.add(model);
    holder.scale.setScalar(k);
    holder.position.y = this.holderY = -box.min.y * k;
    holder.rotation.y = Math.PI / 2 - 0.45;            // Mixamo faces +Z; run is +X, turned a little toward the camera so we see his face, not just shell
    let tex = null;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const m = o.material;
      if (m.map && !tex) {
        tex = new THREE.CanvasTexture(recolorRedToPurple(m.map.image));
        tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = m.map.flipY;
        tex.anisotropy = 4;
      }
      o.material = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x4a3222 });
    });
    this.body.add(holder);
    this.model = model;

    const clips = await (await fetch(clipsUrl)).json();
    this.mixer = new THREE.AnimationMixer(model);
    // AnimationClip.parse wants userData as a JSON *string*; accept an object too
    for (const c of Object.values(clips)) if (c.userData && typeof c.userData !== 'string') c.userData = JSON.stringify(c.userData);
    const act = (name) => clips[name] ? this.mixer.clipAction(THREE.AnimationClip.parse(clips[name])) : null;
    const pick = clips.run ? 'run' : clips.walk_mutant ? 'walk_mutant' : Object.keys(clips)[0];
    this.placeholder = pick !== 'run';
    this.run = act(pick);
    this.runRate = this.placeholder ? 2.0 : 1.0;
    // CC0 clips retargeted onto this rig (Quaternius, via ShellSiege's make-rival)
    this.idleA = act('idle2');
    this.rollA = act('roll');
    this.airA = act('jump_loop');
    for (const a of [this.rollA, this.airA, this.idleA]) if (a) { a.enabled = true; a.setEffectiveWeight(0); a.play(); }
    if (this.rollA) { this.rollA.setLoop(THREE.LoopOnce); this.rollA.clampWhenFinished = true; }
    this.run.play();
    this.cur = this.run;
  }

  /** Cross-fade to one action (the others fade out). */
  fade(to, s) {
    if (!to || to === this.cur) return;
    to.enabled = true; to.setEffectiveWeight(1);
    to.crossFadeFrom(this.cur, s, false);
    this.cur = to;
  }

  /** Per frame: place him and pose him from the runner state. */
  update(dt, p, time) {
    this.root.position.set(p.x, p.y, 0);
    if (!this.mixer) return;
    // the run cycle follows ground speed; slow-mo in the air
    const rolling = false;                                        // (no roll any more)
    if (p.still && this.idleA) this.fade(this.idleA, 0.2);       // standing in place: no running
    else if (rolling && this.rollA) {
      if (this.cur !== this.rollA || p.rollT < this.lastRollT) {        // (re)start the roll
        this.rollA.reset(); this.rollA.timeScale = this.rollA.getClip().duration / PLAYER.ROLL_S;
        this.fade(this.rollA, 0.06);
      }
    } else if (!p.grounded && this.airA && p.airT > 0.08) this.fade(this.airA, 0.15);
    else this.fade(this.run, this.cur === this.rollA ? 0.12 : 0.1);
    this.lastRollT = p.rollT;
    const rate = p.still ? 1 : !this.placeholder ? (p.speed / 11) : p.grounded ? this.runRate * (p.speed / 10) : 0.25;
    this.run.timeScale += (rate - this.run.timeScale) * Math.min(1, dt * 12);
    this.mixer.update(dt);
    // air: a forward tuck and a small flip on big jumps; land: squash
    const air = !p.grounded;
    const pitch = air ? THREE.MathUtils.clamp(-p.vy * 0.03, -0.35, 0.35) : this.placeholder ? -0.08 * (p.speed / 10) : 0;
    this.pitch = (this.pitch || 0) + (pitch - (this.pitch || 0)) * Math.min(1, dt * 10);
    // a stomp bounces him into a forward somersault (about his middle);
    // the attack roll is a tucked ground roll (placeholder until the roll clip)
    const rollK = -1;
    const pivot = rollK >= 0 ? PLAYER.H * 0.32 : PLAYER.H / 2;
    this.spin = rollK >= 0 ? -Math.PI * 2 * (1 - (1 - rollK) * (1 - rollK))
      : p.stompT < 0.45 ? -Math.PI * 2 * (p.stompT / 0.45)
      : p.doubleT < 0.5 ? -Math.PI * 2 * (1 - (1 - p.doubleT / 0.5) ** 2) : 0;   // double jump: a front flip
    this.body.position.y = this.spin ? pivot : 0;
    this.body.children[0].position.y = this.spin ? this.holderY - pivot : this.holderY;
    this.body.rotation.z = this.pitch + this.spin;
    const tuck = rollK >= 0 ? 0.38 * Math.sin(Math.min(1, rollK * 1.15) * Math.PI) : 0;
    const sq = (p.landT < 0.12 ? 1 - 0.18 * Math.sin((p.landT / 0.12) * Math.PI) : 1) * (1 - tuck);
    this.body.scale.set(1 + (1 - sq) * 0.5, sq, 1 + (1 - sq) * 0.5);
    // hurt blink
    const blink = p.invuln > 0 && p.freeze <= 0 && Math.sin(time * 40) > 0.3;
    this.body.visible = !blink;
  }
}
