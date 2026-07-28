// Renderer/scene/camera bootstrap + top-level game loop + state machine
// (build doc §9.2, §9.3, §10 POC milestones). POC scope only: no CHASE
// meter, no scoring, no blocks, no pizza/coin/smoke-bomb, no Foot-bot in
// view -- a hit ends the run immediately (§2).

import * as THREE from 'three';
import '../style.css';

import { createStreet, updateStreet } from '../street/street.js';
import { createCameraRig, updateCameraRig } from '../street/camera-rig.js';
import {
  createPlayer, resetPlayer, setPlayerLane, startPlayerJump, startPlayerAttack, updatePlayer,
  getPlayerHeadAnchor,
} from '../entities/player.js';
import { createRibbon, resetRibbon, updateRibbon } from '../entities/ribbon.js';
import {
  createObstaclePool, resetObstaclePool, spawnObstacle, updateObstaclePool,
} from '../entities/obstacles.js';
import { checkObstacleHit } from '../entities/collision.js';
import { createContactShadow, pulseContactShadow, updateContactShadow } from '../entities/contactShadow.js';
import {
  createEnemyPool, resetEnemyPool, spawnEnemy, updateEnemyPool, checkEnemyHit, killEnemy,
} from '../entities/enemy.js';
import {
  createPlatformField, resetPlatformField, spawnPlatform, updatePlatformField,
  checkPlatformKillBarrierHit, getPlayerElevationAt, isPlatformLaneBlocked,
} from '../entities/platform.js';
import { createSpawnerState, resetSpawner, updateSpawner } from '../systems/spawner.js';
import { createGameState, restartToRunning, triggerGameOver } from './gameState.js';
import { pollLaneStep, pollJumpPress } from '../input/input.js';
import * as hud from '../ui/hud.js';
import {
  LANE_X, FORWARD_SPEED, ASPECT_W, ASPECT_H, CAMERA_FOV,
} from '../data/constants.js';
import {
  INTRO_WALL_ENABLED, INTRO_WALL_ENEMY_COUNT, INTRO_WALL_SPAWN_Z,
  INTRO_NORMAL_ENEMY_DELAY_SEC, INTRO_OBSTACLE_DELAY_SEC,
  INTRO_RAMP_UP_DURATION_SEC, INTRO_RAMP_UP_SPAWN_Z,
} from '../data/introSequence.js';
import { PLATFORM_ENABLED } from '../data/platformSequence.js';
import {
  OBSTACLE_FIRST_SPAWN_DELAY_SEC, ENEMY_FIRST_SPAWN_DELAY_SEC, ENEMY_SPAWN_INTERVAL_SEC,
  MIN_ENEMY_OBSTACLE_GAP_SEC, PLATFORM_FIRST_SPAWN_DELAY_SEC, PLATFORM_SPAWN_INTERVAL_SEC,
  PLATFORM_KILL_TYPE_ENABLED, PLATFORM_KILL_TYPE_CHANCE,
} from '../data/spawnConfig.js';
import { FRAME_LABELS, PLAYER_RUN_FRAMES } from '../data/playerSprite.js';
import {
  ParticlePool, spawnDustPuff, spawnEnemyPoof, createSpeedStreaks, updateSpeedStreaks,
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

  const cameraRig = createCameraRig(camera);
  const gs = createGameState();

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
  const ENEMY_KILL_SCORE = 100; // placeholder value -- no real scoring system yet (build doc §8 is MVP-only)

  let distance = 0;
  // Rotates through data/playerSprite.js's ATTACK_SEQUENCES kill to kill
  // (not random) so back-to-back kills don't just repeat the same one.
  let attackSequenceIndex = 0;
  let score = 0;

  // Running game-clock (seconds since the current run started) purely for
  // data/constants.js's MIN_ENEMY_OBSTACLE_GAP_SEC spacing rule below --
  // `distance` is world units, this needs to be time to compare directly
  // against spawn timestamps.
  let gameTime = 0;
  let lastObstacleSpawnTime = -Infinity;
  let lastEnemySpawnTime = -Infinity;

  function fullReset() {
    resetPlayer(player);
    // resetRibbon(ribbon); -- ribbon object disabled, see creation above
    resetObstaclePool(obstacleField);
    resetEnemyPool(enemyField);
    resetPlatformField(platformField);
    resetSpawner(platformSpawnerState, PLATFORM_FIRST_SPAWN_DELAY_SEC);
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

    distance = 0;
    score = 0;
    attackSequenceIndex = 0;
    hud.updateDistance(distance);
    hud.updateScore(score);
  }

  function endRun() {
    triggerGameOver(gs);
    hud.showGameOver(distance);
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
      const step = pollLaneStep();
      if (step !== 0) {
        const nextLane = THREE.MathUtils.clamp(player.targetLane + step, 0, LANE_X.length - 1);
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
        if (!isPlatformLaneBlocked(platformField, nextLane, player.sprite.position.z, player.elevationY)) {
          setPlayerLane(player, nextLane);
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
      updateStreet(street, dt, FORWARD_SPEED);

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
      updateContactShadow(contactShadow, player, dt);
      dustPool.update(dt);
      dustPool.scrollZ(FORWARD_SPEED * dt, DUST_FAN_RATE);
      updateSpeedStreaks(speedStreaks, dt, FORWARD_SPEED);

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

      distance += FORWARD_SPEED * dt;
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
          spawnObstacle(
            obstacleField, platformField, null,
            gameTime < INTRO_RAMP_UP_DURATION_SEC ? INTRO_RAMP_UP_SPAWN_Z : undefined,
          );
          lastObstacleSpawnTime = gameTime;
        }
      });
      updateObstaclePool(obstacleField, dt, FORWARD_SPEED);

      for (const slot of obstacleField.pool) {
        if (checkObstacleHit(player, slot)) {
          endRun();
          break;
        }
      }

      // Kill-barrier platform, missed -- same consequence as an obstacle
      // hit (entities/platform.js's checkPlatformKillBarrierHit is a plain
      // physical jump-or-die check: grounded at contact -> dead).
      if (checkPlatformKillBarrierHit(player, platformField, player.jumpElapsed === null)) {
        endRun();
      }

      // Foot Soldier: opposite of an obstacle hit -- contact KILLS the
      // enemy (dissolve poof + score + the player's auto spin-attack)
      // instead of ending the run.
      updateSpawner(enemySpawnerState, dt, () => {
        if (gameTime - lastObstacleSpawnTime >= MIN_ENEMY_OBSTACLE_GAP_SEC) {
          // Same ramp-up close-spawn treatment as the obstacle spawner above.
          spawnEnemy(
            enemyField, platformField, null, null,
            gameTime < INTRO_RAMP_UP_DURATION_SEC ? INTRO_RAMP_UP_SPAWN_Z : undefined,
          );
          lastEnemySpawnTime = gameTime;
        }
      }, ENEMY_SPAWN_INTERVAL_SEC);
      updateEnemyPool(enemyField, dt, FORWARD_SPEED, platformField);
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
          const type = PLATFORM_KILL_TYPE_ENABLED && Math.random() < PLATFORM_KILL_TYPE_CHANCE
            ? 'kill'
            : 'ramp';
          // Same ramp-up close-spawn treatment as obstacles/enemies above.
          spawnPlatform(
            platformField, type, null,
            gameTime < INTRO_RAMP_UP_DURATION_SEC ? INTRO_RAMP_UP_SPAWN_Z : undefined,
          );
        }, PLATFORM_SPAWN_INTERVAL_SEC);
      }
      updatePlatformField(platformField, dt, FORWARD_SPEED);
    }

    // Follow the eased lane-center position, not the per-frame xOffset snap
    // -- otherwise the small foot-plant jitter reads as camera pan/tilt.
    // elevationY rides up with the player on an elevated platform stretch
    // (entities/platform.js) so the camera keeps the same relative framing.
    updateCameraRig(cameraRig, player.laneX, player.elevationY);

    // TEMPORARY debug readout (index.html's #elevation-debug) -- live
    // numbers, kept from the earlier diagnosis pass. Display-only, no
    // gameplay effect.
    hud.updateElevationDebug(
      `lane ${player.laneIndex}  elevY ${player.elevationY.toFixed(2)}  fallV ${player.elevationVelocity.toFixed(2)}\n`
      + `sprite.y ${player.sprite.position.y.toFixed(2)}  scale ${player.sprite.scale.x.toFixed(2)}x${player.sprite.scale.y.toFixed(2)}\n`
      + `camera.y ${camera.position.y.toFixed(2)}  camera.z ${camera.position.z.toFixed(2)}\n`
      + `jump ${player.jumpElapsed === null ? 'no' : player.jumpElapsed.toFixed(2)}  playerElev ${getPlayerElevationAt(platformField, player.laneIndex, player.sprite.position.z, player.jumpElapsed !== null).toFixed(2)}`,
    );

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
