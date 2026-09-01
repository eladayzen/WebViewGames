// Boot + game loop. Wires input -> player -> systems (spawner, difficulty,
// scoring, lives, ooze buff, juice) -> render + DOM HUD, per the
// core/entities/systems/input/ui/data split in the build doc's §9.3
// technical architecture.

import { loadAssets, loadAudioAssets } from './assets.js';
import { setupCanvas, renderFrame } from './render.js';
import { createGameState, updateCountdown, triggerGameOver, restartToCountdown, triggerIntro, triggerStageComplete, resumeRunning } from './gameState.js';
import { INTRO_STEP1_AUTO_ADVANCE_SEC, INTRO_STEP2_AUTO_ADVANCE_SEC, INTRO_RUN_FRAME_DURATION_SEC } from '../data/introTutorial.js';
import { STAGE_COMPLETE_COUNTDOWN_SEC, STAGE_CURTAIN_CLOSE_DELAY_SEC, STAGE_CURTAIN_TRANSITION_SEC } from '../data/stageTransition.js';
import { getSteerAxis, applySensitivityToHost } from '../input/input.js';
import { createAudio, playSfx, startMusic, pauseMusic, resumeMusic } from '../systems/audio.js';
import { initSettingsPanel } from '../ui/settingsPanel.js';
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
  RUN_CYCLE_KEYS,
} from '../entities/player.js';
import { updateFallingItem, applyMagnetPull, hasReachedStrikeBand, isWithinPlayerBand, isOffScreen } from '../entities/fallingItem.js';
import { createSpawner, resetSpawner, updateSpawner } from '../systems/spawner.js';
import { createBombPresence, resetBombPresence, updateBombPresence } from '../systems/bombPresence.js';
import { createBoxes, resetBoxes, registerBoxCatch, updateBoxes } from '../systems/boxes.js';
import { createBombKills, resetBombKills, registerBombKill, updateBombKills } from '../systems/bombKills.js';
import { rollBoxReward, BOX_COLOR_BY_ID } from '../data/boxColors.js';
// Per-theme falling-item sprite key by box color, so the fly-to-chip "twin"
// matches the caught art (an idol in the original theme, pizza_slice in TMNT).
import { FALLING_SPRITE_KEY_BY_BOX_COLOR } from '@collectible-assets';
import { BOMB_KILL_SET } from '../data/bombKills.js';
import { createDifficulty, resetDifficulty, updateDifficulty, commitStageAdvance, getStage, getScoreBand } from '../systems/difficulty.js';
import { STAGES } from '../data/stages.js';
import {
  createScoring,
  resetScoring,
  registerPizzaHit,
  registerOozeHit,
  registerComboBreak,
  registerBoxComplete,
  registerBombKillScore,
} from '../systems/scoring.js';
import { createLives, resetLives, loseLife, gainLife, isDead } from '../systems/lives.js';
import { submitRun, fetchBoard, resultSections } from '../systems/scoreboard.js';
import { createJuice, resetJuice, updateJuice, spawnPizzaBreak, spawnOozeSplash, spawnBombExplosion, spawnBoxComplete, spawnShieldBlock, spawnWaveClear, spawnPickupSparkle, spawnScorePopup, spawnCollectFlyer, spawnStageCompleteBurst, triggerScreenShake } from '../systems/juice.js';
import { createUI } from '../ui/ui.js';
import { PLAYER_HEIGHT_FRAC, ITEM_MIN_X_FRAC, ITEM_MAX_X_FRAC, BOX_COMPLETE_FLY_MS, HUD_SCALE_REFERENCE_HEIGHT_PX, HUD_SCALE_MAX } from '../data/constants.js';

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
  const bombPresence = createBombPresence();
  const difficulty = createDifficulty();
  const scoring = createScoring();
  const lives = createLives();
  const juice = createJuice();
  const boxes = createBoxes();
  const bombKills = createBombKills();
  const audio = createAudio();
  let items = [];
  let lastCountdownTick = null; // last whole-second value shown, for tick SFX

  // First-run onboarding tutorial state (core/gameState.js's 'intro' state,
  // data/introTutorial.js's timing knobs) -- all dt-driven from frame()'s
  // 'intro' branch below, same reasoning as every other timed effect here:
  // pausing genuinely holds it rather than letting it expire behind the
  // pause screen.
  let introStep = 1; // 1 = item recognition, 2 = movement
  let introElapsed = 0; // time in the CURRENT step, for the auto-advance timeout
  let introRunFrameIndex = 0;
  let introRunFrameElapsed = 0;
  // Loop phase for the JS-driven tutorial board-tilt + character sweep (was a
  // CSS @keyframes animation; those freeze on the occluded WebView -- ui.js).
  let introSweepElapsed = 0;

  // Quit-confirm flow: remember whether the game was already paused when the X
  // raised the confirm, so KEEP PLAYING restores that state rather than
  // blindly unpausing someone who had deliberately paused (GOBALANCE_APP_-
  // INTEGRATION.md "Quitting").
  let pausedBeforeConfirm = false;

  // Stage-complete transition state (freeze + curtain, ported from
  // HalfShellHustle's level-complete pattern -- data/stageTransition.js's
  // timing knobs) -- all dt-driven from frame()'s 'stagecomplete' branch,
  // same reasoning as intro above: pausing genuinely holds it.
  let stageCompleteElapsed = 0;
  let stageCurtainsClosed = false;
  let stageSwapped = false;
  // Seconds since the current countdown number appeared, for its JS-driven
  // tick pop (was a CSS class-toggle animation -- ui.js setStageTickAnim).
  let stageTickElapsed = 0;

  // Background music is back on by default (2026-08-19, was off since
  // 2026-07-30's "annoying" feedback -- replaced with a new track + real
  // SFX/MUSIC toggles, see the settings panel below). Safe to call
  // unconditionally: startMusic itself checks the persisted musicEnabled
  // preference and no-ops if it's off, while still remembering the buffer
  // for the settings panel to restart later. Loops continuously across
  // countdown/running/restart; pause is the only thing that stops it.
  startMusic(audio, sfx.music_bed);

  function fullReset() {
    resetPlayer(player);
    resetSpawner(spawner);
    resetBombPresence(bombPresence);
    resetDifficulty(difficulty);
    resetScoring(scoring);
    resetLives(lives);
    resetJuice(juice);
    resetBoxes(boxes);
    resetBombKills(bombKills);
    items = [];
    ui.hideGameOver();

    // Push the HUD fresh RIGHT NOW (2026-08-05 fix) -- these setters are
    // otherwise only ever called from inside updateRunning, which doesn't
    // run again until 'running' resumes (after the intro tutorial +
    // countdown finish). Without this, the score/lives/buffs/boxes HUD kept
    // showing the PREVIOUS run's leftover numbers the whole time the player
    // was sitting through the new run's intro/countdown -- a real bug
    // carried since the start, not just a this-session one. (setCombo is
    // no longer called -- the combo multiplier HUD chip is disabled, see
    // systems/scoring.js.)
    const scoreBand = getScoreBand(difficulty);
    ui.setScore(scoring.score, scoreBand.prevThreshold, scoreBand.nextThreshold);
    ui.setLives(lives.remaining, lives.capacity);
    ui.setBuffs(player);
    ui.setBoxes(boxes);
    ui.setBombKills(bombKills);
  }

  // Submit the finished run to the family-account board, then fetch + render
  // it into the game-over overlay. Fire-and-forget: never awaited, never
  // blocks the death screen, and a no-op outside the app (scoreboard.js
  // feature-detects). SUBMIT BEFORE FETCH so the run just played is in the
  // board. Called ONCE from the death site (not the per-frame gameover
  // branch, which would resubmit every frame). `justScored` is held locally
  // so the row can be found + highlighted (entries carry no run id).
  function submitAndShowBoard(justScored) {
    submitRun(justScored).then(() =>
      fetchBoard().then((board) => {
        const { top, window: near } = resultSections(board.rows, justScored);
        ui.showScoreboard(board, near.length ? [top, near] : [top]);
      })
    );
  }

  // One route for pause, so the audio suspend/resume can never drift out of
  // step with gs.paused or the HUD (GOBALANCE_APP_INTEGRATION.md). Used by the
  // pause button AND the quit-confirm flow.
  function setPaused(value) {
    gs.paused = value;
    ui.setPaused(value);
    if (value) pauseMusic();
    else resumeMusic();
  }

  // Leave the game back to the app's games list. Prefer the SDK's back(); fall
  // back to the raw native bridge so a game whose module failed to load is
  // still escapable (the inline #gb-back onclick has the same fallback).
  function leaveToLobby() {
    if (window.GoBalance && typeof window.GoBalance.back === 'function') {
      window.GoBalance.back();
      return;
    }
    if (window.Unity) window.Unity.call('nav:back');
  }

  // The X (#gb-back) hook. Only interrupts a LIVE run with a confirm; from any
  // screen where the player is already stopped (intro/countdown/stage-complete/
  // game-over, or the quit board itself) it just leaves. Ignores repeat taps
  // while the confirm is already up so pausedBeforeConfirm isn't clobbered.
  window.__gbBack = () => {
    if (ui.isQuitOpen()) return leaveToLobby();
    if (ui.isConfirmOpen()) return;
    if (gs.current !== 'running') return leaveToLobby();
    pausedBeforeConfirm = gs.paused;
    setPaused(true);
    ui.showConfirm();
  };

  // Confirmed a mid-run quit: end the run, submit it (a run ended by choice
  // still happened), and show the quit board with the family leaderboard. The
  // board is shown immediately with just the result line; the leaderboard
  // fills in when the async fetch resolves. No auto-restart timer.
  function endRunAndShowQuit() {
    ui.hideConfirm();
    setPaused(true);
    const runScore = scoring.score;
    const statsText = `SCORE ${Math.floor(runScore).toLocaleString()} · BEST COMBO x${scoring.bestCombo}`;
    ui.showQuit(statsText, null, []);
    submitRun(runScore).then(() =>
      fetchBoard().then((board) => {
        const { top, window: near } = resultSections(board.rows, runScore);
        ui.showQuit(statsText, board, near.length ? [top, near] : [top]);
      })
    );
  }

  // PLAY AGAIN from the quit board, and the shared path for the game-over
  // RETRY button: dismiss the quit board, rebuild the world, run the intro,
  // and clear any pause.
  function restartGame() {
    ui.hideQuit();
    fullReset();
    beginIntro();
    setPaused(false);
  }

  // Shown every run (boot() below and the restart button both call this),
  // not just the first one ever -- direct-feedback pattern ported from
  // HalfShellHustle (see WEB_MINIGAME_TECH_RETROSPECTIVE.md). Always called
  // right after fullReset() has the world already built and frozen.
  function beginIntro() {
    triggerIntro(gs);
    introStep = 1;
    introElapsed = 0;
    introRunFrameIndex = 0;
    introRunFrameElapsed = 0;
    introSweepElapsed = 0;
    ui.showIntroTutorial();
  }

  function advanceIntroStep() {
    introStep = 2;
    introElapsed = 0;
    ui.setIntroStep(2);
  }

  function dismissIntro() {
    ui.hideIntroTutorial();
    restartToCountdown(gs);
  }

  document.getElementById('intro-next-button').addEventListener('click', () => {
    if (gs.current === 'intro' && introStep === 1) {
      playSfx(audio, sfx.sfx_ui_tap);
      advanceIntroStep();
    }
  });
  document.getElementById('intro-start-button').addEventListener('click', () => {
    if (gs.current === 'intro' && introStep === 2) {
      playSfx(audio, sfx.sfx_ui_tap);
      dismissIntro();
    }
  });
  // GOBALANCE_SDK.md: Space/Enter keydown/keyup are ALWAYS forwarded
  // (unlike the synthetic #restart-button click, which is gated on
  // #gameover-overlay) -- a real on-device speed-up over the 8s auto-
  // advance fallback below, not just a dev convenience.
  window.addEventListener('keydown', (e) => {
    if (gs.current !== 'intro' || (e.code !== 'Space' && e.code !== 'Enter')) return;
    playSfx(audio, sfx.sfx_ui_tap);
    if (introStep === 1) advanceIntroStep();
    else dismissIntro();
  });

  document.getElementById('restart-button').addEventListener('click', () => {
    playSfx(audio, sfx.sfx_ui_tap);
    restartGame();
  });

  document.getElementById('pause-button').addEventListener('click', () => {
    playSfx(audio, sfx.sfx_ui_tap);
    setPaused(!gs.paused);
  });

  // Quit-flow buttons (GOBALANCE_APP_INTEGRATION.md "Quitting"). stopPropagation
  // so a tap on a card button never falls through to a backdrop handler.
  document.getElementById('confirm-stay').addEventListener('click', (e) => {
    e.stopPropagation();
    playSfx(audio, sfx.sfx_ui_tap);
    ui.hideConfirm();
    setPaused(pausedBeforeConfirm); // restore prior state, not blind unpause
  });
  document.getElementById('confirm-quit').addEventListener('click', (e) => {
    e.stopPropagation();
    playSfx(audio, sfx.sfx_ui_tap);
    endRunAndShowQuit();
  });
  document.getElementById('quit-again').addEventListener('click', (e) => {
    e.stopPropagation();
    playSfx(audio, sfx.sfx_ui_tap);
    restartGame();
  });
  document.getElementById('quit-leave').addEventListener('click', (e) => {
    e.stopPropagation();
    playSfx(audio, sfx.sfx_ui_tap);
    leaveToLobby();
  });

  // Settings panel (gear button, 2026-08-19) -- SENSITIVITY/MUSIC/SFX,
  // replaces the old single mute-button. See ui/settingsPanel.js's header
  // for why it's driven by touch AND Enter/Space (no pointer is forwarded
  // inside the real Unity WebView in this game's analog steering mode).
  initSettingsPanel(() => playSfx(audio, sfx.sfx_ui_tap));

  // Push the persisted board sensitivity to the host on boot -- it doesn't
  // remember the choice across launches (GOBALANCE_APP_INTEGRATION.md). No-op
  // outside the app.
  applySensitivityToHost();

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
      // Stalled until the flying twin chip actually lands on the popup
      // (2026-08-04 feedback) -- see BOX_COMPLETE_FLY_MS/showBoxComplete.
      // This timer is independent of ui.js's own reveal timer so these
      // effects always fire exactly once, even if the popup's pool slot
      // later gets recycled by a further completion.
      ui.showBoxComplete(done.label, done.bonusScore, done.hex, done.id, { effects: done.effects, grantLife: false });
      setTimeout(() => {
        registerBoxComplete(scoring, done.bonusScore);
        for (const effect of done.effects) grantBooster(effect, item.xFrac, item.yFrac);
        spawnBoxComplete(juice, item.xFrac, item.yFrac, done.hex);
        playSfx(audio, sfx.sfx_box_complete);
      }, BOX_COMPLETE_FLY_MS);
    }
  }

  // Called every frame an unresolved item overlaps Michelangelo's full
  // head-to-feet hit band (§6) -- this is the "catch" path, and can fire
  // anywhere along his body, not just when an item reaches his feet.
  function handleItemOverlap(item) {
    if (item.type.kind === 'good') {
      item.resolved = true;
      // Flat, tiered per-catch score (2026-08-06) -- see data/itemTypes.js.
      // The combo multiplier is disabled for now (hidden from the HUD, no
      // longer applied here); registerPizzaHit still tracks the streak
      // count underneath for a later re-enable.
      registerPizzaHit(scoring, item.type.score);
      triggerSwing(player);
      spawnPizzaBreak(juice, item.xFrac, item.yFrac);
      // Retro "+N" popup at the slice, showing exactly what the catch was worth.
      spawnScorePopup(juice, item.xFrac, item.yFrac, `+${item.type.score}`, '#ffe066');
      playSfx(audio, sfx.sfx_pizza_splash);
      // Box-colored slice: feed its collection box. registerBoxCatch resets
      // the box and returns its bonus/hex on the completing catch, else null.
      if (item.type.boxColor) {
        const boxColor = item.type.boxColor;
        // Fly a shred from the catch into that box's HUD chip; on landing it
        // "bloops" the chip, so the player sees the slice register into that
        // colored box (feedback 2026-08-03).
        const chipPos = ui.getChipCenterFrac(boxColor);
        const boxHex = (BOX_COLOR_BY_ID[boxColor] || {}).hex || '#ffffff';
        spawnCollectFlyer(juice, item.xFrac, item.yFrac, chipPos.xFrac, chipPos.yFrac, boxHex, () => ui.pulseChip(boxColor), FALLING_SPRITE_KEY_BY_BOX_COLOR[boxColor]);
        const done = registerBoxCatch(boxes, boxColor);
        if (done) {
          // Auto-reward (2026-08-02): each box grants N distinct boosters
          // (regular 1, blue 2, purple 3); the top (red) box grants an extra
          // life only. Counts per box in data/boxColors.js. Rolled BEFORE the
          // popup so it can show what you earned, big.
          const reward = rollBoxReward(done.id);
          ui.showBoxComplete(done.label, done.bonusScore, done.hex, done.id, reward);
          // Stalled until the flying twin chip actually lands on the popup
          // (2026-08-04 feedback) -- see BOX_COMPLETE_FLY_MS/showBoxComplete.
          // This timer is independent of ui.js's own reveal timer so these
          // effects always fire exactly once, even if the popup's pool slot
          // later gets recycled by a further completion.
          setTimeout(() => {
            for (const effect of reward.effects) grantBooster(effect, item.xFrac, item.yFrac);
            if (reward.grantLife) gainLife(lives);
            registerBoxComplete(scoring, done.bonusScore);
            spawnBoxComplete(juice, item.xFrac, item.yFrac, done.hex);
            playSfx(audio, sfx.sfx_box_complete);
          }, BOX_COMPLETE_FLY_MS);
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
          submitAndShowBoard(scoring.score);
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

  // Entered when updateDifficulty detects the next stage's threshold crossed
  // (freeze + curtain transition, ported from HalfShellHustle's level-
  // complete pattern -- see WEB_MINIGAME_TECH_RETROSPECTIVE.md). The world
  // freezes (gs.current gates the whole of updateRunning), the curtain
  // closes over the scene, the stage actually advances hidden behind it
  // (commitStageAdvance, in frame()'s 'stagecomplete' branch below), then
  // the curtain opens back onto the new stage already in motion. Reads the
  // NEXT stage's name before anything advances -- difficulty.stageIndex
  // itself doesn't move until commitStageAdvance runs, later.
  function beginStageComplete() {
    triggerStageComplete(gs);
    stageCompleteElapsed = 0;
    stageCurtainsClosed = false;
    stageSwapped = false;
    const nextStage = STAGES[difficulty.stageIndex + 1];
    ui.showStageComplete(nextStage.name);
    spawnStageCompleteBurst(juice, 0.5, 0.4);
    playSfx(audio, sfx.sfx_stage_advance);
  }

  function updateRunning(dt) {
    const steerAxis = getSteerAxis();
    updatePlayer(player, dt, steerAxis);

    const advanced = updateDifficulty(difficulty, dt, scoring.score);
    const stage = getStage(difficulty);
    if (advanced) {
      // Freeze starts THIS frame -- return immediately so no spawn/item/
      // collision logic below sneaks in one more tick after gs.current has
      // already flipped to 'stagecomplete' (a genuine freeze, not a
      // one-frame-late one).
      beginStageComplete();
      return stage;
    }

    // Bomb presence floor (2026-08-05, raised to a count of 2): if the
    // number of bombs currently on screen has stayed below the floor too
    // long, force the NEXT spawn to be a bomb, at the play-area edge FAR
    // from the player -- directly answers "I can camp an edge and stay
    // safe." See systems/bombPresence.js.
    const bombCount = items.reduce((n, it) => n + (!it.resolved && it.type.kind === 'hazard' ? 1 : 0), 0);
    const forceBomb = updateBombPresence(bombPresence, dt, bombCount);
    const forcedBombXFrac = forceBomb ? (player.xFrac < 0.5 ? ITEM_MAX_X_FRAC : ITEM_MIN_X_FRAC) : null;

    const spawned = updateSpawner(spawner, dt, stage, boxes, forcedBombXFrac);
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
    // Same ordering rule, same reason (2026-08-04): a kill that completes
    // the bomb-kill set this frame is already handled inside killBomb above.
    updateBombKills(bombKills, dt);

    const scoreBand = getScoreBand(difficulty);
    ui.setScore(scoring.score, scoreBand.prevThreshold, scoreBand.nextThreshold);
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

      // HUD scale (2026-08-16): unconditional, every frame, same reasoning
      // as render.js's per-frame window.innerWidth/innerHeight read --
      // Unity doesn't reliably fire a `resize` DOM event inside the real
      // WebView. Runs regardless of gs.paused/gs.current so the HUD reads
      // correctly even on the intro/countdown/gameover screens.
      const hudScale = Math.min(
        HUD_SCALE_MAX,
        Math.max(1, window.innerHeight / HUD_SCALE_REFERENCE_HEIGHT_PX)
      );
      ui.setHudScale(hudScale);

      let stage = getStage(difficulty);

      // Pause freezes the whole simulation in place -- gs.current is left
      // untouched, so resuming drops back into exactly countdown/running/
      // gameover, whichever it was paused from (§ HUD conventions).
      if (!gs.paused) {
        if (gs.current === 'intro') {
          ui.setCountdown(0);
          introElapsed += dt;
          if (introStep === 2) {
            // Board-tilt + character sweep, driven per-frame (was CSS
            // @keyframes -- freezes on the occluded WebView, ui.js). 3.6s loop.
            introSweepElapsed += dt;
            ui.setIntroSweep((introSweepElapsed % 3.6) / 3.6);
            // Run-cycle frame swap, keyed to the real in-game cadence.
            introRunFrameElapsed += dt;
            if (introRunFrameElapsed >= INTRO_RUN_FRAME_DURATION_SEC) {
              introRunFrameElapsed -= INTRO_RUN_FRAME_DURATION_SEC;
              introRunFrameIndex = (introRunFrameIndex + 1) % RUN_CYCLE_KEYS.length;
              ui.setIntroRunFrame(introRunFrameIndex);
            }
          }
          // GOBALANCE_SDK.md's "first playable state reachable with no key"
          // contract -- each step auto-advances on its own after this many
          // seconds of no interaction (a click/Space/Enter above is a
          // speed-up over this, never a requirement). Per-step timeout.
          if (introStep === 1) {
            if (introElapsed >= INTRO_STEP1_AUTO_ADVANCE_SEC) advanceIntroStep();
          } else if (introElapsed >= INTRO_STEP2_AUTO_ADVANCE_SEC) {
            dismissIntro();
          }
        } else if (gs.current === 'countdown') {
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
        } else if (gs.current === 'stagecomplete') {
          ui.setCountdown(0);
          stageCompleteElapsed += dt;
          // Headline bounce + countdown tick pop, driven per-frame (were CSS
          // animations -- freeze on the occluded WebView, ui.js). The tick
          // timer resets the frame the number changes so each gets its beat.
          ui.setStageHeadlineAnim(stageCompleteElapsed);
          // ceil, floored at 1: reads "1" for the whole final second rather
          // than flashing a 0 nobody is meant to see.
          const tickChanged = ui.setStageCountdown(
            Math.max(1, Math.ceil(STAGE_COMPLETE_COUNTDOWN_SEC - stageCompleteElapsed))
          );
          stageTickElapsed = tickChanged ? 0 : stageTickElapsed + dt;
          ui.setStageTickAnim(stageTickElapsed);
          // Let the celebration burst play out/decay while the world is
          // frozen (same "keep ticking VFX" fix already applied to gameover
          // -- otherwise it'd freeze mid-burst instead of settling).
          updateJuice(juice, dt);

          // Starts the curtain CLOSE partway through the countdown -- the
          // headline/burst beat gets a clear moment to itself first. Only
          // STARTS the CSS transition; see the swap check below for why the
          // actual stage advance waits for it to finish.
          if (!stageCurtainsClosed && stageCompleteElapsed >= STAGE_CURTAIN_CLOSE_DELAY_SEC) {
            ui.closeStageCurtains();
            stageCurtainsClosed = true;
          }

          // THE STAGE ADVANCE, once the curtains have actually FINISHED
          // closing (CLOSE_DELAY + TRANSITION), not the instant they start
          // to -- each stage's groundYFrac differs, so swapping while the
          // curtains are still open (or mid-slide) would visibly teleport
          // the player/ground line. A closed curtain is what actually hides
          // that jump.
          if (!stageSwapped && stageCurtainsClosed
              && stageCompleteElapsed >= STAGE_CURTAIN_CLOSE_DELAY_SEC + STAGE_CURTAIN_TRANSITION_SEC) {
            stageSwapped = true;
            commitStageAdvance(difficulty);
            stage = getStage(difficulty); // hidden behind the still-closed curtain until it reopens
          }

          if (stageCompleteElapsed >= STAGE_COMPLETE_COUNTDOWN_SEC) {
            ui.hideStageComplete();
            resumeRunning(gs);
            // Curtains are the LAST thing to move -- reveals the new stage
            // already in motion rather than popping straight to it.
            ui.openStageCurtains();
          }
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
      // Theme-neutral on purpose (2026-08-20) -- this string ships in the
      // JS bundle for BOTH builds (see core/heroAssets.*.js's header for
      // the broader "original build ships nothing TMNT-adjacent" rule);
      // a project name here would be a needless leak into the non-TMNT
      // build's shipped code for zero benefit (it's an error log, not
      // user-facing copy).
      console.error('frame() error:', err);
      throw err;
    }
  }

  beginIntro();
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
