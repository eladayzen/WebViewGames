// DRAWING THE FOOT CLAN -- now a real rigged character with its own motion.
//
// WHAT CHANGED AND WHY IT WAS CHEAP. This drew the licensed Foot Soldier
// maquette: a static 7k-triangle mesh, slid and bobbed, because nothing with
// a walk cycle existed. Elad bought two character packs, and the advice that
// came with them was that FBX into a JS game means rendering sprite sheets or
// "converting to glTF and pulling in three.js -- real work, not an import
// step". True of a 2D canvas game; this one is already three.js and already
// loads a rigged glb, so the whole job was one node script
// (tools/make-skeleton.mjs) and the pack's three clips came through intact.
//
// ONE MIXER PER ENEMY, and that is not negligence -- it is what a skinned
// crowd costs. Each slot is a SkeletonUtils.clone of the same glb, so the
// geometry and the material are shared and only the bone matrices are
// per-enemy. Sixteen of those is sixteen skinned draw calls on a low-poly
// character, which is what the pool was already costing as static meshes.
//
// THE SIM OWNS THE TIMING, NOT THE CLIP. The attack animation is 1.5s long and
// the swing it has to serve is windupS + recoverS = 0.95s. So the clip is
// SCRUBBED -- its time is set directly from the sim's own state clock -- rather
// than played and hoped for. That way the frame where the blade is furthest
// forward lands on the frame the damage is committed, which is the entire
// point of having a telegraph, and it stays true if those numbers are tuned.
//
//   ?enemyh=1.55  how tall they stand, in units
//   ?enemyyaw=0   degrees, if the pack faces the wrong way
//   ?walkcad=1    scales the walk cycle against ground speed
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { u } from './units.js';
import { FOE } from '../core/foes.js';

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return Number.isFinite(v) && QS.get(k) !== null ? v : d;
};

export const ENEMY = {
  // 2.10, WHICH IS 30% UP ON THE 1.62 THIS SHIPPED AT -- Elad, after seeing
  // them on the plaza. Raphael is 1.55, so they now stand well over him.
  // That is the right direction for the same reason 1.62 was: a skeleton
  // reads thinner than it measures, and an enemy you do not have to look up
  // at is not something you back away from.
  height: num('enemyh', 2.1),
  yaw: (num('enemyyaw', 0) * Math.PI) / 180,
  cadence: num('walkcad', 1),
  pool: 16,
};

// WHICH ENEMY IS ON THE PLAZA.
//
// Both entries carry the same contract -- one glb, one unit tall, feet on the
// floor, clips named idle/walk/attack -- so nothing below this line knows or
// cares which pack a character came from.
//
// ONLY THE SKELETON SHIPS. The Fantasy Rivals route works -- see
// tools/make-rival.mjs, which retargets our Mixamo clips onto any of the
// pack's twenty characters through one 22-line bone map -- but its posture
// still needs a bind-pose correction, and an enemy that is nearly right is
// not something to put in front of a child on a board. The tool stays; the
// 1 MB of half-finished character does not go in the build.
export const ENEMIES = {
  skeleton: { glb: 'models/skeleton.glb', tex: 'tex/skeleton.webp' },
};
export const ENEMY_KIND = ENEMIES[QS.get('enemy')] ? QS.get('enemy') : 'skeleton';

/** mesh, skeleton and three clips, in one file. */
export async function loadEnemy(
  url = ENEMIES[ENEMY_KIND].glb,
  atlasUrl = ENEMIES[ENEMY_KIND].tex,
) {
  const [gltf, map] = await Promise.all([
    new GLTFLoader().loadAsync(url),
    new THREE.TextureLoader().loadAsync(atlasUrl),
  ]);
  map.colorSpace = THREE.SRGBColorSpace;
  map.flipY = false;                 // glTF convention, not the image's
  const clips = {};
  for (const c of gltf.animations) clips[c.name] = c;

  // BIND THE TRACKS TO THE BONES THAT ACTUALLY EXIST.
  //
  // A pack that ships ten characters in one FBX gives them all the same bone
  // names, so by the time a single character has been through FBXLoader,
  // GLTFExporter and GLTFLoader its `Hips` may be called `Hips_4`. The clips
  // still say `Hips`, every track binds to nothing, and the character stands
  // in its bind pose for ever with NOTHING reporting a problem -- measured
  // the first time as a bone that moved 0.0000 units over fifty frames.
  //
  // Fixing it in the export tool kept losing, because the suffix is added
  // after the tool has finished looking. Here the bones and the clips are
  // the very objects about to be used, so the match cannot drift.
  {
    const canon = new Map();
    gltf.scene.traverse((o) => {
      if (o.isBone) canon.set(o.name.replace(/_\d+$/, ''), o.name);
    });
    let fixed = 0;
    const known = new Set();
    gltf.scene.traverse((o) => { if (o.isBone) known.add(o.name); });
    for (const c of Object.values(clips)) {
      for (const t of c.tracks) {
        const i = t.name.indexOf('.');
        const who = t.name.slice(0, i);
        if (known.has(who)) continue;
        const real = canon.get(who);
        if (real) { t.name = real + t.name.slice(i); fixed++; }
      }
    }
    if (fixed) console.info(`enemy clips: re-bound ${fixed} track(s) to suffixed bone names`);
  }

  // NORMALISE BY MEASURING THE POSED SKIN, not by trusting the file.
  //
  // Scaling the node that holds a SkinnedMesh does not reliably scale the
  // SKINNED result -- the bind matrices were captured before the scale and
  // cancel it out -- so an export tool cannot normalise a rigged character
  // just by scaling its root. One pack came through at 1 unit and another at
  // 180.9 however its root was scaled, and the only symptom of the second was
  // a blob shadow in the right place with nothing above it: the camera was
  // standing inside a 380-unit giant.
  //
  // Walking the posed vertices is a few thousand reads, once, at load, and it
  // is a number that cannot be wrong for any pack.
  gltf.scene.updateMatrixWorld(true);
  let skinned = null;
  gltf.scene.traverse((o) => { if (o.isSkinnedMesh && !skinned) skinned = o; });
  let nativeH = 1;
  if (skinned) {
    const pos = skinned.geometry.attributes.position;
    const v = new THREE.Vector3();
    let lo = Infinity, hi = -Infinity;
    const stride = Math.max(1, Math.floor(pos.count / 400));
    for (let i = 0; i < pos.count; i += stride) {
      v.fromBufferAttribute(pos, i);
      skinned.applyBoneTransform(i, v);
      skinned.localToWorld(v);
      if (v.y < lo) lo = v.y;
      if (v.y > hi) hi = v.y;
    }
    if (hi > lo) nativeH = hi - lo;
  }
  return { scene: gltf.scene, clips, nativeH, footY: 0 };
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.5)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createFoes(scene, enemy, atlas) {
  const group = new THREE.Group();
  scene.add(group);

  const TELL = new THREE.Color(0xff5a3c);     // the windup
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture(), transparent: true, depthWrite: false, fog: false,
  });
  const slots = [];

  for (let i = 0; i < ENEMY.pool; i++) {
    const holder = new THREE.Group();
    const body = cloneSkinned(enemy.scene);
    // ENEMY.height is the height we WANT; nativeH is what the file actually
    // skins out to. One pack ships at 1.0 and another at 180.9.
    body.scale.setScalar(ENEMY.height / (enemy.nativeH || 1));

    // Own material per slot -- the hit flash and the windup tell are per
    // enemy, and one shared material would flash the whole clan at once. The
    // MAP and the geometry stay shared, which is where the memory is.
    let mat = null;
    body.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      mat = new THREE.MeshLambertMaterial({ map: atlas, color: 0xffffff });
      o.material = mat;
    });

    const mixer = new THREE.AnimationMixer(body);
    const act = {};
    for (const [name, clip] of Object.entries(enemy.clips)) {
      const a = mixer.clipAction(clip);
      a.play();
      a.setEffectiveWeight(0);
      act[name] = a;
    }
    // The attack is scrubbed by hand, so the mixer must not advance it.
    if (act.attack) act.attack.timeScale = 0;

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    shadow.scale.setScalar(ENEMY.height * 0.55);

    holder.add(shadow, body);
    holder.visible = false;
    group.add(holder);
    slots.push({ holder, body, mat, shadow, mixer, act, walked: 0 });
  }

  const BASE = new THREE.Color(0xffffff);

  function poseOne(s, f, dt, timeS) {
    const { holder, body, mat, act } = s;
    holder.position.set(u(f.x), 0, u(f.y));
    // The sim's (dx, dy) maps to the scene's (x, z); a yaw of atan2(x, z)
    // points a +Z-facing mesh along it. Same convention as the player's rig.
    holder.rotation.y = Math.atan2(Math.cos(f.facing), Math.sin(f.facing)) + ENEMY.yaw;

    const swinging = f.state === 'windup' || f.state === 'recover';
    const moving = f.stepped > 0.0001;

    if (act.attack) {
      // SCRUBBED FROM THE SIM'S CLOCK. `span` is the whole swing the sim
      // runs; mapping the clip across it puts the blade's furthest reach on
      // the frame the damage is actually committed.
      const span = FOE.windupS + FOE.recoverS;
      const into = f.state === 'windup' ? f.stateT : FOE.windupS + f.stateT;
      const d = act.attack.getClip().duration;
      act.attack.time = Math.max(0, Math.min(d, (into / span) * d));
      act.attack.setEffectiveWeight(swinging ? 1 : 0);
    }
    if (act.walk) {
      act.walk.setEffectiveWeight(!swinging && moving ? 1 : 0);
      act.walk.timeScale = ENEMY.cadence;
    }
    if (act.idle) act.idle.setEffectiveWeight(!swinging && !moving ? 1 : 0);

    s.mixer.update(dt);

    // --- colour: the telegraph, the hit flash, and the fade on death.
    mat.color.copy(BASE);
    if (f.state === 'windup') {
      const k = Math.min(1, f.stateT / FOE.windupS);
      mat.color.copy(BASE).lerp(TELL, 0.25 + 0.6 * k);
    } else if (f.state === 'recover') {
      const k = Math.min(1, f.stateT / (FOE.recoverS * 0.3));
      mat.color.copy(BASE).lerp(TELL, 0.5 * (1 - k));
    }
    if (f.hitT > 0) mat.color.lerp(new THREE.Color(0xff3020), 0.8);

    if (!f.alive) {
      // GONE ON THE FRAME IT DIES. The body is replaced by what it was made
      // of -- see render/debris.js. The previous version folded it forward
      // and sank it through the floor over 1.2 seconds, which reads as a
      // corpse politely lying down and melting: the wrong note for a hit
      // that is meant to land, and 1.2 seconds of clutter in an arena whose
      // whole camera argument is that a crowd stays readable.
      holder.visible = false;
    } else {
      body.rotation.x = 0;
      body.position.y = 0;
      s.shadow.visible = true;
    }
  }

  /** Put the pool onto the live foes. Extra slots are hidden, not destroyed. */
  function syncFoes(foes, timeS, dt = 0) {
    for (let i = 0; i < slots.length; i++) {
      const f = foes[i];
      if (!f) { slots[i].holder.visible = false; continue; }
      slots[i].holder.visible = true;
      poseOne(slots[i], f, dt, timeS);
    }
  }

  return { group, slots, syncFoes };
}
