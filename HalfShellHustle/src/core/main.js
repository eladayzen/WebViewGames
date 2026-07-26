// Renderer/scene/camera bootstrap + top-level game loop + state machine
// (build doc §9.2, §9.3, §10 POC milestones). POC scope only: no CHASE
// meter, no scoring, no blocks, no pizza/coin/smoke-bomb, no Foot-bot in
// view -- a hit ends the run immediately (§2).

import * as THREE from 'three';
import '../style.css';

import { createStreet, updateStreet } from '../street/street.js';
import { createCameraRig, updateCameraRig } from '../street/camera-rig.js';
import {
  createPlayer, resetPlayer, setPlayerLane, updatePlayer,
} from '../entities/player.js';
import {
  createObstaclePool, resetObstaclePool, spawnObstacle, updateObstaclePool,
} from '../entities/obstacles.js';
import { checkObstacleHit } from '../entities/collision.js';
import { createSpawnerState, resetSpawner, updateSpawner } from '../systems/spawner.js';
import { createGameState, restartToRunning, triggerGameOver } from './gameState.js';
import { pollLaneStep } from '../input/input.js';
import * as hud from '../ui/hud.js';
import { LANE_X, FORWARD_SPEED, ASPECT_W, ASPECT_H, CAMERA_FOV } from '../data/constants.js';

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

  const obstacleField = createObstaclePool(scene);
  const spawnerState = createSpawnerState();
  const cameraRig = createCameraRig(camera);
  const gs = createGameState();

  let distance = 0;

  function fullReset() {
    resetPlayer(player);
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
      updatePlayer(player, dt);
      updateStreet(street, dt, FORWARD_SPEED);

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
