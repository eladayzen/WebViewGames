// The run's clock: the thing that ends a descent, and the thing every piece of
// course furniture on the mountain is now paying into.
//
// ── WHY THIS REPLACED BOTH THE OBJECTIVE AND THE WIPEOUTS ───────────────────
// It replaced `mission.js` because the descent became endless. An objective
// ("pass ten gates, take ten motes") is the right shape for a run with a known
// length — it gives a two-and-a-half minute track something to be about. Once
// the music loops and the mountain does not stop, a goal that completes at forty
// seconds and then sits at 10/10 for an hour is not a goal, it is a trophy in
// the corner of the screen.
//
// It replaced the three wipeout pips because a pip is an un-tunable unit. A
// wipeout cost a THIRD of a run, which is enormous, and the only knobs were two,
// three or four lives. As seconds it is one number you can turn by halves.
//
// ── WHY THE CLOCK IS THE RIGHT TERMINATOR FOR THIS GAME SPECIFICALLY ────────
// carve's one rule is that speed is gravity's component along the heading, minus
// drag, minus what the edge scrubs: point down the fall line and you accelerate,
// carve across it and you bleed. Until now, carving across cost SCORE — 2 points
// a metre, an abstract price the player cannot feel while riding. It now costs
// TIME, and time is the run. It is the same trade the game was always built on,
// with the consequence made immediate.
//
// And the wager is real in both directions, because the things that PAY time are
// the things that cost speed to reach: gates alternate sides at up to 15.4 m off
// the centre line, drift lines sit between 3.5 and 17 m out. Every few seconds
// the mountain asks whether the detour is worth the seconds it costs, and the
// answer changes with how much clock is left.
//
// ── THE NUMBERS, AND WHERE THEY CAME FROM ───────────────────────────────────
// Measured off the real planner over five laps, not estimated:
//
//   gates    one per 4.08 s  (p10 2.18 / p50 4.37 / max 5.44)  → 0.2465/s
//   motes    one chain per 133 m, mean 6.5 motes               → 0.95/s at 70 km/h
//            IF every one is taken, which no real line ever is
//   kickers  one per 21.4 s
//   chains   one per 6.8 s at 70 km/h — capped by geometry, not by sweeping
//
// The clock drains at 1 s/s, so for gates ALONE to sustain a run a gate would
// have to pay 4.06 s.
//
// ── HOW THESE NUMBERS WERE ARRIVED AT ───────────────────────────────────────
// By playing it, twice, which is the only way this particular number could ever
// have been found. The first economy was built on ASSUMED hit rates — 50% of
// motes, 90% of gates for a "solid" rider — and from the seat it was far too
// hard, which says the assumptions were wrong and not that the structure was.
// x5 was then too easy. These are x5 less 30%, so x3.5 on the original, and the
// values are deliberately left as the arithmetic rather than rounded off: the
// next pass should move them by feel again, not tidy them.
//
// Net seconds per second against the measured arrival rates above:
//
//                        x1      x5    x3.5
//   struggling (20/30%)  -0.47  +0.81  +0.27
//   ok         (40/60%)   ----  +2.75  +1.62
//   solid      (50/90%)  +0.03  +4.02  +2.51
//
// THE STRUGGLING ROW IS THE ONE THAT MOVED, from +0.81 to +0.27 — near enough
// to break-even that a genuinely bad run now drifts down instead of climbing,
// which is the whole difference between a clock and a decoration. Every row is
// still positive, so anyone competent still rides pinned at the cap; that is
// known and accepted for now. The cap went 60 -> 120 and the start 45 -> 60 at
// the x5, so the surplus is at least VISIBLE — at a 60 s cap even the struggling
// row filled it in eighteen seconds and the numeral would have stopped moving,
// which is a worse readout than a tense one.
//
// ── WHY THE STREAK MULTIPLIES THE CHAIN AND NOT THE MOTE ────────────────────
// The game already has a streak: `multFor(combo) = min(8, 1 + floor(combo/4))`,
// maxing at EIGHT, and the HUD already calls it one. Applied to a one-second
// mote at a realistic half-take that is 3.8 s/s of income against a 1.0 s/s
// drain — the clock would gain three minutes per minute and the countdown would
// stop being one.
//
// So the per-mote second is FLAT and the streak multiplies the full-chain bonus
// instead. That is rate-limited by geometry: chains cannot arrive closer than
// 133 m however well anyone rides, so there is a hard ceiling on the income no
// amount of skill can lift. It also lands the streak exactly where `pickups.js`
// already argues all the money belongs — on the CHAIN, never on the mote, the
// same reason `chainValue` pays 308 for a whole line and 25 for two motes out
// of it. Sampling a drift line buys a second; riding one buys the run.
//
// ── THE CAP IS NOT A SAFETY RAIL, IT IS THE ENDGAME ─────────────────────────
// Any rider running a positive net would otherwise accumulate an unbounded clock
// and the timer would quietly stop being part of the game. Pinned at the cap,
// surplus time is simply wasted, and the only thing left to play for is distance
// — which is the leaderboard number. The cap is what hands a good player off
// from surviving to competing, and after the x5 that is most of them.

/**
 * Every constant a balance pass should need, in one place.
 *
 * `start` under `cap` on purpose: the run opens with headroom to earn into
 * rather than a full clock that can only ever go down.
 */
export const CLOCK = {
  start: 60,
  cap: 120,
  /** A gate cleanly passed. */
  gate: 5.25,
  /** One mote. Flat — see the header on why the streak may not touch this. */
  mote: 3.5,
  /** A clean landing. Kickers are otherwise a time HOLE — see `main.js`. */
  kicker: 7.0,
  /** A whole drift line, before the streak multiplier. */
  chain: 7.0,
  /** How far the streak may multiply the chain bonus. Three, not eight. */
  chainMultCap: 3,
  /**
   * A wipeout. NOT scaled with the rest — see the x5 note in the header. At
   * -25 a crash would cost five motes and put back exactly the difficulty the
   * x5 was there to remove; at -10 it is two motes, which is felt without being
   * the thing that ends runs. The combo zeroing in `_wipeout` is still the other
   * half of the punishment and it did not need scaling at all.
   */
  wipeout: -10,
  /** Below this the HUD reads as urgent and the music starts to close up. */
  lowAt: 15,
};

/**
 * The clock.
 *
 * Deliberately dumb, exactly as `Mission` was: it counts down, it clamps at both
 * ends, and it reports the one frame it ran out on. Every decision about what a
 * gate or a mote or a landing IS stays in the module that owns that thing.
 */
export class Timer {
  constructor(spec = CLOCK) {
    this.spec = spec;
    this.reset();
  }

  reset() {
    this.remaining = this.spec.start;
    this.expired = false;
    /** True for the single frame the clock ran out on. */
    this.justExpired = false;
    /** Seconds granted this frame, for the HUD to flash. Signed. */
    this.lastGain = 0;
    /** Running total of seconds earned, for the results screen. */
    this.earned = 0;
  }

  /** Drain. Call once a frame with the real elapsed time. */
  tick(dt) {
    this.justExpired = false;
    this.lastGain = 0;
    if (this.expired) return;
    this.remaining -= dt;
    if (this.remaining <= 0) {
      this.remaining = 0;
      this.expired = true;
      this.justExpired = true;
    }
  }

  /**
   * Grant (or charge) seconds.
   *
   * CLAMPED AT THE CAP, and the clamp is why `earned` is tracked separately: a
   * player riding at the ceiling is still earning, and a results screen that
   * showed only the clock would tell them they had done nothing.
   *
   * Returns what was actually added, so a caller can decide whether the gain is
   * worth a callout — awarding a visible "+1.0s" that the cap silently ate is
   * the kind of small lie that makes a HUD stop being trusted.
   */
  add(seconds) {
    if (this.expired) return 0;
    const before = this.remaining;
    this.remaining = Math.max(0, Math.min(this.spec.cap, this.remaining + seconds));
    const delta = this.remaining - before;
    this.lastGain += delta;
    if (seconds > 0) this.earned += seconds;
    if (this.remaining <= 0) {
      this.expired = true;
      this.justExpired = true;
    }
    return delta;
  }

  /** 0..1 against the cap — what the HUD fills and the music opens up by. */
  get fraction() {
    return Math.max(0, Math.min(1, this.remaining / this.spec.cap));
  }

  /** True while the clock is short enough to be the only thing worth watching. */
  get low() {
    return this.remaining <= this.spec.lowAt;
  }

  /** Call once a frame, after any granting, to clear the one-frame flags. */
  endFrame() {
    this.justExpired = false;
    this.lastGain = 0;
  }

  /** What the HUD draws and the results screen reports. */
  get state() {
    return {
      remaining: this.remaining,
      cap: this.spec.cap,
      fraction: this.fraction,
      low: this.low,
      earned: this.earned,
    };
  }
}
