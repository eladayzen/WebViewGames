// DOM/CSS overlay HUD (build doc §7: "a DOM/CSS overlay on top of the WebGL
// canvas, not drawn into the 3D scene itself"). POC has no CHASE meter and no
// score UI (§2, §7) -- just the optional bare distance counter the build doc
// explicitly allows ("a bare static distance counter can stand in if a HUD
// number is wanted for testing"), plus the gameover overlay's exact
// GoBalance SDK DOM contract and the cross-game Back/Pause chrome
// (BUILD_NOTES.md).

const distanceEl = document.getElementById('distance');
const scoreEl = document.getElementById('score');
const coinsEl = document.getElementById('coins');
const livesTrayEl = document.getElementById('lives-tray');
const gameoverEl = document.getElementById('gameover-overlay');
const finalDistanceEl = document.getElementById('final-distance');
const pausedBadgeEl = document.getElementById('paused-badge');
const frameDebugEl = document.getElementById('frame-debug');

const COIN_GLYPH = '✦';
const LIFE_GLYPH = '❤';

// DIRTY-CHECK CACHES. Every readout here lives on an element carrying
// -webkit-text-stroke + paint-order + text-shadow, and rewriting textContent
// on those forces a relayout+repaint of the stroked glyphs -- measurably
// stuttery inside the GoBalance WebView (a lesson already paid for in
// TmntSkateSlice's ui.js). updateDistance in particular is called every single
// frame from the game loop while its floored value only changes ~10-16x/sec,
// so most of those writes were pure waste.
let lastDistanceText = null;
let lastScoreText = null;
let lastCoinsText = null;
let lastLives = null;

export function updateDistance(meters) {
  const text = `${Math.floor(meters)}m`;
  if (text === lastDistanceText) return;
  lastDistanceText = text;
  distanceEl.textContent = text;
}

// TEMPORARY: see style.css's #score comment.
export function updateScore(points) {
  const text = `${points}`;
  if (text === lastScoreText) return;
  lastScoreText = text;
  scoreEl.textContent = text;
}

// Coins collected this run -- its own counter, separate from updateScore's
// enemy-kill points (see index.html's #coins comment).
export function updateCoins(coins) {
  const text = `${COIN_GLYPH} ${coins}`;
  if (text === lastCoinsText) return;
  lastCoinsText = text;
  coinsEl.textContent = text;
}

// Builds the heart tray once, from the CURRENT cap.
//
// Deliberately driven by a count rather than hardcoded in index.html, so
// raising the cap needs no markup change -- data/constants.js's
// LIVES_MAX_SUPPORTED (5) documents how far that can go. But do NOT build the
// tray at that ceiling: `updateLives` greys every icon at index >= lives, so a
// 5-icon tray holding 3 lives would render two pre-greyed hearts and read as
// "you already lost two."
export function initLivesTray(maxLives) {
  livesTrayEl.innerHTML = '';
  for (let i = 0; i < maxLives; i++) {
    const icon = document.createElement('div');
    icon.className = 'life-icon';
    icon.textContent = LIFE_GLYPH;
    livesTrayEl.appendChild(icon);
  }
  lastLives = null; // invalidate the dirty-check against the new tray
}

export function updateLives(lives) {
  if (lives === lastLives) return;
  // Grew past the tray (a future extra-heart upgrade) -- rebuild rather than
  // silently capping the display at the old size.
  if (lives > livesTrayEl.children.length) {
    initLivesTray(lives);
  }
  lastLives = lives;
  const icons = livesTrayEl.children;
  for (let i = 0; i < icons.length; i++) {
    icons[i].classList.toggle('spent', i >= lives);
  }
}

// TEMPORARY: see index.html's #frame-debug comment.
export function updateFrameDebug(text) {
  frameDebugEl.textContent = text;
}

export function showGameOver(meters, coins = 0) {
  finalDistanceEl.textContent = `${Math.floor(meters)}m   ${COIN_GLYPH} ${coins}`;
  gameoverEl.classList.remove('hidden');
}

export function hideGameOver() {
  gameoverEl.classList.add('hidden');
}

export function setPausedBadge(paused) {
  pausedBadgeEl.classList.toggle('hidden', !paused);
}
