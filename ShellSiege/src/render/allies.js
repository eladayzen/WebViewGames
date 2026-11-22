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

  function build(a) {
    const scaler = cloneSkinned(template);
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
    const p = { holder, mixer, act, mats, lh, rh, shadow, weapons: [], trail, hist, cone, fanMesh, pop: sprite(glow) };

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
      // a pizza box held out in the right hand: his one prop, and the thing he is cooking
      const w = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.62), lam(0xe8a248, 0x3a1c00));
      const slice = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 10, 1, false, 0, Math.PI * 1.7), lam(0xffd24a, 0x553300));
      slice.position.y = 0.05;
      w.add(box, slice);
      group.add(w);
      p.weapons.push({ obj: w, side: 1, bone: 'rh', box: true });
      p.bake = sprite(glow);
    } else {
      const w = new THREE.Group();
      const bo = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.1, 10), lam(0xc89a58));
      bo.rotation.x = Math.PI / 2;
      for (const z of [-0.9, 0.9, 0.0]) {
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

  const V = new THREE.Vector3(), Q = new THREE.Quaternion(), FWD = new THREE.Vector3(0, 0, 1), DIR = new THREE.Vector3();

  /** Point a weapon volume: yaw about Y, then up `pitch`. */
  function aim(obj, yaw, pitch) {
    DIR.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    obj.quaternion.copy(Q.setFromUnitVectors(FWD, DIR));
  }

  /** Per-frame: draw `allies`. */
  function sync(allies, timeS, dt, pizzas = []) {
    // remove rigs of allies that are gone
    for (const [a, p] of rigs) {
      if (!allies.includes(a)) {
        group.remove(p.holder, p.shadow, p.cone, p.pop, ...p.trail);
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
        p.pop.position.set(u(a.fx.x), 0.9, u(a.fx.y));
        p.pop.scale.setScalar(1.2 + 2.6 * k);
        p.pop.material.opacity = 0.9 * (1 - k);
      }
      // AWAY (his break): nothing of him is drawn
      p.holder.visible = a.present;
      p.shadow.visible = a.present;
      for (const w of p.weapons) w.obj.visible = a.present;
      if (!a.present) { p.cone.visible = false; for (const t of p.trail) t.visible = false; continue; }
      const yaw = Math.atan2(Math.cos(a.facing), Math.sin(a.facing));
      p.holder.position.set(u(a.x), 0, u(a.y));
      p.holder.rotation.y = yaw;
      p.shadow.position.set(u(a.x), 0.02, u(a.y));

      // pose: a swing is scrubbed by the sim's progress; otherwise walk or stand
      const slashing = a.slashT >= 0 && p.act.slash;
      if (p.act.slash) {
        p.act.slash.time = clamp01(a.slashT < 0 ? 0 : a.slashT) * p.act.slash.getClip().duration;
        p.act.slash.setEffectiveWeight(slashing ? 1 : 0);
      }
      if (p.act.walk) p.act.walk.setEffectiveWeight(!slashing && a.walking ? 1 : 0);
      if (p.act.idle) p.act.idle.setEffectiveWeight(!slashing && !a.walking ? 1 : 0);
      p.mixer.update(dt);
      p.holder.updateMatrixWorld(true);

      for (const m of p.mats) m.opacity = 1;
      p.holder.scale.set(1, 1, 1);
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

      // weapons ride the hands
      const s = clamp01(a.slashT);
      for (const w of p.weapons) {
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
          if (w.box) { w.obj.quaternion.identity(); w.obj.rotation.set(0.25 + s * 0.2, yaw, 0); w.obj.position.y += 0.15; continue; }
          const sweep = slashing ? lerp(-C.staffArc / 2, C.staffArc / 2, cut) * (1 - back) : 0;
          const pitch = slashing ? lerp(1.1, 0.15, Math.min(1, wind + cut) * (1 - back)) : 1.1;
          aim(w.obj, yaw + sweep + (slashing ? 0 : 0.5), pitch);
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
