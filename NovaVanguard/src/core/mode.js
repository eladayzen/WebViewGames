// The single accessor for FRAMING_MODE (§5.2).
//
// "One config value, FRAMING_MODE in {'S','A'}, selects everything below. It
// lives in /data/tuning.js and is read through a single accessor; no other
// part of the codebase branches on it ad hoc."
//
// So: nowhere else in this codebase may write `mode === 'S'`. Anything
// mode-dependent is a NAMED FIELD on the mode record in tuning.js, read
// through cfg(). If you find yourself wanting a new branch, add a field.
//
// The one deliberate exception is the instrumentation layer (§10), which
// tags every sample with the mode id that produced it -- that is reading the
// mode as data, not branching behaviour on it.

import { MODES, DEFAULT_FRAMING_MODE } from '../data/tuning.js';

let current = DEFAULT_FRAMING_MODE;
const listeners = new Set();

/** Resolve the boot mode from ?mode=S|A, for scripted runs (§5.2). */
export function resolveBootMode() {
  let m = DEFAULT_FRAMING_MODE;
  try {
    const q = new URLSearchParams(window.location.search).get('mode');
    if (q && MODES[q.toUpperCase()]) m = q.toUpperCase();
  } catch {
    /* no window.location in a non-browser context; keep the default */
  }
  current = m;
  return current;
}

/** The active mode id: 'S' or 'A'. */
export function modeId() {
  return current;
}

/** The active mode's full config record. Everything mode-dependent is here. */
export function cfg() {
  return MODES[current];
}

/** Config for a specific mode, without switching to it (used by the validator,
 *  which must check BOTH modes' authored data, not just the active one). */
export function cfgFor(id) {
  return MODES[id];
}

export function allModeIds() {
  return Object.keys(MODES);
}

/**
 * Switch modes mid-session (§5.2). The caller is responsible for restarting
 * the current scenario -- this only flips the flag and notifies. The doc
 * requires the swap to land in under a second and to preserve nothing.
 */
export function setMode(id) {
  if (!MODES[id] || id === current) return false;
  current = id;
  for (const fn of listeners) fn(current);
  return true;
}

export function toggleMode() {
  return setMode(current === 'S' ? 'A' : 'S');
}

export function onModeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
