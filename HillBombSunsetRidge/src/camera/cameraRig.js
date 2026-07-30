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

  const _desired = new THREE.Vector3();
  const _lookTarget = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();

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
      const speedN = Math.min(1, s.speed / SPEED_REF);

      _fwd.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
      _right.set(_fwd.z, 0, -_fwd.x);

      const back = CAM_BACK + CAM_PULLBACK * speedN;

      // Behind + above + a fixed over-the-shoulder offset. No orbit term at all.
      _desired.copy(s.pos)
        .addScaledVector(_fwd, back)
        .addScaledVector(_right, CAM_SHOULDER);
      _desired.y += CAM_HEIGHT - landDip * 0.35;

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
        .addScaledVector(_fwd, -CAM_LOOK_AHEAD)
        .addScaledVector(_right, CAM_SHOULDER * 0.5);
      _lookTarget.y += CAM_LOOK_HEIGHT;

      look.lerp(_lookTarget, 1 - Math.exp(-9 * dt));
      camera.lookAt(look);

      const fov = FOV_BASE + (FOV_AT_SPEED - FOV_BASE) * speedN;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }

      landDip = Math.max(0, landDip - dt * 3.2);
    },
  };
}
