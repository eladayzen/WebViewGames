// Scoring (§8.1) and the crew ladder (§8.3).
//
// BASE SCORE IS TIME, NOT SKILL -- survival is the floor, skill is the ceiling.
// That structure is lifted directly from the reference and is the honest shape
// for this genre.
//
// SCORE IS MONOTONIC WITHIN A RUN. It never decreases. A wipeout costs FUTURE
// score (the stack, the suspended seconds), never banked score.
//
// Nothing here writes to storage except the display-only session best, which
// gates nothing, buys nothing and totals into nothing (§8.5, §8.6). The coin
// count is a RUN STATISTIC, not a wallet: no balance semantics, no persistence,
// no spending, anywhere.

import {
  SCORE_RATE, COIN_VALUE, SEABIRD_BONUS, SEABIRD_BONUS_DEGREES,
} from '../data/tuning.js';
import { CREW, TOP_OF_THE_PEAK } from '../data/crew.js';

const BEST_KEY = 'dawnpatrol.sessionBest';

export class Scoring {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.coins = 0;           // RUN STATISTIC. Not a wallet. Never persisted.
    this.bestTrick = 0;       // largest single rotation payout this run
    this.highestMultiplier = 1;
    this.crewIndex = 0;       // how many marks have been passed
    this.rideSeconds = 0;
    this.seabirds = 0;
  }

  /** Base rate accrues while riding, airborne and in the barrel -- NOT during
   *  the tumble (§8.1). */
  tickBase(dt, multiplier, accrues) {
    if (!accrues) return;
    this.rideSeconds += dt;
    this.score += SCORE_RATE * dt * multiplier;
    if (multiplier > this.highestMultiplier) this.highestMultiplier = multiplier;
  }

  addCoins(n, multiplier) {
    if (n <= 0) return 0;
    this.coins += n;
    const gained = n * COIN_VALUE * multiplier;
    this.score += gained;
    return gained;
  }

  /** degrees x multiplier, exactly the reference's own arithmetic (§5.4). */
  addTrick(degrees, multiplier) {
    if (degrees <= 0) return 0;
    const payout = degrees * multiplier;
    this.score += payout;
    if (payout > this.bestTrick) this.bestTrick = payout;
    return payout;
  }

  addSeabird(multiplier) {
    this.seabirds++;
    const payout = SEABIRD_BONUS * multiplier;
    this.score += payout;
    return payout;
  }

  get displayScore() { return Math.floor(this.score); }

  // -- the crew ladder ------------------------------------------------------

  /** The rival currently being chased, or null once all five are passed. */
  get rival() {
    return this.crewIndex < CREW.length ? CREW[this.crewIndex] : null;
  }

  /**
   * THE REMAINING GAP, TICKING DOWN LIVE AS YOU EARN. The report's single best
   * measured finding about the reference is that the number under the rival's
   * portrait is not the rival's score -- it is the live remaining gap to it.
   */
  get remainingGap() {
    const r = this.rival;
    if (!r) return 0;
    return Math.max(0, Math.ceil(r.mark - this.score));
  }

  get ladderLabel() {
    return this.rival ? this.rival.name : TOP_OF_THE_PEAK;
  }

  /** @returns the crew member just passed, or null. */
  checkCrewPass() {
    const r = this.rival;
    if (!r) return null;
    if (this.score < r.mark) return null;
    this.crewIndex++;
    return r;
  }

  // -- the one thing that persists (§8.5) -----------------------------------

  static loadSessionBest() {
    try {
      const v = Number(window.sessionStorage.getItem(BEST_KEY));
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Display-only. Deliberately sessionStorage, not localStorage: it is a
   * SESSION best (§8.5), it gates nothing and it accumulates into nothing. The
   * coin count is never written here -- see §8.6.
   */
  static saveSessionBest(score) {
    try {
      const prev = Scoring.loadSessionBest();
      if (score > prev) window.sessionStorage.setItem(BEST_KEY, String(Math.floor(score)));
    } catch (e) {
      /* storage unavailable: the session best is a nicety, never a dependency */
    }
  }
}

export { SEABIRD_BONUS_DEGREES, CREW };
