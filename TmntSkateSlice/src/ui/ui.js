// DOM/CSS overlay HUD (§7): "UI is a DOM/CSS overlay on top of the game
// canvas, not drawn into the canvas itself." Score/combo/lives/buffs/boxes/
// stage-complete/countdown/game-over all live here, updated via
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
import { BOMB_KILL_SET } from '../data/bombKills.js';
import { OOZE_BUFF_DURATION_SEC, SHIELD_BUFF_DURATION_SEC, MAGNET_BUFF_DURATION_SEC, MAX_LIVES } from '../data/constants.js';

// Active-buff chips (ooze/shield/magnet). Static icon URLs -- Vite only
// bundles new URL(import.meta.url) with a literal path, not a template.
const BUFF_ICON_URLS = {
  ooze: new URL('../assets/ooze_canister.png', import.meta.url).href,
  shield: new URL('../assets/powerup_shield.png', import.meta.url).href,
  magnet: new URL('../assets/powerup_magnet.png', import.meta.url).href,
};

// Intro tutorial step 1's item icons -- the real gameplay sprites (pizza +
// the 3 pickups), never new art, so it reads as "this is literally what
// falls," not a generic icon (same principle the reference pattern used).
const INTRO_GOOD_ICON_URLS = {
  pizza: new URL('../assets/pizza_slice.png', import.meta.url).href,
  shield: new URL('../assets/powerup_shield.png', import.meta.url).href,
  magnet: new URL('../assets/powerup_magnet.png', import.meta.url).href,
  wave: new URL('../assets/powerup_wave.png', import.meta.url).href,
};
const INTRO_BOMB_ICON_URL = new URL('../assets/bomb.png', import.meta.url).href;

// Same order as entities/player.js's RUN_CYCLE_KEYS -- step 2 plays the
// character's real run-cycle frames while it sweeps, not a static pose.
const INTRO_RUN_FRAME_URLS = [
  new URL('../assets/mike_run_1.png', import.meta.url).href,
  new URL('../assets/mike_run_3.png', import.meta.url).href,
];

// Per-color pizza-box art, keyed by box id (same literal-path rule as above --
// no template URLs). The cardboard is tinted to each set's color while the
// pizza stays golden, so the HUD chip reads at a glance as "which set am I
// collecting" (feedback 2026-07-30: colored glow alone wasn't informative
// enough). Regular keeps the classic brown box.
const BOX_ICON_URLS = {
  regular: new URL('../assets/pizza_box.png', import.meta.url).href,
  blue: new URL('../assets/pizza_box_blue.png', import.meta.url).href,
  purple: new URL('../assets/pizza_box_purple.png', import.meta.url).href,
  red: new URL('../assets/pizza_box_red.png', import.meta.url).href,
  // The bomb-kill set reuses the box-completion celebration with a bomb icon.
  bombsquad: new URL('../assets/bomb.png', import.meta.url).href,
};

// Booster reveal art/labels for the box-completion popup, keyed by the reward
// effect (see data/boxColors.js). The earned booster is shown BIG below the
// bonus so it reads as the important payoff (2026-08-02). 'wave' = "blow up".
const BOOSTER_INFO = {
  shield: { url: new URL('../assets/powerup_shield.png', import.meta.url).href, label: 'SHIELD', hex: '#4CE05A' },
  magnet: { url: new URL('../assets/powerup_magnet.png', import.meta.url).href, label: 'MAGNET', hex: '#F84FA0' },
  wave: { url: new URL('../assets/powerup_wave.png', import.meta.url).href, label: 'BLOW UP', hex: '#FF8A2E' },
};

// Up to this many box-completion celebrations can show at once so two boxes
// finishing close together don't cut each other off (2026-08-02). Must match
// the bcp-pop total duration in style.css so a slot frees exactly when its
// popup finishes fading.
const MAX_BOX_POPUPS = 3;
const BCP_ANIM_MS = 2900;
const BUFF_CONFIGS = [
  { key: 'ooze', timerField: 'oozeBuffTimer', maxSec: OOZE_BUFF_DURATION_SEC, hex: '#1FC8D8' },
  { key: 'shield', timerField: 'shieldBuffTimer', maxSec: SHIELD_BUFF_DURATION_SEC, hex: '#4CE05A' },
  { key: 'magnet', timerField: 'magnetBuffTimer', maxSec: MAGNET_BUFF_DURATION_SEC, hex: '#F84FA0' },
];


export function createUI() {
  const el = {
    countdown: document.getElementById('countdown-overlay'),
    score: document.getElementById('score'),
    scoreBar: document.getElementById('score-bar'),
    scoreBarFill: document.getElementById('score-bar-fill'),
    combo: document.getElementById('combo'),
    livesTray: document.getElementById('lives-tray'),
    stageCurtainLeft: document.getElementById('stage-curtain-left'),
    stageCurtainRight: document.getElementById('stage-curtain-right'),
    stageCompleteOverlay: document.getElementById('stage-complete-overlay'),
    scHeadline: document.getElementById('sc-headline'),
    scNext: document.getElementById('sc-next'),
    scCountdown: document.getElementById('sc-countdown'),
    gameoverOverlay: document.getElementById('gameover-overlay'),
    finalScore: document.getElementById('final-score'),
    finalCombo: document.getElementById('final-combo'),
    pauseButton: document.getElementById('pause-button'),
    pausedBadge: document.getElementById('paused-badge'),
    muteButton: document.getElementById('mute-button'),
    introOverlay: document.getElementById('intro-tutorial-overlay'),
    introStepItems: document.getElementById('intro-step-items'),
    introStepSteer: document.getElementById('intro-step-steer'),
    introSteerPlayer: document.getElementById('intro-steer-player'),
  };

  // Step 1's item icons -- set once, static content (unlike the box-reward
  // pool, this popup never changes what it shows).
  document.getElementById('intro-icon-pizza').src = INTRO_GOOD_ICON_URLS.pizza;
  document.getElementById('intro-icon-shield').src = INTRO_GOOD_ICON_URLS.shield;
  document.getElementById('intro-icon-magnet').src = INTRO_GOOD_ICON_URLS.magnet;
  document.getElementById('intro-icon-wave').src = INTRO_GOOD_ICON_URLS.wave;
  document.getElementById('intro-icon-bomb').src = INTRO_BOMB_ICON_URL;

  // Build MAX_LIVES life-icon slots once. Only the first `capacity` are shown
  // (the rest hidden) and the first `remaining` are full vs. spent -- see
  // setLives. Capacity can grow past the starting 3 via the red-box reward.
  el.livesTray.innerHTML = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    const icon = document.createElement('div');
    icon.className = 'life-icon';
    icon.textContent = '❤️';
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
  // "N/8" count below, and the box art tinted to that set's color
  // (BOX_ICON_URLS). Color-coded via --box-color.
  const SVGNS = 'http://www.w3.org/2000/svg';
  el.boxTray = document.getElementById('box-tray');
  el.boxChips = {};
  for (const c of BOX_COLORS) {
    const chip = document.createElement('div');
    chip.className = 'box-chip hidden';
    chip.style.setProperty('--box-color', c.hex);

    const graphic = document.createElement('div');
    graphic.className = 'box-graphic';

    const boxIconUrl = BOX_ICON_URLS[c.id] || BOX_ICON_URLS.regular;
    const ghost = document.createElement('img'); // faded "empty" box behind
    ghost.className = 'box-ghost';
    ghost.src = boxIconUrl;
    ghost.alt = '';
    const fillImg = document.createElement('img'); // full box, radially revealed
    fillImg.className = 'box-fill';
    fillImg.src = boxIconUrl;
    fillImg.alt = '';
    fillImg.style.setProperty('--fill', '0');

    // Rounded-square outer shape: a low-opacity black background (bg+track
    // rect) with the depleting timer as a stroke around its perimeter (arc
    // rect, pathLength-normalized to 100 so the offset math is perimeter-
    // independent).
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.classList.add('box-ring');
    const RECT = { x: '5', y: '5', width: '90', height: '90', rx: '20', ry: '20' };
    const bg = document.createElementNS(SVGNS, 'rect');
    for (const k in RECT) bg.setAttribute(k, RECT[k]);
    bg.classList.add('ring-bg');
    const arc = document.createElementNS(SVGNS, 'rect');
    for (const k in RECT) arc.setAttribute(k, RECT[k]);
    arc.classList.add('ring-arc');
    arc.setAttribute('pathLength', '100');
    arc.style.strokeDasharray = '100';
    arc.style.strokeDashoffset = '0';
    svg.appendChild(bg);
    svg.appendChild(arc);

    const count = document.createElement('span'); // now INSIDE the square
    count.className = 'box-count';

    // z-order: bg/ring behind, faded box, revealed box, count on top.
    graphic.appendChild(svg);
    graphic.appendChild(ghost);
    graphic.appendChild(fillImg);
    graphic.appendChild(count);

    chip.appendChild(graphic);
    el.boxTray.appendChild(chip);
    el.boxChips[c.id] = { chip, fillImg, arc, count };
  }

  // Bomb-kill set chip (2026-08-02) -- same visual language as the box chips
  // (bomb icon revealed radially as kills accumulate + "N/8" count) but with NO
  // timer ring (the set has no timer). Hidden until the first kill.
  {
    const chip = document.createElement('div');
    chip.className = 'box-chip hidden';
    chip.style.setProperty('--box-color', BOMB_KILL_SET.hex);

    const graphic = document.createElement('div');
    graphic.className = 'box-graphic';

    const bombUrl = new URL('../assets/bomb.png', import.meta.url).href;
    const ghost = document.createElement('img');
    ghost.className = 'box-ghost';
    ghost.src = bombUrl;
    ghost.alt = '';
    const fillImg = document.createElement('img');
    fillImg.className = 'box-fill';
    fillImg.src = bombUrl;
    fillImg.alt = '';
    fillImg.style.setProperty('--fill', '0');

    // Rounded-square panel (bg only -- no depleting timer arc).
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.classList.add('box-ring');
    const bg = document.createElementNS(SVGNS, 'rect');
    const RECT = { x: '5', y: '5', width: '90', height: '90', rx: '20', ry: '20' };
    for (const k in RECT) bg.setAttribute(k, RECT[k]);
    bg.classList.add('ring-bg');
    svg.appendChild(bg);

    const count = document.createElement('span');
    count.className = 'box-count';

    graphic.appendChild(svg);
    graphic.appendChild(ghost);
    graphic.appendChild(fillImg);
    graphic.appendChild(count);
    chip.appendChild(graphic);
    el.boxTray.appendChild(chip);
    el.bombChip = { chip, fillImg, count };
  }

  // Box-completion celebrations (see showBoxComplete). A small pool of popup
  // instances lives in the centered tray so up to MAX_BOX_POPUPS can show at
  // once (near-simultaneous completions mustn't cut each other off). Each has
  // the full structure: box icon + title + bonus + big earned-booster reveal +
  // "+1 LIFE". activeBoxPopups tracks the live ones newest-first.
  el.bcTray = document.getElementById('box-complete-tray');
  el.bcPopups = [];
  for (let i = 0; i < MAX_BOX_POPUPS; i++) {
    const root = document.createElement('div');
    root.className = 'box-complete-popup hidden';

    const icon = document.createElement('img');
    icon.className = 'bcp-icon';
    icon.src = BOX_ICON_URLS.regular;
    icon.alt = '';

    const textWrap = document.createElement('div');
    textWrap.className = 'bcp-text';
    const title = document.createElement('div');
    title.className = 'bcp-title';
    const bonus = document.createElement('div');
    bonus.className = 'bcp-bonus';
    textWrap.appendChild(title);
    textWrap.appendChild(bonus);

    // Up to 3 earned-booster slots (icon + label), shown side by side; a box
    // reveals 1-3 of them, the bomb-kill set reveals 2.
    const reward = document.createElement('div');
    reward.className = 'bcp-reward hidden';
    const rewardItems = [];
    for (let k = 0; k < 3; k++) {
      const rItem = document.createElement('div');
      rItem.className = 'bcp-reward-item hidden';
      const rIcon = document.createElement('img');
      rIcon.className = 'bcp-reward-icon';
      rIcon.alt = '';
      const rLabel = document.createElement('span');
      rLabel.className = 'bcp-reward-label';
      rItem.appendChild(rIcon);
      rItem.appendChild(rLabel);
      reward.appendChild(rItem);
      rewardItems.push({ item: rItem, icon: rIcon, label: rLabel });
    }

    const life = document.createElement('div');
    life.className = 'bcp-life hidden';
    life.textContent = '❤️ +1 LIFE';

    root.appendChild(icon);
    root.appendChild(textWrap);
    root.appendChild(reward);
    root.appendChild(life);
    el.bcTray.appendChild(root);

    el.bcPopups.push({ root, icon, title, bonus, reward, rewardItems, life, active: false, hideTimer: null });
  }
  let activeBoxPopups = []; // live popups, newest first

  // Assign each live popup its left-to-right slot via flex `order`: with 1 it's
  // centered; with 2 the newest is on the LEFT; with 3 the newest is in the
  // CENTER, and the two older ones keep their outer sides so none jump sideways
  // when a 3rd appears.
  function layoutBoxPopups() {
    const n = activeBoxPopups.length;
    activeBoxPopups.forEach((p, recency) => {
      // recency 0 = newest. order runs left(0) -> right(n-1).
      const order = n >= 3 ? [1, 0, 2][recency] : recency;
      p.root.style.order = String(order);
    });
  }

  // Resolve a HUD collection-chip id (a box color, or BOMB_KILL_SET.id) to its
  // DOM element -- shared by getChipCenterFrac/pulseChip below.
  function chipElFor(id) {
    if (el.boxChips[id]) return el.boxChips[id].chip;
    if (id === BOMB_KILL_SET.id) return el.bombChip.chip;
    return null;
  }

  // Last-written values, for the dirty-checks below.
  let lastScore = null;
  let lastComboKey = null;
  let lastLivesRemaining = null;
  const lastBoxKeys = {}; // per-box last-written key
  const lastBuffKeys = {}; // per-buff last-written key
  let lastBombKillKey = null; // bomb-kill chip last-written key
  let lastIntroRunFrame = null; // intro step 2's run-cycle frame last-written index
  let lastStageCountdownShown = null; // stage-complete countdown last-written whole-second

  // Snaps both curtain panels back to open (off-screen) with NO animation --
  // called at the START of every showStageComplete (defensive, in case a
  // fast repeat somehow left them mid-close). Same suppress-transition/
  // reflow/restore idiom needed anywhere else in this codebase a class
  // toggle must NOT animate.
  function resetStageCurtains() {
    for (const el2 of [el.stageCurtainLeft, el.stageCurtainRight]) {
      const prev = el2.style.transition;
      el2.style.transition = 'none';
      el2.classList.remove('stage-curtain-closed');
      void el2.offsetWidth;
      el2.style.transition = prev;
    }
  }

  function setIntroStep(step) {
    el.introStepItems.classList.toggle('hidden', step !== 1);
    el.introStepSteer.classList.toggle('hidden', step !== 2);
  }

  // index into INTRO_RUN_FRAME_URLS -- step 2's continuous board/character
  // sweep is pure CSS (see style.css), only the run-cycle frame itself is
  // dt-driven from core/main.js to match the real in-game cadence.
  function setIntroRunFrame(index) {
    if (index === lastIntroRunFrame) return;
    lastIntroRunFrame = index;
    el.introSteerPlayer.src = INTRO_RUN_FRAME_URLS[index];
  }

  return {
    // Foreground celebration when a box completes: color-coded title + bonus +
    // a bouncing box icon, then a BIG reveal of the booster you earned (+ "+1
    // LIFE" for the red box). Up to MAX_BOX_POPUPS play at once, side by side
    // and centered, so near-simultaneous completions don't cut each other off.
    showBoxComplete(label, bonus, hex, id, reward) {
      // A free pool slot, or recycle the OLDEST live one if all are busy -- a
      // 4th completion still shows (replacing the oldest), never the newest.
      let slot = el.bcPopups.find((p) => !p.active);
      if (!slot) {
        slot = activeBoxPopups[activeBoxPopups.length - 1];
        activeBoxPopups = activeBoxPopups.filter((p) => p !== slot);
        if (slot.hideTimer) clearTimeout(slot.hideTimer);
      }

      // Populate.
      slot.root.style.setProperty('--bcp-color', hex);
      slot.icon.src = BOX_ICON_URLS[id] || BOX_ICON_URLS.regular;
      slot.title.textContent = `${label.toUpperCase()} BOX!`;
      slot.bonus.textContent = `+${bonus}`;
      const effects = (reward && reward.effects) || [];
      slot.rewardItems.forEach((ri, k) => {
        const info = k < effects.length ? BOOSTER_INFO[effects[k]] : null;
        if (info) {
          ri.item.style.setProperty('--bcp-reward-color', info.hex);
          ri.icon.src = info.url;
          ri.label.textContent = info.label;
          ri.item.classList.remove('hidden');
        } else {
          ri.item.classList.add('hidden');
        }
      });
      slot.reward.classList.toggle('hidden', effects.length === 0);
      slot.life.classList.toggle('hidden', !(reward && reward.grantLife));

      // Mark live (newest first) + restart its animation.
      slot.active = true;
      activeBoxPopups.unshift(slot);
      slot.root.classList.remove('hidden');
      slot.root.classList.remove('bcp-animate');
      void slot.root.offsetWidth; // force reflow to restart the animation
      slot.root.classList.add('bcp-animate');

      slot.hideTimer = setTimeout(() => {
        slot.active = false;
        slot.hideTimer = null;
        slot.root.classList.add('hidden');
        slot.root.classList.remove('bcp-animate');
        activeBoxPopups = activeBoxPopups.filter((p) => p !== slot);
        layoutBoxPopups();
      }, BCP_ANIM_MS);

      layoutBoxPopups();
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
          // timer stroke depletes around the rounded square (pathLength 100)
          const frac = Math.max(0, Math.min(1, b.timerRemaining / c.timerSec));
          chip.arc.style.strokeDashoffset = (100 * (1 - frac)).toFixed(1);
        } else {
          chip.chip.classList.add('hidden');
        }
      }
    },

    // Bomb-kill chip: shown once you've killed at least one bomb, radial reveal
    // + "N/8" count. No timer. Dirty-checked like the other per-frame setters.
    setBombKills(bombKills) {
      const active = bombKills.progress > 0;
      const key = active ? String(bombKills.progress) : 'off';
      if (key === lastBombKillKey) return;
      lastBombKillKey = key;
      if (active) {
        el.bombChip.chip.classList.remove('hidden');
        el.bombChip.count.textContent = `${bombKills.progress}/${BOMB_KILL_SET.requiredCount}`;
        el.bombChip.fillImg.style.setProperty('--fill', (bombKills.progress / BOMB_KILL_SET.requiredCount).toFixed(3));
      } else {
        el.bombChip.chip.classList.add('hidden');
      }
    },

    // Screen-space center of a HUD collection chip (a box, by color id, or the
    // bomb-kill set via BOMB_KILL_SET.id), in canvas fractions -- the target a
    // collected shred flies toward (see spawnCollectFlyer). Falls back to the
    // tray's bottom-center when the chip isn't visible yet (first catch, before
    // setBoxes/setBombKills un-hides it).
    getChipCenterFrac(id) {
      const chip = chipElFor(id);
      let r = chip && chip.getBoundingClientRect();
      if (!r || r.width === 0) r = el.boxTray.getBoundingClientRect();
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      return { xFrac: (r.left + r.width / 2) / w, yFrac: (r.top + r.height / 2) / h };
    },

    // Quick "bloop" pulse on a HUD chip when a shred lands in it (restart the
    // CSS animation: remove -> reflow -> re-add so rapid catches replay).
    pulseChip(id) {
      const chip = chipElFor(id);
      if (!chip) return;
      chip.classList.remove('bloop');
      void chip.offsetWidth;
      chip.classList.add('bloop');
    },

    // Shows "<score>/<next level threshold>" (no "SCORE:" label) with a
    // progression fill bar toward that threshold; bare score + hidden bar on
    // the final stage (nextThreshold is Infinity -- no next level to show).
    setScore(value, prevThreshold, nextThreshold) {
      const floored = Math.floor(value);
      const hasNext = Number.isFinite(nextThreshold);
      const key = `${floored}:${hasNext ? nextThreshold : 'inf'}`;
      if (key === lastScore) return;
      lastScore = key;
      el.score.textContent = hasNext ? `${floored}/${nextThreshold}` : `${floored}`;
      if (hasNext) {
        const span = Math.max(1, nextThreshold - prevThreshold);
        const frac = Math.max(0, Math.min(1, (floored - prevThreshold) / span));
        el.scoreBarFill.style.width = `${(frac * 100).toFixed(1)}%`;
        el.scoreBar.classList.remove('hidden');
      } else {
        el.scoreBar.classList.add('hidden');
      }
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

    setLives(remaining, capacity = 3) {
      const key = `${remaining}:${capacity}`;
      if (key === lastLivesRemaining) return;
      lastLivesRemaining = key;
      const icons = el.livesTray.children;
      for (let i = 0; i < icons.length; i++) {
        // hidden beyond current capacity; within it, full up to `remaining`,
        // spent (grayed) for the lost hearts in between.
        icons[i].classList.toggle('life-hidden', i >= capacity);
        icons[i].classList.toggle('spent', i < capacity && i >= remaining);
      }
    },

    // Stage-complete transition (freeze + curtain, ported from
    // HalfShellHustle's level-complete pattern -- see
    // WEB_MINIGAME_TECH_RETROSPECTIVE.md, data/stageTransition.js, and
    // core/main.js's beginStageComplete/frame() 'stagecomplete' branch,
    // which drives all of this on dt, not a wall-clock setTimeout, so
    // pausing genuinely holds it. showStageComplete resets the curtains to
    // open (defensive, in case a fast repeat left them mid-close) and
    // restarts the headline pop the same remove/reflow/re-add way every
    // other one-shot animation in this file does.
    showStageComplete(nextName) {
      resetStageCurtains();
      lastStageCountdownShown = null;
      el.scNext.textContent = `NEXT: ${nextName.toUpperCase()}`;
      el.scHeadline.classList.remove('sc-headline-play');
      void el.scHeadline.offsetWidth;
      el.scHeadline.classList.add('sc-headline-play');
      el.stageCompleteOverlay.classList.remove('hidden');
    },

    hideStageComplete() {
      el.stageCompleteOverlay.classList.add('hidden');
      el.scHeadline.classList.remove('sc-headline-play');
    },

    // core/main.js triggers this partway through the countdown (data/
    // stageTransition.js's STAGE_CURTAIN_CLOSE_DELAY_SEC), not immediately
    // on show -- the headline gets a clear beat to itself first. Adding the
    // class is enough; style.css's transition on .stage-curtain's transform
    // does the animating.
    closeStageCurtains() {
      el.stageCurtainLeft.classList.add('stage-curtain-closed');
      el.stageCurtainRight.classList.add('stage-curtain-closed');
    },

    // core/main.js calls this once the stage swap is done and gameplay is
    // about to resume -- the curtains slide back open to reveal the new
    // stage already in motion rather than popping straight to it.
    openStageCurtains() {
      el.stageCurtainLeft.classList.remove('stage-curtain-closed');
      el.stageCurtainRight.classList.remove('stage-curtain-closed');
    },

    // Re-triggers the pop animation per whole second so each number lands
    // with its own beat instead of the digits silently swapping. Dirty-
    // checked because the caller ticks this every frame.
    setStageCountdown(seconds) {
      if (seconds === lastStageCountdownShown) return;
      lastStageCountdownShown = seconds;
      el.scCountdown.textContent = `${seconds}`;
      el.scCountdown.classList.remove('sc-tick');
      void el.scCountdown.offsetWidth;
      el.scCountdown.classList.add('sc-tick');
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

    // First-run onboarding tutorial (see core/gameState.js's 'intro' state
    // and core/main.js's beginIntro/advanceIntroStep/dismissIntro). Called
    // fresh at the start of every run, not gated behind a "seen it" flag.
    showIntroTutorial() {
      el.introOverlay.classList.remove('hidden');
      lastIntroRunFrame = null;
      setIntroStep(1);
      setIntroRunFrame(0);
    },

    hideIntroTutorial() {
      el.introOverlay.classList.add('hidden');
    },

    setIntroStep,
    setIntroRunFrame,
  };
}
