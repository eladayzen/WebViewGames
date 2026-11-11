// SEWER SHRED — Raphael skates the inside of an endless sewer pipe.
//
// Core loop (left/right lean only): carve around the pipe wall to dodge crates,
// chord pipes and spinning fan bars; surf the slime river for speed and double
// points; chain pizza and near-misses into a combo; swing all the way around
// the pipe for a LOOP. Three hits and you wipe out.
import * as THREE from 'three';
import { R, Track, ZONES, zoneIndex, frameAt, pointAt, wallDir, slimeAngle, slimeHalfWidth, waterAngle, waterHalfWidth, angleDiff } from './track.js';
import { Player, PHYS } from './player.js';
import { Obstacles } from './obstacles.js';
import { Particles, Debris, Streaks } from './fx.js';
import { Audio } from './audio.js';
import { Input } from './input.js';

const TAU = Math.PI * 2;
const LIVES = 3;
// slowed twice on Elad's play (2026-11-11): 21→17→13.5, 44→35→28
const BASE_SPEED = 13.5, TOP_SPEED = 28, RAMP_DIST = 2800;
const FOG = { color: 0x0d1c16, near: 18, far: 150 };

// ── renderer / scene ─────────────────────────────────────────────────────────
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
const scene = new THREE.Scene();
scene.background = new THREE.Color(FOG.color);
scene.fog = new THREE.Fog(FOG.color, FOG.near, FOG.far);
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);

const hemi = new THREE.HemisphereLight(0xcfeee0, 0x4a5a50, 3.2);
scene.add(hemi);
const headLamp = new THREE.PointLight(0xffe0a8, 160, 45, 1.2);   // follows the rider
scene.add(headLamp);
const slimeLight = new THREE.PointLight(0x5fd8e8, 45, 22, 1.5); // the river's glow
scene.add(slimeLight);
const flashLight = new THREE.PointLight(0xffffff, 0, 16, 1.5);  // pickups / hits
scene.add(flashLight);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep the pipe's width on screen in portrait too
  camera.userData.baseFov = w / h < 1 ? 88 : 72;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ── assets ───────────────────────────────────────────────────────────────────
const texLoader = new THREE.TextureLoader();
const loadTex = (u) => new Promise((res, rej) => texLoader.load(u, res, undefined, rej));
const audio = new Audio();
audio.loadMusic('/audio/music.mp3');
const input = new Input(canvas);

let track, player, obstacles, particles, debris, streaks;
const tex = {};

// ── HUD ──────────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const hud = { score: $('score'), dist: $('dist'), lives: $('lives'), combo: $('combo'), comboBar: $('combo-bar').firstElementChild, comboWrap: $('combo-wrap'), slime: $('slime-tag'), popups: $('popups'), countdown: $('countdown') };
const SHELL_SVG = '<svg viewBox="0 0 40 34"><ellipse cx="20" cy="19" rx="18" ry="14" fill="#2f5a1c"/><ellipse cx="20" cy="17" rx="15.5" ry="12" fill="#6f9a33"/><path d="M20 6 L27 12 L24 22 L16 22 L13 12Z" fill="#8fbf44" stroke="#2f5a1c" stroke-width="1.6"/><path d="M13 12 L5 15 M27 12 L35 15 M16 22 L11 29 M24 22 L29 29 M20 6 V3" stroke="#2f5a1c" stroke-width="1.6"/><rect x="2" y="13" width="36" height="5" rx="2.5" fill="#d9362b"/></svg>';
function renderLives(n, flashIdx = -1) {
  hud.lives.innerHTML = '';
  for (let i = 0; i < LIVES; i++) {
    const d = document.createElement('div');
    d.className = 'life' + (i < n ? '' : ' lost') + (i === flashIdx ? ' pop' : '');
    d.innerHTML = SHELL_SVG;
    hud.lives.appendChild(d);
  }
}

const _proj = new THREE.Vector3();
function popup(text, cls = '', worldPos = null, dy = 0) {
  const el = document.createElement('div');
  el.className = 'popup ' + cls;
  el.textContent = text;
  let x = window.innerWidth / 2, y = window.innerHeight * 0.55;
  if (worldPos) {
    _proj.copy(worldPos).project(camera);
    x = (_proj.x * 0.5 + 0.5) * window.innerWidth;
    y = (-_proj.y * 0.5 + 0.5) * window.innerHeight;
  }
  el.style.left = x + 'px';
  el.style.top = y + dy + 'px';
  hud.popups.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}
function bigText(text, cls = '') {
  const el = document.createElement('div');
  el.className = 'bigtext ' + cls;
  el.textContent = text;
  hud.popups.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
function flash(color, strength = 0.6) {
  const el = $('flash');
  el.style.transition = 'none';
  el.style.background = color;
  el.style.opacity = strength;
  requestAnimationFrame(() => { el.style.transition = 'opacity 0.35s ease-out'; el.style.opacity = 0; });
}

// ── game state ───────────────────────────────────────────────────────────────
const G = {
  state: 'loading', t: 0, score: 0, lives: LIVES, combo: 1, comboFill: 0, bestCombo: 1, pizza: 0,
  shake: 0, hitStop: 0, fovKick: 0, camTheta: 0, camRoll: 0, slimeOn: false, slimeT: 0,
  loopAnchor: 0, wallT: 0, wallAwarded: 0, countdown: 0, overT: 0, restartHold: 0, lastBeep: -1,
};
const camF = frameAt(0), lookF = frameAt(0);
const _zc = new THREE.Color();
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
const C_SLIME = new THREE.Color(0.45, 1.0, 0.3), C_SPARK = new THREE.Color(1.0, 0.65, 0.25),
  C_PIZZA = new THREE.Color(1.0, 0.75, 0.2), C_HIT = new THREE.Color(1.0, 0.3, 0.2), C_SHIELD = new THREE.Color(0.4, 0.8, 1.0),
  C_DUST = new THREE.Color(0.45, 0.5, 0.45), C_WHITE = new THREE.Color(1, 1, 1),
  C_WATER = new THREE.Color(0.55, 0.85, 1.0), C_FOAM = new THREE.Color(0.85, 0.97, 1.0),
  C_SLIME_FOAM = new THREE.Color(0.8, 1.0, 0.6),
  C_KICK = new THREE.Color(1.0, 0.8, 0.35), C_FOOT = new THREE.Color(0.75, 0.35, 1.0);

function difficulty() { return THREE.MathUtils.clamp(player.s / RAMP_DIST, 0, 1); }

function startRun() {
  G.state = 'countdown';
  G.countdown = 3.2; G.lastBeep = -1;
  G.score = 0; G.lives = LIVES; G.combo = 1; G.comboFill = 0; G.bestCombo = 1; G.pizza = 0;
  G.shake = 0; G.hitStop = 0; G.fovKick = 0; G.camTheta = 0; G.camRoll = 0; G.loopAnchor = 0; G.wallT = 0;
  G.overT = 0; G.restartHold = 0; G.zone = undefined; G.dirTarget = 0; G.waterOn = false; G.slimeOn = false;
  player.reset();
  player.speed = 8;
  track.reset();
  obstacles.reset();
  particles.clear(); debris.clear();
  renderLives(G.lives);
  hud.popups.innerHTML = '';
  $('gameover-overlay').classList.add('hidden');
  audio.muffle(false);
  audio.startMusic();
}

function gameOver() {
  G.state = 'over';
  const best = readBest();
  const score = Math.floor(G.score);
  const isBest = score > best;
  if (isBest) writeBest(score);
  $('go-score').textContent = score.toLocaleString();
  $('go-dist').textContent = Math.floor(player.s) + ' m';
  $('go-pizza').textContent = G.pizza;
  $('go-combo').textContent = 'x' + G.bestCombo;
  $('go-best').textContent = isBest ? 'NEW BEST!' : 'Best ' + Math.max(best, score).toLocaleString();
  $('go-best').className = 'go-best' + (isBest ? ' new' : '');
  $('gameover-overlay').classList.remove('hidden');
}
function readBest() { try { return +localStorage.getItem('sewershred.best') || 0; } catch { return 0; } }
function writeBest(v) { try { localStorage.setItem('sewershred.best', String(v)); } catch { /* private mode */ } }

$('restart-button').addEventListener('click', () => { if (G.state === 'over') startRun(); });

// ── movement modes ───────────────────────────────────────────────────────────
// SWING: lean is a force, gravity pulls you back to the floor (half-pipe feel).
// DIRECT: no gravity. On the board, lean angle = position on the wall
//   (lean right 50% → halfway up the right wall; stand straight → floor).
//   On keys / drag there's no absolute lean to read, so holding a direction
//   moves you around the pipe and letting go leaves you where you are.
const DIRECT_RANGE = 2.5;     // radians of wall reachable at full board lean
const DIRECT_RATE = 2.6;      // rad/s around the pipe while a key is held
G.moveMode = 'swing';
function steer(dt, lean) {
  if (G.moveMode === 'swing') { player.step(dt, lean); return; }
  if (window.__gbSensor && typeof window.__leanOverride !== 'number') {
    G.dirTarget = Math.round(player.theta / TAU) * TAU + lean * DIRECT_RANGE;
  } else {
    G.dirTarget += lean * DIRECT_RATE * dt;
  }
  player.stepDirect(dt, G.dirTarget);
}
function setMoveMode(m) {
  G.moveMode = m;
  G.dirTarget = player ? player.theta : 0;
  $('mode-btn').textContent = m === 'swing' ? 'SWING' : 'DIRECT';
  $('mode-btn').classList.toggle('direct', m === 'direct');
  try { localStorage.setItem('sewershred.move', m); } catch { /* private mode */ }
}
$('mode-btn').addEventListener('click', (e) => { e.stopPropagation(); setMoveMode(G.moveMode === 'swing' ? 'direct' : 'swing'); });
window.addEventListener('keydown', (e) => { if (e.code === 'KeyG') setMoveMode(G.moveMode === 'swing' ? 'direct' : 'swing'); });
{
  let m = new URLSearchParams(location.search).get('move');
  if (!m) { try { m = localStorage.getItem('sewershred.move'); } catch { /* private mode */ } }
  setMoveMode(m === 'direct' ? 'direct' : 'swing');
}

// ── pause / mute ─────────────────────────────────────────────────────────────
G.paused = false;
function setPaused(p) {
  if (p && !(G.state === 'play' || G.state === 'countdown')) return;
  G.paused = p;
  G.resumeHold = 0;
  G.pausedAt = performance.now();
  $('pause-overlay').classList.toggle('hidden', !p);
  audio.setPaused(p);
}
function setMuted(m) {
  audio.setMuted(m);
  $('mute-btn').classList.toggle('muted', m);
  try { localStorage.setItem('sewershred.muted', m ? '1' : '0'); } catch { /* private mode */ }
}
$('pause-btn').addEventListener('click', (e) => { e.stopPropagation(); setPaused(!G.paused); });
$('resume-button').addEventListener('click', () => setPaused(false));
$('mute-btn').addEventListener('click', (e) => { e.stopPropagation(); setMuted(!audio.muted); });
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP') setPaused(!G.paused);
  if (e.code === 'KeyM') setMuted(!audio.muted);
});
try { setMuted(localStorage.getItem('sewershred.muted') === '1'); } catch { /* private mode */ }

// ── scoring / combo ──────────────────────────────────────────────────────────
function addCombo(amount) {
  G.comboFill += amount;
  while (G.comboFill >= 1 && G.combo < 8) {
    G.comboFill -= 1;
    G.combo++;
    G.bestCombo = Math.max(G.bestCombo, G.combo);
    hud.comboWrap.classList.remove('bump'); void hud.comboWrap.offsetWidth; hud.comboWrap.classList.add('bump');
    if (G.combo >= 3) popup('COMBO x' + G.combo, 'combo', null, -90);
  }
  if (G.combo >= 8) G.comboFill = Math.min(G.comboFill, 1);
  G.comboDecay = 3.5;
}
function award(pts, worldPos = null, cls = 'pts') {
  const v = Math.round(pts * G.combo);
  G.score += v;
  if (worldPos) popup('+' + v, cls, worldPos, -40);
  hud.score.classList.remove('tick'); void hud.score.offsetWidth; hud.score.classList.add('tick');
}

// ── water: a big splash on the way in ────────────────────────────────────────
function splashIn(cMain = C_WATER, cFoam = C_FOAM) {
  const f = frameAt(player.s);
  const up = wallDir(f, player.theta, new THREE.Vector3()).negate();
  const p = player.boardWorld(new THREE.Vector3());
  particles.burst(p, up, 34, cMain, { speed: 9, spread: 0.9, size: 0.38, life: 0.75, grav: up.clone().multiplyScalar(-18), drag: 0.7 });
  particles.burst(p, up, 16, cFoam, { speed: 5, spread: 1.4, size: 0.7, life: 0.45, drag: 2.5 });
  audio.splash(); audio.noiseHit({ dur: 0.25, vol: 0.3, freq: 1800, q: 1.2, sweep: 0.5 });
  G.shake = Math.max(G.shake, 0.18);
  G.fovKick = Math.max(G.fovKick, 3);
}

// ── events from the obstacle field ───────────────────────────────────────────
function onEvent(e) {
  const o = e.o;
  const wp = o.mesh.position;
  const f = frameAt(o.s);
  const up = wallDir(f, o.theta, tmpA).negate().clone();
  switch (e.type) {
    case 'pizza': {
      G.pizza++;
      award(25, wp, 'pts');
      addCombo(0.34);
      audio.pizza(G.combo + G.comboFill * 3);
      particles.burst(wp, up, 22, C_PIZZA, { speed: 7, spread: 1.1, size: 0.35, life: 0.55, drag: 3 });
      flashLight.position.copy(wp); flashLight.color.set(0xffb340); flashLight.intensity = 60;
      break;
    }
    case 'shield': {
      player.shieldOn = true; player.shield.visible = true;
      audio.shield();
      bigText('SHELL SHIELD!', 'shield');
      particles.burst(wp, up, 50, C_SHIELD, { speed: 10, spread: 1.6, size: 0.4, life: 0.8, drag: 2 });
      player.trickSpin = TAU;
      flash('rgba(120,200,255,0.9)', 0.35);
      G.fovKick = 10;
      break;
    }
    case 'near': {
      award(40, player.root.position, 'near');
      popup('CLOSE!', 'near-word', player.root.position, -80);
      addCombo(0.5);
      audio.near();
      G.fovKick = Math.max(G.fovKick, 5);
      break;
    }
    case 'land': {
      const d = Math.abs(o.s - player.s);
      G.shake = Math.max(G.shake, Math.max(0, 0.35 - d * 0.006));
      particles.burst(wp, up, 18, C_DUST, { speed: 4, spread: 1.5, size: 0.9, life: 0.7, drag: 2.5 });
      audio.land();
      break;
    }
    case 'hit': onHit(o, up, wp); break;
    case 'enemy': onKick(o, up, wp); break;
  }
}

// ── enemies: the spin flip kick ──────────────────────────────────────────────
// The ONLY place the Spin Flip Kick clip plays. Enemies never hurt you —
// riding into one IS the attack.
const KICK_WORDS = ['HI-YAH!', 'COWABUNGA!', 'BOOYAKASHA!', 'KICK!', 'SHELL SHOCK!'];
function onKick(o, up, wp) {
  player.playKick();
  obstacles.launch(o, player.speed);
  G.kicks = (G.kicks || 0) + 1;
  award(150, wp, 'pts');
  addCombo(0.6);
  popup(KICK_WORDS[Math.floor(Math.random() * KICK_WORDS.length)], 'kick-word', wp, -70);
  audio.kick();
  // no hit-stop and no speed change: a kick never costs you momentum
  G.shake = Math.max(G.shake, 0.4); G.fovKick = Math.max(G.fovKick, 6);
  flash('rgba(255,210,120,0.9)', 0.3);
  flashLight.position.copy(wp); flashLight.color.set(0xff9a3c); flashLight.intensity = 90;
  // impact star: hot core + purple shards
  particles.burst(wp.clone().addScaledVector(up, 1.0), up, 26, C_KICK, { speed: 12, spread: 1.6, size: 0.45, life: 0.4, drag: 3 });
  particles.burst(wp.clone().addScaledVector(up, 1.0), up, 18, C_FOOT, { speed: 9, spread: 1.2, size: 0.3, life: 0.7, drag: 1.5 });
}

function onHit(o, up, wp) {
  if (player.invuln > 0 && !player.shieldOn) return;
  const fwd = frameAt(o.s).T.clone();
  if (o.type === 'crate') { debris.explode(wp, up, fwd, 14, 1); o.mesh.visible = false; }
  if (o.type === 'saw') particles.burst(wp.clone().addScaledVector(up, 0.6), up, 40, C_SPARK, { speed: 13, spread: 1.4, size: 0.22, life: 0.5, grav: up.clone().multiplyScalar(-20), drag: 0.6 });
  if (player.shieldOn) {
    // shield eats the hit — and the crate
    player.shieldOn = false;
    player.invuln = 0.9;
    audio.shieldPop(); if (o.type === 'crate' || o.type === 'saw') audio.smash();
    player.play('kick', 0.08, 1.8);
    bigText('SMASH!', 'smash');
    award(60, wp, 'pts');
    particles.burst(player.root.position, up, 40, C_SHIELD, { speed: 12, spread: 1.6, size: 0.45, life: 0.6 });
    G.shake = 0.5; G.hitStop = 0.06;
    flash('rgba(140,220,255,0.9)', 0.4);
    if (o.type === 'crate' || o.type === 'saw') o.done = true;  // the shield wrecks it
    return;
  }
  G.lives--;
  renderLives(G.lives, G.lives);
  G.combo = 1; G.comboFill = 0;
  player.invuln = 1.8;
  player.shield.visible = true;  // the "stunned" bubble, like the reference
  player.speed *= 0.82;   // a stumble, not a stop
  // knocked away from what you hit
  const side = Math.sign(angleDiff(player.theta, o.theta)) || (Math.random() < 0.5 ? -1 : 1);
  player.omega = side * 3.2;
  audio.hit(); if (o.type === 'crate') audio.smash(); if (o.type === 'saw') audio.saw();
  G.shake = 1.0; G.hitStop = 0.11;
  flash('rgba(255,60,40,0.9)', 0.55);
  $('vignette').classList.remove('hurt'); void $('vignette').offsetWidth; $('vignette').classList.add('hurt');
  particles.burst(player.root.position, up, 40, C_HIT, { speed: 10, spread: 1.4, size: 0.4, life: 0.5 });
  particles.burst(player.root.position, up, 25, C_WHITE, { speed: 14, spread: 1.0, size: 0.25, life: 0.35 });
  if (o.type === 'crate') o.done = true;
  if (G.lives <= 0) {
    G.state = 'dying'; G.overT = 0;
    player.dead = true;
    player.play('spin', 0.1, 1.4);
    audio.over();
    bigText('WIPEOUT!', 'wipe');
  } else {
    bigText(G.lives === 1 ? 'LAST SHELL!' : 'OUCH!', 'ouch');
  }
}

// ── the frame ────────────────────────────────────────────────────────────────
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.state === 'loading') return;
  if (G.paused) {
    // resume: Space/Enter (Unity forwards those), a tap, or a held lean —
    // after a short grace so the press that paused doesn't instantly resume
    const lean = input.read(dt);
    const pressed = input.consumePress();
    if (performance.now() - G.pausedAt > 400) {
      if (Math.abs(lean) > 0.7) G.resumeHold += dt; else G.resumeHold = 0;
      if (pressed || G.resumeHold > 0.6) setPaused(false);
    }
    return;
  }
  G.t += dt;
  const time = G.t;

  // hit-stop: the world freezes for a beat, the camera keeps shaking
  let simDt = dt;
  if (G.hitStop > 0) { G.hitStop -= dt; simDt = dt * 0.05; }

  const lean = input.read(dt);
  const pressed = input.consumePress();
  const diff = difficulty();

  if (G.state === 'countdown') {
    G.countdown -= dt;
    const n = Math.ceil(G.countdown - 0.2);
    if (n !== G.lastBeep && n >= 0) {
      G.lastBeep = n;
      hud.countdown.textContent = n > 0 ? n : 'SHRED!';
      hud.countdown.className = 'show' + (n > 0 ? '' : ' go');
      void hud.countdown.offsetWidth;
      audio.beep(n === 0);
      if (n === 0) { player.play('push', 0.15, 1.3); G.fovKick = 12; }
    }
    player.speed += (BASE_SPEED * 0.5 - player.speed) * dt;
    steer(simDt, lean * 0.6);
    if (G.countdown <= -0.3) { G.state = 'play'; hud.countdown.className = ''; }
  } else if (G.state === 'play') {
    // speed: ramps with distance, the slime river adds a surge
    const sAng = slimeAngle(player.s), sHalf = slimeHalfWidth(player.s);
    const inSlime = Math.abs(angleDiff(player.theta, sAng)) < sHalf;
    const wHalf = waterHalfWidth(player.s);
    const inWater = !inSlime && wHalf > 0.05 && Math.abs(angleDiff(player.theta, waterAngle(player.s))) < wHalf;
    if (inWater && !G.waterOn) splashIn(C_WATER, C_FOAM);
    G.waterOn = inWater;
    if (inSlime !== G.slimeOn) {
      G.slimeOn = inSlime;
      // the river is the floor now: a brief tag on the way in, not a constant banner
      if (inSlime) { hud.slime.classList.add('on'); clearTimeout(G.slimeTagT); G.slimeTagT = setTimeout(() => hud.slime.classList.remove('on'), 900); }
      if (inSlime) splashIn(C_WATER, C_FOAM);
    }
    // river is cosmetic (splash + spray) — no speed or score modifier, since
    // gravity keeps you in it whenever you're not leaning
    const target = THREE.MathUtils.lerp(BASE_SPEED, TOP_SPEED, diff);
    player.speed += (target - player.speed) * Math.min(1, simDt * (player.speed < target ? 0.9 : 1.6));
    steer(simDt, lean);
    const ds = player.speed * simDt;
    G.score += ds * 0.5 * G.combo;
    if (inSlime) G.slimeT += simDt;

    // LOOP: carried all the way around the pipe
    if (Math.abs(player.theta - G.loopAnchor) > TAU - 0.25) {
      G.loopAnchor += Math.sign(player.theta - G.loopAnchor) * TAU;
      bigText('LOOP!', 'loop');
      award(400, null);
      addCombo(1);
      audio.trick();
      player.trickSpin = Math.sign(player.omega || 1) * TAU;
      G.fovKick = 12; G.shake = 0.3;
      flash('rgba(160,255,120,0.9)', 0.3);
    }
    // back on the floor without completing it — re-anchor
    if (Math.abs(angleDiff(player.theta, 0)) < 0.3 && Math.abs(player.theta - G.loopAnchor) < Math.PI) {
      G.loopAnchor = Math.round(player.theta / TAU) * TAU;
    }
    // WALL RIDE: holding high on the wall
    const height = Math.abs(angleDiff(player.theta, 0));
    if (height > 1.35) {
      G.wallT += simDt;
      if (G.wallT > 0.7 && G.wallT - G.wallAwarded >= 0.7) {
        G.wallAwarded = G.wallT;
        award(30, player.root.position, 'wall');
        if (G.wallT < 1.45) popup('WALL RIDE', 'wall-word', player.root.position, -90);
        addCombo(0.2);
      }
    } else { G.wallT = 0; G.wallAwarded = 0; }

    // combo decays when you stop feeding it
    if (G.combo > 1) {
      G.comboDecay -= simDt;
      if (G.comboDecay < 0) { G.comboFill -= simDt * 0.35; if (G.comboFill < 0) { G.combo--; G.comboFill = 0.95; G.comboDecay = 1.2; } }
    }

    obstacles.spawn(player.s, diff, player.theta);
  } else if (G.state === 'dying') {
    G.overT += dt;
    player.speed *= Math.pow(0.25, dt);
    player.step(simDt, 0);
    player.bank.rotation.z += dt * 7 * Math.max(0, 1 - G.overT);
    if (G.overT > 1.4) gameOver();
  } else if (G.state === 'over') {
    G.overT += dt;
    player.speed *= Math.pow(0.3, dt);
    player.step(simDt, 0);
    // restart with Space/Enter (Unity clicks #restart-button for those) or a held lean
    if (G.overT > 1.0) {
      if (Math.abs(lean) > 0.7) G.restartHold += dt; else G.restartHold = 0;
      if (G.restartHold > 0.6 || (pressed && G.overT > 1.2)) startRun();
    }
  }

  player.place();
  player.animate(simDt, time);

  const events = [];
  if (G.state === 'play' || G.state === 'countdown') obstacles.update(simDt, time, player, events);
  else obstacles.update(simDt, time, { s: player.s, theta: 1e3, hop: 0 }, events);
  for (const e of events) onEvent(e);

  // ── continuous FX ──
  const f = frameAt(player.s);
  const wallUp = wallDir(f, player.theta, tmpA).negate();
  const boardP = player.boardWorld(tmpB);
  if (G.state === 'play') {
    const back = tmpC.copy(f.T).multiplyScalar(-1);
    if (G.waterOn || G.slimeOn) {
      const cA = C_WATER, cB = C_FOAM;
      // twin spray sheets peeling off both rails + droplets kicked up behind
      const n = 2 + Math.floor(player.speed / 14);
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        particles.emit(boardP.clone().addScaledVector(f.Rt, side * 0.25),
          f.Rt.clone().multiplyScalar(side * (3 + Math.random() * 3)).addScaledVector(wallUp, 3 + Math.random() * 3.5).addScaledVector(back, 2 + Math.random() * 3),
          Math.random() < 0.35 ? cB : cA, { size: 0.22 + Math.random() * 0.22, life: 0.55, grav: wallUp.clone().multiplyScalar(-16), drag: 0.8 });
      }
      particles.emit(boardP.clone().addScaledVector(f.T, -0.5), back.clone().multiplyScalar(2).addScaledVector(wallUp, 1 + Math.random()), cB, { size: 0.55, life: 0.4, drag: 3 });
    } else if (G.slimeOn) {
      // slime rooster-tail off the tail of the board
      for (let i = 0; i < 3; i++) {
        particles.emit(boardP.clone().addScaledVector(f.T, -0.4),
          back.clone().multiplyScalar(4 + Math.random() * 4).addScaledVector(wallUp, 3 + Math.random() * 4).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(3)),
          C_SLIME, { size: 0.28 + Math.random() * 0.25, life: 0.5, grav: wallUp.clone().multiplyScalar(-14), drag: 1 });
      }
    } else if (Math.abs(player.omega) > 1.6 && Math.random() < 0.8) {
      // hard carve: wheels throw sparks off the iron plates
      const side = f.Rt.clone().multiplyScalar(-Math.sign(player.omega));
      particles.emit(boardP, back.clone().multiplyScalar(5).addScaledVector(side, 3).addScaledVector(wallUp, 2 + Math.random() * 2), C_SPARK, { size: 0.16, life: 0.35, grav: wallUp.clone().multiplyScalar(-18), drag: 0.5 });
    }
  }
  particles.update(dt);
  debris.update(simDt);
  const speedN = THREE.MathUtils.clamp((player.speed - BASE_SPEED) / (TOP_SPEED - BASE_SPEED), 0, 1);
  streaks.update(player.s, player.speed, frameAt, pointAt, R, G.state === 'play' ? 0.08 + speedN * 0.25 : 0);
  track.update(player.s, simDt, time, player.speed);

  // ── zones: banner on entry, fog + ambient ease to the zone's palette ──
  const zi = zoneIndex(player.s);
  if (zi !== G.zone) {
    if (G.zone !== undefined && G.state === 'play') { bigText(ZONES[zi].name, 'zone'); audio.trick(); }
    G.zone = zi;
  }
  const Z = ZONES[zi];
  const ease = Math.min(1, dt * 1.2);
  scene.fog.color.lerp(_zc.set(Z.fog), ease);
  scene.background.copy(scene.fog.color);
  hemi.color.lerp(_zc.set(Z.hemi[0]), ease);
  hemi.groundColor.lerp(_zc.set(Z.hemi[1]), ease);
  track.syncFog(scene.fog);

  // lights ride with the rider
  pointAt(player.s + 6, player.theta, R - 3.2, headLamp.position);
  pointAt(player.s + 10, slimeAngle(player.s + 10), R - 0.8, slimeLight.position);
  slimeLight.intensity = 35 + Math.sin(time * 3) * 8 + (G.slimeOn ? 25 : 0);
  flashLight.intensity *= Math.pow(0.004, dt);

  // ── camera ──
  // Rolls with the rider so "down" is always under his feet (he stays at the
  // bottom of the screen and the sewer spins around him), lagging just enough
  // that you feel the swing.
  G.camTheta += angleDiff(player.theta, G.camTheta) * Math.min(1, dt * 7);
  const camS = player.s - 4.8;
  frameAt(camS, camF);
  const camDir = wallDir(camF, G.camTheta, tmpA);
  camera.position.copy(camF.C).addScaledVector(camDir, R - 3.15);
  frameAt(player.s + 10, lookF);
  const lookDir = wallDir(lookF, G.camTheta, tmpB);
  const look = tmpC.copy(lookF.C).addScaledVector(lookDir, R - 1.9);
  // dutch tilt with the carve
  G.camRoll += (-player.omega * 0.045 - G.camRoll) * Math.min(1, dt * 5);
  const upV = wallDir(camF, G.camTheta + G.camRoll, new THREE.Vector3()).negate();
  camera.up.copy(upV);
  if (G.shake > 0) {
    const k = G.shake * G.shake * 0.55;
    camera.position.add(new THREE.Vector3((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k));
    G.shake = Math.max(0, G.shake - dt * 2.4);
  }
  camera.lookAt(look);
  G.fovKick *= Math.pow(0.05, dt);
  const fov = camera.userData.baseFov + speedN * 8 + G.fovKick;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); }

  audio.ride(player.speed, G.slimeOn, G.state === 'play' || G.state === 'countdown', G.waterOn && G.state === 'play');

  // ── HUD ──
  hud.score.textContent = Math.floor(G.score).toLocaleString();
  hud.dist.textContent = Math.floor(player.s) + ' m';
  hud.combo.textContent = 'x' + G.combo;
  hud.comboBar.style.transform = `scaleX(${G.combo >= 8 ? 1 : G.comboFill})`;
  hud.comboWrap.classList.toggle('hot', G.combo >= 4);
  $('speedlines').style.opacity = G.state === 'play' ? (speedN * 0.5).toFixed(2) : 0;

  renderer.render(scene, camera);
}

async function loadFootGeo(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const dv = new DataView(buf);
  const vc = dv.getUint32(0, true), ic = dv.getUint32(4, true);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, 8, vc * 3), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(buf, 8 + vc * 12, ic), 1));
  geo.computeVertexNormals();
  return geo;
}

// ── boot ─────────────────────────────────────────────────────────────────────
(async function boot() {
  const names = ['wall', 'slime', 'graffiti', 'crate', 'pipe', 'water', 'wall_rust_patina', 'wall_pat_a', 'wall_rust_hazard', 'wall_pat_c'];
  const loaded = await Promise.all(names.map((n) => loadTex(`/tex/${n}.jpg`)));
  names.forEach((n, i) => (tex[n.replace('wall_', '')] = loaded[i]));
  tex.footGeo = await loadFootGeo('/models/foot.bin');
  track = new Track(scene, tex);
  track.syncFog(scene.fog);
  obstacles = new Obstacles(scene, tex);
  particles = new Particles(scene);
  debris = new Debris(scene, tex);
  streaks = new Streaks(scene);
  player = new Player(scene);
  await player.load('/models/raphael.glb', '/models/clips.json');
  renderLives(LIVES);
  $('loading').classList.add('gone');
  startRun();
  requestAnimationFrame(frame);
  // test hooks for the headless drive script
  window.__game = { G, player, obstacles, PHYS, camera, startRun };
})();
