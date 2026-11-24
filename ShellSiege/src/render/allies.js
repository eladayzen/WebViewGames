// THE OTHER TURTLES, ON SCREEN.
//
// Leonardo and Donatello are Raphael's model, cloned, with the RED of his mask
// (and belt) repainted blue and purple. Same rig, so they play his own clips:
// idle, the crouch walk, and the throw as a swing. No new art, and they read as
// the other turtles at once -- the colour of the mask is how every child tells
// them apart.
//
// THE WEAPONS ARE VOLUMES, not models (Elad: "you can just use volumetric
// shapes"): two katanas, a bo staff, a drone. Each is a plain mesh placed from
// the hand bone's world position every frame, and pointed by the sim's swing
// progress -- so a cut sweeps the arc the sim actually damages.
//
// LEONARDO'S DASH leaves a trail of fading glows behind him; DONATELLO'S STUN CONE
// is drawn on the floor, a narrow fan down the line he faced, fading as it goes.
import * as THREE from 'three';
import { RISE_S } from '../core/allies.js';
import { makeNunchuck } from './weapons3d.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { u } from './units.js';
import { glowTexture } from './stage.js';
import { ALLY } from '../core/allies.js';

// which of Raphael's pixels count as "mask": clearly red
// Dark maroon pads count too (r/g ~ 5); the brown shell does not (r/g ~ 1.5).
const isRed = (r, g, b) => r > 50 && r > g * 2.2 && r > b * 2.0;
const PAINT = {
  leo:    (l) => [l * 0.16, l * 0.42, l * 1.0],      // blue
  donnie: (l) => [l * 0.62, l * 0.2, l * 0.95],      // purple
  mikey:  (l) => [l * 1.0, l * 0.5, l * 0.04],       // orange
};

/** Raphael's texture with the red repainted. */
function recolor(srcTex, key) {
  const img = srcTex.image;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (isRed(p[i], p[i + 1], p[i + 2])) {
      const [r, gg, b] = PAINT[key](p[i]);
      p[i] = r; p[i + 1] = gg; p[i + 2] = Math.min(255, b);
    }
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.flipY = srcTex.flipY;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = srcTex.anisotropy;
  return t;
}

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export async function createAllies(scene, rig) {
  const group = new THREE.Group();
  scene.add(group);

  // ---- clips: the same file the player's rig reads --------------------------------
  let data = {};
  try { data = await (await fetch('models/clips.json')).json(); } catch { /* the allies stand in bind pose */ }
  const clipOf = (n) => (data[n] ? THREE.AnimationClip.parse(data[n]) : null);

  // ---- the template: the rig's scaled model group ---------------------------------
  const template = rig.root.children[0];
  let srcMap = null;
  rig.model.traverse((o) => { if (o.isMesh && o.material?.map && !srcMap) srcMap = o.material.map; });
  const textures = {};
  const texFor = (key) => (textures[key] ||= (srcMap ? recolor(srcMap, key) : null));

  const glow = glowTexture('rgba(190,240,255,1)', 'rgba(120,200,255,0)');
  const glowV = glowTexture('rgba(220,190,255,1)', 'rgba(150,90,255,0)');
  const shadowTex = glowTexture('rgba(0,0,0,0.7)', 'rgba(0,0,0,0)');
  const sprite = (tex, blending = THREE.AdditiveBlending) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending, fog: false }));
    s.visible = false; group.add(s); return s;
  };

  const rigs = new Map();     // sim ally -> its drawn parts

  // a pizza on the floor: the painted slice (the same one the progress pips use) over a warm glow
  const pizzaTex = new THREE.TextureLoader().load('tex/ui_pizza_full.png');
  pizzaTex.colorSpace = THREE.SRGBColorSpace;
  const poolTex = glowTexture('rgba(255,190,80,1)', 'rgba(255,150,40,0)');
  const pizzaSprites = [];
  function makePizza() {
    const slice = new THREE.Sprite(new THREE.SpriteMaterial({ map: pizzaTex, transparent: true, depthWrite: false, fog: false }));
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pool.rotation.x = -Math.PI / 2;
    group.add(slice, pool);
    return { slice, pool };
  }

  // ---- MICHELANGELO'S SPINJITZU: he spins all the time, in a blur of orange; the nunchucks whirl over his head ----
  // A tail is a flat ring segment whose alpha fades along its length (RGBA vertex colours), so a short arc
  // turning fast reads as a smear of motion rather than a shape.
  function tailGeo(inner, outer, arc, rgb) {
    const g = new THREE.RingGeometry(inner, outer, 28, 1, 0, arc);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const th = Math.atan2(pos.getY(i), pos.getX(i)), k = Math.max(0, Math.min(1, (th < 0 ? th + Math.PI * 2 : th) / arc));
      col.set([rgb[0], rgb[1], rgb[2], Math.pow(k, 1.6) * 0.85], i * 4);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    return g;
  }
  const spinMat = () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  function makeSpin() {
    const g = new THREE.Group();
    g.visible = false;
    const tails = [];
    // three smears at head, chest and knee height, turning at different speeds, so the whole body is a blur
    for (const [y, r0, r1, arc, rgb] of [[1.55, 0.55, 1.2, 2.4, [1, 0.62, 0.2]], [1.05, 0.5, 1.0, 2.0, [1, 0.8, 0.4]], [0.45, 0.4, 0.8, 1.8, [1, 0.5, 0.15]]]) {
      for (const off of [0, Math.PI]) {
        const m = new THREE.Mesh(tailGeo(r0, r1, arc, rgb), spinMat());
        m.rotation.x = -Math.PI / 2; m.position.y = y; m.userData.off = off; m.userData.y = y;
        g.add(m); tails.push(m);
      }
    }
    // a faint tornado round him
    const tor = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.45, 2.1, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffa43a, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    tor.position.y = 1.05;
    g.add(tor);
    // the cleave: a wide crescent thrown out in the swing's direction, brightest at the instant of the hit
    const cleave = new THREE.Mesh(tailGeo(2.6, 3.4, Math.PI * 1.96, [1, 0.8, 0.45]),
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    cleave.rotation.x = -Math.PI / 2; cleave.visible = false;
    return { g, tails, tor, cleave };
  }

  function build(a) {
    const scaler = cloneSkinned(template);
    // RAPHAEL'S SAI ARE HIS ALONE. The template is his rig, with his blades parented to his
    // hand bones; strip anything hanging off a bone so no other turtle carries them.
    const stray = [];
    scaler.traverse((o) => { if (o.parent && o.parent.isBone && !o.isBone) stray.push(o); });
    for (const o of stray) o.parent.remove(o);
    const holder = new THREE.Group();
    holder.add(scaler);
    const mats = [];
    let lh = null, rh = null;
    scaler.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        o.material = o.material.clone();
        const t = texFor(a.key);
        if (t) o.material.map = t;
        o.material.transparent = true;
        mats.push(o.material);
      }
      if (o.isBone && o.name === 'mixamorigLeftHand') lh = o;
      if (o.isBone && o.name === 'mixamorigRightHand') rh = o;
    });
    const mixer = new THREE.AnimationMixer(scaler);
    const act = {};
    for (const [k, n] of [['idle', 'idle2'], ['walk', 'walk_f'], ['slash', 'throw_slash']]) {
      const c = clipOf(n);
      if (!c) continue;
      // The shipped model has no finger bones past the first; drop those tracks
      // rather than have three.js warn about each one on every ally.
      c.tracks = c.tracks.filter((t) => scaler.getObjectByName(t.name.split('.')[0]));
      const ac = mixer.clipAction(c);
      ac.play(); ac.setEffectiveWeight(0);
      act[k] = ac;
    }
    if (act.slash) act.slash.timeScale = 0;
    if (act.walk) act.walk.timeScale = 1.25;
    group.add(holder);

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, fog: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; shadow.scale.setScalar(1.3);
    group.add(shadow);

    const trail = [];                              // Leonardo's afterimages
    for (let i = 0; i < 7; i++) trail.push(sprite(glow));
    const hist = [];
    // the stun cone: a flat fan, 30 degrees, centred on +X (aimed by rotating its parent)
    const cone = new THREE.Group();
    cone.visible = false;
    const fanMesh = new THREE.Mesh(
      new THREE.CircleGeometry(1, 24, -Math.PI / 12, Math.PI / 6),
      new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    fanMesh.rotation.x = -Math.PI / 2;
    cone.add(fanMesh);
    group.add(cone);
    // THE SUMMON: a ring of light on the floor under his feet and a column rising out of it
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 1, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    ring.rotation.x = -Math.PI / 2; ring.visible = false;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 3.4, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    beam.visible = false;
    group.add(ring, beam);
    const p = { holder, mixer, act, mats, lh, rh, shadow, ring, beam, weapons: [], trail, hist, cone, fanMesh, pop: sprite(glow) };
    if (a.key === 'mikey') { p.spin = makeSpin(); group.add(p.spin.g, p.spin.cleave); }

    // ---- weapons, as plain volumes ------------------------------------------------
    const lam = (color, emissive = 0x000000) => new THREE.MeshLambertMaterial({ color, emissive });
    if (a.key === 'leo') {
      for (const side of [-1, 1]) {
        const w = new THREE.Group();
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.02, 0.95), lam(0xdfe8f2, 0x223344));
        blade.position.z = 0.55;
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.04), lam(0x1d4f9e));
        guard.position.z = 0.08;
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), lam(0x1d4f9e));
        grip.rotation.x = Math.PI / 2;
        w.add(blade, guard, grip);
        group.add(w);
        p.weapons.push({ obj: w, side, bone: side < 0 ? 'lh' : 'rh' });
      }
    } else if (a.key === 'mikey') {
      // NUNCHUCKS: one stick in the right hand, the other on a chain, flailed by the sweep
      const { group: w, free } = makeNunchuck({ wood: 0xa8692e, tape: 0xff7a1a });
      w.scale.setScalar(0.6);                 // smaller in the hand than the first cut
      group.add(w);
      p.weapons.push({ obj: w, side: 1, bone: 'rh', nun: free });
    } else {
      const w = new THREE.Group();
      const bo = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.25, 10), lam(0xc89a58));
      bo.rotation.x = Math.PI / 2;
      for (const z of [-0.5, 0.5, 0.0]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.12, 10), lam(0x6b2fa8));
        band.rotation.x = Math.PI / 2; band.position.z = z;
        w.add(band);
      }
      w.add(bo);
      group.add(w);
      p.weapons.push({ obj: w, side: 1, bone: 'rh', bo: true });

    }
    return p;
  }

  const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  shieldMesh.visible = false; shieldMesh.renderOrder = 5;
  group.add(shieldMesh);
  let shieldK = 0;
  const V = new THREE.Vector3(), Q = new THREE.Quaternion(), FWD = new THREE.Vector3(0, 0, 1), DIR = new THREE.Vector3();

  /** Point a weapon volume: yaw about Y, then up `pitch`. */
  function aim(obj, yaw, pitch) {
    DIR.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    obj.quaternion.copy(Q.setFromUnitVectors(FWD, DIR));
  }

  /** Per-frame: draw `allies`. */
  // GRAVITY GRENADES (Donatello). A real gadget, not a glow: a chunky steel grenade with a lit band that
  // tumbles out of his hand on a glowing trail; where it lands it slams down a shockwave, unfolds a pylon
  // base, and runs a gravity well -- a spinning rune circle, a funnel of light, rings and motes streaming
  // INWARD, and a bar that drains as the well runs out. It collapses with a flash when the time is up.
  const VIO = 0xb06bff, VIO_D = 0x4a1fa0, WHITE_V = 0xe9d6ff;
  const runeTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.translate(128, 128); g.lineCap = 'round';
    g.strokeStyle = 'rgba(210,170,255,.95)';
    g.lineWidth = 7;
    for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(0, 0, 118, i * Math.PI / 6 + 0.06, i * Math.PI / 6 + 0.38); g.stroke(); }
    g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, 98, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 6; i++) {          // six inward chevrons: the direction things are pulled
      g.save(); g.rotate(i * Math.PI / 3); g.beginPath(); g.moveTo(88, -9); g.lineTo(70, 0); g.lineTo(88, 9); g.stroke(); g.restore();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const gPool = [];
  const addMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  function makeGrenade() {
    const g = new THREE.Group();
    // --- the grenade body: steel ball, a lit violet band, a cap and a blinking lamp
    const body = new THREE.Group();
    const steel = new THREE.MeshLambertMaterial({ color: 0x3a3f4c, emissive: 0x14121e });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), steel);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.345, 0.07, 8, 24), new THREE.MeshBasicMaterial({ color: VIO, fog: false }));
    band.rotation.x = Math.PI / 2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.16, 10), new THREE.MeshLambertMaterial({ color: 0xc9d0dc }));
    cap.position.y = 0.38;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5a8a, fog: false }));
    lamp.position.set(0.0, 0.5, 0);
    body.add(ball, band, cap, lamp);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), addMat(VIO, 0.28));
    // --- the trail it leaves in the air
    const trail = []; for (let i = 0; i < 7; i++) { const t = sprite(glowV); trail.push(t); }
    // --- the landing: a shockwave and a flash
    const shock = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), addMat(WHITE_V, 0.9)); shock.rotation.x = -Math.PI / 2; shock.position.y = 0.08;
    const flash = sprite(glowV);
    // --- the deployed well: base plate, pylons, rune circle, funnel, rings, motes, core
    const base = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.14, 24), new THREE.MeshLambertMaterial({ color: 0x2b2f3b, emissive: 0x120d22 }));
    plate.position.y = 0.07;
    const plateRing = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.045, 6, 32), new THREE.MeshBasicMaterial({ color: VIO, fog: false })); plateRing.rotation.x = Math.PI / 2; plateRing.position.y = 0.15;
    base.add(plate, plateRing);
    const pylons = [];
    for (let i = 0; i < 4; i++) {
      const py = new THREE.Group();
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.14), new THREE.MeshLambertMaterial({ color: 0x4a5062, emissive: 0x1a1430 }));
      post.position.y = 0.45;
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), new THREE.MeshBasicMaterial({ color: WHITE_V, fog: false }));
      tip.position.y = 0.92;
      py.add(post, tip); py.position.set(Math.cos(i * Math.PI / 2) * 0.72, 0, Math.sin(i * Math.PI / 2) * 0.72);
      base.add(py); pylons.push({ py, tip });
    }
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), new THREE.MeshBasicMaterial({ color: WHITE_V, fog: false }));
    const coreHalo = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), addMat(VIO, 0.4));
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1, 2.6, 22, 1, true), addMat(VIO, 0.22));
    funnel.position.y = 1.3;
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.9 }));
    rune.rotation.x = -Math.PI / 2; rune.position.y = 0.05;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), addMat(VIO_D, 0.34)); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.03;
    const mkRing = () => { const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 56), addMat(VIO, 0.6)); r.rotation.x = -Math.PI / 2; r.position.y = 0.07; return r; };
    const rings = [mkRing(), mkRing(), mkRing(), mkRing()];
    const motes = []; for (let i = 0; i < 18; i++) motes.push(sprite(glowV));
    const collapse = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 40), addMat(WHITE_V, 0.9)); collapse.rotation.x = -Math.PI / 2; collapse.position.y = 0.1;
    // --- the timer: a bar over the device that drains
    const barBack = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x0c0818, depthTest: false, transparent: true, opacity: 0.75, fog: false }));
    const barFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: VIO, depthTest: false, transparent: true, opacity: 0.95, fog: false }));
    barBack.scale.set(1.5, 0.15, 1); barBack.renderOrder = 60; barFill.renderOrder = 61;
    g.add(body, halo, shock, base, core, coreHalo, funnel, rune, disc, ...rings, collapse, barBack, barFill);
    group.add(g);
    return { g, body, band, lamp, halo, trail, shock, flash, base, pylons, core, coreHalo, funnel, rune, disc, rings, motes, collapse, barBack, barFill };
  }
  function syncGrenades(list, timeS) {
    let gi = 0;
    for (const z of list || []) {
      if (!z.alive) continue;
      const v = gPool[gi] || (gPool[gi] = makeGrenade());
      gi++;
      v.g.visible = true;
      const R = u(z.radius);
      const flying = !z.landed;
      v.body.visible = flying; v.halo.visible = flying;
      for (const t of v.trail) t.visible = false;
      v.flash.visible = false;
      const deployed = !flying;
      for (const o of [v.base, v.core, v.coreHalo, v.funnel, v.rune, v.disc, v.collapse, v.barBack, v.barFill, ...v.rings]) o.visible = deployed;
      for (const m of v.motes) m.visible = deployed;
      v.shock.visible = false;
      if (flying) {
        const t = Math.min(1, z.age / z.flightS);
        const at = (k) => [u(z.from.x + (z.x - z.from.x) * k), 0.9 + Math.sin(k * Math.PI) * 2.6, u(z.from.y + (z.y - z.from.y) * k)];
        const [bx, by, bz] = at(t);
        v.g.position.set(0, 0, 0);
        v.body.position.set(bx, by, bz); v.halo.position.set(bx, by, bz);
        v.body.rotation.set(timeS * 9, timeS * 6, 0);
        v.lamp.material.color.setHex(Math.sin(timeS * 30) > 0 ? 0xff5a8a : 0x551a2a);
        v.halo.scale.setScalar(1 + 0.15 * Math.sin(timeS * 20));
        v.trail.forEach((s, i) => {
          const k = Math.max(0, t - (i + 1) * 0.055); const [x, y, zz] = at(k);
          s.visible = t > 0.02; s.position.set(x, y, zz); s.scale.setScalar(1.1 - i * 0.12); s.material.opacity = 0.7 * (1 - i / v.trail.length);
        });
      } else {
        v.g.position.set(u(z.x), 0, u(z.y));
        const left = z.lifeS - z.age, k = clamp01(z.age / z.lifeS);
        const deploy = clamp01(z.age / 0.35), dying = clamp01((0.45 - left) / 0.45);
        const spin = timeS;
        // landing: a shockwave out to the field's edge and a flash, in the first moments
        const hit = clamp01(z.age / 0.3);
        v.shock.visible = z.age < 0.3; v.shock.scale.setScalar(R * (0.15 + 0.85 * hit)); v.shock.material.opacity = 0.9 * (1 - hit);
        v.flash.visible = z.age < 0.2; v.flash.position.set(u(z.x), 0.5, u(z.y)); v.flash.scale.setScalar(4.2 * (1 - z.age / 0.2) + 0.5); v.flash.material.opacity = 1 - z.age / 0.2;
        // the base unfolds, the pylons spin and their tips flash in turn
        v.base.scale.set(deploy, deploy, deploy); v.base.rotation.y = spin * 0.8;
        v.pylons.forEach((p, i) => { p.tip.scale.setScalar(0.8 + 0.5 * Math.max(0, Math.sin(spin * 7 - i * 1.6))); });
        v.core.position.set(0, 1.15 + Math.sin(spin * 4) * 0.1, 0); v.core.scale.setScalar((1 - dying) * deploy * (1 + 0.12 * Math.sin(spin * 12)));
        v.core.rotation.set(spin * 2, spin * 3, 0);
        v.coreHalo.position.copy(v.core.position); v.coreHalo.scale.setScalar((1 - dying) * deploy * (1.1 + 0.25 * Math.sin(spin * 9)));
        v.funnel.scale.set(R * 0.5 * deploy, 1, R * 0.5 * deploy); v.funnel.rotation.y = -spin * 2.2; v.funnel.material.opacity = 0.22 * (1 - dying);
        v.rune.scale.setScalar(R * deploy); v.rune.rotation.z = spin * 1.4; v.rune.material.opacity = 0.9 * (1 - dying);
        v.disc.scale.setScalar(R * deploy); v.disc.material.opacity = 0.3 * (1 - dying);
        v.rings.forEach((r, i) => { const ph = (spin * 0.9 + i / 4) % 1; r.scale.setScalar(R * (1 - ph) * deploy + 0.1); r.material.opacity = 0.6 * ph * (1 - dying); });
        // motes spiral inward
        v.motes.forEach((m, i) => {
          const ph = (spin * 0.7 + i / v.motes.length) % 1, ang = i * 2.4 + ph * 5, rr = R * 0.95 * (1 - ph);
          m.position.set(Math.cos(ang) * rr, 0.2 + ph * 0.9, Math.sin(ang) * rr).add(v.g.position);
          m.scale.setScalar(0.35 + 0.25 * (1 - ph)); m.material.opacity = (0.9 * Math.sin(Math.PI * ph)) * (1 - dying) * deploy;
        });
        // the collapse: a bright ring snaps shut when it is about to end
        v.collapse.visible = dying > 0; v.collapse.scale.setScalar(R * (1 - dying) + 0.3); v.collapse.material.opacity = 0.9 * dying;
        // the timer bar: drains, turning hot as it runs out
        const f = clamp01(left / z.lifeS), bw = 1.5;
        v.barBack.position.set(0, 2.35, 0); v.barFill.position.set(0, 2.35, 0);
        v.barFill.scale.set(Math.max(0.001, (bw - 0.1) * f), 0.09, 1); v.barFill.center.set(0.5 / Math.max(0.001, f), 0.5);
        v.barFill.material.color.setHex(f < 0.25 ? 0xff5a8a : VIO);
      }
    }
    for (; gi < gPool.length; gi++) { gPool[gi].g.visible = false; gPool[gi].body.visible = false; gPool[gi].halo.visible = false; for (const t of gPool[gi].trail) t.visible = false; for (const m of gPool[gi].motes) m.visible = false; gPool[gi].flash.visible = false; }
  }

  function sync(allies, timeS, dt, pizzas = [], shield = null, player = null, grenades = null) {
    syncGrenades(grenades, timeS);
    // DONATELLO'S SHIELD: a bubble round Raphael, brightening when it soaks a hit
    if (shield && player && shield.up && shield.hp > 0) {
      shieldMesh.visible = true;
      const frac = Math.max(0, Math.min(1, shield.hp / (shield.max || 1)));
      shieldK = Math.min(1, shieldK + dt * 5);
      shieldMesh.position.set(u(player.x), 0.85, u(player.y));
      shieldMesh.scale.setScalar(1.15 * (0.4 + 0.6 * shieldK) * (1 + 0.025 * Math.sin(timeS * 6)));
      shieldMesh.material.opacity = (0.10 + 0.08 * frac) + (shield.hitT > 0 ? 0.25 * (shield.hitT / 0.3) : 0);
      shieldMesh.material.color.setHex(shield.hitT > 0 ? 0xbfe6ff : 0x4aa8ff);
    } else { shieldMesh.visible = false; shieldK = 0; }

    // remove rigs of allies that are gone
    for (const [a, p] of rigs) {
      if (!allies.includes(a)) {
        group.remove(p.holder, p.shadow, p.cone, p.pop, p.ring, p.beam, ...p.trail);
        if (p.spin) group.remove(p.spin.g, p.spin.cleave);
        if (p.bake) group.remove(p.bake);
        for (const w of p.weapons) group.remove(w.obj);
        rigs.delete(a);
      }
    }
    for (const a of allies) {
      let p = rigs.get(a);
      if (!p) { p = build(a); rigs.set(a, p); }
      const C = ALLY[a.key];
      // MICHELANGELO's bake: a warm glow gathers round him while he cooks
      if (p.bake) {
        const cooking = a.present && a.slashT >= 0;
        p.bake.visible = cooking;
        if (cooking) {
          p.bake.position.set(u(a.x), 0.9, u(a.y));
          p.bake.scale.setScalar(1.2 + 1.4 * Math.sin(Math.min(1, a.slashT) * Math.PI));
          p.bake.material.opacity = 0.35 + 0.5 * Math.sin(Math.min(1, a.slashT) * Math.PI);
          p.bake.material.color.setHex(0xffb347);
        }
      }
      // the pop of light where he arrived or left
      p.pop.visible = !!a.fx;
      if (a.fx) {
        const k = a.fx.t / 0.4;
        p.pop.position.set(u(a.fx.x), 0.35, u(a.fx.y));     // low: it comes from below his legs
        p.pop.scale.setScalar(1.2 + 2.6 * k);
        p.pop.material.opacity = 0.9 * (1 - k);
      }
      // AWAY (his break): nothing of him is drawn
      p.holder.visible = a.present;
      p.shadow.visible = a.present;
      // THE SUMMON, drawn from the sim's own rise clock: the ring snaps out wide and
      // closes in under his feet while the column of light lifts him out of the floor.
      const rk = a.present ? clamp01(a.rise / RISE_S) : 1;
      const rising = a.present && rk < 1;
      p.ring.visible = rising; p.beam.visible = rising;
      if (rising) {
        const tint = { leo: 0x4aa8ff, donnie: 0xb06bff, mikey: 0xffa43a }[a.key] || 0xffffff;
        p.ring.material.color.setHex(tint); p.beam.material.color.setHex(tint);
        p.ring.position.set(u(a.x), 0.04, u(a.y));
        p.ring.scale.setScalar(2.4 - 1.5 * rk);
        p.ring.material.opacity = 0.9 * (1 - rk * 0.6);
        p.beam.position.set(u(a.x), 1.7, u(a.y));
        p.beam.scale.set(1 - 0.5 * rk, 1, 1 - 0.5 * rk);
        p.beam.material.opacity = 0.5 * Math.sin(Math.PI * Math.min(1, rk * 1.15));
      }
      for (const w of p.weapons) w.obj.visible = a.present;
      if (!a.present) { p.cone.visible = false; if (p.spin) { p.spin.g.visible = false; p.spin.cleave.visible = false; } for (const t of p.trail) t.visible = false; continue; }
      // MICHELANGELO NEVER STOPS SPINNING: his body turns about its own axis, fast, all the time
      const faceYaw = Math.atan2(Math.cos(a.facing), Math.sin(a.facing));
      const spinning = a.key === 'mikey' && !!p.spin && a.slashT >= 0;        // a short spin (0.5 s), then he walks again
      const sk = clamp01(a.slashT);
      const yaw = spinning ? faceYaw + Math.PI * 6 * sk : faceYaw;      // three full turns in the second, landing back on his facing
      p.holder.position.set(u(a.x), 0, u(a.y));
      p.holder.rotation.y = yaw;
      p.shadow.position.set(u(a.x), 0.02, u(a.y));

      // pose: a swing is scrubbed by the sim's progress; otherwise walk or stand
      const slashing = a.slashT >= 0 && p.act.slash && a.key !== 'mikey';
      if (p.act.slash) {
        p.act.slash.time = clamp01(a.slashT < 0 ? 0 : a.slashT) * p.act.slash.getClip().duration;
        p.act.slash.setEffectiveWeight(slashing ? 1 : 0);
      }
      if (p.act.walk) p.act.walk.setEffectiveWeight(!slashing && a.walking ? 1 : 0);
      if (p.act.idle) p.act.idle.setEffectiveWeight(!slashing && !a.walking ? 1 : 0);
      p.mixer.update(dt);
      p.holder.updateMatrixWorld(true);

      // rising: grows up out of the floor, with a little overshoot, fading in
      const ease = 1 - Math.pow(1 - rk, 3);
      for (const m of p.mats) m.opacity = rk < 1 ? 0.25 + 0.75 * ease : 1;
      p.holder.scale.set(1, rk < 1 ? Math.max(0.02, ease * (1 + 0.08 * Math.sin(rk * Math.PI))) : 1, 1);
      // a dash plays the walk fast and leans him into it
      if (p.act.walk) p.act.walk.timeScale = a.dashing ? 2.6 : 1.25;
      p.holder.rotation.x = a.dashing ? 0.28 : 0;

      // DASH TRAIL: where he has been over the last few frames, as fading glows
      p.hist.unshift({ x: a.x, y: a.y });
      if (p.hist.length > 14) p.hist.pop();
      for (let i = 0; i < p.trail.length; i++) {
        const h = p.hist[(i + 1) * 2 - 1];
        const sp = p.trail[i];
        sp.visible = !!(a.dashing && h);
        if (sp.visible) {
          sp.position.set(u(h.x), 0.8, u(h.y));
          sp.scale.setScalar(1.5 - i * 0.14);
          sp.material.opacity = 0.7 * (1 - i / p.trail.length);
        }
      }

      // THE STUN CONE: a fan on the floor down the line he faced, brightest at the instant of the hit
      if (a.pulse) {
        const k = a.pulse.t / 0.5;
        p.cone.visible = true;
        p.cone.position.set(u(a.pulse.x), 0.04, u(a.pulse.y));
        p.cone.rotation.y = -a.pulse.facing;
        const R = u(ALLY.donnie.stun.range);
        p.fanMesh.scale.set(R * (0.35 + 0.65 * Math.min(1, k * 3)), R * (0.35 + 0.65 * Math.min(1, k * 3)), 1);
        p.fanMesh.material.opacity = 0.55 * (1 - k);
      } else if (p.cone) p.cone.visible = false;

      if (p.spin) {
        const sp = p.spin;
        sp.g.visible = spinning;
        const fade = spinning ? Math.sin(Math.PI * sk) : 0;
        for (const m of sp.tails) m.material.opacity = Math.min(1, fade * 1.6);
        sp.g.position.set(u(a.x), 0, u(a.y));
        for (const m of sp.tails) { m.rotation.z = timeS * (m.userData.y > 1.2 ? 15 : m.userData.y > 0.8 ? -11 : 9) + m.userData.off; }
        sp.tor.rotation.y = timeS * 6;
        sp.tor.material.opacity = 0.10 + 0.05 * Math.sin(timeS * 9);
        // the cleave: out along the swing, widening and fading over 0.4 s
        const cl = a.cleave;
        sp.cleave.visible = !!cl;
        if (cl) {
          const k = cl.t / 0.4;
          sp.cleave.position.set(u(cl.x), 0.95, u(cl.y));
          sp.cleave.rotation.z = k * 1.2;
          sp.cleave.scale.setScalar(0.35 + 0.65 * Math.min(1, k * 3.5));      // the ring expands out to his reach
          sp.cleave.material.opacity = 1 - k;
        }
      }

      // weapons ride the hands
      const s = clamp01(a.slashT);
      for (const w of p.weapons) {
        if (w.nun && spinning) {
          // WHIRLED OVER HIS HEAD, flat, going round with the spin: the free stick streams out behind
          const an = timeS * 17;
          w.obj.position.set(u(a.x) + Math.cos(an) * 0.85, 1.62 + 0.05 * Math.sin(timeS * 9), u(a.y) + Math.sin(an) * 0.85);
          aim(w.obj, Math.PI / 2 - an + Math.PI / 2, 0);
          w.nun.rotation.x = 0.35 + (a.slashT >= 0 ? 0.5 : 0);
          continue;
        }
        const bone = w.bone === 'lh' ? p.lh : p.rh;
        if (bone) { bone.getWorldPosition(V); w.obj.position.copy(V); }
        else w.obj.position.set(u(a.x), 1.0, u(a.y));
        if (a.key === 'leo') {
          // raised and out to the side; the cut sweeps the arc and comes down
          const wind = clamp01(s / 0.32), cut = clamp01((s - 0.32) / 0.3), back = clamp01((s - 0.62) / 0.38);
          const sw = slashing ? (cut * (1 - back)) : 0;
          const pitch = slashing ? lerp(lerp(0.9, 1.25, wind), -0.55, cut) * (1 - back) + 0.9 * back : 0.9;
          const spread = w.side * (0.45 - sw * 1.0 * (w.side > 0 ? 1 : 1));
          aim(w.obj, yaw + spread + (slashing ? w.side * -sw * 0.9 : 0), pitch);
        } else {
          // the bo rests angled up; its sweep whips flat across the arc
          const wind = clamp01(s / 0.25), cut = clamp01((s - 0.25) / 0.35), back = clamp01((s - 0.7) / 0.3);
          const sweep = slashing ? lerp(-C.staffArc / 2, C.staffArc / 2, cut) * (1 - back) : 0;
          const pitch = slashing ? lerp(1.1, 0.15, Math.min(1, wind + cut) * (1 - back)) : 1.1;
          aim(w.obj, yaw + sweep + (slashing ? 0 : 0.5), pitch);
          if (w.nun) {
            // the free stick: dangling at rest, thrown back on the wind-up, whipped through the cut
            const rest = 1.25 + 0.12 * Math.sin(timeS * 5);
            w.nun.rotation.x = slashing ? lerp(lerp(rest, -1.6, wind), 0.15, cut) * (1 - back) + rest * back : rest;
          }
          // grip in the hand, so push the volume forward by half its overhang
          w.obj.position.addScaledVector(DIR, 0.15);
        }
      }
    }

    // THE PIZZAS ON THE FLOOR: a slice floating over a warm pool, blinking out as it expires
    let pi = 0;
    for (const z of pizzas || []) {
      if (!z.alive) continue;
      const v = pizzaSprites[pi] || (pizzaSprites[pi] = makePizza());
      pi++;
      const left = z.lifeS - z.age;
      const drop = clamp01(z.age / 0.45);                                  // it lands from Michelangelo's hand
      const x = z.from.x + (z.x - z.from.x) * drop, y = z.from.y + (z.y - z.from.y) * drop;
      const arc = Math.sin(drop * Math.PI) * 1.2;
      const blink = left < 2.5 ? (Math.sin(timeS * 18) > 0 ? 1 : 0.25) : 1;
      v.slice.visible = v.pool.visible = true;
      v.slice.position.set(u(x), 0.75 + arc + Math.sin(timeS * 4 + pi) * 0.06, u(y));
      v.slice.scale.setScalar(1.05);
      v.slice.material.opacity = blink;
      v.pool.position.set(u(x), 0.05, u(y));
      v.pool.scale.setScalar(1.8 + Math.sin(timeS * 5) * 0.12);
      v.pool.material.opacity = 0.55 * blink;
    }
    for (; pi < pizzaSprites.length; pi++) { pizzaSprites[pi].slice.visible = pizzaSprites[pi].pool.visible = false; }
  }

  return { group, sync };
}
