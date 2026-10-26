// THE MODE CONTRACT.
//
// A mode decides what a run is FOR: what the course contains, what ends the
// run, and what the end card says. It does not decide how the board feels —
// that is `rider.js` and `TUNE`, one system, shared unanimously. A mode that
// retuned the edge would make "carve" mean two different things, and the whole
// argument of this game is that it means exactly one.
//
// Ported in shape from HillBombSunsetRidge/src/modes/mode.js, with one
// deliberate difference. There, a mode is handed a `ctx` of narrow capabilities
// and can reach nothing else. Here it is handed the `Game`, because carve's
// simulation lives in one class and inverting that to build a ctx would be a
// refactor of the whole file in service of a seam that has two implementations.
// The discipline is a rule rather than a wall: A MODE MAY READ ANYTHING AND
// WRITE ONLY WHAT IT OWNS. If a third mode arrives and that rule has started to
// fray, narrow it then, against three real examples instead of a guess at what
// the second one will need.
//
// A mode gets `create(game)` and returns:
//
//   start()        the run is beginning; place whatever the mode owns
//   update(dt, t)  called every frame while playing, AFTER the world has moved
//   stop()         the run is over or abandoned; take it all away again
//   ended()        truthy when the mode wants the run finished — the returned
//                  value is passed back to `results()` as the reason
//   results()      the end card's title, detail and rows
//
// Every hook is optional. `stop()` is not: a mode that leaves something on the
// mountain — a field of rivals, a finish line — puts it in the next run, and
// the next run may be a different mode entirely.

/**
 * WHAT A MODE OWNS BESIDES ITS RULES.
 *
 * `camera` and `music` are per-mode CONFIG rather than per-mode code, and they
 * live on the registered definition rather than on the instance `create`
 * returns — so a value tuned in the dev panel during a race is still there when
 * you come back to a race, and is not there when you go and ride chill vibe.
 * Retuning the framing for one mode used to mean retuning it for both, because
 * both wrote the same `TUNE`.
 *
 * `camera` is a partial of `TUNE`: only the keys a mode wants to differ. Any it
 * omits keeps the boot value, so adding a key to `TUNE` does not silently give
 * every mode a copy of it to drift.
 *
 * `music` is a list of track ids the mode may play. More than one and the mode
 * says how it picks — chill vibe runs them all in order, 1-2-1-2; the race
 * picks ONE AT RANDOM, so two races in a row are not the same two and a half
 * minutes.
 */

/** @type {Map<string, object>} */
const registry = new Map();

/**
 * @param {{id:string, name:string, tagline:string, hidden?:boolean,
 *          create:(game:object)=>object}} def
 */
export function registerMode(def) {
  registry.set(def.id, def);
  return def;
}

/**
 * What the lobby offers.
 *
 * A mode marked `hidden` stays registered and stays reachable by id, it just is
 * not offered — which is what parking something should mean. HillBomb's own
 * `rivals` mode is the case in point: it was replaced rather than deleted, and
 * its scoring model is still the obvious basis for a future best-run mode.
 */
export function listModes() {
  // SORTED BY `order`, NOT BY IMPORT ORDER. The lobby's sequence is a design
  // decision and registration order is an accident of which import line comes
  // first in main.js — a file nobody edits thinking about what the front screen
  // looks like. Ties keep registration order, which is a stable sort.
  return [...registry.values()]
    .filter((m) => !m.hidden)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function getMode(id) {
  return registry.get(id) ?? registry.values().next().value;
}

/** The id a fresh install starts on, and the fallback for an unknown id. */
export function defaultModeId() {
  return listModes()[0]?.id ?? registry.keys().next().value;
}
