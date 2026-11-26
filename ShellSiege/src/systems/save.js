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
export function encodeProgress(build, run = null, unlocked = 1) {
  const perm = {};
  for (const [k, a] of Object.entries(ABILITIES)) {
    if (a.kind === 'perm' && build[k] > 0) perm[k] = Math.min(a.max, Math.floor(build[k]));
  }
  const blob = { v: VERSION, perm };
  // THE FURTHEST LEVEL REACHED (the level picker offers 1..this): a level opens when the one before it is cleared
  if (Number.isFinite(unlocked) && unlocked > 1) blob.unlocked = Math.min(999, Math.floor(unlocked));
  // THE RUN IN PROGRESS (for the lobby's CONTINUE): where you are, and EVERYTHING you hold, temporary
  // abilities included. Unlike `perm` this is only meant to be picked up again, never banked.
  if (run && Number.isFinite(run.level)) {
    const held = {};
    for (const [k, a] of Object.entries(ABILITIES)) if (run.build && run.build[k] > 0) held[k] = Math.min(a.max, Math.floor(run.build[k]));
    blob.run = { level: Math.floor(run.level), room: Math.max(0, Math.floor(run.room || 0)), build: held };
  }
  return blob;
}

/** The furthest level unlocked, from a blob (1 when none). */
export function decodeUnlocked(blob) {
  let data = blob;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return 1; } }
  const n = data && typeof data === 'object' && data.v === VERSION ? Math.floor(Number(data.unlocked)) : 1;
  return Number.isFinite(n) && n >= 1 && n <= 999 ? n : 1;
}

/** The run stored in a blob, or null. Never trusted: unknown abilities are dropped, counts clamped. */
export function decodeRun(blob) {
  let data = blob;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return null; } }
  const r = data && typeof data === 'object' && data.v === VERSION ? data.run : null;
  if (!r || typeof r !== 'object') return null;
  const level = Math.floor(Number(r.level)), room = Math.floor(Number(r.room));
  if (!Number.isFinite(level) || level < 1 || level > 999 || !Number.isFinite(room) || room < 0 || room > 99) return null;
  const build = {};
  if (r.build && typeof r.build === 'object') {
    for (const [k, n] of Object.entries(r.build)) {
      const a = ABILITIES[k], c = Math.floor(Number(n));
      if (a && !a.locked && Number.isFinite(c) && c > 0) build[k] = Math.min(a.max, c);
    }
  }
  return { level, room, build };
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

// ============================ SLOTS (PRD_v2: four of them) ============================
// The stored blob is { v: 2, slots: [slot|null x4] }. A slot is the old one-save shape ({ v:1, perm, unlocked, run }) plus `saved`
// (ms since 1970): the slot list is ordered by it. Old single-save blobs are ignored (Elad, 26 Nov: old progress may go).
export const SLOT_COUNT = 4;
const SLOTS_VERSION = 2;
let cache = Array(SLOT_COUNT).fill(null);
let active = 0;

/** One slot read back: never trusted. Null when it is empty or unreadable. */
export function decodeSlot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const perm = decodeProgress({ v: VERSION, perm: raw.perm }), run = decodeRun({ v: VERSION, run: raw.run });
  const unlocked = decodeUnlocked({ v: VERSION, unlocked: raw.unlocked });
  const saved = Number.isFinite(Number(raw.saved)) ? Math.max(0, Math.floor(Number(raw.saved))) : 0;
  return { perm, run, unlocked: Math.max(unlocked, run ? run.level : 1), saved };
}

export function decodeSlots(blob) {
  let data = blob;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = null; } }
  const out = Array(SLOT_COUNT).fill(null);
  if (!data || typeof data !== 'object' || data.v !== SLOTS_VERSION || !Array.isArray(data.slots)) return out;
  for (let i = 0; i < SLOT_COUNT; i++) out[i] = decodeSlot(data.slots[i]);
  return out;
}

/** Slots in the order the lobby lists them: most recently played first. Empty ones are left out. */
export const orderedSlots = (slots) => slots.map((s, i) => ({ i, s })).filter((x) => x.s).sort((a, b) => b.s.saved - a.s.saved);

const encodeSlot = (s) => (s ? { ...encodeProgress(createBuildFrom(s.perm, s.run && s.run.build), s.run && { level: s.run.level, room: s.run.room, build: s.run.build }, s.unlocked), saved: s.saved } : null);
function createBuildFrom(perm, runBuild) { const b = { ...(perm || {}) }; return b; }


function flush() {
  const blob = { v: SLOTS_VERSION, slots: cache.map(encodeSlot) };
  try {
    const h = host();
    if (h && typeof h.save === 'function') { Promise.resolve(h.save(blob)).catch(() => {}); return; }
    const st = ls();
    if (st) st.setItem(KEY, JSON.stringify(blob));
  } catch { /* losing a save is better than losing a run */ }
}

/** Read all four slots (empty array of nulls for a new player or on any failure). */
export async function loadSlots() {
  try {
    const h = host();
    let raw;
    if (h) raw = await Promise.race([h.load(), new Promise((_, rej) => setTimeout(() => rej(new Error('load timed out')), LOAD_TIMEOUT_MS))]);
    else { const st = ls(); raw = st ? st.getItem(KEY) : null; }
    cache = decodeSlots(raw);
  } catch { cache = Array(SLOT_COUNT).fill(null); }
  return cache.slice();
}

/** The slots as last read or written (no storage round trip). */
export const slotsNow = () => cache.slice();
export const getActiveSlot = () => active;
export const setActiveSlot = (i) => { active = Math.max(0, Math.min(SLOT_COUNT - 1, i | 0)); };
/** Empty a slot (the delete option). */
export function deleteSlot(i) { cache[i] = null; flush(); }
/** A brand new character in slot `i`. */
export function newSlot(i) { cache[i] = { perm: {}, run: null, unlocked: 1, saved: Date.now() }; active = i; flush(); }

/**
 * Store the ACTIVE slot: its permanent skills (the build's), the level reached, and the run in progress (the room last
 * started with the weapons held) or null. Stamps the time. Fire and forget: a failed save never blocks a run.
 */
export function saveProgress(build, run = null, unlocked = 1) {
  const blob = encodeProgress(build, run, unlocked);
  cache[active] = { perm: decodeProgress(blob), run: decodeRun(blob), unlocked: decodeUnlocked(blob), saved: Date.now() };
  flush();
}
