// Subway trains (Elad 2026-11-16: "it does not make sense that the subway will
// have the obstacles we have in the sewer - maybe some kind of train that's
// running towards me every now and then"). The subway's whole game: a train
// comes up the rails at you, headlights first out of the fog, horn blaring;
// ride up the wall to let it by. A near miss pays.
//
// Trains run on the rails at θ = 0 and follow the tube's curve car by car.
import * as THREE from 'three';
import { R, frameAt, pointAt, wallQuat, worldAt, nextVisitEnd, angleDiff } from './track.js';

const CARS = 3, CAR_LEN = 12, CAR_GAP = 0.8;
const HALF_W = 2.5, H = 3.4;                  // metres
const SPEED = 14;                            // toward the rider, m/s
const SPAWN_AHEAD = 240;
const GAP = [150, 230];                      // metres of rider travel between trains
const HIT_HALF_W = HALF_W + 0.3;
export const TRAIN_LEN = CARS * (CAR_LEN + CAR_GAP);

export class Trains {
  constructor(scene, makeGlowTexture) {
    this.scene = scene;
    const ink = new THREE.MeshBasicMaterial({ color: 0x14161a, side: THREE.BackSide });
    const body = new THREE.MeshLambertMaterial({ color: 0xc9d0d4, emissive: 0x2a2e31 });
    const band = new THREE.MeshLambertMaterial({ color: 0x3fae3a, emissive: 0x0c2a0a });     // line colour
    const glass = new THREE.MeshLambertMaterial({ color: 0x1d2a33, emissive: 0x0a1218 });
    const lamp = new THREE.MeshBasicMaterial({ color: 0xfff6d0 });
    const sign = new THREE.MeshBasicMaterial({ color: 0xffb21e });
    const glowMat = new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xfff0c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const box = (w, h, l, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, l), m);

    this.pool = [];
    for (let t = 0; t < 2; t++) {
      const cars = [];
      for (let c = 0; c < CARS; c++) {
        const g = new THREE.Group();
        const shell = box(HALF_W * 2, H, CAR_LEN, body);
        const hull = box(HALF_W * 2 + 0.16, H + 0.16, CAR_LEN + 0.16, ink);   // cartoon ink outline
        const stripe = box(HALF_W * 2 + 0.04, 0.45, CAR_LEN - 0.4, band); stripe.position.y = -0.35;
        const win = box(HALF_W * 2 + 0.04, 0.9, CAR_LEN - 1.6, glass); win.position.y = 0.75;
        g.add(hull, shell, stripe, win);
        if (c === 0) {
          // the face (+Z, toward the rider): windscreen, sign, two headlights + glow
          const face = box(HALF_W * 1.6, 1.1, 0.06, glass); face.position.set(0, 0.7, CAR_LEN / 2 + 0.03);
          const sg = box(1.6, 0.35, 0.06, sign); sg.position.set(0, 1.45, CAR_LEN / 2 + 0.04);
          g.add(face, sg);
          for (const x of [-1.6, 1.6]) {
            const l = new THREE.Mesh(new THREE.CircleGeometry(0.28, 14), lamp);
            l.position.set(x, -0.9, CAR_LEN / 2 + 0.05);
            const sp = new THREE.Sprite(glowMat); sp.scale.set(5, 5, 1); sp.position.copy(l.position).z += 0.3;
            g.add(l, sp);
          }
        }
        g.visible = false;
        scene.add(g);
        cars.push(g);
      }
      this.pool.push({ cars, on: false, s: 0, warned: false, passed: false, hit: false });
    }
    this.q = new THREE.Quaternion();
    this.reset();
  }

  reset() {
    for (const t of this.pool) { t.on = false; t.cars.forEach((c) => (c.visible = false)); }
    this.nextS = null;
  }

  /** events: { type: 'warn' | 'hit' | 'pass', close?, s } */
  update(dt, player, events, active = true) {
    const ps = player.s;
    // schedule: while the rider is down in a train world; the subway is a short
    // moment, so the first train comes soon and every train stays inside it
    const here = !!worldAt(ps).trains;
    if (here && this.nextS === null) this.nextS = ps + 25;
    if (!here) this.nextS = null;
    if (active && here && this.nextS !== null && ps >= this.nextS) {
      const end = nextVisitEnd();                      // the ramp back up
      const at = Math.min(ps + SPAWN_AHEAD, end - TRAIN_LEN - 5);
      const free = this.pool.find((t) => !t.on);
      if (free && at > ps + 90) Object.assign(free, { on: true, s: at, warned: false, passed: false, hit: false });
      this.nextS = ps + GAP[0] + Math.random() * (GAP[1] - GAP[0]);
    }
    const thRel = angleDiff(player.theta, 0);
    const x = Math.abs(R * Math.sin(thRel)), y = R * (1 - Math.cos(thRel));
    for (const t of this.pool) {
      if (!t.on) continue;
      t.s -= SPEED * dt;
      const front = t.s, back = t.s + TRAIN_LEN;
      if (back < ps - 15) { t.on = false; t.cars.forEach((c) => (c.visible = false)); continue; }
      if (!t.warned && front - ps < 150) { t.warned = true; events.push({ type: 'warn', s: front }); }
      // collision: the rider is inside the train's body
      if (active && !t.hit && ps > front - 0.6 && ps < back && x < HIT_HALF_W && y < H + 0.4) {
        t.hit = true; events.push({ type: 'hit', s: ps });
      }
      if (!t.passed && back < ps) {
        t.passed = true;
        if (!t.hit) events.push({ type: 'pass', close: Math.abs(thRel) < 0.95, s: ps });
      }
      this._place(t);
    }
  }

  _place(t) {
    for (let c = 0; c < CARS; c++) {
      const g = t.cars[c];
      const sc = t.s + c * (CAR_LEN + CAR_GAP) + CAR_LEN / 2;
      const f = frameAt(sc);
      pointAt(sc, 0, R - H / 2 - 0.15, g.position, f);
      wallQuat(f, 0, g.quaternion);
      // wallQuat's +Z points back up the pipe (at the rider): the face is +Z
      g.visible = true;
    }
  }
}
