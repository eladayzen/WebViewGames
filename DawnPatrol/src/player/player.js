// Wren -- the height model, the carve states, the automatic aerial, the
// automatic clean landing, and the tumble (§4, §5.4, §5.8, §6.1).
//
// She is pinned at screen x = PLAYER_X and has NO HORIZONTAL CONTROL, ever.
// Her entire spatial state is one scalar `h`. The player's entire input is one
// scalar `lean`. Everything below is those two numbers and a small state enum.

import {
  H_TRIM, H_SPAN, H_RATE_MAX, H_RESPONSE, H_LAUNCH,
  CARVE_ENTER, CARVE_EXIT,
  AIR_MIN, AIR_MAX, SPIN_RATE, LAUNCH_COOLDOWN, CLIMB_AVG_WINDOW,
  LANDING_IMMUNITY, AIR_PEAK_BASE, AIR_PEAK_SPAN, AIR_X_DRIFT,
  TUMBLE_DURATION, TUMBLE_IMMUNITY,
  PLAYER_X, PLAYER_H_HALF, PLAYER_X_HALF,
} from '../data/tuning.js';

export const PlayerState = {
  RIDING: 'riding',
  AIRBORNE: 'airborne',
  TUMBLING: 'tumbling',
  BARREL_ENTRY: 'barrelEntry',
  BARREL: 'barrel',
  BARREL_EXIT: 'barrelExit',
};

/** States in which the height model runs off the player's lean. */
const LEAN_ACTIVE = new Set([
  PlayerState.RIDING, PlayerState.BARREL_ENTRY, PlayerState.BARREL, PlayerState.BARREL_EXIT,
]);

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.h = H_TRIM;
    this.targetH = H_TRIM;
    this.dh = 0;
    this.lean = 0;
    this.state = PlayerState.RIDING;
    this.carve = 'trim';

    this.immunity = 0;          // s of hazard immunity remaining
    this.launchCooldown = 0;    // s before a new launch may trigger

    // Rolling dh/dt samples for the launch-power read (§5.4).
    this._climbSamples = [];
    this._climbWindow = 0;

    // Airborne
    this.airT = 0;
    this.airtime = 0;
    this.airPower = 0;
    this.airLaunchY = 0;
    this.airPeakY = 0;
    this.spinDeg = 0;
    this.bonusDeg = 0;          // seabird's +360, added to this trick's rotation
    this.seabirdHits = 0;
    this.screenY = 0;           // only meaningful while airborne
    this.screenXOff = 0;        // drift during the arc; 0 on the face

    this.tumbleT = 0;
  }

  get screenX() {
    return PLAYER_X + this.screenXOff;
  }

  get isAirborne() {
    return this.state === PlayerState.AIRBORNE;
  }

  get inBarrel() {
    return this.state === PlayerState.BARREL_ENTRY
      || this.state === PlayerState.BARREL
      || this.state === PlayerState.BARREL_EXIT;
  }

  /** Hazards cannot touch her while tumbling, airborne, immune or in a barrel. */
  get collidable() {
    return this.state === PlayerState.RIDING && this.immunity <= 0;
  }

  /**
   * One fixed step.
   *
   * @param {number} dt      fixed timestep
   * @param {number} lean    the ONE input scalar, [-1, 1]
   * @param {object} wave    for faceY during the airborne arc's landing point
   * @param {object} events  out-param: { launched, landed, recovered }
   */
  update(dt, lean, wave, events) {
    this.immunity = Math.max(0, this.immunity - dt);
    this.launchCooldown = Math.max(0, this.launchCooldown - dt);

    switch (this.state) {
      case PlayerState.TUMBLING:
        this._updateTumble(dt, events);
        break;
      case PlayerState.AIRBORNE:
        this._updateAirborne(dt, wave, events);
        break;
      default:
        this._updateRiding(dt, lean, events);
        break;
    }
  }

  // -- the height model (§4) ------------------------------------------------

  _updateRiding(dt, lean, events) {
    this.lean = lean;

    // targetH = clamp(H_TRIM - lean * H_SPAN, 0, 1)
    //
    // Sign convention: lean toward the player's LEFT is negative, and negative
    // lean must CLIMB. H_TRIM - (negative) * H_SPAN > H_TRIM. That is the whole
    // mapping (§0.2, §4). Verify the board's sign on real hardware at POC-2
    // before anything else is tuned.
    //
    // THE TARGET IS CLAMPED TO THE LIP (1.0), NOT TO H_LAUNCH (0.90). §4 writes
    // the formula with H_LAUNCH as the upper clamp, but its own constants table
    // says H_SPAN exists so that "full left lean targets the lip
    // (0.45 + 0.55 = 1.00)" and that H_LAUNCH is "the face clamp -- you cannot
    // sit at the lip, reaching it launches you". Those two cannot both be the
    // target clamp: with the target pinned AT 0.90, a first-order lag only
    // approaches 0.90 asymptotically, so a full-commitment climb takes ~4 s to
    // trigger a launch and a slightly-less-than-full one never triggers at all.
    // Clamping the TARGET at the lip and the POSITION at H_LAUNCH is what the
    // table describes and what makes the lip read as a ramp: full lean reaches
    // it in ~1.35 s, mostly at H_RATE_MAX. Verified by tools/sim-harness.js,
    // which counted zero launches in ten minutes before this change.
    this.targetH = clamp(H_TRIM - lean * H_SPAN, 0, 1);

    // First-order lag. THE LAG IS THE MOMENTUM -- do not add a second-order
    // velocity integrator on top of it (§4).
    const want = (this.targetH - this.h) * H_RESPONSE;
    this.dh = clamp(want, -H_RATE_MAX, H_RATE_MAX);
    this.h = clamp(this.h + this.dh * dt, 0, H_LAUNCH);

    this._pushClimbSample(this.dh, dt);
    this._updateCarve(lean);

    // Launch: reaching the lip while climbing leaves the wave. No input, no
    // timing window, no button (§0.4, §5.4). Not from inside the barrel.
    if (
      this.state === PlayerState.RIDING
      && this.h >= H_LAUNCH - 1e-6
      && this.dh > 0
      && this.launchCooldown <= 0
    ) {
      this._launch(events);
    }
  }

  _pushClimbSample(dh, dt) {
    this._climbSamples.push({ dh, dt });
    this._climbWindow += dt;
    while (this._climbWindow > CLIMB_AVG_WINDOW && this._climbSamples.length > 1) {
      this._climbWindow -= this._climbSamples.shift().dt;
    }
  }

  _climbAvg() {
    if (!this._climbSamples.length) return 0;
    let sum = 0, span = 0;
    for (const s of this._climbSamples) { sum += s.dh * s.dt; span += s.dt; }
    return span > 0 ? sum / span : 0;
  }

  _updateCarve(lean) {
    const mag = Math.abs(lean);
    // STRICTLY greater, and <= on the way out, so that zero lean is ALWAYS
    // trim. With the thresholds at 0 (zero carve latency) a `>=` test made
    // mag 0 satisfy the entry condition, and `lean < 0 ? ... : 'drop'` then
    // resolved neutral to the DROP pose -- the board sat in a permanent lean
    // with no input. Idle has to be the resting state at exactly 0.
    if (this.carve === 'trim') {
      if (mag > CARVE_ENTER) this.carve = lean < 0 ? 'climb' : 'drop';
    } else if (mag <= CARVE_EXIT) {
      this.carve = 'trim';
    } else {
      this.carve = lean < 0 ? 'climb' : 'drop';
    }
  }

  // -- aerials (§5.4) -------------------------------------------------------

  _launch(events) {
    const climbAvg = clamp(this._climbAvg(), 0, H_RATE_MAX);
    this.airPower = climbAvg / H_RATE_MAX;
    this.airtime = AIR_MIN + (AIR_MAX - AIR_MIN) * this.airPower;
    this.airT = 0;
    this.spinDeg = 0;
    this.bonusDeg = 0;
    this.seabirdHits = 0;
    this.state = PlayerState.AIRBORNE;

    // The arc is scripted entirely in screen space in the sky band. Harder
    // launches go higher.
    this.airLaunchY = 0; // resolved on the first airborne step, from the rail
    this.airPeakY = AIR_PEAK_BASE + AIR_PEAK_SPAN * (1 - this.airPower);

    if (events) events.launched = { power: this.airPower, airtime: this.airtime };
  }

  _updateAirborne(dt, wave, events) {
    // INPUT IS IGNORED ENTIRELY WHILE AIRBORNE (§0.4, §4). `lean` is not even
    // sampled into the model here; the arc and the spin are fully scripted.
    if (this.airT === 0) {
      this.airLaunchY = wave.faceY(PLAYER_X, 1.0);
    }

    this.airT += dt;
    const u = Math.min(1, this.airT / this.airtime);

    this.spinDeg = Math.min(this.airtime, this.airT) * SPIN_RATE;

    // Parabola through (0, launchY) -> (0.5, peakY) -> (1, launchY).
    const s = 2 * u - 1;
    this.screenY = this.airLaunchY + (this.airPeakY - this.airLaunchY) * (1 - s * s);

    // She drifts left a touch off the lip, then right across the arc, easing
    // back to the fixed column on landing. THE CAMERA DOES NOT MOVE, she does.
    this.screenXOff = (-0.12 * (1 - u) + 2 * AIR_X_DRIFT * u) * Math.sin(Math.PI * u);

    if (u >= 1) this._land(events);
  }

  _land(events) {
    const degrees = Math.floor((this.spinDeg + this.bonusDeg) / 360) * 360;
    this.state = PlayerState.RIDING;
    this.h = H_TRIM;
    this.dh = 0;
    this._climbSamples.length = 0;
    this._climbWindow = 0;
    this.screenXOff = 0;
    // Landing is automatic and ALWAYS CLEAN -- no landing-timing input, no
    // botched landing, no failed trick (§0.4, §5.4). The grace window exists so
    // a hazard arriving at the landing instant is never a gotcha-wipeout for a
    // reward the player just earned.
    this.immunity = Math.max(this.immunity, LANDING_IMMUNITY);
    this.launchCooldown = LAUNCH_COOLDOWN;

    if (events) {
      events.landed = {
        degrees,
        airtime: this.airtime,
        power: this.airPower,
        seabirdHits: this.seabirdHits,
      };
    }
  }

  /** The seabird is a TARGET, not a hazard (§6.2). */
  addSeabirdBonus(degrees) {
    this.bonusDeg += degrees;
    this.seabirdHits += 1;
  }

  // -- the tumble (§5.8) ----------------------------------------------------

  wipeout() {
    this.state = PlayerState.TUMBLING;
    this.tumbleT = 0;
    this.dh = 0;
    this.screenXOff = 0;
    this._climbSamples.length = 0;
    this._climbWindow = 0;
  }

  _updateTumble(dt, events) {
    this.tumbleT += dt;
    if (this.tumbleT >= TUMBLE_DURATION) {
      this.state = PlayerState.RIDING;
      this.h = H_TRIM;
      this.targetH = H_TRIM;
      this.carve = 'trim';
      this.immunity = TUMBLE_IMMUNITY;
      this.launchCooldown = LAUNCH_COOLDOWN;
      if (events) events.recovered = true;
    }
  }

  // -- barrel (§5.7) --------------------------------------------------------

  enterBarrel() {
    this.state = PlayerState.BARREL_ENTRY;
  }

  setBarrelState(s) {
    this.state = s;
  }

  exitBarrelToFace() {
    this.state = PlayerState.RIDING;
    this.h = H_TRIM;
    this.targetH = H_TRIM;
    this.immunity = Math.max(this.immunity, LANDING_IMMUNITY);
  }

  // -- collision (§9.1) -----------------------------------------------------

  get hMin() { return this.h - PLAYER_H_HALF; }
  get hMax() { return this.h + PLAYER_H_HALF; }
  get xHalf() { return PLAYER_X_HALF; }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
