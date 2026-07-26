// Leonardo (build doc §6, §9.1, as amended by direct playtest feedback):
// a 4-frame whole-body running-cycle billboard (back view, katana drawn --
// see data/playerSprite.js), fixed in the center lane, snapping between
// lanes on a discrete lane index that eases toward its target x (§5.2).
// Jump is back (ArrowUp, simple hop arc) per direct feedback -- no obstacle
// currently requires it (the 3-lane-spanning pipe that originally justified
// it was dropped), it's just an available move again; a jump-specific pose/
// animation is a deliberately deferred follow-up, not done here. The
// per-part cutout rig is still an MVP requirement (§2, §9.1), not built here.

import * as THREE from 'three';
import { getTexture } from './textureLoader.js';
import { PLAYER_RUN_FRAMES, PLAYER_FRAME_ASPECT, RUN_FRAME_DURATION } from '../data/playerSprite.js';
import {
  LANE_X, CENTER_LANE, LANE_RESPONSE, JUMP_DURATION, JUMP_HEIGHT, PLAYER_Z,
} from '../data/constants.js';

// Sized up from the original single-frame 1.9 to read closer to
// laneRunnerRef.png's big, close, dominant character presence (a camera/
// scale tuning change, not an art change).
const SPRITE_WIDTH = 2.4;
const SPRITE_HEIGHT = SPRITE_WIDTH * PLAYER_FRAME_ASPECT;
const GROUND_Y = SPRITE_HEIGHT / 2;
const LEAN_MAX = 0.22; // radians, cosmetic billboard roll while lane-shifting

// All 4 run-cycle frames share one fixed canvas (data/playerSprite.js) --
// sprite size and ground position are set ONCE, not recomputed per frame
// swap. Earlier versions recalculated both per-frame from each frame's own
// (independently cropped) aspect ratio, which was the direct cause of two
// bugs direct feedback flagged separately: vertical popping (every frame
// had a different height) and the character jumping sideways on asymmetric
// poses (every frame had a different crop-box center). A fixed canvas
// across the whole cycle makes both bugs structurally impossible rather
// than something to keep re-tuning.
export function createPlayer() {
  const material = new THREE.SpriteMaterial({
    map: getTexture(PLAYER_RUN_FRAMES[0].url), transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(SPRITE_WIDTH, SPRITE_HEIGHT, 1);
  sprite.position.set(LANE_X[CENTER_LANE], GROUND_Y, PLAYER_Z);

  return {
    sprite,
    laneIndex: CENTER_LANE,
    targetLane: CENTER_LANE,
    frameIndex: 0,
    frameTimer: 0,
    jumpElapsed: null, // null = grounded
  };
}

export function resetPlayer(player) {
  player.laneIndex = CENTER_LANE;
  player.targetLane = CENTER_LANE;
  player.frameIndex = 0;
  player.frameTimer = 0;
  player.jumpElapsed = null;
  player.sprite.material.map = getTexture(PLAYER_RUN_FRAMES[0].url);
  player.sprite.position.x = LANE_X[CENTER_LANE];
  player.sprite.position.y = GROUND_Y;
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
// roughly where the mask knot sits near the top of the frame.
export function getPlayerHeadAnchor(player) {
  return {
    x: player.sprite.position.x,
    y: GROUND_Y + SPRITE_HEIGHT * 0.4,
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
  const holdTime = RUN_FRAME_DURATION * PLAYER_RUN_FRAMES[player.frameIndex].holdUnits;
  if (player.frameTimer >= holdTime) {
    player.frameTimer -= holdTime;
    player.frameIndex = (player.frameIndex + 1) % PLAYER_RUN_FRAMES.length;
    player.sprite.material.map = getTexture(PLAYER_RUN_FRAMES[player.frameIndex].url);
  }

  if (player.jumpElapsed !== null) {
    player.jumpElapsed += dt;
    const t = Math.min(player.jumpElapsed / JUMP_DURATION, 1);
    const arc = Math.sin(Math.PI * t);
    player.sprite.position.y = GROUND_Y + arc * JUMP_HEIGHT;
    if (t >= 1) {
      player.jumpElapsed = null;
      player.sprite.position.y = GROUND_Y;
    }
  } else {
    player.sprite.position.y = GROUND_Y;
  }
}
