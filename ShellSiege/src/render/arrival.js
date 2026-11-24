// THE ARRIVAL: at the start of every room the turtle is TELEPORTED IN. A beam of light drops onto the
// spot, two rings run out across the floor, sparkles lift off, and the turtle snaps into being inside
// it -- thin and tall first, then settling to size with a small bounce. It plays over the room's
// intro (about a second) and is only drawing: nothing here touches the sim.
import * as THREE from 'three';
import { glowTexture } from './stage.js';

const DUR = 1.05;        // seconds, start to finish
const APPEAR = 0.22;     // the turtle is hidden until this moment, then snaps in
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeBack = (k) => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

export function createArrival(scene, rig) {
  const add = { blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false };
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const beamMat = new THREE.MeshBasicMaterial({ color: 0x8dffe0, side: THREE.DoubleSide, ...add });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 9, 24, 1, true), beamMat);
  beam.position.y = 4.5;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 9, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, ...add }));
  core.position.y = 4.5;
  const rings = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), new THREE.MeshBasicMaterial({ color: 0xaaffe6, side: THREE.DoubleSide, ...add }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.05;
    return m;
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(210,255,240,1)', 'rgba(60,230,180,0)'), ...add }));
  glow.position.y = 0.9;
  const sparkMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(140,255,220,0)'), ...add });
  const sparks = Array.from({ length: 14 }, (_, i) => {
    const s = new THREE.Sprite(sparkMat.clone());
    s.userData = { a: (i / 14) * Math.PI * 2 + (i % 3) * 0.4, r: 0.4 + (i % 4) * 0.22, v: 1.4 + (i % 5) * 0.5 };
    return s;
  });
  group.add(beam, core, ...rings, glow, ...sparks);

  let t = DUR;           // finished until started
  let started = false;

  function start() { t = 0; started = true; }

  /** Call every frame AFTER rig.place. `dt` is the sim's, so slow motion and pauses carry over. */
  function update(dt) {
    if (t >= DUR) {
      if (started) { started = false; group.visible = false; rig.root.visible = true; rig.root.scale.set(1, 1, 1); }
      return;
    }
    t += dt;
    const k = Math.min(1, t / DUR);
    group.visible = true;
    group.position.set(rig.root.position.x, 0, rig.root.position.z);

    // the turtle: hidden, then thin and tall, then settling with a bounce
    if (t < APPEAR) rig.root.visible = false;
    else {
      rig.root.visible = true;
      const a = Math.min(1, (t - APPEAR) / 0.4), b = easeBack(a);
      rig.root.scale.set(0.15 + 0.85 * b, 2.2 - 1.2 * b, 0.15 + 0.85 * b);
    }

    // the beam drops in fast, holds, then narrows to nothing as the turtle settles
    const drop = Math.min(1, t / 0.18), fade = k < 0.5 ? 1 : Math.max(0, 1 - (k - 0.5) / 0.5);
    const w = (0.35 + 0.65 * easeOut(drop)) * (k < 0.4 ? 1 : Math.max(0.05, 1 - (k - 0.4) / 0.6));
    beam.scale.set(w * 0.85, 1, w * 0.85); beamMat.opacity = 0.42 * fade * drop;
    core.scale.set(w, 1, w); core.material.opacity = 0.8 * fade * drop;
    rings.forEach((r, i) => {
      const rk = Math.max(0, Math.min(1, (t - 0.1 - i * 0.18) / 0.6));
      r.visible = rk > 0 && rk < 1;
      r.scale.setScalar(0.3 + 3.2 * easeOut(rk)); r.material.opacity = 0.9 * (1 - rk);
    });
    glow.scale.setScalar(2.4 + 1.2 * Math.sin(Math.min(1, t / 0.4) * Math.PI)); glow.material.opacity = 0.9 * fade;
    for (const s of sparks) {
      const d = s.userData, sk = Math.max(0, Math.min(1, (t - 0.15) / 0.8));
      s.position.set(Math.cos(d.a + t * 3) * d.r * (1 + sk), 0.2 + d.v * sk * 1.6, Math.sin(d.a + t * 3) * d.r * (1 + sk));
      s.scale.setScalar(0.28 * (1 - sk * 0.6)); s.material.opacity = sk > 0 ? 1 - sk : 0;
    }
  }

  return { start, update, get active() { return t < DUR; } };
}
