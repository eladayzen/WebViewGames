// DOM/CSS overlay HUD (§7): "UI is a DOM/CSS overlay on top of the game
// canvas, not drawn into the canvas itself." Score/combo/lives/ooze-buff/
// stage-banner/countdown/game-over all live here, updated via
// textContent/class toggles rather than re-created per frame.

let bannerHideTimer = null;

export function createUI() {
  const el = {
    countdown: document.getElementById('countdown-overlay'),
    score: document.getElementById('score'),
    combo: document.getElementById('combo'),
    livesTray: document.getElementById('lives-tray'),
    oozeIndicator: document.getElementById('ooze-indicator'),
    oozeFill: document.getElementById('ooze-fill'),
    stageBanner: document.getElementById('stage-banner'),
    gameoverOverlay: document.getElementById('gameover-overlay'),
    finalScore: document.getElementById('final-score'),
    finalCombo: document.getElementById('final-combo'),
  };

  // Build the 3 life icons once.
  el.livesTray.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const icon = document.createElement('div');
    icon.className = 'life-icon';
    icon.textContent = '🐢';
    el.livesTray.appendChild(icon);
  }

  return {
    setScore(value) {
      el.score.textContent = `SCORE: ${Math.floor(value)}`;
    },

    setCombo(comboCount, multiplier) {
      if (comboCount >= 2) {
        el.combo.classList.remove('hidden');
        el.combo.textContent = `COMBO x${multiplier.toFixed(1)}`;
      } else {
        el.combo.classList.add('hidden');
      }
    },

    setLives(remaining) {
      const icons = el.livesTray.children;
      for (let i = 0; i < icons.length; i++) {
        icons[i].classList.toggle('spent', i >= remaining);
      }
    },

    setOozeBuff(remainingFrac) {
      if (remainingFrac > 0) {
        el.oozeIndicator.classList.remove('hidden');
        el.oozeFill.style.width = `${Math.round(remainingFrac * 100)}%`;
      } else {
        el.oozeIndicator.classList.add('hidden');
      }
    },

    showStageBanner(label) {
      el.stageBanner.textContent = label;
      el.stageBanner.classList.remove('hidden');
      el.stageBanner.classList.add('visible');
      if (bannerHideTimer) clearTimeout(bannerHideTimer);
      bannerHideTimer = setTimeout(() => {
        el.stageBanner.classList.remove('visible');
        el.stageBanner.classList.add('hidden');
      }, 1700);
    },

    setCountdown(value) {
      if (value > 0) {
        el.countdown.classList.remove('hidden');
        el.countdown.textContent = Math.ceil(value);
      } else {
        el.countdown.classList.add('hidden');
      }
    },

    showGameOver(finalScore, bestCombo) {
      el.finalScore.textContent = `SCORE: ${Math.floor(finalScore)}`;
      el.finalCombo.textContent = `BEST COMBO: x${bestCombo}`;
      el.gameoverOverlay.classList.remove('hidden');
    },

    hideGameOver() {
      el.gameoverOverlay.classList.add('hidden');
    },
  };
}
