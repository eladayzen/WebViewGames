import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './style.css';
import { createShip } from './ship.js';
import {
  createTunnelWalls,
  scrollTunnelWalls,
  createSpeedRings,
  scrollSpeedRings,
  createSpeedParticles,
  scrollSpeedParticles,
} from './tunnel.js';
import { ObstacleField } from './obstacles.js';
import { getMoveVector, initPointerInput } from './input.js';

const TUNNEL_RADIUS = 6;
const PLAYER_Z = 0;
const BASE_SPEED = 0.112; // -30% from original prototype
const MAX_SPEED = 0.294;
const SPEED_RAMP = 0.00105;
const RING_SPACING = 32; // 2x the original gap, more time to react between rings
const RING_COUNT = 12;

// Tunnel Rush-style control: the ship sits at a FIXED distance from the
// tunnel's center axis (always skimming the wall) and only rotates around
// the circumference — there is no free 2D position. Only left/right do
// anything; up/down are simply never read below.
const RING_RADIUS = TUNNEL_RADIUS - 0.4; // small ship, doesn't reach out as far as the old skateboard rig did
const ANGULAR_SPEED = 2.6; // radians/sec at full deflection
const ANGULAR_RESPONSE = 10; // higher = snappier turning

// Rendering is locked to a 16:9 box (letterboxed within the browser window)
// so the frustum math below is reliable regardless of the actual device
// window shape. FOV + camera distance are chosen so the full tunnel wall
// (radius TUNNEL_RADIUS) is always inside the vertical frame with margin —
// vertical is the binding constraint since 16:9 is wider than tall, so if
// the full circle fits vertically it fits horizontally too.
const ASPECT = 16 / 9;
const CAMERA_FOV = 82;
const CAMERA_DISTANCE = 8; // camera.position.z, since the play plane is z=0

const app = document.getElementById('app');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const gemsEl = document.getElementById('gems');
const startOverlay = document.getElementById('start-overlay');
const countdownEl = document.getElementById('countdown');
const gameoverOverlay = document.getElementById('gameover-overlay');
const finalScoreEl = document.getElementById('final-score');

const stage = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
app.appendChild(renderer.domElement);
initPointerInput(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050318, 0.026);

const camera = new THREE.PerspectiveCamera(CAMERA_FOV, ASPECT, 0.1, 200);
camera.position.set(0, 0, CAMERA_DISTANCE);

scene.add(new THREE.HemisphereLight(0x6fc8ff, 0x1a0a2e, 0.7));
const keyLight = new THREE.PointLight(0xffffff, 1.4, 20);
keyLight.position.set(0, 2, 5);
scene.add(keyLight);
const rimLight = new THREE.PointLight(0xff5fa8, 1, 30);
rimLight.position.set(0, 0, -6);
scene.add(rimLight);

const walls = createTunnelWalls(scene, 400, TUNNEL_RADIUS);
const speedRings = createSpeedRings(scene, TUNNEL_RADIUS, 30, 6);
const speedParticles = createSpeedParticles(scene, TUNNEL_RADIUS * 0.95, 150, 60); // -40% from the original 250

const ship = createShip();
scene.add(ship);

const obstacles = new ObstacleField(scene, {
  radius: TUNNEL_RADIUS,
  ringRadius: RING_RADIUS,
  count: RING_COUNT,
  spacing: RING_SPACING,
  startZ: -30,
});

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.85, // strength
  0.45, // radius
  0.72, // threshold — only genuinely bright/emissive stuff blooms
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const player = { x: 0, y: 0, angle: -Math.PI / 2, angularVel: 0 };
let speed = BASE_SPEED;
let elapsed = 0;
let score = 0;
let gems = 0;
let best = Number(localStorage.getItem('ntt-best') || 0);
let state = 'countdown'; // 'countdown' | 'playing' | 'gameover'
const COUNTDOWN_SECONDS = 5;
let countdownRemaining = COUNTDOWN_SECONDS;

bestEl.textContent = `Best: ${Math.floor(best)}`;

function resetGame() {
  player.angle = -Math.PI / 2; // bottom of the tunnel
  player.angularVel = 0;
  player.x = Math.cos(player.angle) * RING_RADIUS;
  player.y = Math.sin(player.angle) * RING_RADIUS;
  speed = BASE_SPEED;
  elapsed = 0;
  score = 0;
  gems = 0;
  obstacles.reset(-30);
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(Math.floor(score));
  gemsEl.textContent = `⬥ ${gems}`;
}

function startGame() {
  resetGame();
  state = 'playing';
  startOverlay.classList.add('hidden');
  gameoverOverlay.classList.add('hidden');
}

// Trial mode: no click-to-start — the game boots straight into a live,
// idle scene with a countdown overlaid, then starts moving on its own.
function beginCountdown() {
  resetGame();
  countdownRemaining = COUNTDOWN_SECONDS;
  state = 'countdown';
  countdownEl.textContent = String(COUNTDOWN_SECONDS);
  startOverlay.classList.remove('hidden');
  gameoverOverlay.classList.add('hidden');
}

function endGame() {
  state = 'gameover';
  best = Math.max(best, score);
  localStorage.setItem('ntt-best', String(Math.floor(best)));
  bestEl.textContent = `Best: ${Math.floor(best)}`;
  finalScoreEl.textContent = String(Math.floor(score));
  gameoverOverlay.classList.remove('hidden');
}

document.getElementById('restart-button').addEventListener('click', startGame);
window.addEventListener('keydown', (e) => {
  if ((e.code === 'Space' || e.code === 'Enter') && state === 'gameover') startGame();
});

// Fit the largest 16:9 box into the window (letterboxed top/bottom or
// pillarboxed left/right as needed) instead of stretching to fill whatever
// shape the window happens to be — that's what let the tunnel wall get
// clipped on non-16:9 windows despite the frustum math above being tuned
// for exactly 16:9.
function fitStageToAspect() {
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  let width = winW;
  let height = winW / ASPECT;
  if (height > winH) {
    height = winH;
    width = winH * ASPECT;
  }
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  renderer.setSize(width, height);
  composer.setSize(width, height);
  bloomPass.setSize(width, height);
}

window.addEventListener('resize', fitStageToAspect);
fitStageToAspect();

const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 1 / 30) * 60; // frame-rate independent, ~1 at 60fps

  if (state === 'countdown') {
    countdownRemaining -= dt / 60;
    if (countdownRemaining > 0) {
      countdownEl.textContent = String(Math.ceil(countdownRemaining));
    } else if (countdownRemaining > -0.6) {
      countdownEl.textContent = 'GO!';
    } else {
      state = 'playing';
      startOverlay.classList.add('hidden');
    }
  }

  if (state === 'playing') {
    elapsed += dt;
    speed = Math.min(MAX_SPEED, BASE_SPEED + elapsed * SPEED_RAMP);
    score += speed * dt * 0.5;

    // Only left/right ever move the ship — move.y is intentionally never
    // read. Holding a direction rotates it around the tunnel wall at a
    // bounded angular speed; there's no separate radius to control.
    const move = getMoveVector();
    const targetAngularVel = move.x * ANGULAR_SPEED;
    const followT = 1 - Math.exp(-ANGULAR_RESPONSE * (dt / 60));
    player.angularVel += (targetAngularVel - player.angularVel) * followT;
    player.angle += player.angularVel * (dt / 60);

    player.x = Math.cos(player.angle) * RING_RADIUS;
    player.y = Math.sin(player.angle) * RING_RADIUS;

    obstacles.update(speed * dt, PLAYER_Z, player.x, player.y, {
      onPass: () => {},
      onCollide: endGame,
      onGem: () => {
        gems += 1;
        score += 25;
      },
    });

    scrollSpeedRings(speedRings, speed * dt, PLAYER_Z);
    scrollSpeedParticles(speedParticles, speed * dt, PLAYER_Z);
    scrollTunnelWalls(walls, speed * dt);

    updateHud();
  }

  ship.position.set(player.x, player.y, PLAYER_Z);
  // Bank the ship so its belly always points outward into the tunnel wall
  // and its cockpit always points toward the tube's central axis, like
  // standing in a rotating drum. At the rest angle (bottom, -PI/2) this is
  // identity (no rotation).
  ship.rotation.z = player.angle + Math.PI / 2;

  // Camera stays close to the tube's central axis (Tunnel Rush keeps a
  // fixed forward view) with only a light parallax nudge toward the ship.
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.x * 0.12, 0.08);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, player.y * 0.12, 0.08);
  camera.lookAt(player.x * 0.05, player.y * 0.05, PLAYER_Z - 10);

  // Light follows the ship's position directly — it swings all the way
  // around the tube, so the light needs to swing with it too.
  keyLight.position.set(player.x * 1.15, player.y * 1.15, PLAYER_Z + 4);

  composer.render();
}

beginCountdown();
tick();
