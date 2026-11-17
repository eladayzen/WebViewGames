// WHAT IS LEFT WHEN A SKELETON STOPS BEING ONE.
//
// The pack has no death clip, and the first version answered that by folding
// the body forward and sinking it through the floor over 1.2 seconds. That is
// the cheapest possible "it died" and it reads as one -- a corpse politely
// lying down and melting -- which is the wrong note for a hit that is supposed
// to feel like a hit. Elad: "when skeleton dies make them disapear + particles
// and dust".
//
// SO IT COMES APART INSTEAD. The body is hidden on the frame it dies and
// replaced by what it was made of: a skull, a few bone pieces, and a puff of
// dust. Nothing lies around afterwards -- the arena stays readable, which
// matters more here than anywhere because the whole camera argument is that a
// player can read a crowd at a glance.
//
// THE DEBRIS IS FROM THE FANTASY RIVALS PACK, and this is the honest use of
// it. That pack has no character animation, so its twenty rigged fighters are
// not enemies without a retargeting job -- but its PROPS need no rig, no clip
// and no retarget. A skull and a pile of bones are exactly what a skeleton
// should come apart into. See tools/make-debris.mjs.
//
// EVERYTHING IS POOLED AND NOTHING ALLOCATES PER DEATH. Ten skeletons dying
// inside a second is a normal moment in this game, and a burst that built
// twelve meshes each time would hitch exactly when the screen is busiest.
//
//   ?debris=7     pieces per death      ?dust=5    dust puffs per death
//   ?debrisS=1.1  how long they last    ?gravity=14
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { u } from './units.js';

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return Number.isFinite(v) && QS.get(k) !== null ? v : d;
};

export const DEBRIS = {
  perDeath: num('debris', 7),
  dustPerDeath: num('dust', 5),
  lifeS: num('debrisS', 1.1),
  gravity: num('gravity', 14),
  // Pool size. Ten enemies may die close together, and a burst that runs out
  // of pieces mid-death looks like a rendering fault rather than like thrift.
  pool: num('debrispool', 90),
  dustPool: num('dustpool', 70),
};

/** The two props, in one 31 KB file with no texture. */
export async function loadDebris(url = 'models/debris.glb') {
  const gltf = await new GLTFLoader().loadAsync(url);
  const geos = {};
  gltf.scene.traverse((o) => { if (o.isMesh) geos[o.name] = o.geometry; });
  return geos;
}

function dustTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createDebris(scene, geos) {
  const group = new THREE.Group();
  scene.add(group);

  // ONE MATERIAL FOR ALL THE BONE, shared. These never flash or tint
  // individually, so there is no reason for each piece to own one -- unlike
  // the enemies, where the windup tell is per body.
  const boneMat = new THREE.MeshLambertMaterial({ color: 0xe8e2d2 });
  const dustMat = new THREE.SpriteMaterial({
    map: dustTexture(), color: 0xcfc4ad, transparent: true,
    depthWrite: false, opacity: 0, fog: true,
  });

  const kinds = Object.keys(geos);
  const pieces = [];
  for (let i = 0; i < DEBRIS.pool; i++) {
    const geo = geos[kinds[i % kinds.length]];
    const m = new THREE.Mesh(geo, boneMat);
    m.visible = false;
    m.frustumCulled = false;
    group.add(m);
    pieces.push({ m, live: false, t: 0, vx: 0, vy: 0, vz: 0, spin: new THREE.Vector3(), size: 1 });
  }

  const dusts = [];
  for (let i = 0; i < DEBRIS.dustPool; i++) {
    // Each puff needs its own opacity, so each needs its own material --
    // sprites have no per-instance alpha.
    const s = new THREE.Sprite(dustMat.clone());
    s.visible = false;
    group.add(s);
    dusts.push({ s, live: false, t: 0, vx: 0, vy: 0, vz: 0, size: 1, lifeS: 1 });
  }

  let nextPiece = 0;
  let nextDust = 0;

  /**
   * Break something apart at a point, in SIM PIXELS.
   * @param scale 1 for an enemy; smaller for a lesser hit.
   */
  function burst(simX, simY, scale = 1) {
    const x = u(simX);
    const z = u(simY);

    for (let i = 0; i < DEBRIS.perDeath; i++) {
      // Round-robin rather than searching for a free slot: at this pool size
      // the oldest piece is always the right one to take, and a scan would be
      // the only per-death cost that grows with the pool.
      const p = pieces[nextPiece = (nextPiece + 1) % pieces.length];
      const a = Math.random() * Math.PI * 2;
      const out = 1.6 + Math.random() * 2.2;
      p.live = true;
      p.t = 0;
      // Sized by looking at one at the real camera distance, not at a
      // close-up: at 0.09-0.19 the pieces were technically present and read as
      // grit. A skull should be recognisably a skull for the half second it is
      // in the air, or the pack may as well not have been used.
      p.size = (0.14 + Math.random() * 0.14) * scale;
      p.m.scale.setScalar(p.size);
      // Start inside the body, not on the floor, so the pieces come OUT of
      // something rather than appearing under it.
      p.m.position.set(x + Math.cos(a) * 0.08, 0.5 + Math.random() * 0.7, z + Math.sin(a) * 0.08);
      p.m.rotation.set(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3);
      p.vx = Math.cos(a) * out;
      p.vz = Math.sin(a) * out;
      p.vy = 2.6 + Math.random() * 2.8;
      p.spin.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
      p.m.visible = true;
    }

    for (let i = 0; i < DEBRIS.dustPerDeath; i++) {
      const d = dusts[nextDust = (nextDust + 1) % dusts.length];
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.4;
      d.live = true;
      d.t = 0;
      d.lifeS = 0.5 + Math.random() * 0.4;
      d.size = (0.7 + Math.random() * 0.6) * scale;
      d.s.position.set(x + Math.cos(a) * r, 0.25 + Math.random() * 0.5, z + Math.sin(a) * r);
      d.vx = Math.cos(a) * 0.5;
      d.vz = Math.sin(a) * 0.5;
      d.vy = 0.5 + Math.random() * 0.5;
      d.s.visible = true;
      d.s.material.opacity = 0.85;
      d.s.scale.setScalar(d.size);
    }
  }

  function update(dt) {
    for (const p of pieces) {
      if (!p.live) continue;
      p.t += dt;
      if (p.t >= DEBRIS.lifeS) { p.live = false; p.m.visible = false; continue; }
      p.vy -= DEBRIS.gravity * dt;
      p.m.position.x += p.vx * dt;
      p.m.position.y += p.vy * dt;
      p.m.position.z += p.vz * dt;
      const floor = p.size * 0.4;
      if (p.m.position.y < floor) {
        // One soft bounce, then it is done moving. A piece that keeps
        // bouncing draws the eye to the floor for the rest of its life.
        p.m.position.y = floor;
        p.vy *= -0.32;
        p.vx *= 0.55;
        p.vz *= 0.55;
        p.spin.multiplyScalar(0.5);
      }
      p.m.rotation.x += p.spin.x * dt;
      p.m.rotation.y += p.spin.y * dt;
      p.m.rotation.z += p.spin.z * dt;
      // Shrink away over the last third rather than vanishing on a frame.
      const k = p.t / DEBRIS.lifeS;
      p.m.scale.setScalar(p.size * (k > 0.66 ? 1 - (k - 0.66) / 0.34 : 1));
    }

    for (const d of dusts) {
      if (!d.live) continue;
      d.t += dt;
      const k = d.t / d.lifeS;
      if (k >= 1) { d.live = false; d.s.visible = false; continue; }
      d.s.position.x += d.vx * dt;
      d.s.position.y += d.vy * dt;
      d.s.position.z += d.vz * dt;
      d.vy *= 0.94;
      // Dust expands as it thins -- that pairing is what makes it read as
      // dust rather than as a fading dot.
      d.s.scale.setScalar(d.size * (1 + k * 1.9));
      d.s.material.opacity = 0.85 * (1 - k) * (1 - k);
    }
  }

  return { group, burst, update, pieces, dusts };
}
