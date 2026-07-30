// Boot + game loop. Wires input -> player -> systems (spawner, difficulty,
// scoring, lives, ooze buff, juice) -> render + DOM HUD, per the
// core/entities/systems/input/ui/data split in the build doc's §9.3
// technical architecture.

import { loadAssets, loadAudioAssets } from './assets.js';
import { setupCanvas, renderFrame } from './render.js';
import { createGameState, updateCountdown, triggerGameOver, restartToCountdown, togglePause } from './gameState.js';
import { getSteerAxis } from '../input/input.js';
import { createAudio, playSfx, startMusic, pauseMusic, resumeMusic, toggleMuted } from '../systems/audio.js';
import {
  createPlayer,
  resetPlayer,
  updatePlayer,
  triggerSwing,
  triggerHit,
  triggerBlock,
  grantOozeBuff,
  grantShieldBuff,
  grantMagnetBuff,
  isOozeBuffed,
  isShielded,
  isMagnetBuffed,
  getHitHalfWidthFrac,
  isInvulnerable,
} from '../entities/player.js';
import { updateFallingItem, applyMagnetPull, hasReachedStrikeBand, isWithinPlayerBand, isOffScreen } from '../entities/fallingItem.js';
import { createSpawner, resetSpawner, updateSpawner } from '../systems/spawner.js';
import { createBoxes, resetBoxes, registerBoxCatch, updateBoxes } from '../systems/boxes.js';
import { createDifficulty, resetDifficulty, updateDifficulty, getStage } from '../systems/difficulty.js';
import {
  createScoring,
  resetScoring,
  registerPizzaHit,
  registerOozeHit,
  registerComboBreak,
  registerBoxComplete,
  getComboMultiplier,
} from '../systems/scoring.js';
import { createLives, resetLives, loseLife, isDead } from '../systems/lives.js';
import { createJuice, resetJuice, updateJuice, spawnPizzaBreak, spawnOozeSplash, spawnBombExplosion, spawnBoxComplete, spawnShieldBlock, spawnWaveClear, spawnPickupSparkle, triggerScreenShake } from '../systems/juice.js';
import { createUI } from '../ui/ui.js';
import { PLAYER_HEIGHT_FRAC } from '../data/constants.js';

// Clamp so a tab-resume/frame-hitch never simulates a huge leap. Raised
// 1/20 -> 1/10 (2026-07-30): the old 1/20 meant any frame slower than 20fps
// advanced only 1/20s of game time regardless of real elapsed -- i.e. the
// game ran in SLOW MOTION below 20fps, the likely "super super slow" feel on
// a lower-fps Android device. 1/10 keeps real-time down to 10fps while still
// guarding against a multi-second resume leap. Pre-existing clamp, not a
// this-session addition, but it's the actual low-fps slowdown mechanism.
const MAX_DT = 1 / 10;

async function boot() {
  const canvas = document.getElementById('renderCanvas');
  const ctx = setupCanvas(canvas);
  const ui = createUI();
  const [images, sfx] = await Promise.all([loadAssets(), loadAudioAssets()]);

  const gs = createGameState();
  const player = createPlayer();
  const spawner = createSpawner();
  const difficulty = createDifficulty();
  const scoring = createScoring();
  const lives = createLives();
  const juice = createJuice();
  const boxes = createBoxes();
  const audio = createAudio();
  let items = [];
  let lastCountdownTick = null; // last whole-second value shown, for tick SFX

  // Background music defaults OFF for now (per request 2026-07-30) -- SFX
  // still play. Flip MUSIC_ON to re-enable the ambient bed (it loops
  // continuously across countdown/running/restart; pause is the only thing
  // that stops it -- see the pause-button handler below).
  const MUSIC_ON = false;
  if (MUSIC_ON) startMusic(audio, sfx.music_bed);

  function fullReset() {
    resetPlayer(player);
    resetSpawner(spawner);
    resetDifficulty(difficulty);
    resetScoring(scoring);
    resetLives(lives);
    resetJuice(juice);
    resetBoxes(boxes);
    items = [];
    ui.hideGameOver();
  }

  document.getElementById('restart-button').addEventListener('click', () => {
    playSfx(audio, sfx.sfx_ui_tap);
    fullReset();
    restartToCountdown(gs);
    ui.setPaused(false);
  });

  document.getElementById('pause-button').addEventListener('click', () => {
    playSfx(audio, sfx.sfx_ui_tap);
    togglePause(gs);
    ui.setPaused(gs.paused);
    if (gs.paused) pauseMusic();
    else resumeMusic();
  });

  document.getElementById('mute-button').addEventListener('click', () => {
    const isMuted = toggleMuted(audio);
    ui.setMuted(isMuted);
    playSfx(audio, sfx.sfx_ui_tap); // no-ops silently when now muted, per playSfx's own muted check
  });

  // Called every frame an unresolved item overlaps Michelangelo's full
  // head-to-feet hit band (§6) -- this is the "catch" path, and can fire
  // anywhere along his body, not just when an item reaches his feet.
  function handleItemOverlap(item) {
    if (item.type.kind === 'good') {
      item.resolved = true;
      const prevMultiplier = getComboMultiplier(scoring);
      const newMultiplier = registerPizzaHit(scoring);
      triggerSwing(player);
      spawnPizzaBreak(juice, item.xFrac, item.yFrac);
      playSfx(audio, newMultiplier > prevMultiplier ? sfx.sfx_combo_up : sfx.sfx_pizza_catch);
      // Box-colored slice: feed its collection box. registerBoxCatch resets
      // the box and returns its bonus/hex on the completing catch, else null.
      if (item.type.boxColor) {
        const done = registerBoxCatch(boxes, item.type.boxColor);
        if (done) {
          registerBoxComplete(scoring, done.bonusScore);
          spawnBoxComplete(juice, item.xFrac, item.yFrac, done.hex);
          playSfx(audio, sfx.sfx_box_complete);
          ui.showBoxComplete(done.label, done.bonusScore, done.hex);
        }
      }
      // Ooze buff active: an extra cyan sparkle on every catch, so the buff
      // reads as continuously "on" (feedback 2026-07-30), beyond the HUD bar.
      // Small + glow:false so it stays cheap during a catch streak.
      if (isOozeBuffed(player)) {
        spawnPickupSparkle(juice, item.xFrac, item.yFrac, '#1FC8D8');
      }
    } else if (item.type.kind === 'power-up') {
      item.resolved = true;
      triggerSwing(player);
      playSfx(audio, sfx.sfx_ooze_catch); // shared "power-up caught" cue for all pickups
      spawnPickupSparkle(juice, item.xFrac, item.yFrac, item.type.hex);
      const effect = item.type.effect;
      if (effect === 'ooze') {
        registerOozeHit(scoring);
        grantOozeBuff(player);
        spawnOozeSplash(juice, item.xFrac, item.yFrac);
      } else if (effect === 'shield') {
        grantShieldBuff(player);
      } else if (effect === 'magnet') {
        grantMagnetBuff(player);
      } else if (effect === 'wave') {
        // Instant screen-clear: every bomb currently falling DETONATES where
        // it is (mid-air), so you actually see them go off (feedback
        // 2026-07-30) -- not a silent vanish. Plus the sweeping wave VFX from
        // the pickup itself and a solid shake. No score (pure utility).
        for (const other of items) {
          if (!other.resolved && other.type.kind === 'hazard') {
            other.resolved = true;
            spawnBombExplosion(juice, other.xFrac, other.yFrac);
          }
        }
        spawnWaveClear(juice, item.xFrac, item.yFrac);
        triggerScreenShake(juice, 0.28, 0.016);
        playSfx(audio, sfx.sfx_wave_clear);
      }
    } else {
      // bomb
      if (isShielded(player)) {
        // Shielded: block it -- no life lost, no combo break, no game over.
        item.resolved = true;
        triggerBlock(player);
        spawnShieldBlock(juice, item.xFrac, item.yFrac);
        playSfx(audio, sfx.sfx_shield_block);
      } else if (!isInvulnerable(player)) {
        item.resolved = true;
        loseLife(lives);
        triggerHit(player);
        registerComboBreak(scoring);
        spawnBombExplosion(juice, item.xFrac, item.yFrac);
        triggerScreenShake(juice, 0.26, 0.018);
        playSfx(audio, sfx.sfx_bomb_hit);
        if (isDead(lives)) {
          triggerGameOver(gs);
          playSfx(audio, sfx.sfx_game_over);
        }
      }
      // overlap while invulnerable (and not shielded): bomb just continues (§5.4)
    }
  }

  // Called once, the frame an item's top edge passes Michelangelo's feet
  // line without ever having been caught above -- the "missed" path (§8).
  function handleItemMissed(item) {
    if (item.type.kind === 'good') {
      registerComboBreak(scoring); // missed pizza (§8)
      playSfx(audio, sfx.sfx_miss);
    }
    // missed ooze/bomb: no penalty, no combo effect (§5.4, §6)
  }

  function updateRunning(dt) {
    const steerAxis = getSteerAxis();
    updatePlayer(player, dt, steerAxis);

    const advanced = updateDifficulty(difficulty, dt, scoring.score);
    const stage = getStage(difficulty);
    if (advanced) {
      ui.showStageBanner(stage.bannerLabel);
      playSfx(audio, sfx.sfx_stage_advance);
    }

    const spawned = updateSpawner(spawner, dt, stage, boxes);
    if (spawned) items.push(spawned);

    // groundYFrac is per-stage (each background's floor line differs);
    // PLAYER_HEIGHT_FRAC stays global -- Michelangelo is always the same
    // size (see constants.js).
    const bandTop = stage.groundYFrac - PLAYER_HEIGHT_FRAC;
    for (const item of items) {
      if (item.resolved) continue;
      updateFallingItem(item, dt);
      // Magnet buff: pull good items horizontally toward the player (only
      // kind:'good', never bombs/pickups). Separate pass so updateFallingItem
      // keeps its "straight down" invariant; applyMagnetPull self-clamps x.
      if (isMagnetBuffed(player) && item.type.kind === 'good') {
        applyMagnetPull(item, player.xFrac, dt);
      }

      const horizontalOverlap = Math.abs(item.xFrac - player.xFrac) <= getHitHalfWidthFrac(player);
      if (horizontalOverlap && isWithinPlayerBand(item, bandTop, stage.groundYFrac)) {
        handleItemOverlap(item);
      } else if (!item.resolved && hasReachedStrikeBand(item, stage.groundYFrac)) {
        handleItemMissed(item);
      }
    }
    // In-place removal, not items.filter() -- filter() allocated a brand
    // new array every single frame regardless of whether anything actually
    // needed removing, which is unnecessary GC churn 60x/sec (part of the
    // same in-WebView stutter chase as ui.js's dirty-checks, 2026-07-26).
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].resolved || isOffScreen(items[i])) items.splice(i, 1);
    }

    updateJuice(juice, dt);
    // AFTER the catch loop (see systems/boxes.js): a catch that completes a
    // box this frame is already handled above, so this only expires boxes
    // that got no completing catch -- completion always wins the tie.
    updateBoxes(boxes, dt);

    ui.setScore(scoring.score);
    ui.setCombo(scoring.comboCount, getComboMultiplier(scoring));
    ui.setLives(lives.remaining);
    ui.setBuffs(player);
    ui.setBoxes(boxes);

    return stage;
  }

  function frame(now) {
    // The GoBalance rAF shim's pump loop (index.html) swallows any thrown
    // error into a Unity.call bridge that's a silent no-op outside the
    // WebView -- great on-device, but it means a bug here would otherwise
    // fail completely silently in a normal browser during dev. Log to the
    // console too, then rethrow so the shim's on-device bridge still fires.
    try {
      const dt = Math.min(MAX_DT, (frame.lastTime ? (now - frame.lastTime) / 1000 : 1 / 60));
      frame.lastTime = now;

      let stage = getStage(difficulty);

      // Pause freezes the whole simulation in place -- gs.current is left
      // untouched, so resuming drops back into exactly countdown/running/
      // gameover, whichever it was paused from (§ HUD conventions).
      if (!gs.paused) {
        if (gs.current === 'countdown') {
          updateCountdown(gs, dt);
          ui.setCountdown(gs.countdownRemaining);
          const tick = Math.ceil(gs.countdownRemaining);
          if (tick !== lastCountdownTick) {
            playSfx(audio, tick > 0 ? sfx.sfx_countdown_tick : sfx.sfx_countdown_go);
            lastCountdownTick = tick;
          }
        } else if (gs.current === 'running') {
          ui.setCountdown(0);
          stage = updateRunning(dt);
        } else if (gs.current === 'gameover') {
          ui.setCountdown(0);
          ui.showGameOver(scoring.score, scoring.bestCombo);
        }
      }

      renderFrame(ctx, { images, stage, player, items, juice, isRunning: gs.current === 'running' });
      window.__tssDebug = { player, items, lives, scoring, gs }; // dev-only smoke-test hook, harmless in prod

      requestAnimationFrame(frame);
    } catch (err) {
      console.error('TmntSkateSlice frame() error:', err);
      throw err;
    }
  }

  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
