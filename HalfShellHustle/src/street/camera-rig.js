// Fixed third-person follow rig (build doc §5.1, §9.1): eases toward
// Leonardo's current lane x on every lane-shift rather than snapping --
// reusing the technique proven in CarRacer/src/camera-rig.js
// (FOLLOW_LERP-style easing, lookAt reset pattern) as the established
// building block for this exact job, not a copy of that file's car-racing
// tuning. No banking/roll here -- POC's placeholder billboard doesn't need
// it, and §5.1 explicitly says this game never needs camera curve/banking.

import {
  CAMERA_FOLLOW_LERP, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z, CAMERA_LOOKAHEAD_Z,
  CAMERA_LOOKAHEAD_Y,
} from '../data/constants.js';

export function createCameraRig(camera) {
  camera.position.set(0, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z);
  return { camera };
}

// elevationY (entities/platform.js's height system, default 0): rides up
// with the player's own elevation (entities/player.js's player.elevationY)
// so the camera stays at the same relative offset/framing whether he's on
// the street or an elevated deck, instead of the deck appearing to sink
// into the ground the higher he climbs.
export function updateCameraRig(rig, playerX, elevationY = 0) {
  const { camera } = rig;
  camera.position.x += (playerX - camera.position.x) * CAMERA_FOLLOW_LERP;
  camera.position.y = CAMERA_OFFSET_Y + elevationY;
  camera.position.z = CAMERA_OFFSET_Z;
  camera.lookAt(camera.position.x * 0.4, CAMERA_LOOKAHEAD_Y + elevationY, CAMERA_LOOKAHEAD_Z);
}
