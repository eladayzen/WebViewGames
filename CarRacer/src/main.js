import * as THREE from 'three';
import { initPointerInput, initButtonInput, pollLaneStep, getSteerHold, pollSensorInput } from './input.js';
import {
  createPlayerCar, setPlayerLane, updatePlayerCarDiscrete, updatePlayerCarContinuous,
} from './player-car.js';
import { createTrafficField, spawnTraffic, updateTrafficField } from './traffic.js';
import { createCoinField, spawnCoin, updateCoinField } from './coins.js';
import { createRoad } from './road.js';
import { createPylons, updatePylons } from './pylons.js';
import { createSkyBackground } from './sky.js';
import {
  ParticlePool, spawnCoinBurst, spawnCrashBurst, emitTrail,
  createSpeedStreaks, updateSpeedStreaks, createRibbonTrail,
} from './vfx.js';
import { createCameraRig, updateCameraRig, triggerShake } from './camera-rig.js';
import { createPostFX, resizePostFX, updatePostFXWatchdog, renderPostFX } from './postfx.js';
import { pickTemplate } from './patterns.js';
import {
  LANE_X, PLAYER_Z, BASE_SPEED, MAX_SPEED, SPEED_RAMP_TIME,
  SPAWN_Z, BASE_SPAWN_GAP, MIN_SPAWN_GAP, SPAWN_GAP_RAMP_TIME,
  TRAFFIC_COLLISION_Z, TRAFFIC_COLLISION_X, TRAFFIC_NEAR_MISS_X,
  COIN_PICKUP_Z, COIN_PICKUP_X, STARTING_LIVES, INVINCIBILITY_TIME,
} from './constants.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

function boot() {

const ASPECT_W = 16;
const ASPECT_H = 9;

const app = document.getElementById('app');
const scoreEl = document.getElementById('score');
const coinsEl = document.getElementById('coins');
const livesEl = document.getElementById('lives');
const gameoverEl = document.getElementById('gameover-overlay');
const finalScoreEl = document.getElementById('finalScore');
const restartBtn = document.getElementById('restart-button');
const modeToggleBtn = document.getElementById('modeToggle');
const howtoEl = document.getElementById('howto');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = createSkyBackground();
scene.fog = new THREE.Fog(0x0a0e1e, 70, 190);

const camera = new THREE.PerspectiveCamera(62, ASPECT_W / ASPECT_H, 0.1, 220);

const hemi = new THREE.HemisphereLight(0x2a3a5a, 0x0a0812, 0.55);
scene.add(hemi);
const fill = new THREE.DirectionalLight(0x8fb0ff, 0.35);
fill.position.set(4, 10, 6);
scene.add(fill);

const road = createRoad();
scene.add(road);

const pylons = createPylons(scene);

const player = createPlayerCar();
scene.add(player);

const trafficField = createTrafficField(scene);
const coinField = createCoinField(scene);

const burstPool = new ParticlePool(scene, 400, 0.14);
const speedStreaks = createSpeedStreaks(scene);
const ribbonTrail = createRibbonTrail(scene, { color: 0x5fe0ff, width: 0.85, opacity: 0.5, maxPoints: 14 });
const cameraRig = createCameraRig(camera);
const trailWorldPos = new THREE.Vector3();

const postfx = createPostFX(renderer, scene, camera, window.innerWidth, window.innerHeight);

initPointerInput(renderer.domElement);
initButtonInput(btnLeft, btnRight);

function fitStageToAspect() {
  const availW = window.innerWidth;
  const availH = window.innerHeight;
  let w = availW;
  let h = (w * ASPECT_H) / ASPECT_W;
  if (h > availH) {
    h = availH;
    w = (h * ASPECT_W) / ASPECT_H;
  }
  app.style.width = `${w}px`;
  app.style.height = `${h}px`;
  renderer.setSize(w, h, true);
  resizePostFX(postfx, w, h);
  camera.aspect = ASPECT_W / ASPECT_H;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', fitStageToAspect);
fitStageToAspect();

// --- Control mode: two interchangeable controller families, both reading
// the same input funnel (see input.js). Toggle-able at runtime so both can
// be A/B tested without a rebuild. Future game variations pick one and drop
// the toggle -- the underlying input primitives don't change either way.
const MODE_LABEL = {
  runner: 'MODE: RUNNER (tap)',
  soft: 'MODE: SOFT (hold)',
};
const MODE_HOWTO = {
  runner: 'TAP LEFT/RIGHT OR ARROW KEYS / A D TO CHANGE LANES',
  soft: 'HOLD LEFT/RIGHT OR ARROW KEYS / A D TO STEER',
};
let controlMode = 'runner';

modeToggleBtn.addEventListener('click', () => {
  controlMode = controlMode === 'runner' ? 'soft' : 'runner';
  modeToggleBtn.textContent = MODE_LABEL[controlMode];
  howtoEl.textContent = MODE_HOWTO[controlMode];
});

// --- Game state ---
let state = 'playing'; // 'playing' | 'gameover'
let elapsed = 0;
let distance = 0;
let coins = 0;
let lives = STARTING_LIVES;
let invincibleTimer = 0;
let laneIndex = 1;
let distanceSinceSpawn = 0;
let comboCount = 0;
let comboTimer = 0;

function resetGame() {
  state = 'playing';
  elapsed = 0;
  distance = 0;
  coins = 0;
  lives = STARTING_LIVES;
  invincibleTimer = 0;
  laneIndex = 1;
  distanceSinceSpawn = 0;
  comboCount = 0;
  comboTimer = 0;
  setPlayerLane(player, laneIndex);
  player.position.x = LANE_X[laneIndex];
  player.rotation.z = 0;
  player.visible = true;
  for (const s of trafficField.pool) { s.active = false; s.mesh.visible = false; }
  for (const s of coinField.pool) { s.active = false; s.mesh.visible = false; }
  ribbonTrail.reset();
  gameoverEl.classList.add('hidden');
  updateHud();
}

function updateHud() {
  scoreEl.textContent = `${Math.floor(distance)}m`;
  coinsEl.textContent = `● ${coins}`;
  livesEl.textContent = '♥'.repeat(Math.max(lives, 0)) + '♡'.repeat(Math.max(STARTING_LIVES - lives, 0));
}

function currentSpeed() {
  const t = Math.min(elapsed / SPEED_RAMP_TIME, 1);
  return BASE_SPEED + (MAX_SPEED - BASE_SPEED) * t;
}

function currentSpawnGap() {
  const t = Math.min(elapsed / SPAWN_GAP_RAMP_TIME, 1);
  return BASE_SPAWN_GAP - (BASE_SPAWN_GAP - MIN_SPAWN_GAP) * t;
}

function trySpawnPattern() {
  const template = pickTemplate(elapsed);
  for (const entry of template) {
    const z = SPAWN_Z + entry.zOffset;
    if (entry.type === 'traffic') {
      const speed = currentSpeed() * (0.45 + Math.random() * 0.3);
      spawnTraffic(trafficField, entry.lane, z, speed);
    } else if (entry.type === 'coin') {
      spawnCoin(coinField, entry.lane, z);
    }
  }
}

function handleTrafficHit(slot) {
  spawnCrashBurst(burstPool, slot.mesh.position.x, slot.mesh.position.y + 0.5, slot.mesh.position.z);
  triggerShake(cameraRig, 0.4);
  slot.active = false;
  slot.mesh.visible = false;
  lives -= 1;
  updateHud();
  if (lives <= 0) {
    triggerGameOver();
  } else {
    invincibleTimer = INVINCIBILITY_TIME;
  }
}

function checkCollisionsAndPickups(dt) {
  if (invincibleTimer <= 0) {
    for (const s of trafficField.pool) {
      if (!s.active) continue;
      const lateralDist = Math.abs(LANE_X[s.laneIndex] - player.position.x);
      if (Math.abs(s.z - PLAYER_Z) < TRAFFIC_COLLISION_Z && lateralDist < TRAFFIC_COLLISION_X) {
        handleTrafficHit(s);
        break;
      }
      if (
        !s.nearMissChecked &&
        Math.abs(s.z - PLAYER_Z) < TRAFFIC_COLLISION_Z &&
        lateralDist < TRAFFIC_NEAR_MISS_X
      ) {
        s.nearMissChecked = true;
        triggerShake(cameraRig, 0.06);
      }
    }
  }

  comboTimer = Math.max(comboTimer - dt, 0);
  if (comboTimer <= 0) comboCount = 0;

  for (const s of coinField.pool) {
    if (!s.active) continue;
    if (
      Math.abs(s.z - PLAYER_Z) < COIN_PICKUP_Z &&
      Math.abs(LANE_X[s.laneIndex] - player.position.x) < COIN_PICKUP_X
    ) {
      spawnCoinBurst(burstPool, s.mesh.position.x, s.mesh.position.y, s.mesh.position.z);
      s.active = false;
      s.mesh.visible = false;
      coins += 1;
      comboCount += 1;
      comboTimer = 0.9;
      if (comboCount > 0 && comboCount % 5 === 0) triggerShake(cameraRig, 0.12);
    }
  }
}

function triggerGameOver() {
  state = 'gameover';
  player.visible = true;
  finalScoreEl.textContent = `${Math.floor(distance)}m • ${coins} coins`;
  gameoverEl.classList.remove('hidden');
}

restartBtn.addEventListener('click', resetGame);
window.addEventListener('keydown', (e) => {
  if (state === 'gameover' && (e.code === 'Enter' || e.code === 'Space')) resetGame();
});

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 1 / 30);

  pollSensorInput();

  if (state === 'playing') {
    elapsed += dt;
    const speed = currentSpeed();
    distance += speed * dt;
    distanceSinceSpawn += speed * dt;

    if (controlMode === 'runner') {
      const step = pollLaneStep();
      if (step !== 0) {
        laneIndex = THREE.MathUtils.clamp(laneIndex + step, 0, LANE_X.length - 1);
        setPlayerLane(player, laneIndex);
      }
      updatePlayerCarDiscrete(player, dt);
    } else {
      updatePlayerCarContinuous(player, getSteerHold(), dt);
    }

    updateTrafficField(trafficField, dt, speed);
    updateCoinField(coinField, dt, speed);
    updatePylons(pylons, dt, speed);
    updateSpeedStreaks(speedStreaks, dt, speed);

    player.userData.trailAnchor.getWorldPosition(trailWorldPos);
    emitTrail(burstPool, trailWorldPos.x, trailWorldPos.y, trailWorldPos.z, dt);
    ribbonTrail.update(trailWorldPos.x, trailWorldPos.y, trailWorldPos.z, dt, speed);

    if (distanceSinceSpawn >= currentSpawnGap()) {
      distanceSinceSpawn = 0;
      trySpawnPattern();
    }

    checkCollisionsAndPickups(dt);

    if (invincibleTimer > 0) {
      invincibleTimer = Math.max(invincibleTimer - dt, 0);
      player.visible = Math.floor(invincibleTimer * 10) % 2 === 0;
    }

    updateHud();
  }

  burstPool.update(dt);
  updateCameraRig(cameraRig, player, dt, currentSpeed());
  updatePostFXWatchdog(postfx, dt);
  renderPostFX(postfx, scene, camera);
  requestAnimationFrame(tick);
}

resetGame();
requestAnimationFrame(tick);

}
