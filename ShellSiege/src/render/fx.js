// WHAT IS SHOT AT, AND WHAT IS SHOT.
//
// The weapon in hand is switched from the URL (core/weapon.js); this draws
// whichever it is. Both are flat quads rather than camera-facing sprites --
// see below -- and both spin, because both are thrown.
//
// THE SHOTS ARE THROWN, not fired, and that is not a reskin. Sewer
// Shred's attack audition already noticed it: the Mixamo clips that do not
// work as melee work as THROWS (see `~/Documents/3d/fightAnimations/TAGS.md`).
// A turtle who throws is a turtle whose auto-attack can be animated from
// clips that already exist, and a star that leaves the hand is readable at
// this camera angle in a way a muzzle flash is not.
//
// They are drawn as flat spinning quads lying ON the ground plane rather than
// as camera-facing sprites. A sprite would turn to face the camera and read as
// a coin flipping; a flat quad spinning on its own axis reads as a shuriken
// skimming over the stone, which is what it is.
import * as THREE from 'three';
import { u } from './units.js';
import { glowTexture } from './stage.js';
import { WEAPON } from '../core/weapon.js';

const MAX_SHOTS = 160;

export function createFx(scene, tex) {
  // --- crates -------------------------------------------------------------
  tex.crate.colorSpace = THREE.SRGBColorSpace;
  const crateGeo = new THREE.BoxGeometry(1, 1, 1);
  const crates = [];

  function crateMesh() {
    // Its own material so a hit can flash THIS crate. Fourteen materials is
    // nothing; one shared material would flash the whole range at once, which
    // is worse than no feedback because it tells the player the wrong thing.
    const mesh = new THREE.Mesh(crateGeo, new THREE.MeshLambertMaterial({ map: tex.crate }));
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({
        map: glowTexture('rgba(0,0,0,0.7)', 'rgba(0,0,0,0)'),
        transparent: true, depthWrite: false, opacity: 0.5, fog: false,
      }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.012;
    const g = new THREE.Group();
    g.add(mesh, blob);
    scene.add(g);
    return { g, mesh, blob };
  }

  function syncCrates(targets, timeS) {
    while (crates.length < targets.length) crates.push(crateMesh());
    // The pool only ever grows, so anything past the end of the list is a
    // mesh left standing where a target used to be. Without this it keeps
    // being drawn, and the player shoots at crates that are not there.
    for (let i = targets.length; i < crates.length; i++) crates[i].g.visible = false;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const c = crates[i];
      const size = u(t.radius) * 1.7;
      c.g.position.set(u(t.x), 0, u(t.y));
      c.g.rotation.y = t.spin;

      // A crate that has just been stood back up pops in; one that has just
      // been broken drops away. Both are short, because the range exists to
      // keep something in front of the gun, not to be watched.
      let k = 1;
      if (!t.alive) k = Math.max(0, 1 - (timeS - t.deadAtS) / 0.22);
      else if (t.bornAtS !== undefined) k = Math.min(1, (timeS - t.bornAtS) / 0.18);
      c.g.visible = k > 0.01;
      c.mesh.scale.set(size * k, size * k, size * k);
      c.mesh.position.y = (size * k) / 2;
      c.blob.scale.setScalar(k * 1.1);
      c.blob.visible = t.alive;

      // Hit flash, and a lean away from the shot. Damage you cannot see is
      // damage the player assumes did not land.
      const f = t.hitT / 0.09;
      c.mesh.material.emissive.setRGB(f * 0.55, f * 0.42, f * 0.18);
      c.mesh.rotation.z = f * 0.07;
      // Darken as it takes damage, so a nearly-broken crate reads as nearly
      // broken before it disappears.
      const hp = Math.max(0, t.hp / t.maxHp);
      c.mesh.material.color.setScalar(0.55 + hp * 0.45);
    }
  }

  // --- what he throws -----------------------------------------------------
  const art = WEAPON.name === 'sai' ? tex.sai : tex.shuriken;
  art.colorSpace = THREE.SRGBColorSpace;
  // A long weapon needs a long quad, or the sai arrives squashed into a square.
  const starGeo = new THREE.PlaneGeometry(WEAPON.aspect, 1);
  const starMat = new THREE.MeshBasicMaterial({
    map: art, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
  });
  const trailMat = new THREE.SpriteMaterial({
    map: glowTexture('rgba(190,255,230,1)', 'rgba(60,230,160,0)'),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
  });

  const shots = [];
  for (let i = 0; i < MAX_SHOTS; i++) {
    const star = new THREE.Mesh(starGeo, starMat);
    star.rotation.x = -Math.PI / 2;      // lying flat, skimming the stone
    star.scale.setScalar(u(WEAPON.sizePx));
    const trail = new THREE.Sprite(trailMat);
    trail.scale.set(u(WEAPON.sizePx) * 1.1, u(WEAPON.sizePx) * 1.1, 1);
    const g = new THREE.Group();
    g.add(trail, star);
    g.visible = false;
    scene.add(g);
    shots.push({ g, star });
  }

  function syncShots(bullets, timeS, muzzleY) {
    let i = 0;
    for (const b of bullets) {
      if (!b.alive || i >= MAX_SHOTS) continue;
      const s = shots[i++];
      s.g.visible = true;
      // Thrown from the hand and settling toward knee height as it travels --
      // a star that stays at shoulder height looks like it is floating.
      // THE RETURN FLIES LOWER THAN THE THROW. Coming home it is a blade
      // skimming the stone rather than a thrown weapon at shoulder height,
      // which separates the two legs of the journey at a glance -- the arc
      // alone is not enough to read at this camera distance.
      const y = b.mode === 'back' ? 0.42 : Math.max(0.38, muzzleY - 0.12);
      s.g.position.set(u(b.x), y, u(b.y));
      s.star.rotation.z = timeS * WEAPON.spinRadS * (b.mode === 'back' ? -1 : 1);
    }
    for (; i < MAX_SHOTS; i++) shots[i].g.visible = false;
  }

  // --- impact sparks ------------------------------------------------------
  const sparkMat = new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,236,190,1)', 'rgba(255,150,40,0)'),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
  });
  const sparks = [];
  for (let i = 0; i < 24; i++) {
    const s = new THREE.Sprite(sparkMat.clone());
    s.visible = false;
    scene.add(s);
    sparks.push({ s, t: 0 });
  }
  let sparkI = 0;
  function spark(simX, simY, y) {
    const p = sparks[sparkI = (sparkI + 1) % sparks.length];
    p.s.position.set(u(simX), y, u(simY));
    p.s.visible = true;
    p.t = 0.2;
  }
  function updateSparks(dt) {
    for (const p of sparks) {
      if (p.t <= 0) continue;
      p.t -= dt;
      const k = Math.max(0, p.t / 0.2);
      p.s.material.opacity = k;
      p.s.scale.setScalar(0.5 + (1 - k) * 1.3);
      if (p.t <= 0) p.s.visible = false;
    }
  }

  return { syncCrates, syncShots, spark, updateSparks };
}
