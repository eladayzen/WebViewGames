/**
 * reach.js — measuring how far THIS player can actually lean.
 *
 * The whole tilt pipeline divides every lean by one number, `maxAngleDeg`, and
 * that number decides what "all the way" means. It shipped at GoBalance's own
 * default of 19°, and on a real board that is most of a gamut nobody has:
 * "in all types of boards I reach physically to the end of my possible tilt and
 * I'm only halfway my curving ability." Nearly half of every game's steering
 * range could not be asked for at all.
 *
 * How far a rider CAN lean is not a property of the game. It depends on how
 * hard the cushion is inflated, on their weight, on their stance, and on how
 * worried they are about falling off. So it is measured, and this is the
 * measurement — the arithmetic and the state machine only. No DOM, no timers,
 * no host: the wizard drives it, which is what lets a test drive it too.
 *
 * ── WHY THIS IS NOT JUST "RECORD THE BIGGEST READING" ───────────────────────
 *
 * Three separate traps, each of which has actually been walked into on one
 * platform or the other, and each of which fails by producing a number that
 * LOOKS like a successful calibration:
 *
 *  1. The extremes are not the reach. Taking the outright max and min trusts
 *     the single most extreme sample in the session, so a lurch or one
 *     over-committed first attempt sets a reach the player cannot repeat. They
 *     never reach full deflection again and nothing says why. Percentiles.
 *
 *  2. Two absolute angles are not a span. Averaging |right| and |left|
 *     assumes the board's resting position is zero, and on an inflated cushion
 *     it never quite is. Half the SPAN is the amplitude about wherever the
 *     middle actually was, so a board resting 2° left measures the same as a
 *     level one.
 *
 *  3. A side that was never attempted is not a measurement of zero. Every exit
 *     from this module that yields a number has passed a gate that could have
 *     refused — see `result`.
 *
 * ── AND WHY THE CALLER MUST WIDEN FIRST ─────────────────────────────────────
 *
 * THE SUBTLE ONE, and the reason [WIDEN_DEG] exists. `TiltPipeline` applies a
 * radial clamp at `maxAngleDeg` BEFORE it publishes `raw`, so `host.raw()`
 * saturates at 1.0. Sample at the shipped 12° and a player who can reach 15°
 * reads 1.0, measures 12°, and the calibration hands back the setting it
 * started from — a self-confirming result that is indistinguishable from
 * success. The caller widens to [WIDEN_DEG] for the duration and restores
 * afterwards; `degreesFromRaw` is the conversion that goes with it.
 */

/** Sample at this while measuring, so the pipeline's radial clamp cannot cap
 *  the very reading being taken. Above any lean a person makes on purpose, and
 *  inside the 5–45 the GoBalance device will accept. */
export const WIDEN_DEG = 45;

/**
 * What a FULL keyboard deflection stands for when no board is attached.
 *
 * The dev input saturates at a ratio of 1, which against [WIDEN_DEG] would read
 * as a 45 degree lean -- refused as implausible, every time, so the wizard could
 * never be completed on a laptop. That is the environment it gets reviewed in.
 *
 * 18 degrees is a lean a real person actually produces: comfortably inside the
 * 6-30 band, and not so close to an edge that the result looks staged.
 */
export const DEV_LEAN_DEG = 18;

/** Movement that counts as having genuinely gone to one end. Below this the
 *  player has shifted their weight, not leaned. A PER-SIDE COMMITMENT GATE,
 *  asked during the flow — deliberately NOT the same question as [MIN_DEG],
 *  which is asked once at the end. Merging the two is how the Flutter screen
 *  came to offer a value its own store would refuse. */
export const MIN_SIDE_DEG = 3;

/** Full deflection arrives at this fraction of the measured reach, so the last
 *  degrees of a player's range are headroom rather than something they have to
 *  hit exactly. Leaning past it simply stays at full. */
export const HEADROOM = 0.92;

/**
 * What the wizard is willing to BELIEVE it measured.
 *
 * NOT the same as what the device will accept, which is 5–45, and the two must
 * not be collapsed into one number. A reach of 5° is a value the hardware takes
 * happily and is still near-certain evidence that the measurement went wrong:
 * at 5° a hand resting on the board is full deflection. Above 30° the wizard
 * has plainly measured something that was not a lean — the board picked up, the
 * phone carried across a room.
 */
export const MIN_DEG = 6;
export const MAX_DEG = 30;

/**
 * ── ARRIVAL, WHICH THE GATE NEVER MEASURED ──────────────────────────────────
 *
 * The movement gate says "you have started", not "you have arrived" -- and a
 * sample window opened at the gate covers the whole travel out to the limit,
 * so lean speed contaminated the measurement: an identical 18-degree reach
 * read 18.2 leaned briskly and 16.1 leaned over 2.8 seconds, found on real
 * hardware by the Half Shell session (BOARD_SENSITIVITY.md rev 5, "a bit
 * different every time").
 *
 * Arrival is a PLATEAU: the reading has gone [PLATEAU_MS] without improving on
 * the best-at-last-reset by more than [PLATEAU_EPS_DEG]. Both reset together
 * on every qualifying improvement -- against the best AT THE LAST RESET, never
 * a running maximum. The ratchet version looks identical and is not: a slow
 * continuous lean never gains a whole degree inside one poll, so a running-max
 * comparison never fires, the clock never resets, and the hold starts
 * mid-travel -- reproducing the exact speed-dependence this exists to remove.
 * Their measurement across four speeds: 1.97 degrees of spread before, 0.08
 * after. Sampling begins AT ARRIVAL, not at the gate.
 *
 * And a PAUSE IS NOT AN ARRIVAL: a reading that beats the plateau's best after
 * the hold has begun reverts the side to travelling and discards its samples,
 * so stopping halfway for a breath and then pushing on is measured at the
 * limit, not at the breath. [ARRIVE_CAP_MS] bounds the whole wait, because an
 * inflated cushion is never perfectly static and the plateau must not become a
 * way to fail.
 */
export const PLATEAU_MS = 450;
export const PLATEAU_EPS_DEG = 1;
export const ARRIVE_CAP_MS = 6000;

/** How long a side must be held past its gate before it counts. In TIME, not in
 *  samples: a sample count is a duration pretending to be one, and it means
 *  something different on a 30 Hz BLE puck and a 60 Hz dev input. */
export const HOLD_MS = 1000;

/** A beat to stand up and settle before anything is recorded — the first moment
 *  of a stream is the rider stepping on. */
export const SETTLE_MS = 900;

/** A side nobody attempts ends the wizard. It does NOT end it with whatever was
 *  on screen at the time: see `result`. */
export const SIDE_TIMEOUT_MS = 20000;

/** Linear-interpolated percentile of a copy, sorted ascending. */
export function percentile(xs, q) {
  if (!xs.length) return 0;
  const v = [...xs].sort((a, b) => a - b);
  if (v.length === 1) return v[0];
  const i = (v.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (i - lo);
}

/** `host.raw()` is a RATIO — lean over `maxAngleDeg` — so degrees need the
 *  divisor multiplied back in. The caller passes whatever it widened to. */
export function degreesFromRaw(rawX, maxAngleDeg) {
  return rawX * maxAngleDeg;
}

export const PHASE = Object.freeze({
  settle: 'settle',
  right: 'right',
  left: 'left',
  done: 'done',
  failed: 'failed',
});

/**
 * The measurement, as a state machine the caller pumps.
 *
 * Time is an ARGUMENT, never read from a clock in here. That is what lets a
 * test hold a lean for a second without waiting a second, and it is the same
 * lesson the Flutter screen learned the hard way: a rule expressed against
 * `Date.now()` is a rule no test can exercise, so it is a rule nobody checks.
 */
export class ReachCalibration {
  constructor(opts = {}) {
    this.holdMs = opts.holdMs ?? HOLD_MS;
    this.plateauMs = opts.plateauMs ?? PLATEAU_MS;
    this.plateauEps = opts.plateauEps ?? PLATEAU_EPS_DEG;
    this.arriveCapMs = opts.arriveCapMs ?? ARRIVE_CAP_MS;
    this.settleMs = opts.settleMs ?? SETTLE_MS;
    this.timeoutMs = opts.timeoutMs ?? SIDE_TIMEOUT_MS;
    this.minSideDeg = opts.minSideDeg ?? MIN_SIDE_DEG;
    this.headroom = opts.headroom ?? HEADROOM;
    this.minDeg = opts.minDeg ?? MIN_DEG;
    this.maxDeg = opts.maxDeg ?? MAX_DEG;

    this.phase = PHASE.settle;
    this.now = 0;
    this.right = [];
    this.left = [];
    this.held = false;
    this.reason = null;

    this._t0 = null;        // when the current phase began
    this._gateAt = null;    // when the gate opened (for the arrival cap)
    this._bestAtReset = 0;  // the plateau's reference reading -- see above
    this._plateauFrom = null;
    this.arrived = false;   // travelling vs measuring; the UI reads this
    this._holdFrom = null;  // when the hold began (only ever after arrival)
    this._last = null;      // the most recent sample's time, for holdProgress
  }

  /** Feed one lean, in DEGREES, on the axis that becomes screen x. */
  sample(deg, tMs) {
    if (this.phase === PHASE.done || this.phase === PHASE.failed) return this;
    if (this._t0 === null) this._t0 = tMs;
    this._last = tMs;
    this.now = deg;

    if (this.phase === PHASE.settle) {
      if (tMs - this._t0 >= this.settleMs) this._enter(PHASE.right, tMs);
      return this;
    }

    const right = this.phase === PHASE.right;
    const past = right ? deg >= this.minSideDeg : deg <= -this.minSideDeg;
    const samples = right ? this.right : this.left;

    if (past) {
      if (this._gateAt === null) {
        this._gateAt = tMs;
        this._bestAtReset = deg;
        this._plateauFrom = tMs;
      }
      // "Improved" means further OUT on this side's sign, by more than the
      // epsilon -- always against the reading at the last reset, never a
      // running maximum (see the plateau note above for why that distinction
      // is the entire fix).
      const improved = right
        ? deg > this._bestAtReset + this.plateauEps
        : deg < this._bestAtReset - this.plateauEps;

      if (!this.arrived) {
        if (improved) {
          this._bestAtReset = deg;
          this._plateauFrom = tMs;
        }
        if (tMs - this._plateauFrom >= this.plateauMs ||
            tMs - this._gateAt >= this.arriveCapMs) {
          this.arrived = true;
          this._holdFrom = tMs;
          samples.length = 0;   // travel samples are of someone in transit
        }
      } else if (improved) {
        // A PAUSE WAS NOT AN ARRIVAL. They stopped for a breath and pushed on;
        // everything measured at the breath is discarded, `held` included --
        // the one case where held IS taken back, because it was earned at a
        // reading the player has just disowned by beating it.
        this.arrived = false;
        this.held = false;
        this._holdFrom = null;
        this._bestAtReset = deg;
        this._plateauFrom = tMs;
        samples.length = 0;
      } else {
        samples.push(deg);
        if (tMs - this._holdFrom >= this.holdMs) this.held = true;
      }
    } else if (this._gateAt !== null && !this.held) {
      // DROPPED BACK BELOW THE GATE before the hold completed: the whole side
      // starts again, samples included -- they were measurements of an attempt
      // the player abandoned. Once `held` is earned, an ordinary wobble does
      // not take it back; only beating the plateau does (above).
      this._gateAt = null;
      this.arrived = false;
      this._holdFrom = null;
      samples.length = 0;
    } else if (tMs - this._t0 >= this.timeoutMs && this._gateAt === null) {
      // THE SIDE WAS NEVER ATTEMPTED. It does not resolve as a success holding
      // whatever happened to be on screen — that is the bug that, on the other
      // platform, would have computed a reach near zero, clamped to the device
      // minimum of 5°, and persisted it across every game. An unattempted side
      // is a failure and says so.
      this._fail('timeout');
    }
    return this;
  }

  /** Advance to the next side. Refuses unless the current one was held, so a
   *  caller cannot skip past a side that was never measured. */
  next(tMs = 0) {
    if (!this.held) return false;
    if (this.phase === PHASE.right) this._enter(PHASE.left, tMs);
    else if (this.phase === PHASE.left) this.phase = PHASE.done;
    else return false;
    return true;
  }

  cancel() { this._fail('cancelled'); return this; }

  _enter(phase, tMs) {
    this.phase = phase;
    this._t0 = tMs;
    this._gateAt = null;
    this._bestAtReset = 0;
    this._plateauFrom = null;
    this.arrived = false;
    this._holdFrom = null;
    this.held = false;
  }

  _fail(reason) {
    this.phase = PHASE.failed;
    this.reason = reason;
    this.held = false;
  }

  /** Whether the current side's movement gate is open — the player is past
   *  [minSideDeg] and the hold is running. Public because the UI has to show
   *  the difference between "not counting yet" and "counting". */
  get gateOpen() { return this._gateAt !== null; }

  /** How far through the hold, 0 to 1. The UI draws this, and it is the whole
   *  feedback for the one step where the player is asked to do nothing: without
   *  it "hold it" is an instruction with no way to tell how long is left, or
   *  whether the lean is even registering. */
  get holdProgress() {
    if (this.held) return 1;
    if (!this.arrived || this._holdFrom === null || this._last === null) return 0;
    return Math.min(1, Math.max(0, (this._last - this._holdFrom) / this.holdMs));
  }

  get reachRight() { return percentile(this.right, 0.90); }

  /** THE SIDES ARE NOT SYMMETRIC, because the values are signed: on the left the
   *  overshoot spike is the most NEGATIVE reading, so the percentile that
   *  discounts it is the 10th. Taking 0.9 on both sides would discount the
   *  spike on one side and select FOR it on the other. */
  get reachLeft() { return percentile(this.left, 0.10); }

  /** Half the span, with headroom. See trap 2 at the top of the file. */
  get reach() {
    return ((this.reachRight - this.reachLeft) / 2) * this.headroom;
  }

  /**
   * THE ONLY WAY A NUMBER LEAVES THIS MODULE, and the only place that decides
   * whether there is one.
   *
   * The plausibility check lives HERE rather than in the caller, so there is no
   * window in which a UI can light a button or print "that's your range" for a
   * value a later gate would refuse. That window is exactly what the Flutter
   * screen had: it enabled its save at 3° while the store rejected under 6°, so
   * an ordinary timid first attempt measured 4.6°, displayed it, accepted the
   * tap, and was dropped on the way to storage — failing SAFE, and therefore
   * invisibly. One function, one gate, checked before both the setter and the
   * success message.
   */
  result() {
    if (this.phase === PHASE.failed) {
      return { ok: false, reason: this.reason, deg: null };
    }
    if (this.phase !== PHASE.done) {
      return { ok: false, reason: 'incomplete', deg: null };
    }
    const deg = this.reach;
    if (!Number.isFinite(deg) || deg < this.minDeg || deg > this.maxDeg) {
      return { ok: false, reason: 'implausible', deg };
    }
    return { ok: true, reason: null, deg };
  }
}
