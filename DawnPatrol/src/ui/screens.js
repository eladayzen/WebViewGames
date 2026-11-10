// Title, the drop-in beat, and the score card (§7.3, §7.4).
//
// THE FIRST PLAYABLE STATE IS REACHED ON LOAD WITH NO KEY PRESS. There is no
// button on the balance board, so every screen here auto-advances on its own
// timer; a click or Space/Enter is a speed-up over that fallback, never a
// requirement. That is what satisfies GOBALANCE_SDK.md's "the very first
// countdown/playable state must be reached on page load with no key needed".
//
// THE SCORE CARD IS #gameover-overlay AND ITS BUTTON IS #restart-button. Those
// exact ids and the exact `hidden` class are the SDK contract: the Unity host
// checks for that class before synthetically clicking that button (§7.4). Do
// not invent a different structure for it, and do not put #restart-button
// inside any other screen — the host would then restart a run from a screen
// that is not a result screen.

import { SCORECARD_TIMEOUT, DROPIN_SEC } from '../data/tuning.js';

export class Screens {
  constructor() {
    this.el = {
      title: document.getElementById('title-overlay'),
      titleBest: document.getElementById('title-best'),
      titleCountdown: document.getElementById('title-countdown'),
      dropin: document.getElementById('dropin-overlay'),
      over: document.getElementById('gameover-overlay'),
      stats: document.getElementById('scorecard-stats'),
      total: document.getElementById('scorecard-total'),
      restart: document.getElementById('restart-button'),
      countdown: document.getElementById('scorecard-countdown'),
    };
    this._cardT = 0;
  }

  showTitle(sessionBest) {
    this.el.title.classList.remove('hidden');
    this.el.over.classList.add('hidden');
    this.el.dropin.classList.add('hidden');
    if (sessionBest > 0) {
      this.el.titleBest.classList.remove('hidden');
      this.el.titleBest.textContent = 'SESSION BEST  ' + fmt(sessionBest);
    } else {
      this.el.titleBest.classList.add('hidden');
    }
  }

  tickTitle(remaining) {
    this.el.titleCountdown.textContent = remaining > 0.6
      ? `Paddling out… ${Math.ceil(remaining)}`
      : 'Paddling out…';
  }

  hideTitle() { this.el.title.classList.add('hidden'); }

  showDropIn() { this.el.dropin.classList.remove('hidden'); }
  hideDropIn() { this.el.dropin.classList.add('hidden'); }

  /**
   * Time ridden, coins collected, best trick, highest multiplier, crew marks
   * passed, and the total (§7.3). Nothing carries between runs except the
   * display-only session best.
   */
  showScoreCard(summary) {
    const rows = [
      ['TIME RIDDEN', formatTime(summary.rideSeconds)],
      ['COINS', fmt(summary.coins)],
      ['BEST TRICK', summary.bestTrick > 0 ? fmt(summary.bestTrick) : '—'],
      ['TOP MULTIPLIER', '×' + summary.highestMultiplier],
      ['CREW PASSED', `${summary.crewPassed} / ${summary.crewTotal}`],
    ];
    this.el.stats.innerHTML = rows
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
      .join('');
    this.el.total.textContent = fmt(summary.score);
    this.el.over.classList.remove('hidden');
    this._cardT = 0;
  }

  /** @returns true once the 12 s auto-timeout back to title has elapsed. */
  tickScoreCard(dt) {
    this._cardT += dt;
    const left = Math.max(0, SCORECARD_TIMEOUT - this._cardT);
    this.el.countdown.textContent = `Back to the beach in ${Math.ceil(left)}…`;
    return left <= 0;
  }

  hideScoreCard() { this.el.over.classList.add('hidden'); }

  get dropInDuration() { return DROPIN_SEC; }
}

function fmt(n) { return Math.max(0, Math.floor(n)).toLocaleString('en-US'); }

function formatTime(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
