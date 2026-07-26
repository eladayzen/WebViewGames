// Leonardo (build doc §6, §9.1, as amended by direct playtest feedback):
// a 6-frame whole-body running-cycle billboard (back view, katana drawn --
// see data/playerSprite.js), fixed in the center lane, snapping between
// lanes on a discrete lane index that eases toward its target x (§5.2).
// Jump is back (ArrowUp, simple hop arc) per direct feedback -- no obstacle
// currently requires it (the 3-lane-spanning pipe that originally justified
// it was dropped), it's just an available move again; a jump-specific pose/
// animation is a deliberately deferred follow-up, not done here. The
// per-part cutout rig is still an MVP requirement (§2, §9.1), not built here.

import * as THREE from 'three';
import { getTexture } from './textureLoader.js';
import { PLAYER_RUN_FRAMES, RUN_FRAME_DURATION } from '../data/playerSprite.js';
import {
  LANE_X, CENTER_LANE, LANE_RESPONSE, JUMP_DURATION, JUMP_HEIGHT, PLAYER_Z,
} from '../data/constants.js';

// Sized up from the original single-frame 1.9 to read closer to
// laneRunnerRef.png's big, close, dominant character presence (a camera/
// scale tuning change, not an art change).
const SPRITE_WIDTH = 2.4;
const LEAN_MAX = 0.22; // radians, cosmetic billboard roll while lane-shifting

// Each run-cycle frame was alpha-cropped independently, so its aspect ratio
// (and therefore its billboard height at a fixed width) differs slightly
// frame to frame -- ground-anchoring position.y to half of *that frame's*
// height every time it swaps is what keeps Leo's feet on the street instead
// of popping up/down as the texture changes underneath a fixed-height plane.
function frameHeight(frameIndex) {
  return SPRITE_WIDTH * PLAYER_RUN_FRAMES[frameIndex].aspect;
}

export function createPlayer() {
  const material = new THREE.SpriteMaterial({
    map: getTexture(PLAYER_RUN_FRAMES[0].url), transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(SPRITE_WIDTH, frameHeight(0), 1);
  sprite.position.set(LANE_X[CENTER_LANE], frameHeight(0) / 2, PLAYER_Z);

  return {
    sprite,
    laneIndex: CENTER_LANE,
    targetLane: CENTER_LANE,
    frameIndex: 0,
    frameTimer: 0,
    jumpElapsed: null, // null = grounded
    groundY: frameHeight(0) / 2,
  };
}

export function resetPlayer(player) {
  player.laneIndex = CENTER_LANE;
  player.targetLane = CENTER_LANE;
  player.frameIndex = 0;
  player.frameTimer = 0;
  player.jumpElapsed = null;
  player.sprite.material.map = getTexture(PLAYER_RUN_FRAMES[0].url);
  player.sprite.scale.set(SPRITE_WIDTH, frameHeight(0), 1);
  player.sprite.position.x = LANE_X[CENTER_LANE];
  player.groundY = frameHeight(0) / 2;
  player.sprite.position.y = player.groundY;
  player.sprite.material.rotation = 0;
  player.sprite.visible = true;
}

export function setPlayerLane(player, laneIndex) {
  player.targetLane = laneIndex;
  player.laneIndex = laneIndex;
}

export function startPlayerJump(player) {
  if (player.jumpElapsed === null) player.jumpElapsed = 0;
}

// Head-height anchor for cosmetic attachments (the ribbon, entities/
// ribbon.js) that need to track the body without being part of its sprite --
// roughly where the mask knot sits near the top of the current frame.
export function getPlayerHeadAnchor(player) {
  return {
    x: player.sprite.position.x,
    y: player.groundY + frameHeight(player.frameIndex) * 0.4,
    z: player.sprite.position.z,
  };
}

export function updatePlayer(player, dt) {
  const targetX = LANE_X[player.targetLane];
  const prevX = player.sprite.position.x;
  const followT = 1 - Math.exp(-LANE_RESPONSE * dt);
  player.sprite.position.x += (targetX - prevX) * followT;

  // Cosmetic lean into the lane-shift direction, purely visual (never affects
  // collision) -- sells the "clean lean" feel the vision calls for (§1) even
  // with a flat billboard, no cutout rig needed for this.
  const velocity = (player.sprite.position.x - prevX) / Math.max(dt, 1e-6);
  const targetLean = THREE.MathUtils.clamp(-velocity * 0.05, -LEAN_MAX, LEAN_MAX);
  player.sprite.material.rotation += (targetLean - player.sprite.material.rotation) * 0.2;

  player.frameTimer += dt;
  if (player.frameTimer >= RUN_FRAME_DURATION) {
    player.frameTimer -= RUN_FRAME_DURATION;
    player.frameIndex = (player.frameIndex + 1) % PLAYER_RUN_FRAMES.length;
    player.sprite.material.map = getTexture(PLAYER_RUN_FRAMES[player.frameIndex].url);
    const h = frameHeight(player.frameIndex);
    player.sprite.scale.set(SPRITE_WIDTH, h, 1);
    player.groundY = h / 2;
  }

  if (player.jumpElapsed !== null) {
    player.jumpElapsed += dt;
    const t = Math.min(player.jumpElapsed / JUMP_DURATION, 1);
    const arc = Math.sin(Math.PI * t);
    player.sprite.position.y = player.groundY + arc * JUMP_HEIGHT;
    if (t >= 1) {
      player.jumpElapsed = null;
      player.sprite.position.y = player.groundY;
    }
  } else {
    player.sprite.position.y = player.groundY;
  }
}
