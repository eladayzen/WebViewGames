// Michelangelo (player). Moves left/right along the single ground line
// (§4, §5.1), no-skateboard variant: a fast barefoot run-cycle instead of a
// skate glide. States: idle/run, swing (auto-triggered on a good-item
// strike), hit (bomb-hit flinch + invulnerability), block (shielded bomb
// brace). Buffs run as parallel timers independent of state: ooze (wider
// hit-tolerance), shield (blocks bomb hits), magnet (pulls good items in).

import {
  PLAYER_MAX_SPEED_FRAC_PER_SEC,
  PLAY_AREA_LEFT_FRAC,
  PLAY_AREA_RIGHT_FRAC,
  BASE_HIT_HALF_WIDTH_FRAC,
  OOZE_HIT_HALF_WIDTH_FRAC,
  OOZE_BUFF_DURATION_SEC,
  SHIELD_BUFF_DURATION_SEC,
  MAGNET_BUFF_DURATION_SEC,
  HIT_INVULNERABILITY_SEC,
} from '../data/constants.js';

// Per-swing-frame hold time. Frames 2/3 match the walking run-cycle's
// per-frame pace at max speed (RUN_CYCLE_STEP_FRAC /
// PLAYER_MAX_SPEED_FRAC_PER_SEC = 0.09 / 0.9 = 0.1s/frame); frame 1
// (windup) is deliberately quicker -- a snappier flick into the swing,
// per feedback.
const SWING_FRAME_DURATIONS_SEC = [0.05, 0.1, 0.1];
const SWING_DURATION_SEC = SWING_FRAME_DURATIONS_SEC.reduce((a, b) => a + b, 0);
const HIT_FLINCH_DURATION_SEC = 0.5;
// Transient defensive-brace pose shown when a shielded player blocks a bomb
// (the shield BUFF itself is a separate persistent timer -- see below).
const BLOCK_FLINCH_DURATION_SEC = 0.45;

// Run-cycle frame hold time, in seconds -- was "fraction of play-area width
// traveled per phase" (RUN_CYCLE_STEP_FRAC / PLAYER_MAX_SPEED_FRAC_PER_SEC),
// converted to a flat wall-clock duration (2026-07-26, chasing reported
// choppy/"clipping" movement animation feel). Real analog board input is
// noisy; distance-accumulation (Math.abs(dx) summed every frame) adds up
// EVEN from tiny back-and-forth jitter while the player is trying to hold
// still, since abs() never cancels out -- unlike the swing/hit cycles
// (already time-based, and the user confirmed those feel fine by
// contrast), a distance-keyed cycle flips frames unpredictably under noisy
// input. Same 0.1s pace as before (0.09 / 0.9), now driven by a clean timer
// instead.
const RUN_CYCLE_FRAME_DURATION_SEC = 0.1;

export function createPlayer() {
  return {
    xFrac: 0.5,
    facing: 1, // 1 = right, -1 = left
    state: 'idle', // idle | swing | hit | block
    stateTimer: 0,
    invulnTimer: 0,
    oozeBuffTimer: 0,
    shieldBuffTimer: 0,
    magnetBuffTimer: 0,
    runCyclePhaseTimer: 0, // seconds spent continuously moving, drives the run-cycle frame pick
    isMoving: false,
  };
}

export function resetPlayer(player) {
  player.xFrac = 0.5;
  player.facing = 1;
  player.state = 'idle';
  player.stateTimer = 0;
  player.invulnTimer = 0;
  player.oozeBuffTimer = 0;
  player.shieldBuffTimer = 0;
  player.magnetBuffTimer = 0;
  player.runCyclePhaseTimer = 0;
  player.isMoving = false;
}

export function updatePlayer(player, dt, steerAxis) {
  // Continuous, proportional movement -- never a discrete step (§4).
  const prevX = player.xFrac;
  player.xFrac += steerAxis * PLAYER_MAX_SPEED_FRAC_PER_SEC * dt;
  player.xFrac = Math.max(PLAY_AREA_LEFT_FRAC, Math.min(PLAY_AREA_RIGHT_FRAC, player.xFrac));
  const deltaXFrac = Math.abs(player.xFrac - prevX);

  // Gates the run-cycle frame swap -- requires both meaningful input (not
  // just deadzone noise) AND actual displacement, so holding the stick
  // against the play-area edge (clamped, deltaXFrac === 0) correctly falls
  // back to the idle pose instead of animating a run in place. Asymmetric
  // enter/exit thresholds (hysteresis), not one shared 0.08 -- a real
  // analog board sensor can sit right at a single boundary and chatter
  // in/out of "moving" every frame; splitting the thresholds kills that
  // the same way GOBALANCE_SDK.md's own key-forwarding hysteresis does
  // (press above 0.35, release below 0.20).
  const wasMoving = player.isMoving;
  const movingThreshold = wasMoving ? 0.05 : 0.12;
  player.isMoving = Math.abs(steerAxis) > movingThreshold && deltaXFrac > 0;
  if (player.isMoving) {
    player.facing = steerAxis > 0 ? 1 : -1;
    player.runCyclePhaseTimer += dt;
  } else {
    player.runCyclePhaseTimer = 0; // always start the cycle fresh next time he moves
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
  if (player.shieldBuffTimer > 0) player.shieldBuffTimer = Math.max(0, player.shieldBuffTimer - dt);
  if (player.magnetBuffTimer > 0) player.magnetBuffTimer = Math.max(0, player.magnetBuffTimer - dt);
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

// Shield: a persistent buff (independent of `state`) that blocks bomb hits
// for its full duration, regardless of how many bombs it absorbs. Each block
// also plays the transient 'block' brace pose (see triggerBlock).
export function grantShieldBuff(player) {
  player.shieldBuffTimer = SHIELD_BUFF_DURATION_SEC;
}

export function isShielded(player) {
  return player.shieldBuffTimer > 0;
}

// Magnet: while active, good items within range drift toward the player
// (applyMagnetPull in entities/fallingItem.js, driven from core/main.js).
export function grantMagnetBuff(player) {
  player.magnetBuffTimer = MAGNET_BUFF_DURATION_SEC;
}

export function isMagnetBuffed(player) {
  return player.magnetBuffTimer > 0;
}

// Transient defensive-brace pose, played when a shielded player blocks a
// bomb. Same state-machine mechanism as swing/hit (generic stateTimer ->
// idle in updatePlayer); does NOT grant invulnerability -- the shield buff
// already negates the damage, this is purely the visual reaction.
export function triggerBlock(player) {
  player.state = 'block';
  player.stateTimer = BLOCK_FLINCH_DURATION_SEC;
}

export function getHitHalfWidthFrac(player) {
  return isOozeBuffed(player) ? OOZE_HIT_HALF_WIDTH_FRAC : BASE_HIT_HALF_WIDTH_FRAC;
}

export function isInvulnerable(player) {
  return player.invulnTimer > 0;
}

// Picks the current run-cycle frame keyed to world travel, not wall time, so
// it always matches how fast he's actually moving: left-leg-crossing,
// right-leg-crossing ninja cross-step (legs overlap laterally rather than
// an open front-to-back running lunge -- direction from Amit, 2026-07-21).
// The original wide-open-lunge frames are archived at
// art/archive/run-cycle-wide-lunge/ in case that look is worth revisiting.
// Keys are theme-neutral (2026-08-20) -- see core/assets.js's HERO_SPRITES
// for which actual PNG (mike_* or hero_*) each one resolves to per build.
// Two-frame stepping run cycle: hero_run_2 <-> hero_run_3. The idle-pose frame
// (hero_run_1, a copy of hero_idle) is deliberately NOT in the cycle: it made
// movement look static, because runCyclePhaseTimer resets to 0 on any brief
// non-moving frame (edge clamp / analog chatter) and each frame is only 0.1s,
// so the cycle rarely got past that first idle-looking frame (2026-09-02 fix).
// Now any movement immediately shows a stepping pose; the idle pose shows only
// when genuinely standing still (drawPlayer's !isMoving path).
// For the TMNT theme, hero_run_2 -> mike_run_3 and hero_run_3 -> mike_run_1
// (heroAssets.tmnt.js), so this resolves to mike_run_3 <-> mike_run_1 -- the
// same two-frame alternation TMNT always had, visually unchanged.
// Exported so the intro tutorial (ui.js) plays the EXACT same sequence,
// sourced from here rather than a hand-kept copy that could drift.
export const RUN_CYCLE_KEYS = ['hero_run_2', 'hero_run_3'];
export function getRunCycleSpriteKey(player) {
  const phase = Math.floor(player.runCyclePhaseTimer / RUN_CYCLE_FRAME_DURATION_SEC) % RUN_CYCLE_KEYS.length;
  return RUN_CYCLE_KEYS[phase];
}

// Swing/hit frames are keyed to elapsed time within the state's fixed
// duration (not travel distance -- he doesn't have to be moving to attack
// or get hit), split evenly across however many frames each sequence has.
// Regenerated no-skateboard against mike_idle's current proportions.
// Originals archived at art/archive/hit-swing-skateboard-era/.
const SWING_CYCLE_KEYS = ['hero_swing_1', 'hero_swing_2', 'hero_swing_3'];
export function getSwingCycleSpriteKey(player) {
  const elapsed = SWING_DURATION_SEC - player.stateTimer;
  let acc = 0;
  for (let i = 0; i < SWING_FRAME_DURATIONS_SEC.length; i++) {
    acc += SWING_FRAME_DURATIONS_SEC[i];
    if (elapsed < acc) return SWING_CYCLE_KEYS[i];
  }
  return SWING_CYCLE_KEYS[SWING_CYCLE_KEYS.length - 1];
}

const HIT_CYCLE_KEYS = ['hero_hit_1', 'hero_hit_2'];
export function getHitCycleSpriteKey(player) {
  const elapsed = HIT_FLINCH_DURATION_SEC - player.stateTimer;
  const phase = Math.min(
    HIT_CYCLE_KEYS.length - 1,
    Math.floor((elapsed / HIT_FLINCH_DURATION_SEC) * HIT_CYCLE_KEYS.length)
  );
  return HIT_CYCLE_KEYS[phase];
}

// Block (shield brace) pose. TEMPORARY: reuses hero_swing_1 (the coiled
// windup pose, which reads reasonably as a defensive guard) as a stand-in --
// the dedicated block frame got repeatedly flagged by Kolbo's safety filter
// this session (transient), and this project hasn't revisited it since.
// Swap in a real dedicated block frame (per theme) once generated; only
// this one return changes.
export function getBlockCycleSpriteKey(player) {
  return 'hero_swing_1';
}
