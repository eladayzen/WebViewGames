// Renderer/scene/camera bootstrap + top-level game loop + state machine
// (build doc §9.2, §9.3, §10 POC milestones). POC scope only: no CHASE
// meter, no scoring, no blocks, no pizza/coin/smoke-bomb, no Foot-bot in
// view -- a hit ends the run immediately (§2).

import * as THREE from 'three';
import '../style.css';

import { createStreet, updateStreet } from '../street/street.js';
import { createCameraRig, updateCameraRig } from '../street/camera-rig.js';
import {
  createPlayer, resetPlayer, setPlayerLane, startPlayerJump, updatePlayer, getPlayerHeadAnchor,
} from '../entities/player.js';
import { createRibbon, resetRibbon, updateRibbon } from '../entities/ribbon.js';
import {
  createObstaclePool, resetObstaclePool, spawnObstacle, updateObstaclePool,
} from '../entities/obstacles.js';
import { checkObstacleHit } from '../entities/collision.js';
import { createSpawnerState, resetSpawner, updateSpawner } from '../systems/spawner.js';
import { createGameState, restartToRunning, triggerGameOver } from './gameState.js';
import { pollLaneStep, pollJumpPress } from '../input/input.js';
import * as hud from '../ui/hud.js';
import { LANE_X, FORWARD_SPEED, ASPECT_W, ASPECT_H, CAMERA_FOV } from '../data/constants.js';
import { FRAME_LABELS } from '../data/playerSprite.js';

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
  const cameraRig = createCameraRig(camera);
  const gs = createGameState();

  let distance = 0;

  function fullReset() {
    resetPlayer(player);
    // resetRibbon(ribbon); -- ribbon object disabled, see creation above
    resetObstaclePool(obstacleField);
    resetSpawner(spawnerState);
    distance = 0;
    hud.updateDistance(distance);
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

      if (player.frameIndex !== lastDebugFrame) {
        lastDebugFrame = player.frameIndex;
        hud.updateFrameDebug(`frame ${player.frameIndex}: ${FRAME_LABELS[player.frameIndex]}`);
      }

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
    }

    updateCameraRig(cameraRig, player.sprite.position.x);
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
