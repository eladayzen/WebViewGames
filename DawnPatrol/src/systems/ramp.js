// The difficulty ramp (§5.10).
//
// Driven by ELAPSED RIDE TIME -- excluding tumbles and the barrel -- ramping
// over RAMP_DURATION and then holding flat forever. Deterministic in t; there
// is no dynamic difficulty adjustment at MVP.
//
// IT RAMPS SPEED AND DENSITY ONLY. It never narrows H_GAP_MIN, never shortens a
// telegraph, never shrinks a hazard, never adds a required move larger than
// MAX_REQUIRED_MOVE, and never touches the reaction floor. Those four are
// FLOORS, NOT LEVERS, at every tier including Post-MVP. /systems/constraints.js
// asserts it over the whole table at boot.

import { rampAt, PUFFER_FIRST_ALLOWED, ONRAMP_SEC, STAND_STILL_SEC } from '../data/tuning.js';

export class Ramp {
  constructor() {
    this.rideTime = 0;
  }

  reset() {
    this.rideTime = 0;
  }

  /** Only advance while actually riding: tumbles and the barrel do not count. */
  tick(dt, counts) {
    if (counts) this.rideTime += dt;
  }

  get scrollSpeed() { return rampAt('scroll', this.rideTime); }
  get groupInterval() { return rampAt('groupInterval', this.rideTime); }
  get groupSize() { return Math.max(1, Math.round(rampAt('groupSize', this.rideTime))); }
  get orbInterval() { return rampAt('orbInterval', this.rideTime); }
  get coinInterval() { return rampAt('coinInterval', this.rideTime); }
  get pufferInterval() { return rampAt('pufferInterval', this.rideTime); }

  /**
   * The first ONRAMP_SEC are a deliberate on-ramp: jellyfish only, one at a
   * time, at heights near the trim line, so a walk-up player learns the lean
   * mapping before being asked anything. THIS IS THE CLOSEST THING THE GAME HAS
   * TO A TUTORIAL AND IT MUST NOT BE TUNED AWAY (§5.10).
   */
  get inOnRamp() { return this.rideTime < ONRAMP_SEC; }

  /**
   * Before STAND_STILL_SEC only base-tier groups may spawn -- the ones that
   * leave the trim band clear. That is what makes §5.3's stand-still rule
   * ("hold trim, never lean, survive >= 45 s") true by construction.
   */
  get tier() { return this.rideTime < STAND_STILL_SEC ? 'base' : 'open'; }

  get pufferAllowed() { return this.rideTime >= PUFFER_FIRST_ALLOWED; }
}
