// Michelangelo (player). Moves left/right along the single ground line
// (§4, §5.1), no-skateboard variant: a fast barefoot run-cycle instead of a
// skate glide. States: idle/run, swing (auto-triggered on a good-item
// strike), hit (bomb-hit flinch + invulnerability), plus an ooze-buff visual
// variant layered as a code tint rather than a separate generated sprite
// (§6 -- "a glow/tint on the swing arc while wider-arc buff is active").

import {
  PLAYER_MAX_SPEED_FRAC_PER_SEC,
  PLAY_AREA_LEFT_FRAC,
  PLAY_AREA_RIGHT_FRAC,
  BASE_HIT_HALF_WIDTH_FRAC,
  OOZE_HIT_HALF_WIDTH_FRAC,
  OOZE_BUFF_DURATION_SEC,
  HIT_INVULNERABILITY_SEC,
} from '../data/constants.js';

const SWING_DURATION_SEC = 0.28;
const HIT_FLINCH_DURATION_SEC = 0.5;

// Fraction of play-area width traveled per run-cycle phase -- tune by feel.
// Smaller than the old skate-bob step since a foot-swap run reads as fast
// only if the frames flip quickly relative to travel speed.
const RUN_CYCLE_STEP_FRAC = 0.035;

export function createPlayer() {
  return {
    xFrac: 0.5,
    facing: 1, // 1 = right, -1 = left
    state: 'idle', // idle | swing | hit
    stateTimer: 0,
    invulnTimer: 0,
    oozeBuffTimer: 0,
    travelDistFrac: 0, // total |dx| traveled, drives the run-cycle frame pick
  };
}

export function resetPlayer(player) {
  player.xFrac = 0.5;
  player.facing = 1;
  player.state = 'idle';
  player.stateTimer = 0;
  player.invulnTimer = 0;
  player.oozeBuffTimer = 0;
  player.travelDistFrac = 0;
}

export function updatePlayer(player, dt, steerAxis) {
  // Continuous, proportional movement -- never a discrete step (§4).
  const prevX = player.xFrac;
  player.xFrac += steerAxis * PLAYER_MAX_SPEED_FRAC_PER_SEC * dt;
  player.xFrac = Math.max(PLAY_AREA_LEFT_FRAC, Math.min(PLAY_AREA_RIGHT_FRAC, player.xFrac));
  player.travelDistFrac += Math.abs(player.xFrac - prevX);

  player.isMoving = Math.abs(steerAxis) > 0.08; // gates the run-cycle frame swap
  if (player.isMoving) {
    player.facing = steerAxis > 0 ? 1 : -1;
  }

  if (player.stateTimer > 0) {
    player.stateTimer -= dt;
    if (player.stateTimer <= 0 && player.state !== 'idle') {
      player.state = 'idle';
      player.stateTimer = 0;
    }
  }

  if (player.invulnTimer > 0) player.invulnTimer -= dt;
  if (player.oozeBuffTimer > 0) player.oozeBuffTimer = Math.max(0, player.oozeBuffTimer - dt);
}

// Auto-triggered swing reaction to a successful good-item strike (§3) --
// never a manual attack input. Does not interrupt movement.
export function triggerSwing(player) {
  player.state = 'swing';
  player.stateTimer = SWING_DURATION_SEC;
}

export function triggerHit(player) {
  player.state = 'hit';
  player.stateTimer = HIT_FLINCH_DURATION_SEC;
  player.invulnTimer = HIT_INVULNERABILITY_SEC;
}

export function grantOozeBuff(player) {
  player.oozeBuffTimer = OOZE_BUFF_DURATION_SEC;
}

export function isOozeBuffed(player) {
  return player.oozeBuffTimer > 0;
}

export function getHitHalfWidthFrac(player) {
  return isOozeBuffed(player) ? OOZE_HIT_HALF_WIDTH_FRAC : BASE_HIT_HALF_WIDTH_FRAC;
}

export function isInvulnerable(player) {
  return player.invulnTimer > 0;
}

// Picks the current run-cycle frame keyed to world travel, not wall time, so
// it always matches how fast he's actually moving: left-stride, tucked
// midpoint, right-stride, tucked midpoint.
const RUN_CYCLE_KEYS = ['mike_run_1', 'mike_run_2', 'mike_run_3', 'mike_run_2'];
export function getRunCycleSpriteKey(player) {
  const phase = Math.floor(player.travelDistFrac / RUN_CYCLE_STEP_FRAC) % RUN_CYCLE_KEYS.length;
  return RUN_CYCLE_KEYS[phase];
}
