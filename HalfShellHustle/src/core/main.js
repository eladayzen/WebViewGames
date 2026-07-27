// Renderer/scene/camera bootstrap + top-level game loop + state machine
// (build doc §9.2, §9.3, §10 POC milestones). POC scope only: no CHASE
// meter, no scoring, no blocks, no pizza/coin/smoke-bomb, no Foot-bot in
// view -- a hit ends the run immediately (§2).

import * as THREE from 'three';
import '../style.css';

import { createStreet, updateStreet } from '../street/street.js';
import { createCameraRig, updateCameraRig } from '../street/camera-rig.js';
import {
  createPlayer, resetPlayer, setPlayerLane, startPlayerJump, startPlayerAttack, updatePlayer, getPlayerHeadAnchor,
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
import { createSpawnerState, resetSpawner, updateSpawner } from '../systems/spawner.js';
import { createGameState, restartToRunning, triggerGameOver } from './gameState.js';
import { pollLaneStep, pollJumpPress } from '../input/input.js';
import * as hud from '../ui/hud.js';
import {
  LANE_X, FORWARD_SPEED, ASPECT_W, ASPECT_H, CAMERA_FOV,
  ENEMY_FIRST_SPAWN_DELAY_SEC, ENEMY_SPAWN_INTERVAL_SEC,
} from '../data/constants.js';
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
  let score = 0;

  function fullReset() {
    resetPlayer(player);
    // resetRibbon(ribbon); -- ribbon object disabled, see creation above
    resetObstaclePool(obstacleField);
    resetSpawner(spawnerState);
    resetEnemyPool(enemyField);
    resetSpawner(enemySpawnerState, ENEMY_FIRST_SPAWN_DELAY_SEC);
    distance = 0;
    score = 0;
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
      const step = pollLaneStep();
      if (step !== 0) {
        const nextLane = THREE.MathUtils.clamp(player.targetLane + step, 0, LANE_X.length - 1);
        setPlayerLane(player, nextLane);
      }
      if (pollJumpPress()) startPlayerJump(player);
      updatePlayer(player, dt);
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
        spawnDustPuff(dustPool, player.sprite.position.x, 0.05, player.sprite.position.z - DUST_AHEAD_OFFSET);
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

      updateSpawner(spawnerState, dt, () => spawnObstacle(obstacleField));
      updateObstaclePool(obstacleField, dt, FORWARD_SPEED);

      for (const slot of obstacleField.pool) {
        if (checkObstacleHit(player, slot)) {
          endRun();
          break;
        }
      }

      // Foot Soldier: opposite of an obstacle hit -- contact KILLS the
      // enemy (dissolve poof + score + the player's auto spin-attack)
      // instead of ending the run.
      updateSpawner(enemySpawnerState, dt, () => spawnEnemy(enemyField), ENEMY_SPAWN_INTERVAL_SEC);
      updateEnemyPool(enemyField, dt, FORWARD_SPEED);
      const hitEnemy = checkEnemyHit(player, enemyField);
      if (hitEnemy) {
        spawnEnemyPoof(
          enemyPoofPool,
          hitEnemy.sprite.position.x, hitEnemy.sprite.position.y, hitEnemy.sprite.position.z,
          hitEnemy.sprite.scale.x, hitEnemy.sprite.scale.y, hitEnemy.type.poofColors,
        );
        killEnemy(hitEnemy);
        startPlayerAttack(player);
        score += ENEMY_KILL_SCORE;
        hud.updateScore(score);
      }
      enemyPoofPool.update(dt);
    }

    // Follow the eased lane-center position, not the per-frame xOffset snap
    // -- otherwise the small foot-plant jitter reads as camera pan/tilt.
    updateCameraRig(cameraRig, player.laneX);
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
