import * as THREE from 'three';
import '../style.css';

import {
  createTunnelWalls,
  scrollTunnelWalls,
  setTunnelTheme,
  createReachableRail,
  scrollReachableRail,
  setRailCrossSection,
  createSpeedRings,
  scrollSpeedRings,
  createSpeedParticles,
  scrollSpeedParticles,
} from '../tunnel/tunnelGeometry.js';
import { createPlayer, resetPlayer, stepPlayerAngle, updatePlayerPosition, maybeStartReclamp, setPlayerHitPose, setPlayerVisible } from '../entities/player.js';
import { createObstaclePool, updateObstacles } from '../entities/obstacles.js';
import { createPickupPool, updatePickups } from '../entities/pickups.js';
import { createSpawnerState, resetSpawner, updateSpawner } from '../systems/spawner.js';
import { createSectionState, resetSectionState, tickSection, currentSection } from '../systems/sections.js';
import { createScoringState, resetScoring, accrueDistanceScore, collectPizza, tickMultiplierDecay, decayFraction } from '../systems/scoring.js';
import { createLivesState, resetLives, tryHit, isInvulnerable } from '../systems/lives.js';
import { createGameState, restartToCountdown, togglePause, updateCountdown, triggerGameOver } from './gameState.js';
import { getSteeringInput } from '../input/input.js';
import * as hud from '../ui/hud.js';
import { SECTIONS } from '../data/sectionsData.js';
import { TUNNEL_RADIUS, RING_RADIUS, PLAYER_Z, ASPECT, CAMERA_FOV, CAMERA_DISTANCE, MAX_LIVES, BEST_SCORE_STORAGE_KEY } from '../data/constants.js';

// Wrapped in an async IIFE (rather than a top-level `await`) because the
// configured esbuild build targets (chrome87/safari14/etc., set for
// GoBalance WebView compat) don't support top-level await syntax --
// `npm run build` fails hard on it even though `npm run dev` doesn't.
async function boot() {
// --- Renderer / scene / camera bootstrap ------------------------------------
const app = document.getElementById('app');
const stage = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c2620);
scene.fog = new THREE.FogExp2(0x040f0c, 0.045);

const camera = new THREE.PerspectiveCamera(CAMERA_FOV, ASPECT, 0.1, 200);
camera.position.set(0, 0, CAMERA_DISTANCE);

scene.add(new THREE.HemisphereLight(0x6fe8c0, 0x061a12, 0.75));
const keyLight = new THREE.PointLight(0xeafff3, 1.3, 22);
keyLight.position.set(0, 2, 5);
scene.add(keyLight);
const rimLight = new THREE.PointLight(0x2fe8a0, 0.9, 32);
rimLight.position.set(0, 0, -6);
scene.add(rimLight);

// --- World -------------------------------------------------------------------
// 620 comfortably covers the farthest any recycling decorative ring ever
// reaches (20 rings * 26 spacing + 26 = 546) plus margin -- keeps every
// scrolling feature always inside the tunnel mesh's own z-range.
const walls = await createTunnelWalls(scene, 620, TUNNEL_RADIUS);
const speedRings = createSpeedRings(scene, TUNNEL_RADIUS, 20, 26);
const speedParticles = createSpeedParticles(scene, TUNNEL_RADIUS * 0.92, 30, 60);
const rail = createReachableRail(scene, RING_RADIUS, 14, 18, SECTIONS[0].crossSection);

const player = createPlayer();
scene.add(player.shadow);
scene.add(player.sprite);

const obstaclePool = createObstaclePool(scene);
const pickupPool = createPickupPool(scene);

// --- State ---------------------------------------------------------------------
const spawnerState = createSpawnerState();
const sectionState = createSectionState();
const scoringState = createScoringState();
const livesState = createLivesState();
const gs = createGameState();

let elapsed = 0; // frame-normalized accumulator, same convention as Astro_Tunnel
let currentSpeed = SECTIONS[0].speed;
let best = Number(localStorage.getItem(BEST_SCORE_STORAGE_KEY) || 0);

hud.initLivesTray(MAX_LIVES);

function updateHudAll() {
  hud.updateScore(scoringState.score);
  hud.updateMultiplier(scoringState.multiplier, decayFraction(scoringState));
  hud.updateLives(livesState.lives);
}

function fullReset() {
  resetPlayer(player);
  resetSectionState(sectionState);
  resetScoring(scoringState);
  resetLives(livesState);
  elapsed = 0;
  const initial = SECTIONS[0];
  setTunnelTheme(walls, initial.themeIndex);
  setRailCrossSection(rail, initial.crossSection);
  resetSpawner(spawnerState, obstaclePool, pickupPool, initial);
  currentSpeed = initial.speed;
  updateHudAll();
}

function endGame() {
  triggerGameOver(gs);
  setPlayerVisible(player, true); // stop any in-progress invulnerability blink
  setPlayerHitPose(player);
  best = Math.max(best, scoringState.score);
  localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(Math.floor(best)));
  hud.showGameOver(scoringState.score, best);
}

document.getElementById('restart-button').addEventListener('click', () => {
  hud.hideGameOver();
  fullReset();
  restartToCountdown(gs);
});
window.addEventListener('keydown', (e) => {
  if ((e.code === 'Space' || e.code === 'Enter') && gs.current === 'gameover') {
    hud.hideGameOver();
    fullReset();
    restartToCountdown(gs);
  }
});

const pauseButton = document.getElementById('pause-button');
pauseButton.addEventListener('click', () => {
  togglePause(gs);
  pauseButton.textContent = gs.paused ? '▶' : '⏸'; // ▶ / ⏸
  hud.setPausedBadge(gs.paused);
});

// --- Letterboxed 16:9 stage, same technique as Astro_Tunnel -----------------
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
}
window.addEventListener('resize', fitStageToAspect);
fitStageToAspect();

// --- Main loop -----------------------------------------------------------------
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 1 / 30) * 60; // frame-rate independent, ~1 at 60fps

  if (!gs.paused && gs.current === 'countdown') {
    updateCountdown(gs, dt / 60);
    if (gs.current === 'countdown') {
      hud.showCountdown(gs.countdownRemaining > 0.6 ? String(Math.ceil(gs.countdownRemaining)) : 'GO!');
    } else {
      hud.hideCountdown();
    }
  }

  if (!gs.paused && gs.current === 'running') {
    elapsed += dt;
    const elapsedSeconds = elapsed / 60;

    const newSection = tickSection(sectionState, elapsedSeconds);
    if (newSection) {
      setTunnelTheme(walls, newSection.themeIndex);
      setRailCrossSection(rail, newSection.crossSection);
      maybeStartReclamp(player, newSection.crossSection);
      hud.showSectionBanner(newSection.label);
    }
    const sectionParams = currentSection(sectionState);

    // Modest, capped forward-speed ramp: ease toward the active section's
    // speed rather than jumping, so a section transition doesn't read as a
    // sudden speed spike on top of the visual banner cue (§5.1, §10 pacing
    // pass -- never demand faster reaction than a lean board can give).
    currentSpeed = THREE.MathUtils.lerp(currentSpeed, sectionParams.speed, 0.02);

    const steerX = getSteeringInput();
    stepPlayerAngle(player, steerX, dt, sectionParams.crossSection);
    updatePlayerPosition(player);

    const zDelta = currentSpeed * dt;

    updateSpawner(spawnerState, obstaclePool, pickupPool, sectionParams, zDelta);

    updateObstacles(obstaclePool, zDelta, dt / 60, PLAYER_Z, player.theta, {
      onHit: () => {
        const result = tryHit(livesState, elapsedSeconds);
        if (result.hit) {
          updateHudAll();
          if (result.dead) endGame();
        }
      },
    });

    updatePickups(pickupPool, zDelta, elapsedSeconds, PLAYER_Z, player.theta, {
      onCollect: () => {
        collectPizza(scoringState);
        updateHudAll();
      },
    });

    accrueDistanceScore(scoringState, currentSpeed, dt);
    tickMultiplierDecay(scoringState, dt / 60);
    updateHudAll();

    scrollTunnelWalls(walls, zDelta, PLAYER_Z);
    scrollReachableRail(rail, zDelta, PLAYER_Z);
    scrollSpeedRings(speedRings, zDelta, PLAYER_Z);
    scrollSpeedParticles(speedParticles, zDelta, PLAYER_Z);

    // Fast, obvious blink for the duration of post-hit invulnerability so
    // the grace window is felt, not just implied (matches Astro_Tunnel).
    if (isInvulnerable(livesState, elapsedSeconds)) {
      setPlayerVisible(player, Math.floor(elapsedSeconds * 14) % 2 === 0);
    } else {
      setPlayerVisible(player, true);
    }

    // Gentle parallax + lookahead -- camera stays near the tunnel's local
    // axis (same technique as Astro_Tunnel) while the spline bend baked
    // into the wall mesh + rail/rings sells the curve.
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.x * 0.1, 0.08);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, player.y * 0.1, 0.08);
    camera.lookAt(player.x * 0.05, player.y * 0.05, PLAYER_Z - 10);
    keyLight.position.set(player.x * 1.1, player.y * 1.1, PLAYER_Z + 4);
  }

  renderer.render(scene, camera);
}

fullReset();
tick();
}

boot();
