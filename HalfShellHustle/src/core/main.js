// Renderer/scene/camera bootstrap + top-level game loop + state machine
// (build doc §9.2, §9.3, §10 POC milestones). POC scope only: no CHASE
// meter, no scoring, no blocks, no pizza/coin/smoke-bomb, no Foot-bot in
// view -- a hit ends the run immediately (§2).

import * as THREE from 'three';
import '../style.css';

import { createStreet, updateStreet, disposeStreet } from '../street/street.js';
import {
  createCameraRig, updateCameraRig, resetCameraRig, triggerCameraShake,
} from '../street/camera-rig.js';
import {
  createPlayer, resetPlayer, setPlayerLane, startPlayerJump, startPlayerAttack, updatePlayer,
  getPlayerHeadAnchor, setPlayerVisible, grantMagnet, isMagnetActive, triggerBlockedNudge,
} from '../entities/player.js';
import { createRibbon, resetRibbon, updateRibbon } from '../entities/ribbon.js';
import {
  createObstaclePool, resetObstaclePool, spawnObstacle, updateObstaclePool,
} from '../entities/obstacles.js';
import { checkObstacleHit } from '../entities/collision.js';
import {
  createContactShadow, pulseContactShadow, updateContactShadow, setContactShadowVisible,
} from '../entities/contactShadow.js';
import {
  createEnemyPool, resetEnemyPool, spawnEnemy, updateEnemyPool, checkEnemyHit, killEnemy,
} from '../entities/enemy.js';
import {
  createPlatformField, resetPlatformField, spawnPlatform, updatePlatformField,
  checkPlatformKillBarrierHit, markPlatformCleared, isPlatformLaneBlocked,
} from '../entities/platform.js';
import {
  createCoinPool, resetCoinPool, spawnCoinCluster, updateCoinPool, collectCoins, despawnCoin,
  applyMagnetPull,
} from '../entities/coins.js';
import {
  createPickupPool, resetPickupPool, spawnPickup, updatePickupPool, collectPickups, despawnPickup,
} from '../entities/pickups.js';
import { spawnArrivalTime, hazardSpacingMultiplierAt } from '../systems/difficulty.js';
import { createSpawnerState, resetSpawner, updateSpawner } from '../systems/spawner.js';
import {
  createScoreState, resetScoreState, awardEnemyKill, awardCoin,
  creditDisplayed, settleScore,
} from '../systems/scoring.js';
import {
  initPointsFly, spawnPointsFly, updatePointsFly, clearPointsFly,
  refreshPointsFlyTarget,
} from '../ui/pointsFly.js';
import { progressAt, themeForTier } from '../systems/progression.js';
import { speedAt, distanceTraveledBy, seedDistanceAt } from '../systems/speed.js';
import {
  createLivesState, resetLivesState, tryHit, isInvulnerable, gainLife,
} from '../systems/lives.js';
import {
  createGameState, restartToRunning, triggerGameOver, triggerLevelComplete, triggerIntro,
} from './gameState.js';
import {
  INTRO_LANE_CYCLE, INTRO_LANE_STATE_HOLD_SEC, INTRO_JUMP_CYCLE, INTRO_STEP_AUTO_ADVANCE_SEC,
} from '../data/introTutorial.js';
import {
  updateSteering, pollLaneStep, getLaneTarget, pollJumpPress,
} from '../input/input.js';
import * as hud from '../ui/hud.js';
import { initSteeringPanel } from '../ui/steeringPanel.js';
import {
  LANE_X, CENTER_LANE, ASPECT_W, ASPECT_H, CAMERA_FOV, LIVES_START, LIVES_SOFTCAP, SPAWN_Z,
} from '../data/constants.js';
import {
  INTRO_WALL_ENABLED, INTRO_WALL_ENEMY_COUNT, INTRO_WALL_SPAWN_Z,
  INTRO_NORMAL_ENEMY_DELAY_SEC, INTRO_OBSTACLE_DELAY_SEC,
  INTRO_SEED_ENABLED, INTRO_SEED_OBSTACLE_ARRIVALS, INTRO_SEED_ENEMY_ARRIVALS,
  INTRO_SEED_PLATFORM_ARRIVALS, INTRO_SEED_COIN_ARRIVALS,
  LEVEL_RESTART_SEED_OBSTACLE_ARRIVALS, LEVEL_RESTART_SEED_ENEMY_ARRIVALS,
  LEVEL_RESTART_SEED_PLATFORM_ARRIVALS, LEVEL_RESTART_SEED_COIN_ARRIVALS,
} from '../data/introSequence.js';
import {
  LEVEL_COUNTDOWN_SECONDS, LEVEL_SWAPS_ENVIRONMENT, LEVEL_CURTAIN_CLOSE_DELAY_SEC,
} from '../data/progression.js';
import { PLATFORM_ENABLED } from '../data/platformSequence.js';
import {
  OBSTACLE_FIRST_SPAWN_DELAY_SEC, ENEMY_FIRST_SPAWN_DELAY_SEC, ENEMY_SPAWN_INTERVAL_SEC,
  MIN_ENEMY_OBSTACLE_GAP_SEC, PLATFORM_FIRST_SPAWN_DELAY_SEC, PLATFORM_SPAWN_INTERVAL_SEC,
  PLATFORM_KILL_TYPE_ENABLED, PLATFORM_KILL_TYPE_CHANCE,
  COIN_FIRST_SPAWN_DELAY_SEC, COIN_CLUSTER_SPAWN_INTERVAL_SEC,
  OBSTACLE_SPAWN_INTERVAL_SEC, EASE_IN_DURATION_SEC, LEVEL_RESTART_EASE_IN_DURATION_SEC,
  LEVEL_RESTART_PLATFORM_FIRST_DELAY_SEC,
  PICKUP_FIRST_SPAWN_DELAY_SEC, PICKUP_SPAWN_INTERVAL_SEC,
  PICKUP_MAGNET_SPAWN_CHANCE, PICKUP_LIFE_SPAWN_CHANCE,
} from '../data/spawnConfig.js';
import { FRAME_LABELS, PLAYER_RUN_FRAMES, RUN_FRAME_DURATION } from '../data/playerSprite.js';
import { COIN_TYPES } from '../data/coinTypes.js';
import {
  ParticlePool, spawnDustPuff, spawnEnemyPoof, spawnCoinSparkle,
  createSpeedStreaks, updateSpeedStreaks,
} from '../systems/vfx.js';

function boot() {
  const app = document.getElementById('app');
  const stage = document.getElementById('stage');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, ASPECT_W / ASPECT_H, 0.1, 220);

  // No scene lights: every material here is unlit (MeshBasicMaterial for
  // street/buildings, SpriteMaterial for player/obstacles) by design, so the
  // painted-in shading from the illustrated textures reads as intended
  // instead of getting re-shaded (§0, §9.1's environment-art correction).
  // Mutable now that a level transition can rebuild it under a new theme
  // (startNextLevel below) -- tier 1's theme, matching createStreet's own
  // default, so nothing changes at boot for a run that never reaches tier 2.
  let street = createStreet(scene, themeForTier(1));
  let currentThemeKey = themeForTier(1);

  const player = createPlayer();
  scene.add(player.sprite);

  // Separate flutter-ribbon object disabled: the active run-cycle set
  // (data/playerSprite.js) reverted to the original 4-frame art, which has
  // the long mask-tail ribbon baked directly into the body -- rendering
  // this too would double it up. Re-enable alongside a body set that only
  // bakes in a short neutral knot.
  // const ribbon = createRibbon();
  // scene.add(ribbon.sprite);

  const obstacleField = createObstaclePool(scene);
  const spawnerState = createSpawnerState();

  // Foot Soldier "bump-to-kill" enemy (direct feedback's addition, entities/
  // enemy.js): own pool/spawner from the barricade obstacles since a hit
  // here KILLS the enemy and scores, it doesn't end the run.
  const enemyField = createEnemyPool(scene);
  const enemySpawnerState = createSpawnerState(ENEMY_FIRST_SPAWN_DELAY_SEC);

  // Per-lane elevated platform (direct feedback's height system, data/
  // platformSequence.js): a solid, collidable object per lane -- 'kill'
  // (a black barrier: jump it or it's a hit, same as a barricade) or
  // 'ramp' (automatic, forced, no way through it except up).
  const platformField = createPlatformField(scene);
  const platformSpawnerState = createSpawnerState(PLATFORM_FIRST_SPAWN_DELAY_SEC);

  // Coin collectibles (direct feedback's addition, entities/coins.js): the
  // only purely-positive pickup besides bumping an enemy. Own pool/spawner,
  // and each tick spawns a whole CLUSTER (a row/arc/ramp-trail), not one
  // coin -- see spawnCoinCluster.
  const coinField = createCoinPool(scene);
  const coinSpawnerState = createSpawnerState(COIN_FIRST_SPAWN_DELAY_SEC);
  const pickupField = createPickupPool(scene);
  const pickupSpawnerState = createSpawnerState(PICKUP_FIRST_SPAWN_DELAY_SEC);

  const cameraRig = createCameraRig(camera);
  const gs = createGameState();

  // Lives (systems/lives.js): an obstacle now costs one life instead of
  // ending the run outright, with a brief invulnerability window after each
  // hit -- that window is required for correctness, not polish; see lives.js.
  const livesState = createLivesState();

  // Run-cycle energy VFX (experimental pass): ground contact shadow, dust
  // puffs fired on each foot-contact frame, and near-camera speed streaks.
  const contactShadow = createContactShadow(scene);
  // Pool sized for ~2 overlapping puffs' worth of particles (spawnDustPuff's
  // 16+8=24 per puff) with headroom, since more volume was asked for and a
  // too-small pool would silently start overwriting a puff's own particles
  // mid-life via the ring-buffer cursor.
  const dustPool = new ParticlePool(scene, 100, 0.4, 0.14);
  const DUST_AHEAD_OFFSET = 0.19; // spawn slightly ahead (more -Z, direction of travel) of his feet, not directly under/behind him where his own sprite covers it -- kept proportional to entities/player.js's PLAYER_SCALE
  const DUST_FAN_RATE = 0.1; // outward left/right drift per unit of camera-ward scroll, see ParticlePool.scrollZ
  const speedStreaks = createSpeedStreaks(scene);
  // Separate pool from dustPool -- different tuning (bigger/lighter poof
  // burst) and keeps the two effects' particle budgets from competing.
  // Sized for one full kill-poof (spawnEnemyPoof's 20 origins x 7 + a 40-
  // particle central burst = 180) with headroom for a second overlapping
  // kill before the first burst's particles finish fading.
  const enemyPoofPool = new ParticlePool(scene, 220, 0.5, 0.6);
  // Third pool, again for a structural reason rather than just tuning:
  // ParticlePool fixes point size and opacity in its CONSTRUCTOR, not per
  // spawn() call, so a coin's small bright spark can't be produced by either
  // pool above no matter what options are passed. Sized from the actual
  // worst case: 12 particles per sparkle (systems/vfx.js's
  // spawnCoinSparkle), row coins arriving ~0.16s apart against a ~0.34s
  // life = ~3 overlapping = ~36 live, so 80 is comfortable headroom.
  const coinSparklePool = new ParticlePool(scene, 80, 0.28, 0.85);

  // ONE merged total now (systems/scoring.js). The old separate `score`
  // (enemy kills) and `coinsCollected` counters are gone from the HUD --
  // direct feedback wanted every source summed into a single points value --
  // but their per-source tallies live on inside this state for the recap.
  const score = createScoreState();

  let distance = 0;
  // Rotates through data/playerSprite.js's ATTACK_SEQUENCES kill to kill
  // (not random) so back-to-back kills don't just repeat the same one.
  let attackSequenceIndex = 0;
  // Seconds of red damage-flash left (see index.html's #damage-flash for why
  // this is a timer rather than a one-frame toggle).
  let damageFlashTimer = 0;
  // See the blocked-lane branch in tick(): absolute steering retries a refused
  // move every frame, so the lurch needs a floor on how often it can re-fire.
  let blockedNudgeCooldown = 0;
  const BLOCKED_NUDGE_REPEAT_SEC = 0.45;
  // Recomputed every frame from gameTime (systems/speed.js). Held here rather
  // than recomputed at each of the eight places that need it, so every pool
  // is provably scrolling at the same rate on any given frame.
  let currentSpeed = speedAt(0);
  const DAMAGE_FLASH_DURATION_SEC = 0.14;
  const DAMAGE_FLASH_PEAK_OPACITY = 0.42;
  const DAMAGE_SHAKE_INTENSITY = 0.4; // same magnitude CarRacer uses for a crash
  const damageFlashEl = document.getElementById('damage-flash');

  // Running game-clock (seconds since the current run started) purely for
  // data/constants.js's MIN_ENEMY_OBSTACLE_GAP_SEC spacing rule below --
  // `distance` is world units, this needs to be time to compare directly
  // against spawn timestamps.
  let gameTime = 0;
  let lastObstacleSpawnTime = -Infinity;
  let lastEnemySpawnTime = -Infinity;

  // --- Level state. A level ends when a tier threshold is crossed; the world
  // restarts while points, tier, lives AND the run clock (hence speed) all
  // carry over. `levelStartTime` is the gameTime that level began at, and it's
  // what makes the grace ramp and the seed placement level-relative instead of
  // run-relative -- both would otherwise behave as if the run were still young.
  let levelIndex = 1;
  let levelStartTime = 0;
  let levelCountdown = 0;
  // The tier a level-complete transition is FOR, captured at the moment it
  // fires rather than derived by blindly incrementing levelIndex at the
  // countdown's end -- a single huge award can in principle cross more than
  // one tier threshold in one frame, and levelIndex must land on the tier
  // actually reached, not just "one more than before", or the wrong theme
  // gets picked below.
  let pendingLevelTier = 1;

  // Set once per level-complete beat by tick's countdown branch below, at
  // LEVEL_CURTAIN_CLOSE_DELAY_SEC in -- guards ui/hud.js's closeLevelCurtains
  // so it fires exactly once per beat instead of every frame past that point.
  let levelCurtainsClosed = false;

  // --- Intro tutorial (data/introTutorial.js, ui/hud.js) -------------------
  // All dt-driven from tick's 'intro' branch below, same reasoning as every
  // other timed effect in this file: pausing genuinely holds it.
  let introStep = 1; // 1 = lane steering, 2 = jump
  let introElapsed = 0; // time since the CURRENT step started -- drives auto-advance
  let introLaneIndex = 0; // index into INTRO_LANE_CYCLE
  let introLaneCycleElapsed = 0;
  let introRunFrameIndex = 0;
  let introRunFrameElapsed = 0;
  let introJumpCycleIndex = 0;
  let introJumpCycleElapsed = 0;

  const rollPlatformType = () => (
    PLATFORM_KILL_TYPE_ENABLED && Math.random() < PLATFORM_KILL_TYPE_CHANCE ? 'kill' : 'ramp'
  );

  // Pre-places entities already in flight at staggered distances, so the run
  // OPENS with a populated pipeline instead of waiting a full far-travel for
  // the first live spawn to arrive (data/introSequence.js's INTRO_SEED_* lists
  // carry the reasoning and the arrival times).
  //
  // seedZ inverts the SPEED RAMP, not a fixed speed: a seed meant to arrive at
  // t must be placed exactly as far out as the world will actually scroll in
  // those t seconds, which is systems/speed.js's distanceTraveledBy (the
  // integral of the ramp). Using a flat `t * speed` here would make every
  // authored arrival time land late, progressively worse for later entries.
  //
  // Order matters, and gives correct mutual avoidance for free: platforms
  // first, then obstacles/enemies (which refuse lanes blocked by a platform
  // footprint), then coins (which refuse lanes with a nearby obstacle).
  // Seeding in any other order would let a later seed land on top of an
  // earlier one.
  function seedPipeline(isFirstLevel) {
    // Placement is measured from THIS LEVEL's start, not the run's. Speed
    // carries across levels, so by level 2 the world is at or near SPEED_MAX
    // and covers far more ground per second than a standing start -- using the
    // run-start formula would place every seed far too close and they'd all
    // arrive early and bunched. See systems/speed.js's seedDistanceAt.
    //
    // Returns null past the spawn horizon rather than placing the entity
    // beyond SPAWN_Z, outside the live pipeline's own reach. That guard earns
    // its keep at level 2+: the faster world shrinks the seedable window from
    // ~13.1s to ~9.7s, so an entry that was fine at run start can fall off the
    // end here. Skipping is right -- a missing seed is a small gap, a
    // mis-placed one arrives from nowhere.
    const seedZ = (arrivalSec) => {
      const d = seedDistanceAt(levelStartTime, arrivalSec);
      return d > Math.abs(SPAWN_Z) ? null : -d;
    };

    // Level 1 gets the full teaching intro; later levels get the sparser set
    // (data/introSequence.js) -- the player already knows what an enemy is.
    const obstacles = isFirstLevel ? INTRO_SEED_OBSTACLE_ARRIVALS : LEVEL_RESTART_SEED_OBSTACLE_ARRIVALS;
    const enemies = isFirstLevel ? INTRO_SEED_ENEMY_ARRIVALS : LEVEL_RESTART_SEED_ENEMY_ARRIVALS;
    const platforms = isFirstLevel ? INTRO_SEED_PLATFORM_ARRIVALS : LEVEL_RESTART_SEED_PLATFORM_ARRIVALS;
    const coins = isFirstLevel ? INTRO_SEED_COIN_ARRIVALS : LEVEL_RESTART_SEED_COIN_ARRIVALS;

    if (PLATFORM_ENABLED) {
      // Explicit, distinct lanes: spawnPlatform otherwise picks at random with
      // no mutual-exclusion check, so two seeds could stack in one lane.
      platforms.forEach((t, i) => {
        const z = seedZ(t);
        if (z !== null) spawnPlatform(platformField, rollPlatformType(), (CENTER_LANE + i) % LANE_X.length, z);
      });
    }
    for (const t of obstacles) {
      const z = seedZ(t);
      // false: skip the cross-lane platform gap check for seeds -- see
      // entities/obstacles.js's spawnObstacle for why.
      if (z !== null) spawnObstacle(obstacleField, platformField, null, z, false);
    }
    for (const t of enemies) {
      const z = seedZ(t);
      if (z !== null) spawnEnemy(enemyField, platformField, null, null, z);
    }
    for (const t of coins) {
      const z = seedZ(t);
      if (z !== null) spawnCoinCluster(coinField, platformField, obstacleField, gameTime, z);
    }
  }

  // Rebuilds the WORLD for a level: entities, spawners, player, camera. Does
  // NOT touch anything the player has earned (points, tier, lives) or the run
  // clock -- so speed carries across a level transition exactly as asked.
  //
  // fullReset() below adds the session wipe on top for a brand-new run. Keeping
  // the two apart is the whole reason a level transition is cheap: this is the
  // only half a new level needs.
  function resetLevelWorld(isFirstLevel) {
    resetPlayer(player);
    resetObstaclePool(obstacleField);
    resetEnemyPool(enemyField);
    resetPlatformField(platformField);
    // A run start uses 0 (forced by the seeding horizon -- see spawnConfig.js);
    // a LEVEL start must not, or the immediate live platform lands on top of
    // the seeded one, which at level-2 speed is a ~19-unit interpenetration.
    resetSpawner(
      platformSpawnerState,
      isFirstLevel ? PLATFORM_FIRST_SPAWN_DELAY_SEC : LEVEL_RESTART_PLATFORM_FIRST_DELAY_SEC,
    );
    resetCoinPool(coinField);
    resetSpawner(coinSpawnerState, COIN_FIRST_SPAWN_DELAY_SEC);
    resetPickupPool(pickupField);
    resetSpawner(pickupSpawnerState, PICKUP_FIRST_SPAWN_DELAY_SEC);
    // Clears any death shake still decaying and snaps the camera back to
    // centre, so a quick retry doesn't inherit the previous run's jolt.
    resetCameraRig(cameraRig);
    setPlayerVisible(player, true);
    setContactShadowVisible(contactShadow, true);
    damageFlashTimer = 0;
    blockedNudgeCooldown = 0;
    damageFlashEl.style.opacity = '0';
    lastObstacleSpawnTime = -Infinity;
    lastEnemySpawnTime = -Infinity;

    // Stamped BEFORE seeding: seedPipeline measures every arrival from it.
    levelStartTime = gameTime;

    // The teaching wall is a run-start device only -- direct feedback: "we
    // don't need the seeded intro" on a level change. Later levels lean on the
    // sparser seed lists plus the grace ramp instead.
    if (INTRO_WALL_ENABLED && isFirstLevel) {
      // data/introSequence.js: one enemy in EVERY lane, close and arriving
      // fast -- an unmissable first teaching moment ("killing these is
      // safe/good") instead of several seconds of nothing happening.
      for (let lane = 0; lane < INTRO_WALL_ENEMY_COUNT; lane++) {
        spawnEnemy(enemyField, platformField, null, lane, INTRO_WALL_SPAWN_Z);
      }
      lastEnemySpawnTime = gameTime;
      resetSpawner(enemySpawnerState, INTRO_NORMAL_ENEMY_DELAY_SEC);
      resetSpawner(spawnerState, INTRO_OBSTACLE_DELAY_SEC);
    } else {
      resetSpawner(enemySpawnerState, ENEMY_FIRST_SPAWN_DELAY_SEC);
      resetSpawner(spawnerState, OBSTACLE_FIRST_SPAWN_DELAY_SEC);
    }

    if (INTRO_SEED_ENABLED) seedPipeline(isFirstLevel);
  }

  // A brand-new run: everything above, plus the session wipe.
  function fullReset() {
    gameTime = 0;
    distance = 0;
    attackSequenceIndex = 0;
    levelIndex = 1;
    pendingLevelTier = 1;
    levelCountdown = 0;
    levelCurtainsClosed = false;

    // A brand-new run always starts back at tier 1's environment, even if the
    // PREVIOUS run had progressed into sunnyStreet before dying -- theme
    // progress is session-scoped, same as points/tier/lives. Guarded the same
    // way startNextLevel is: only rebuild if the theme is actually different,
    // so a run that dies before ever reaching tier 2 doesn't pay a teardown/
    // rebuild cost for a theme it was already in.
    if (LEVEL_SWAPS_ENVIRONMENT) {
      const firstTheme = themeForTier(1);
      if (firstTheme && firstTheme !== currentThemeKey) {
        disposeStreet(scene, street);
        street = createStreet(scene, firstTheme);
        currentThemeKey = firstTheme;
      }
    }
    resetLivesState(livesState);
    resetScoreState(score);
    clearPointsFly();
    // Before updatePoints, so the bar snaps to empty without animating
    // backwards from wherever the previous run ended.
    hud.resetProgressUI();
    hud.updatePoints(score.displayed);
    hud.updateLives(livesState.lives);
    resetLevelWorld(true);
  }

  // --- Intro tutorial -------------------------------------------------------
  // Shown every run (direct feedback: "every time when I start a new game"),
  // not just the first one ever -- called from both boot() and restart()
  // below, always right after fullReset() has the world already built and
  // frozen. See core/gameState.js's 'intro' state for why this is safe
  // against GOBALANCE_SDK.md's "no key required" contract.
  function beginIntro() {
    triggerIntro(gs);
    introStep = 1;
    introElapsed = 0;
    introLaneIndex = 0;
    introLaneCycleElapsed = 0;
    introRunFrameIndex = 0;
    introRunFrameElapsed = 0;
    hud.showIntroTutorial();
  }

  function advanceIntroStep() {
    introStep = 2;
    introElapsed = 0;
    introJumpCycleIndex = 0;
    introJumpCycleElapsed = 0;
    hud.setIntroStep(2);
    hud.setIntroJumpCycleState(0, INTRO_JUMP_CYCLE[0]);
  }

  function dismissIntro() {
    hud.hideIntroTutorial();
    restartToRunning(gs);
  }

  document.getElementById('intro-next-button').addEventListener('click', () => {
    if (gs.current === 'intro' && introStep === 1) advanceIntroStep();
  });
  document.getElementById('intro-start-button').addEventListener('click', () => {
    if (gs.current === 'intro' && introStep === 2) dismissIntro();
  });

  // --- Level transition ---------------------------------------------------
  // Entered when a landing points label pushes the score past a tier
  // threshold. The world freezes (gs.current gates the whole of tick's update
  // block), the overlay announces what's next, and a countdown runs before the
  // next level is built.
  function beginLevelComplete(nextTier) {
    triggerLevelComplete(gs);
    // Credit anything still in the air. Without this the transition would
    // display a total lower than the one that triggered it, and those points
    // would then land during the NEXT level.
    settleScore(score);
    clearPointsFly();
    hud.updatePoints(score.displayed);
    pendingLevelTier = nextTier;
    levelCountdown = LEVEL_COUNTDOWN_SECONDS;
    levelCurtainsClosed = false;
    hud.setLevelCountdown(LEVEL_COUNTDOWN_SECONDS);
    hud.showLevelComplete(nextTier);
  }

  // THE ENVIRONMENT SWAP. Rebuilds the street under a new theme when the tier
  // just reached calls for one -- this is the one moment the screen is fully
  // covered (ui/hud.js's curtain panels, closed since
  // LEVEL_CURTAIN_CLOSE_DELAY_SEC into the countdown), so the teardown/
  // rebuild cost (disposeStreet + createStreet, ~50 meshes on sunnyStreet) is
  // invisible instead of a mid-run stutter.
  //
  // Guarded on the theme key actually CHANGING, not just on
  // LEVEL_SWAPS_ENVIRONMENT being on. themeForTier now WRAPS past the last
  // entry in data/progression.js's TIER_THEMES rather than returning null
  // (direct feedback: rotate back to the first theme once the last one's
  // been presented) -- so this guard's job today is purely "don't tear down
  // and rebuild an identical street for no reason", not the null-dodge it
  // originally existed for.
  function startNextLevel() {
    hud.hideLevelComplete();
    levelIndex = pendingLevelTier;

    if (LEVEL_SWAPS_ENVIRONMENT) {
      const nextTheme = themeForTier(levelIndex);
      if (nextTheme && nextTheme !== currentThemeKey) {
        disposeStreet(scene, street);
        street = createStreet(scene, nextTheme);
        currentThemeKey = nextTheme;
      }
    }

    resetLevelWorld(false);
    restartToRunning(gs);
    // The swap above is done and the new level is about to run -- slide the
    // curtains back open to reveal it, rather than popping straight to it.
    hud.openLevelCurtains();
  }

  function endRun() {
    triggerGameOver(gs);
    // The blink lives inside tick()'s running guard, so once the state flips
    // it stops being recomputed -- without this the sprite (and its shadow)
    // can freeze mid-blink and sit INVISIBLE on the game-over screen.
    setPlayerVisible(player, true);
    setContactShadowVisible(contactShadow, true);
    // Anything still mid-flight is credited immediately -- a label that never
    // landed must not cost the player points on the recap.
    settleScore(score);
    clearPointsFly();
    hud.updatePoints(score.displayed);
    hud.showGameOver(score, distance);
  }

  // One life lost, with the feedback that sells it: a camera jolt, a red
  // screen flash, and the blink driven by the invulnerability window in
  // tick() below. Returns whether the hit was fatal, so a caller can skip
  // its own follow-up work when the run just ended.
  //
  // tryHit is the gate for whether damage lands at all -- but every caller
  // here already checks isInvulnerable before looping, so a `false` return
  // means something got past that check and is worth not double-reporting.
  function takeDamage() {
    const result = tryHit(livesState, gameTime);
    if (!result.hit) return false;

    hud.updateLives(livesState.lives);
    triggerCameraShake(cameraRig, DAMAGE_SHAKE_INTENSITY);
    damageFlashTimer = DAMAGE_FLASH_DURATION_SEC;

    if (result.dead) {
      endRun();
      return true;
    }
    return false;
  }

  function restart() {
    hud.hideGameOver();
    fullReset();
    beginIntro();
  }

  document.getElementById('restart-button').addEventListener('click', restart);
  window.addEventListener('keydown', (e) => {
    if (gs.current === 'gameover' && (e.code === 'Space' || e.code === 'Enter')) restart();
    else if (gs.current === 'intro' && (e.code === 'Space' || e.code === 'Enter')) {
      if (introStep === 1) advanceIntroStep();
      else dismissIntro();
    }
  });

  // TEMPORARY debug view (direct feedback: "lose all the graphics except
  // for the player and the enemies... so I can see what's going on with
  // the basic shapes") -- press G to toggle wireframe on every mesh
  // material in the scene. Player/obstacles/enemies are THREE.Sprite, not
  // Mesh, so `wireframe` doesn't apply to them at all -- they stay fully
  // rendered while the street/buildings/platform placeholder geometry
  // strips down to bare outlines, exactly separating "environment art" from
  // "gameplay entities" for free.
  let debugWireframe = false;
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyG') return;
    debugWireframe = !debugWireframe;
    scene.traverse((obj) => {
      if (obj.material && 'wireframe' in obj.material) obj.material.wireframe = debugWireframe;
    });
  });

  let paused = false;
  const pauseButton = document.getElementById('pause-button');
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    pauseButton.innerHTML = paused ? '&#9654;' : '&#9208;';
    hud.setPausedBadge(paused);
  });

  // Board steering panel (ui/steeringPanel.js): steering mode + every tilt
  // threshold, tunable live. Also re-sends the stored host sensitivity at boot
  // -- that threshold is a scene field which resets on every scene load, so a
  // saved preference that isn't re-sent does nothing. No-op in a browser.
  initSteeringPanel();

  // Flying "+N" labels (ui/pointsFly.js). The counter element is the flight
  // TARGET, so it must already exist and be laid out -- hence init here, after
  // fitStageToAspect has sized #stage, not at module scope.
  initPointsFly(
    stage, document.getElementById('hud'), document.getElementById('points-value'),
    // A label landing is the ONLY thing that moves the visible number, and it
    // punches the counter as it lands. See systems/scoring.js.
    //
    // Tier-up is detected HERE, off the displayed total, not off the awarded
    // one -- so the celebration fires at the moment the bar actually fills
    // rather than a second earlier when the points were technically earned.
    (points) => {
      const before = progressAt(score.displayed).tier;
      creditDisplayed(score, points);
      hud.updatePoints(score.displayed, true);
      const after = progressAt(score.displayed).tier;
      // Compares tier NUMBERS rather than testing one boundary: a single award
      // can cross more than one threshold, and the level should end on the tier
      // actually reached. Guarded on state so a label landing during an
      // already-running transition can't re-enter it.
      if (after > before && gs.current === 'running') beginLevelComplete(after);
    },
  );

  // Heart tray built once from the CURRENT cap -- not from
  // LIVES_MAX_SUPPORTED, which is only a documented ceiling; a tray sized to
  // that would render pre-greyed hearts (see ui/hud.js's initLivesTray).
  hud.initLivesTray(LIVES_START);

  // Debug: grant the magnet ability (entities/player.js). SCAFFOLDING -- there
  // is no magnet pickup entity yet, so this is currently the only way to see
  // the coin-pull at all. Remove once a real pickup grants it.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') grantMagnet(player);
  });

  function fitStageToAspect() {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    let width = winW;
    let height = (width * ASPECT_H) / ASPECT_W;
    if (height > winH) {
      height = winH;
      width = (height * ASPECT_W) / ASPECT_H;
    }
    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
    renderer.setSize(width, height);
    camera.aspect = ASPECT_W / ASPECT_H;
    camera.updateProjectionMatrix();
    // The points counter just moved with the stage -- labels in flight aim at a
    // cached pixel position, so it has to be re-measured or they land wide.
    refreshPointsFlyTarget();
  }
  window.addEventListener('resize', fitStageToAspect);
  fitStageToAspect();

  let lastDebugFrame = -1;
  let lastContactFrame = player.frameIndex;

  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 1 / 30);

    // Intro tutorial. Runs on dt like every other timed effect here, so
    // pausing genuinely holds it rather than letting it expire behind the
    // pause screen.
    if (!paused && gs.current === 'intro') {
      introElapsed += dt;
      if (introStep === 1) {
        introLaneCycleElapsed += dt;
        if (introLaneCycleElapsed >= INTRO_LANE_STATE_HOLD_SEC) {
          introLaneCycleElapsed -= INTRO_LANE_STATE_HOLD_SEC;
          introLaneIndex = (introLaneIndex + 1) % INTRO_LANE_CYCLE.length;
          hud.setIntroLaneState(INTRO_LANE_CYCLE[introLaneIndex]);
        }
        // Independent cycle from the lane state above -- the run-cycle leg
        // animation plays at its own normal in-game cadence (RUN_FRAME_
        // DURATION) throughout, regardless of which lane is currently shown.
        introRunFrameElapsed += dt;
        if (introRunFrameElapsed >= RUN_FRAME_DURATION) {
          introRunFrameElapsed -= RUN_FRAME_DURATION;
          introRunFrameIndex = (introRunFrameIndex + 1) % PLAYER_RUN_FRAMES.length;
          hud.setIntroRunFrame(introRunFrameIndex);
        }
        if (introElapsed >= INTRO_STEP_AUTO_ADVANCE_SEC) advanceIntroStep();
      } else {
        introJumpCycleElapsed += dt;
        const currentHold = INTRO_JUMP_CYCLE[introJumpCycleIndex].holdSec;
        if (introJumpCycleElapsed >= currentHold) {
          introJumpCycleElapsed -= currentHold;
          introJumpCycleIndex = (introJumpCycleIndex + 1) % INTRO_JUMP_CYCLE.length;
          hud.setIntroJumpCycleState(introJumpCycleIndex, INTRO_JUMP_CYCLE[introJumpCycleIndex]);
        }
        if (introElapsed >= INTRO_STEP_AUTO_ADVANCE_SEC) dismissIntro();
      }
    }

    // Level-complete countdown. Runs on dt like every other timed effect here,
    // so pausing genuinely holds it rather than letting it expire behind the
    // pause screen.
    if (!paused && gs.current === 'levelcomplete') {
      levelCountdown -= dt;
      // ceil, floored at 1: the display should read "1" for the whole final
      // second rather than flashing a 0 nobody is meant to see.
      hud.setLevelCountdown(Math.max(1, Math.ceil(levelCountdown)));
      // Fires once, LEVEL_CURTAIN_CLOSE_DELAY_SEC into the countdown -- the
      // flag guard is required because this branch runs every frame past
      // that point, and closeLevelCurtains() re-adding an already-present
      // class would be harmless but pointless.
      if (!levelCurtainsClosed
        && LEVEL_COUNTDOWN_SECONDS - levelCountdown >= LEVEL_CURTAIN_CLOSE_DELAY_SEC) {
        hud.closeLevelCurtains();
        levelCurtainsClosed = true;
      }
      if (levelCountdown <= 0) startNextLevel();
    }

    if (!paused && gs.current === 'running') {
      gameTime += dt;
      // ONE speed for the whole world this frame (systems/speed.js). Every
      // pool below gets this exact value -- the spacing guarantees in
      // entities/platform.js and data/spawnConfig.js only hold because no
      // pool ever scrolls at its own rate.
      currentSpeed = speedAt(gameTime);
      if (blockedNudgeCooldown > 0) blockedNudgeCooldown = Math.max(0, blockedNudgeCooldown - dt);
      updateSteering();

      // ABSOLUTE steering (input/input.js): the board reports a TARGET lane
      // rather than a step, so close the gap one lane at a time. Stepping
      // instead of jumping straight to the target is what keeps the
      // platform-block check meaningful on every lane crossed -- a two-lane
      // sweep with something parked in the middle lane correctly stops at the
      // obstruction rather than teleporting past it. One step per frame is
      // effectively instant to the eye anyway; the lane easing renders it as a
      // single smooth sweep.
      const laneTarget = getLaneTarget();
      const step = laneTarget === null
        ? pollLaneStep()
        : Math.sign(laneTarget - player.targetLane);

      if (step !== 0) {
        const desiredLane = player.targetLane + step;
        // Off the edge of the road entirely -- no lane to move into. Do
        // NOTHING, deliberately: direct feedback singled this case out as the
        // one that should stay silent. The player can see he's in the
        // outermost lane, so a refusal there needs no explanation, whereas a
        // refusal caused by a platform is genuinely ambiguous.
        if (desiredLane >= 0 && desiredLane <= LANE_X.length - 1) {
          // Direct feedback: switching into a lane with an active platform
          // taller than his current elevation used to just teleport him on
          // top of it -- an unearned climb, not a step/hop. Refused outright
          // here rather than ending the run, since "blocked, not allowed to
          // go" (his own words) is a softer, less punishing read than a hit;
          // walking across two adjacent same-height decks stays allowed (the
          // height gap there is ~0, under isPlatformLaneBlocked's threshold),
          // and stepping into a LOWER/empty lane is still free -- that's the
          // legitimate "fall off the edge" case, handled by updatePlayer's
          // gravity once he's there.
          if (isPlatformLaneBlocked(platformField, desiredLane, player.sprite.position.z, player.elevationY)) {
            // Refused by a platform/ramp -- lurch that way and spring back, so
            // the input visibly registered rather than looking dropped.
            //
            // Rate-limited because absolute mode re-attempts the SAME move
            // every frame for as long as the lean is held (which is the right
            // behaviour -- it means you slot in automatically the moment the
            // platform passes). Without this the lurch would re-trigger
            // continuously and read as a vibration rather than a bump.
            if (blockedNudgeCooldown <= 0) {
              triggerBlockedNudge(player, step);
              blockedNudgeCooldown = BLOCKED_NUDGE_REPEAT_SEC;
            }
          } else {
            setPlayerLane(player, desiredLane);
          }
        }
      }
      if (pollJumpPress()) {
        // Plain physical hop, nothing platform-specific about the press
        // itself -- direct feedback: no separate trigger mechanic. Whether
        // it clears a kill barrier is purely a function of being airborne
        // (jumpElapsed !== null) at the moment of contact, read directly by
        // entities/player.js's updatePlayer and checkPlatformKillBarrierHit
        // below.
        startPlayerJump(player);
      }
      updatePlayer(player, dt, platformField);
      // updateRibbon(ribbon, dt, getPlayerHeadAnchor(player)); -- disabled, see above
      updateStreet(street, dt, currentSpeed);

      // Foot-contact VFX: fires once per transition INTO a contact pose
      // (frame 1 or 3, see data/playerSprite.js), grounded only -- a jump's
      // contact-frame swaps shouldn't kick up dust mid-air.
      const enteredContact = player.frameIndex !== lastContactFrame
        && (player.frameIndex === 1 || player.frameIndex === 3)
        && player.jumpElapsed === null;
      lastContactFrame = player.frameIndex;
      if (enteredContact) {
        pulseContactShadow(contactShadow);
        // + player.elevationY: same reasoning as entities/contactShadow.js's
        // own elevation follow -- otherwise dust puffs on a platform deck
        // spawned down at street level instead of at his actual feet.
        spawnDustPuff(
          dustPool, player.sprite.position.x, 0.05 + player.elevationY, player.sprite.position.z - DUST_AHEAD_OFFSET,
        );
      }
      // Post-hit blink -- fast enough to read as "intangible right now", and
      // recomputed from scratch every frame (with an explicit visible-true
      // branch) so it can never latch the sprite hidden. The contact shadow
      // blinks with him; a shadow left on the street under a blinked-out
      // character reads as a bug.
      const blinkedOut = isInvulnerable(livesState, gameTime)
        && Math.floor(gameTime * 14) % 2 !== 0;
      setPlayerVisible(player, !blinkedOut);
      setContactShadowVisible(contactShadow, !blinkedOut);

      // Red damage flash, decayed on the run clock so it freezes under pause
      // like every other timed effect here.
      if (damageFlashTimer > 0) {
        damageFlashTimer = Math.max(0, damageFlashTimer - dt);
        const t = damageFlashTimer / DAMAGE_FLASH_DURATION_SEC;
        damageFlashEl.style.opacity = `${t * DAMAGE_FLASH_PEAK_OPACITY}`;
      }

      updateContactShadow(contactShadow, player, dt);
      dustPool.update(dt);
      dustPool.scrollZ(currentSpeed * dt, DUST_FAN_RATE);
      updateSpeedStreaks(speedStreaks, dt, currentSpeed);

      // Frame-count HUD readout disabled -- re-enable (uncomment) if a
      // specific frame needs calling out again during playtest feedback.
      // if (player.frameIndex !== lastDebugFrame) {
      //   lastDebugFrame = player.frameIndex;
      //   const { yOffset, xOffset } = PLAYER_RUN_FRAMES[player.frameIndex];
      //   hud.updateFrameDebug(
      //     `frame ${player.frameIndex}: ${FRAME_LABELS[player.frameIndex]} `
      //     + `(yOffset ${yOffset}, xOffset ${xOffset})`,
      //   );
      // }

      // Assignment, not accumulation: systems/speed.js's closed form is the
      // single source of truth for "how far have we come", shared with the
      // spawn-seeding and coin-arc math. An Euler sum here would slowly
      // disagree with them for no benefit.
      // Still tracked (the game-over recap shows it) but no longer on the HUD
      // -- direct feedback: "we can hide the distance meter."
      distance = distanceTraveledBy(gameTime);

      // MIN_ENEMY_OBSTACLE_GAP_SEC (constants.js): skip a spawn attempt that
      // would land too close to the OTHER type's last spawn -- both spawn
      // at the same fixed SPAWN_Z and scroll at the same speed, so this gap
      // (enforced once, here, at spawn time) holds for the entity's entire
      // lifetime. The spawner's own interval timer still resets normally
      // either way, it just tries again next interval.
      //
      // The interval is stretched for the opening stretch of a run
      // (systems/difficulty.js) -- direct feedback's "value to control how easy
      // it is on the start", and deliberately about PLACEMENT, not speed. Two
      // things worth knowing about this line:
      //
      //   1. It's keyed on when this obstacle will ARRIVE, not on gameTime.
      //      Everything spawns ~13s of travel upstream, so an ease-in keyed on
      //      spawn time would be fully spent before the player saw any of it.
      //   2. updateSpawner only reads `interval` on the frame it actually
      //      fires, so recomputing it every frame is free -- each gap is set by
      //      the difficulty at the moment that gap begins.
      // Level-relative, not run-relative: a fresh level re-arms the grace ramp
      // (over the shorter LEVEL_RESTART window, since the player is already
      // warmed up) instead of opening at whatever pace the run had climbed to.
      const easeDuration = levelIndex === 1
        ? EASE_IN_DURATION_SEC
        : LEVEL_RESTART_EASE_IN_DURATION_SEC;
      const obstacleInterval = OBSTACLE_SPAWN_INTERVAL_SEC
        * hazardSpacingMultiplierAt(spawnArrivalTime(gameTime) - levelStartTime, easeDuration);
      updateSpawner(spawnerState, dt, () => {
        if (gameTime - lastEnemySpawnTime >= MIN_ENEMY_OBSTACLE_GAP_SEC) {
          // data/introSequence.js: spawn close instead of at the far
          // SPAWN_Z while the pipeline is still filling, so the run-start
          // stretch doesn't sit empty for one full ~9s far-travel time.
          spawnObstacle(obstacleField, platformField);
          lastObstacleSpawnTime = gameTime;
        }
      }, obstacleInterval);
      updateObstaclePool(obstacleField, dt, currentSpeed);

      // An obstacle costs ONE life rather than ending the run. The whole loop
      // is gated on the invulnerability window (rather than testing it per
      // hit, matching CarRacer's rig) because a barricade's collision window
      // spans many frames -- without this a single obstacle would drain every
      // life in one pass. See systems/lives.js.
      if (!isInvulnerable(livesState, gameTime)) {
        for (const slot of obstacleField.pool) {
          if (checkObstacleHit(player, slot)) {
            takeDamage();
            break;
          }
        }
      }

      // Kill-barrier platform, missed -- same consequence as an obstacle hit.
      // Returns the slot (not a bool) so a SURVIVED hit can mark it cleared:
      // otherwise the player stays at street level while the platform's opaque
      // deck box scrolls over him, hiding him inside it for seconds. See
      // entities/platform.js's checkPlatformKillBarrierHit.
      if (!isInvulnerable(livesState, gameTime)) {
        const barrierSlot = checkPlatformKillBarrierHit(
          player, platformField, player.jumpElapsed === null,
        );
        if (barrierSlot) {
          const fatal = takeDamage();
          if (!fatal) markPlatformCleared(barrierSlot);
        }
      }

      // Foot Soldier: opposite of an obstacle hit -- contact KILLS the
      // enemy (dissolve poof + score + the player's auto spin-attack)
      // instead of ending the run.
      updateSpawner(enemySpawnerState, dt, () => {
        if (gameTime - lastObstacleSpawnTime >= MIN_ENEMY_OBSTACLE_GAP_SEC) {
          spawnEnemy(enemyField, platformField);
          lastEnemySpawnTime = gameTime;
        }
      }, ENEMY_SPAWN_INTERVAL_SEC);
      updateEnemyPool(enemyField, dt, currentSpeed, platformField);
      const hitEnemy = checkEnemyHit(player, enemyField);
      if (hitEnemy) {
        spawnEnemyPoof(
          enemyPoofPool,
          hitEnemy.sprite.position.x, hitEnemy.sprite.position.y, hitEnemy.sprite.position.z,
          hitEnemy.sprite.scale.x, hitEnemy.sprite.scale.y, hitEnemy.type.poofColors,
        );
        // Read the position BEFORE killEnemy hides the sprite -- the label
        // has to launch from where the kill visibly happened.
        const killX = hitEnemy.sprite.position.x;
        const killY = hitEnemy.sprite.position.y;
        const killZ = hitEnemy.sprite.position.z;
        killEnemy(hitEnemy);
        startPlayerAttack(player, attackSequenceIndex);
        attackSequenceIndex += 1;
        spawnPointsFly(killX, killY, killZ, camera, awardEnemyKill(score), 'enemy');
      }
      enemyPoofPool.update(dt);

      if (PLATFORM_ENABLED) {
        updateSpawner(platformSpawnerState, dt, () => {
          spawnPlatform(platformField, rollPlatformType());
        }, PLATFORM_SPAWN_INTERVAL_SEC);
      }
      updatePlatformField(platformField, dt, currentSpeed);

      // Coins: purely positive, so nothing here can end the run. Placed
      // AFTER the platform section on purpose -- a coin cluster's placement
      // queries live platform geometry (ramp spans to climb, footprints the
      // jump-arc pattern must avoid), so platforms should already have
      // scrolled this frame before that's asked.
      //
      // No data/introSequence.js ramp-up close-spawn treatment, unlike every
      // spawner above: that closes an empty-pipeline FAIRNESS gap, and
      // missing a coin costs the player nothing. See data/spawnConfig.js.
      updateSpawner(coinSpawnerState, dt, () => {
        spawnCoinCluster(coinField, platformField, obstacleField, gameTime);
      }, COIN_CLUSTER_SPAWN_INTERVAL_SEC);
      // Must run BEFORE collectCoins -- it's what resolves each coin's live
      // surface height for this frame (same ordering reason updateEnemyPool
      // precedes checkEnemyHit above).
      updateCoinPool(coinField, dt, currentSpeed, platformField);
      // Magnet: its own pass, strictly AFTER updateCoinPool (so its x/y writes
      // aren't overwritten by the pool's surface-follow) and BEFORE
      // collectCoins (so the pull strength collection reads is current this
      // frame). Called unconditionally -- when the buff is down it eases each
      // coin's pull back to zero and returns it to its own lane.
      applyMagnetPull(coinField, player, dt, isMagnetActive(player));
      const collected = collectCoins(player, coinField, platformField);
      for (const slot of collected) {
        spawnCoinSparkle(
          coinSparklePool,
          slot.sprite.position.x, slot.sprite.position.y, slot.sprite.position.z,
          slot.type.sparkleColor,
        );
        spawnPointsFly(
          slot.sprite.position.x, slot.sprite.position.y, slot.sprite.position.z,
          camera, awardCoin(score, slot.type),
          slot.type === COIN_TYPES.bonus ? 'bonus' : 'coin',
        );
        despawnCoin(slot);
      }
      coinSparklePool.update(dt);

      // Ability pickups (entities/pickups.js). ONE attempt per interval that
      // then rolls for what it produces, rather than two competing spawners --
      // that's what stops a magnet and a heart ever landing on top of each
      // other, and keeps the rarity readable straight off the two chances in
      // data/spawnConfig.js.
      //
      // The life roll goes FIRST (it's the rare prize; it shouldn't lose its
      // slot to the common one) and is gated on the player ACTUALLY MISSING a
      // life. That gate is the real rarity control: at full health a heart
      // would be a no-op pickup, and a pickup that does nothing when collected
      // teaches the player to ignore the next one.
      //
      // Placed after the coin section for the same reason coins come after
      // platforms: placement queries live platform + obstacle geometry, so
      // both should already have scrolled this frame before it's asked.
      updateSpawner(pickupSpawnerState, dt, () => {
        const wantsLife = livesState.lives < LIVES_SOFTCAP;
        if (wantsLife && Math.random() < PICKUP_LIFE_SPAWN_CHANCE) {
          spawnPickup(pickupField, platformField, obstacleField, 'life');
        } else if (Math.random() < PICKUP_MAGNET_SPAWN_CHANCE) {
          spawnPickup(pickupField, platformField, obstacleField, 'magnet');
        }
        // Otherwise nothing this interval -- that's the point.
      }, PICKUP_SPAWN_INTERVAL_SEC);
      updatePickupPool(pickupField, dt, currentSpeed, platformField);
      for (const slot of collectPickups(player, pickupField, platformField)) {
        // Reuses the coin sparkle, tinted to the pickup's own halo colour --
        // same burst, so a pickup reads as "a collect, but bigger" rather than
        // as an unrelated effect.
        spawnCoinSparkle(
          coinSparklePool,
          slot.sprite.position.x, slot.sprite.position.y, slot.sprite.position.z,
          slot.type.sparkleColor,
        );
        if (slot.type.effect === 'magnet') {
          grantMagnet(player);
        } else if (slot.type.effect === 'life') {
          // gainLife is clamped to LIVES_SOFTCAP and reports whether it did
          // anything -- so a heart collected at full health (only reachable if
          // damage was healed between spawn and pickup) silently does nothing
          // rather than showing a phantom HUD change.
          if (gainLife(livesState)) hud.updateLives(livesState.lives);
        }
        despawnPickup(slot);
      }
    }

    // Follow the eased lane-center position, not the per-frame xOffset snap
    // -- otherwise the small foot-plant jitter reads as camera pan/tilt.
    // elevationY rides up with the player on an elevated platform stretch
    // (entities/platform.js) so the camera keeps the same relative framing.
    // dt only drives the shake. Passing 0 while paused freezes the decay AND
    // skips applying jitter, so a paused screen sits still instead of
    // vibrating forever. Deliberately NOT gated on gs.current: the death shake
    // should play out across the game-over screen.
    // Outside the running guard so labels keep animating regardless of game
    // state, and frozen by pause like every other timed effect here. endRun
    // settles and clears them explicitly, so nothing is left hanging over the
    // game-over screen (which would sit behind it anyway -- overlay z-index 20
    // vs label 15).
    if (!paused) updatePointsFly(dt);

    updateCameraRig(cameraRig, player.laneX, player.elevationY, paused ? 0 : dt);

    renderer.render(scene, camera);
  }

  fullReset();
  beginIntro();
  tick();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
