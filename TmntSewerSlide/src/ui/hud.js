// DOM overlay (§7): score/multiplier/lives HUD, section banner, game-over
// overlay. Plain JS/DOM, no framework -- kept out of render/game-loop code.

const els = {
  score: document.getElementById('score'),
  multiplier: document.getElementById('multiplier'),
  decayFill: document.getElementById('decay-fill'),
  livesTray: document.getElementById('lives-tray'),
  sectionBanner: document.getElementById('section-banner'),
  countdown: document.getElementById('countdown-overlay'),
  pausedBadge: document.getElementById('paused-badge'),
  gameoverOverlay: document.getElementById('gameover-overlay'),
  finalScore: document.getElementById('final-score'),
  bestScore: document.getElementById('best-score'),
};

let bannerTimeout = null;

export function initLivesTray(maxLives) {
  els.livesTray.innerHTML = '';
  for (let i = 0; i < maxLives; i++) {
    const icon = document.createElement('div');
    icon.className = 'life-icon';
    icon.textContent = '\u{1F422}'; // turtle emoji -- a small in-universe stand-in for a "shell" life icon
    els.livesTray.appendChild(icon);
  }
}

export function updateLives(lives) {
  const icons = els.livesTray.children;
  for (let i = 0; i < icons.length; i++) {
    icons[i].classList.toggle('spent', i >= lives);
  }
}

export function updateScore(score) {
  els.score.textContent = String(Math.floor(score));
}

export function updateMultiplier(multiplier, fraction) {
  els.multiplier.textContent = `x${multiplier}`;
  els.decayFill.style.transform = `scaleX(${Math.max(0, Math.min(1, fraction))})`;
}

export function showSectionBanner(label) {
  if (bannerTimeout) clearTimeout(bannerTimeout);
  els.sectionBanner.textContent = label;
  els.sectionBanner.classList.remove('hidden');
  // rAF so the class removal above and the 'visible' add below land in
  // separate frames -- otherwise the opacity transition never plays.
  requestAnimationFrame(() => els.sectionBanner.classList.add('visible'));
  bannerTimeout = setTimeout(() => {
    els.sectionBanner.classList.remove('visible');
    setTimeout(() => els.sectionBanner.classList.add('hidden'), 300);
  }, 1800);
}

export function showCountdown(text) {
  els.countdown.textContent = text;
  els.countdown.classList.remove('hidden');
}

export function hideCountdown() {
  els.countdown.classList.add('hidden');
}

export function setPausedBadge(visible) {
  els.pausedBadge.classList.toggle('hidden', !visible);
}

export function showGameOver(finalScore, best) {
  els.finalScore.textContent = `SCORE: ${Math.floor(finalScore)}`;
  els.bestScore.textContent = `BEST: ${Math.floor(best)}`;
  els.gameoverOverlay.classList.remove('hidden');
}

export function hideGameOver() {
  els.gameoverOverlay.classList.add('hidden');
}
