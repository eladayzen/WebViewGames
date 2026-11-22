// WHAT YOU KEEP, KEPT: the permanent abilities, between sessions.
//
// The design (Elad's, 22 Nov) is that permanent upgrades survive death. This is the
// other half of it: they also survive closing the game. Only PERMANENT abilities are
// written -- the turtle allies are earned again each level and never saved.
//
// THE APP OWNS SAVING. It injects `window.GoBalance` as the first script in the page
// (see RoboRun/src/systems/gbSdk.js, which learned this the hard way), with `load()` and
// `save(blob)` that are per-profile, so two children on one board do not share a bucket.
// So: use it when it is there, and fall back to a guarded localStorage at a plain dev
// URL, where there is no host. The blob is VERSIONED, as the host's README advises.
//
// NOT YET PROVEN ON A REAL BOARD: this runs against the host's documented shape and has
// only been exercised at a browser. Every call is guarded, and a load that fails or hangs
// gives an EMPTY build rather than a stuck boot or an exception.
import { ABILITIES } from '../core/abilities.js';

const KEY = 'shellsiege.progress';
export const VERSION = 1;
const LOAD_TIMEOUT_MS = 3000;

/** The blob to store for a build: permanent abilities only, counts only. */
export function encodeProgress(build) {
  const perm = {};
  for (const [k, a] of Object.entries(ABILITIES)) {
    if (a.kind === 'perm' && build[k] > 0) perm[k] = Math.min(a.max, Math.floor(build[k]));
  }
  return { v: VERSION, perm };
}

/**
 * A stored blob, back to counts. NEVER TRUSTS IT: unknown keys are dropped, counts are
 * clamped to each ability's max, temporary abilities are refused, and anything that is not
 * a recognisable blob gives {} -- a corrupt save must cost a player nothing but the save.
 */
export function decodeProgress(blob) {
  const out = {};
  let data = blob;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return out; } }
  if (!data || typeof data !== 'object' || data.v !== VERSION || !data.perm || typeof data.perm !== 'object') return out;
  for (const [k, n] of Object.entries(data.perm)) {
    const a = ABILITIES[k];
    if (!a || a.kind !== 'perm') continue;
    const c = Math.floor(Number(n));
    if (Number.isFinite(c) && c > 0) out[k] = Math.min(a.max, c);
  }
  return out;
}

const host = () => (typeof window !== 'undefined' && window.GoBalance && typeof window.GoBalance.load === 'function' ? window.GoBalance : null);
const ls = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };

/** Saved permanent abilities as counts ({} for a new player or on any failure). */
export async function loadProgress() {
  try {
    const h = host();
    if (h) {
      const blob = await Promise.race([
        h.load(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('load timed out')), LOAD_TIMEOUT_MS)),
      ]);
      return decodeProgress(blob);
    }
    const s = ls();
    return decodeProgress(s ? s.getItem(KEY) : null);
  } catch { return {}; }
}

/** Store the build's permanent abilities. Fire and forget: a failed save never blocks a run. */
export function saveProgress(build) {
  const blob = encodeProgress(build);
  try {
    const h = host();
    if (h && typeof h.save === 'function') { Promise.resolve(h.save(blob)).catch(() => {}); return; }
    const s = ls();
    if (s) s.setItem(KEY, JSON.stringify(blob));
  } catch { /* losing a save is better than losing a run */ }
}
