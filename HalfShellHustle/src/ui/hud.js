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

import { progressAt, tierName } from '../systems/progression.js';

const pointsValueEl = document.getElementById('points-value');
const pointsTargetEl = document.getElementById('points-target');
const pointsHudEl = document.getElementById('points-hud');
const tierBarEl = document.getElementById('tier-bar');
const tierFillEl = document.getElementById('tier-fill');
const tierLabelEl = document.getElementById('tier-label');
const tierUpEl = document.getElementById('tier-up');
const tierUpNameEl = document.getElementById('tier-up-name');
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
let lastTargetText = null;
let lastTierText = null;
let lastFillPct = -1;
let lastLives = null;
let tierUpTimer = null;

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
//
// Also drives the tier bar, since both read off the same number and updating
// them from one call is what stops the score and the bar ever disagreeing.
// Every write below is dirty-checked independently: the bar's width changes on
// almost every landing while the tier name changes a handful of times a run,
// and rewriting stroked text is the expensive one in this WebView.
export function updatePoints(points, punch = false) {
  const text = `${points}`;
  if (text !== lastPointsText) {
    lastPointsText = text;
    pointsValueEl.textContent = text;
    if (punch) punchPoints();
  }

  const p = progressAt(points);

  const targetText = `/ ${p.next}`;
  if (targetText !== lastTargetText) {
    lastTargetText = targetText;
    pointsTargetEl.textContent = targetText;
  }

  const tierText = tierName(p.tier);
  if (tierText !== lastTierText) {
    lastTierText = tierText;
    tierLabelEl.textContent = tierText;
  }

  // Rounded to whole percent: the CSS transition makes sub-percent writes
  // invisible anyway, and this keeps a coin row from queuing a dozen
  // indistinguishable style changes.
  const pct = Math.round(p.frac * 100);
  if (pct !== lastFillPct) {
    lastFillPct = pct;
    tierFillEl.style.width = `${pct}%`;
  }
}

// Fired by core/main.js when a landing label pushes the score past a
// threshold. This is the placeholder for the environment change these tiers
// exist to trigger (data/progression.js) -- right now it's the entire reward.
export function showTierUp(tier) {
  tierUpNameEl.textContent = tierName(tier);
  tierUpEl.classList.remove('hidden', 'tier-up-play');
  void tierUpEl.offsetWidth; // restart the animation on back-to-back tiers
  tierUpEl.classList.add('tier-up-play');

  tierBarEl.classList.remove('tier-bar-celebrate');
  void tierBarEl.offsetWidth;
  tierBarEl.classList.add('tier-bar-celebrate');

  // forwards-filled animations hold their last keyframe, so the element has to
  // be hidden explicitly or it stays in the layout at opacity 0.
  if (tierUpTimer) window.clearTimeout(tierUpTimer);
  tierUpTimer = window.setTimeout(() => tierUpEl.classList.add('hidden'), 2100);
}

// A fresh run starts at tier 1 with an empty bar -- and the fill must be reset
// WITHOUT its transition, or the bar visibly drains backwards from wherever the
// last run ended.
export function resetProgressUI() {
  if (tierUpTimer) window.clearTimeout(tierUpTimer);
  tierUpEl.classList.add('hidden');
  tierUpEl.classList.remove('tier-up-play');
  tierBarEl.classList.remove('tier-bar-celebrate');
  const prev = tierFillEl.style.transition;
  tierFillEl.style.transition = 'none';
  tierFillEl.style.width = '0%';
  void tierFillEl.offsetWidth;
  tierFillEl.style.transition = prev;
  lastPointsText = null;
  lastTargetText = null;
  lastTierText = null;
  lastFillPct = -1;
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
  const p = progressAt(score.total);
  finalBreakdownEl.textContent = `${tierName(p.tier)}   ·   ${score.enemiesKilled} defeated   ·   ${score.coinsCollected} coins   ·   ${Math.floor(meters)}m`;
  gameoverEl.classList.remove('hidden');
}

export function hideGameOver() {
  gameoverEl.classList.add('hidden');
}

export function setPausedBadge(paused) {
  pausedBadgeEl.classList.toggle('hidden', !paused);
}
