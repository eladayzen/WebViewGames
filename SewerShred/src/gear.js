// Donnie's gear (Elad 2026-11-23: "add a backpack to Mikey — gear from Donnie … new
// ability — a hang glider, just fly in the middle; robotic arms with disc saws").
//
// All of it is simple shapes + ink hulls (0 credits), on the rider's bank so it
// leans with him:
//   backpack — always on once a level hands out gear
//   GLIDER   — a delta wing pops out; he lifts off the wall to fly near the
//              pipe's middle for GLIDE_T s, over everything (nothing hits up there),
//              through a line of pizza laid at that height
//   SAWS     — two arms fold out of the pack with spinning discs for SAW_T s;
//              whatever is in the lane just ahead is cut (Foot get knocked flying)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const GLIDE_T = 5.5;     // s in the air
export const GLIDE_H = 2.6;     // metres off the wall (R = 6: a good way toward the axis)
export const SAW_T = 12;        // s of saws (Elad 2026-11-23: longer)
const SAW_REACH = [-0.6, 5.5];  // metres along the pipe, from the rider
const SAW_SIDE = 0.62;          // rad either side of the rider

const ink = new THREE.MeshBasicMaterial({ color: 0x101214, side: THREE.BackSide });
function inked(geo, mat, k = 1.12) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  const o = new THREE.Mesh(geo, ink); o.scale.setScalar(k); g.add(o);
  return g;
}
const flat = (c) => new THREE.MeshBasicMaterial({ color: c });

export class Gear {
  constructor(player, sawTex) {
    this.player = player;
    const bank = player.bank;
    // ── backpack (Elad 2026-11-23: "lose the antenna bulb; the bag should be a 3D
    // object, parented to Mikey's back") — a rounded, shaded tech pack: body, flap,
    // two side pouches, a green screen and bolts. It rides on his spine bone
    // (attach(), once the model is loaded), so it moves with every animation.
    this.pack = new THREE.Group();
    const lit = (c, e = 0x000000) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
    const shell = (geo, mat, k = 1.07) => { const g = new THREE.Group(); g.add(new THREE.Mesh(geo, mat)); const o = new THREE.Mesh(geo, ink); o.scale.setScalar(k); g.add(o); return g; };
    const body = shell(new RoundedBoxGeometry(0.46, 0.52, 0.24, 3, 0.07), lit(0x6d5b9a, 0x1a1428));
    const flap = shell(new RoundedBoxGeometry(0.48, 0.17, 0.27, 3, 0.06), lit(0x4b3f70, 0x120e1e)); flap.position.set(0, 0.22, 0.01);
    const pl = shell(new RoundedBoxGeometry(0.11, 0.26, 0.16, 2, 0.04), lit(0x55497c, 0x140f20)); pl.position.set(-0.29, -0.08, 0);
    const pr = pl.clone(); pr.position.x = 0.29;
    const screen = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.15, 0.02, 2, 0.02), new THREE.MeshBasicMaterial({ color: 0x9fe04a }));
    screen.position.set(0, -0.04, 0.125);
    this.pack.add(body, flap, pl, pr, screen);
    for (const x of [-0.17, 0.17]) for (const y of [-0.2, 0.12]) {
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), lit(0xc8ccd4, 0x333333)); bolt.position.set(x, y, 0.125); this.pack.add(bolt);
    }
    // until the model is in, sit it where his back is in the riding crouch
    this.pack.position.set(0, 1.02, 0.3);
    this.pack.rotation.x = -0.25;
    this.pack.visible = false;
    bank.add(this.pack);

    // ── glider: a delta wing over his head, tip pointing downstream (-Z) ──
    this.wing = new THREE.Group();
    const span = 2.3, chord = 1.25;
    const sh = new THREE.Shape();
    sh.moveTo(0, -chord * 0.62); sh.lineTo(span / 2, chord * 0.38); sh.lineTo(0, chord * 0.18); sh.lineTo(-span / 2, chord * 0.38); sh.closePath();
    const sail = new THREE.ShapeGeometry(sh);
    sail.rotateX(Math.PI / 2);        // lie flat, its +Y = the bank's -Z (downstream)
    const sailMat = new THREE.MeshBasicMaterial({ color: 0x7b4fc4, side: THREE.DoubleSide });
    const sailInk = new THREE.Mesh(sail, new THREE.MeshBasicMaterial({ color: 0x101214, side: THREE.DoubleSide }));
    sailInk.scale.setScalar(1.07); sailInk.position.y = -0.01;
    // a yellow stripe down the middle
    const st = new THREE.Shape();
    st.moveTo(0, -chord * 0.62); st.lineTo(0.22, chord * 0.1); st.lineTo(0, chord * 0.18); st.lineTo(-0.22, chord * 0.1); st.closePath();
    const stripe = new THREE.ShapeGeometry(st); stripe.rotateX(Math.PI / 2);
    const stripeM = new THREE.Mesh(stripe, new THREE.MeshBasicMaterial({ color: 0xffcf3a, side: THREE.DoubleSide })); stripeM.position.y = 0.01;
    // the A-frame he hangs from
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.75, 6), flat(0x202326));
    bar.position.set(0, -0.35, 0);
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), flat(0x202326));
    cross.rotation.z = Math.PI / 2; cross.position.set(0, -0.7, -0.1);
    this.wing.add(sailInk, new THREE.Mesh(sail, sailMat), stripeM, bar, cross);
    this.wing.position.set(0, 1.85, 0.15);
    this.wing.rotation.x = 0.45;      // tipped toward the chase camera, so the sail reads from behind
    this.wing.visible = false;
    bank.add(this.wing);

    // ── saw arms: out of the pack, forward and to each side, a blade on each ──
    // The blade is Wagon Rampage's (Elad 2026-11-23: "the car game also has cool 3d
    // saws"): an extruded toothed steel disc with slots so the spin reads, angled so
    // the chase camera sees its face, and a rim that glows hot while it cuts.
    void sawTex;
    const SR = 0.46, teeth = 20, R0 = SR * 0.86;
    const sh2 = new THREE.Shape();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2, a1 = ((i + 0.62) / teeth) * Math.PI * 2;
      if (i === 0) sh2.moveTo(Math.cos(a0) * R0, Math.sin(a0) * R0); else sh2.lineTo(Math.cos(a0) * R0, Math.sin(a0) * R0);
      sh2.lineTo(Math.cos(a1) * SR, Math.sin(a1) * SR);
    }
    sh2.closePath();
    const hole = new THREE.Path(); hole.absarc(0, 0, 0.07, 0, Math.PI * 2, true); sh2.holes.push(hole);
    const bladeGeo = new THREE.ExtrudeGeometry(sh2, { depth: 0.03, bevelEnabled: false }); bladeGeo.translate(0, 0, -0.015);
    const steel = new THREE.MeshLambertMaterial({ color: 0xd8dde6, emissive: 0x3a3e46 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x34373f, emissive: 0x111214 });
    this.rimMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      const seg = inked(new THREE.CylinderGeometry(0.06, 0.06, 1.25, 8), flat(0x8a93a0), 1.25);
      seg.rotation.z = side * 1.05; seg.position.set(side * 0.5, 0.25, -0.2);
      const joint = inked(new THREE.SphereGeometry(0.1, 10, 8), flat(0x6a5a8e), 1.15); joint.position.set(side * 1.05, -0.05, -0.45);
      const head = new THREE.Group();
      head.position.set(side * 1.15, -0.1, -0.95);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 12), dark); hub.rotation.z = Math.PI / 2; head.add(hub);
      const tilt = new THREE.Group(); tilt.rotation.y = side * 0.45; head.add(tilt);   // its face toward the camera
      const spin = new THREE.Group(); spin.rotation.y = Math.PI / 2; tilt.add(spin);
      spin.add(new THREE.Mesh(bladeGeo, steel));
      const bInk = new THREE.Mesh(bladeGeo, ink); bInk.scale.set(1.08, 1.08, 1.6); spin.add(bInk);
      for (let k = 0; k < 6; k++) {   // slots, so the spin reads
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.04), dark);
        const a = (k / 6) * Math.PI * 2; slot.position.set(Math.cos(a) * 0.23, Math.sin(a) * 0.23, 0); slot.rotation.z = a; spin.add(slot);
      }
      spin.add(new THREE.Mesh(new THREE.TorusGeometry(SR * 0.93, 0.04, 6, 40), this.rimMat));
      arm.add(seg, joint, head);
      arm.userData.disc = spin;
      arm.position.set(0, 1.0, 0.25);
      arm.visible = false;
      bank.add(arm);
      this.arms.push(arm);
    }
    this.reset();
  }

  /** Move the pack onto his spine bone (call once the rider model is loaded). */
  attach() {
    const p = this.player, bone = p.rig?.getObjectByName('mixamorigSpine2') || p.rig?.getObjectByName('mixamorigSpine1');
    if (!bone) return;
    p.bank.updateMatrixWorld(true);
    // the bone's own scale (glb root × model fit), relative to the bank the pack was sized in
    const k = bone.getWorldScale(new THREE.Vector3()).x / p.bank.getWorldScale(new THREE.Vector3()).x;
    bone.add(this.pack);
    this.pack.scale.setScalar(0.9 / k);
    // bone space: +Y up the spine, +Z out of his chest — the shell is -Z
    this.pack.position.set(0, -0.04 / k, -0.26 / k);
    this.pack.rotation.set(0, Math.PI, 0);   // its screen faces out, away from the shell
  }

  reset() {
    this.glideT = 0; this.sawT = 0; this.prone = 0;
    const p = this.player;
    if (p.model && this.baseY !== undefined) { p.model.rotation.x = 0; p.model.position.y = this.baseY; p.model.position.z = this.baseZ; }
    if (p.board) p.board.visible = true;
    this.wing.visible = false;
    for (const a of this.arms) a.visible = false;
  }

  set on(v) { this.pack.visible = !!v; }
  get gliding() { return this.glideT > 0; }
  get sawing() { return this.sawT > 0; }
  /** End whatever is running now (one ability at a time). */
  stop() {
    if (this.glideT > 0) { this.glideT = 0; this.wing.visible = false; this.player.hopV = 2; }
    if (this.sawT > 0) { this.sawT = 0; for (const a of this.arms) a.visible = false; }
  }

  startGlide() { this.glideT = GLIDE_T; this.wing.visible = true; this.wing.scale.setScalar(0.05); }
  startSaws() { this.sawT = SAW_T; for (const a of this.arms) { a.visible = true; a.scale.setScalar(0.05); } }

  /** After the rider's physics step, before he's placed. onCut(o) for each obstacle the saws reach. */
  update(dt, time, obstacles, onCut) {
    const p = this.player;
    // glide pose (Elad 2026-11-23: "when gliding Mikey should be lying flat, not
    // standing up"): face-down along the pipe, hung under the wing; the board stows
    const want = this.glideT > 0 ? 1 : 0;
    this.prone = (this.prone || 0) + (want - (this.prone || 0)) * Math.min(1, dt * 6);
    if (p.model) {
      if (this.baseY === undefined) this.baseY = p.model.position.y;
      p.model.rotation.x = -Math.PI / 2 * this.prone;      // tips him forward about his feet
      p.model.position.y = this.baseY + 0.45 * this.prone;
      p.model.position.z = (this.baseZ ??= p.model.position.z) + 0.55 * this.prone;   // centred under the sail
    }
    p.board.visible = this.prone < 0.5;
    this.wing.position.y = 1.85 - 0.4 * this.prone;
    // glide: rise to GLIDE_H and hold it; at the end gravity takes him back down
    if (this.glideT > 0) {
      this.glideT -= dt;
      p.hop += (GLIDE_H - p.hop) * Math.min(1, dt * 3);
      p.hopV = 0;
      const s = this.wing.scale.x;
      this.wing.scale.setScalar(s + (1 - s) * Math.min(1, dt * 8));
      if (this.glideT <= 0) { this.wing.visible = false; p.hopV = 2; }
    }
    if (this.sawT > 0) {
      this.sawT -= dt;
      for (const a of this.arms) {
        const s = a.scale.x;
        a.scale.setScalar(s + (1 - s) * Math.min(1, dt * 7));
        a.userData.disc.rotation.z -= dt * 30;
      }
      if (this.sawT <= 0) for (const a of this.arms) a.visible = false;
      this.hot = Math.max(0, (this.hot || 0) - dt * 2.5);
      this.rimMat.color.setRGB(3.2 * this.hot, 1.7 * this.hot, 0.5 * this.hot);
      for (const o of obstacles.list) {
        if (o.done || o.hit || o.collected || o.flying || o.sawn) continue;
        if (!CUTTABLE.has(o.type)) continue;
        const ds = o.s - p.s;
        if (ds < SAW_REACH[0] || ds > SAW_REACH[1]) continue;
        // poles run through the axis: reach them anywhere around
        const dth = Math.abs(Math.atan2(Math.sin(o.theta - p.theta), Math.cos(o.theta - p.theta)));
        if (o.type !== 'pole' && dth > SAW_SIDE) continue;
        o.sawn = true; this.cuts = (this.cuts || 0) + 1; this.hot = 1;
        onCut(o);
      }
    }
  }
}
const CUTTABLE = new Set(['foot', 'crate', 'saw', 'pipe', 'fan', 'valve', 'pole', 'cone', 'barrier', 'tire', 'prop']);
