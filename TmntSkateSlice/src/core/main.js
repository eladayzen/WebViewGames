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
import { createBombKills, resetBombKills, registerBombKill } from '../systems/bombKills.js';
import { rollBoxReward, BOX_COLOR_BY_ID } from '../data/boxColors.js';
import { BOMB_KILL_SET } from '../data/bombKills.js';
import { createDifficulty, resetDifficulty, updateDifficulty, getStage } from '../systems/difficulty.js';
import {
  createScoring,
  resetScoring,
  registerPizzaHit,
  registerOozeHit,
  registerComboBreak,
  registerBoxComplete,
  registerBombKillScore,
  getComboMultiplier,
} from '../systems/scoring.js';
import { createLives, resetLives, loseLife, gainLife, isDead } from '../systems/lives.js';
import { createJuice, resetJuice, updateJuice, spawnPizzaBreak, spawnOozeSplash, spawnBombExplosion, spawnBoxComplete, spawnShieldBlock, spawnWaveClear, spawnPickupSparkle, spawnScorePopup, spawnCollectFlyer, triggerScreenShake } from '../systems/juice.js';
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
// Wave pickup: seconds between each bomb's detonation, so they pop one after
// another in a quick popcorn ripple rather than all at once (feedback
// 2026-07-30) -- reads clearly as "this clears every bomb on screen".
const WAVE_DETONATE_STAGGER_SEC = 0.07;

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
  const bombKills = createBombKills();
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
    resetBombKills(bombKills);
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

  // Apply a booster effect (shield / magnet / wave "blow up"), from either a
  // caught falling pickup OR a box-completion reward (2026-08-02). xFrac/yFrac
  // is the effect's VFX origin. Wave clears every bomb on screen with the same
  // staggered "popcorn" detonation the wave pickup uses.
  function grantBooster(effect, xFrac, yFrac) {
    if (effect === 'shield') {
      grantShieldBuff(player);
    } else if (effect === 'magnet') {
      grantMagnetBuff(player);
    } else if (effect === 'wave') {
      let bombIdx = 0;
      for (const other of items) {
        if (!other.resolved && !other.doomed && other.type.kind === 'hazard') {
          other.doomed = true;
          other.detonateTimer = bombIdx * WAVE_DETONATE_STAGGER_SEC;
          bombIdx += 1;
        }
      }
      spawnWaveClear(juice, xFrac, yFrac);
      triggerScreenShake(juice, 0.28, 0.016);
      playSfx(audio, sfx.sfx_wave_clear);
    }
  }

  // A bomb destroyed by a player action WITHOUT costing a life (shield block,
  // blow-up, later ooze projectiles) -- 2026-08-02. Awards points + a "+N"
  // popup and fills the bomb-kill set; completing the set fires the same
  // celebration as a box (bomb icon + "BOMB SQUAD!" + 2 boosters) and grants
  // them. Call this from every such destruction site; NEVER when a bomb hurt
  // the player.
  function killBomb(item) {
    registerBombKillScore(scoring, BOMB_KILL_SET.killScore);
    spawnScorePopup(juice, item.xFrac, item.yFrac, `+${BOMB_KILL_SET.killScore}`, BOMB_KILL_SET.hex);
    // Same "it registered" treatment as a caught slice: the bomb flies
    // (curved) into the bomb-kill chip, which bloops on arrival (2026-08-03).
    const chipPos = ui.getChipCenterFrac(BOMB_KILL_SET.id);
    spawnCollectFlyer(juice, item.xFrac, item.yFrac, chipPos.xFrac, chipPos.yFrac, BOMB_KILL_SET.hex, () => ui.pulseChip(BOMB_KILL_SET.id), 'bomb');
    const done = registerBombKill(bombKills);
    if (done) {
      registerBoxComplete(scoring, done.bonusScore);
      for (const effect of done.effects) grantBooster(effect, item.xFrac, item.yFrac);
      spawnBoxComplete(juice, item.xFrac, item.yFrac, done.hex);
      playSfx(audio, sfx.sfx_box_complete);
      ui.showBoxComplete(done.label, done.bonusScore, done.hex, done.id, { effects: done.effects, grantLife: false });
    }
  }

  // Called every frame an unresolved item overlaps Michelangelo's full
  // head-to-feet hit band (§6) -- this is the "catch" path, and can fire
  // anywhere along his body, not just when an item reaches his feet.
  function handleItemOverlap(item) {
    if (item.type.kind === 'good') {
      item.resolved = true;
      const prevMultiplier = getComboMultiplier(scoring);
      const scoreBefore = scoring.score;
      const newMultiplier = registerPizzaHit(scoring);
      const gained = scoring.score - scoreBefore; // actual points (base x combo)
      triggerSwing(player);
      spawnPizzaBreak(juice, item.xFrac, item.yFrac);
      // Retro "+N" popup at the slice, showing exactly what the catch was worth.
      spawnScorePopup(juice, item.xFrac, item.yFrac, `+${gained}`, '#ffe066');
      // Small splash on EVERY pizza hit (plain or box-variant); the rising
      // combo chime layers on top only when the multiplier ticks up.
      playSfx(audio, sfx.sfx_pizza_splash);
      if (newMultiplier > prevMultiplier) playSfx(audio, sfx.sfx_combo_up);
      // Box-colored slice: feed its collection box. registerBoxCatch resets
      // the box and returns its bonus/hex on the completing catch, else null.
      if (item.type.boxColor) {
        const boxColor = item.type.boxColor;
        // Fly a shred from the catch into that box's HUD chip; on landing it
        // "bloops" the chip, so the player sees the slice register into that
        // colored box (feedback 2026-08-03).
        const chipPos = ui.getChipCenterFrac(boxColor);
        const boxHex = (BOX_COLOR_BY_ID[boxColor] || {}).hex || '#ffffff';
        spawnCollectFlyer(juice, item.xFrac, item.yFrac, chipPos.xFrac, chipPos.yFrac, boxHex, () => ui.pulseChip(boxColor));
        const done = registerBoxCatch(boxes, boxColor);
        if (done) {
          // Auto-reward (2026-08-02): each box grants N distinct boosters
          // (regular 1, blue 2, purple 3); the top (red) box grants an extra
          // life only. Counts per box in data/boxColors.js. Rolled BEFORE the
          // popup so it can show what you earned, big.
          const reward = rollBoxReward(done.id);
          for (const effect of reward.effects) grantBooster(effect, item.xFrac, item.yFrac);
          if (reward.grantLife) gainLife(lives);
          registerBoxComplete(scoring, done.bonusScore);
          spawnBoxComplete(juice, item.xFrac, item.yFrac, done.hex);
          playSfx(audio, sfx.sfx_box_complete);
          ui.showBoxComplete(done.label, done.bonusScore, done.hex, done.id, reward);
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
        // Ooze is disabled (powerUps.js weight 0) so this never fires today;
        // kept for easy re-enable. Every other pickup routes to grantBooster.
        registerOozeHit(scoring);
        grantOozeBuff(player);
        spawnOozeSplash(juice, item.xFrac, item.yFrac);
      } else {
        // shield / magnet / wave -- wave's staggered "popcorn" bomb clear lives
        // in grantBooster (shared with box-completion rewards).
        grantBooster(effect, item.xFrac, item.yFrac);
      }
    } else {
      // bomb
      if (isShielded(player)) {
        // Shielded: block it -- no life lost, no combo break, no game over.
        // Counts as a bomb kill (destroyed by a player action, unharmed).
        item.resolved = true;
        triggerBlock(player);
        spawnShieldBlock(juice, item.xFrac, item.yFrac);
        playSfx(audio, sfx.sfx_shield_block);
        killBomb(item);
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
      registerComboBreak(scoring); // missed pizza (§8) -- no sound (removed the
      // "disappointment" miss cue per feedback 2026-07-30); combo still breaks.
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
      // Doomed bombs (wave pickup): frozen in place, counting down to a
      // staggered pop -- they don't fall, can't hurt the player, and detonate
      // when their timer elapses. A soft per-bomb pop sells the popcorn.
      if (item.doomed) {
        item.detonateTimer -= dt;
        if (item.detonateTimer <= 0) {
          item.resolved = true;
          spawnBombExplosion(juice, item.xFrac, item.yFrac);
          playSfx(audio, sfx.sfx_bomb_hit, 0.3);
          killBomb(item); // blow-up destroyed it -- counts as a bomb kill
        }
        continue;
      }
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
    ui.setLives(lives.remaining, lives.capacity);
    ui.setBuffs(player);
    ui.setBoxes(boxes);
    ui.setBombKills(bombKills);

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
          // Keep ticking VFX so the death screen-shake DECAYS to 0 and the
          // explosion particles settle, instead of freezing with shakeTimer > 0
          // -- which left renderFrame's getShakeOffsetFrac jittering the scene
          // forever behind the game-over overlay (fix 2026-08-02).
          updateJuice(juice, dt);
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
