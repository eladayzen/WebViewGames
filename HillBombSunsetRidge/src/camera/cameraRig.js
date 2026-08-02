// Camera rig — FORTNITE-STYLE STEADY THIRD-PERSON.
//
// DELIBERATE REVERSAL of the earlier design (and of the build doc's §5.2
// "trick swing"). Amit's direct direction: the swinging/orbiting trick camera is
// the arcade-runner move that HalfShellHustle-type games reach for to fake an
// "action vibe", and he does NOT want it here -- he wants a Fortnite camera, and
// he does not want the character re-angling itself either.
//
// So this rig is intentionally BORING and STABLE:
//   - parked behind and slightly above the rider, with a small over-the-shoulder
//     lateral offset (the Fortnite signature);
//   - it does NOT orbit, does NOT leave its rig for tricks, does NOT roll with
//     the carve;
//   - it tracks laterally with a gentle lag so a turn still reads as a turn, but
//     the horizon stays level and the framing stays predictable;
//   - FOV breathes only slightly with speed. Enough to feel velocity, far short
//     of the old FOV pumping.
//
// Consequence worth noting: killing the swing also kills the build doc's §12
// risk (whether a flat sprite billboard survives an orbiting camera). With a
// camera that stays behind the rider, a billboard never has to show its side --
// so mode A vs mode B is now purely a question of visual quality, not of camera
// compatibility.

import * as THREE from 'three';
import {
  CAM_BACK, CAM_HEIGHT, CAM_LERP, CAM_LAG_AT_FULL_CARVE,
  CAM_SHOULDER, CAM_LOOK_AHEAD, CAM_LOOK_HEIGHT,
  FOV_BASE, FOV_AT_SPEED, CAM_PULLBACK, SPEED_REF,
} from '../data/constants.js';

export function createCameraRig(camera) {
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  let started = false;
  let landDip = 0;
  let shakeT = 0;

  const _desired = new THREE.Vector3();
  const _lookTarget = new THREE.Vector3();
  const _back = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const camUp = new THREE.Vector3(0, 1, 0);
  const _WORLD_UP = new THREE.Vector3(0, 1, 0);

  return {
    /** Small vertical compression on landing. Kept -- it's a settle, not a swing. */
    onLand() {
      landDip = 1;
    },

    reset() {
      started = false;
      landDip = 0;
    },

    update(s, dt) {
      shakeT += dt;
      const speedN = Math.min(1, s.speed / SPEED_REF);

      // Orthonormal basis from the trough itself: forward along the tangent,
      // up along the surface normal. `_back` is what the camera sits along.
      _up.copy(s.surfaceUp);
      _back.copy(s.forward).negate();
      _right.crossVectors(_up, _back).normalize();

      const back = CAM_BACK + CAM_PULLBACK * speedN;

      // Behind + above + a fixed over-the-shoulder offset. No orbit term at all.
      _desired.copy(s.pos)
        .addScaledVector(_back, back)
        .addScaledVector(_right, CAM_SHOULDER)
        .addScaledVector(_up, CAM_HEIGHT - landDip * 0.35);

      if (!started) {
        pos.copy(_desired);
        started = true;
      } else {
        // Gentle lag, eased slower the harder the carve, so the rider leads the
        // frame through a turn without the camera ever leaving its rig.
        const lag = 1 - CAM_LAG_AT_FULL_CARVE * Math.abs(s.carve);
        pos.lerp(_desired, 1 - Math.exp(-CAM_LERP * lag * dt));
      }
      camera.position.copy(pos);

      // Aim down-road, slightly above the rider's feet. Horizon stays level:
      // no roll is applied after lookAt, unlike the previous rig.
      _lookTarget.copy(s.pos)
        .addScaledVector(s.forward, CAM_LOOK_AHEAD)
        .addScaledVector(_right, CAM_SHOULDER * 0.5)
        .addScaledVector(_up, CAM_LOOK_HEIGHT);

      look.lerp(_lookTarget, 1 - Math.exp(-9 * dt));
      // Ease the camera's own up toward the surface normal rather than snapping,
      // so a roll reads as a smooth bank instead of a flick.
      camUp.lerp(_up, 1 - Math.exp(-4.5 * dt)).normalize();
      camera.up.copy(camUp);
      camera.lookAt(look);

      // Wobble shake: the fail state has to be felt in the WORLD, not just read
      // off the HUD bar (build doc §7.2). Amplitude ramps with the meter, and
      // it's applied after lookAt so it perturbs the aim rather than the rig.
      if (s.shake > 0) {
        const k = s.shake * 0.035;
        camera.rotateZ((Math.sin(shakeT * 61) + Math.sin(shakeT * 27)) * k);
        camera.rotateX(Math.sin(shakeT * 43) * k * 0.6);
      }

      const fov = FOV_BASE + (FOV_AT_SPEED - FOV_BASE) * speedN;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }

      landDip = Math.max(0, landDip - dt * 3.2);
    },
  };
}
