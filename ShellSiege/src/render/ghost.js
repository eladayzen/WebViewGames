// THE DECOY IS A GHOST RAPHAEL: a second copy of the turtle, standing in its idle animation, drawn in
// a different shader from the real one -- a translucent, glowing cyan hologram with a bright rim and a
// scan-line shimmer -- so nobody mistakes it for the player. Foes chase it (core/powers.js).
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { IDLE } from '../core/clipsets.js';
import { u } from './units.js';

export async function createGhost(scene, rig) {
  const root = new THREE.Group();
  const scaler = new THREE.Group();
  // the same placement the real rig uses: the model's own scale and its feet on the floor
  scaler.scale.copy(rig.root.children[0].scale);
  scaler.position.copy(rig.root.children[0].position);
  const body = cloneSkinned(rig.model);
  scaler.add(body); root.add(scaler);

  const uni = { uTime: { value: 0 }, uHit: { value: 0 } };
  body.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const src = o.material;
    const m = new THREE.MeshBasicMaterial({ map: src.map || null, color: 0x7fe8ff, transparent: true, opacity: 0.62, depthWrite: false });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uni.uTime; sh.uniforms.uHit = uni.uHit;
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', 'uniform float uTime;\nuniform float uHit;\nvarying vec3 vGN;\nvarying vec3 vGV;\nvoid main() {')
        .replace('#include <opaque_fragment>', `
          float rim = pow(1.0 - clamp(abs(normalize(vGN).z), 0.0, 1.0), 1.8);
          float scan = 0.5 + 0.5 * sin(gl_FragCoord.y * 0.5 - uTime * 9.0);
          outgoingLight = outgoingLight * 0.7 + vec3(0.25, 0.9, 1.0) * (0.25 + rim * 1.2) + vec3(0.1, 0.3, 0.4) * scan * 0.35;
          outgoingLight = mix(outgoingLight, vec3(1.0, 0.5, 0.5), uHit);
          diffuseColor.a *= 0.55 + 0.35 * rim + 0.1 * scan;
          #include <opaque_fragment>`);
      sh.vertexShader = sh.vertexShader
        .replace('void main() {', 'varying vec3 vGN;\nvarying vec3 vGV;\nvoid main() {')
        .replace('#include <project_vertex>', '#include <project_vertex>\n  vGN = normalize(normalMatrix * objectNormal); vGV = -mvPosition.xyz;');
    };
    m.customProgramCacheKey = () => 'ghost-v1';
    o.material = m;
  });

  // IDLE, looped: the clip is read from the same clips.json the real rig uses
  const mixer = new THREE.AnimationMixer(body);
  try {
    const res = await fetch('models/clips.json');
    const data = res.ok ? await res.json() : null;
    const json = data && (data[IDLE] || Object.values(data)[0]);
    if (json) { const a = mixer.clipAction(THREE.AnimationClip.parse(json)); a.play(); }
  } catch { /* a ghost standing in bind pose is better than no ghost */ }

  root.visible = false;
  scene.add(root);

  /** `d` is w.decoy (or null). Fades in, bobs, flickers more as it nears its end. */
  function sync(d, timeS, dt) {
    root.visible = !!d;
    if (!d) return;
    mixer.update(dt);
    const left = Math.max(0, 1 - d.age / d.lifeS);
    const fade = Math.min(1, d.age / 0.3);
    root.position.set(u(d.x), 0.05 + 0.06 * Math.sin(timeS * 3), u(d.y));
    root.rotation.y = Math.PI * 0.15;
    const flick = left < 0.3 ? (Math.sin(timeS * 40) > 0 ? 1 : 0.3) : 1;
    root.scale.setScalar(0.4 + 0.6 * fade);
    body.traverse((o) => { if (o.isMesh) o.material.opacity = 0.62 * fade * flick; });
    uni.uTime.value = timeS; uni.uHit.value = d.hitT > 0 ? Math.min(1, d.hitT / 0.12) : 0;
  }
  return { sync };
}
