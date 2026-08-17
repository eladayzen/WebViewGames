// POC-7 / POC-8 instrumentation (§2, §10).
//
// "This is a POC deliverable, not a debug nicety; it is how the experiment
// gets judged." And §12's framing of the risk: "The risk to manage is *not*
// picking wrong -- it is the decision being made casually, from one short
// play, without the metrics."
//
// So: four metrics, collected automatically, EVERY SAMPLE TAGGED WITH THE
// MODE THAT PRODUCED IT (§5.2), accumulating across mode toggles inside one
// session so the two columns can be read side by side on the board.
//
//   1. Lateral corrections per second, under the hardest available wave.
//   2. Survival rate through the narrowest authored aisle, across N attempts.
//   3. Time-to-first-hit for a naive walk-up player.
//   4. Vertical-axis usage: dwell past the deadzone, and a count of "vertical
//      dashes" (sustained near-max vertical input for > 0.4 s).
//
// (4) is the drift-chasing detector and the metric Mode S most has to pass
// (§5.6, §12): if the instrumentation shows dashes even with the lateral
// placement rule and the offset cap in place, the answer is to remove ground
// pickups from Mode S entirely -- not to relax the vertical rule.

import { INSTRUMENTATION, AISLE_MIN } from '../data/tuning.js';
import { modeId, allModeIds } from '../core/mode.js';
import { isHardestWave } from '../systems/director.js';

function emptyBucket() {
  return {
    // wall-clock simulated seconds spent in this mode
    time: 0,
    hardestTime: 0,

    // 1. lateral corrections
    corrections: 0,
    hardestCorrections: 0,

    // 2. aisle attempts
    aisleAttempts: 0,
    aisleSurvived: 0,
    narrowestAisle: Infinity,

    // 3. time to first hit, one entry per run attempt (a run = spawn to
    //    shield-zero, or to a manual restart)
    firstHitTimes: [],
    runs: 0,
    runStartTime: 0,
    runHadHit: false,

    // 4. vertical axis
    verticalDwell: 0,
    verticalDashes: 0,

    // supporting context for the acceptance criteria
    hits: 0,
    contactHits: 0,
    bulletHits: 0,
    kills: 0,
    preLockKills: 0,
    nearMisses: 0,
    wavesCleared: 0,
    // "at the capped speed a first-timer can clear wave 3 without a hit"
    hardestWaveAttempts: 0,
    hardestWaveClean: 0,
  };
}

export function createInstrumentation() {
  const byMode = {};
  for (const id of allModeIds()) byMode[id] = emptyBucket();

  // transient per-sample state (not per-mode: it resets on a mode swap)
  let lastCarveSign = 0;
  let lastCarveMag = 0;
  let vertHoldT = 0;
  let vertDashLatched = false;
  let aisleOpen = false;
  let aisleFailed = false;
  let aisleWidth = Infinity;
  let hardestPrev = false;
  let hardestClean = true;

  // A short rolling window drives the on-screen readout, so the panel shows
  // "what is happening now" rather than a session average that stops moving.
  const win = { t: 0, corrections: 0, rate: 0 };

  const api = {
    byMode,

    bucket() {
      return byMode[modeId()];
    },

    /** Called when a scenario (re)starts, including on a mode toggle. */
    runStart(w) {
      const b = api.bucket();
      b.runs++;
      b.runStartTime = 0;
      b.runHadHit = false;
      lastCarveSign = 0;
      lastCarveMag = 0;
      vertHoldT = 0;
      vertDashLatched = false;
      aisleOpen = false;
      aisleFailed = false;
      hardestPrev = false;
      hardestClean = true;
    },

    /** One fixed step of sampling. */
    sample(w, input, dt) {
      const b = api.bucket();
      b.time += dt;
      b.runStartTime += dt;

      const hardest = isHardestWave(w);
      if (hardest) b.hardestTime += dt;

      // --- 1. lateral corrections ----------------------------------------
      // A correction is a genuine REVERSAL: the carve changes sign and both
      // the outgoing and incoming magnitudes clear a threshold. Counting bare
      // sign changes would count noise around neutral, which on a board is
      // constant and would drown the signal this metric exists to carry.
      const c = input.carve;
      const sign = Math.sign(c);
      const mag = Math.abs(c);
      if (
        sign !== 0 &&
        lastCarveSign !== 0 &&
        sign !== lastCarveSign &&
        mag > INSTRUMENTATION.correctionMagnitude &&
        lastCarveMag > INSTRUMENTATION.correctionMagnitude
      ) {
        b.corrections++;
        win.corrections++;
        if (hardest) b.hardestCorrections++;
      }
      if (mag > INSTRUMENTATION.correctionMagnitude) {
        lastCarveSign = sign;
        lastCarveMag = mag;
      }

      win.t += dt;
      if (win.t >= INSTRUMENTATION.windowS) {
        win.rate = win.corrections / win.t;
        win.t = 0;
        win.corrections = 0;
      }

      // --- 4. vertical axis usage ----------------------------------------
      const n = Math.abs(input.nudge);
      if (n > 0) b.verticalDwell += dt;
      if (n >= INSTRUMENTATION.verticalDashMagnitude) {
        vertHoldT += dt;
        if (!vertDashLatched && vertHoldT >= INSTRUMENTATION.verticalDashMinS) {
          b.verticalDashes++;
          vertDashLatched = true;
        }
      } else {
        vertHoldT = 0;
        vertDashLatched = false;
      }

      // --- 2. aisle attempts ---------------------------------------------
      // An attempt opens when a pattern with an authored, moving aisle
      // commits, and closes when its last bullet has cleared. Surviving means
      // taking no hit for the whole window -- not merely being alive at the
      // end, which a lucky i-frame would otherwise flatter.
      let liveB2 = 0;
      for (let i = 0; i < w.enemyBullets.length; i++) {
        const bu = w.enemyBullets[i];
        if (bu.alive && bu.pattern === 'B2') liveB2++;
      }
      const em = w.director.emitters.find((e) => e.id === 'B2');
      const committed = !!em && em.aisle.active;
      if ((committed || liveB2 > 0) && !aisleOpen) {
        aisleOpen = true;
        aisleFailed = false;
        aisleWidth = em ? em.aisle.w : AISLE_MIN;
      } else if (aisleOpen && !committed && liveB2 === 0) {
        aisleOpen = false;
        b.aisleAttempts++;
        if (!aisleFailed) b.aisleSurvived++;
        b.narrowestAisle = Math.min(b.narrowestAisle, aisleWidth);
      }

      // --- hardest-wave cleanliness --------------------------------------
      if (hardest && !hardestPrev) {
        b.hardestWaveAttempts++;
        hardestClean = true;
      }
      if (!hardest && hardestPrev) {
        if (hardestClean) b.hardestWaveClean++;
      }
      hardestPrev = hardest;
    },

    playerHit(w, cause) {
      const b = api.bucket();
      b.hits++;
      if (cause === 'contact') b.contactHits++;
      else b.bulletHits++;
      if (aisleOpen) aisleFailed = true;
      hardestClean = false;
      // 3. time-to-first-hit, recorded once per run attempt.
      if (!b.runHadHit) {
        b.runHadHit = true;
        b.firstHitTimes.push(b.runStartTime);
      }
    },

    nearMiss() {
      api.bucket().nearMisses++;
    },

    kill(preLock) {
      const b = api.bucket();
      b.kills++;
      if (preLock) b.preLockKills++;
    },

    waveCleared() {
      api.bucket().wavesCleared++;
    },

    /** Rolling corrections/sec for the live readout. */
    liveRate() {
      return win.t > 2 ? win.corrections / win.t : win.rate;
    },

    reset() {
      for (const id of allModeIds()) byMode[id] = emptyBucket();
      win.t = 0;
      win.corrections = 0;
      win.rate = 0;
    },

    /** A plain-object summary, one row per mode, ready for the panel, the
     *  console, or a paste into the POC-8 decision note. */
    summary() {
      const out = {};
      for (const id of allModeIds()) {
        const b = byMode[id];
        const fh = b.firstHitTimes;
        out[id] = {
          mode: id,
          secondsPlayed: +b.time.toFixed(1),
          // 1
          lateralCorrectionsPerSec: b.time > 0 ? +(b.corrections / b.time).toFixed(2) : 0,
          lateralCorrectionsPerSec_hardestWave:
            b.hardestTime > 0 ? +(b.hardestCorrections / b.hardestTime).toFixed(2) : 0,
          // 2
          aisleAttempts: b.aisleAttempts,
          aisleSurvivalRate:
            b.aisleAttempts > 0 ? +(b.aisleSurvived / b.aisleAttempts).toFixed(3) : null,
          narrowestAislePx: Number.isFinite(b.narrowestAisle)
            ? Math.round(b.narrowestAisle)
            : null,
          // 3
          runs: b.runs,
          timeToFirstHitS: fh.length ? +fh[0].toFixed(2) : null,
          medianTimeToFirstHitS: fh.length ? +median(fh).toFixed(2) : null,
          // 4 -- THE drift-chasing detector
          verticalDwellS: +b.verticalDwell.toFixed(1),
          verticalDwellPct: b.time > 0 ? +((b.verticalDwell / b.time) * 100).toFixed(1) : 0,
          verticalDashes: b.verticalDashes,
          verticalDashesPerMin: b.time > 0 ? +((b.verticalDashes / b.time) * 60).toFixed(2) : 0,
          // acceptance-criteria context
          hits: b.hits,
          bulletHits: b.bulletHits,
          contactHits: b.contactHits,
          kills: b.kills,
          preLockKills: b.preLockKills,
          preLockKillPct: b.kills > 0 ? +((b.preLockKills / b.kills) * 100).toFixed(1) : 0,
          nearMisses: b.nearMisses,
          wavesCleared: b.wavesCleared,
          hardestWaveAttempts: b.hardestWaveAttempts,
          hardestWaveClearedClean: b.hardestWaveClean,
        };
      }
      return out;
    },

    /** Dump to console in a form that can be pasted straight into the POC-8
     *  decision note (§10: "the outcome is written down before any MVP work
     *  starts -- record the chosen mode, the metric values that decided it"). */
    dump() {
      const s = api.summary();
      console.info('=== Nova Vanguard POC-8 metrics ===');
      // eslint-disable-next-line no-console
      if (console.table) console.table(s);
      console.info(JSON.stringify(s, null, 2));
      return s;
    },
  };

  // Reachable from a devtools console or a scripted run.
  window.__nvMetrics = api;
  return api;
}

function median(arr) {
  const a = [...arr].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
