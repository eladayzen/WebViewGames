// Boot + game loop. Wires input -> player -> systems (spawner, difficulty,
// scoring, lives, ooze buff, juice) -> render + DOM HUD, per the
// core/entities/systems/input/ui/data split in the build doc's §9.3
// technical architecture.

import { loadAssets } from './assets.js';
import { setupCanvas, renderFrame } from './render.js';
import { createGameState, updateCountdown, triggerGameOver, restartToCountdown } from './gameState.js';
import { getSteerAxis } from '../input/input.js';
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
import { createJuice, updateJuice, spawnHitBurst, triggerScreenShake } from '../systems/juice.js';
import { createUI } from '../ui/ui.js';
import { OOZE_BUFF_DURATION_SEC, GROUND_Y_FRAC, PLAYER_HEIGHT_FRAC } from '../data/constants.js';

const MAX_DT = 1 / 20; // clamp so a tab-resume/frame-hitch never simulates a huge leap

async function boot() {
  const canvas = document.getElementById('renderCanvas');
  const ctx = setupCanvas(canvas);
  const ui = createUI();
  const images = await loadAssets();

  const gs = createGameState();
  const player = createPlayer();
  const spawner = createSpawner();
  const difficulty = createDifficulty();
  const scoring = createScoring();
  const lives = createLives();
  const juice = createJuice();
  let items = [];

  function fullReset() {
    resetPlayer(player);
    resetSpawner(spawner);
    resetDifficulty(difficulty);
    resetScoring(scoring);
    resetLives(lives);
    items = [];
    ui.hideGameOver();
  }

  document.getElementById('restart-button').addEventListener('click', () => {
    fullReset();
    restartToCountdown(gs);
  });

  // Called every frame an unresolved item overlaps Michelangelo's full
  // head-to-feet hit band (§6) -- this is the "catch" path, and can fire
  // anywhere along his body, not just when an item reaches his feet.
  function handleItemOverlap(item) {
    if (item.type.kind === 'good') {
      item.resolved = true;
      registerPizzaHit(scoring);
      triggerSwing(player);
      spawnHitBurst(juice, item.xFrac, item.yFrac, 'pizza');
    } else if (item.type.kind === 'power-up') {
      item.resolved = true;
      registerOozeHit(scoring);
      triggerSwing(player);
      grantOozeBuff(player);
      spawnHitBurst(juice, item.xFrac, item.yFrac, 'ooze');
    } else {
      // bomb
      if (!isInvulnerable(player)) {
        item.resolved = true;
        loseLife(lives);
        triggerHit(player);
        registerComboBreak(scoring);
        triggerScreenShake(juice, 0.3, 0.02);
        if (isDead(lives)) {
          triggerGameOver(gs);
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
    }
    // missed ooze/bomb: no penalty, no combo effect (§5.4, §6)
  }

  function updateRunning(dt) {
    const steerAxis = getSteerAxis();
    updatePlayer(player, dt, steerAxis);

    const advanced = updateDifficulty(difficulty, dt, scoring.score);
    const stage = getStage(difficulty);
    if (advanced) ui.showStageBanner(stage.bannerLabel);

    const spawned = updateSpawner(spawner, dt, stage);
    if (spawned) items.push(spawned);

    const bandTop = GROUND_Y_FRAC - PLAYER_HEIGHT_FRAC;
    for (const item of items) {
      if (item.resolved) continue;
      updateFallingItem(item, dt);

      const horizontalOverlap = Math.abs(item.xFrac - player.xFrac) <= getHitHalfWidthFrac(player);
      if (horizontalOverlap && isWithinPlayerBand(item, bandTop, GROUND_Y_FRAC)) {
        handleItemOverlap(item);
      } else if (!item.resolved && hasReachedStrikeBand(item, GROUND_Y_FRAC)) {
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

      if (gs.current === 'countdown') {
        updateCountdown(gs, dt);
        ui.setCountdown(gs.countdownRemaining);
      } else if (gs.current === 'running') {
        ui.setCountdown(0);
        stage = updateRunning(dt);
      } else if (gs.current === 'gameover') {
        ui.setCountdown(0);
        ui.showGameOver(scoring.score, scoring.bestCombo);
      }

      renderFrame(ctx, canvas, { images, stage, player, items, juice });
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
