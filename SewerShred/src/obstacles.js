// What's in the pipe: crates (some dropping from the ceiling), chord pipes,
// spinning fan bars, valve hatches — and pizza and shell-shields to grab.
//
// Everything is placed in tube coordinates (s, θ) and collides in tube
// coordinates. Patterns are authored as small functions so difficulty is a
// question of which patterns are in the deck and how tightly they're dealt.
import * as THREE from 'three';
import { R, frameAt, pointAt, wallQuat, wallDir, slimeAngle, angleDiff, makeGlowTexture } from './track.js';

const TAU = Math.PI * 2;
const BODY = 1.7 * 1.3;      // rider height (30% bigger) for chord-pipe clearance
const CRATE = 1.5;
const POLE_R = 0.42;
const SAW_R = 1.45;

export class Obstacles {
  constructor(scene, tex) {
    this.scene = scene;
    this.list = [];
    this.f = frameAt(0);
    this.pools = {};

    tex.crate.colorSpace = THREE.SRGBColorSpace;
    tex.pipe.colorSpace = THREE.SRGBColorSpace;
    tex.pipe.wrapS = tex.pipe.wrapT = THREE.RepeatWrapping;
    this.glowTex = makeGlowTexture();
    this.footGeo = tex.footGeo;
    this.footMat = makeFootMaterial();
    this.footOutlineMat = makeOutlineMaterial(0xff3fd0, 0.028);
    this.footAuraMat = new THREE.SpriteMaterial({ map: this.glowTex, color: 0xb03cff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 });
    this.poleMat = new THREE.MeshBasicMaterial({ map: makeStripeTexture() });
    this.sawGeo = makeSawGeometry(SAW_R, 22);
    // dark steel body; the teeth get a hot red edge from the rim shader below
    this.sawMat = makeSawMaterial();
    this.slotMat = new THREE.MeshBasicMaterial({ map: makeStripeTexture('#ffc21e', '#141414', 4) });
    this.capMat = new THREE.MeshBasicMaterial({ color: 0xff3b2a });
    this.capGlow = new THREE.SpriteMaterial({ map: this.glowTex, color: 0xff4a30, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 });

    this.mk = {
      crate: () => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(CRATE, CRATE, CRATE), new THREE.MeshLambertMaterial({ map: tex.crate, emissive: 0x150d05 }));
        return m;
      },
      pipe: () => {
        const g = new THREE.Group();
        const pipeTex = tex.pipe.clone(); pipeTex.repeat.set(1, 4); pipeTex.needsUpdate = true;
        const mat = new THREE.MeshLambertMaterial({ map: pipeTex, color: 0xb5c4b0, emissive: 0x101410 });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1, 14, 1, true), mat);
        g.add(body);
        const flMat = new THREE.MeshLambertMaterial({ color: 0x8a9298, emissive: 0x121416 });
        const fl = new THREE.CylinderGeometry(0.7, 0.7, 0.2, 14);
        const a = new THREE.Mesh(fl, flMat), b = new THREE.Mesh(fl, flMat);
        g.add(a, b);
        // a warning band so the pipe silhouette pops against the wall
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.5, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb21e }));
        g.add(band);
        g.userData = { body, a, b, band };
        return g;
      },
      saw: () => {
        // A spinning buzzsaw half-sunk in the wall, facing the rider: steel
        // teeth, a red warning hub, a hazard-striped slot and a pulsing red
        // glow. Nothing about it says "ride into me".
        const g = new THREE.Group();
        const blade = new THREE.Group();
        blade.add(new THREE.Mesh(this.sawGeo, this.sawMat));
        const hub = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), this.capMat);
        hub.position.z = 0.05; blade.add(hub);
        const hub2 = hub.clone(); hub2.position.z = -0.05; hub2.rotation.y = Math.PI; blade.add(hub2);
        g.add(blade);
        const slot = new THREE.Mesh(new THREE.BoxGeometry(SAW_R * 2.5, 0.22, 0.5), this.slotMat);
        slot.position.y = 0.06;
        g.add(slot);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xff2a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
        glow.scale.set(5.0, 5.0, 1);
        glow.position.set(0, 0.9, 0.3);
        g.add(glow);
        g.userData = { blade, glow };
        return g;
      },
      pole: () => {
        // A pole straight through the pipe's axis: it blocks exactly two spots
        // on the wall (its two ends), and you pass on either side of each.
        // Red/white hazard stripes + glowing end caps make the blocked spots
        // unmistakable from far away.
        const g = new THREE.Group();
        const bars = [];
        for (let i = 0; i < 2; i++) {
          const bar = new THREE.Group();
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(POLE_R, POLE_R, R * 2 - 0.1, 14, 1, true), this.poleMat);
          bar.add(shaft);
          for (const sgn of [-1, 1]) {
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(POLE_R * 1.9, POLE_R * 2.3, 0.35, 16), this.capMat);
            cap.position.y = sgn * (R - 0.2);
            bar.add(cap);
            const glow = new THREE.Sprite(this.capGlow);
            glow.scale.set(3.2, 3.2, 1);
            glow.position.y = sgn * (R - 0.45);
            bar.add(glow);
          }
          g.add(bar);
          bars.push(bar);
        }
        g.userData.bars = bars;
        return g;
      },
      fan: () => {
        const g = new THREE.Group();
        const mat = new THREE.MeshLambertMaterial({ color: 0x9aa3a0, emissive: 0x141a18 });
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 16), new THREE.MeshLambertMaterial({ color: 0xc0392b, emissive: 0x300a06 }));
        hub.rotation.x = Math.PI / 2;
        g.add(hub);
        const blades = new THREE.Group();
        for (let i = 0; i < 2; i++) {
          const bl = new THREE.Mesh(new THREE.BoxGeometry(0.5, R * 2 - 0.2, 0.35), mat);
          bl.rotation.z = i * Math.PI / 2;
          blades.add(bl);
          // hazard tips
          for (const sgn of [-1, 1]) {
            const tip = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.1, 0.4), new THREE.MeshBasicMaterial({ color: 0xffb21e }));
            tip.position.set(0, sgn * (R - 0.8), 0);
            bl.add(tip);
          }
        }
        g.add(blades);
        g.userData.blades = blades;
        return g;
      },
      valve: () => {
        const g = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.35, 16), new THREE.MeshLambertMaterial({ color: 0x6d777d, emissive: 0x0d0f10 }));
        base.position.y = 0.17;
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.11, 8, 18), new THREE.MeshLambertMaterial({ color: 0xd8402f, emissive: 0x3a0a05 }));
        wheel.rotation.x = Math.PI / 2; wheel.position.y = 0.55;
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), wheel.material);
        spoke.position.y = 0.55;
        const spoke2 = spoke.clone(); spoke2.rotation.y = Math.PI / 2;
        g.add(base, wheel, spoke, spoke2);
        g.userData.spin = [wheel, spoke, spoke2];
        return g;
      },
      pizza: () => {
        const g = new THREE.Group();
        const wedge = new THREE.Group();
        const cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 10, 1, false, -0.45, 0.9), new THREE.MeshBasicMaterial({ color: 0xffcf3a }));
        const crust = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.16, 10, 1, true, -0.45, 0.9), new THREE.MeshBasicMaterial({ color: 0xc8742a, side: THREE.DoubleSide }));
        wedge.add(cheese, crust);
        const pepMat = new THREE.MeshBasicMaterial({ color: 0xc62f1f });
        for (const [x, z] of [[0.1, 0.32], [-0.08, 0.45], [0.05, 0.18]]) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 8), pepMat);
          p.position.set(x, 0.06, z);
          wedge.add(p);
        }
        wedge.children.forEach((c) => (c.position.z -= 0.3));
        wedge.rotation.x = Math.PI / 2.4;
        g.add(wedge);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffa630, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75 }));
        glow.scale.set(2.1, 2.1, 1);
        g.add(glow);
        g.userData.wedge = wedge;
        return g;
      },
      foot: () => {
        // Foot Soldier, built to READ against a dark rusty pipe:
        //  - toon body with a strong key band and a hot magenta rim
        //  - a glowing magenta outline shell (inverted hull)
        //  - a burning red visor
        //  - a soft aura card behind him and a bright target ring underfoot
        const g = new THREE.Group();
        const body = new THREE.Group();
        const mesh = new THREE.Mesh(this.footGeo, this.footMat);
        const outline = new THREE.Mesh(this.footGeo, this.footOutlineMat);
        body.add(outline, mesh);
        body.scale.setScalar(2.6);   // 30% bigger
        g.add(body);
        const aura = new THREE.Sprite(this.footAuraMat);
        aura.scale.set(3.6, 4.4, 1);
        aura.position.y = 1.35;
        aura.renderOrder = -1;
        g.add(aura);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 1.0, 28), new THREE.MeshBasicMaterial({ color: 0xff4ad2, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
        g.add(ring);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), new THREE.MeshBasicMaterial({ color: 0xff4ad2, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
        disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04;
        g.add(disc);
        g.userData = { body, ring, aura };
        return g;
      },
      shield: () => {
        const g = new THREE.Group();
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 10, 0, TAU, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x4f8a2a, emissive: 0x1d3a0c }));
        shell.scale.y = 0.7;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 8, 20), new THREE.MeshLambertMaterial({ color: 0xe8c86a, emissive: 0x3a2a08 }));
        rim.rotation.x = Math.PI / 2;
        const inner = new THREE.Group(); inner.add(shell, rim);
        g.add(inner);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0x6fd0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
        glow.scale.set(2.8, 2.8, 1);
        g.add(glow);
        g.userData.wedge = inner;
        return g;
      },
    };
  }

  _get(type) {
    const pool = (this.pools[type] ||= []);
    const m = pool.pop() || this.mk[type]();
    m.visible = true;
    this.scene.add(m);
    return m;
  }

  _free(o) {
    o.mesh.visible = false;
    this.scene.remove(o.mesh);
    this.pools[o.type].push(o.mesh);
  }

  reset() {
    for (const o of this.list) this._free(o);
    this.list.length = 0;
    this.nextS = 70;
    this.lastShieldS = 0;
    this.patternCount = 0;
  }

  add(type, s, theta, extra = {}) {
    const o = { type, s, theta, hit: false, done: false, near: false, mesh: this._get(type), ...extra };
    if (type === 'foot') o.mesh.children.forEach((c) => (c.visible = true));  // pooled: undo the launch hiding
    this._placeStatic(o);
    this.list.push(o);
    return o;
  }

  _placeStatic(o) {
    const f = frameAt(o.s, this.f);
    const m = o.mesh;
    if (o.type === 'pipe') {
      // chord across the pipe at distance d from the axis, normal direction β
      const dir = wallDir(f, o.theta, new THREE.Vector3());
      const along = wallDir(f, o.theta + Math.PI / 2, new THREE.Vector3());
      const half = Math.sqrt(R * R - o.d * o.d);
      m.position.copy(f.C).addScaledVector(dir, o.d);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), along);
      const u = m.userData;
      u.body.scale.y = half * 2;
      u.a.position.y = half - 0.25; u.b.position.y = -half + 0.25;
      u.band.position.y = 0;
      o.arc = Math.acos(Math.min(0.999, o.d / (R - BODY)));
    } else if (o.type === 'fan' || o.type === 'pole') {
      m.position.copy(f.C);
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), f.T, f.U));
      if (o.type === 'pole') {
        // bar local +Y meets the wall at θ = angle + π (see fan derivation),
        // so rotate by beta − π to put an end exactly at θ = beta
        const [b0, b1] = m.userData.bars;
        b0.rotation.z = o.beta - Math.PI;
        b1.visible = o.n === 2;
        b1.rotation.z = o.beta - Math.PI + Math.PI / 2;
      }
    } else {
      const lift = o.type === 'crate' ? CRATE / 2 + (o.stack || 0) * CRATE : o.type === 'valve' || o.type === 'foot' || o.type === 'saw' ? 0 : 1.0;
      pointAt(o.s, o.theta, R - lift, m.position, f);
      wallQuat(f, o.theta, m.quaternion);
      if (o.type === 'foot') m.rotateY(Math.PI + (o.yaw || 0)); // face the rider coming up the pipe
      if (o.type === 'crate') {
        m.rotateY(o.yaw || 0);
        if (o.drop) { o.home = m.position.clone(); o.homeQ = m.quaternion.clone(); }
      }
    }
  }

  /** Deal patterns ahead of the player. */
  spawn(playerS, diff, playerTheta) {
    while (this.nextS < playerS + 210) {
      const s = this.nextS;
      const gap = THREE.MathUtils.lerp(34, 19, diff) + Math.random() * 8;
      this._pattern(s, diff, playerTheta);
      this.nextS += gap;
      this.patternCount++;
    }
  }

  _pattern(s, diff, pTheta) {
    const sl = slimeAngle(s);
    const r = Math.random();
    // shields: roughly every 450 m, never in the first 300
    if (s - this.lastShieldS > 450 && s > 300 && Math.random() < 0.5) {
      this.lastShieldS = s;
      this.add('shield', s, sl + (Math.random() - 0.5) * 1.2);
      return;
    }
    const deck = [
      ['crates', 0.35],
      ['pizzaLine', 0.8],
      ['pizzaArc', 0.45],
      ['pole', 1.3 + diff * 0.4],
      ['poleX', diff > 0.25 ? 0.5 + diff * 0.5 : 0],
      ['gate', diff > 0.3 ? 0.15 + diff * 0.2 : 0],
      ['dropper', 0.15 + diff * 0.2],
      ['slalom', diff > 0.2 ? 0.2 : 0],
      ['fan', diff > 0.35 ? 0.2 + diff * 0.5 : 0],

      ['valves', 0.35],
      ['foot', 2.6 + diff * 0.6],
      ['footLine', diff > 0.05 ? 1.0 : 0],
    ];
    const tot = deck.reduce((a, d) => a + d[1], 0);
    let pick = r * tot, name = 'crates';
    for (const [n, w] of deck) { pick -= w; if (pick <= 0) { name = n; break; } }
    this[`_p_${name}`](s, diff, sl);
  }

  _p_crates(s, diff, sl) {
    const n = 2 + Math.floor(Math.random() * (2 + diff * 3));
    const base = sl + (Math.random() - 0.5) * 1.5;
    for (let i = 0; i < n; i++) {
      const th = base + (Math.random() - 0.5) * 2.6;
      this.add('saw', s + (Math.random() - 0.5) * 6, th);
    }
    // a pizza between them as bait
    this.add('pizza', s, base);
  }

  _p_dropper(s, diff, sl) {
    const n = 1 + Math.floor(Math.random() * (1 + diff * 2));
    for (let i = 0; i < n; i++) {
      this.add('saw', s + i * 7, sl + (Math.random() - 0.5) * 1.2);
    }
  }

  _p_pizzaLine(s, diff, sl) {
    for (let i = 0; i < 7; i++) {
      const ss = s - 8 + i * 3.2;
      this.add('pizza', ss, slimeAngle(ss));
    }
  }

  _p_pizzaArc(s, diff, sl) {
    const side = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < 9; i++) {
      this.add('pizza', s - 10 + i * 2.6, side * (0.3 + i * 0.27));
    }
    // and a crate parked on the floor so the arc is the way round
    this.add('saw', s - 2, side * -0.25);
  }

  _p_chord(s, diff, sl) {
    this.add('pipe', s, Math.random() * TAU, { d: R * (0.38 + Math.random() * 0.15) });
  }

  _p_xpipe(s, diff, sl) {
    const b = Math.random() * TAU;
    this.add('pipe', s, b, { d: R * 0.45 });
    this.add('pipe', s + 1.2, b + Math.PI, { d: R * 0.45 });
  }

  _p_gate(s, diff, sl) {
    const gapAt = Math.random() * TAU;
    const gapHalf = THREE.MathUtils.lerp(0.75, 0.48, diff);
    const step = 0.36;
    for (let a = 0; a < TAU - 0.01; a += step) {
      if (Math.abs(angleDiff(a, gapAt)) < gapHalf) continue;
      this.add('saw', s, a);
    }
    this.add('pizza', s, gapAt);
    this.add('pizza', s + 3, gapAt);
  }

  _p_slalom(s, diff, sl) {
    for (let i = 0; i < 5; i++) {
      const ss = s - 10 + i * 6;
      const th = slimeAngle(ss) + (i % 2 ? 0.55 : -0.55);
      this.add('saw', ss, th);
      this.add('pizza', ss, th + (i % 2 ? -0.75 : 0.75));
    }
  }

  _p_pole(s, diff, sl) {
    // one bar through the axis; usually tilted so one end isn't on the floor
    this.add('pole', s, 0, { beta: (Math.random() - 0.5) * Math.PI * 0.9 + Math.PI / 2, n: 1 });
    // a Foot Soldier waiting on one of the open sides now and then
    if (Math.random() < 0.5) this.add('foot', s + 9, (Math.random() < 0.5 ? 1 : -1) * 0.9, { base: 0, strafe: 0, phase: 0, yaw: 0 });
  }

  _p_poleX(s, diff, sl) {
    // two bars crossing: four blocked spots, four lanes between them
    this.add('pole', s, 0, { beta: Math.random() * Math.PI, n: 2 });
  }

  _p_fan(s, diff, sl) {
    this.add('fan', s, 0, { phase: Math.random() * TAU, spin: (Math.random() < 0.5 ? -1 : 1) * (0.5 + diff * 0.7) });
  }

  _p_foot(s, diff, sl) {
    const n = 1 + Math.floor(Math.random() * (1.5 + diff * 2));
    for (let i = 0; i < n; i++) {
      const th = sl + (Math.random() - 0.5) * 2.4;
      const strafe = Math.random() < 0.3 + diff * 0.4 ? (0.25 + Math.random() * 0.35) : 0;
      this.add('foot', s + i * 6 + Math.random() * 3, th, { base: th, strafe, phase: Math.random() * TAU, yaw: (Math.random() - 0.5) * 0.5 });
    }
  }

  _p_footLine(s, diff, sl) {
    // a squad across the wall: kick the whole row by carving through it
    const side = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      const th = side * (-0.6 + i * 0.55);
      this.add('foot', s + i * 3.5, th, { base: th, strafe: 0, phase: 0, yaw: 0 });
    }
  }

  _p_valves(s, diff, sl) {
    for (let i = 0; i < 3; i++) this.add('valve', s + i * 5, sl + (Math.random() - 0.5) * 2.4);
  }

  /**
   * Animate, collide, and retire. Returns events for the game to react to.
   * player: { s, theta, invuln, shieldOn }
   */
  update(dt, time, player, events) {
    const ps = player.s, pt = player.theta;
    for (const o of this.list) {
      const ds = o.s - ps;
      // ── per-type animation ──
      if (o.type === 'pizza' || o.type === 'shield') {
        const w = o.mesh.userData.wedge;
        w.rotation.y = time * 3 + o.s;
        o.mesh.position.multiplyScalar(1); // static anchor
        if (o.collected) {
          o.t = (o.t || 0) + dt;
          o.mesh.scale.setScalar(Math.max(0.01, 1 + o.t * 6));
          o.mesh.traverse((c) => { if (c.material) { c.material.transparent = true; c.material.opacity = Math.max(0, 1 - o.t * 5); } });
          if (o.t > 0.2) o.done = true;
        }
      } else if (o.type === 'foot') {
        if (o.flying) {
          // blown away: ballistic tumble in world space, then gone
          o.t += dt;
          o.vel.addScaledVector(o.grav, dt);
          o.mesh.position.addScaledVector(o.vel, dt);
          o.mesh.rotateX(o.spin.x * dt); o.mesh.rotateZ(o.spin.z * dt);
          o.mesh.userData.ring.visible = false;
          o.mesh.children.forEach((c) => { if (c !== o.mesh.userData.body) c.visible = false; });
          if (o.t > 1.6) o.done = true;
        } else {
          if (o.strafe) { o.theta = o.base + Math.sin(time * 1.6 + o.phase) * o.strafe; this._placeStatic(o); }
          // ready stance bob + target ring pulse
          o.mesh.userData.body.position.y = Math.abs(Math.sin(time * 5 + o.phase)) * 0.12;
          const r = o.mesh.userData.ring;
          r.scale.setScalar(1 + Math.sin(time * 6 + o.phase) * 0.12);
          o.mesh.userData.aura.material.opacity = 0.45 + Math.sin(time * 4 + o.phase) * 0.12;
        }
      } else if (o.type === 'saw') {
        o.mesh.userData.blade.rotation.z -= dt * 16;
        o.mesh.userData.glow.material.opacity = 0.75 + Math.sin(time * 10 + o.s) * 0.25;
      } else if (o.type === 'valve') {
        for (const c of o.mesh.userData.spin) c.rotation.z += dt * 2;
      } else if (o.type === 'fan') {
        o.angle = o.phase + time * o.spin;
        o.mesh.userData.blades.rotation.z = o.angle;
      } else if (o.type === 'crate' && o.drop && !o.landed && o.home) {
        // drops from the ceiling so it lands ~0.9 s before you reach it
        const p = THREE.MathUtils.clamp(1 - (ds - 25) / 45, 0, 1);
        if (p < 1) {
          const f = frameAt(o.s, this.f);
          const top = pointAt(o.s, o.theta + Math.PI, R - 1.2, new THREE.Vector3(), f);
          const e = p * p;
          o.mesh.position.lerpVectors(top, o.home, e);
          o.mesh.quaternion.copy(o.homeQ);
          o.mesh.rotateX((1 - e) * 5.0);
          o.mesh.rotateZ((1 - e) * 3.0);
        } else {
          o.landed = true;
          o.mesh.position.copy(o.home); o.mesh.quaternion.copy(o.homeQ);
          if (ds < 60) events.push({ type: 'land', o });
        }
      }

      // ── collision ──
      if (!o.hit && !o.collected && Math.abs(ds) < 2.2) {
        const r = this._collide(o, ds, pt);
        if (r === 'hit' && player.hop < 0.5) { o.hit = true; events.push({ type: 'hit', o }); }
        else if (r === 'enemy') { o.hit = true; events.push({ type: 'enemy', o }); }
        else if (r === 'pickup') { o.collected = true; events.push({ type: o.type, o }); }
      }
      // near miss: obstacle just passed, closest clearance was tight
      if (!o.hit && !o.near && ds < -0.8 && ds > -3 && this._isHazard(o)) {
        o.near = true;
        if (o.minClear !== undefined && o.minClear < 0.22) events.push({ type: 'near', o, clear: o.minClear });
      }
      if (ds < -14) o.done = true;
    }
    // retire
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].done) { this._free(this.list[i]); this.list.splice(i, 1); }
    }
  }

  _isHazard(o) { return o.type === 'crate' || o.type === 'saw' || o.type === 'pipe' || o.type === 'fan' || o.type === 'valve' || o.type === 'pole'; }

  _collide(o, ds, pt) {
    let clear = Infinity;
    switch (o.type) {
      case 'crate': {
        if (o.drop && !o.landed) return null;
        if (Math.abs(ds) > CRATE / 2 + 0.35) return null;
        clear = Math.abs(angleDiff(pt, o.theta)) - (CRATE / 2 + 0.4) / R;
        break;
      }
      case 'saw': {
        if (Math.abs(ds) > 0.7) return null;
        clear = Math.abs(angleDiff(pt, o.theta)) - (SAW_R + 0.4) / R;
        break;
      }
      case 'valve': {
        if (Math.abs(ds) > 1.1) return null;
        clear = Math.abs(angleDiff(pt, o.theta)) - 1.25 / R;
        break;
      }
      case 'pipe': {
        if (Math.abs(ds) > 0.75) return null;
        clear = Math.abs(angleDiff(pt, o.theta)) - o.arc;
        break;
      }
      case 'pole': {
        if (Math.abs(ds) > POLE_R + 0.5) return null;
        const ends = o.n === 2 ? 4 : 2;
        for (let k = 0; k < ends; k++) {
          clear = Math.min(clear, Math.abs(angleDiff(pt, o.beta + k * Math.PI / (o.n === 2 ? 2 : 1))) - (POLE_R + 0.45) / R);
        }
        break;
      }
      case 'fan': {
        if (Math.abs(ds) > 0.6) return null;
        for (let k = 0; k < 4; k++) {
          // fan local frame is X=right, Y=ceiling; a bar rotated by `angle`
          // meets the wall at θ = angle + k·π/2 (derivation: dir(θ) = −U·cosθ + Rt·sinθ)
          const bladeTheta = (o.angle || 0) + k * Math.PI / 2;
          clear = Math.min(clear, Math.abs(angleDiff(pt, bladeTheta)) - 0.42 / R - 0.05);
        }
        break;
      }
      case 'foot':
        if (o.flying) return null;
        if (Math.abs(ds) < 1.5 && Math.abs(angleDiff(pt, o.theta)) < 1.05 / R) return 'enemy';
        return null;
      case 'pizza':
        if (Math.abs(ds) < 1.3 && Math.abs(angleDiff(pt, o.theta)) < 0.27) return 'pickup';
        return null;
      case 'shield':
        if (Math.abs(ds) < 1.5 && Math.abs(angleDiff(pt, o.theta)) < 0.32) return 'pickup';
        return null;
    }
    o.minClear = Math.min(o.minClear ?? Infinity, clear);
    return clear < 0 ? 'hit' : null;
  }

  /** Nearest hazard ahead, for the warning chevrons in the HUD (unused if none). */
  smash(o) {
    o.done = true;
  }

  /** Kicked: send him flying downstream, up off the wall, tumbling. */
  launch(o, speed) {
    const f = frameAt(o.s, this.f);
    const up = wallDir(f, o.theta, new THREE.Vector3()).negate();
    const side = f.Rt.clone().multiplyScalar((Math.random() - 0.5) * 10);
    o.flying = true; o.t = 0;
    o.vel = f.T.clone().multiplyScalar(speed * 1.25 + 8).addScaledVector(up, 11 + Math.random() * 4).add(side);
    o.grav = up.clone().multiplyScalar(-24);
    o.spin = new THREE.Vector3(-(10 + Math.random() * 8), 0, (Math.random() - 0.5) * 14);
  }
}

// Banded toon shading for the untextured maquette. Brighter than a real Foot
// Soldier on purpose: a lit purple-grey suit, a three-step key light, a hot
// magenta rim and a self-lit red visor + belt so the silhouette pops off the
// dark pipe at distance. Fog applies, but rim/visor resist it a little.
function makeFootMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uFlash: { value: 0 } }]),
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      varying vec3 vN; varying vec3 vV; varying float vH;
      void main(){
        vH = position.y;
        vec4 mvPosition = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      uniform float uFlash;
      varying vec3 vN; varying vec3 vV; varying float vH;
      void main(){
        vec3 N = normalize(vN);
        vec3 L = normalize(vec3(0.2, 0.7, 0.7));        // key light from the camera side
        float d = dot(N, L) * 0.5 + 0.5;
        float band = d > 0.7 ? 1.0 : d > 0.45 ? 0.72 : 0.48;
        vec3 base = vec3(0.36, 0.31, 0.5);                // lit purple-grey suit
        vec3 glow = vec3(0.0);
        if (vH > 0.86 && vH < 0.91) { base = vec3(1.0, 0.18, 0.12); glow = vec3(1.0, 0.25, 0.1) * 0.9; }   // visor
        else if (vH > 0.5 && vH < 0.54) { base = vec3(0.95, 0.2, 0.25); glow = vec3(0.6, 0.05, 0.1); }     // red sash
        vec3 c = base * band * 1.35;
        float rim = pow(1.0 - max(0.0, dot(N, normalize(vV))), 2.0);
        c += vec3(1.0, 0.3, 0.85) * rim * 1.2;
        c += glow;
        c = mix(c, vec3(1.0), uFlash);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
        // keep the glow parts readable through the fog
        gl_FragColor.rgb = mix(gl_FragColor.rgb, c, clamp(length(glow) * 0.6 + rim * 0.4, 0.0, 0.6));
      }`,
  });
}

// Inverted-hull outline: the same mesh pushed out along its normals, drawn
// back-faces only, flat bright colour. Reads as a glowing cartoon outline.
function makeOutlineMaterial(color, width) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uWidth: { value: width } },
    vertexShader: /* glsl */`
      uniform float uWidth;
      void main(){
        vec3 p = position + normal * uWidth;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      void main(){ gl_FragColor = vec4(uColor, 1.0); }`,
  });
}

// Red/white hazard bands for the poles (a prop texture, drawn once).
function makeStripeTexture(c1 = '#e2322a', c2 = '#f4f1e8', rep = 7) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? c2 : c1;
    g.fillRect(0, i * 16, 16, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, rep);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Saw blade: a toothed disc in the XY plane (faces along Z), with a bore.
function makeSawGeometry(r, teeth) {
  const sh = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2, a1 = ((i + 0.65) / teeth) * Math.PI * 2;
    const p0 = [Math.cos(a0) * r * 0.82, Math.sin(a0) * r * 0.82];
    const p1 = [Math.cos(a1) * r, Math.sin(a1) * r];
    if (i === 0) sh.moveTo(...p0); else sh.lineTo(...p0);
    sh.lineTo(...p1);
  }
  sh.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.12, 0, Math.PI * 2, true);
  sh.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
  g.translate(0, 0, -0.035);
  return g;
}

// Saw steel: dark gunmetal toward the centre, glowing hot red toward the teeth,
// so the cutting edge is the brightest, most dangerous-looking part.
function makeSawMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uR: { value: SAW_R } }]),
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      varying float vR;
      void main(){
        vR = length(position.xy);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      uniform float uR;
      varying float vR;
      void main(){
        float t = clamp(vR / uR, 0.0, 1.0);
        vec3 steel = mix(vec3(0.32, 0.35, 0.38), vec3(0.62, 0.66, 0.7), smoothstep(0.2, 0.7, t));
        vec3 hot = vec3(1.0, 0.2, 0.08);
        vec3 c = mix(steel, hot, smoothstep(0.74, 0.95, t));
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
}
