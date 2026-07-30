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
const gameoverEl = document.getElementById('gameover-overlay');
const finalDistanceEl = document.getElementById('final-distance');
const pausedBadgeEl = document.getElementById('paused-badge');
const frameDebugEl = document.getElementById('frame-debug');

const COIN_GLYPH = '✦';

export function updateDistance(meters) {
  distanceEl.textContent = `${Math.floor(meters)}m`;
}

// TEMPORARY: see style.css's #score comment.
export function updateScore(points) {
  scoreEl.textContent = `${points}`;
}

// Coins collected this run -- its own counter, separate from updateScore's
// enemy-kill points (see index.html's #coins comment).
export function updateCoins(coins) {
  coinsEl.textContent = `${COIN_GLYPH} ${coins}`;
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
