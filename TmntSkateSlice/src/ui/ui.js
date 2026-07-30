// DOM/CSS overlay HUD (§7): "UI is a DOM/CSS overlay on top of the game
// canvas, not drawn into the canvas itself." Score/combo/lives/buffs/boxes/
// stage-banner/countdown/game-over all live here, updated via
// textContent/class toggles rather than re-created per frame.
//
// Every per-frame setter (setScore/setCombo/setLives/setBuffs/setBoxes) is
// called unconditionally every single frame from updateRunning() in
// core/main.js (not just when its value changes) -- so each dirty-checks
// against the last value it wrote and skips the DOM write when nothing
// changed. Found 2026-07-26 chasing an intermittent in-WebView stutter:
// these elements carry heavy paint properties (-webkit-text-stroke,
// text-shadow, paint-order), and forcing a style/paint recalc 60x/sec for
// values that are mostly NOT changing reads as periodic lag, especially in
// a resource-constrained mobile WebView.

import { BOX_COLORS } from '../data/boxColors.js';
import { OOZE_BUFF_DURATION_SEC, SHIELD_BUFF_DURATION_SEC, MAGNET_BUFF_DURATION_SEC } from '../data/constants.js';

// Active-buff chips (ooze/shield/magnet). Static icon URLs -- Vite only
// bundles new URL(import.meta.url) with a literal path, not a template.
const BUFF_ICON_URLS = {
  ooze: new URL('../assets/ooze_canister.png', import.meta.url).href,
  shield: new URL('../assets/powerup_shield.png', import.meta.url).href,
  magnet: new URL('../assets/powerup_magnet.png', import.meta.url).href,
};
const BUFF_CONFIGS = [
  { key: 'ooze', timerField: 'oozeBuffTimer', maxSec: OOZE_BUFF_DURATION_SEC, hex: '#1FC8D8' },
  { key: 'shield', timerField: 'shieldBuffTimer', maxSec: SHIELD_BUFF_DURATION_SEC, hex: '#4CE05A' },
  { key: 'magnet', timerField: 'magnetBuffTimer', maxSec: MAGNET_BUFF_DURATION_SEC, hex: '#F84FA0' },
];

let bannerHideTimer = null;

export function createUI() {
  const el = {
    countdown: document.getElementById('countdown-overlay'),
    score: document.getElementById('score'),
    combo: document.getElementById('combo'),
    livesTray: document.getElementById('lives-tray'),
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

  // Build one buff chip per timed ability (ooze/shield/magnet), hidden until
  // active. Icon + a depleting duration bar, color-coded. Wave has no chip --
  // it's instant; its own VFX/SFX is the feedback.
  el.buffTray = document.getElementById('buff-tray');
  el.buffChips = {};
  for (const b of BUFF_CONFIGS) {
    const chip = document.createElement('div');
    chip.className = 'buff-chip hidden';
    chip.style.setProperty('--buff-color', b.hex);
    const icon = document.createElement('img');
    icon.className = 'buff-icon';
    icon.src = BUFF_ICON_URLS[b.key];
    icon.alt = '';
    const bar = document.createElement('div');
    bar.className = 'buff-bar';
    const fill = document.createElement('div');
    fill.className = 'buff-fill';
    bar.appendChild(fill);
    chip.appendChild(icon);
    chip.appendChild(bar);
    el.buffTray.appendChild(chip);
    el.buffChips[b.key] = { chip, fill };
  }

  // Build one large collection-box chip per box once (hidden until active),
  // driven from data/boxColors.js. Each chip (redesign 2026-07-30): a big
  // pizza-box graphic where a full-opacity copy is REVEALED RADIALLY over a
  // faded "empty" copy as slices are caught (a conic mask -- non-text
  // progress feedback), wrapped by a depleting timer STROKE RING, with the
  // "N/8" count below. Color-coded via --box-color.
  const boxIconUrl = new URL('../assets/pizza_box.png', import.meta.url).href;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const RING_R = 47;
  const RING_C = 2 * Math.PI * RING_R; // circumference in the 100-unit viewBox
  el.boxTray = document.getElementById('box-tray');
  el.boxChips = {};
  for (const c of BOX_COLORS) {
    const chip = document.createElement('div');
    chip.className = 'box-chip hidden';
    chip.style.setProperty('--box-color', c.hex);

    const graphic = document.createElement('div');
    graphic.className = 'box-graphic';

    const ghost = document.createElement('img'); // faded "empty" box behind
    ghost.className = 'box-ghost';
    ghost.src = boxIconUrl;
    ghost.alt = '';
    const fillImg = document.createElement('img'); // full box, radially revealed
    fillImg.className = 'box-fill';
    fillImg.src = boxIconUrl;
    fillImg.alt = '';
    fillImg.style.setProperty('--fill', '0');

    const svg = document.createElementNS(SVGNS, 'svg'); // depleting timer ring
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.classList.add('box-ring');
    const track = document.createElementNS(SVGNS, 'circle');
    track.setAttribute('cx', '50');
    track.setAttribute('cy', '50');
    track.setAttribute('r', String(RING_R));
    track.classList.add('ring-track');
    const arc = document.createElementNS(SVGNS, 'circle');
    arc.setAttribute('cx', '50');
    arc.setAttribute('cy', '50');
    arc.setAttribute('r', String(RING_R));
    arc.classList.add('ring-arc');
    arc.style.strokeDasharray = RING_C.toFixed(2);
    arc.style.strokeDashoffset = '0';
    svg.appendChild(track);
    svg.appendChild(arc);

    graphic.appendChild(ghost);
    graphic.appendChild(fillImg);
    graphic.appendChild(svg);

    const count = document.createElement('span');
    count.className = 'box-count';

    chip.appendChild(graphic);
    chip.appendChild(count);
    el.boxTray.appendChild(chip);
    el.boxChips[c.id] = { chip, fillImg, arc, count, ringC: RING_C };
  }

  // Box-completion celebration popup (see showBoxComplete). Icon is the same
  // pizza-box art, set once.
  el.boxCompletePopup = document.getElementById('box-complete-popup');
  el.bcpTitle = document.getElementById('bcp-title');
  el.bcpBonus = document.getElementById('bcp-bonus');
  const bcpIcon = document.getElementById('bcp-icon');
  bcpIcon.src = boxIconUrl;

  // Last-written values, for the dirty-checks below.
  let lastScore = null;
  let lastComboKey = null;
  let lastLivesRemaining = null;
  const lastBoxKeys = {}; // per-box last-written key
  const lastBuffKeys = {}; // per-buff last-written key

  return {
    // Quick foreground celebration when a box completes: color-coded title +
    // bonus points + a bouncing box icon. Restarts the CSS animation each
    // call (remove class -> reflow -> re-add) so rapid completions replay.
    showBoxComplete(label, bonus, hex) {
      el.boxCompletePopup.style.setProperty('--bcp-color', hex);
      el.bcpTitle.textContent = `${label.toUpperCase()} BOX!`;
      el.bcpBonus.textContent = `+${bonus}`;
      el.boxCompletePopup.classList.remove('hidden');
      el.boxCompletePopup.classList.remove('bcp-animate');
      void el.boxCompletePopup.offsetWidth; // force reflow to restart the animation
      el.boxCompletePopup.classList.add('bcp-animate');
    },

    setBuffs(player) {
      for (const b of BUFF_CONFIGS) {
        const t = player[b.timerField];
        const chip = el.buffChips[b.key];
        // Key updates ~4x/sec for a smooth-ish depleting bar on a short buff,
        // still dirty-checked (no per-frame DOM write).
        const key = t > 0 ? Math.ceil(t * 4) : -1;
        if (key === lastBuffKeys[b.key]) continue;
        lastBuffKeys[b.key] = key;
        if (t > 0) {
          chip.chip.classList.remove('hidden');
          chip.fill.style.width = `${Math.max(0, (t / b.maxSec) * 100)}%`;
        } else {
          chip.chip.classList.add('hidden');
        }
      }
    },

    setBoxes(boxes) {
      for (const c of BOX_COLORS) {
        const b = boxes[c.id];
        const chip = el.boxChips[c.id];
        // Key updates ~2x/sec (for the depleting ring) + instantly on a
        // progress change -- still dirty-checked (no per-frame DOM write).
        const key = b.active ? `${b.progress}:${Math.ceil(b.timerRemaining * 2)}` : 'off';
        if (key === lastBoxKeys[c.id]) continue;
        lastBoxKeys[c.id] = key;
        if (b.active) {
          chip.chip.classList.remove('hidden');
          chip.count.textContent = `${b.progress}/${c.requiredCount}`;
          // radial reveal of the full box (0..1 of a full turn)
          chip.fillImg.style.setProperty('--fill', (b.progress / c.requiredCount).toFixed(3));
          // timer ring depletes: dashoffset 0 (full) -> circumference (empty)
          const frac = Math.max(0, Math.min(1, b.timerRemaining / c.timerSec));
          chip.arc.style.strokeDashoffset = (chip.ringC * (1 - frac)).toFixed(1);
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
