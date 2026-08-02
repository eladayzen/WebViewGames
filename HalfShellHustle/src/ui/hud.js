// DOM/CSS overlay HUD (build doc §7: "a DOM/CSS overlay on top of the WebGL
// canvas, not drawn into the 3D scene itself"), plus the gameover overlay's
// exact GoBalance SDK DOM contract and the cross-game Back/Pause chrome
// (BUILD_NOTES.md).
//
// ONE headline number now. Direct feedback retired the three competing
// top-left readouts (distance / kill score / coin count) in favour of a single
// merged POINTS total, upper centre and much larger: "we can hide the distance
// meter, and use mainly the points being collected... those values summed up
// into one main points value." The per-source tallies still exist in
// systems/scoring.js and surface on the game-over recap.

const pointsValueEl = document.getElementById('points-value');
const pointsHudEl = document.getElementById('points-hud');
const livesTrayEl = document.getElementById('lives-tray');
const gameoverEl = document.getElementById('gameover-overlay');
const finalPointsEl = document.getElementById('final-points');
const finalBreakdownEl = document.getElementById('final-breakdown');
const pausedBadgeEl = document.getElementById('paused-badge');
const frameDebugEl = document.getElementById('frame-debug');

const LIFE_GLYPH = '❤';

// DIRTY-CHECK CACHES. Every readout here lives on an element carrying
// -webkit-text-stroke + paint-order + text-shadow, and rewriting textContent
// on those forces a relayout+repaint of the stroked glyphs -- measurably
// stuttery inside the GoBalance WebView (a lesson already paid for in
// TmntSkateSlice's ui.js). The points counter is written every frame from the
// game loop while its value only changes when a label lands, so most of those
// writes would be pure waste.
let lastPointsText = null;
let lastLives = null;

// Fires the counter's punch animation. Restarting a CSS animation needs the
// class removed, a reflow forced, then re-added -- without the reflow the
// browser coalesces both class changes and nothing replays, which matters here
// because points can land back-to-back during a coin row.
function punchPoints() {
  if (!pointsHudEl) return;
  pointsHudEl.classList.remove('points-punch');
  void pointsHudEl.offsetWidth;
  pointsHudEl.classList.add('points-punch');
}

// `punch` is passed only when the change was caused by a label ARRIVING, so
// the counter reacts to the feedback rather than to the underlying tally --
// see systems/scoring.js's displayed/total split.
export function updatePoints(points, punch = false) {
  const text = `${points}`;
  if (text === lastPointsText) return;
  lastPointsText = text;
  pointsValueEl.textContent = text;
  if (punch) punchPoints();
}

// Builds the heart tray once, from the CURRENT cap.
//
// Deliberately driven by a count rather than hardcoded in index.html, so
// raising the cap needs no markup change -- data/constants.js's
// LIVES_MAX_SUPPORTED documents how far that can go. But do NOT build the tray
// at that ceiling: `updateLives` greys every icon at index >= lives, so a
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

// The recap is where the merged counter's hidden breakdown comes back out --
// distance included, even though its live meter is gone.
export function showGameOver(score, meters) {
  finalPointsEl.textContent = `${score.total}`;
  finalBreakdownEl.textContent = `${score.enemiesKilled} defeated   ·   ${score.coinsCollected} coins   ·   ${Math.floor(meters)}m`;
  gameoverEl.classList.remove('hidden');
}

export function hideGameOver() {
  gameoverEl.classList.add('hidden');
}

export function setPausedBadge(paused) {
  pausedBadgeEl.classList.toggle('hidden', !paused);
}
