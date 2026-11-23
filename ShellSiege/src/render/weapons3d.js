// REAL 3D WEAPONS, built from primitives. The sai and the nunchuck are ported from the
// Sewer Shred session's `src/daggers.js` (same owner, same repo): a blade with a tip, two
// curled prongs and a red grip, each part with a fatter dark BackSide copy as cartoon ink.
// Raphael's flat sai picture read as "a shining stick"; this has a silhouette.
import * as THREE from 'three';

const steel = () => new THREE.MeshLambertMaterial({ color: 0xdfe6ee, emissive: 0x4a525c });
const grip = () => new THREE.MeshLambertMaterial({ color: 0xd9302a, emissive: 0x4a0d0a });
const ink = () => new THREE.MeshBasicMaterial({ color: 0x101216, side: THREE.BackSide, fog: false });

/** Add a dark outline copy behind every mesh already in the group. */
function inked(g, k = 1.35) {
  const ink_ = ink();
  for (const m of [...g.children]) {
    const o = new THREE.Mesh(m.geometry, ink_);
    o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.copy(m.scale).multiplyScalar(k);
    g.add(o);
  }
  return g;
}

/** Overall length of the sai along its axis, grip end to tip (for sizing). */
export const SAI_LEN = 1.55;

/** A sai along local +Y, grip centre near the origin. */
export function makeSai() {
  const s = steel(), r = grip();
  const sai = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 1.0, 6), s); blade.position.y = 0.55;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), s); tip.position.y = 1.13;
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.36, 6), r); hilt.position.y = -0.14;
  sai.add(blade, tip, hilt);
  for (const sgn of [-1, 1]) {
    const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.42, 5), s);
    prong.position.set(sgn * 0.13, 0.2, 0); prong.rotation.z = -sgn * 0.5;
    sai.add(prong);
  }
  for (const m of sai.children) { m.frustumCulled = false; }
  return inked(sai);
}

/**
 * A nunchuck along local +Z, in two parts so it can be flailed: `root` is the stick in the
 * hand plus the chain, and `free` is the hinge the second stick hangs from (rotate about X).
 * Returns { group, free }.
 */
export function makeNunchuck({ wood = 0xa8692e, tape = 0xff7a1a, len = 0.62 } = {}) {
  const w = new THREE.MeshLambertMaterial({ color: wood, emissive: 0x3a1e08 });
  const t = new THREE.MeshLambertMaterial({ color: tape, emissive: 0x5a2400 });
  const st = steel();
  const stick = () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, len, 8), w);
    body.rotation.x = Math.PI / 2; body.position.z = len / 2;
    g.add(body);
    for (const z of [len * 0.28, len * 0.8]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.087, 0.087, 0.1, 8), t);
      b.rotation.x = Math.PI / 2; b.position.z = z; g.add(b);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.05, 8), st);
    cap.rotation.x = Math.PI / 2; cap.position.z = len + 0.02; g.add(cap);
    return inked(g, 1.3);
  };
  const group = new THREE.Group();
  const hand = stick();
  hand.position.z = -len * 0.25;               // the grip is a quarter of the way up the stick
  group.add(hand);
  const hinge = new THREE.Group();
  hinge.position.z = len * 0.75 + 0.05;
  const link = new THREE.TorusGeometry(0.045, 0.014, 4, 8);
  for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(link, st); l.position.z = k * 0.045; l.rotation.y = k % 2 ? Math.PI / 2 : 0; hinge.add(l); }
  const free = new THREE.Group();
  free.position.z = 0.14;
  const second = stick();
  free.add(second);
  hinge.add(free);
  group.add(hinge);
  group.traverse((o) => { o.frustumCulled = false; });
  return { group, free };
}
