// The zone cycle (§5.9).
//
// Five zones cycle in order along the ONE continuous track, forever. No load
// break, no level transition, no loading screen, no pause in the scroll.
//
// Zone length is measured in DISTANCE, not time, so it is ramp-invariant: a
// faster run does not get shorter zones, it gets through them quicker, which is
// the correct reading of "22 s of scroll each".
//
// ZONES NEVER TOUCH DIFFICULTY. They change background, prop and lighting
// layers only. That separation is what makes Post-MVP zones pure content.

import { ZONE_LENGTH, ZONE_CROSSFADE, SCROLL_BASE } from '../data/tuning.js';
import { ZONES } from '../data/zones.js';

export class ZoneCycle {
  constructor() {
    this.reset();
  }

  reset() {
    this.index = 0;
    this.nextIndex = 1 % ZONES.length;
    this.mix = 0;
    this.captionFor = ZONES[0];
    this.captionT = 0;
    this._lastIndex = 0;
  }

  get current() { return ZONES[this.index]; }
  get next() { return ZONES[this.nextIndex]; }

  /**
   * @param distance accumulated scrolled world pixels
   * @returns the zone just entered, or null
   */
  update(distance, dt) {
    const pos = distance / ZONE_LENGTH;
    const idx = Math.floor(pos) % ZONES.length;
    const frac = pos - Math.floor(pos);

    this.index = idx;
    this.nextIndex = (idx + 1) % ZONES.length;

    // Cross-fade over the last ZONE_CROSSFADE seconds' worth of distance.
    const fadeFrac = (ZONE_CROSSFADE * SCROLL_BASE) / ZONE_LENGTH;
    this.mix = frac > 1 - fadeFrac ? (frac - (1 - fadeFrac)) / fadeFrac : 0;

    let entered = null;
    if (idx !== this._lastIndex) {
      this._lastIndex = idx;
      entered = ZONES[idx];
      this.captionFor = entered;
      this.captionT = 0;
    }
    this.captionT += dt;
    return entered;
  }
}
