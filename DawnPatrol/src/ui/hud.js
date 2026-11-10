// The DOM/CSS HUD overlay (§7.1). Text stays crisp and updates stay cheap
// because none of this is drawn into the render layer.
//
// THE HUD NEVER ENTERS THE FACE. Everything here lives in the corner and
// left-margin exclusion rects from §5.1. The centre of the frame — where the
// player is reading hazards — stays clear, and that is a hard rule, not a
// layout preference.

import {
  SLOT_COUNT, SLOT_MULTIPLIERS, WIPEOUTS_ALLOWED, BANNER_MIN_SEC,
  BANNER_QUEUE_DEPTH, TOPRUN_FADE_DIST, DESIGN_W, DESIGN_H, ZONE_CAPTION_SEC,
} from '../data/tuning.js';

const SWEEP_CIRCUMFERENCE = 113.1; // 2 * PI * 18, matching the SVG in index.html

export class Hud {
  constructor() {
    this.el = {
      stage: document.getElementById('stage'),
      score: document.getElementById('score-value'),
      coins: document.getElementById('coin-value'),
      pips: document.getElementById('wipeout-pips'),
      topRun: document.getElementById('toprun-panel'),
      topRunName: document.getElementById('toprun-name'),
      topRunGap: document.getElementById('toprun-gap'),
      topRunPortrait: document.getElementById('toprun-portrait'),
      slots: Array.from(document.querySelectorAll('#slot-stack .slot')),
      banner: document.getElementById('banner'),
      bannerText: document.getElementById('banner-text'),
      zoneCaption: document.getElementById('zone-caption'),
      pause: document.getElementById('pause-button'),
      constraint: document.getElementById('constraint-warning'),
    };

    // BANNER QUEUE INVARIANT (§7.1): one slot, one banner. Two banners can
    // never collide because there is physically only one element and nothing
    // shows until the current one's minimum time has elapsed.
    this._queue = [];
    this._bannerT = 0;
    this._bannerShowing = null;

    this._zoneT = Infinity;
    this._lastScore = -1;
    this._lastCoins = -1;
    this._lastGap = -1;
  }

  // -- score plate ---------------------------------------------------------

  setScore(score) {
    if (score === this._lastScore) return;
    this._lastScore = score;
    this.el.score.textContent = format(score);
  }

  setCoins(n) {
    if (n === this._lastCoins) return;
    this._lastCoins = n;
    this.el.coins.textContent = format(n);
  }

  /**
   * Wipeout pips. Absent ENTIRELY when the fail model is one-hit — a single pip
   * would read as "you have one life", which is a different promise from "one
   * mistake ends the run" (§7.1, §5.8).
   */
  setWipeouts(remaining, failModel) {
    if (failModel !== 'leash3') {
      this.el.pips.innerHTML = '';
      return;
    }
    if (this.el.pips.childElementCount !== WIPEOUTS_ALLOWED) {
      this.el.pips.innerHTML = '';
      for (let i = 0; i < WIPEOUTS_ALLOWED; i++) {
        const d = document.createElement('div');
        d.className = 'pip';
        this.el.pips.appendChild(d);
      }
    }
    const pips = this.el.pips.children;
    for (let i = 0; i < pips.length; i++) {
      pips[i].classList.toggle('spent', i >= remaining);
    }
  }

  // -- TOP RUN panel -------------------------------------------------------

  setCrew(name, gap, portraitUrl, topped) {
    if (this.el.topRunName.textContent !== name) this.el.topRunName.textContent = name;
    if (portraitUrl) this.el.topRunPortrait.style.backgroundImage = `url(${portraitUrl})`;
    this.el.topRun.classList.toggle('topped', !!topped);
    if (topped) {
      if (this._lastGap !== -2) { this.el.topRunGap.textContent = 'TOP OF THE PEAK'; this._lastGap = -2; }
      return;
    }
    if (gap !== this._lastGap) {
      this._lastGap = gap;
      this.el.topRunGap.textContent = format(gap);
    }
  }

  /**
   * The one sanctioned exception to the HUD-exclusion rule (§5.1): the panel
   * fades to 25% over 0.2 s whenever the airborne player's bounding box comes
   * within TOPRUN_FADE_DIST of it, restoring on landing.
   *
   * Measured off the real element rather than off the CSS numbers, so the rule
   * keeps holding if the panel is ever repositioned (§12 notes moving it
   * down-right is the fallback if the fade reads as a glitch on hardware).
   */
  updateTopRunFade(airborne, playerScreenX, playerScreenY) {
    if (!airborne) {
      this.el.topRun.classList.remove('air-fade');
      return;
    }
    const stage = this.el.stage.getBoundingClientRect();
    const panel = this.el.topRun.getBoundingClientRect();
    const scale = stage.width / DESIGN_W;
    const px = stage.left + playerScreenX * DESIGN_W * scale;
    const py = stage.top + playerScreenY * DESIGN_H * scale;
    const pad = TOPRUN_FADE_DIST * scale;
    const near = px > panel.left - pad && px < panel.right + pad
      && py > panel.top - pad && py < panel.bottom + pad;
    this.el.topRun.classList.toggle('air-fade', near);
  }

  // -- multiplier slots ----------------------------------------------------

  setSlots(filled, sweep) {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = this.el.slots[i];
      if (!slot) continue;
      const isFilled = i < filled;
      slot.classList.toggle('filled', isFilled);
      const label = slot.querySelector('.slot-label');
      label.textContent = isFilled ? '×' + SLOT_MULTIPLIERS[i + 1] : '';
      const sweepEl = slot.querySelector('.slot-sweep');
      // The radial sweep runs on the HIGHEST FILLED SLOT only; the ones below
      // it read as solidly held, which is what "one slot drops, not the whole
      // stack" looks like (§5.6).
      const k = isFilled ? (i === filled - 1 ? sweep : 1) : 0;
      sweepEl.style.strokeDashoffset = String(SWEEP_CIRCUMFERENCE * (1 - k));
    }
  }

  // -- banners -------------------------------------------------------------

  /** @param critical banners that may displace a queued non-critical one. */
  banner(text, critical = false) {
    if (this._queue.length >= BANNER_QUEUE_DEPTH) {
      const idx = this._queue.findIndex((b) => !b.critical);
      if (idx >= 0) this._queue.splice(idx, 1);
      else if (!critical) return;
      else this._queue.shift();
    }
    this._queue.push({ text, critical });
  }

  updateBanners(dt) {
    if (this._bannerShowing) {
      this._bannerT += dt;
      if (this._bannerT >= BANNER_MIN_SEC + 0.5) {
        this._bannerShowing = null;
        this.el.banner.classList.add('hidden');
      } else {
        return; // one slot; nothing else may appear while this one is up
      }
    }
    if (this._queue.length) {
      const next = this._queue.shift();
      this._bannerShowing = next;
      this._bannerT = 0;
      this.el.bannerText.textContent = next.text;
      this.el.banner.classList.remove('hidden');
    }
  }

  // -- zone caption --------------------------------------------------------

  zoneCaption(name) {
    this.el.zoneCaption.textContent = name;
    this.el.zoneCaption.classList.remove('hidden');
    this._zoneT = 0;
  }

  updateZoneCaption(dt) {
    if (this._zoneT === Infinity) return;
    this._zoneT += dt;
    const k = this._zoneT / ZONE_CAPTION_SEC;
    if (k >= 1) {
      this.el.zoneCaption.classList.add('hidden');
      this._zoneT = Infinity;
      return;
    }
    this.el.zoneCaption.style.opacity = String(0.42 * (k < 0.25 ? k / 0.25 : k > 0.75 ? (1 - k) / 0.25 : 1));
  }

  // -- chrome --------------------------------------------------------------

  setPaused(paused) {
    this.el.pause.classList.toggle('paused', paused);
  }

  showConstraintFailure(lines) {
    this.el.constraint.classList.remove('hidden');
    this.el.constraint.textContent =
      'CONSTRAINT VIOLATION (§9.5) — this build breaks the pacing contract:\n\n'
      + lines.join('\n');
  }

  reset() {
    this._queue.length = 0;
    this._bannerShowing = null;
    this.el.banner.classList.add('hidden');
    this.el.zoneCaption.classList.add('hidden');
    this._zoneT = Infinity;
    this._lastScore = -1;
    this._lastCoins = -1;
    this._lastGap = -1;
    this.el.topRun.classList.remove('air-fade', 'topped');
  }
}

function format(n) {
  return Math.max(0, Math.floor(n)).toLocaleString('en-US');
}
