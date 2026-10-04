// The instrumentation panel (§10, POC-7) + the live mode toggle (§5.2).
//
// "The instrumentation panel [...] This is a POC deliverable, not a debug
// nicety; it is how the experiment gets judged."
//
// Laid out as TWO COLUMNS, S and A, side by side, always both visible. That
// shape is deliberate: POC-8 is a comparison, and a panel that only showed the
// active mode would make the comparison depend on the operator remembering
// numbers between toggles -- exactly the "decision made casually, from one
// short play, without the metrics" failure §12 names as the real risk.
//
// The panel is readable at arm's length because it will be read by someone
// standing on a balance board, not sitting at a desk.

import { modeId } from '../core/mode.js';
import { AISLE_MIN } from '../data/tuning.js';

const ROWS = [
  ['lateralCorrectionsPerSec_hardestWave', 'lat. corr/s (hard wave)', 2],
  ['lateralCorrectionsPerSec', 'lat. corr/s (all)', 2],
  ['aisleSurvivalRate', 'aisle survival', 'pct'],
  ['aisleAttempts', 'aisle attempts', 0],
  ['timeToFirstHitS', 'time to 1st hit', 's'],
  ['medianTimeToFirstHitS', 'median 1st hit', 's'],
  ['verticalDashes', 'VERTICAL DASHES', 0],
  ['verticalDashesPerMin', 'vert dashes/min', 2],
  ['verticalDwellPct', 'vert dwell %', 1],
  ['preLockKillPct', 'pre-lock kill %', 1],
  ['hardestWaveClearedClean', 'hardest-wave clean clears', 0],
  ['hits', 'hits taken', 0],
  ['secondsPlayed', 'seconds played', 1],
];

export function createPanel(root, instr, actions) {
  const el = root.querySelector('#instr-panel');
  const body = root.querySelector('#instr-body');
  const live = root.querySelector('#instr-live');
  const hint = root.querySelector('#instr-hint');

  const cells = {};
  const table = document.createElement('table');
  const head = document.createElement('tr');
  head.innerHTML = '<th></th><th id="col-S">MODE S</th><th id="col-A">MODE A</th>';
  table.appendChild(head);

  for (const [key, label] of ROWS) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = label;
    tr.appendChild(th);
    for (const m of ['S', 'A']) {
      const td = document.createElement('td');
      td.textContent = '–';
      cells[`${m}:${key}`] = td;
      tr.appendChild(td);
    }
    // The drift-chasing detector gets its own emphasis: it is the metric Mode
    // S most has to pass (§10, §12), and the one whose failure has a
    // prescribed remedy that is NOT "relax the vertical rule".
    if (key === 'verticalDashes') tr.className = 'key-metric';
    table.appendChild(tr);
  }
  body.appendChild(table);

  hint.textContent =
    `M = swap mode · N = NEXT SURFACE · P = pause · B = bands · H = hitboxes · ` +
    `L = aisle · K = black surface · I = panel · R = restart · ` +
    `C = dump metrics · X = reset metrics`;

  // HIDDEN BY DEFAULT (Amit, playtest round 3). The panel keeps its place --
  // POC-8 is settled but §10's on-device tuning pass (MVP item 23) will want
  // it again, and it is still the only readout of the drift-chasing metric
  // Mode S was flagged for -- but it is a diagnostic instrument, not chrome,
  // and a wall of statistics over the playfield is the wrong first impression
  // for anyone walking up to the game. `I` brings it back.
  let visible = false;
  el.classList.add('hidden');
  let acc = 0;

  function fmt(v, spec) {
    if (v === null || v === undefined) return '–';
    if (spec === 'pct') return `${(v * 100).toFixed(0)}%`;
    if (spec === 's') return `${v.toFixed(2)}s`;
    if (typeof spec === 'number') return v.toFixed(spec);
    return String(v);
  }

  return {
    toggle() {
      visible = !visible;
      el.classList.toggle('hidden', !visible);
    },
    setMode(id) {
      root.querySelector('#col-S').classList.toggle('active', id === 'S');
      root.querySelector('#col-A').classList.toggle('active', id === 'A');
    },
    update(w, dt, extra) {
      if (!visible) return;
      acc += dt;
      if (acc < 0.2) return; // 5 Hz is plenty and keeps DOM writes cheap
      acc = 0;

      const s = instr.summary();
      for (const [key, , spec] of ROWS) {
        for (const m of ['S', 'A']) {
          const td = cells[`${m}:${key}`];
          const next = fmt(s[m][key], spec);
          if (td.textContent !== next) td.textContent = next;
        }
      }

      // Live strip: the things that only mean anything in the moment.
      const b = instr.byMode[modeId()];
      live.textContent =
        `${modeId()} · ${extra.surface} · ${extra.waveName} · ` +
        `corr/s ${instr.liveRate().toFixed(2)} · ` +
        `bullets ${extra.bullets}/${w.caps.bullets} · ` +
        `craft ${extra.enemies}/${w.caps.enemies} · ` +
        `aisle ${extra.aisle ? Math.round(extra.aisle.w) : '–'}/${Math.round(AISLE_MIN)}px · ` +
        `shield ${w.player.shield} · near-miss ${b.nearMisses} · ` +
        `input ${extra.inputSource}`;
    },
    dump: () => instr.dump(),
    actions,
  };
}
