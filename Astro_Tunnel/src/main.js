import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './style.css';
import { createShip } from './ship.js';
import {
  createTunnelWalls,
  scrollTunnelWalls,
  advanceTunnelTheme,
  createSpeedRings,
  scrollSpeedRings,
  createSpeedParticles,
  scrollSpeedParticles,
  THEME_HUE_CENTERS,
} from './tunnel.js';
import { ObstacleField } from './obstacles.js';
import { getMoveVector, initPointerInput } from './input.js';
import { ParticlePool, spawnBurst } from './vfx.js';

// Extra visual fidelity on top of the base bloom pass — each is cheap on a
// desktop GPU but this is headed for an unverified mobile WebView, so keep
// these behind flags that are trivial to flip off if real-device testing
// shows trouble, rather than baking them in unconditionally.
const FX = {
  chromaticAberration: false, // pulsing RGB-split with speed read as strobing/flickering — removed
  vignette: true,
  speedFovKick: true,
  screenShake: true,
  engineTrail: true,
  particleBursts: true,
};

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

const MAX_LIVES = 3;
const HIT_INVULNERABILITY_SECONDS = 1.2; // grace window after taking a hit before another can register

const FIRST_ENVIRONMENT_EVENT_SECONDS = 20; // first color change happens 20s in
const ENVIRONMENT_EVENT_INTERVAL_MIN = 22; // then repeats every 22-32s after that
const ENVIRONMENT_EVENT_INTERVAL_MAX = 32;

const app = document.getElementById('app');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const gemsEl = document.getElementById('gems');
const livesEl = document.getElementById('lives');
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
// Without this, empty space (anything the tube doesn't cover) falls back to
// the renderer's default black clear color, and bloom bleeding off the key
// light/wall specular reads as a washed-out grey/white haze on top of it
// instead of a deliberate color. Matches the tunnel's first color theme's
// own deep purple (tunnel.js THEME_PALETTES[0].bg0) for consistency.
scene.background = new THREE.Color(0x140b30);
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
// 3 evenly-spaced decorative "beauty rings" between every obstacle ring,
// rather than a fixed 6-unit spacing unrelated to how far apart the
// obstacles actually are.
const BEAUTY_RING_SPACING = RING_SPACING / 3;
const speedRings = createSpeedRings(scene, TUNNEL_RADIUS, 24, BEAUTY_RING_SPACING);
const speedParticles = createSpeedParticles(scene, TUNNEL_RADIUS * 0.95, 35, 60); // much less noise, moved to the tunnel's sides (see tunnel.js)

const ship = createShip();
scene.add(ship);

const obstacles = new ObstacleField(scene, {
  radius: TUNNEL_RADIUS,
  ringRadius: RING_RADIUS,
  count: RING_COUNT,
  spacing: RING_SPACING,
  startZ: -30,
});

// One continuous-emission pool for the engine trail, one pool for crash
// bursts, and a separate bigger-particle pool just for pickups — pickup
// feedback needed to read as punchier than a crash, not share its size.
const enginePool = new ParticlePool(scene, 60, 0.09);
const burstPool = new ParticlePool(scene, 90, 0.11);
const pickupBurstPool = new ParticlePool(scene, 150, 0.18);
const ENGINE_COLOR = new THREE.Color(0x4fd8ff);
const GEM_BURST_COLOR = new THREE.Color(0xffe082);
const LIFE_BURST_COLOR = new THREE.Color(0xff3d6b);
const CRASH_BURST_COLOR = new THREE.Color(0xff5a3c);
let engineEmitTimer = 0;
let shakeIntensity = 0;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.85, // strength
  0.45, // radius
  0.72, // threshold — only genuinely bright/emissive stuff blooms
);
composer.addPass(bloomPass);

// Amount is driven by current speed each frame (see tick) so going faster
// reads as "warping" harder, not just a static fixed distortion.
let rgbShiftPass = null;
if (FX.chromaticAberration) {
  rgbShiftPass = new ShaderPass(RGBShiftShader);
  rgbShiftPass.uniforms.amount.value = 0.0015;
  composer.addPass(rgbShiftPass);
}

if (FX.vignette) {
  const vignettePass = new ShaderPass(VignetteShader);
  vignettePass.uniforms.offset.value = 1.1;
  // VignetteShader targets vec3(1.0 - darkness) at full vignette strength,
  // so darkness must stay in [0, 1] — anything above 1 sends that target
  // negative, and negative color feeding the sRGB output conversion
  // downstream produces undefined GPU output. That's what the washed-out
  // grey/white haze across the whole frame actually was: darkness was set
  // to 1.3, out of the shader's valid range.
  vignettePass.uniforms.darkness.value = 1.0;
  composer.addPass(vignettePass);
}

composer.addPass(new OutputPass());

const player = { x: 0, y: 0, angle: -Math.PI / 2, angularVel: 0 };
let speed = BASE_SPEED;
let elapsed = 0;
let score = 0;
let gems = 0;
let lives = MAX_LIVES;
let invulnerableUntil = 0; // in real elapsed seconds
let nextEnvironmentEventAt = FIRST_ENVIRONMENT_EVENT_SECONDS;
let lastSeenTheme = 0;
let best = Number(localStorage.getItem('ntt-best') || 0);
let state = 'countdown'; // 'countdown' | 'playing' | 'gameover'
const COUNTDOWN_SECONDS = 3;
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
  lives = MAX_LIVES;
  invulnerableUntil = 0;
  nextEnvironmentEventAt = FIRST_ENVIRONMENT_EVENT_SECONDS;
  lastSeenTheme = walls.currentTheme;
  obstacles.setThemeHue(THEME_HUE_CENTERS[walls.currentTheme]);
  obstacles.reset(-30);
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(Math.floor(score));
  gemsEl.textContent = `⬥ ${gems}`;
  livesEl.innerHTML =
    '♥'.repeat(lives) + `<span class="lost">${'♥'.repeat(MAX_LIVES - lives)}</span>`;
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

  if (FX.particleBursts) {
    spawnBurst(burstPool, player.x, player.y, PLAYER_Z, CRASH_BURST_COLOR, 50, 4.5, 0.65);
  }
  if (FX.screenShake) {
    shakeIntensity = 0.55;
  }
}

// A wall hit costs one life instead of ending the round outright — only
// reaching zero lives finishes it. The invulnerability window stops a
// single bad pass through a wall from chaining into multiple life losses
// off the same or the next ring before the player can react, and doubles
// as the duration of the ship's blink (see tick) so the flicker itself
// communicates exactly how long the grace window lasts.
function handleHit() {
  const elapsedSeconds = elapsed / 60;
  if (elapsedSeconds < invulnerableUntil) return;
  invulnerableUntil = elapsedSeconds + HIT_INVULNERABILITY_SECONDS;

  lives -= 1;
  updateHud();

  if (lives <= 0) {
    endGame();
    return;
  }

  if (FX.particleBursts) {
    spawnBurst(burstPool, player.x, player.y, PLAYER_Z, CRASH_BURST_COLOR, 32, 3.5, 0.5);
  }
  if (FX.screenShake) {
    shakeIntensity = 0.4;
  }
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

    obstacles.update(speed * dt, PLAYER_Z, player.x, player.y, elapsed / 60, {
      onPass: () => {},
      onCollide: handleHit,
      onGem: (gx, gy, gz) => {
        gems += 1;
        score += 25;
        if (FX.particleBursts) {
          spawnBurst(pickupBurstPool, gx, gy, gz, GEM_BURST_COLOR, 45, 4.5, 0.55);
        }
      },
      onLife: (lx, ly, lz) => {
        if (lives < MAX_LIVES) {
          lives += 1;
          updateHud();
        } else {
          score += 15; // already topped up — small consolation bonus instead of a wasted pickup
        }
        if (FX.particleBursts) {
          spawnBurst(pickupBurstPool, lx, ly, lz, LIFE_BURST_COLOR, 45, 4.5, 0.6);
        }
      },
    });

    scrollSpeedRings(speedRings, speed * dt, PLAYER_Z);
    scrollSpeedParticles(speedParticles, speed * dt, PLAYER_Z);
    scrollTunnelWalls(walls, speed * dt);

    // Periodic "the tunnel changes color" beat. First one at 20s, then every
    // 22-32s after that (see constants above). Instant swap, no fade/window.
    if (elapsed / 60 >= nextEnvironmentEventAt) {
      advanceTunnelTheme(walls);
      nextEnvironmentEventAt +=
        ENVIRONMENT_EVENT_INTERVAL_MIN + Math.random() * (ENVIRONMENT_EVENT_INTERVAL_MAX - ENVIRONMENT_EVENT_INTERVAL_MIN);
    }

    updateHud();
  }

  if (walls.currentTheme !== lastSeenTheme) {
    lastSeenTheme = walls.currentTheme;
    obstacles.setThemeHue(THEME_HUE_CENTERS[lastSeenTheme]);
  }

  ship.position.set(player.x, player.y, PLAYER_Z);
  // Bank the ship so its belly always points outward into the tunnel wall
  // and its cockpit always points toward the tube's central axis, like
  // standing in a rotating drum. At the rest angle (bottom, -PI/2) this is
  // identity (no rotation).
  ship.rotation.z = player.angle + Math.PI / 2;

  // Engine trail runs whenever the ship is "powered on" — countdown (idle
  // glow) and playing — but stops the instant it crashes. Spawn particles at
  // the engine's world position, drifting +Z (the direction that reads as
  // "backward" here, matching the same convention as everything else
  // scrolling forward) at roughly the tunnel's own scroll speed.
  if (FX.engineTrail && state !== 'gameover') {
    engineEmitTimer += dt / 60;
    const EMIT_INTERVAL = 0.02;
    const engineZ = ship.position.z + 0.48;
    const trailSpeed = speed * 60;
    while (engineEmitTimer > EMIT_INTERVAL) {
      engineEmitTimer -= EMIT_INTERVAL;
      const jx = (Math.random() - 0.5) * 0.06;
      const jy = (Math.random() - 0.5) * 0.06;
      enginePool.spawn(ship.position.x, ship.position.y, engineZ, jx, jy, trailSpeed, ENGINE_COLOR, 0.35);
    }
  }
  enginePool.update(dt / 60);
  if (FX.particleBursts) {
    burstPool.update(dt / 60);
    pickupBurstPool.update(dt / 60);
  }

  // Fast, obvious blink for the duration of post-hit invulnerability so the
  // grace window is felt, not just implied by the shake.
  const elapsedSeconds = elapsed / 60;
  if (state === 'playing' && elapsedSeconds < invulnerableUntil) {
    ship.visible = Math.floor(elapsedSeconds * 14) % 2 === 0;
  } else {
    ship.visible = true;
  }

  // Camera stays close to the tube's central axis (Tunnel Rush keeps a
  // fixed forward view) with only a light parallax nudge toward the ship.
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.x * 0.12, 0.08);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, player.y * 0.12, 0.08);
  camera.lookAt(player.x * 0.05, player.y * 0.05, PLAYER_Z - 10);

  // Speed-based FOV kick: a wider field of view as speed ramps up reads as
  // "warping faster" for free, no shader needed.
  if (FX.speedFovKick) {
    const speedT = (speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
    const targetFov = CAMERA_FOV + speedT * 8;
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.05);
      camera.updateProjectionMatrix();
    }
  }

  // Screen shake decays each frame; only non-zero right after a crash.
  if (FX.screenShake && shakeIntensity > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shakeIntensity;
    camera.position.y += (Math.random() - 0.5) * shakeIntensity;
    shakeIntensity *= 0.9;
  } else {
    shakeIntensity = 0;
  }

  if (rgbShiftPass) {
    rgbShiftPass.uniforms.amount.value = 0.0008 + (speed / MAX_SPEED) * 0.0025;
  }

  // Light follows the ship's position directly — it swings all the way
  // around the tube, so the light needs to swing with it too.
  keyLight.position.set(player.x * 1.15, player.y * 1.15, PLAYER_Z + 4);

  composer.render();
}

beginCountdown();
tick();
