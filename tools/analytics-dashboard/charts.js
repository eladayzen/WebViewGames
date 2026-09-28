// The charts. Three, each answering one of the questions actually asked of this
// data -- with a table view beside them so nothing is gated behind colour.
//
// FORM BEFORE COLOUR, which is the order that stops a dashboard being decorative:
//
//   "where do runs end"      -> horizontal stacked bar per level, cleared vs failed.
//                               Part-to-whole with long category names, so horizontal.
//   "how much is played"     -> stacked columns per day, by game. Change over time.
//   "how many runs, how far" -> stat tiles. A handful of headline numbers is a KPI
//                               row, not a grouped bar chart of one value each.
//
// COLOUR BY JOB, not by taste:
//   cleared / failed are STATES, so they take the reserved status palette (good,
//   critical) and ship with a legend that names them -- colour never carries the
//   meaning alone.
//   games are IDENTITY, so they take categorical slots 1-5 in fixed order. That
//   order is the colourblind-safety mechanism rather than decoration: validated at
//   worst-adjacent CVD deltaE 8.4 and normal-vision 19.3 against this dark surface.
//   A sixth game folds into "Other" rather than inventing a hue.

export const SURFACE = '#1a1a19';

/** Categorical slots 1-5, dark steps. Fixed order -- never cycled, never sorted. */
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];

/** Reserved status palette. Never reused for "series 6". */
export const STATUS = { good: '#0ca30c', critical: '#d03b3b' };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Stable colour per game, assigned by first appearance and then never moved.
 * Colour follows the ENTITY, not its rank -- so a filter that drops a game must
 * not repaint the survivors.
 */
export function gameColours(games) {
  const map = new Map();
  games.forEach((g, i) => map.set(g, SERIES[i] ?? '#6b6a63'));
  return map;
}

/**
 * WHERE RUNS END. One row per level, split cleared against failed.
 *
 * The chart this whole exercise exists for: a level with a long red segment is
 * one people do not get past, which is the question a ladder is tuned against.
 *
 * Rows stay in LADDER ORDER rather than sorted by size. The ladder is the axis
 * here -- re-sorting by magnitude would destroy the very shape being read.
 */
export function dropOff(events, game) {
  const rows = new Map();
  const modes = new Set();
  for (const e of events) {
    if (e.params.game !== game || e.event !== 'web_level_end') continue;
    const id = e.params.level_id ?? '?';
    const mode = e.params.mode ?? '';
    const n = Number(e.params.level_number) || 0;
    modes.add(mode);
    /**
     * KEYED BY MODE TOO, because level_number is only meaningful WITHIN a ladder.
     *
     * Skateboard Extreme has two -- missions and races -- and sorting them into a
     * single list put race 6 between mission 1 and mission 40, implying a
     * sequence that does not exist. Caught by looking at the rendered chart,
     * which is the step no colour validator can do for you.
     */
    const key = `${mode}|${id}`;
    if (!rows.has(key)) rows.set(key, { id, mode, n, clear: 0, fail: 0 });
    const r = rows.get(key);
    if (e.params.result === 'clear') r.clear++; else r.fail++;
  }
  const manyModes = modes.size > 1;
  const list = [...rows.values()].sort((a, b) => (
    a.mode === b.mode ? a.n - b.n : String(a.mode).localeCompare(String(b.mode))));
  if (!list.length) return '<p class="none">no finished levels yet</p>';
  const max = Math.max(1, ...list.map((r) => r.clear + r.fail));

  return `<div class="bars">${list.map((r) => {
    const total = r.clear + r.fail;
    const w = (v) => (v / max) * 100;
    // A segment narrower than this cannot hold its own number with padding on
    // both sides, so the value is left off and the row total at the end carries
    // it. Never overflow:hidden -- that crops digits and is worse than nothing.
    const fits = (v) => w(v) > 9;
    return `<div class="bar-row">
      <div class="bar-label" title="${esc(r.mode ? `${r.mode} · ${r.id}` : r.id)}">${manyModes ? `<span class="mode">${esc(r.mode)}</span> ` : ''}${esc(r.id)}</div>
      <div class="bar-track">
        ${r.clear ? `<div class="seg clear" style="width:${w(r.clear)}%" title="${esc(r.id)} — ${r.clear} cleared">${fits(r.clear) ? r.clear : ''}</div>` : ''}
        ${r.fail ? `<div class="seg fail" style="width:${w(r.fail)}%" title="${esc(r.id)} — ${r.fail} failed">${fits(r.fail) ? r.fail : ''}</div>` : ''}
      </div>
      <div class="bar-total">${total}</div>
    </div>`;
  }).join('')}</div>`;
}

/**
 * PLAY TIME BY DAY, stacked by game.
 *
 * A session's play time is the LARGEST duration_seconds it carried, never the
 * sum: every heartbeat reports the session's running total, so adding them would
 * count the same minutes over and over. That is the single easiest mistake to
 * make with this data, which is why it is spelled out rather than assumed.
 */
export function playByDay(events, colours) {
  const best = new Map(); // day|game -> seconds
  for (const e of events) {
    const g = e.params.game;
    const d = Number(e.params.duration_seconds);
    if (!g || !Number.isFinite(d)) continue;
    if (e.event !== 'web_heartbeat' && e.event !== 'web_game_end') continue;
    const day = e.at.slice(0, 10);
    const key = `${day}|${g}`;
    // Max per game per day. Two sessions of one game in a day under-count a
    // little; the alternative is inventing session boundaries this data does not
    // carry, and for a play-time number over-counting is the worse error.
    if (!best.has(key) || d > best.get(key)) best.set(key, d);
  }
  if (!best.size) return '<p class="none">no play time recorded yet</p>';

  const days = [...new Set([...best.keys()].map((k) => k.split('|')[0]))].sort();
  const totals = days.map((day) => {
    const parts = [...best.entries()]
      .filter(([k]) => k.startsWith(day + '|'))
      .map(([k, secs]) => ({ game: k.split('|')[1], secs }));
    return { day, parts, total: parts.reduce((a, p) => a + p.secs, 0) };
  });
  const max = Math.max(1, ...totals.map((t) => t.total));

  return `<div class="cols">${totals.map((t) => `
    <div class="col-slot">
      <div class="col-value">${Math.round(t.total / 60)}m</div>
      <div class="col-rail">
        <div class="col-stack" style="height:${(t.total / max) * 100}%">
          ${t.parts.map((p) => `<div class="col-seg" style="height:${(p.secs / t.total) * 100}%;background:${colours.get(p.game) ?? '#6b6a63'}"
               title="${esc(p.game)} — ${Math.round(p.secs / 60)}m ${Math.round(p.secs % 60)}s"></div>`).join('')}
        </div>
      </div>
      <div class="col-label">${t.day.slice(5)}</div>
    </div>`).join('')}</div>`;
}

/**
 * The legend. Always present for two or more series -- identity never rests on
 * colour alone, and for the status pair the words carry it outright.
 */
export function legend(items) {
  return `<div class="legend">${items.map(([label, colour]) =>
    `<span class="key"><i style="background:${colour}"></i>${esc(label)}</span>`).join('')}</div>`;
}
