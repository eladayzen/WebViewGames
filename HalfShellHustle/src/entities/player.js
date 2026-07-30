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
import {
  PLAYER_RUN_FRAMES, PLAYER_FRAME_ASPECT, RUN_FRAME_DURATION, ATTACK_SEQUENCES, PLAYER_JUMP_FRAMES,
} from '../data/playerSprite.js';
import {
  LANE_X, CENTER_LANE, LANE_RESPONSE, JUMP_RISE_DURATION, JUMP_HOLD_DURATION, JUMP_FALL_DURATION, JUMP_HEIGHT,
  PLAYER_Z,
} from '../data/constants.js';
import { getPlayerElevationAt, isRampSupported } from './platform.js';
import { PLATFORM_HEIGHT, PLATFORM_FALL_GRAVITY } from '../data/platformSequence.js';

// Preload every attack sequence's textures up front, at module load, rather
// than lazily on first use. The spin (startPlayerAttack below) is a real-
// time timer-driven frame cycle that does not wait for a texture to finish
// loading -- without this, the FIRST time a given sequence gets picked
// would trigger the very first getTexture() call for its 4 images (they'd
// never have been touched before that exact moment, unlike the run-cycle
// frames, which are already long since loaded/cached by the time any enemy
// is in range), so the sprite would render blank/invisible for most or all
// of that first play of the sequence while its images load and decode.
ATTACK_SEQUENCES.forEach((seq) => seq.frames.forEach((frame) => getTexture(frame.url)));
PLAYER_JUMP_FRAMES.forEach((frame) => getTexture(frame.url));

// Sized up from the original single-frame 1.9 to read closer to
// laneRunnerRef.png's big, close, dominant character presence (a camera/
// scale tuning change, not an art change).
//
// PLAYER_SCALE: direct feedback -- he was blocking too much of the center
// lane, dialed back 12%. Applied here (the single source of the sprite's
// footprint) rather than as a scale hack elsewhere, so GROUND_Y/SPRITE_HEIGHT
// (and everything derived from them -- the head anchor, the contact shadow's
// position, the dust-puff spawn offset) stay unified with his actual size
// instead of drifting out of proportion with it.
const PLAYER_SCALE = 0.88;
const SPRITE_WIDTH = 2.4 * PLAYER_SCALE;
const SPRITE_HEIGHT = SPRITE_WIDTH * PLAYER_FRAME_ASPECT;
const GROUND_Y = SPRITE_HEIGHT / 2;
const LEAN_MAX = 0.22; // radians, cosmetic billboard roll while lane-shifting

const JUMP_TOTAL_DURATION = JUMP_RISE_DURATION + JUMP_HOLD_DURATION + JUMP_FALL_DURATION;

// Ease-out quad rise (fast liftoff, decelerating into the hold), flat hold
// at JUMP_HEIGHT, ease-IN CUBIC fall -- direct feedback went through a
// couple of iterations here: an ease-out fall (real velocity immediately
// after the hold, softening into landing) tested as "feels linear," not
// what was wanted. What's actually wanted is the opposite direction: real
// gravity-style acceleration -- near-zero height loss per frame right as
// the fall starts, a bit more the next frame, building up, fastest right
// at the ground. That's ease-IN (zero velocity at u=0, everything
// backloaded toward u=1) -- CUBIC rather than the original quadratic for a
// more pronounced version of that same accelerating character (by the
// halfway TIME point, quadratic has only fallen 25% of the way; cubic has
// only fallen 12.5% -- noticeably flatter/slower-reading start, then a
// sharper final acceleration into landing). Read every frame by
// entities/collision.js (via player.airHeight below) to decide whether a
// jumpable obstacle got cleared.
function jumpArcHeight(elapsed) {
  if (elapsed < JUMP_RISE_DURATION) {
    const u = elapsed / JUMP_RISE_DURATION;
    return JUMP_HEIGHT * (1 - (1 - u) * (1 - u));
  }
  if (elapsed < JUMP_RISE_DURATION + JUMP_HOLD_DURATION) return JUMP_HEIGHT;
  const u = Math.min((elapsed - JUMP_RISE_DURATION - JUMP_HOLD_DURATION) / JUMP_FALL_DURATION, 1);
  return JUMP_HEIGHT * (1 - u * u * u);
}

// Procedural bob (direct feedback: the discrete 4-sprite swap alone felt
// jumpy -- "animate on twos" was the ask). First pass was a continuous
// cosine wave, which direct feedback then explicitly rejected: not a
// smoothed spline, just discrete levels -- both knee-drive frames snap to a
// fixed lower position ("the stronger peak"), contact frames stay neutral.
// Contact frames additionally get a small opposite-sign xOffset (planted
// foot reads slightly forward/back of lane center). Both live per-frame in
// data/playerSprite.js and are applied directly below with no easing, on
// top of (not instead of) the lane-position easing, so they snap in
// lockstep with the sprite swap itself -- already stepped by construction,
// no separate phase/timer needed.
//
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
    laneX: LANE_X[CENTER_LANE], // eased lane-center position, BEFORE per-frame xOffset
    frameIndex: 0,
    frameTimer: 0,
    jumpElapsed: null, // null = grounded
    jumpFrameIndex: -1, // which data/playerSprite.js PLAYER_JUMP_FRAMES entry is currently showing, -1 = none yet (forces the first assignment on takeoff)
    airHeight: 0, // current jump-arc height above ground (world units), independent of elevationY -- 0 when not jumping, read by entities/collision.js for jump-clearable obstacles
    elevationY: 0, // current entities/platform.js height offset, read by street/camera-rig.js
    elevationVelocity: 0, // world units/sec, only used while gravity-falling (negative)
    attacking: false,
    attackSequence: null,
    attackFrameIndex: 0,
    attackTimer: 0,
  };
}

export function resetPlayer(player) {
  player.laneIndex = CENTER_LANE;
  player.targetLane = CENTER_LANE;
  player.laneX = LANE_X[CENTER_LANE];
  player.frameIndex = 0;
  player.frameTimer = 0;
  player.jumpElapsed = null;
  player.jumpFrameIndex = -1;
  player.airHeight = 0;
  player.elevationY = 0;
  player.elevationVelocity = 0;
  player.attacking = false;
  player.attackSequence = null;
  player.attackFrameIndex = 0;
  player.attackTimer = 0;
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

// Auto-triggered on a Foot Soldier kill (core/main.js) -- never a player
// input. `sequenceIndex` picks which of ATTACK_SEQUENCES to play (main.js
// rotates it kill to kill); ignored if already mid-attack so two kills a
// frame apart don't restart/replace the sequence and visually stutter.
// Also ignored entirely while airborne (jumpElapsed !== null) -- direct
// feedback: the jump pose itself already reads as an attack (swords held
// forward), so a mid-air kill should just keep showing that instead of
// jarringly cutting to the ground-based spin animation.
export function startPlayerAttack(player, sequenceIndex = 0) {
  if (player.attacking || player.jumpElapsed !== null) return;
  const sequence = ATTACK_SEQUENCES[sequenceIndex % ATTACK_SEQUENCES.length];
  player.attacking = true;
  player.attackSequence = sequence;
  player.attackFrameIndex = 0;
  player.attackTimer = 0;
  player.sprite.material.map = getTexture(sequence.frames[0].url);
}

// Head-height anchor for cosmetic attachments (the ribbon, entities/
// ribbon.js) that need to track the body without being part of its sprite --
// roughly where the mask knot sits near the top of the frame.
export function getPlayerHeadAnchor(player) {
  return {
    x: player.sprite.position.x,
    y: player.sprite.position.y - GROUND_Y + SPRITE_HEIGHT * 0.4,
    z: player.sprite.position.z,
  };
}

export function updatePlayer(player, dt, platformField) {
  // entities/platform.js's per-lane height system: `target` is where he
  // SHOULD be right now, ignoring momentum -- either mid-scripted-climb
  // (rising smoothly toward a ramp/wall's top, see getPlayerElevationAt)
  // or the flat height of whatever he's standing on (which steps straight
  // to 0 once he's past a platform's end or been blocked into a lane with
  // nothing there).
  //
  // Rising toward `target` is always a direct, scripted assignment --
  // climbing a ramp/wall is meant to read as a controlled, eased motion,
  // not physics. Direct feedback is what falling toward it should be:
  // dropping below `target` (walked off an edge, fell through a blocked
  // lane-switch) now integrates real gravity over TIME instead of the
  // smoothstep-over-distance ease it used to be, which read as an elevator
  // ride down rather than a fall.
  const target = getPlayerElevationAt(
    platformField, player.laneIndex, player.sprite.position.z, player.jumpElapsed !== null,
  ) * PLATFORM_HEIGHT;
  // Direct/scripted whenever rising OR riding a ramp-type's own surface
  // (entry wedge, deck, or its now-mirrored exit wedge) -- a ramp's descent
  // is a controlled climb-down, not a fall. Real gravity only kicks in when
  // truly unsupported: stepped off the side into an empty/lower lane, or
  // past a kill-type's deckEndZ (no exit ramp there).
  if (target >= player.elevationY || isRampSupported(platformField, player.laneIndex, player.sprite.position.z)) {
    player.elevationY = target;
    player.elevationVelocity = 0;
  } else {
    player.elevationVelocity -= PLATFORM_FALL_GRAVITY * dt;
    player.elevationY += player.elevationVelocity * dt;
    if (player.elevationY <= target) {
      player.elevationY = target;
      player.elevationVelocity = 0;
    }
  }

  const targetX = LANE_X[player.targetLane];
  const prevX = player.laneX;
  const followT = 1 - Math.exp(-LANE_RESPONSE * dt);
  player.laneX += (targetX - prevX) * followT;

  // Cosmetic lean into the lane-shift direction, purely visual (never affects
  // collision) -- sells the "clean lean" feel the vision calls for (§1) even
  // with a flat billboard, no cutout rig needed for this.
  const velocity = (player.laneX - prevX) / Math.max(dt, 1e-6);
  const targetLean = THREE.MathUtils.clamp(-velocity * 0.05, -LEAN_MAX, LEAN_MAX);
  player.sprite.material.rotation += (targetLean - player.sprite.material.rotation) * 0.2;

  if (player.jumpElapsed !== null) {
    // Jump pose overrides the run cycle entirely (own frame set, no run-
    // frame xOffset bob) -- data/playerSprite.js's PLAYER_JUMP_FRAMES plays
    // through once during the rise (a launch-off sequence: squeeze-down,
    // launching-up, then the main held pose), sliced evenly across
    // JUMP_RISE_DURATION; the LAST frame (the main pose) then just stays
    // showing for the rest of the jump (hold AND, for now, the fall too).
    // Landing hands back to the run cycle exactly where frameIndex/
    // frameTimer were left (frozen, not reset, since neither advances in
    // this branch) -- reads as running pausing for the jump and picking
    // back up, not restarting. startPlayerAttack no-ops while this branch
    // is active (see its own comment) -- this pose is what a mid-air kill
    // shows.
    const riseT = Math.min(player.jumpElapsed / JUMP_RISE_DURATION, 1);
    const jumpFrameIndex = Math.min(
      Math.floor(riseT * PLAYER_JUMP_FRAMES.length),
      PLAYER_JUMP_FRAMES.length - 1,
    );
    if (jumpFrameIndex !== player.jumpFrameIndex) {
      player.jumpFrameIndex = jumpFrameIndex;
      player.sprite.material.map = getTexture(PLAYER_JUMP_FRAMES[jumpFrameIndex].url);
    }
    player.sprite.position.x = player.laneX;
  } else if (player.attacking) {
    // The attack sequence overrides the run-frame cycle entirely (own frame
    // set/timer, no run-frame xOffset bob).
    const { frames, frameDuration } = player.attackSequence;
    player.attackTimer += dt;
    if (player.attackTimer >= frameDuration) {
      player.attackTimer -= frameDuration;
      player.attackFrameIndex += 1;
      if (player.attackFrameIndex >= frames.length) {
        // Sequence is done -- hand back to the run cycle from frame 0
        // rather than wherever it would have drifted to, a clean loop
        // point since every sequence's last frame already lands in a pose
        // close to the run frame's grip.
        player.attacking = false;
        player.attackSequence = null;
        player.frameIndex = 0;
        player.frameTimer = 0;
        player.sprite.material.map = getTexture(PLAYER_RUN_FRAMES[0].url);
      } else {
        player.sprite.material.map = getTexture(frames[player.attackFrameIndex].url);
      }
    }
    player.sprite.position.x = player.laneX;
  } else {
    player.frameTimer += dt;
    const holdTime = RUN_FRAME_DURATION * PLAYER_RUN_FRAMES[player.frameIndex].holdUnits;
    if (player.frameTimer >= holdTime) {
      player.frameTimer -= holdTime;
      player.frameIndex = (player.frameIndex + 1) % PLAYER_RUN_FRAMES.length;
      player.sprite.material.map = getTexture(PLAYER_RUN_FRAMES[player.frameIndex].url);
    }
    player.sprite.position.x = player.laneX + PLAYER_RUN_FRAMES[player.frameIndex].xOffset;
  }

  if (player.jumpElapsed !== null) {
    player.jumpElapsed += dt;
    if (player.jumpElapsed >= JUMP_TOTAL_DURATION) {
      player.jumpElapsed = null;
      player.jumpFrameIndex = -1;
      player.airHeight = 0;
      player.sprite.position.y = GROUND_Y + player.elevationY;
    } else {
      player.airHeight = jumpArcHeight(player.jumpElapsed);
      player.sprite.position.y = GROUND_Y + player.elevationY + player.airHeight;
    }
  } else if (player.attacking) {
    player.airHeight = 0;
    player.sprite.position.y = GROUND_Y + player.elevationY;
  } else {
    player.airHeight = 0;
    player.sprite.position.y = GROUND_Y + player.elevationY + PLAYER_RUN_FRAMES[player.frameIndex].yOffset;
  }
}
