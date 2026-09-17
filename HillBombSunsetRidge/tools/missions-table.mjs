// THE MISSION LADDER, as a table you can read without asking anybody.
//
//     npm run missions          -> writes MISSIONS.md and MISSIONS.csv
//     npm run missions -- --csv -> prints the CSV to stdout
//
// A GENERATOR, NOT A DOCUMENT. Amit: "is there an organized list somewhere of
// the whole missions, how much time per mission and maybe other stats, that I
// don't have to ask of you each time?"
//
// A hand-written table answers that once and then starts lying, quietly, the
// first time a number moves -- and the numbers move constantly. This reads
// data/missions.js, so the only way for it to be wrong is for the game to be
// wrong. Re-run it after any change to the ladder and commit the output.
//
// EVERYTHING HERE IS DERIVED EXCEPT THE FOUR MODEL CONSTANTS BELOW. Those are
// Amit's difficulty-points numbers and the measured ramp supply; they live in
// the big comment above AUTHORED in data/missions.js, and they are repeated here
// because nothing in the game reads them -- DP is a sizing tool for humans, not
// something the game computes. If they change there, change them here.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MISSIONS } from '../src/data/missions.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/** Amit's per-item difficulty points. A ramp went 2 -> 3 after it was played. */
const COST = { pickup: 1, launch: 3, grind: 4, boost: 4, idol: 5 };
/** What each thing pays, so a score ask can be netted against the rest of it. */
const PAYS = { pickup: 120, idol: 300, launch: 250, grind: 300, boost: 90 };
/** Mixing multiplier -- switching tasks costs a line you cannot optimise for. */
const MIX = { 1: 1.0, 2: 1.3, 3: 1.7 };
/** DP per unit of ceiling-fraction, for a score objective. */
const SCORE_DP = 65;
/**
 * Measured headless across three hills: ramps arrive at 10.5-12.3 per 1000m,
 * and a run holds roughly 20 m/s once it is moving. This is the denominator
 * that the original difficulty model never checked -- see data/missions.js.
 */
const RAMPS_PER_M = 11.6 / 1000;
const SPEED = 20;

const LABEL = { pickup: 'crystal', launch: 'ramp', grind: 'rail', boost: 'gate', score: 'pts' };

function describe(o) {
  if (o.kind === 'score') return `${(o.count / 1000).toFixed(1)}k pts`;
  const word = o.type === 'idol' ? 'idol' : LABEL[o.kind];
  return `${o.count} ${word}${o.count > 1 && word !== 'pts' ? 's' : ''}`;
}

function analyse(m) {
  // The measured ceiling, recovered from the three-star bar rather than
  // re-exported: starTiers sets stars[1] = round(0.85 * ceiling * DIFFICULTY).
  const ceiling = m.stars ? Math.round(m.stars[1] / 0.595) : 0;
  let raw = 0, paidByOthers = 0, score = 0;
  for (const o of m.objectives) {
    if (o.kind === 'score') { score = o.count; continue; }
    const key = o.type === 'idol' ? 'idol' : o.kind;
    raw += o.count * COST[key];
    paidByOthers += o.count * PAYS[key];
  }
  if (score) raw += Math.round(SCORE_DP * (Math.max(0, score - paidByOthers) / ceiling));
  const dp = Math.round(raw * (MIX[m.objectives.length] ?? 1.7));
  const ramp = m.objectives.find((o) => o.kind === 'launch');
  const supply = Math.round(RAMPS_PER_M * SPEED * m.seconds);
  return {
    ...m, ceiling, dp,
    asks: m.objectives.map(describe).join(' + '),
    rampPct: ramp ? Math.round((ramp.count / supply) * 100) : null,
    rampSupply: ramp ? supply : null,
  };
}

const rows = MISSIONS.map(analyse);
const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);

// ---- markdown --------------------------------------------------------------

const md = [];
md.push('# Skateboard Extreme — the mission ladder');
md.push('');
md.push('**Generated — do not edit.** `npm run missions` rebuilds it from');
md.push('`src/data/missions.js`, which is the only place these numbers live.');
md.push('');
md.push('Counts are EFFECTIVE: what the player is actually asked for, after the');
md.push('0.7 difficulty scaling. The authored numbers in the source are higher.');
md.push('');
md.push('- **DP** — difficulty points. Budget: under 50 through the middle, 60 at most in the last ten.');
md.push('- **ramp %** — the ramp ask as a share of the ramps that exist on that hill in that clock.');
md.push('  Anything over 40% is a "hunt them all" rather than a "collect some". This is the');
md.push('  column the original model never checked, and it is how mission 15 shipped asking for');
md.push('  91% of them.');
md.push('- **2★ / 3★** — score thresholds. The first star is finishing at all.');
md.push('- **ceiling** — every point-bearing prop on that hill, measured. The star bars are 55% and 85% of it.');
md.push('');
md.push('| # | mission | clock | terrain | objectives | DP | ramp % | 2★ | 3★ | ceiling |');
md.push('|--:|---|--:|---|---|--:|--:|--:|--:|--:|');
for (const r of rows) {
  md.push(`| ${r.number} | **${r.name}** | ${r.seconds}s | ${r.terrain || '—'} | ${r.asks} | ${r.dp} | ${r.rampPct == null ? '—' : r.rampPct + '%'} | ${r.stars[0].toLocaleString()} | ${r.stars[1].toLocaleString()} | ${r.ceiling.toLocaleString()} |`);
}
md.push('');
md.push('## Briefs');
md.push('');
for (const r of rows) md.push(`${num(r.number, 2)}. **${r.name}** — ${r.brief}`);
md.push('');
md.push('## Totals');
md.push('');
const dps = rows.map((r) => r.dp);
const clock = rows.reduce((n, r) => n + r.seconds, 0);
md.push(`- ${rows.length} missions, ${Math.floor(clock / 60)}m ${clock % 60}s of clock end to end`);
md.push(`- DP from ${Math.min(...dps)} to ${Math.max(...dps)}`);
md.push(`- over budget (DP > 60): ${rows.filter((r) => r.dp > 60).map((r) => `${r.number} ${r.name}`).join(', ') || 'none'}`);
md.push(`- ramp asks over 40% of supply: ${rows.filter((r) => r.rampPct >= 40).map((r) => `${r.number} ${r.name} (${r.rampPct}%)`).join(', ') || 'none'}`);
const byKind = {};
for (const m of MISSIONS) for (const o of m.objectives) {
  const k = o.type === 'idol' ? 'idol' : o.kind;
  byKind[k] = (byKind[k] || 0) + 1;
}
md.push(`- missions asking for each kind: ${Object.entries(byKind).map(([k, n]) => `${LABEL[k] || k} ${n}`).join(', ')}`);
md.push('');

// ---- csv -------------------------------------------------------------------
// Flat and one-objective-per-column, so it opens in Sheets and can be diffed.
// Deliberately the shape a Remote Config override would take: if the ladder ever
// becomes data the app fetches, this is the table it fetches.

const KINDS = ['pickup', 'idol', 'launch', 'grind', 'boost', 'score'];
const csv = [];
csv.push(['number', 'id', 'name', 'brief', 'seconds', 'terrain',
  ...KINDS.map((k) => LABEL[k] || k), 'dp', 'ramp_pct', 'star2', 'star3', 'ceiling'].join(','));
for (const r of rows) {
  const got = {};
  for (const o of r.objectives) got[o.type === 'idol' ? 'idol' : o.kind] = o.count;
  csv.push([
    r.number, r.id, `"${r.name}"`, `"${r.brief.replace(/"/g, '""')}"`, r.seconds, r.terrain || '',
    ...KINDS.map((k) => got[k] ?? ''),
    r.dp, r.rampPct ?? '', r.stars[0], r.stars[1], r.ceiling,
  ].join(','));
}

// ---- the QA view -----------------------------------------------------------
//
// A THIRD FILE, because a tester and a designer need different tables and a
// shared one serves neither.
//
// This drops `dp` and `ramp_pct`. Both are design instruments: DP is a sizing
// budget that exists to be argued about, and ramp_pct is a diagnostic whose
// denominator is a measured average -- one that was WRONG for a while, because
// the first sample of it included teaching missions, which strip props off their
// hills. A tester reading a number like that has no way to know it is provisional
// and every reason to treat it as fact.
//
// What is left is only what a tester can verify against the screen: the clock in
// the format the HUD shows it, the ask in the words the briefing card uses, and
// the two star bars. Nothing here is derived from a model -- it is read straight
// off the mission.

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const qa = [];
qa.push(['#', 'mission', 'clock', 'brief', 'objectives', '2_stars', '3_stars', 'hill'].join(','));
for (const r of rows) {
  qa.push([
    r.number, `"${r.name}"`, mmss(r.seconds), `"${r.brief.replace(/"/g, '""')}"`,
    `"${r.asks}"`, r.stars[0], r.stars[1], r.terrain || '',
  ].join(','));
}

if (process.argv.includes('--csv')) {
  console.log(csv.join('\n'));
} else if (process.argv.includes('--qa')) {
  console.log(qa.join('\n'));
} else {
  writeFileSync(join(ROOT, 'MISSIONS.md'), md.join('\n'));
  writeFileSync(join(ROOT, 'MISSIONS.csv'), csv.join('\n') + '\n');
  writeFileSync(join(ROOT, 'MISSIONS-QA.csv'), qa.join('\n') + '\n');
  console.log(`wrote MISSIONS.md, MISSIONS.csv and MISSIONS-QA.csv — ${rows.length} missions`);
}
