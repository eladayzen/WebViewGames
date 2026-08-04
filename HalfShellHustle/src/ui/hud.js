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
import { PLAYER_RUN_FRAMES, PLAYER_JUMP_FRAMES } from '../data/playerSprite.js';

const pointsValueEl = document.getElementById('points-value');
const pointsTargetEl = document.getElementById('points-target');
const pointsHudEl = document.getElementById('points-hud');
const tierBarEl = document.getElementById('tier-bar');
const tierFillEl = document.getElementById('tier-fill');
const tierLabelEl = document.getElementById('tier-label');
const lcEl = document.getElementById('level-complete');
const lcHeadlineEl = document.getElementById('lc-headline');
const lcNextEl = document.getElementById('lc-next');
const lcCountdownEl = document.getElementById('lc-countdown');
const lcConfettiEl = document.getElementById('lc-confetti');
const lcCurtainLeftEl = document.getElementById('lc-curtain-left');
const lcCurtainRightEl = document.getElementById('lc-curtain-right');
const livesTrayEl = document.getElementById('lives-tray');
const gameoverEl = document.getElementById('gameover-overlay');
const finalPointsEl = document.getElementById('final-points');
const finalBreakdownEl = document.getElementById('final-breakdown');
const pausedBadgeEl = document.getElementById('paused-badge');
const frameDebugEl = document.getElementById('frame-debug');
const introEl = document.getElementById('intro-tutorial-overlay');
const introStepLanesEl = document.getElementById('intro-step-lanes');
const introStepJumpEl = document.getElementById('intro-step-jump');
const introBoardLanesEl = document.getElementById('intro-board-lanes');
const introPlayerEl = document.getElementById('intro-player');
const introBoardJumpEl = document.getElementById('intro-board-jump');
const introJumperEl = document.getElementById('intro-jumper');

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
let lastCountdownShown = null;

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

// --- Level transition ----------------------------------------------------
// The floating "TIER COMPLETE" card that used to live here is gone: reaching a
// tier now ends the level outright, and the full-screen overlay below says the
// same thing better. All that survives is the bar's own sweep, which reads for
// the instant before the overlay covers it.

const CONFETTI_COLORS = ['#ffe066', '#ffc93f', '#5fe0ff', '#ff8fa3', '#7fd8ff', '#97ff6b', '#ffb43c'];
const CONFETTI_COUNT = 34;

// Built once at module load, not per celebration -- creating ~34 DOM nodes on
// every level-up would be a needless allocation on a path that already has to
// stay smooth. Each piece gets its own randomized drift/spin/timing baked in
// as inline styles at BUILD time (CSS custom properties read by the
// confetti-fall keyframe in style.css), since a shared class can't express
// per-element randomness on its own.
//
// Delay/duration ranges are chosen so pieces are still falling ~5s in --
// covering roughly the whole LEVEL_COUNTDOWN_SECONDS window, not just the
// first second or two -- without needing a second timed burst.
function buildConfetti() {
  if (!lcConfettiEl) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = `${Math.random() * 100}%`;
    el.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    el.style.setProperty('--drift', `${(Math.random() * 2 - 1) * 24}vw`);
    el.style.setProperty('--spin', `${(Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3) * 360}deg`);
    el.style.animationDuration = `${2 + Math.random() * 1.4}s`;
    el.style.animationDelay = `${Math.random() * 2}s`;
    frag.appendChild(el);
  }
  lcConfettiEl.appendChild(frag);
}
buildConfetti();

export function showLevelComplete(nextTier) {
  tierBarEl.classList.remove('tier-bar-celebrate');
  void tierBarEl.offsetWidth;
  tierBarEl.classList.add('tier-bar-celebrate');

  // Same remove/reflow/re-add restart idiom as the tier flash and countdown
  // tick -- without the forced reflow, back-to-back level-ups (or a fast
  // retry landing on the same tier) would coalesce into the browser's next
  // paint and never actually replay.
  lcHeadlineEl.classList.remove('lc-headline-play');
  void lcHeadlineEl.offsetWidth;
  lcHeadlineEl.classList.add('lc-headline-play');

  lcConfettiEl.classList.remove('lc-confetti-play');
  void lcConfettiEl.offsetWidth;
  lcConfettiEl.classList.add('lc-confetti-play');

  lcNextEl.textContent = `NEXT: ${tierName(nextTier)}`;
  lastCountdownShown = null;
  resetLevelCurtains();
  lcEl.classList.remove('hidden');
}

// core/main.js triggers this partway through the countdown (data/
// progression.js's LEVEL_CURTAIN_CLOSE_DELAY_SEC), not immediately on
// show -- the headline/confetti beat gets a clear beat to itself first, then
// the curtains close over it. Adding the class is enough; style.css's
// transform transition on .lc-curtain does the animating.
export function closeLevelCurtains() {
  lcCurtainLeftEl.classList.add('lc-curtain-closed');
  lcCurtainRightEl.classList.add('lc-curtain-closed');
}

// core/main.js calls this once the next level's environment swap
// (disposeStreet/createStreet) is done and gameplay is about to resume --
// the curtains were the whole point of covering that swap, so they're the
// last thing to move, sliding back open to reveal the new level in motion
// rather than popping straight to it.
export function openLevelCurtains() {
  lcCurtainLeftEl.classList.remove('lc-curtain-closed');
  lcCurtainRightEl.classList.remove('lc-curtain-closed');
}

// Snaps both panels back to their open (off-screen) resting state with NO
// animation -- called at the START of every showLevelComplete (defensive,
// in case a fast repeated tier-up somehow left them mid-close) and from
// resetProgressUI's full-run reset, where the whole screen is snapping back
// to its start state and a curtain-slide would be a stray, unexplained
// animation. Same suppress-transition/reflow/restore idiom as
// resetProgressUI's own tier-fill reset below.
function resetLevelCurtains() {
  for (const el of [lcCurtainLeftEl, lcCurtainRightEl]) {
    const prev = el.style.transition;
    el.style.transition = 'none';
    el.classList.remove('lc-curtain-closed');
    void el.offsetWidth;
    el.style.transition = prev;
  }
}

// Re-triggers the pop animation per whole second so each number lands with its
// own beat instead of the digits silently swapping. Dirty-checked because the
// caller ticks this every frame.
export function setLevelCountdown(seconds) {
  if (seconds === lastCountdownShown) return;
  lastCountdownShown = seconds;
  lcCountdownEl.textContent = `${seconds}`;
  lcCountdownEl.classList.remove('lc-tick');
  void lcCountdownEl.offsetWidth;
  lcCountdownEl.classList.add('lc-tick');
}

export function hideLevelComplete() {
  lcEl.classList.add('hidden');
  tierBarEl.classList.remove('tier-bar-celebrate');
  lcHeadlineEl.classList.remove('lc-headline-play');
  lcConfettiEl.classList.remove('lc-confetti-play');
}

// A fresh run starts at tier 1 with an empty bar -- and the fill must be reset
// WITHOUT its transition, or the bar visibly drains backwards from wherever the
// last run ended.
export function resetProgressUI() {
  lcEl.classList.add('hidden');
  tierBarEl.classList.remove('tier-bar-celebrate');
  lcHeadlineEl.classList.remove('lc-headline-play');
  lcConfettiEl.classList.remove('lc-confetti-play');
  resetLevelCurtains();
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

// --- First-run onboarding (core/main.js's beginIntro/advanceIntroStep/
// dismissIntro, driven by data/introTutorial.js) -----------------------
// Dirty-checked the same way the rest of this file is (see the DIRTY-CHECK
// CACHES note up top) -- core/main.js's tick calls these every frame past
// a hold threshold, not just on the frame the state actually changes.
let lastIntroLaneState = null;
let lastIntroRunFrame = null;
let lastIntroJumpCycleIndex = null;

const INTRO_LANE_CLASSES = ['intro-lane-center', 'intro-lane-left', 'intro-lane-right'];

export function showIntroTutorial() {
  introEl.classList.remove('hidden');
  lastIntroLaneState = null;
  lastIntroRunFrame = null;
  lastIntroJumpCycleIndex = null;
  setIntroStep(1);
  setIntroLaneState('center');
  setIntroRunFrame(0);
}

export function hideIntroTutorial() {
  introEl.classList.add('hidden');
}

export function setIntroStep(step) {
  introStepLanesEl.classList.toggle('hidden', step !== 1);
  introStepJumpEl.classList.toggle('hidden', step !== 2);
}

// state is one of data/introTutorial.js's INTRO_LANE_CYCLE entries
// ('center'/'left'/'right') -- the SAME class name drives both the board's
// rotate and the player's lane translateX (src/style.css), so they can never
// drift out of sync with each other.
export function setIntroLaneState(state) {
  if (state === lastIntroLaneState) return;
  lastIntroLaneState = state;
  const cls = `intro-lane-${state}`;
  introBoardLanesEl.classList.remove(...INTRO_LANE_CLASSES);
  introBoardLanesEl.classList.add(cls);
  introPlayerEl.classList.remove(...INTRO_LANE_CLASSES);
  introPlayerEl.classList.add(cls);
}

export function setIntroRunFrame(index) {
  if (index === lastIntroRunFrame) return;
  lastIntroRunFrame = index;
  introPlayerEl.src = PLAYER_RUN_FRAMES[index].url;
}

// `entry` is one of data/introTutorial.js's INTRO_JUMP_CYCLE objects --
// board tilt is a continuous rotateX degree, not one of a few fixed states
// like step 1's, so it's set inline here rather than through a CSS class
// (see src/style.css's .intro-board note on why). The small translateY on
// the airborne frame is the same idea -- a one-off "hop" only that frame
// needs, not worth a whole class for.
export function setIntroJumpCycleState(index, entry) {
  if (index === lastIntroJumpCycleIndex) return;
  lastIntroJumpCycleIndex = index;
  introJumperEl.src = PLAYER_JUMP_FRAMES[entry.frame].url;
  // 380px, a tight perspective distance -- verified via screenshot that a
  // longer one (700px) made even a large rotateX barely register visually.
  // See data/introTutorial.js's INTRO_JUMP_CYCLE comment for the same story
  // on the degree values.
  introBoardJumpEl.style.transform = `perspective(380px) rotateX(${entry.boardDeg}deg)`;
  introJumperEl.style.transform = entry.frame === 2 ? 'translateY(-3vmin)' : 'translateY(0)';
}
