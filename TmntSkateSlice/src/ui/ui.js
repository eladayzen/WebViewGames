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
import { OOZE_BUFF_DURATION_SEC, SHIELD_BUFF_DURATION_SEC, MAGNET_BUFF_DURATION_SEC, MAX_LIVES, BOX_COMPLETE_FLY_MS } from '../data/constants.js';
// '@hero-assets' resolves to a genuinely separate per-theme file (see
// vite.config.js) -- same import core/assets.js uses, so this and the main
// manifest can never disagree about which hero's run-cycle frames to show.
import { HERO_SPRITES } from '@hero-assets';
// The intro tutorial's step-2 sweep plays the real run cycle; source its frame
// order from player.js so it can't drift from the actual gameplay animation.
import { RUN_CYCLE_KEYS } from '../entities/player.js';
// Per-theme collectible art (see collectibleAssets.*.js): the original theme's
// HUD box chips + intro "catch" icon use the SAME idol art that falls; TMNT
// keeps its cardboard-box chips and pizza-slice icon. Same build-time alias
// as '@hero-assets'.
import {
  BOX_ICON_URLS as THEME_BOX_ICON_URLS,
  INTRO_PRIMARY_GOOD_URL,
  boxCompleteTitle,
  STAGE_CURTAIN_LEFT_URL,
  STAGE_CURTAIN_RIGHT_URL,
  STAGE_CURTAIN_LEFT_POS,
  STAGE_CURTAIN_RIGHT_POS,
} from '@collectible-assets';

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
  pizza: INTRO_PRIMARY_GOOD_URL, // theme-provided: an idol (original) or the pizza slice (TMNT)
  shield: new URL('../assets/powerup_shield.png', import.meta.url).href,
  magnet: new URL('../assets/powerup_magnet.png', import.meta.url).href,
  wave: new URL('../assets/powerup_wave.png', import.meta.url).href,
};
const INTRO_BOMB_ICON_URL = new URL('../assets/bomb.png', import.meta.url).href;

// Step 2 plays the character's REAL run-cycle while it sweeps, not a static
// pose. Built from player.js's exported RUN_CYCLE_KEYS (the single source of
// truth) mapped through the per-theme HERO_SPRITES, so it always matches the
// exact sequence the game plays -- including the 3-pose ping-pong -- and can
// never drift the way a hand-kept frame list did.
const INTRO_RUN_FRAME_URLS = RUN_CYCLE_KEYS.map((k) => HERO_SPRITES[k]);

// Per-color pizza-box art, keyed by box id (same literal-path rule as above --
// no template URLs). The cardboard is tinted to each set's color while the
// pizza stays golden, so the HUD chip reads at a glance as "which set am I
// collecting" (feedback 2026-07-30: colored glow alone wasn't informative
// enough). Regular keeps the classic brown box.
const BOX_ICON_URLS = {
  // The 4 color chips come from the active theme (idols for original, colored
  // cardboard boxes for TMNT) -- see collectibleAssets.*.js.
  ...THEME_BOX_ICON_URLS,
  // The bomb-kill set reuses the box-completion celebration with a bomb icon
  // (theme-neutral, stays here).
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

// --- JS-driven UI animation ---------------------------------------------
// These used to be CSS @keyframes / class-toggle animations. On the occluded
// WebView (Unity editor overlay) the compositor is suspended, so CSS
// animations freeze -- while the JS rAF loop keeps running because Unity pumps
// it (WebGameBridge's __pumpFrames). Driving these per-frame from core/main.js,
// writing transform/opacity directly, means they ride that same pump.
function lerp(a, b, f) {
  return a + (b - a) * f;
}

// Bouncy elastic pop for the stage-complete headline, matching the old
// sc-headline-bounce keyframe stops. `u` is 0..1 over the 0.7s pop.
function headlinePopAt(u) {
  if (u <= 0.55) {
    const f = u / 0.55;
    return { scale: lerp(0.2, 1.18, f), rot: lerp(-8, 4, f), op: lerp(0, 1, f) };
  }
  if (u <= 0.75) {
    const f = (u - 0.55) / 0.2;
    return { scale: lerp(1.18, 0.94, f), rot: lerp(4, -2, f), op: 1 };
  }
  const f = (u - 0.75) / 0.25;
  return { scale: lerp(0.94, 1, f), rot: lerp(-2, 0, f), op: 1 };
}

// Shared leaderboard renderer for the game-over overlay AND the quit board --
// both show the same family-account board (systems/scoreboard.js). Takes the
// three target elements so one implementation drives both. `board` is
// fetchBoard()'s result; `groups` is an array of row-arrays (leaders, and
// optionally a window around your run) with a `·  ·  ·` separator between them.
// No avatars: rows are rank | name | score (see .sb-row in style.css). Safe
// no-op that hides the section when the board is unavailable or empty.
function renderBoardInto(rootEl, titleEl, listEl, board, groups) {
  if (!rootEl) return;
  const list = (groups || []).filter((g) => g && g.length);
  if (!board || !board.available || !list.length) {
    rootEl.classList.add('hidden');
    return;
  }
  titleEl.textContent = board.complete ? 'BEST ON THIS ACCOUNT' : 'BEST ON THIS DEVICE';
  listEl.innerHTML = '';
  list.forEach((rows, gi) => {
    if (gi > 0) {
      const gap = document.createElement('li');
      gap.className = 'sb-gap';
      gap.textContent = '·  ·  ·';
      listEl.appendChild(gap);
    }
    rows.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'sb-row' + (r.isRun ? ' sb-you' : r.isYou ? ' sb-mine' : '');
      const rank = document.createElement('span');
      rank.className = 'sb-rank';
      rank.textContent = String(r.rank); // TRUE rank, never the group index
      const name = document.createElement('span');
      name.className = 'sb-name';
      name.textContent = r.name || 'PLAYER';
      const score = document.createElement('span');
      score.className = 'sb-score';
      score.textContent = Number(r.score || 0).toLocaleString();
      li.appendChild(rank);
      li.appendChild(name);
      li.appendChild(score);
      listEl.appendChild(li);
    });
  });
  rootEl.classList.remove('hidden');
}


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
    scoreboard: document.getElementById('scoreboard'),
    scoreboardTitle: document.getElementById('scoreboard-title'),
    scoreboardRows: document.getElementById('scoreboard-rows'),
    confirmOverlay: document.getElementById('confirm-overlay'),
    quitOverlay: document.getElementById('quit-overlay'),
    quitStats: document.getElementById('quit-stats'),
    quitScoreboard: document.getElementById('quit-scoreboard'),
    quitScoreboardTitle: document.getElementById('quit-scoreboard-title'),
    quitScoreboardRows: document.getElementById('quit-scoreboard-rows'),
    pauseButton: document.getElementById('pause-button'),
    pausedBadge: document.getElementById('paused-badge'),
    introOverlay: document.getElementById('intro-tutorial-overlay'),
    introStepItems: document.getElementById('intro-step-items'),
    introStepSteer: document.getElementById('intro-step-steer'),
    introSteerPlayer: document.getElementById('intro-steer-player'),
    introSteerBoard: document.getElementById('intro-steer-board'),
  };

  // Stage-transition curtain art is theme-provided (see collectibleAssets.*.js)
  // and applied via CSS vars, so the shared style.css carries no hardcoded
  // curtain path and the non-selected theme's drape never enters the build.
  // Set once at init; the panels stay off-screen until a stage transition.
  if (el.stageCurtainLeft) {
    el.stageCurtainLeft.style.setProperty('--stage-curtain-left-img', `url("${STAGE_CURTAIN_LEFT_URL}")`);
    el.stageCurtainLeft.style.setProperty('--stage-curtain-left-pos', STAGE_CURTAIN_LEFT_POS);
  }
  if (el.stageCurtainRight) {
    el.stageCurtainRight.style.setProperty('--stage-curtain-right-img', `url("${STAGE_CURTAIN_RIGHT_URL}")`);
    el.stageCurtainRight.style.setProperty('--stage-curtain-right-pos', STAGE_CURTAIN_RIGHT_POS);
  }

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
  // driven from data/boxColors.js. Each chip (redesign 2026-07-30, timer
  // bar added 2026-08-04): a big pizza-box graphic where a full-opacity
  // copy is REVEALED RADIALLY over a faded "empty" copy as slices are
  // caught (a conic mask -- non-text progress feedback), wrapped by a
  // stroke ring that MIRRORS that same progress fraction, with the "N/8"
  // count below, and the box art tinted to that set's color (BOX_ICON_URLS).
  // Time gets its OWN indicator now -- a small stopwatch icon + thin bar
  // above the chip (.box-timer) -- since sharing the ring between progress
  // and time read as ambiguous. Color-coded via --box-color.
  const SVGNS = 'http://www.w3.org/2000/svg';
  el.boxTray = document.getElementById('box-tray');
  el.boxChips = {};
  for (const c of BOX_COLORS) {
    const chip = document.createElement('div');
    chip.className = 'box-chip hidden';
    chip.style.setProperty('--box-color', c.hex);

    // Thin countdown bar + stopwatch icon ABOVE the chip (2026-08-04) -- the
    // ring below used to deplete on time, but that read as ambiguous
    // ("what is this circle even showing?"); it's now repurposed to mirror
    // the pizza art's own progress fill (see setBoxes), so time gets its
    // own unambiguous, differently-shaped indicator instead of sharing the
    // ring with progress.
    const timerRow = document.createElement('div');
    timerRow.className = 'box-timer';
    const timerIcon = document.createElement('span');
    timerIcon.className = 'box-timer-icon';
    timerIcon.textContent = '⏱️';
    const timerTrack = document.createElement('div');
    timerTrack.className = 'box-timer-track';
    const timerFill = document.createElement('div');
    timerFill.className = 'box-timer-fill';
    timerTrack.appendChild(timerFill);
    timerRow.appendChild(timerIcon);
    timerRow.appendChild(timerTrack);
    chip.appendChild(timerRow);

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
    // rect) with the progress fraction as a stroke around its perimeter (arc
    // rect, pathLength-normalized to 100 so the offset math is perimeter-
    // independent) -- see setBoxes.
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
    el.boxChips[c.id] = { chip, fillImg, arc, count, timerFill };
  }

  // Bomb-kill set chip (2026-02-02, timer added 2026-08-04) -- same visual
  // language as the box chips now that it has both progress AND a real
  // timer: bomb icon revealed radially as kills accumulate + a progress-
  // mirroring ring + "N/8" count, plus its own .box-timer bar above. Hidden
  // until the first kill.
  {
    const chip = document.createElement('div');
    chip.className = 'box-chip hidden';
    chip.style.setProperty('--box-color', BOMB_KILL_SET.hex);

    const timerRow = document.createElement('div');
    timerRow.className = 'box-timer';
    const timerIcon = document.createElement('span');
    timerIcon.className = 'box-timer-icon';
    timerIcon.textContent = '⏱️';
    const timerTrack = document.createElement('div');
    timerTrack.className = 'box-timer-track';
    const timerFill = document.createElement('div');
    timerFill.className = 'box-timer-fill';
    timerTrack.appendChild(timerFill);
    timerRow.appendChild(timerIcon);
    timerRow.appendChild(timerTrack);
    chip.appendChild(timerRow);

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

    const count = document.createElement('span');
    count.className = 'box-count';

    graphic.appendChild(svg);
    graphic.appendChild(ghost);
    graphic.appendChild(fillImg);
    graphic.appendChild(count);
    chip.appendChild(graphic);
    el.boxTray.appendChild(chip);
    el.bombChip = { chip, fillImg, arc, count, timerFill };
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

    el.bcPopups.push({ root, icon, title, bonus, reward, rewardItems, life, active: false, revealTimer: null, hideTimer: null });
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

  // "Shoots" a small clone of the just-completed chip from its position in
  // the bottom tray up to the celebration popup that's replacing it, with a
  // slight scale-up, disappearing right as/when it arrives -- so it reads
  // as "this filled-up chip flew up and burst into that experience," not as
  // two disconnected events (feedback 2026-08-04). A transient clone, not
  // the real chip element: the real chip already hides itself via the
  // normal setBoxes/setBombKills dirty-check the instant this frame's HUD
  // update runs, so this is purely a decorative bridge between the two.
  // Twice as long + a genuine ease-IN curve (starts slow, accelerates into
  // the landing), per feedback 2026-08-04 -- was 380ms/an ease-in-out-style
  // curve that read as arriving too fast/abrupt. Duration lives in
  // constants.js as BOX_COMPLETE_FLY_MS since core/main.js also times the
  // completion's game-state effects off it (see showBoxComplete below).
  function shootChipToPopup(id, hex, targetIconEl) {
    const chipEl = chipElFor(id);
    if (!chipEl) return;
    const startRect = chipEl.getBoundingClientRect();
    const targetRect = targetIconEl.getBoundingClientRect();
    if (startRect.width === 0 || targetRect.width === 0) return; // defensive: nothing visible to fly from/to

    const icon = document.createElement('img');
    icon.className = 'chip-shoot-fly';
    icon.src = BOX_ICON_URLS[id] || BOX_ICON_URLS.regular;
    icon.style.setProperty('--shoot-color', hex);
    icon.style.left = `${startRect.left}px`;
    icon.style.top = `${startRect.top}px`;
    icon.style.width = `${startRect.width}px`;
    icon.style.height = `${startRect.width}px`;
    document.body.appendChild(icon);
    void icon.offsetWidth; // lock in the start position before animating

    const dx = (targetRect.left + targetRect.width / 2) - (startRect.left + startRect.width / 2);
    const dy = (targetRect.top + targetRect.height / 2) - (startRect.top + startRect.width / 2);
    icon.style.transition =
      `transform ${BOX_COMPLETE_FLY_MS}ms cubic-bezier(0.55, 0.055, 0.675, 0.19), ` + // easeInCubic -- slow start, accelerating hard into the landing
      `opacity 110ms ease-in ${BOX_COMPLETE_FLY_MS - 110}ms`; // stays fully visible until the very end, then vanishes fast right at arrival
    icon.style.transform = `translate(${dx}px, ${dy}px) scale(1.2)`;
    icon.style.opacity = '0';

    setTimeout(() => icon.remove(), BOX_COMPLETE_FLY_MS + 50);
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
  let lastHudScale = null; // setHudScale's last-written value

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

  // index into INTRO_RUN_FRAME_URLS -- the run-cycle frame is dt-driven from
  // core/main.js to match the real in-game cadence (the left/right sweep of
  // the board+character is setIntroSweep below).
  function setIntroRunFrame(index) {
    if (index === lastIntroRunFrame) return;
    lastIntroRunFrame = index;
    el.introSteerPlayer.src = INTRO_RUN_FRAME_URLS[index];
  }

  // Step 2's continuous board-tilt + character sweep, driven per-frame from
  // core/main.js (NOT a CSS @keyframes -- those freeze on the occluded WebView,
  // see the module-level note above). `phase` is 0..1 over one loop; cos gives
  // a natural ease-in-out swing 1 -> -1 -> 1 (left extreme -> right -> left).
  function setIntroSweep(phase) {
    const c = Math.cos(phase * Math.PI * 2);
    if (el.introSteerBoard) {
      el.introSteerBoard.style.transform = `perspective(380px) rotateY(${(-58 * c).toFixed(2)}deg)`;
    }
    if (el.introSteerPlayer) {
      el.introSteerPlayer.style.transform = `translateX(${(-72 * c).toFixed(2)}px)`;
    }
  }

  return {
    // Foreground celebration when a box completes: color-coded title + bonus +
    // a bouncing box icon, then a BIG reveal of the booster you earned (+ "+1
    // LIFE" for the red box). Up to MAX_BOX_POPUPS play at once, side by side
    // and centered, so near-simultaneous completions don't cut each other off.
    // Stays invisible (bcp-pending) until the flying twin chip lands, then
    // reveals -- core/main.js times the completion's game-state effects
    // (score bonus, booster/life grant, particle burst, sfx) off its OWN
    // independent BOX_COMPLETE_FLY_MS timer rather than a callback from
    // here, so those effects are never silently lost if this popup's slot
    // gets recycled before it reveals (see the pool-recycle branch below).
    showBoxComplete(label, bonus, hex, id, reward) {
      // A free pool slot, or recycle the OLDEST live one if all are busy -- a
      // 4th completion still shows (replacing the oldest), never the newest.
      let slot = el.bcPopups.find((p) => !p.active);
      if (!slot) {
        slot = activeBoxPopups[activeBoxPopups.length - 1];
        activeBoxPopups = activeBoxPopups.filter((p) => p !== slot);
        if (slot.hideTimer) clearTimeout(slot.hideTimer);
        if (slot.revealTimer) clearTimeout(slot.revealTimer);
      }

      // Populate immediately (content + layout, so the tray reserves its
      // spot and slot.icon has a real screen rect to fly toward) but stay
      // invisible via bcp-pending -- the reveal is held until the flying
      // twin chip actually lands, see below (2026-08-04).
      slot.root.style.setProperty('--bcp-color', hex);
      slot.icon.src = BOX_ICON_URLS[id] || BOX_ICON_URLS.regular;
      slot.title.textContent = boxCompleteTitle(label, id); // theme-scoped: "SET COMPLETE!" (original) / "<COLOR> BOX!" (TMNT)
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

      slot.active = true;
      activeBoxPopups.unshift(slot);
      slot.root.classList.remove('hidden');
      slot.root.classList.remove('bcp-animate');
      slot.root.classList.add('bcp-pending');
      layoutBoxPopups();

      // NOW that it's laid out (its icon has a real screen rect), shoot the
      // completed chip up into it -- see shootChipToPopup. The reveal below
      // is timed to land exactly when this arrives.
      shootChipToPopup(id, hex, slot.icon);

      slot.revealTimer = setTimeout(() => {
        slot.revealTimer = null;
        slot.root.classList.remove('bcp-pending');
        void slot.root.offsetWidth; // force reflow to (re)start the animation
        slot.root.classList.add('bcp-animate');

        slot.hideTimer = setTimeout(() => {
          slot.active = false;
          slot.hideTimer = null;
          slot.root.classList.add('hidden');
          slot.root.classList.remove('bcp-animate');
          activeBoxPopups = activeBoxPopups.filter((p) => p !== slot);
          layoutBoxPopups();
        }, BCP_ANIM_MS);
      }, BOX_COMPLETE_FLY_MS);
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
          const progressFrac = b.progress / c.requiredCount;
          chip.fillImg.style.setProperty('--fill', progressFrac.toFixed(3));
          // Ring stroke MIRRORS that same progress fraction now (2026-08-04,
          // was time -- see the chip-build comment above) -- reinforces the
          // pizza art's own fill instead of showing a second, different
          // metric on the same shape.
          chip.arc.style.strokeDashoffset = (100 * (1 - progressFrac)).toFixed(1);
          // The NEW, unambiguous time indicator: a thin bar that shrinks
          // left-to-right as the timer runs out, same width-percent
          // technique .buff-fill already uses for buff durations.
          const timeFrac = Math.max(0, Math.min(1, b.timerRemaining / c.timerSec));
          chip.timerFill.style.width = `${(timeFrac * 100).toFixed(1)}%`;
        } else {
          chip.chip.classList.add('hidden');
        }
      }
    },

    // Bomb-kill chip: shown once you've killed at least one bomb, radial
    // reveal + progress-mirroring ring + "N/8" count + its own .box-timer
    // bar (2026-08-04, now has a real timer -- see data/bombKills.js).
    // Dirty-checked like the other per-frame setters.
    setBombKills(bombKills) {
      const key = bombKills.active ? `${bombKills.progress}:${Math.ceil(bombKills.timerRemaining * 2)}` : 'off';
      if (key === lastBombKillKey) return;
      lastBombKillKey = key;
      if (bombKills.active) {
        el.bombChip.chip.classList.remove('hidden');
        el.bombChip.count.textContent = `${bombKills.progress}/${BOMB_KILL_SET.requiredCount}`;
        const progressFrac = bombKills.progress / BOMB_KILL_SET.requiredCount;
        el.bombChip.fillImg.style.setProperty('--fill', progressFrac.toFixed(3));
        el.bombChip.arc.style.strokeDashoffset = (100 * (1 - progressFrac)).toFixed(1);
        const timeFrac = Math.max(0, Math.min(1, bombKills.timerRemaining / BOMB_KILL_SET.timerSec));
        el.bombChip.timerFill.style.width = `${(timeFrac * 100).toFixed(1)}%`;
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

    // Scales the box-tray HUD up on tall viewports (big tablets) so it
    // doesn't read as tiny relative to the screen (2026-08-16 feedback) --
    // fixed-px DOM sizing looks "right" at phone size but shrinks toward
    // nothing, proportionally, on a much taller device. Called every frame
    // (see core/main.js's frame()) rather than only on a `resize` event,
    // same reasoning as render.js's per-frame width/height read: Unity
    // doesn't reliably fire `resize` inside the real WebView. Dirty-checked
    // like every other setter here so a steady viewport costs one number
    // comparison, not a style write, 60x/sec.
    setHudScale(scale) {
      const rounded = scale.toFixed(3);
      if (rounded === lastHudScale) return;
      lastHudScale = rounded;
      document.documentElement.style.setProperty('--hud-scale', rounded);
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

    // DISABLED for now (2026-08-06 feedback) -- core/main.js no longer
    // calls this, so #combo stays at its default `hidden` (index.html).
    // Left defined, unused, as the re-enable hook.
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
      // Seed the headline at the pop's start frame; core/main.js drives it up
      // per-frame via setStageHeadlineAnim (JS, so it rides the WebView pump
      // instead of a CSS timeline that freezes on the occluded overlay).
      el.scHeadline.style.transform = 'scale(0.2) rotate(-8deg)';
      el.scHeadline.style.opacity = '0';
      el.stageCompleteOverlay.classList.remove('hidden');
    },

    hideStageComplete() {
      el.stageCompleteOverlay.classList.add('hidden');
    },

    // Bouncy headline pop, driven per-frame. `t` is seconds since the stage-
    // complete overlay showed; holds settled after the 0.7s pop.
    setStageHeadlineAnim(t) {
      const s = headlinePopAt(Math.max(0, Math.min(1, t / 0.7)));
      el.scHeadline.style.transform = `scale(${s.scale.toFixed(3)}) rotate(${s.rot.toFixed(2)}deg)`;
      el.scHeadline.style.opacity = s.op.toFixed(3);
    },

    // Countdown-number tick pop, driven per-frame. `t` is seconds since the
    // current number appeared (main.js resets it when setStageCountdown reports
    // the number changed). Matches the old sc-tick keyframe.
    setStageTickAnim(t) {
      const u = Math.max(0, Math.min(1, t / 0.5));
      const scale = u <= 0.35 ? lerp(1.5, 1, u / 0.35) : 1;
      const op = u <= 0.35 ? lerp(0.25, 1, u / 0.35) : 1;
      el.scCountdown.style.transform = `scale(${scale.toFixed(3)})`;
      el.scCountdown.style.opacity = op.toFixed(3);
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

    // Sets the countdown number (dirty-checked -- the caller ticks every
    // frame). Returns true the frame the number CHANGED, so main.js can reset
    // the JS-driven tick-pop timer (setStageTickAnim); the pop is no longer a
    // CSS class toggle (which froze on the occluded WebView).
    setStageCountdown(seconds) {
      if (seconds === lastStageCountdownShown) return false;
      lastStageCountdownShown = seconds;
      el.scCountdown.textContent = `${seconds}`;
      return true;
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
      // Reset the board for the next run so a stale list never flashes before
      // the fresh fetch populates it.
      if (el.scoreboard) el.scoreboard.classList.add('hidden');
      if (el.scoreboardRows) el.scoreboardRows.innerHTML = '';
    },

    // Render the family-account leaderboard into the game-over overlay.
    showScoreboard(board, groups) {
      renderBoardInto(el.scoreboard, el.scoreboardTitle, el.scoreboardRows, board, groups);
    },

    // --- Quit flow (GOBALANCE_APP_INTEGRATION.md "Quitting") ------------------
    // The X (#gb-back) raises a confirm MODAL over the still-visible paused
    // game mid-run; confirming leads to a quit BOARD screen (its own ids, never
    // #gameover-overlay, so the host's Space/Enter restart can't fire through
    // it). Both are plain show/hide toggles here; main.js owns the logic.
    showConfirm() {
      if (el.confirmOverlay) el.confirmOverlay.classList.remove('hidden');
    },
    hideConfirm() {
      if (el.confirmOverlay) el.confirmOverlay.classList.add('hidden');
    },
    isConfirmOpen() {
      return !!(el.confirmOverlay && !el.confirmOverlay.classList.contains('hidden'));
    },
    // Show the quit board: a run-result line + the same family leaderboard.
    showQuit(statsText, board, groups) {
      if (!el.quitOverlay) return;
      if (el.quitStats) el.quitStats.textContent = statsText;
      renderBoardInto(el.quitScoreboard, el.quitScoreboardTitle, el.quitScoreboardRows, board, groups);
      el.quitOverlay.classList.remove('hidden');
    },
    hideQuit() {
      if (el.quitOverlay) el.quitOverlay.classList.add('hidden');
      if (el.quitScoreboard) el.quitScoreboard.classList.add('hidden');
      if (el.quitScoreboardRows) el.quitScoreboardRows.innerHTML = '';
    },
    isQuitOpen() {
      return !!(el.quitOverlay && !el.quitOverlay.classList.contains('hidden'));
    },

    setPaused(isPaused) {
      el.pauseButton.innerHTML = isPaused ? '&#9654;' : '&#9208;'; // play : pause glyph
      el.pausedBadge.classList.toggle('hidden', !isPaused);
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
    setIntroSweep,
  };
}
