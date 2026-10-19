// WHO IS IN SEAT 1. Names and colours for the end screen, nothing else.
//
// The pods already look different on the field -- POD.seatTints gives seat 1 a
// gold hull and an orange thruster -- and that is enough DURING a run, where a
// child only has to recognise which shape is theirs. It is not enough at the
// END of one: "PLAYER 2 popped 31" is a worse sentence than "Noa popped 31",
// and on a device two siblings share, the names are the whole point of the
// result screen.
//
// WHERE THE NAMES COME FROM. The host's SDK holds a roster the app built when
// the boards paired -- one entry per connected player, index aligned with
// `window.__gbPlayers`, which is the same alignment the input reader uses. It
// is read as `GoBalance.players`, AN ARRAY, or through `GoBalance.getPlayers()`
// which returns the same array; see `liveRoster` below for why reading it as a
// function instead meant no name ever arrived. There is no other source: the
// page cannot reach the app's profile store, and copying names into the save
// blob would go stale the first time somebody is renamed in the lobby.
//
// THE INDEX IS POSITIONAL AND IT SHIFTS. If a board drops mid-run the roster
// republishes and everyone after the gap moves up a slot, so a name captured at
// the end of a run can belong to a different child than the one who played that
// seat. There is no stable per-seat id on the platform today -- it is item 6 of
// BAL-597, where the proposal is to expose `SelectedProfile.Upid`. Until that
// lands this file is a BEST EFFORT and is only ever used for decoration: no
// score is attributed by it, and nothing is stored under it.
//
// EVERYTHING IS FEATURE-DETECTED, as everywhere else: at a plain dev URL there
// is no SDK, there is no roster to read, and every seat falls back to its
// number and its pod's own tint. That path is the one most screenshots are
// taken on, so it has to look finished rather than broken.

import { POD } from '../data/tuning.js';

/** Last roster the host gave us, or null before it has answered. */
let cached = null;
/** One request in flight at a time, and never more than one per interval. */
let inFlight = false;
let lastAskT = -1e9;
const RETRY_S = 1.5;

function sdk() {
  return typeof window !== 'undefined' && window.GoBalance ? window.GoBalance : null;
}

/** `#rrggbb` from whatever the app sent, or null. Accepts a number or a string. */
function toCss(c) {
  if (typeof c === 'number' && isFinite(c)) return '#' + (c >>> 0 & 0xffffff).toString(16).padStart(6, '0');
  if (typeof c === 'string') {
    const t = c.trim();
    if (/^#[0-9a-f]{6}$/i.test(t)) return t;
    if (/^[0-9a-f]{6}$/i.test(t)) return '#' + t;
  }
  return null;
}

/**
 * Normalise one roster entry.
 *
 * The field names are read defensively because this is the ONE shape in the
 * whole bridge that our own GOBALANCE_SDK.md does not document -- it describes
 * the single sensor global and does not mention the roster at all. The shape
 * below is what WebGameBridge.cs sends; accepting the obvious aliases costs
 * nothing and means a rename in the app degrades to "PLAYER 2" rather than to
 * `undefined`.
 */
function normalise(e, i) {
  if (!e || typeof e !== 'object') return { index: i, name: '', color: null };
  const idx = [e.index, e.playerIndex, e.slot].find((v) => typeof v === 'number' && isFinite(v));
  return {
    index: idx == null ? i : idx,
    name: String(e.name ?? e.playerName ?? e.displayName ?? '').trim(),
    color: toCss(e.color ?? e.colour ?? e.tint),
    isMain: !!(e.isMain ?? e.main ?? (idx ?? i) === 0),
  };
}

/**
 * The roster the APP'S OWN SDK is already holding, or null if it has none yet.
 *
 * `GoBalance.players` IS AN ARRAY. This file was written against the shape in
 * systems/gbSdk.js -- `players: () => send('players.get')`, a function -- and
 * that shim only ever installs itself when `window.GoBalance` is ABSENT, which
 * inside the app it never is: WebGameController injects the host's own SDK as
 * the first script in <head>. There, `players` is an array of
 * `{index, name, color, isMain, x, y}`, `getPlayers()` returns that same array
 * with the tilts refreshed, and there is no `players()` function at all. So the
 * `typeof gb.players !== 'function'` check below sent every single call
 * straight back with null -- on every device, on every build, since this file
 * was written. The roster was never once read, and both the name AND the colour
 * of every seat came from the fallbacks in `seatIdentity`. That is the "PLAYER 1 + PLAYER 2" on the 18 Oct screenshot --
 * nothing to do with the app, which had been sending the names since 15 Oct.
 *
 * Both shapes are read because both genuinely exist in this codebase: the
 * host's array in the app, gbSdk.js's function at a URL the host does not
 * serve.
 *
 * GATED ON `multiplayer`, which the host SDK sets only once it has a real
 * answer. Until then its `players` holds a one-seat placeholder --
 * `{index: 0, name: '', color: '#ffffff'}` -- and caching that would be worse
 * than having nothing: an empty name still falls back, but `#ffffff` is a
 * COLOUR, so seat 0's dot would go white and stop matching the pod it is there
 * to match.
 */
function liveRoster() {
  const gb = sdk();
  if (!gb || gb.multiplayer !== true) return null;
  try {
    const list = typeof gb.getPlayers === 'function' ? gb.getPlayers() : gb.players;
    return Array.isArray(list) && list.length ? list : null;
  } catch {
    return null;
  }
}

/**
 * Ask the host for the roster and remember it.
 *
 * Called once at boot and again when the seat count changes. Never throws and
 * never rejects: a roster we could not read means unnamed seats, which is
 * exactly the dev-URL case and is already handled.
 */
export function refreshRoster() {
  const live = liveRoster();
  if (live) {
    cached = live.filter(Boolean).map(normalise);
    return Promise.resolve(cached);
  }
  const gb = sdk();
  if (!gb || typeof gb.players !== 'function') return Promise.resolve(null);
  if (inFlight) return Promise.resolve(cached);
  inFlight = true;
  return Promise.resolve()
    .then(() => gb.players())
    .then((res) => {
      const list = Array.isArray(res) ? res : (res && (res.players || res.entries)) || [];
      const next = list.filter(Boolean).map(normalise);
      // AN EMPTY ANSWER IS NOT AN ANSWER. The roster can be requested in the
      // window between the boards pairing and the app building the list, and
      // overwriting good names with nothing would be worse than waiting.
      if (next.length) cached = next;
      return cached;
    })
    .catch(() => null)
    .finally(() => { inFlight = false; });
}

/**
 * Ask again, but only if the roster does not yet cover every seat, and only
 * every RETRY_S.
 *
 * WHY THIS IS A POLL. `__gbPlayers` and the roster are published by two
 * different paths, and the tilt array is the faster of the two -- a run can be
 * two pods on screen a frame before the app can say who is in them. A single
 * fetch at the moment the seat count changed therefore comes back short about
 * as often as not, and there is no event to wait on. Called every frame; does
 * nothing on nearly all of them.
 *
 * WHY IT IS SAFE TO STOP once every seat has a name, even a generic one: the
 * profile is chosen when a board connects in the pairing flow, which is before
 * the game launches. There is no path today on which a seat gains a profile
 * mid-run, so a name cannot improve after we stop asking (confirmed with the
 * app side, 15 Oct). If that ever changes, keep re-asking while any name is
 * still a generic label -- `isGenericLabel` below already identifies them.
 */
export function ensureRoster(seats, timeS) {
  if (seats < 2) return;
  if (cached && cached.length >= seats && cached.every((e) => e.name)) return;
  if (timeS - lastAskT < RETRY_S) return;
  lastAskT = timeS;
  refreshRoster();
}

/**
 * Is this a generic seat label rather than somebody's name?
 *
 * Matters because of the BADGE, not the row. Two seats labelled "Player 1" and
 * "Player 2" have the same initial -- two identical P badges side by side,
 * which is the one thing the badge exists to prevent. That was already handled
 * for OUR fallback by using the seat number, but the app now sends the seat
 * label as its own fallback when a seat has no profile picked (BAL-605, device
 * report 15 Oct), so the collision can arrive from the other side too and the
 * test for it has to be on the string, not on where it came from.
 *
 * Deliberately narrow: only "player" followed by digits, any case or spacing.
 * A child actually called "Player" keeps their P.
 */
function isGenericLabel(name) {
  return /^player\s*\d+$/i.test(String(name).trim());
}

/**
 * Display identity for a seat: a name, a colour and an initial.
 *
 * The colour falls back to THE POD'S OWN TINT, not to a leaderboard colour.
 * The whole job of this line on the result screen is to let a child match a row
 * to the ship they were flying ten seconds ago, so seat 1's row has to be the
 * same gold their pod was. Seat 0 has no tint (it is the original single-player
 * pod and must stay pixel-identical), so it takes the hull colour explicitly.
 */
export function seatIdentity(slot) {
  const entry = cached && cached.find((e) => e.index === slot);
  const name = (entry && entry.name) || `PLAYER ${slot + 1}`;
  const tint = POD.seatTints[slot % POD.seatTints.length];
  const fallback = tint == null ? '#74d7ff' : '#' + (tint >>> 0).toString(16).padStart(6, '0');
  return {
    name,
    // The app's own colour wins when there is one: it is what the lobby showed.
    color: (entry && entry.color) || fallback,
    // THE SEAT NUMBER WHENEVER THE NAME IS A GENERIC LABEL, not the first
    // letter. "PLAYER 1" and "PLAYER 2" share an initial -- two identical P
    // badges side by side, which is precisely the thing the badge is there to
    // prevent. Caught in a screenshot, not in review. The label can now come
    // from either side (ours when the roster is silent, the app's when a seat
    // has no profile), so the check is on the string itself.
    initial: entry && entry.name && !isGenericLabel(entry.name)
      ? name.charAt(0).toUpperCase()
      : String(slot + 1),
    named: !!(entry && entry.name),
  };
}

/**
 * The HULL AND THRUSTER a seat's pod should be painted, or null to keep the
 * one in POD.seatTints.
 *
 * THE LOBBY ALREADY ASSIGNED THESE AND THE CHILD HAS ALREADY SEEN THEM. Every
 * seat gets a colour when the boards pair -- red, teal, purple, orange, in
 * that order -- and it is on screen during pairing, next to the name, before
 * the game launches. A pod painted anything else is asking a seven-year-old to
 * hold two different answers to "which one is me": the one the app told them
 * and the one the game drew.
 *
 * So the lobby wins when there is a lobby. There is no lobby in single player
 * -- `liveRoster` returns nothing when `multiplayer` is false -- so seat 0 on a
 * one-player run keeps the hull it has always had and that screen is untouched.
 *
 * THE THRUSTER IS DERIVED, not looked up. The three authored pairs in
 * POD.seatThrusters are each the hull darkened by roughly a seventh, and the
 * lobby can hand us any colour it likes, so the relationship has to be a rule
 * rather than a fourth row in a table.
 */
export function seatTint(slot) {
  const entry = cached && cached.find((e) => e.index === slot);
  const hex = entry && entry.color;
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const hull = parseInt(hex.slice(1), 16);
  const ch = (shift) => Math.round(((hull >> shift) & 0xff) * 0.85);
  return { hull, flame: (ch(16) << 16) | (ch(8) << 8) | ch(0) };
}

/** Testing and the dev hooks only. */
export function __setRoster(list) {
  cached = list ? list.map(normalise) : null;
  lastAskT = -1e9;
  inFlight = false;
}
