// THE POC-6 INSTRUMENTATION PANEL (§2, §10) and the FAIL_MODEL toggle (§5.8).
//
// This is a POC DELIVERABLE, NOT A DEBUG NICETY: it is how POC-7's two
// decisions -- does lean-left-to-climb read as surfing, and three-wipeout leash
// vs one-hit-ends-it -- get JUDGED rather than vibed. It ships in the MVP build
// because that A/B is still to be run on real hardware, and §12 is explicit
// that the risk to manage is "picking casually, from one short play, without
// the run-length numbers. Collect them."
//
// Every sample is tagged with the ACTIVE FAIL MODEL, because the whole point is
// a comparison.
//
// Acceptance criteria this panel exists to answer (§10, POC-7):
//   - a naive walk-up player performs a deliberate climb within 20 s
//   - time-at-neutral is >= 45% of ride time after 2-3 minutes standing
//   - lean reversals per second stay low (committed leans, not micro-corrections)
//   - mean run length for a first-timer is >= 60 s under the chosen model

import { LEAN_DEADZONE, H_TRIM, FAIL_MODEL_DEFAULT } from '../data/tuning.js';

const H_BUCKETS = 10;
const CLIMB_THRESHOLD = 0.62; // h considered a "deliberate climb toward the lip"

export class Instrumentation {
  constructor(hooks) {
    this.hooks = hooks || {};
    this.el = {
      panel: document.getElementById('instr-panel'),
      body: document.getElementById('instr-body'),
      hint: document.getElementById('instr-hint'),
    };

    const params = new URLSearchParams(window.location.search);
    const requested = params.get('fail');
    this.failModel = (requested === 'onehit' || requested === 'leash3')
      ? requested
      : FAIL_MODEL_DEFAULT;

    this.visible = params.get('instr') === '1';
    this.el.panel.classList.toggle('hidden', !this.visible);

    // Per-fail-model aggregates, so the A/B is a comparison and not a vibe.
    this.perModel = {
      leash3: newAggregate(),
      onehit: newAggregate(),
    };

    this.run = newRun();
    this._lastLeanSign = 0;

    // Debug keys. THESE ARE CHROME, NOT GAMEPLAY: they cannot move the surfer,
    // and none of them is reachable from the board -- the host forwards only
    // Space/Enter plus (in digital mode, which this game does not use) the
    // steering keys. §9.5 rule 6 is about handlers that affect game state
    // during play; a panel toggle and a config flag are not that.
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyI') {
        this.visible = !this.visible;
        this.el.panel.classList.toggle('hidden', !this.visible);
      } else if (e.code === 'KeyF') {
        this.toggleFailModel();
      }
    });
  }

  /** Switchable MID-SESSION WITHOUT A RELOAD (§5.8, §10 POC-5). */
  toggleFailModel() {
    this.failModel = this.failModel === 'leash3' ? 'onehit' : 'leash3';
    if (this.hooks.onFailModelChanged) this.hooks.onFailModelChanged(this.failModel);
    return this.failModel;
  }

  // -- per-run lifecycle ---------------------------------------------------

  beginRun() {
    this.run = newRun();
    this._lastLeanSign = 0;
  }

  endRun() {
    const agg = this.perModel[this.failModel];
    agg.runs++;
    agg.totalLength += this.run.rideTime;
    if (this.run.firstClimbAt != null) {
      agg.climbSamples++;
      agg.totalTimeToClimb += this.run.firstClimbAt;
    }
    if (this.run.firstWipeoutAt != null) {
      agg.wipeoutSamples++;
      agg.totalTimeToWipeout += this.run.firstWipeoutAt;
    }
    agg.leanTime += this.run.leanTime;
    agg.neutralTime += this.run.neutralTime;
    agg.reversals += this.run.reversals;
  }

  /** Sampled once per fixed step while the run is live. */
  sample(dt, lean, h, riding) {
    if (!riding) return;
    const r = this.run;
    r.rideTime += dt;

    // "Time spent leaning vs time at neutral" -- the direct measure of whether
    // the trim line removed the sustained-hold exertion the report flagged.
    // Neutral means inside the deadzone, i.e. the board is genuinely doing
    // nothing, not merely "leaning a little".
    if (Math.abs(lean) <= 1e-6) r.neutralTime += dt;
    else r.leanTime += dt;

    // Lean reversals per second: is the player making committed leans, or
    // stuttering? If this is high, H_RESPONSE is too high (§10).
    const sign = Math.abs(lean) < LEAN_DEADZONE ? 0 : Math.sign(lean);
    if (sign !== 0 && this._lastLeanSign !== 0 && sign !== this._lastLeanSign) r.reversals++;
    if (sign !== 0) this._lastLeanSign = sign;

    // Peak h histogram: does the player actually use the full face, or hug trim?
    const b = Math.min(H_BUCKETS - 1, Math.max(0, Math.floor(h * H_BUCKETS)));
    r.hist[b] += dt;
    if (h > r.peakH) r.peakH = h;

    // Time-to-first-deliberate-climb -- the direct answer to POC question 1.
    if (r.firstClimbAt == null && h >= CLIMB_THRESHOLD) r.firstClimbAt = r.rideTime;
  }

  noteWipeout() {
    if (this.run.firstWipeoutAt == null) this.run.firstWipeoutAt = this.run.rideTime;
    this.run.wipeouts++;
  }

  // -- rendering -----------------------------------------------------------

  update() {
    if (!this.visible) return;
    const r = this.run;
    const total = Math.max(0.001, r.leanTime + r.neutralTime);
    const neutralPct = (r.neutralTime / total) * 100;
    const revPerSec = r.rideTime > 0 ? r.reversals / r.rideTime : 0;

    const lines = [];
    lines.push(`FAIL MODEL       ${this.failModel}${this.failModel === 'leash3' ? '  (3-wipeout leash)' : '  (one hit ends it)'}`);
    lines.push(`ride time        ${r.rideTime.toFixed(1)} s`);
    lines.push(`time at neutral  ${neutralPct.toFixed(1)} %   ${neutralPct >= 45 ? 'PASS' : 'below the 45% bar'}`);
    lines.push(`lean reversals   ${revPerSec.toFixed(2)} /s`);
    lines.push(`first climb      ${r.firstClimbAt == null ? '—' : r.firstClimbAt.toFixed(1) + ' s'}${r.firstClimbAt != null && r.firstClimbAt <= 20 ? '  PASS' : ''}`);
    lines.push(`first wipeout    ${r.firstWipeoutAt == null ? '—' : r.firstWipeoutAt.toFixed(1) + ' s'}`);
    lines.push(`peak h           ${r.peakH.toFixed(2)}`);
    lines.push('h histogram      ' + histBar(r.hist));
    lines.push('');
    for (const model of ['leash3', 'onehit']) {
      const a = this.perModel[model];
      const mean = a.runs ? a.totalLength / a.runs : 0;
      const meanClimb = a.climbSamples ? a.totalTimeToClimb / a.climbSamples : null;
      const aTotal = Math.max(0.001, a.leanTime + a.neutralTime);
      lines.push(
        `${model.padEnd(7)} runs ${String(a.runs).padStart(2)}  mean ${mean.toFixed(0).padStart(3)}s`
        + `${mean >= 60 && a.runs ? ' PASS' : ''}  neutral ${((a.neutralTime / aTotal) * 100).toFixed(0)}%`
        + `  climb ${meanClimb == null ? '—' : meanClimb.toFixed(0) + 's'}`
      );
    }

    this.el.body.textContent = lines.join('\n');
    this.el.hint.textContent = 'I toggles this panel · F switches fail model live (no reload) · ?fail=onehit&instr=1';
  }
}

function newRun() {
  return {
    rideTime: 0,
    leanTime: 0,
    neutralTime: 0,
    reversals: 0,
    wipeouts: 0,
    peakH: H_TRIM,
    firstClimbAt: null,
    firstWipeoutAt: null,
    hist: new Array(H_BUCKETS).fill(0),
  };
}

function newAggregate() {
  return {
    runs: 0,
    totalLength: 0,
    climbSamples: 0,
    totalTimeToClimb: 0,
    wipeoutSamples: 0,
    totalTimeToWipeout: 0,
    leanTime: 0,
    neutralTime: 0,
    reversals: 0,
  };
}

const BLOCKS = ' ▁▂▃▄▅▆▇█';

function histBar(hist) {
  const max = Math.max(...hist, 0.001);
  return hist.map((v) => BLOCKS[Math.min(BLOCKS.length - 1, Math.round((v / max) * (BLOCKS.length - 1)))]).join('');
}
