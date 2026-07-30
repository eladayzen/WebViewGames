// Renderer/scene/camera bootstrap + top-level game loop + state machine
// (build doc §9.2, §9.3, §10 POC milestones). POC scope only: no CHASE
// meter, no scoring, no blocks, no pizza/coin/smoke-bomb, no Foot-bot in
// view -- a hit ends the run immediately (§2).

import * as THREE from 'three';
import '../style.css';

import { createStreet, updateStreet } from '../street/street.js';
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
import { createSpawnerState, resetSpawner, updateSpawner } from '../systems/spawner.js';
import { speedAt, distanceTraveledBy } from '../systems/speed.js';
import {
  createLivesState, resetLivesState, tryHit, isInvulnerable,
} from '../systems/lives.js';
import { createGameState, restartToRunning, triggerGameOver } from './gameState.js';
import { pollLaneStep, pollJumpPress } from '../input/input.js';
import * as hud from '../ui/hud.js';
import { initSensitivityControl } from '../ui/sensitivity.js';
import {
  LANE_X, CENTER_LANE, ASPECT_W, ASPECT_H, CAMERA_FOV, LIVES_START,
} from '../data/constants.js';
import {
  INTRO_WALL_ENABLED, INTRO_WALL_ENEMY_COUNT, INTRO_WALL_SPAWN_Z,
  INTRO_NORMAL_ENEMY_DELAY_SEC, INTRO_OBSTACLE_DELAY_SEC,
  INTRO_SEED_ENABLED, INTRO_SEED_OBSTACLE_ARRIVALS, INTRO_SEED_ENEMY_ARRIVALS,
  INTRO_SEED_PLATFORM_ARRIVALS, INTRO_SEED_COIN_ARRIVALS,
} from '../data/introSequence.js';
import { PLATFORM_ENABLED } from '../data/platformSequence.js';
import {
  OBSTACLE_FIRST_SPAWN_DELAY_SEC, ENEMY_FIRST_SPAWN_DELAY_SEC, ENEMY_SPAWN_INTERVAL_SEC,
  MIN_ENEMY_OBSTACLE_GAP_SEC, PLATFORM_FIRST_SPAWN_DELAY_SEC, PLATFORM_SPAWN_INTERVAL_SEC,
  PLATFORM_KILL_TYPE_ENABLED, PLATFORM_KILL_TYPE_CHANCE,
  COIN_FIRST_SPAWN_DELAY_SEC, COIN_CLUSTER_SPAWN_INTERVAL_SEC,
} from '../data/spawnConfig.js';
import { FRAME_LABELS, PLAYER_RUN_FRAMES } from '../data/playerSprite.js';
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
  const street = createStreet(scene);

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
  const ENEMY_KILL_SCORE = 100; // placeholder value -- no real scoring system yet (build doc §8 is MVP-only)

  let distance = 0;
  // Rotates through data/playerSprite.js's ATTACK_SEQUENCES kill to kill
  // (not random) so back-to-back kills don't just repeat the same one.
  let attackSequenceIndex = 0;
  let score = 0;
  // Deliberately NOT folded into `score` (which is enemy kills) -- coins are
  // their own resource with their own HUD counter, see index.html's #coins.
  let coinsCollected = 0;
  // Seconds of red damage-flash left (see index.html's #damage-flash for why
  // this is a timer rather than a one-frame toggle).
  let damageFlashTimer = 0;
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
  function seedPipeline() {
    const seedZ = (arrivalSec) => -distanceTraveledBy(arrivalSec);
    if (PLATFORM_ENABLED) {
      // Explicit, distinct lanes: spawnPlatform otherwise picks at random with
      // no mutual-exclusion check, so two seeds could stack in one lane.
      INTRO_SEED_PLATFORM_ARRIVALS.forEach((t, i) => {
        spawnPlatform(platformField, rollPlatformType(), (CENTER_LANE + i) % LANE_X.length, seedZ(t));
      });
    }
    for (const t of INTRO_SEED_OBSTACLE_ARRIVALS) {
      spawnObstacle(obstacleField, platformField, null, seedZ(t));
    }
    for (const t of INTRO_SEED_ENEMY_ARRIVALS) {
      spawnEnemy(enemyField, platformField, null, null, seedZ(t));
    }
    for (const t of INTRO_SEED_COIN_ARRIVALS) {
      spawnCoinCluster(coinField, platformField, obstacleField, 0, seedZ(t));
    }
  }

  function fullReset() {
    resetPlayer(player);
    // resetRibbon(ribbon); -- ribbon object disabled, see creation above
    resetObstaclePool(obstacleField);
    resetEnemyPool(enemyField);
    resetPlatformField(platformField);
    resetSpawner(platformSpawnerState, PLATFORM_FIRST_SPAWN_DELAY_SEC);
    resetCoinPool(coinField);
    resetSpawner(coinSpawnerState, COIN_FIRST_SPAWN_DELAY_SEC);
    resetLivesState(livesState);
    // Clears any death shake still decaying and snaps the camera back to
    // centre, so a quick retry doesn't inherit the previous run's jolt.
    resetCameraRig(cameraRig);
    setPlayerVisible(player, true);
    setContactShadowVisible(contactShadow, true);
    damageFlashTimer = 0;
    damageFlashEl.style.opacity = '0';
    gameTime = 0;
    lastObstacleSpawnTime = -Infinity;
    lastEnemySpawnTime = -Infinity;

    if (INTRO_WALL_ENABLED) {
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

    // After the wall (so the wall's enemies are already placed and the
    // seeded ones stagger in behind them, preserving the teaching order).
    if (INTRO_SEED_ENABLED) seedPipeline();

    distance = 0;
    score = 0;
    coinsCollected = 0;
    attackSequenceIndex = 0;
    hud.updateDistance(distance);
    hud.updateScore(score);
    hud.updateCoins(coinsCollected);
    hud.updateLives(livesState.lives);
  }

  function endRun() {
    triggerGameOver(gs);
    // The blink lives inside tick()'s running guard, so once the state flips
    // it stops being recomputed -- without this the sprite (and its shadow)
    // can freeze mid-blink and sit INVISIBLE on the game-over screen.
    setPlayerVisible(player, true);
    setContactShadowVisible(contactShadow, true);
    hud.showGameOver(distance, coinsCollected);
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
    restartToRunning(gs);
  }

  document.getElementById('restart-button').addEventListener('click', restart);
  window.addEventListener('keydown', (e) => {
    if (gs.current === 'gameover' && (e.code === 'Space' || e.code === 'Enter')) restart();
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

  // GoBalance board sensitivity (ui/sensitivity.js). Also re-sends the stored
  // value to the Unity host right here at boot -- the host's threshold is a
  // scene field that resets on every scene load, so a saved preference that
  // isn't re-sent does nothing. No-op in a normal browser.
  initSensitivityControl();

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
  }
  window.addEventListener('resize', fitStageToAspect);
  fitStageToAspect();

  let lastDebugFrame = -1;
  let lastContactFrame = player.frameIndex;

  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 1 / 30);

    if (!paused && gs.current === 'running') {
      gameTime += dt;
      // ONE speed for the whole world this frame (systems/speed.js). Every
      // pool below gets this exact value -- the spacing guarantees in
      // entities/platform.js and data/spawnConfig.js only hold because no
      // pool ever scrolls at its own rate.
      currentSpeed = speedAt(gameTime);
      const step = pollLaneStep();
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
            // the press visibly registered rather than looking dropped.
            triggerBlockedNudge(player, step);
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
      distance = distanceTraveledBy(gameTime);
      hud.updateDistance(distance);

      // MIN_ENEMY_OBSTACLE_GAP_SEC (constants.js): skip a spawn attempt that
      // would land too close to the OTHER type's last spawn -- both spawn
      // at the same fixed SPAWN_Z and scroll at the same speed, so this gap
      // (enforced once, here, at spawn time) holds for the entity's entire
      // lifetime. The spawner's own interval timer still resets normally
      // either way, it just tries again next interval.
      updateSpawner(spawnerState, dt, () => {
        if (gameTime - lastEnemySpawnTime >= MIN_ENEMY_OBSTACLE_GAP_SEC) {
          // data/introSequence.js: spawn close instead of at the far
          // SPAWN_Z while the pipeline is still filling, so the run-start
          // stretch doesn't sit empty for one full ~9s far-travel time.
          spawnObstacle(obstacleField, platformField);
          lastObstacleSpawnTime = gameTime;
        }
      });
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
        killEnemy(hitEnemy);
        startPlayerAttack(player, attackSequenceIndex);
        attackSequenceIndex += 1;
        score += ENEMY_KILL_SCORE;
        hud.updateScore(score);
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
          slot.type.color,
        );
        coinsCollected += slot.type.value;
        despawnCoin(slot);
      }
      // One HUD write per frame regardless of how many coins landed at once.
      if (collected.length > 0) hud.updateCoins(coinsCollected);
      coinSparklePool.update(dt);
    }

    // Follow the eased lane-center position, not the per-frame xOffset snap
    // -- otherwise the small foot-plant jitter reads as camera pan/tilt.
    // elevationY rides up with the player on an elevated platform stretch
    // (entities/platform.js) so the camera keeps the same relative framing.
    // dt only drives the shake. Passing 0 while paused freezes the decay AND
    // skips applying jitter, so a paused screen sits still instead of
    // vibrating forever. Deliberately NOT gated on gs.current: the death shake
    // should play out across the game-over screen.
    updateCameraRig(cameraRig, player.laneX, player.elevationY, paused ? 0 : dt);

    renderer.render(scene, camera);
  }

  fullReset();
  tick();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
