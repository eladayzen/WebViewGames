// Fixed third-person follow rig (build doc §5.1, §9.1): eases toward
// Leonardo's current lane x on every lane-shift rather than snapping --
// reusing the technique proven in CarRacer/src/camera-rig.js
// (FOLLOW_LERP-style easing, lookAt reset pattern) as the established
// building block for this exact job, not a copy of that file's car-racing
// tuning. No banking/roll here -- POC's placeholder billboard doesn't need
// it, and §5.1 explicitly says this game never needs camera curve/banking.
//
// Damage shake also ported from CarRacer's rig (one decaying scalar applied
// as random jitter) -- but NOT verbatim: that version has a feedback bug
// which would bite this rig harder. See updateCameraRig.

import {
  CAMERA_FOLLOW_LERP, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z, CAMERA_LOOKAHEAD_Z,
  CAMERA_LOOKAHEAD_Y, LANE_X, CENTER_LANE,
} from '../data/constants.js';

const SHAKE_DECAY = 8; // magnitude lost per second -- same as CarRacer's rig

export function createCameraRig(camera) {
  camera.position.set(LANE_X[CENTER_LANE], CAMERA_OFFSET_Y, CAMERA_OFFSET_Z);
  return {
    camera,
    // The UN-shaken follow position -- deliberately NOT camera.position.x.
    // See updateCameraRig's feedback note.
    baseX: LANE_X[CENTER_LANE],
    shake: 0,
  };
}

// Called on a fresh run (core/main.js's fullReset) so a quick retry doesn't
// inherit the death shake still decaying, or ease in from wherever the camera
// happened to be sitting when the previous run ended.
export function resetCameraRig(rig) {
  rig.shake = 0;
  rig.baseX = LANE_X[CENTER_LANE];
  rig.camera.position.x = rig.baseX;
}

// Takes the max rather than overwriting, so a small shake can never cut short
// a bigger one already in progress.
export function triggerCameraShake(rig, intensity) {
  rig.shake = Math.max(rig.shake, intensity);
}

// elevationY (entities/platform.js's height system, default 0): rides up
// with the player's own elevation (entities/player.js's player.elevationY)
// so the camera stays at the same relative offset/framing whether he's on
// the street or an elevated deck, instead of the deck appearing to sink
// into the ground the higher he climbs.
//
// `dt` drives ONLY the shake -- deliberately not used to normalize
// CAMERA_FOLLOW_LERP, whose raw per-frame feel is already tuned. Pass dt = 0
// to hold the shake frozen (core/main.js does this while paused): that stops
// the decay AND skips applying jitter, so a paused screen sits perfectly
// still instead of vibrating in place indefinitely.
//
// WHY baseX EXISTS: the follow is an INTEGRATOR -- it eases x toward the
// target by reading its own previous value. Write jitter straight into
// camera.position.x (as CarRacer's rig does) and the next frame's lerp treats
// the shaken position as the camera's real position, turning independent
// jitter into a correlated random walk at roughly twice the intended
// amplitude: it reads as drunken drift rather than a crisp jolt, and it drags
// the lane follow along with it. So the lerp runs on baseX and jitter is
// added on top each frame, never feeding back.
//
// This rig needs that care MORE than CarRacer's did, because the lookAt
// target below is derived from the CAMERA's x (CarRacer's reads the player's)
// -- a shaken position.x would swing the aim point by 40% too and partially
// cancel the jolt. Aiming from baseX keeps the target still while the camera
// translates, which adds a small yaw snap on top of the pan: punchier than a
// pure sideways slide.
export function updateCameraRig(rig, playerX, elevationY = 0, dt = 0) {
  const { camera } = rig;

  rig.baseX += (playerX - rig.baseX) * CAMERA_FOLLOW_LERP;

  if (dt > 0 && rig.shake > 0) {
    rig.shake = Math.max(rig.shake - SHAKE_DECAY * dt, 0);
  }
  const shaking = dt > 0 && rig.shake > 0;
  camera.position.x = rig.baseX + (shaking ? (Math.random() - 0.5) * rig.shake : 0);
  camera.position.y = CAMERA_OFFSET_Y + elevationY
    + (shaking ? (Math.random() - 0.5) * rig.shake : 0);
  camera.position.z = CAMERA_OFFSET_Z;

  // Must stay last: lookAt overwrites orientation wholesale, so any rotation
  // set before it is silently discarded. Aims from baseX, never the shaken
  // position (see above).
  camera.lookAt(rig.baseX * 0.4, CAMERA_LOOKAHEAD_Y + elevationY, CAMERA_LOOKAHEAD_Z);
}
