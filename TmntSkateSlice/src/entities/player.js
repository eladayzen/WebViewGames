// Michelangelo (player). Skates left/right along the single ground line
// (§4, §5.1). States: idle/skate, swing (auto-triggered on a good-item
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

export function createPlayer() {
  return {
    xFrac: 0.5,
    facing: 1, // 1 = right, -1 = left
    state: 'idle', // idle | swing | hit
    stateTimer: 0,
    invulnTimer: 0,
    oozeBuffTimer: 0,
  };
}

export function resetPlayer(player) {
  player.xFrac = 0.5;
  player.facing = 1;
  player.state = 'idle';
  player.stateTimer = 0;
  player.invulnTimer = 0;
  player.oozeBuffTimer = 0;
}

export function updatePlayer(player, dt, steerAxis) {
  // Continuous, proportional movement -- never a discrete step (§4).
  player.xFrac += steerAxis * PLAYER_MAX_SPEED_FRAC_PER_SEC * dt;
  player.xFrac = Math.max(PLAY_AREA_LEFT_FRAC, Math.min(PLAY_AREA_RIGHT_FRAC, player.xFrac));

  if (Math.abs(steerAxis) > 0.08) {
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
