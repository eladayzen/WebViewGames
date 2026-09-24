// THE MISSING HALF OF THE HOST BRIDGE.
//
// The app can already answer everything this game asks -- who is playing, what
// did I save, submit a score -- and has been able to for a long time. Nothing
// ever asked. There are two halves to that conversation and only one of them
// was ever written.
//
// WHAT WAS ACTUALLY WRONG. systems/gbProfile.js reads `window.GoBalance` and
// falls back to localStorage when it is absent. It is ALWAYS absent: nothing in
// this game defined it, nothing in the app injects it, and a check of the five
// shipped web builds found zero messages in the host's `gb2:` protocol -- the
// save/score/profile layer on the Unity side has never been called by anything.
// So every profile on a shared board has been reading and writing one
// device-wide bucket, which is exactly the "different children see the same
// progress" report, and the reason it would not reproduce: it is not a leak
// that sometimes happens, it is the only path there has ever been.
//
// This file is the translator. It changes nothing about either side -- the app
// keeps its protocol, the game keeps calling GoBalance.save() -- it just makes
// the two meet.
//
// THE PROTOCOL, from the app's WebGameBridge:
//
//   JS  -> Unity   window.Unity.call("gb2:<id>:<method>:<payload>")
//                  `id` is ours to allocate; 0 means fire-and-forget and the
//                  app will not reply. The payload is everything after the
//                  third colon and MAY CONTAIN COLONS -- a save blob routinely
//                  does -- so the app splits by index, and so must we.
//
//   Unity -> JS    window.__gb._resolve(<id>, <ok>, <json as a STRING>)
//                  The third argument is a string to be JSON.parsed, not an
//                  object literal. That is the app's choice and a good one: one
//                  escaping rule to get right instead of an injection surface
//                  fed by whatever a game chose to save.
//
// Neither direction can return a value, so every question is a request now and
// an answer later, matched by id. That is all the machinery below is.

/** The app's prefix. Anything not starting with this is treated as a log line. */
const PREFIX = 'gb2:';

/**
 * How long to wait for an answer before giving up on it, in ms.
 *
 * Not optional. `save.load` is awaited at boot BEFORE the mission list renders,
 * so a request the app never answers -- a bridge that failed to attach, an
 * EvaluateJS that silently did nothing -- would leave the player looking at a
 * dead screen rather than at their ladder.
 *
 * Five seconds is long enough for a cold Firestore read on a poor connection
 * and short enough that a genuine failure still lands as "your progress did not
 * load" rather than as a hang. A timeout REJECTS, which sends gbProfile down
 * its local fallback rather than handing it an empty save and wiping a ladder.
 */
const REPLY_TIMEOUT_MS = 5000;

let nextId = 1;
/** id -> {resolve, reject, timer}, for replies still in flight. */
const pending = new Map();

const host = () => (typeof window !== 'undefined' ? window.Unity : null);

/**
 * Send one request.
 *
 * @param {string} method one of the app's method names
 * @param {string} [payload] everything after the third colon
 * @param {boolean} [wantsReply] false for fire-and-forget (id 0)
 */
function send(method, payload, wantsReply) {
  const unity = host();
  if (!unity || typeof unity.call !== 'function') {
    return Promise.reject(new Error('no host'));
  }
  if (!wantsReply) {
    try { unity.call(PREFIX + '0:' + method + ':' + (payload == null ? '' : payload)); } catch { /* nothing to do */ }
    return Promise.resolve(null);
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('timed out: ' + method));
    }, REPLY_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    try {
      unity.call(PREFIX + id + ':' + method + ':' + (payload == null ? '' : payload));
    } catch (e) {
      clearTimeout(timer);
      pending.delete(id);
      reject(e);
    }
  });
}

/**
 * Pack an analytics event into the app's payload shape: `name|key=value|...`
 *
 * NOT JSON, because the app has no JSON parser on its side -- everything the
 * bridge reads is an int, a float, or an opaque blob it never looks inside. A
 * delimited line is two Splits there instead of a parser fed by the least
 * trusted place in the system.
 *
 * `|` and `=` are STRIPPED from values rather than escaped. Escaping would mean
 * agreeing an unescaping rule on both sides and getting it right in two
 * languages; stripping cannot desync. It costs nothing here because every value
 * this sends is an id from our own content files or a number we computed --
 * never anything a player typed.
 */
function encodeEvent(name, params) {
  let out = String(name);
  if (!params) return out;
  for (const key of Object.keys(params)) {
    const v = params[key];
    if (v == null) continue;
    out += '|' + key + '=' + String(v).replace(/[|=]/g, '');
  }
  return out;
}

/** Parse a reply body. The app sends a STRING containing JSON, or an empty one
 *  when there is genuinely nothing (a profile that has never saved). */
function parseBody(json) {
  if (json == null || json === '') return null;
  if (typeof json !== 'string') return json;
  try { return JSON.parse(json); } catch { return null; }
}

/**
 * Install the SDK.
 *
 * ONLY INSIDE THE WEBVIEW. At a plain dev URL there is no window.Unity, and
 * installing a GoBalance whose every call rejects would be worse than leaving
 * it undefined: gbProfile would stop using localStorage and the game would
 * forget everything between reloads on the machine it is developed on. Absent
 * is the correct state outside the app, and the existing fallbacks already
 * handle it.
 */
export function installGbSdk() {
  if (typeof window === 'undefined') return false;
  if (!host()) return false;

  /**
   * THE APP SHIPS ITS OWN SDK, and this file was written believing it did not.
   *
   * WebGameController serves Resources/GoBalanceWebSdk.txt at
   * /__gobalance/sdk.js and injects the tag as the FIRST script in <head>, so
   * `window.GoBalance` exists before any of the game's code runs. It is not in
   * any shipped index.html because the host rewrites the HTML as it serves it
   * -- which is exactly why looking at the built games found no trace of it and
   * the wrong conclusion got drawn.
   *
   * Its api has sixteen methods -- load, save, submitScore, getScoreboard,
   * getProfile, getPlayers, back, setSensitivity, log, on, off and the rest --
   * and NOT ONE of them is analytics. So the old `return true` here was worse
   * than doing nothing: it saw the host object, declared victory and left
   * systems/analytics.js feature-checking for a `logEvent` that was never
   * going to appear. Every event in the game was a silent no-op, which is
   * precisely what a run in the Editor showed -- the bridge received the HUD
   * diagnostic and not one `analytics.log`.
   *
   * So when the host's SDK is there, ADD THE ONE METHOD IT LACKS and touch
   * nothing else. Not a merge, not a replacement: the host owns save, score,
   * profile and the roster, and its `__gb` is wired to its own pending map --
   * clobbering either would break the things that do work.
   */
  if (window.GoBalance) {
    if (typeof window.GoBalance.logEvent !== 'function') {
      /**
       * Deliberately NOT routed through send() above. That allocates an id and
       * parks a promise in a pending map that the HOST's `__gb._resolve` knows
       * nothing about, so every reply would time out into a rejection five
       * seconds later. An analytics event wants no reply at all, and id 0 is
       * the protocol's own way of saying so -- one call, nothing to clean up,
       * and no chance of colliding with an id the host has issued.
       */
      window.GoBalance.logEvent = (name, params) => {
        try {
          host().call(PREFIX + '0:analytics.log:' + encodeEvent(name, params));
        } catch { /* telemetry must never break a run */ }
        return Promise.resolve(null);
      };
    }
    return true;
  }

  /** The app calls into this. Every entry must tolerate being called at any
   *  time, including before the game is ready for it. */
  window.__gb = {
    _resolve(id, ok, json) {
      const entry = pending.get(id);
      if (!entry) return;                    // already timed out, or not ours
      pending.delete(id);
      clearTimeout(entry.timer);
      if (ok) entry.resolve(parseBody(json));
      else entry.reject(new Error('host reported failure'));
    },
    /** Multiplayer roster. Unused here -- a no-op so the app's call cannot
     *  throw inside its own EvaluateJS and take the bridge down with it. */
    _roster() {},
    /** Host-driven animation pump. Same reasoning. */
    _tickAnimations() {},
  };

  window.GoBalance = {
    /** The whole progress blob, or null for a profile that has never saved. */
    load: () => send('save.load', '', true),
    /** Fire-and-forget: the app answers, but nothing here waits on it, and a
     *  failed save must never block a run from ending. */
    save: (blob) => send('save.set', JSON.stringify(blob), true),
    submitScore: (value) => send('score.submit', String(Math.round(value)), true),
    getScoreboard: () => send('score.board', '', true),
    profile: () => send('profile.get', '', true),
    players: () => send('players.get', '', true),
    /**
     * One analytics event. FIRE AND FORGET, on purpose: nothing in the game
     * waits on it, a failed event must never delay a run ending, and an id of 0
     * tells the app not to reply at all -- which also keeps the pending map
     * empty for the one call made most often.
     *
     * systems/analytics.js feature-checks for exactly this function, which is
     * what kept that work dormant while the app had no method to call.
     */
    logEvent: (name, params) => send('analytics.log', encodeEvent(name, params), false),
  };

  /**
   * TELL THE APP WE EXIST. It latches its per-frame publishes against "nothing
   * changed", and the first publish runs on the frame the WebView is created --
   * long before this page loaded. Without this the latch never drops and the
   * roster is never re-sent.
   */
  send('ready', '', false);
  return true;
}
