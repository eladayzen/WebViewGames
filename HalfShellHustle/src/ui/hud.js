// DOM/CSS overlay HUD (build doc §7: "a DOM/CSS overlay on top of the WebGL
// canvas, not drawn into the 3D scene itself"). POC has no CHASE meter and no
// score UI (§2, §7) -- just the optional bare distance counter the build doc
// explicitly allows ("a bare static distance counter can stand in if a HUD
// number is wanted for testing"), plus the gameover overlay's exact
// GoBalance SDK DOM contract and the cross-game Back/Pause chrome
// (BUILD_NOTES.md).

const distanceEl = document.getElementById('distance');
const gameoverEl = document.getElementById('gameover-overlay');
const finalDistanceEl = document.getElementById('final-distance');
const pausedBadgeEl = document.getElementById('paused-badge');

export function updateDistance(meters) {
  distanceEl.textContent = `${Math.floor(meters)}m`;
}

export function showGameOver(meters) {
  finalDistanceEl.textContent = `${Math.floor(meters)}m`;
  gameoverEl.classList.remove('hidden');
}

export function hideGameOver() {
  gameoverEl.classList.add('hidden');
}

export function setPausedBadge(paused) {
  pausedBadgeEl.classList.toggle('hidden', !paused);
}
