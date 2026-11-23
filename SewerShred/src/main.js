// SEWER SHRED — Raphael skates the inside of an endless sewer pipe.
//
// Core loop (left/right lean only): carve around the pipe wall to dodge crates,
// chord pipes and spinning fan bars; surf the slime river for speed and double
// points; chain pizza and near-misses into a combo; swing all the way around
// the pipe for a LOOP. Three hits and you wipe out.
import * as THREE from 'three';
import { Trains } from './trains.js';
import { Daggers } from './daggers.js';
import { City, CITY_FOG, CITY_HEMI } from './city.js';
import { LEVELS, setWeaponIcon, showCard, cardUp, cardPress, showClear, clearUp, clearPress, renderGoal, loadProgress, saveProgress } from './levels.js';
import { installDevUnlock } from './devUnlock.js';
import { R, Track, ZONES, WORLDS, zoneIndex, setStartWorld, getStartWorld, featureAt, pendingFork, forkNear, forkSpread, FORK_LEN, FORKS, CLIMB_LEN, makeGlowTexture, frameAt, pointAt, wallDir, slimeAngle, slimeHalfWidth, waterAngle, waterHalfWidth, angleDiff } from './track.js';
import { Junctions } from './junctions.js';
import { Player, PHYS } from './player.js';
import { Obstacles, FOOT_STYLES, FOOT_STYLE_ORDER, KICK_POP } from './obstacles.js';
import { Particles, Debris, Streaks, BoardTrail } from './fx.js';
import { Audio } from './audio.js';
import { Input } from './input.js';

const TAU = Math.PI * 2;
const LIVES = 3;
// slowed twice on Elad's play (2026-11-11): 21→17→13.5, 44→35→28
const BASE_SPEED = 13.5, TOP_SPEED = 28, RAMP_DIST = 2800;
const FOG = { color: 0x4a5860, near: 30, far: 200 };   // look test: blue-grey, not black

// ── renderer / scene ─────────────────────────────────────────────────────────
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));   // perf: 1.5 is plenty on phones
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;   // look test: flats stay flat
renderer.toneMappingExposure = 0.85;
const scene = new THREE.Scene();
scene.background = new THREE.Color(FOG.color);
scene.fog = new THREE.Fog(FOG.color, FOG.near, FOG.far);
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);

const hemi = new THREE.HemisphereLight(0xf2f6f6, 0x6e7876, 3.0);
scene.add(hemi);
const headLamp = new THREE.PointLight(0xfff2dc, 70, 60, 1.0);   // follows the rider
scene.add(headLamp);
const slimeLight = new THREE.PointLight(0xa8c080, 6, 22, 1.5); // a murky bounce off the sewage (was a cyan water glow)
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

let city, track, junctions, trains, daggers, player, obstacles, particles, debris, streaks, boardTrail, sludge;
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
  // keep words off the rider (Elad 2026-11-16: "the texts are hiding the actual animation"):
  // anything that would land on his column of the screen is pushed out to the side
  if (player) {
    _proj.copy(player.root.position).project(camera);
    const rx = (_proj.x * 0.5 + 0.5) * window.innerWidth, W = window.innerWidth;
    const clearW = Math.max(150, W * 0.17);
    if (Math.abs(x - rx) < clearW) {
      const side = x !== rx ? Math.sign(x - rx) : ((G.popSide = -(G.popSide || 1)));
      x = rx + side * clearW * 1.25;
    }
    x = Math.min(W - 90, Math.max(90, x));
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
const _wl = new THREE.Vector3(), _wr = new THREE.Vector3(), _ws = new THREE.Vector3(), _wb = new THREE.Vector3();
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3(), tmpE = new THREE.Vector3();
const C_SLIME = new THREE.Color(0.45, 1.0, 0.3), C_SPARK = new THREE.Color(1.0, 0.65, 0.25),
  C_PIZZA = new THREE.Color(1.0, 0.75, 0.2), C_HIT = new THREE.Color(1.0, 0.3, 0.2), C_SHIELD = new THREE.Color(0.4, 0.8, 1.0),
  C_DUST = new THREE.Color(0.45, 0.5, 0.45), C_WHITE = new THREE.Color(1, 1, 1),
  C_WATER = new THREE.Color(0.55, 0.85, 1.0), C_FOAM = new THREE.Color(0.85, 0.97, 1.0),
  C_SLIME_FOAM = new THREE.Color(0.8, 1.0, 0.6),
  // BAL-646 sewage: muddy body + paler scum, drawn with normal blending (sludge system)
  // look test: the river throws white/cyan cartoon splash (ref '55'), not dark gunk
  C_SEWAGE = new THREE.Color(0.72, 0.9, 1.0), C_SCUM = new THREE.Color(1.0, 1.0, 1.0),
  C_KICK = new THREE.Color(1.0, 0.8, 0.35), C_FOOT = new THREE.Color(0.75, 0.35, 1.0);

function difficulty() { return THREE.MathUtils.clamp(player.s / RAMP_DIST, 0, 1); }

const _foeCol = new THREE.Color();
const C_JFOAM = new THREE.Color(0.8, 0.92, 1.0), C_JSPRAY = new THREE.Color(0.45, 0.6, 0.7);   // look test: light splash
// ── the hero (Elad 2026-11-22: "make this into Michelangelo — orange ribbons, nunchucks") ──
// Same rigged model and clips; MIKEY = the texture with the red cloth recoloured orange
// (tex/mikey_skin.jpg) + nunchucks for the weapon power-up. ?hero=raph brings Raph back.
const HEROES = {
  // Elad 2026-11-22: ninja stars, not nunchucks — they don't come back (see RETURNS in daggers.js)
  mikey: { skin: '/tex/mikey_skin.jpg', weapon: 'star', icon: '/tex/star_icon.png', word: 'NINJA STARS!' },
  raph: { skin: null, weapon: 'sai', icon: '/tex/sai_icon.png', word: 'SAI STORM!' },
};
const HERO = HEROES[new URLSearchParams(location.search).get('hero')] || HEROES.mikey;
setWeaponIcon(HERO.icon);
$('power').querySelector('img').src = HERO.icon;

// ── the level loop (levels.js) ──
G.level = 0;
G.topOverride = null;   // dev: TOP button / ?top=open beat the level's own setting
function levelGoalHave() {
  const g = LEVELS[G.level].goal;
  return g.type === 'pizza' ? G.pizza : g.type === 'air' ? G.airPizza : g.type === 'ko' ? (G.kicks || 0) : player.s;
}
/** Start level i; with `card`, its one-step card first (a retry after a wipeout skips it). */
async function startLevel(i, card = true) {
  G.level = i;
  startRun();
  if (!card) return;
  G.state = 'card'; G.cardHold = 0;
  await showCard(LEVELS[i]);
  if (G.state === 'card') { G.state = 'countdown'; G.countdown = 3.2; G.lastBeep = -1; }
}
async function levelClear() {
  G.state = 'clear';
  const last = G.level === LEVELS.length - 1;
  audio.trick();
  flash('rgba(255,240,160,0.9)', 0.5); G.fovKick = 12;
  if (Math.floor(G.score) > readBest()) writeBest(Math.floor(G.score));
  gb()?.submitScore?.(Math.floor(G.score))?.catch?.(() => {});
  const nextLv = last ? Math.max(0, LEVELS.findIndex((L) => L.key === 'sewers')) : G.level + 1;   // after the last: back to the sewers (the two trainings are once)
  saveProgress(nextLv);
  await new Promise((r) => setTimeout(r, 900));
  await showClear(last);
  startLevel(nextLv, true);
}

function startRun() {
  junctions?.reset();
  city?.reset();
  {
    const L = LEVELS[G.level];
    setOpenTop(G.topOverride ?? L.open);
    obstacles.deckMode = L.deck;
    obstacles.firstPickup = L.unlock || null;
    obstacles.allowPick = L.pickups || null;
    G.airPizza = 0; G.kicks = 0;
    // the level's world (sewers / dojo); ?world= still overrides for dev
    const wi = WORLDS.findIndex((w) => w.key === (G.worldOverride || L.world || 'sewers'));
    setStartWorld(Math.max(0, wi));
  }
  G.state = 'countdown';
  G.countdown = 3.2; G.lastBeep = -1;
  G.score = 0; G.lives = LIVES; G.combo = 1; G.comboFill = 0; G.bestCombo = 1; G.pizza = 0;
  G.shake = 0; G.hitStop = 0; G.fovKick = 0; G.camTheta = 0; G.camRoll = 0; G.loopAnchor = 0; G.wallT = 0;
  G.overT = 0; G.restartHold = 0; G.zone = undefined; $('turn').className = ''; G.dirTarget = 0; G.dirOff = 0; G.waterOn = false; G.slimeOn = false;
  player.reset();
  player.speed = 8;
  track.reset();
  obstacles.reset();
  particles.clear(); sludge.clear(); debris.clear(); boardTrail.clear();
  trains?.reset();
  daggers?.reset(); $('power').classList.remove('on');
  renderLives(G.lives);
  hud.popups.innerHTML = '';
  $('gameover-overlay').classList.add('hidden');
  $('quit-overlay').classList.add('hidden'); closeConfirm();
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
  bankScore(score, 'go-board');
}

// ── GoBalance: every way a run ends banks the score, then shows the board ────
// (GOBALANCE_APP_INTEGRATION.md "a run is whole, or it is nothing"). The SDK is
// injected by the app; in a plain browser window.GoBalance is undefined and the
// boards just stay empty.
const gb = () => (typeof window !== 'undefined' && window.GoBalance && window.GoBalance.available !== false ? window.GoBalance : null);
async function bankScore(score, boardId) {
  const el = $(boardId);
  el.innerHTML = '';
  const sdk = gb();
  if (!sdk) return;
  try { await sdk.submitScore(score); } catch { /* offline: the host keeps a device copy */ }
  let board = null;
  try { board = await sdk.getScoreboard(); } catch { return; }
  // submitScore resolves before the write commits: make sure the run just played is on it
  const rows = (board?.entries || []).map((e) => ({ name: e.name || '?', score: Math.round(e.score), you: !!e.isYou }));
  if (!rows.some((r) => r.you && r.score === score)) {
    let name = rows.find((r) => r.you)?.name || '';
    if (!name) try { name = (await sdk.getProfile())?.name || ''; } catch { /* no profile */ }
    rows.push({ name, score, you: true });
  }
  rows.sort((a, b) => b.score - a.score);
  let mine = rows.findIndex((r) => r.you && r.score === score);
  const top = rows.slice(0, 5);
  if (mine >= 5) top[4] = rows[mine];
  el.innerHTML = top.map((r, i) => {
    const rank = r === rows[mine] ? mine + 1 : i + 1;
    return `<li class="${r === rows[mine] ? 'me' : ''}"><i>${rank}</i><span>${escapeHtml(r.name)}</span><b>${r.score.toLocaleString()}</b></li>`;
  }).join('');
}
const escapeHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const leaveToLobby = () => { if (window.GoBalance?.back) window.GoBalance.back(); else if (window.Unity) window.Unity.call('nav:back'); };

// ── the X: the only way out on the board ─────────────────────────────────────
// Mid-run it asks first (a mis-tap must not end a run); anywhere else it leaves.
let pausedBeforeConfirm = false;
window.__gbBack = () => {
  if (G.confirm) return quitRun();                       // X again on the confirm = yes
  if (G.state !== 'play') return leaveToLobby();          // countdown, death, quit screen: nothing to lose
  pausedBeforeConfirm = G.paused;
  setPaused(true);
  $('pause-overlay').classList.add('hidden');
  G.confirm = true;
  $('quit-confirm').classList.remove('hidden');
};
function closeConfirm() {
  G.confirm = false;
  $('quit-confirm').classList.add('hidden');
}
function quitRun() {
  closeConfirm();
  G.paused = false; audio.setPaused(false); $('pause-overlay').classList.add('hidden');
  G.state = 'quit';
  const score = Math.floor(G.score);
  if (score > readBest()) writeBest(score);
  $('q-score').textContent = score.toLocaleString();
  $('quit-overlay').classList.remove('hidden');
  audio.muffle(true);
  bankScore(score, 'q-board');                           // on the way IN: they may leave from here
}
$('qc-no').addEventListener('click', (e) => {
  e.stopPropagation();
  closeConfirm();
  if (pausedBeforeConfirm) $('pause-overlay').classList.remove('hidden'); else setPaused(false);
});
$('qc-yes').addEventListener('click', (e) => { e.stopPropagation(); quitRun(); });
$('q-again').addEventListener('click', (e) => { e.stopPropagation(); if (G.state === 'quit') { $('quit-overlay').classList.add('hidden'); startRun(); } });
$('q-leave').addEventListener('click', (e) => { e.stopPropagation(); leaveToLobby(); });
function readBest() { try { return +localStorage.getItem('sewershred.best') || 0; } catch { return 0; } }
function writeBest(v) { try { localStorage.setItem('sewershred.best', String(v)); } catch { /* private mode */ } }

$('restart-button').addEventListener('click', () => { if (G.state === 'over') startRun(); });

// ── movement modes ───────────────────────────────────────────────────────────
// SWING: lean is a force, gravity pulls you back to the floor (half-pipe feel).
// DIRECT 360 / 220 / 180 (Elad 2026-11-16 — DIRECT is the default): no
//   physics. Position is an OFFSET from the base — the floor, in the centre of
//   the water (slimeAngle(s)), so the base sways with the river. The number is
//   the total arc you may reach: 180 = ±90° (up to each wall's middle),
//   220 = ±110°, 360 = all the way round (no boundary at all).
//   On the board, lean = position: full lean reaches the boundary (360: the
//   ceiling, ±180°). On keys / drag there's no absolute lean, so holding a
//   direction moves you and letting go leaves you where you are — clamped
//   at the boundary.
// …and each Direct mode has a FIXED-CAMERA twin ('f' suffix, Elad 2026-11-16):
//   the camera never spins or rolls — upright, pulled back toward the pipe's
//   axis so the whole ring stays in view and the rider moves around the screen.
const MODES = ['d360', 'd360f', 'd220', 'd220f', 'd180', 'd180f', 'swing'];
// the deck is ~0.31 m half-wide = 3° at R 6: stop its CENTRE that far short so
// the whole board stays under the 180 seam (Elad 2026-11-22: never above the line)
const BOARD_HALF = 0.31 / 6 + 0.003;
const MODE_HALF = { d360: Math.PI, d220: (220 / 2) * Math.PI / 180, d180: Math.PI / 2 - BOARD_HALF };
for (const k of Object.keys(MODE_HALF)) MODE_HALF[k + 'f'] = MODE_HALF[k];
const fixedCam = () => G.moveMode.endsWith('f');
const loops = () => G.moveMode.startsWith('d360');
// fixed camera: distance behind, offset from the axis toward the floor, look target
// Presets (third button, fixed modes only — Elad 2026-11-16: the low angle
// brings energy but the rider blocks the view when he's in the centre).
//   back: m behind the rider · r: m from the axis toward the floor (negative =
//   toward the ceiling) · side: constant shift to the right · slide: m toward
//   the rider's side of the ring · aim: 0 = look down the pipe, 1 = at him ·
//   lift: raise the look target (m) so he sits lower in frame · fov: extra °
const FIXCAMS = {
  low:  { back: 4.6, r: 2.6, side: 0, ahead: 11, lookR: 1.8, slide: 2.6, aim: 0.9, lift: 0, fov: 6 },
  high: { back: 5.2, r: -1.6, side: 0, ahead: 12, lookR: 2.2, slide: 1.2, aim: 0.55, lift: 0, fov: 6 },
  side: { back: 4.6, r: 2.4, side: 2.2, ahead: 11, lookR: 1.8, slide: 2.0, aim: 0.45, lift: 0.6, fov: 6 },
  // CENTER (Elad 2026-11-16): like LOW but raised ~1.3 m so it looks over his head
  center: { back: 5.0, r: 1.3, side: 0, ahead: 12, lookR: 1.6, slide: 2.2, aim: 0.6, lift: 0.8, fov: 6 },
  wide: { back: 6.4, r: 2.8, side: 0, ahead: 13, lookR: 1.8, slide: 2.0, aim: 0.6, lift: 2.6, fov: 10 },
};
// AUTO (Elad 2026-11-16): dynamic — LOW while the rider is up a wall (he's
// already out of the middle), easing into SIDE as he comes back to the
// centre, shifted to the side opposite his drift so he slides off-centre
// the way he's heading instead of sitting in front of the view.
FIXCAMS.auto = { ...FIXCAMS.low };
// AUTO 2 SIDES (Elad 2026-11-16): always the side angle, on the side
// OPPOSITE the rider — he's on the left, the camera swings to the right, and
// vice versa — so it looks across him at the pipe ahead.
FIXCAMS.auto2 = { ...FIXCAMS.side };
const FIXCAM_ORDER = ['auto', 'auto2', 'center', 'low', 'high', 'side', 'wide'];
G.autoW = 0; G.autoSign = 1; G.autoSignS = 1;
const AUTO_SIDE = 3.4;   // m — further than the SIDE preset, so a centred rider clears the middle
function updateAuto2Cam(dt) {
  const off = angleDiff(player.theta, slimeAngle(player.s));
  // rider left (off < 0) → camera right (+), and vice versa; sticky dead zone
  if (Math.abs(off) > 0.15) G.autoSign = -Math.sign(off);
  G.autoSignS += (G.autoSign - G.autoSignS) * Math.min(1, dt * 2.2);
  FIXCAMS.auto2.side = AUTO_SIDE * G.autoSignS;
}
function updateAutoCam(dt) {
  const off = angleDiff(player.theta, slimeAngle(player.s));
  // weight of SIDE: 1 at the centre, gone by ~60° up the wall
  const t = THREE.MathUtils.smoothstep(Math.abs(off), 0.35, 1.05);
  G.autoW += ((1 - t) - G.autoW) * Math.min(1, dt * 3);
  // which side: away from his drift, sticky inside a dead zone so it never flickers
  if (Math.abs(off) > 0.15) G.autoSign = -Math.sign(off);
  G.autoSignS += (G.autoSign - G.autoSignS) * Math.min(1, dt * 1.8);
  const A = FIXCAMS.low, B = FIXCAMS.side, w = G.autoW, o = FIXCAMS.auto;
  for (const k of Object.keys(A)) o[k] = A[k] + (B[k] - A[k]) * w;
  o.side = AUTO_SIDE * w * G.autoSignS;
}
G.fixCam = 'low';
let FIXCAM = FIXCAMS.low;
const DIRECT_RATE = 2.6;      // rad/s around the pipe while a key is held
G.moveMode = 'd220';
G.dirOff = 0;
function steer(dt, lean) {
  if (G.moveMode === 'swing') { player.step(dt, lean); return; }
  const half = MODE_HALF[G.moveMode], base = slimeAngle(player.s);
  if (window.__gbSensor && typeof window.__leanOverride !== 'number') {
    G.dirOff = lean * half;
  } else {
    G.dirOff += lean * DIRECT_RATE * dt;
  }
  // the limit is ABSOLUTE (±half from the floor, where the 180 seams are
  // painted) — not ±half from the swaying slime line, which let him ride up to
  // 13° over the seam holding a side (measured, tools/drive.mjs --script=edges)
  if (!loops()) G.dirOff = THREE.MathUtils.clamp(G.dirOff, -half - base, half - base);
  // unwrap: keep the target on the same lap as the rider so a 360 loop
  // never spins him back the long way
  const tgt = base + G.dirOff;
  G.dirTarget = tgt + Math.round((player.theta - tgt) / TAU) * TAU;
  if (loops() && Math.abs(G.dirOff) > Math.PI) G.dirOff -= Math.sign(G.dirOff) * TAU;
  player.stepDirect(dt, G.dirTarget);
}
// TWO buttons (Elad 2026-11-16): one picks DIRECT vs SWING (physics), the
// other picks the Direct variant — 220 / 220 FIXED / 180 / 180 FIXED.
// (360 / 360 FIXED stay reachable via ?move=d360 or d360f, off the buttons.)
const VARIANTS = ['d220', 'd220f', 'd180', 'd180f', 'd360', 'd360f'];   // 360s added to the button (Elad 2026-11-16)
const VAR_LABEL = { d220: '220', d220f: '220 FIXED', d180: '180', d180f: '180 FIXED', d360: '360', d360f: '360 FIXED' };
G.variant = 'd180f';   // shipping default (Elad 2026-11-18): DIRECT 180, fixed CENTER camera
function setMoveMode(m) {
  if (!MODES.includes(m)) m = 'd180f';
  if (m !== 'swing') G.variant = m;
  G.moveMode = m;
  // keep the rider where he is: start the offset from his current spot
  const off = player ? angleDiff(player.theta, slimeAngle(player.s)) : 0;
  G.dirOff = m.startsWith('d360') || m === 'swing' ? off : THREE.MathUtils.clamp(off, -MODE_HALF[m], MODE_HALF[m]);
  $('mode-btn').textContent = m === 'swing' ? 'SWING' : 'DIRECT';
  $('mode-btn').classList.toggle('direct', m !== 'swing');
  $('var-btn').textContent = VAR_LABEL[G.variant];
  $('var-btn').classList.toggle('inactive', m === 'swing');
  $('cam-btn').style.display = m.endsWith('f') ? '' : 'none';
}
const togglePhysics = () => setMoveMode(G.moveMode === 'swing' ? G.variant : 'swing');
// picking a variant also switches you to DIRECT — that's the only place it applies
const nextVariant = () => setMoveMode(VARIANTS[(VARIANTS.indexOf(G.variant) + 1) % VARIANTS.length]);
$('mode-btn').addEventListener('click', (e) => { e.stopPropagation(); togglePhysics(); });
$('var-btn').addEventListener('click', (e) => { e.stopPropagation(); nextVariant(); });
function setFixCam(c) {
  if (!FIXCAMS[c]) c = 'center';
  G.fixCam = c; FIXCAM = FIXCAMS[c];
  $('cam-btn').textContent = 'CAM ' + (c === 'auto2' ? 'AUTO 2 SIDES' : c.toUpperCase());
}
const nextFixCam = () => setFixCam(FIXCAM_ORDER[(FIXCAM_ORDER.indexOf(G.fixCam) + 1) % FIXCAM_ORDER.length]);
$('cam-btn').addEventListener('click', (e) => { e.stopPropagation(); nextFixCam(); });
// FOE look audition (dev, Elad 2026-11-16): button + F key cycle the Foot Soldier styles
function setFootStyle(n) {
  if (!obstacles) { G.footStyle = n; return; }
  G.footStyle = obstacles.setFootStyle(n);
  $('foe-btn').textContent = 'FOE ' + FOOT_STYLES[G.footStyle].label;
}
const nextFootStyle = () => setFootStyle(FOOT_STYLE_ORDER[(FOOT_STYLE_ORDER.indexOf(G.footStyle) + 1) % FOOT_STYLE_ORDER.length]);
// dev options closed by default; the gear (or the backquote key) opens them
const toggleDev = () => { document.body.classList.toggle('dev-open'); if (devTagEl) devTagEl.style.display = document.body.classList.contains('dev-open') ? '' : 'none'; };
$('dev-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleDev(); });
// The gear itself is locked (GOBALANCE_APP_INTEGRATION.md): hold the lives row
// for 7 s, then the code. Not persisted — a reload locks it again.
installDevUnlock(document, $('lives'), () => { $('dev-btn').style.display = ''; toggleDev(); });
$('foe-btn').addEventListener('click', (e) => { e.stopPropagation(); nextFootStyle(); });
// WORLD (dev): which world the run starts in; restarts the run there
function setWorld(i, restart = true, override = true) {
  setStartWorld(i);
  if (override) G.worldOverride = WORLDS[getStartWorld()].key;
  $('world-btn').textContent = WORLDS[getStartWorld()].name.replace(/^THE /, '');
  if (restart && track) startRun();
}
const nextWorld = () => setWorld(getStartWorld() + 1);
// TOP (dev, Elad 2026-11-22): CLOSED pipe, or OPEN — roof cut off at the 180
// seams, city matte painting over the rims (city.js). ?top=open
G.openTop = false;
function setOpenTop(on) {
  if (!track) return;
  G.openTop = !!on;
  track.setOpenTop(on);
  city.setOn(on);
  junctions?.reset();
  scene.fog.near = on ? CITY_FOG.near : FOG.near;
  scene.fog.far = on ? CITY_FOG.far : FOG.far;
  scene.fog.color.set(on ? CITY_FOG.color : FOG.color);
  track.syncFog(scene.fog);
  $('top-btn').textContent = on ? 'TOP OPEN' : 'TOP CLOSED';
}
$('top-btn').addEventListener('click', (e) => { e.stopPropagation(); if (track) { G.topOverride = !G.openTop; setOpenTop(G.topOverride); } });
$('world-btn').addEventListener('click', (e) => { e.stopPropagation(); nextWorld(); });
{
  const q = new URLSearchParams(location.search).get('world');
  const i = WORLDS.findIndex((w) => w.key === q);
  setWorld(Math.max(0, i), false, i >= 0);
}
// Dev-panel picks are NOT remembered (Elad 2026-11-18): every load starts on the
// shipping config, same as the app; the panel is for trying things this session only.
setFixCam(new URLSearchParams(location.search).get('cam') || 'center');
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC' && fixedCam()) nextFixCam();
  if (e.code === 'KeyF') nextFootStyle();
  if (e.code === 'KeyN') nextWorld();
  if (e.code === 'Backquote') toggleDev();
  if (e.code === 'KeyG') togglePhysics();
  if (e.code === 'KeyV') nextVariant();
});
{
  // ?move=d220|d220f|d180|d180f|d360|d360f|swing (old ?move=direct → d220).
  let m = new URLSearchParams(location.search).get('move');
  if (m === 'direct') m = 'd220';
  setMoveMode(m === 'swing' ? 'swing' : (m || G.variant));
  if (m === 'swing') $('var-btn').textContent = VAR_LABEL[G.variant];
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
function splashIn(cMain = C_WATER, cFoam = C_FOAM, sys = particles) {
  const f = frameAt(player.s);
  const up = wallDir(f, player.theta, new THREE.Vector3()).negate();
  const p = player.boardWorld(new THREE.Vector3());
  sys.burst(p, up, 34, cMain, { speed: 9, spread: 0.9, size: 0.38, life: 0.75, grav: up.clone().multiplyScalar(-18), drag: 0.7 });
  sys.burst(p, up, 16, cFoam, { speed: 5, spread: 1.4, size: 0.7, life: 0.45, drag: 2.5 });
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
      if (o.air) G.airPizza++;
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
    case 'sai': {
      daggers.start();
      audio.shield();
      bigText(HERO.word, 'shield');
      particles.burst(wp, up, 50, C_KICK, { speed: 10, spread: 1.6, size: 0.4, life: 0.8, drag: 2 });
      flash('rgba(255,170,90,0.9)', 0.35);
      G.fovKick = 10;
      break;
    }
    // street set (OPEN TOP)
    case 'ramp': {
      player.hopV = KICK_POP; player.hop = Math.max(player.hop, 0.02);
      player.trickSpin = Math.sign(player.omega || 1) * TAU;
      award(50, player.root.position, 'pts');
      popup('AIR!', 'near-word', player.root.position, -80);
      addCombo(0.5);
      audio.trick();
      G.fovKick = Math.max(G.fovKick, 6);
      break;
    }
    case 'grind': {
      G.score += 140 * e.dt;
      if (!o.grinding) { o.grinding = true; popup('GRIND!', 'near-word', player.root.position, -80); addCombo(0.6); audio.near(); }
      addCombo(e.dt * 0.25);
      if (Math.random() < 0.7) particles.burst(player.root.position, up, 2, C_SPARK, { speed: 7, spread: 1.2, size: 0.18, life: 0.3, drag: 1 });
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

// a sai knocks a soldier down: same pay as a kick, no kick animation
function onSaiHit(o, wp) {
  const up = wallDir(frameAt(o.s), o.theta, new THREE.Vector3()).negate();
  obstacles.launch(o, player.speed);
  G.kicks = (G.kicks || 0) + 1;
  award(150, wp, 'pts');
  addCombo(0.6);
  audio.kick();
  G.shake = Math.max(G.shake, 0.25);
  particles.burst(wp.clone().addScaledVector(up, 1.0), up, 22, C_KICK, { speed: 11, spread: 1.6, size: 0.42, life: 0.4, drag: 3 });
}

// ── enemies: the spin flip kick ──────────────────────────────────────────────
// The ONLY place the Spin Flip Kick clip plays. Enemies never hurt you —
// riding into one IS the attack.
const KICK_WORDS = ['HI-YAH!', 'COWABUNGA!', 'BOOYAKASHA!', 'KICK!', 'SHELL SHOCK!'];
function onKick(o, up, wp) {
  const atk = player.playNextAttack();
  if (atk) devAttackTag(atk);
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

// DEV ONLY: which audition attack just played (1–10). Remove with the audition.
let devTagEl = null;
function devAttackTag({ n, label }) {
  if (!devTagEl) {
    devTagEl = document.createElement('div');
    devTagEl.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:999;' +
      'font:700 22px/1.2 monospace;color:#0f0;background:rgba(0,0,0,.75);padding:6px 14px;border-radius:6px;pointer-events:none';
    document.body.appendChild(devTagEl);
    if (!document.body.classList.contains('dev-open')) devTagEl.style.display = 'none';
  }
  devTagEl.textContent = `ATTACK #${n} · ${label}`;
}

function onTrain(e) {
  const up = wallDir(frameAt(player.s), player.theta, new THREE.Vector3()).negate();
  if (e.type === 'warn') { bigText('TRAIN!', 'zone'); audio.horn(); }
  else if (e.type === 'hit') onHit({ type: 'train', s: player.s, theta: 0 }, up, player.root.position.clone());
  else if (e.type === 'pass' && e.close && G.state === 'play') {
    bigText('CLOSE CALL!', 'smash'); award(250, player.root.position.clone()); addCombo(1); audio.near();
  }
}

// ── Y-junctions: the half of the pipe you're on picks the arm ────────────────
// (Elad 2026-11-16, as in Wagon Rampage). The prompt shows from FORK_PROMPT out;
// the choice locks FORK_DECIDE before the split, where the arms physically part.
const FORK_PROMPT = 230, FORK_DECIDE = 2;   // locks at the last moment (Elad)
function forkChoice() {
  const el = $('turn');
  // forced climbs are decided when made: just call them out
  for (const fk of FORKS) {
    const to = fk.s - player.s;
    if (fk.kind === 'rise' && !fk.called && to < 120 && to > 0) { fk.called = true; bigText('CLIMB!', 'zone'); }
    if (fk.side > 0 && !fk.landed && to < -CLIMB_LEN * 0.6 && fk.kind !== 'y') {
      fk.landed = true;
      bigText('UP TOP!', 'loop'); award(150, player.root.position.clone()); addCombo(1); G.fovKick = 10; audio.trick();
    }
  }
  const fk = pendingFork(player.s);
  if (!fk) { if (!el.classList.contains('locked')) el.className = ''; return; }
  const to = fk.s - player.s, th = angleDiff(player.theta, 0);
  if (to > FORK_PROMPT) { el.className = ''; return; }
  // y: which half you're on. climb: on the ramp (+1, centre of the floor) or round it (-1)
  if (fk.kind === 'climb') {
    if (!fk.called && to < 130) { fk.called = true; bigText('RAMP AHEAD!', 'zone'); }
    if (to < FORK_DECIDE) track.decide(fk, Math.abs(th) < fk.ramp ? 1 : -1);
    return;
  }
  const side = th < 0 ? -1 : 1;
  $('turn-l').textContent = '\u25C0 LEFT';
  $('turn-r').textContent = 'RIGHT \u25B6';
  if (to < FORK_DECIDE) {
    track.decide(fk, side);
    el.className = 'show locked ' + (side < 0 ? 'l' : 'r');
    clearTimeout(G.turnT); G.turnT = setTimeout(() => { el.className = ''; }, 900);
    audio.trick();
    return;
  }
  el.className = 'show ' + (side < 0 ? 'l' : 'r');
}
// Through the split the crease between the arms is a wall: the rider can't
// ride over into the arm he didn't take.
function forkWall(dt) {
  const fk = forkNear(player.s, 0, FORK_LEN + 10);
  if (!fk || !fk.side) return;
  if (fk.kind === 'climb') {
    // on the ramp you stay on it; below it you ride round its foot
    const d = player.s - fk.s, th = angleDiff(player.theta, 0);
    let tgt = null;
    if (fk.side > 0 && d < CLIMB_LEN && Math.abs(th) > fk.ramp - 0.06) tgt = Math.sign(th) * (fk.ramp - 0.06);
    if (fk.side < 0 && d < 16 && Math.abs(th) < fk.ramp + 0.12) tgt = (Math.sign(th) || 1) * (fk.ramp + 0.12);
    if (tgt !== null) { player.theta += (tgt - th) * Math.min(1, dt * 14); G.dirOff = tgt - slimeAngle(player.s); }
    return;
  }
  if (fk.kind !== 'y') return;
  const lim = Math.asin(Math.min(1, forkSpread(player.s - fk.s) / R));
  if (lim >= Math.PI / 2 - 0.01) return;
  const th = angleDiff(player.theta, 0), edge = -fk.side * Math.max(0, lim - 0.12);
  if (fk.side * th < fk.side * edge) {
    player.theta += (edge - th) * Math.min(1, dt * 14);
    G.dirOff = edge - slimeAngle(player.s);
  }
}

const STREET_SMASH = new Set(['cone', 'prop', 'tire', 'barrier']);
const SMASHABLE = new Set(['crate', 'saw', ...STREET_SMASH]);
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
    if (SMASHABLE.has(o.type)) o.done = true;  // the shield wrecks it
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
  if (o.type === 'crate' || STREET_SMASH.has(o.type)) o.done = true;   // cones, props, tires, sawhorses go flying
  if (STREET_SMASH.has(o.type)) particles.burst(wp, up, 24, C_DUST, { speed: 9, spread: 1.5, size: 0.5, life: 0.6, drag: 2 });
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
    if (G.confirm) { input.read(dt); input.consumePress(); return; }   // the quit question waits for a button
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

  if (G.state === 'card') {
    // the level card is up: board parked, GO on a tap / Space / a held lean
    player.speed = 0;
    if (Math.abs(lean) > 0.7) G.cardHold += dt; else G.cardHold = 0;
    if (pressed || G.cardHold > 0.8) cardPress();
  } else if (G.state === 'clear') {
    // level done: keep cruising (nothing new spawns, nothing hits) while the clear screen is up
    player.speed += (BASE_SPEED * 0.7 - player.speed) * Math.min(1, dt);
    steer(simDt, lean);
    if (pressed) clearPress();
  } else if (G.state === 'countdown') {
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
      if (inSlime) splashIn(C_SEWAGE, C_SCUM, sludge);
    }
    // river is cosmetic (splash + spray) — no speed or score modifier, since
    // gravity keeps you in it whenever you're not leaning
    const target = THREE.MathUtils.lerp(BASE_SPEED, TOP_SPEED, diff);
    player.speed += (target - player.speed) * Math.min(1, simDt * (player.speed < target ? 0.9 : 1.6));
    steer(simDt, lean);
    forkWall(simDt);
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

    // bounded modes keep a clear lane inside the reachable arc (360 / swing: whole ring)
    obstacles.reach = (G.moveMode.startsWith('d360') || G.moveMode === 'swing') ? null : MODE_HALF[G.moveMode];
    obstacles.spawn(player.s, diff, player.theta);
    forkChoice();
    if (levelGoalHave() >= LEVELS[G.level].goal.n) levelClear();
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
    // the death screen is the one a player lands on without choosing: it restarts
    // itself, so an abandoned board never parks on it (the quit screen has no clock)
    if (G.overT > 16) startRun();
  }

  player.place();
  player.animate(simDt, time);

  const events = [];
  if (G.state === 'play' || G.state === 'countdown') obstacles.update(simDt, time, player, events);
  else obstacles.update(simDt, time, { s: player.s, theta: 1e3, hop: 0 }, events);
  for (const e of events) onEvent(e);
  // SAI STORM: auto-throws while the power-up lasts
  if (daggers.update(simDt, player, obstacles, onSaiHit, G.state === 'play') === 'throw') audio.noiseHit({ dur: 0.18, vol: 0.28, freq: 2600, q: 0.9, sweep: 0.35 });
  $('power').classList.toggle('on', daggers.active);
  if (daggers.active) $('power-bar').style.transform = `scaleX(${daggers.left})`;
  // subway trains
  const tev = [];
  trains.update(simDt, player, tev, G.state === 'play');
  for (const e of tev) onTrain(e);

  // ── continuous FX ──
  const f = frameAt(player.s);
  const wallUp = wallDir(f, player.theta, tmpA).negate();
  const boardP = player.boardWorld(tmpB);
  if (G.state === 'play') {
    const back = tmpC.copy(f.T).multiplyScalar(-1);
    if (G.waterOn || G.slimeOn) {
      // sewage throws dark gunk (normal blend); clean water keeps the bright additive spray
      const cA = G.slimeOn ? C_SEWAGE : C_WATER, cB = G.slimeOn ? C_SCUM : C_FOAM;
      const sys = G.slimeOn ? sludge : particles;
      // twin spray sheets peeling off both rails + droplets kicked up behind
      const n = 2 + Math.floor(player.speed / 14);
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        sys.emit(boardP.clone().addScaledVector(f.Rt, side * 0.25),
          f.Rt.clone().multiplyScalar(side * (3 + Math.random() * 3)).addScaledVector(wallUp, 3 + Math.random() * 3.5).addScaledVector(back, 2 + Math.random() * 3),
          Math.random() < 0.35 ? cB : cA, { size: 0.22 + Math.random() * 0.22, life: 0.55, grav: wallUp.clone().multiplyScalar(-16), drag: 0.8 });
      }
      sys.emit(boardP.clone().addScaledVector(f.T, -0.5), back.clone().multiplyScalar(2).addScaledVector(wallUp, 1 + Math.random()), cB, { size: 0.55, life: 0.4, drag: 3 });
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
  // ── the board against the floor: wheel tracks, contact glow, wheel sparks ──
  {
    const b = player.board;
    b.updateMatrixWorld(true);
    const wl = b.localToWorld(_wl.set(-0.17, 0.0, 0.34));
    const wr = b.localToWorld(_wr.set(0.17, 0.0, 0.34));
    const side = _ws.subVectors(wr, wl).normalize();
    const onFloor = (G.state === 'play' || G.state === 'countdown') && player.hop < 0.05;
    const dry = !G.waterOn && !G.slimeOn;
    boardTrail.update(simDt, [wl, wr], wallUp, side, player.speed, onFloor, dry);
    if (onFloor && G.state === 'play') {
      const back = _wb.copy(f.T).multiplyScalar(-1);
      for (const w of [wl, wr]) {
        if (dry && Math.random() < 0.25 + Math.min(0.5, Math.abs(player.omega) * 0.2)) {
          // grinding sparks off the wheels
          particles.emit(w, back.clone().multiplyScalar(3 + Math.random() * 4).addScaledVector(wallUp, 1 + Math.random() * 2.5).addScaledVector(side, (Math.random() - 0.5) * 3),
            C_SPARK, { size: 0.12 + Math.random() * 0.1, life: 0.3, grav: wallUp.clone().multiplyScalar(-18), drag: 0.6 });
        } else if (!dry && Math.random() < 0.6) {
          // little rooster tails off each wheel in the water
          (G.slimeOn ? sludge : particles).emit(w, back.clone().multiplyScalar(2 + Math.random() * 2).addScaledVector(wallUp, 1.5 + Math.random() * 2).addScaledVector(side, (Math.random() - 0.5) * 2),
            G.slimeOn ? C_SCUM : C_FOAM, { size: 0.16 + Math.random() * 0.12, life: 0.4, grav: wallUp.clone().multiplyScalar(-16), drag: 0.8 });
        }
      }
    }
  }
  particles.update(dt);
  sludge.update(dt);
  debris.update(simDt);
  const speedN = THREE.MathUtils.clamp((player.speed - BASE_SPEED) / (TOP_SPEED - BASE_SPEED), 0, 1);
  streaks.update(player.s, player.speed, frameAt, pointAt, R, G.state === 'play' ? 0.08 + speedN * 0.25 : 0);
  track.update(player.s, simDt, time, player.speed);
  // side junctions pouring in: foam + spray where each stream lands
  // kicked Foot Soldiers dissolve into particles in their suit colour
  for (const o of obstacles.list) {
    if (o.type !== 'foot' || !o.flying || !(o.dissolve > 0) || o.done) continue;
    const wp = o.mesh.localToWorld(tmpE.set(0, 1.3 * (1 - o.dissolve * 0.6), 0));
    const k = 1 - o.dissolve;
    particles.burst(wp, tmpD.copy(o.vel).normalize().multiplyScalar(0.6), 6, o.dummy ? _foeCol.setRGB(0.85, 0.6, 0.35) : _foeCol.setRGB(...FOOT_STYLES[G.footStyle].suit).multiplyScalar(1.5), { speed: 6, spread: 3.4, size: 0.32 + k * 0.3, life: 0.55, drag: 2.2, jitter: 0.9 * k + 0.3 });
    if (Math.random() < 0.6) particles.burst(wp, tmpD, 2, C_WHITE, { speed: 5, spread: 3.6, size: 0.22, life: 0.4, drag: 2.5, jitter: 0.6 });
  }
  for (const j of junctions.update(simDt, player.s)) {
    if (j.ds > 90 || j.ds < -20) continue;
    particles.burst(j.land, j.landUp, 2, C_JFOAM, { speed: 5, spread: 1.3, size: 0.35, life: 0.55, drag: 2.5 });
    if (Math.random() < 0.5) particles.burst(j.land, j.landUp, 1, C_JSPRAY, { speed: 2, spread: 0.6, size: 0.9, life: 0.8, drag: 3 });
  }

  // ── zones: banner on entry, fog + ambient ease to the zone's palette ──
  const zi = zoneIndex(player.s);
  if (zi !== G.zone) {
    if (G.zone !== undefined && G.state === 'play') {
      const newWorld = ZONES[zi].world !== ZONES[G.zone].world;
      bigText(newWorld ? WORLDS[ZONES[zi].world].name : ZONES[zi].name, 'zone'); audio.trick();
    }
    G.zone = zi;
  }
  const Z = ZONES[zi];
  const ease = Math.min(1, dt * 1.2);
  const open = G.openTop;
  scene.fog.color.lerp(_zc.set(open ? CITY_FOG.color : Z.fog), ease);
  scene.background.copy(scene.fog.color);
  hemi.color.lerp(_zc.set(open ? CITY_HEMI[0] : Z.hemi[0]), ease);
  hemi.groundColor.lerp(_zc.set(open ? CITY_HEMI[1] : Z.hemi[1]), ease);
  track.syncFog(scene.fog);

  // lights ride with the rider
  pointAt(player.s + 6, player.theta, R - 3.2, headLamp.position);
  pointAt(player.s + 10, slimeAngle(player.s + 10), R - 0.8, slimeLight.position);
  slimeLight.intensity = (6 + Math.sin(time * 1.5) * 1.5) * featureAt(player.s + 10, 'river');
  flashLight.intensity *= Math.pow(0.004, dt);

  // ── camera ──
  // Rolls with the rider so "down" is always under his feet (he stays at the
  // bottom of the screen and the sewer spins around him), lagging just enough
  // that you feel the swing.
  // FIXED-CAM modes: the camera stays at the floor angle, never rolls, and
  // sits back near the axis so the rider is in view anywhere on the ring.
  const fixed = fixedCam();
  if (fixed && G.fixCam === 'auto') updateAutoCam(dt);
  if (fixed && G.fixCam === 'auto2') updateAuto2Cam(dt);
  G.camTheta += angleDiff(fixed ? 0 : player.theta, G.camTheta) * Math.min(1, dt * 7);
  const camS = player.s - (fixed ? FIXCAM.back : 4.8);
  frameAt(camS, camF);
  const camDir = wallDir(camF, G.camTheta, tmpA);
  camera.position.copy(camF.C).addScaledVector(camDir, fixed ? FIXCAM.r : R - 3.15);
  if (fixed) camera.position.addScaledVector(camF.Rt, FIXCAM.side);
  frameAt(player.s + (fixed ? FIXCAM.ahead : 10), lookF);
  const lookDir = wallDir(lookF, G.camTheta, tmpB);
  const look = tmpC.copy(lookF.C).addScaledVector(lookDir, fixed ? FIXCAM.lookR : R - 1.9);
  if (fixed) {
    // Never rolls, but it isn't nailed down: it slides a little toward the
    // rider's side of the ring and turns its gaze toward him, so he stays big
    // in frame and the walls rush past close to the lens (speed feel).
    G.fixAim = G.fixAim || new THREE.Vector3();
    const rDir = wallDir(camF, player.theta, tmpD);
    camera.position.addScaledVector(rDir, FIXCAM.slide);
    const riderAhead = pointAt(player.s + FIXCAM.ahead * 0.4, player.theta, R - 2.4, tmpE);
    G.fixAim.lerp(riderAhead, Math.min(1, dt * 8));
    look.lerp(G.fixAim, FIXCAM.aim);
    look.addScaledVector(camF.U, FIXCAM.lift);
  }
  // dutch tilt with the carve (none when the camera is fixed)
  G.camRoll += ((fixed ? 0 : -player.omega * 0.045) - G.camRoll) * Math.min(1, dt * 5);
  const upV = wallDir(camF, G.camTheta + G.camRoll, new THREE.Vector3()).negate();
  camera.up.copy(upV);
  if (G.shake > 0) {
    const k = G.shake * G.shake * 0.55;
    camera.position.add(new THREE.Vector3((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k));
    G.shake = Math.max(0, G.shake - dt * 2.4);
  }
  camera.lookAt(look);
  G.fovKick *= Math.pow(0.05, dt);
  const fov = camera.userData.baseFov + speedN * (fixedCam() ? 14 : 8) + G.fovKick + (fixedCam() ? FIXCAM.fov : 0);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); }

  audio.ride(player.speed, G.slimeOn, G.state === 'play' || G.state === 'countdown', G.waterOn && G.state === 'play');

  // ── HUD ──
  hud.score.textContent = Math.floor(G.score).toLocaleString();
  hud.dist.textContent = Math.floor(player.s) + ' m';
  renderGoal(G.state === 'card' ? null : LEVELS[G.level], levelGoalHave());
  hud.combo.textContent = 'x' + G.combo;
  hud.comboBar.style.transform = `scaleX(${G.combo >= 8 ? 1 : G.comboFill})`;
  hud.comboWrap.classList.toggle('hot', G.combo >= 4);
  $('speedlines').style.opacity = G.state === 'play' ? (speedN * 0.5).toFixed(2) : 0;

  city?.update(player.s, camera);
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
  const names = ['wall', 'slime', 'graffiti', 'crate', 'pipe', 'water', 'sewage_toon', 'concrete_grey', 'concrete_warm', 'wood_planks', 'scrap_atlas'];
  const loaded = await Promise.all(names.map((n) => loadTex(`/tex/${n}.jpg`)));
  names.forEach((n, i) => (tex[n.replace('wall_', '')] = loaded[i]));
  tex.sewage = tex.sewage_toon;                 // look test: flat cartoon water (Kolbo, ref '55')
  tex.valve = await loadTex('/tex/valve.png');
  [tex.shieldIcon, tex.saiIcon] = await Promise.all([loadTex('/tex/shield_icon.png'), loadTex(HERO.icon)]);
  tex.dummies = await Promise.all(['a', 'b', 'c'].map((k) => loadTex(`/tex/dummy_${k}.png`)));
  [tex.footA, tex.footB] = await Promise.all([loadTex('/tex/foot_sprite_a.png'), loadTex('/tex/foot_sprite_b.png')]);  // look test: illustrated valve hatch
  tex.footGeo = await loadFootGeo('/models/foot.bin');
  tex.props = await loadTex('/tex/street_props.png');
  track = new Track(scene, tex);
  track.syncFog(scene.fog);
  city = new City(scene, { sky: await loadTex('/tex/city_sky.jpg'), bldg: await loadTex('/tex/city_bldg.png') });
  if (new URLSearchParams(location.search).get('top') === 'open') G.topOverride = true;
  obstacles = new Obstacles(scene, tex);
  junctions = new Junctions(scene, tex);
  trains = new Trains(scene, makeGlowTexture);
  daggers = new Daggers(scene, makeGlowTexture(), HERO.weapon);
  daggers.upFn = (o) => wallDir(frameAt(o.s), o.theta, new THREE.Vector3()).negate();
  obstacles.camera = camera;
  { let f = 'sprite'; try { f = new URLSearchParams(location.search).get('foe') || 'sprite'; } catch { /* private */ } setFootStyle(f); }
  particles = new Particles(scene);
  sludge = new Particles(scene, { additive: false });
  debris = new Debris(scene, tex);
  streaks = new Streaks(scene);
  boardTrail = new BoardTrail(scene, makeGlowTexture());
  player = new Player(scene);
  if (HERO.skin) player.skin = await loadTex(HERO.skin);
  await player.load('/models/raphael.glb', '/models/clips.json');
  await player.loadAttacks('/models/attacks.json');
  renderLives(LIVES);
  $('loading').classList.add('gone');
  {
    // ?level=N (dev) or the saved progress; the first-ever run starts on PRACTICE
    const q = new URLSearchParams(location.search).get('level');
    const lv = q !== null && !isNaN(+q) ? Math.max(0, Math.min(LEVELS.length - 1, +q)) : await loadProgress();
    startLevel(lv, new URLSearchParams(location.search).get('card') !== '0');
  }
  requestAnimationFrame(frame);
  // test hooks for the headless drive script
  window.__game = { worldName: () => WORLDS[ZONES[zoneIndex(player.s)].world].name + ' / ' + ZONES[zoneIndex(player.s)].name,
    trainDist: () => { const t = trains.pool.filter((x) => x.on && x.s > player.s); return t.length ? Math.min(...t.map((x) => x.s - player.s)) : null; },
    track, trains, daggers, setWorld, G, player, obstacles, PHYS, camera, startRun, startLevel, LEVELS, setMoveMode, setFixCam, slimeAngle, junctions, setFootStyle };
})();
