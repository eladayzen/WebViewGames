// DOM/CSS overlay HUD (§7): "UI is a DOM/CSS overlay on top of the game
// canvas, not drawn into the canvas itself." Score/combo/lives/ooze-buff/
// stage-banner/countdown/game-over all live here, updated via
// textContent/class toggles rather than re-created per frame.
//
// setScore/setCombo/setLives/setOozeBuff are called unconditionally every
// single frame from updateRunning() in core/main.js (not just when their
// value changes) -- so each one dirty-checks against the last value it
// wrote and skips the DOM write entirely when nothing changed. Found
// 2026-07-26 chasing an intermittent in-WebView stutter: these elements
// carry heavy paint properties (-webkit-text-stroke, text-shadow,
// paint-order), and forcing a style/paint recalc 60x/sec for values that
// are mostly NOT changing (score only moves on a catch, lives change maybe
// 3 times a whole run) is exactly the kind of per-frame DOM churn that
// reads as "the whole game feels laggy, periodic lag" -- especially inside
// a resource-constrained mobile WebView, not just a desktop browser tab.

import { BOX_COLORS } from '../data/boxColors.js';

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
    pauseButton: document.getElementById('pause-button'),
    pausedBadge: document.getElementById('paused-badge'),
    muteButton: document.getElementById('mute-button'),
  };

  // Build the 3 life icons once.
  el.livesTray.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const icon = document.createElement('div');
    icon.className = 'life-icon';
    icon.textContent = '🐢';
    el.livesTray.appendChild(icon);
  }

  // Build one collection-box chip per color once (hidden until active),
  // driven from data/boxColors.js so adding a color is a data change. Each
  // chip: a count ("3/8") over a depleting timer bar, tinted by the color.
  el.boxTray = document.getElementById('box-tray');
  el.boxChips = {};
  for (const c of BOX_COLORS) {
    const chip = document.createElement('div');
    chip.className = 'box-chip hidden';
    chip.style.setProperty('--box-color', c.hex);
    const count = document.createElement('span');
    count.className = 'box-count';
    const bar = document.createElement('div');
    bar.className = 'box-timer-bar';
    const fill = document.createElement('div');
    fill.className = 'box-timer-fill';
    bar.appendChild(fill);
    chip.appendChild(count);
    chip.appendChild(bar);
    el.boxTray.appendChild(chip);
    el.boxChips[c.id] = { chip, count, fill };
  }

  // Last-written values, for the dirty-checks below.
  let lastScore = null;
  let lastComboKey = null;
  let lastLivesRemaining = null;
  let lastOozePct = null; // -1 sentinel for "hidden", not a real percent
  const lastBoxKeys = {}; // per-color last-written key, for the box dirty-check

  return {
    setBoxes(boxes) {
      for (const c of BOX_COLORS) {
        const b = boxes[c.id];
        const chip = el.boxChips[c.id];
        // Key changes on progress or a whole-second timer tick, so the DOM
        // (and the timer-bar width) updates ~once/sec, not every frame --
        // same dirty-check discipline as every other setter here.
        const key = b.active ? `${b.progress}:${Math.ceil(b.timerRemaining)}` : 'off';
        if (key === lastBoxKeys[c.id]) continue;
        lastBoxKeys[c.id] = key;
        if (b.active) {
          chip.chip.classList.remove('hidden');
          chip.count.textContent = `${b.progress}/${c.requiredCount}`;
          chip.fill.style.width = `${Math.max(0, (b.timerRemaining / c.timerSec) * 100)}%`;
        } else {
          chip.chip.classList.add('hidden');
        }
      }
    },

    setScore(value) {
      const floored = Math.floor(value);
      if (floored === lastScore) return;
      lastScore = floored;
      el.score.textContent = `SCORE: ${floored}`;
    },

    setCombo(comboCount, multiplier) {
      const key = comboCount >= 2 ? multiplier.toFixed(1) : null;
      if (key === lastComboKey) return;
      lastComboKey = key;
      if (key !== null) {
        el.combo.classList.remove('hidden');
        el.combo.textContent = `COMBO x${key}`;
      } else {
        el.combo.classList.add('hidden');
      }
    },

    setLives(remaining) {
      if (remaining === lastLivesRemaining) return;
      lastLivesRemaining = remaining;
      const icons = el.livesTray.children;
      for (let i = 0; i < icons.length; i++) {
        icons[i].classList.toggle('spent', i >= remaining);
      }
    },

    setOozeBuff(remainingFrac) {
      const pct = remainingFrac > 0 ? Math.round(remainingFrac * 100) : -1;
      if (pct === lastOozePct) return;
      lastOozePct = pct;
      if (pct >= 0) {
        el.oozeIndicator.classList.remove('hidden');
        el.oozeFill.style.width = `${pct}%`;
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

    setPaused(isPaused) {
      el.pauseButton.innerHTML = isPaused ? '&#9654;' : '&#9208;'; // play : pause glyph
      el.pausedBadge.classList.toggle('hidden', !isPaused);
    },

    setMuted(isMuted) {
      el.muteButton.innerHTML = isMuted ? '&#128263;' : '&#128266;'; // muted : speaker-on glyph
    },
  };
}
