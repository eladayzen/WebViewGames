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
  grantOozeBuff,
  getHitHalfWidthFrac,
  isInvulnerable,
} from '../entities/player.js';
import { updateFallingItem, hasReachedStrikeBand, isWithinPlayerBand, isOffScreen } from '../entities/fallingItem.js';
import { createSpawner, resetSpawner, updateSpawner } from '../systems/spawner.js';
import { createDifficulty, resetDifficulty, updateDifficulty, getStage } from '../systems/difficulty.js';
import {
  createScoring,
  resetScoring,
  registerPizzaHit,
  registerOozeHit,
  registerComboBreak,
  getComboMultiplier,
} from '../systems/scoring.js';
import { createLives, resetLives, loseLife, isDead } from '../systems/lives.js';
import { createJuice, resetJuice, updateJuice, spawnPizzaBreak, spawnOozeSplash, spawnBombExplosion, triggerScreenShake } from '../systems/juice.js';
import { createUI } from '../ui/ui.js';
import { OOZE_BUFF_DURATION_SEC, PLAYER_HEIGHT_FRAC } from '../data/constants.js';

const MAX_DT = 1 / 20; // clamp so a tab-resume/frame-hitch never simulates a huge leap

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
  const audio = createAudio();
  let items = [];
  let lastCountdownTick = null; // last whole-second value shown, for tick SFX

  // Music plays continuously from boot through every countdown/running/
  // restart cycle -- NOT reset in fullReset() below, deliberately: an
  // uninterrupted ambient bed reads better than restarting the loop (or
  // losing the mute state) every time the player hits Retry. Pause is the
  // only thing that stops it (see pause-button handler below).
  startMusic(audio, sfx.music_bed);

  function fullReset() {
    resetPlayer(player);
    resetSpawner(spawner);
    resetDifficulty(difficulty);
    resetScoring(scoring);
    resetLives(lives);
    resetJuice(juice);
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
    } else if (item.type.kind === 'power-up') {
      item.resolved = true;
      registerOozeHit(scoring);
      triggerSwing(player);
      grantOozeBuff(player);
      spawnOozeSplash(juice, item.xFrac, item.yFrac);
      playSfx(audio, sfx.sfx_ooze_catch);
    } else {
      // bomb
      if (!isInvulnerable(player)) {
        item.resolved = true;
        loseLife(lives);
        triggerHit(player);
        registerComboBreak(scoring);
        spawnBombExplosion(juice, item.xFrac, item.yFrac);
        triggerScreenShake(juice, 0.18, 0.012);
        playSfx(audio, sfx.sfx_bomb_hit);
        if (isDead(lives)) {
          triggerGameOver(gs);
          playSfx(audio, sfx.sfx_game_over);
        }
      }
      // overlap while invulnerable: bomb just continues (§5.4)
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

    const spawned = updateSpawner(spawner, dt, stage);
    if (spawned) items.push(spawned);

    // groundYFrac is per-stage (each background's floor line differs);
    // PLAYER_HEIGHT_FRAC stays global -- Michelangelo is always the same
    // size (see constants.js).
    const bandTop = stage.groundYFrac - PLAYER_HEIGHT_FRAC;
    for (const item of items) {
      if (item.resolved) continue;
      updateFallingItem(item, dt);

      const horizontalOverlap = Math.abs(item.xFrac - player.xFrac) <= getHitHalfWidthFrac(player);
      if (horizontalOverlap && isWithinPlayerBand(item, bandTop, stage.groundYFrac)) {
        handleItemOverlap(item);
      } else if (!item.resolved && hasReachedStrikeBand(item, stage.groundYFrac)) {
        handleItemMissed(item);
      }
    }
    items = items.filter((item) => !item.resolved && !isOffScreen(item));

    updateJuice(juice, dt);

    ui.setScore(scoring.score);
    ui.setCombo(scoring.comboCount, getComboMultiplier(scoring));
    ui.setLives(lives.remaining);
    ui.setOozeBuff(player.oozeBuffTimer / OOZE_BUFF_DURATION_SEC);

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
