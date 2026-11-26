// Donatello: the shared Raphael rig with every red turned purple, a tech backpack on his spine, and cyber wings
// that unfold out of it. Two poses: RUN (upright on the deck) and GLIDE (face-down under the wings).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { recolorRedToPurple, easeOutBack, clamp, damp } from './util.js';

export const RIDER_H = 1.75;
export const HIP = 0.95;
const UPPER_BODY = /Spine1|Spine2|Neck|Head|Shoulder|Arm|Hand/;
// attack clips (attacks.json, numbered 1..10) with the cut points tuned in Sewer Shred
const ATTACKS = { 1: { start: 0.4, speed: 1.3 }, 5: { start: 0.15, speed: 1.5 }, 8: { start: 0, speed: 1.4 } };
const THROW = { clip: 7, start: 0.45, release: 0.8, end: 1.35, speed: 1.8, fadeIn: 0.07, fadeOut: 0.12, weight: 12 };
const THROW_DUR = (THROW.end - THROW.start) / THROW.speed;
export const THROW_RELEASE = (THROW.release - THROW.start) / THROW.speed;

const ink = new THREE.MeshBasicMaterial({ color: 0x101214, side: THREE.BackSide });

export class Rider {
  constructor(scene) {
    this.root = new THREE.Group();             // feet position + yaw
    this.pivot = new THREE.Group();            // hip: pitch / roll / prone
    this.pivot.rotation.order = 'ZXY';
    this.pivot.position.y = HIP;
    this.root.add(this.pivot);
    scene.add(this.root);
    this.prone = 0; this.deploy = 0; this.deployTarget = 0; this.flutter = 0;
    this.actions = {}; this.cur = null;
    this.throwT = -1; this.attackOn = null; this.atkIdx = 0;
  }

  async load(modelUrl, clipsUrl, runUrl, attacksUrl) {
    const gltf = await new GLTFLoader().loadAsync(modelUrl);
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    const k = RIDER_H / (box.max.y - box.min.y);
    this.holder = new THREE.Group(); this.holder.add(model);
    this.holder.scale.setScalar(k);
    this.holder.position.y = -box.min.y * k - HIP;
    this.holder.rotation.y = Math.PI;          // Mixamo faces +Z; the run is down -Z, so show his shell
    this.pivot.add(this.holder);
    this.model = model;
    let tex = null;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const m = o.material;
      if (m.map && !tex) {
        tex = new THREE.CanvasTexture(recolorRedToPurple(m.map.image));
        tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = m.map.flipY; tex.anisotropy = 4;
      }
      o.material = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x4a3222, emissiveMap: tex, emissiveIntensity: 0.3 });
    });
    this.hand = model.getObjectByName('mixamorigRightHand');

    // ── animation ──
    const fix = (c) => { if (c.userData && typeof c.userData !== 'string') c.userData = JSON.stringify(c.userData); return c; };
    const rj = await (await fetch(runUrl)).json();
    const cj = await (await fetch(clipsUrl)).json();
    this.mixer = new THREE.AnimationMixer(model);
    const act = (json) => this.mixer.clipAction(THREE.AnimationClip.parse(fix(json)));
    this.actions.run = act(rj.run);
    this.actions.idle = act(rj.idle2);
    this.actions.air = act(rj.jump_loop);
    this.actions.roll = act(rj.roll);
    this.actions.roll.setLoop(THREE.LoopOnce, 1); this.actions.roll.clampWhenFinished = true;
    this.actions.ride = act(cj.ride);
    for (const a of Object.values(this.actions)) { a.enabled = true; a.setEffectiveWeight(0); a.play(); }
    this.cur = this.actions.run; this.cur.setEffectiveWeight(1);
    const list = await (await fetch(attacksUrl)).json();
    this.attacks = {};
    for (const n of Object.keys(ATTACKS)) {
      const a = act(list[n - 1]); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
      this.attacks[n] = { action: a, end: list[n - 1].duration, ...ATTACKS[n] };
    }
    const tj = fix(list[THROW.clip - 1]);
    const tclip = THREE.AnimationClip.parse(tj); tclip.tracks = tclip.tracks.filter((t) => UPPER_BODY.test(t.name));
    this.throwAct = this.mixer.clipAction(tclip); this.throwAct.timeScale = 0;

    this._buildPack(model, k);
    this._buildStaff(k);
  }

  _buildPack(model, k) {
    const lit = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
    const pack = new THREE.Group();
    const shell = (geo, mat, kk = 1.07) => { const g = new THREE.Group(); g.add(new THREE.Mesh(geo, mat)); const o = new THREE.Mesh(geo, ink); o.scale.setScalar(kk); g.add(o); return g; };
    const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    pack.add(shell(bx(0.46, 0.52, 0.22), lit(0x6d5b9a, 0x1a1428)));
    const flap = shell(bx(0.48, 0.15, 0.25), lit(0x4b3f70, 0x120e1e)); flap.position.set(0, 0.22, 0.01); pack.add(flap);
    for (const sx of [-1, 1]) { const pl = shell(bx(0.1, 0.26, 0.16), lit(0x55497c, 0x140f20)); pl.position.set(sx * 0.29, -0.08, 0); pack.add(pl); }
    const screen = new THREE.Mesh(bx(0.24, 0.14, 0.02), new THREE.MeshBasicMaterial({ color: 0x5ff2ff })); screen.position.set(0, -0.04, 0.12); pack.add(screen);
    this.packScreen = screen;
    const bone = model.getObjectByName('mixamorigSpine2') || model.getObjectByName('mixamorigSpine1');
    this.holder.updateMatrixWorld(true); this.root.updateMatrixWorld(true);
    const kw = bone.getWorldScale(new THREE.Vector3()).x;
    bone.add(pack);
    pack.scale.setScalar(1.15 / kw);
    pack.position.set(0, -0.05 / kw, -0.33 / kw);
    pack.rotation.set(0, Math.PI, 0);        // its +Z points out of his back
    this.pack = pack;

    // ── the wings: a fan of dark blades with a glowing energy membrane, hinged on the pack ──
    const wings = new THREE.Group(); wings.position.set(0, 0.2, 0.14); pack.add(wings); this.wings = wings;
    this.blades = [];
    const lens = [2.15, 1.95, 1.7, 1.4], spread = [0.05, -0.2, -0.45, -0.72];
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0x2a3158, emissive: 0x141a38 });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x5ff2ff });
    const memMat = new THREE.MeshBasicMaterial({ color: 0x35c8ff, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
    this.sides = [];
    for (const sx of [1, -1]) {
      const side = new THREE.Group(); side.scale.x = sx; wings.add(side); this.sides.push(side);
      const bl = [];
      lens.forEach((L, i) => {
        const sh = new THREE.Shape(); sh.moveTo(0, -0.05); sh.lineTo(L * 0.82, -0.07); sh.lineTo(L, -0.015); sh.lineTo(L * 0.82, 0.075); sh.lineTo(0, 0.1); sh.closePath();
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: false });
        const grp = new THREE.Group();
        const mesh = new THREE.Mesh(g, bladeMat); const oi = new THREE.Mesh(g, ink); oi.scale.set(1.01, 1.7, 1.8); oi.position.z = -0.02;
        const es = new THREE.Mesh(new THREE.BoxGeometry(L * 0.8, 0.018, 0.045), edgeMat); es.position.set(L * 0.41, 0.075, 0.02);
        grp.add(oi, mesh, es); side.add(grp); bl.push({ grp, spread: spread[i], len: L, delay: i * 0.07 });
      });
      // membrane triangle fan between the first and last blade
      const mem = new THREE.Mesh(new THREE.BufferGeometry(), memMat); side.add(mem); this.sides[this.sides.length - 1].mem = mem;
      this.blades.push(bl);
    }
    wings.visible = false;
    this._wingsAt(0, 0);
  }

  _buildStaff(k) {
    const staff = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x9a6a36, emissive: 0x2a1808 });
    const cap = new THREE.MeshLambertMaterial({ color: 0x7e56c4, emissive: 0x20103a });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 8), wood);
    const o = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 8), ink); o.scale.set(1.5, 1.01, 1.5);
    staff.add(o, body);
    for (const y of [-0.95, 0.95]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), cap); c.position.y = y; staff.add(c); }
    for (const y of [-0.3, 0.3]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), cap); w.position.y = y; staff.add(w); }
    staff.rotation.set(0, 0, Math.PI / 2);
    const holder = new THREE.Group(); holder.add(staff);
    const kw = this.hand.getWorldScale(new THREE.Vector3()).x;
    holder.scale.setScalar(1 / kw);
    this.hand.add(holder);
    this.staff = holder; this.staffInner = staff;
  }

  // wings fan out with a little overshoot; d in 0..1
  _wingsAt(d, time) {
    const w = this.wings;
    if (!w) return;
    w.visible = d > 0.01;
    const sc = Math.max(0.0001, d);
    for (let s = 0; s < 2; s++) {
      const side = this.sides[s];
      const pts = [];
      this.blades[s].forEach((b, i) => {
        const t = clamp((d - b.delay) / (1 - b.delay * 1.6), 0, 1);
        const e = easeOutBack(t);
        const fold = -Math.PI / 2 + 0.1;                      // folded: flat down the back
        const open = b.spread + Math.sin(time * 5.2 + i + s) * 0.018 * this.flutter;
        b.grp.rotation.z = fold + (open - fold) * e;
        b.grp.scale.set(0.2 + 0.8 * e, 1, 1);
        b.grp.position.z = i * 0.012;
        const a = b.grp.rotation.z, L = b.len * (0.2 + 0.8 * e);
        pts.push([Math.cos(a) * L, Math.sin(a) * L]);
      });
      // membrane: root -> blade tips -> root
      const verts = [];
      for (let i = 0; i < pts.length - 1; i++) verts.push(0, 0, 0.02, pts[i][0], pts[i][1], 0.02, pts[i + 1][0], pts[i + 1][1], 0.02);
      side.mem.geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      side.mem.geometry.computeBoundingSphere();
      side.mem.visible = d > 0.25;
    }
    w.scale.setScalar(0.35 + 0.65 * Math.min(1, sc * 1.4));
    this.packScreen.material.color.setHex(d > 0.5 ? 0x9fffe8 : 0x5ff2ff);
  }

  // ── animation switching ──
  fade(to, s = 0.15) {
    if (!to || to === this.cur) return;
    to.enabled = true; to.setEffectiveWeight(1);
    to.crossFadeFrom(this.cur, s, false);
    this.cur = to;
  }

  playThrow() {
    if (!this.throwAct || this.throwT >= 0) return false;
    this.throwT = 0;
    this.throwAct.reset(); this.throwAct.timeScale = 0; this.throwAct.setEffectiveWeight(0); this.throwAct.play();
    return true;
  }
  get throwing() { return this.throwT >= 0; }
  get busy() { return !!this.attackOn; }

  playMelee() {
    if (this.attackOn) return false;
    const order = [8, 1, 5, 8];
    const n = order[this.atkIdx++ % order.length];
    const at = this.attacks[n];
    const a = at.action;
    a.reset(); a.time = at.start; a.timeScale = at.speed; a.setEffectiveWeight(1); a.fadeIn(0.08).play();
    this.cur.fadeOut(0.08);
    this.attackOn = at;
    return true;
  }

  handWorld(out) { return this.hand ? this.hand.getWorldPosition(out) : out.copy(this.root.position); }

  /** mode: 'run' | 'glide'. d = wing deploy target */
  setMode(mode) {
    this.mode = mode;
    this.deployTarget = mode === 'glide' ? 1 : 0;
    this.staff.visible = mode !== 'glide';
  }

  /** pose: { yaw, pitch, roll } */
  update(dt, time, pose, runRate = 1) {
    const want = this.mode === 'glide' ? 1 : 0;
    this.prone = damp(this.prone, want, this.mode === 'glide' ? 7 : 6, dt);
    this.deploy = damp(this.deploy, this.deployTarget, this.deployTarget > this.deploy ? 4.2 : 5, dt);
    if (this.deployTarget === 1 && this.deploy > 0.985) this.deploy = 1;
    if (this.deployTarget === 0 && this.deploy < 0.01) this.deploy = 0;
    this.flutter = this.deploy;
    this._wingsAt(this.deploy, time);
    const p = this.prone;
    this.root.rotation.y = pose.yaw;
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.rotation.x = -Math.PI / 2 * p + pose.pitch * p;
    this.pivot.rotation.z = pose.roll * p;
    // animation: glide uses the air pose, run uses the run cycle (unless an attack / roll is playing)
    if (!this.attackOn) {
      if (this.mode === 'glide') this.fade(this.actions.air, 0.2);
      else if (this.rolling) { /* roll plays itself, handed back below */ }
      else this.fade(this.actions.run, 0.12);
    }
    this.actions.run.timeScale = damp(this.actions.run.timeScale, runRate, 10, dt);
    // upper-body throw envelope
    if (this.throwT >= 0 && this.throwAct) {
      this.throwT += dt;
      const t = this.throwT;
      if (t >= THROW_DUR) { this.throwT = -1; this.throwAct.setEffectiveWeight(0); this.throwAct.stop(); }
      else {
        const w = Math.min(1, t / THROW.fadeIn, (THROW_DUR - t) / THROW.fadeOut);
        this.throwAct.time = THROW.start + t * THROW.speed;
        this.throwAct.setEffectiveWeight(Math.max(0, w) * THROW.weight);
      }
    }
    this.mixer.update(dt);
    const at = this.attackOn;
    if (at && (at.action.time >= at.end - 0.02 || !at.action.isRunning())) {
      at.action.fadeOut(0.15);
      this.cur = this.actions.run; this.actions.run.reset().fadeIn(0.15).play(); this.actions.run.setEffectiveWeight(1);
      this.attackOn = null;
    }
    if (this.rolling && !this.actions.roll.isRunning()) { this.rolling = false; this.cur = this.actions.roll; this.fade(this.actions.run, 0.15); }
  }

  playRoll() {
    const r = this.actions.roll;
    r.reset(); r.timeScale = 1.6; r.setEffectiveWeight(1); r.fadeIn(0.08).play();
    this.cur.fadeOut(0.08); this.cur = r; this.rolling = true;
  }
}
