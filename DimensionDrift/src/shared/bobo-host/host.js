/**
 * bobo-host — the only thing in a BoBo web game that knows what a host is.
 *
 * Implements BRIDGE.md §2 (versioning), §3 (transport), §4 (message
 * catalogue), §6 (persistence) and §7 (orientation/locale/haptics). §5, the
 * tilt pipeline itself, lives in `tilt.js` and is wired in by `index.js`.
 *
 * TWO RULES, from BRIDGE.md §1, and everything here is downstream of them:
 *   1. the game never knows which host it is in — no `if (flutter)` above this
 *      file;
 *   2. anything that affects how the game FEELS lives in the game — so the
 *      pipeline is owned here, per slot, and the host sends raw gravity.
 *
 * WHY THERE IS NO `import './tilt.js'` IN THIS FILE. The pipeline is injected,
 * by `index.js` at import time or per instance via `opts.pipeline`. A static
 * import would make this module untestable without the pipeline present and
 * would make swapping the pipeline for an A/B a source edit. `index.js` is the
 * composition root; this file is zero-dependency.
 */

/** Flutter's JavaScript handler name. CONSTANT, not the per-game `WEND`/`SW`
 *  of `WebGameSpec.bridge` — a host that has to know a game's name in order to
 *  receive from it cannot host a game it has never heard of. */
const HANDLER = 'bobo';

const GAME_API = 1;
const REQUIRES_HOST_API = 1;

/** How long the host has to go quiet before the keyboard takes slot 0 back.
 *  Deliberately LONGER than the pipeline's own staleness window: a one-packet
 *  gap mid-run must not hand a live player's marble to a stray arrow key. What
 *  "stale" means is not restated here — `stale()` asks the pipeline, which owns
 *  that threshold (BRIDGE.md §4.1, ~700ms). */
const DEV_TAKEOVER_MS = 900;

const D2R = Math.PI / 180;

/** What an unknown or refused slot reads as. Frozen because it is shared by
 *  every such slot, and a game that wrote into a neutral it thought was its own
 *  would move everyone else's. */
const ZERO = Object.freeze({ x: 0, y: 0 });

/** ── THE WEB GAMES' PIPELINE SETTINGS ────────────────────────────────────────
 *
 *  `gamma` is the one number here that is a PRODUCT decision rather than a port
 *  of the SDK, and this is deliberately the only place it is written down. The
 *  port itself (`tilt.js`) defaults it to 1, the identity, so the Flutter-native
 *  games and the golden fixture's original runs are untouched; the five web
 *  games opt in together, here, because "sensor movement is too sensitive"
 *  was said about all of them at once and five separately-tuned answers to one
 *  complaint is how the input pipeline got forked the last time.
 *
 *  WHY 1.4 AND NOT A LOWER `maxAngleDeg`. Both calm the control. Only gamma
 *  leaves the ends alone: at 1.4 a half-gamut lean reports 0.38 instead of 0.50
 *  (a quarter softer where the twitch actually is) while full deflection is
 *  still reached at the same 19 degrees. Raising maxAngleDeg to 26 to get the
 *  same middle would move full deflection out with it, and on a balance board
 *  REACH is the binding constraint — the player who most needs the calmer
 *  middle is the same player who cannot afford to lose the edges.
 *
 *  WHAT IT COSTS. Every ratio-space THRESHOLD in every game is now quoted in a
 *  bent space. See `shapeThreshold` below; a game with a commit threshold that
 *  does not call it has silently made that action harder. */
/** ── WHY 12 AND NOT 19 ──────────────────────────────────────────────────────
 *  19 is GoBalance's DEVICE DEFAULT -- where a fresh device starts, not a
 *  ceiling; the band it accepts is 5-45. It was copied here to match their SDK
 *  and it is wrong for this hardware, measured on the board: "in all types of
 *  boards I reach physically to the end of my possible tilt and I'm only
 *  halfway my curving ability". Half of 19 is about 9.5, which is the whole
 *  reachable gamut on an inflated cushion, so nearly half of every game's
 *  steering range could not be asked for at all.
 *
 *  The app moved to 12 when that was found. THIS DID NOT, and the gap was
 *  invisible because in the app the host pushes its own `maxAngleDeg` down and
 *  overwrites this -- so the stale default only showed up where nothing pushes
 *  one, which is every browser, every QA harness, and GoBalance. The number a
 *  game divides by when nobody tells it otherwise now matches the number the
 *  app would have told it. */
export const DEFAULT_TILT = Object.freeze(
  { maxAngleDeg: 12, deadZone: 0.04, gamma: 1.4, emaTauSec: 0.33, xSign: 1, ySign: -1 });

/** `music` and `sfx` are LEVELS in 0..1, not switches.
 *
 *  They were booleans until bobo_play's host was written against them and the
 *  loss showed up: that app stores two channel volumes and no master, so a user
 *  who had set music to 0.3 heard it at full level inside a game, silently. A
 *  level carries a switch (0 and 1) but a switch cannot carry a level.
 *  `normSettings` still accepts booleans, so a host that only has mute state
 *  needs no special case. */
const DEFAULT_SETTINGS = { music: 1, sfx: 1, master: 1, haptics: true, maxAngleDeg: 12 };

/** Coerce a host's settings into the documented shape. Booleans are accepted for
 *  the two channel levels because plenty of hosts only have a mute button. */
function normSettings(raw) {
  const lvl = (v, dflt) => {
    if (v === true) return 1;
    if (v === false) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : dflt;
  };
  const out = {};
  if ('music' in raw) out.music = lvl(raw.music, 1);
  if ('sfx' in raw) out.sfx = lvl(raw.sfx, 1);
  if ('master' in raw) out.master = lvl(raw.master, 1);
  if ('haptics' in raw) out.haptics = !!raw.haptics;
  if ('maxAngleDeg' in raw) {
    const n = Number(raw.maxAngleDeg);
    if (Number.isFinite(n) && n > 0) out.maxAngleDeg = n;
  }
  return out;
}

/** What a game may assume with no host at all: `serve.mjs` and the drive/QA
 *  harnesses are not a degraded host, they are the dev path, and a QA capture
 *  of a game with half its UI hidden is a capture of a different game. */
const BROWSER_CAPABILITIES = ['haptics', 'persist', 'recenter', 'multiplayer'];

/** What GoBalance actually offers THROUGH THIS ADAPTER: nothing on this list.
 *  An empty list rather than a trimmed one, so `can(cap)` answers honestly and
 *  a game hides what the platform cannot do instead of offering dead buttons.
 *
 *  THIS IS NOW A STATEMENT ABOUT THE ADAPTER, NOT THE PLATFORM, and the
 *  difference matters. The app gained per-player tilt
 *  (`window.__gbPlayers = [[x,y], ...]`, up to four boards, with a roster) and
 *  a persistence/score method set; `_pumpGb` below still reads only the
 *  single-board `__gbSensor` and fills slot 0. So the honest reading of this
 *  empty list is "not wired up yet", not "impossible" -- and `multiplayer`
 *  belongs on it the day `_pumpGb` walks the per-player array, NOT before,
 *  because a capability claimed while the slots stay empty is the worse lie.
 *  See GOBALANCE_Bobo_DoubleFlow.md §5, corrected 2026-10-12. */
const GOBALANCE_CAPABILITIES = [];

const INBOUND = new Set([
  'hello', 'roster', 'input', 'sensor', 'settings', 'recenter', 'state', 'pause', 'resume', 'back',
]);

let makePipeline = null;

/** Called once by `index.js`. Kept separate so a lab harness can drive the
 *  whole protocol against a recorded pipeline without touching a game. */
export function usePipeline(factory) {
  makePipeline = factory;
}

// ── inbound entry point ──────────────────────────────────────────────────────
//
// Installed at MODULE LOAD, not at construction. BRIDGE.md §3 tells hosts to
// guard on `window.bobo` existing because messages can be attempted before the
// bundle has parsed — but the window between the bundle parsing and the game
// constructing its BoboHost is real too, and `hello` is explicitly sent "as
// early as possible". Anything that lands in that window is buffered here and
// drained by the constructor.

let active = null;
const preboot = [];

function preRecv(msg) {
  if (active) { active._recv(msg); return; }
  // `input` is deliberately NOT buffered. Draining a queue of samples into the
  // pipeline later would replay a burst of old timestamps into a
  // rate-independent EMA — exactly the backlog `web_game_screen.dart`'s push
  // throttle exists to prevent, arriving all at once instead of over time.
  const t = typeof msg === 'string' ? null : msg?.type;
  if (t === 'input') return;
  if (preboot.length < 32) preboot.push(msg);
}

if (typeof globalThis === 'object') {
  globalThis.bobo = globalThis.bobo || {};
  globalThis.bobo.recv = preRecv;
}

// ── the shim ─────────────────────────────────────────────────────────────────

export class BoboHost {
  constructor(opts = {}) {
    this.id = opts.id ?? 'unknown';
    this.version = opts.version ?? '0';
    this.gameApi = opts.gameApi ?? GAME_API;
    this.requiresHostApi = opts.requiresHostApi ?? REQUIRES_HOST_API;
    this.players = opts.players ?? { min: 1, max: 1 };
    this.needs = opts.needs ?? ['tilt'];
    this.orientation = opts.orientation ?? 'landscape';

    this.tilt = { ...DEFAULT_TILT, ...(opts.tilt || {}) };
    this.settings = { ...DEFAULT_SETTINGS, maxAngleDeg: this.tilt.maxAngleDeg };

    /** The `hello` payload, or null until one arrives. */
    this.hello = null;
    /** False once the version compare has failed. §2: a refusal, never a
     *  degraded boot. */
    this.ok = true;
    this.readySent = false;
    this.roster = [];

    this._win = opts.window ?? (typeof globalThis === 'object' ? globalThis : {});
    this._pipeline = opts.pipeline ?? null;
    this._caps = new Set();
    this._slots = new Map();
    this._handlers = new Map();
    this._queue = [];
    this._tx = null;
    this._exited = false;
    this._liveAt = -1e9;
    this._injectAt = -1e9;
    this._devAt = 0;
    this._gbAt = 0;
    this._dev = opts.dev === false ? null : makeDevInput(this._win, opts.devCanvas);

    for (const [type, fn] of Object.entries(opts.on || {})) this.on(type, fn);

    active = this;
    this._win.bobo = this._win.bobo || {};
    this._win.bobo.recv = (msg) => this._recv(msg);

    while (preboot.length) this._recv(preboot.shift());
  }

  // ── transport, §3 ──────────────────────────────────────────────────────────

  /** Detected LAZILY and re-probed until a real host answers: `flutter_
   *  inappwebview` and a Unity-injected `unityBridge` are both installed by the
   *  host, and neither is guaranteed to exist at the moment this bundle parses.
   *  A one-shot check at module load would pin every game to the browser
   *  adapter on a slow WebView and post its results into a console. */
  _adapter() {
    if (this._tx) return this._tx;
    const w = this._win;
    const f = w.flutter_inappwebview;
    if (f && typeof f.callHandler === 'function') {
      return (this._tx = { name: 'flutter', send: (m) => f.callHandler(HANDLER, m) });
    }
    const u = w.unityBridge;
    if (u && typeof u.send === 'function') {
      return (this._tx = { name: 'unity', send: (m) => u.send(JSON.stringify(m)) });
    }
    // ── GOBALANCE ─────────────────────────────────────────────────────────
    // THE OTHER Unity. `unityBridge.send(json)` above is bobo_pro_2, which
    // speaks the full BRIDGE.md protocol; `Unity.call(string)` is the GoBalance
    // SDK's gree/unity-webview bridge, which understands exactly two strings
    // ('nav:back', 'gb:sensitivity:<n>') and LOGS everything else. The two
    // words look alike and mean different apps -- checked after unityBridge so
    // a host that someday injects both is read as the richer protocol.
    //
    // Everything that is not an exit is forwarded as a logged line anyway:
    // there is no devtools console on-device, so the host's log (adb logcat)
    // is the only place a `ready` or an `error` can be seen at all. Nothing
    // this game sends is high-frequency on this platform.
    const gb = w.Unity;
    if (gb && typeof gb.call === 'function') {
      return (this._tx = { name: 'gobalance', send: (m) => {
        if (m.type === 'exit') return gb.call('nav:back');
        if (m.type === 'error') return gb.call('JS ERROR (game): ' + m.message);
        gb.call('bobo:' + JSON.stringify(m));
      } });
    }
    // Not cached — see above.
    return { name: 'browser', send: (m) => console.debug('[bobo]', m) };
  }

  get transport() { return this._adapter().name; }

  send(msg) {
    if (!msg || typeof msg.type !== 'string') return;
    try { this._adapter().send(msg); } catch (e) { console.debug('[bobo] send failed', e); }
  }

  // ── inbound dispatch, §4.1 ─────────────────────────────────────────────────

  /** The game never switches on `type`; this does, once. */
  _recv(raw) {
    let msg = raw;
    if (typeof msg === 'string') {
      // Unity's SendMessage carries one string argument, so a host that echoes
      // the same shape back is sending JSON rather than an object.
      try { msg = JSON.parse(msg); } catch { return; }
    }
    const type = msg && msg.type;
    if (typeof type !== 'string') return;
    // Refused on version (§2). Everything after that is dead traffic: a game
    // that kept building pipelines and feeding a run nobody can see is the
    // degraded boot the refusal exists to prevent, wearing a fatal error.
    if (!this.ok) return;
    if (!INBOUND.has(type)) {
      // §2: a new message a game may ignore does not bump the version, so an
      // unknown type is a newer host, not an error.
      console.debug('[bobo] ignoring unknown message', type);
      return;
    }
    switch (type) {
      case 'hello': this._onHello(msg); return;
      case 'input': this._onInput(msg); return;
      case 'settings': this._onSettings(msg); break;
      case 'recenter': this._onRecenter(msg); break;
      case 'sensor': this._onSensor(msg); break;
      case 'roster': this.roster = Array.isArray(msg.players) ? msg.players : []; break;
      default: break;
    }
    this._emit(type, msg);
  }

  _onHello(msg) {
    // A REPEATED, IDENTICAL hello is absorbed silently.
    //
    // §4.1 tells hosts to re-send when `ready` reports `helloSeen: false`, and a
    // host that cannot read an eval return value may also send speculatively to
    // narrow the race. Neither should reach the game twice. Without this, the
    // pre-boot buffer replays every queued copy at construction, so a game that
    // takes 700 ms to build its scene saw one `hello` handler call per attempt —
    // a regression on the path where the first one landed perfectly.
    //
    // Compared by value, not identity: the copies arrive as separate decoded
    // objects. A hello that genuinely DIFFERS still emits, because a host
    // changing its capabilities mid-session is information the game needs.
    const key = JSON.stringify(msg);
    if (this._helloKey === key) return;
    this._helloKey = key;

    this.hello = msg;
    this._caps = new Set(Array.isArray(msg.capabilities) ? msg.capabilities : []);
    const api = Number(msg.hostApi);
    if (!Number.isFinite(api) || api < this.requiresHostApi) {
      this._refuse(
        `${this.id} needs hostApi ${this.requiresHostApi}; ` +
        `${msg.host ?? 'this host'} offers ${msg.hostApi}. Refusing to start (BRIDGE.md §2).`,
      );
      return;
    }
    this._emit('hello', msg);
  }

  /** §2: silent degradation is banned. A game that boots to a black screen
   *  because the host never implements `recenter` costs more to diagnose than
   *  a refusal costs to read. */
  _refuse(message) {
    this.ok = false;
    this.send({ type: 'error', message, fatal: true });
    this._emit('refuse', { message }, true);
  }

  _onInput(msg) {
    const t = Number.isFinite(msg.t) ? msg.t : now();
    const rows = Array.isArray(msg.p) ? msg.p : [];
    for (const r of rows) {
      if (!Array.isArray(r) || r.length < 4) continue;
      const slot = r[0] | 0;
      const gx = +r[1], gy = +r[2], gz = +r[3];
      if (!Number.isFinite(gx) || !Number.isFinite(gy) || !Number.isFinite(gz)) continue;
      const s = this._slot(slot);
      s.pipe.push(gx, gy, gz, t);
      s.lastAt = now();
      s.live = true;
    }
    // §4.3: a slot missing from `p` for a tick is normal — a player who drops
    // keeps their slot and their absence is reported by `sensor`, not by
    // vanishing. Their pipeline simply is not stepped, so `input(slot)` holds
    // the last control vector rather than snapping to neutral.
    this._liveAt = now();
    this._pumpCalibration();
  }

  _onSettings(msg) {
    const next = normSettings(msg || {});
    Object.assign(this.settings, next);
    if (next.maxAngleDeg !== undefined) this.setMaxAngle(next.maxAngleDeg);
  }

  _onRecenter(msg) {
    const slot = Number.isFinite(msg?.slot) ? msg.slot | 0 : null;
    if (slot === null) {
      // §4.1: `{}` means every slot. On a single-player game no slot exists
      // until the first `input` arrives, and a calibrate pressed on the menu
      // before any packet has landed must still arm slot 0.
      const all = this._slots.size ? [...this._slots.keys()] : [0];
      for (const s of all) this.recenter(s);
    } else {
      this.recenter(slot);
    }
  }

  _onSensor(msg) {
    const slot = Number.isFinite(msg?.slot) ? msg.slot | 0 : 0;
    const s = this._slot(slot);
    s.state = msg.state ?? s.state;
    s.battery = msg.battery ?? s.battery;
  }

  // ── handlers ───────────────────────────────────────────────────────────────

  on(type, fn) {
    if (typeof fn === 'function') this._handlers.set(type, fn);
    return this;
  }

  _emit(type, payload, immediate = false) {
    const fn = this._handlers.get(type);
    if (!fn) return;
    // §3: nothing but `hello` should arrive before `ready`. Hosts do it anyway
    // — bobo_play pushes `config` the instant it sees `ready` and a slower
    // device can land it inside the game's own boot — and a game that has not
    // built its level list yet cannot act on `state`. Held, in order, and
    // delivered once the game says it can receive.
    if (!this.readySent && !immediate && type !== 'hello') {
      if (this._queue.length < 32) this._queue.push([fn, payload]);
      return;
    }
    try { fn(payload); } catch (e) { console.error('[bobo] handler threw for', type, e); }
  }

  // ── outbound, §4.2 ─────────────────────────────────────────────────────────

  /** Returns false if the version compare refused the boot; a game should show
   *  its own failure UI and not start its loop. */
  ready() {
    if (!this.ok) return false;
    if (this.readySent) return true;
    // No host and none coming: synthesise the hello so `can()` answers
    // honestly on the dev path instead of hiding every feature it cannot
    // confirm. A real host that injects late still wins — this only runs when
    // nothing has answered by the time the game is up.
    // Whether a real host's `hello` arrived BEFORE the game was up. Read before
    // the browser synthesis below, because a synthesised hello is not evidence
    // that a host sent one.
    //
    // bobo_play detects this from its own `evaluateJavascript` return value, but
    // that only works for a transport whose eval can return a value. Reporting
    // it in `ready` makes the check available to every host, including one whose
    // bridge is fire-and-forget. §4.1 requires a re-send when this is false.
    const helloSeen = !!this.hello;
    if (!this.hello && this._adapter().name === 'browser') {
      this._onHello({
        hostApi: this.requiresHostApi, host: 'browser', appId: 'browser',
        locale: 'en', dir: 'ltr', capabilities: BROWSER_CAPABILITIES,
      });
      if (!this.ok) return false;
    }
    // GoBalance speaks no protocol at all, so the hello is synthesized the way
    // the browser's is. THIS IS A DELIBERATE EXCEPTION to BRIDGE.md §2's rule
    // that a game whose hostApi is not met must refuse to start -- written
    // down here, as the doubleflow doc demands, so it reads as a decision and
    // not as a bug: on GoBalance there is no version to negotiate and nothing
    // to refuse toward, and a refusal screen would be the only thing the
    // player could ever see.
    if (!this.hello && this._adapter().name === 'gobalance') {
      this._onHello({
        hostApi: this.requiresHostApi, host: 'gobalance', appId: 'gobalance',
        locale: 'en', dir: 'ltr', capabilities: GOBALANCE_CAPABILITIES,
      });
      if (!this.ok) return false;
    }
    this.readySent = true;
    this.send({
      type: 'ready',
      gameApi: this.gameApi,
      id: this.id,
      version: this.version,
      players: this.players,
      needs: this.needs,
      orientation: this.orientation,
      helloSeen,
    });
    const q = this._queue.splice(0);
    for (const [fn, payload] of q) {
      try { fn(payload); } catch (e) { console.error('[bobo] queued handler threw', e); }
    }
    return true;
  }

  result(r) { this.send({ type: 'result', ...r }); }

  progress(p) { this.send({ type: 'progress', ...p }); }

  /** §6: the host owns scores; this is the game's OWN data — unlocked levels,
   *  per-game preferences — and it is opaque to the host. Sent even when the
   *  host omits 'persist' from capabilities: dropping it is the host's call,
   *  and a game that guessed wrong would lose data a host was willing to keep.
   *  Games hide UI that IMPLIES saving on `!can('persist')`; they do not stop
   *  saving. */
  saveState(data) { this.send({ type: 'state', data }); }

  calibrating(slot, progress) { this.send({ type: 'calibrating', slot, progress }); }

  haptic(kind = 'select', slot = 0) {
    if (!this._caps.has('haptics')) return;
    this.send({ type: 'haptic', slot, kind });
  }

  /** Once, ever. A held lean re-fires while nothing changes state, and one
   *  back-lean on a menu posted `exit` three times in `swoon`; Flutter popped
   *  three routes. */
  exit() {
    if (this._exited) return;
    this._exited = true;
    this.send({ type: 'exit' });
  }

  error(message, fatal = false) { this.send({ type: 'error', message, fatal }); }

  /**
   * Ask the platform to open its lean calibration.
   *
   * THE MEASUREMENT CANNOT LIVE IN A GAME. What it measures is the SDK's
   * `maxAngleDeg` -- the divisor every game's `control` ratio is already
   * expressed in -- so by the time a lean reaches a game the thing being
   * calibrated has been divided out. Only the platform sees raw degrees.
   *
   * The host PAUSES the run before it opens, and sends fresh settings after, so
   * a game needs no more than this one call and its existing pause handling.
   */
  calibrate() { this.send({ type: 'calibrate' }); }

  // ── input, §4.3 — GAMES POLL ───────────────────────────────────────────────

  /**
   * The current control vector for a slot, in the unit disc, screen-space
   * (y grows downward, so lean-forward is negative).
   *
   * Polled from the frame loop, never pushed. `web_game_screen.dart` is
   * explicitly last-write-wins for the same reason: a burst of BLE
   * notifications sharing one arrival millisecond must not become a burst of
   * work, and a dropped frame must not leave a backlog to catch up on.
   */
  input(slot = 0) {
    if (!this.ok) return ZERO;
    // Pump once per frame regardless of which slot asked: the pumps fill every
    // slot, and rate-limit themselves, so a two-player game polling slot 1
    // first must not leave slot 0 a frame stale.
    this._pumpGb(); this._pumpDev();
    const s = this._slots.get(slot);
    return s ? s.pipe.control : ZERO;
  }

  /** The pre-EMA, pre-dead-zone ratio, for a dial or a probe. Never for play. */
  raw(slot = 0) {
    const s = this._slots.get(slot);
    return s ? s.pipe.raw : ZERO;
  }

  /**
   * Convert a THRESHOLD quoted in pre-gamma ratio units to the value that fires
   * at the same physical lean angle under the shipped response curve.
   *
   * Every game constant that asks "has the lean passed this much?" goes through
   * here — dead zones, commit thresholds, hold triggers. Analogue channels do
   * NOT: the whole point of the curve is to soften those.
   *
   * It reads the pipeline's own gamma rather than a copy of 1.4, so a game
   * cannot end up normalising against a curve the pipeline is not applying.
   * Answered from DEFAULT_TILT when no slot exists yet, because a game reads its
   * thresholds at construction and the first sensor packet has not arrived.
   */
  shapeThreshold(r, slot = 0) {
    const pipe = this._slots.get(slot)?.pipe;
    if (pipe) return pipe.shapeThreshold(r);
    const g = this.tilt.gamma ?? 1;
    return g === 1 ? r : Math.pow(Math.min(1, Math.max(0, r)), g);
  }

  /** Connected but silent. Asked of the pipeline rather than timed again here:
   *  two copies of a threshold is the fault this project has paid for most
   *  often, and this one decides whether a game shows "sensor lost". Games draw
   *  their own state from it because the host's `sensor` message is the half
   *  that does not survive a host which never implemented it. */
  stale(slot = 0) {
    const s = this._slots.get(slot);
    return !!s && s.live && !s.pipe.streaming;
  }

  /** Has a real sensor ever driven this slot? Distinct from `stale()`, which
   *  only becomes meaningful AFTER a sensor has gone quiet — asking it before
   *  the first packet cannot tell "no sensor" apart from "sensor about to
   *  arrive".
   *
   *  carve is why this is public: its title screen prints "BoBo connected" or
   *  "using touch & keys", and deriving that from the host's `sensor` message
   *  leaves a host which never implements that message showing "using touch &
   *  keys" for a whole run while a sensor drives it. The shim already knows for
   *  certain — it sets the flag on the first `input` — so guessing was never
   *  necessary. */
  live(slot = 0) {
    return !!this._slots.get(slot)?.live;
  }

  sensor(slot = 0) {
    const s = this._slots.get(slot);
    return s ? { state: s.state, battery: s.battery } : { state: 'lost', battery: null };
  }

  /** Slots that have ever been seen, ascending. Single-player games ignore
   *  this and read slot 0. */
  get slots() { return [...this._slots.keys()].sort((a, b) => a - b); }

  player(slot = 0) { return this.roster.find((p) => p.slot === slot) ?? null; }

  can(cap) { return this._caps.has(cap); }

  get capabilities() { return [...this._caps]; }

  /** §5: `control` is a RATIO — lean angle over maxAngleDeg — so this rescales
   *  every threshold in the game. Applied to every slot, because a per-slot
   *  sensitivity would mean two players on one board playing two difficulties. */
  setMaxAngle(deg) {
    if (!Number.isFinite(deg) || deg <= 0) return;
    this.tilt.maxAngleDeg = +deg;
    this.settings.maxAngleDeg = +deg;
    for (const s of this._slots.values()) s.pipe.setMaxAngle(+deg);
    // ── GOBALANCE: THE DEVICE CLAMP MOVES WITH US, FOR THIS SESSION ────────
    // `__gbSensor` is already a ratio of the DEVICE's own max angle, clamped on
    // the native side -- so without this, the calibration wizard's widen-to-45
    // widens only our local divisor while the device keeps clipping at its own
    // setting, and the wizard measures the clamp instead of the player (the
    // same self-confirming trap reach.js documents for our local pipeline).
    //
    // THE SESSION VERB, DELIBERATELY. `setMaxAngle` on their side is
    // device-wide and surfaces in the user's settings screen; a game changing
    // that as a side effect of its own tuning is a product decision nobody has
    // made. Session scope gives both platforms the SAME semantics -- holds
    // until the game closes -- and keeps device-wide persistence an explicit
    // future step. Fire-and-forget: the promise's failure case (below the
    // device minimum) can only happen for values our own 6-30 gate would have
    // refused first.
    this._win.GoBalance?.setMaxAngleSession?.(+deg);
  }

  recenter(slot = 0) {
    const s = this._slot(slot);
    s.pipe.recenter();
    s.cal = true;
    s.calSent = -1;
    this.calibrating(slot, 0);
  }

  reset(slot = null) {
    const all = slot === null ? [...this._slots.keys()] : [slot];
    for (const k of all) this._slots.get(k)?.pipe.reset();
  }

  dispose() {
    this._dev?.detach();
    if (active === this) active = null;
    if (this._win.bobo?.recv && this._win.bobo.recv !== preRecv) this._win.bobo.recv = preRecv;
  }

  // ── slots ──────────────────────────────────────────────────────────────────

  /**
   * ONE PIPELINE PER SLOT, and this is the whole reason the input path is slot
   * addressed on a catalogue of single-player games. The pipeline is stateful —
   * EMA, neutral, adaptive gravity baseline — so a shared instance would give
   * player 2 player 1's neutral, and a recenter by either would move both.
   * Retrofitting the slot afterwards touches physics, camera, HUD and results
   * (BRIDGE.md §4.3).
   */
  _slot(n) {
    let s = this._slots.get(n);
    if (s) return s;
    const factory = this._pipeline ?? makePipeline;
    if (!factory) {
      throw new Error('bobo-host: no tilt pipeline. Import ./index.js, not ./host.js.');
    }
    s = {
      // One clock for both halves. The pipeline's default wall clock is
      // Date.now, which steps when the device's time is corrected; a
      // calibration window measured against a clock that just jumped closes
      // early or never.
      pipe: factory({ ...this.tilt, now }),
      lastAt: -1e9, live: false, state: 'lost', battery: null, cal: false, calSent: -1,
    };
    this._slots.set(n, s);
    return s;
  }

  /** §5.4: the game owns the neutral, so the game owns the countdown — the
   *  host gets `calibrating {slot, progress}` and may draw its own. Emitted in
   *  tenths rather than per sample: at 60Hz a per-sample report is 60
   *  platform-channel crossings for a progress bar. */
  _pumpCalibration() {
    for (const [slot, s] of this._slots) {
      if (!s.cal) continue;
      const p = Number(s.pipe.calibrationProgress ?? 1);
      if (p >= 1) { s.cal = false; this.calibrating(slot, 1); continue; }
      if (p - s.calSent >= 0.1) { s.calSent = p; this.calibrating(slot, p); }
    }
  }

  // ── the dev path ───────────────────────────────────────────────────────────

  /**
   * Keyboard and pointer driving slot 0 when no host is sending, so a game
   * stays playable under `serve.mjs` and the drive/QA harnesses.
   *
   * It synthesises a GRAVITY VECTOR and pushes it through the real pipeline
   * rather than writing a control vector straight in. wend's input header
   * makes the case: a keyboard path that skips the 0.33 s EMA lets the whole
   * game be tuned against a control no player has. Dead zone, radial clamp and
   * smoothing all apply here exactly as they do to a sensor.
   *
   * Driven from `input()` rather than a rAF loop of its own: a game that has
   * stopped polling is paused, and a paused game should not be accumulating
   * lean.
   */
  /**
   * GoBalance's board, polled the way games poll everything else.
   *
   * The SDK publishes `window.__gbSensor = {x, y}` at ~60 Hz -- already a RATIO,
   * `getClampedAngleAsRatio()` against the device's own max angle -- in BOTH of
   * its input modes, with no message and no event. It enters through
   * `_pushControl`, the same door the dev keyboard uses, so it gets the dead
   * zone, the radial gamma and the 0.33 s EMA every game is tuned against,
   * stacked on the device's clamp.
   *
   * It also marks the slot LIVE and stamps `_liveAt`, because this board is the
   * real player, not an injector: the dev keyboard must yield to it, `stale()`
   * must answer for it, and the calibration wizard's "is a real sensor driving"
   * check must say yes -- on this platform a full keyboard deflection standing
   * in for 18 degrees would be measuring a mock while an actual board streams.
   */
  /**
   * GoBalance's sensors, one slot each.
   *
   * `window.__gbPlayers = [[x,y], ...]` is published every frame by the app,
   * index-aligned with a roster, and index 0 is always the phone's own board.
   * It has been there for a while; this shim read only the single-board
   * `window.__gbSensor` and pushed slot 0, which is the entire reason carve
   * was single-player on a platform that supports four boards.
   *
   * `__gbSensor` REMAINS THE FALLBACK and is not going anywhere: an older app
   * build in the field publishes it and not the array, and a game that reads
   * only the array would lose its input entirely rather than degrade.
   */
  _pumpGb() {
    if (this._adapter().name !== 'gobalance') return;
    const t = now();
    if (t - this._gbAt < 4) return;
    // PREFER THE SDK'S OWN LIST, because it carries IDENTITY as well as tilt:
    // {index, name, color, isMain, x, y}. The raw `__gbPlayers` array has the
    // numbers and nothing to say who they belong to -- and a seat index is not
    // an identity. When a seat disconnects the app REMOVES it and the ones
    // after shift down, so a game holding "player two is index 1" silently
    // starts reading a different human. The roster is what a game can bind to.
    const sdk = this._win.GoBalance;
    let ident = null;
    if (typeof sdk?.getPlayers === 'function') {
      try { ident = sdk.getPlayers(); } catch { ident = null; }
    }
    if (Array.isArray(ident) && ident.length) {
      this.roster = ident.map((p, i) => ({
        slot: Number.isFinite(p?.index) ? p.index | 0 : i,
        name: p?.name ?? '', color: p?.color ?? '', isMain: !!p?.isMain,
      }));
    }
    const arr = Array.isArray(ident) && ident.length
      ? ident.map((p) => [p?.x, p?.y])
      : this._win.__gbPlayers;
    const pairs = Array.isArray(arr) && arr.length ? arr : null;
    if (pairs) {
      // Cap at what the game asked for: a four-board session feeding a
      // two-player game must not invent slots it cannot draw.
      const want = Math.max(1, this.players?.max ?? 1);
      let pushed = 0;
      for (let i = 0; i < pairs.length && i < want; i++) {
        const p = pairs[i];
        const x = Array.isArray(p) ? p[0] : p?.x;
        const y = Array.isArray(p) ? p[1] : p?.y;
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        this._pushControl(i, x, y, t);
        this._slot(i).live = true;
        pushed++;
      }
      if (pushed) { this._gbAt = t; this._liveAt = t; return; }
    }
    const g = this._win.__gbSensor;
    if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.y)) return;
    this._gbAt = t;
    this._liveAt = t;
    this._pushControl(0, g.x, g.y, t);
    this._slot(0).live = true;
  }

  _pumpDev() {
    if (!this._dev) return;
    // A REAL HOST NEVER LOSES ITS SLOT TO THE KEYBOARD.
    //
    // The timeout below is not enough on its own. bobo_play's host found the
    // hole: under the Flutter transport, a sensor that drops for DEV_TAKEOVER_MS
    // let this pump take slot 0 and push a ZERO lean — so a dropped sensor
    // centred the marble instead of holding the last vector, contradicting the
    // rule in §4.3 that a slot missing from a batch is held. A phone has no
    // keyboard anyway, so the dev path has nothing to offer a real host.
    if (this._adapter().name !== 'browser') return;
    const t = now();
    if (t - this._liveAt < DEV_TAKEOVER_MS) return; // a real host is driving
    // An INJECTOR is driving. wend found this: `pushControl` did not suppress
    // this pump, so a QA rig injecting a steady 0.8 lean had (0,0) pushed into
    // the same pipeline once a frame between its own pushes, and the EMA settled
    // near 0.4. The harness was measuring half the lean it thought it had asked
    // for. A separate stamp from `_liveAt` because that one gates `pushControl`
    // itself — reusing it would make an injector block its own next push.
    if (t - this._injectAt < DEV_TAKEOVER_MS) return;
    if (t - this._devAt < 4) return;
    this._devAt = t;
    // TWO PLAYERS ONLY WHEN THE GAME ASKED FOR THEM. Until a game declares
    // `players.max >= 2`, WASD stays an alias for slot 0 exactly as it always
    // was, and nothing written against it changes behaviour.
    const split = (this.players?.max ?? 1) >= 2;
    const v = this._dev.sample(0, split);
    this._pushControl(0, v.x, v.y, t);
    if (!split) return;
    // Slot 1 appears when a human first presses one of its keys, not at boot:
    // a slot that exists and reads a motionless zero is indistinguishable from
    // a player standing perfectly still, and the game would start a two-player
    // race against nobody.
    if (!this._dev.touched(1)) return;
    const v2 = this._dev.sample(1, true);
    this._pushControl(1, v2.x, v2.y, t);
  }

  /** Feed a control vector as if it came from a sensor — for autopilots and QA
   *  rigs that synthesise a player rather than replaying captured gravity.
   *
   *  swoon's autopilot is the reason this is public. It already models a body
   *  lag and the pipeline's own EMA before handing over a control vector, and it
   *  used to call `window.SWOON.tilt()` to inject it. Under this shim the
   *  inbound door takes gravity, so without this the autopilot would either
   *  bypass the pipeline (and be tuned against a control no player produces) or
   *  need its own copy of the inverse.
   *
   *  A real host takes priority: pushes are ignored while live sensor input has
   *  arrived within DEV_TAKEOVER_MS, the same rule the keyboard path follows. */
  pushControl(cx, cy, slot = 0, tMs = now()) {
    if (tMs - this._liveAt < DEV_TAKEOVER_MS) return false;
    this._injectAt = tMs;
    this._pushControl(slot, cx, cy, tMs);
    return true;
  }

  /** Inverse of §5.2 steps 2–6: a control vector back to the gravity vector
   *  that would have produced it, so the dev path enters the pipeline at the
   *  same door a sensor does. */
  _pushControl(slot, cx, cy, tMs) {
    const c = this.tilt;
    const ax = (cy / (c.ySign || -1)) * c.maxAngleDeg;
    const ay = (cx / (c.xSign || 1)) * c.maxAngleDeg;
    const gy = Math.sin(ax * D2R);
    const gx = -Math.sin(ay * D2R);
    const gz = Math.sqrt(Math.max(0, 1 - gx * gx - gy * gy));
    this._slot(slot).pipe.push(gx, gy, gz, tMs);
  }
}

// ── dev input ────────────────────────────────────────────────────────────────

/** Fraction of the short screen edge a full-deflection drag covers. Lifted
 *  from carve, which learned it the hard way: mapping the ABSOLUTE touch
 *  position to lean snapped to a hard edge on any touch off centre and left no
 *  way to hold neutral except the exact middle of the screen. The touch-down
 *  point is the neutral and the lean is the drag from it. */
const DRAG_RADIUS = 0.30;

/** Same bindings as wend and carve already use, including WASD — QA scripts and
 *  the developer's muscle memory are both already written against them.
 *
 *  WASD IS PLAYER ONE UNTIL A GAME SAYS IT WANTS TWO, and that condition is
 *  the whole reason this is split in two maps rather than reassigned. Every
 *  single-player game and every QA script written against WASD keeps working;
 *  only a game declaring `players.max >= 2` hands WASD to slot 1. Reassigning
 *  it outright would have broken the muscle memory the comment above exists
 *  to protect. */
const KEYMAP_P1 = {
  ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd',
};
/** BY PHYSICAL KEY (`e.code`), not by typed letter. `e.key` is what the OS
 *  layout says the key MEANS, and on a non-Latin layout — Hebrew, on the
 *  machine this was found on — the physical W key types 'ש' and matched
 *  nothing: arrows steered player one and WASD steered nobody (BAL-594).
 *  `e.code` names the physical key regardless of layout, and a US layout's
 *  'w' still arrives as KeyW, so QA scripts and muscle memory both keep
 *  working. */
const KEYMAP_P2 = {
  KeyA: 'l', KeyD: 'r', KeyW: 'u', KeyS: 'd',
};

function makeDevInput(win, canvas) {
  if (!win || typeof win.addEventListener !== 'function') return null;

  // One key set per slot. `touched` records that a human has actually pressed a
  // player-two key: without it slot 1 would exist from boot, reading a
  // perfectly still zero, and a one-player browser session would look like a
  // two-player one to anything counting live slots.
  const keys = [new Set(), new Set()];
  const touched = [true, false];
  let ptr = false, ox = 0, oy = 0, px = 0, py = 0;

  const onKeyDown = (e) => {
    const k1 = KEYMAP_P1[e.key];
    if (k1) { keys[0].add(k1); e.preventDefault?.(); return; }
    const k2 = KEYMAP_P2[e.code];
    if (k2) { keys[1].add(k2); touched[1] = true; e.preventDefault?.(); }
  };
  const onKeyUp = (e) => {
    const k1 = KEYMAP_P1[e.key];
    if (k1) { keys[0].delete(k1); return; }
    const k2 = KEYMAP_P2[e.code];
    if (k2) keys[1].delete(k2);
  };
  const target = canvas || win;

  const onDown = (e) => { ptr = true; ox = e.clientX; oy = e.clientY; px = 0; py = 0; target.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => {
    if (!ptr) return;
    const w = win.innerWidth || 1280, h = win.innerHeight || 720;
    const r = Math.max(60, Math.min(w, h) * DRAG_RADIUS);
    px = (e.clientX - ox) / r;
    // NOT negated. This produces the pipeline's own screen-space convention
    // (ySign = -1, y grows downward), so dragging down leans back exactly as
    // the sensor reports it. Games negate once for their own world, if at all.
    py = (e.clientY - oy) / r;
    const m = Math.hypot(px, py);
    if (m > 1) { px /= m; py /= m; }
  };
  const onUp = () => { ptr = false; px = 0; py = 0; };

  win.addEventListener('keydown', onKeyDown);  // see onKeyDown/onKeyUp above
  win.addEventListener('keyup', onKeyUp);
  target.addEventListener?.('pointerdown', onDown);
  target.addEventListener?.('pointermove', onMove);
  target.addEventListener?.('pointerup', onUp);
  target.addEventListener?.('pointercancel', onUp);

  return {
    /** Has a human ever driven this slot? Slot 0 always; slot 1 once touched. */
    touched(slot = 0) { return !!touched[slot]; },

    /**
     * @param {number} slot
     * @param {boolean} split  true once the GAME has said it wants two
     *   players. While false, WASD is folded into slot 0 as it always was.
     */
    sample(slot = 0, split = false) {
      // The pointer is one mouse, so it drives slot 0 and only slot 0.
      if (slot === 0 && ptr) return { x: px, y: py };
      const held = split ? keys[slot] : new Set([...keys[0], ...keys[1]]);
      if (!held) return { x: 0, y: 0 };
      const x = (held.has('r') ? 1 : 0) - (held.has('l') ? 1 : 0);
      // DOWN MINUS UP, and it is not a typo. Arrow-up is lean-forward, and the
      // pipeline's ySign is -1, so forward is NEGATIVE in control space. Get
      // this backwards and the developer's keyboard and the player's board
      // disagree about which way is forward.
      const y = (held.has('d') ? 1 : 0) - (held.has('u') ? 1 : 0);
      const m = Math.hypot(x, y);
      return m > 1 ? { x: x / m, y: y / m } : { x, y };
    },
    detach() {
      win.removeEventListener('keydown', onKeyDown);
      win.removeEventListener('keyup', onKeyUp);
      target.removeEventListener?.('pointerdown', onDown);
      target.removeEventListener?.('pointermove', onMove);
      target.removeEventListener?.('pointerup', onUp);
      target.removeEventListener?.('pointercancel', onUp);
    },
  };
}

function now() {
  return typeof performance === 'object' && performance.now ? performance.now() : Date.now();
}

export { HANDLER, GAME_API, REQUIRES_HOST_API, DEV_TAKEOVER_MS };
