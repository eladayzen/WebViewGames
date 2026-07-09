import * as THREE from 'three';
import { BASE_SPEED, MAX_SPEED } from './constants.js';

const BASE_FOV = 62;
const FOV_KICK = 9;
const FOV_LERP = 0.06;
const FOLLOW_LERP = 0.12;
const LEAN_SCALE = 0.55; // fraction of the car's own bank angle
const SWAY_FREQ = 0.35;
const SWAY_AMP = 0.02;
const SHAKE_DECAY = 8; // per second

export function createCameraRig(camera) {
  camera.fov = BASE_FOV;
  camera.updateProjectionMatrix();
  return { camera, shake: 0, time: 0 };
}

export function triggerShake(rig, intensity) {
  rig.shake = Math.max(rig.shake, intensity);
}

export function updateCameraRig(rig, player, dt, speed) {
  const { camera } = rig;
  rig.time += dt;

  const targetX = player.position.x * 0.5;
  camera.position.x += (targetX - camera.position.x) * FOLLOW_LERP;
  camera.position.y = 3.0;
  camera.position.z = 8.0;

  // Idle sway, added after the follow lerp so it never fights it.
  camera.position.x += Math.sin(rig.time * SWAY_FREQ * Math.PI * 2) * SWAY_AMP;
  camera.position.y += Math.sin(rig.time * SWAY_FREQ * 1.7 * Math.PI * 2) * SWAY_AMP * 0.6;

  // Screen shake: single decaying scalar, applied as random jitter.
  rig.shake = Math.max(rig.shake - SHAKE_DECAY * dt, 0);
  if (rig.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * rig.shake;
    camera.position.y += (Math.random() - 0.5) * rig.shake;
  }

  camera.lookAt(player.position.x * 0.3, 1.0, -20);
  // Roll with the car's own bank angle -- applied after lookAt (which resets
  // orientation every frame) so this is an absolute roll, not a compounding one.
  camera.rotateZ(-player.rotation.z * LEAN_SCALE);

  const speedT = THREE.MathUtils.clamp((speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED), 0, 1);
  const targetFov = BASE_FOV + speedT * FOV_KICK;
  camera.fov += (targetFov - camera.fov) * FOV_LERP;
  camera.updateProjectionMatrix();
}
