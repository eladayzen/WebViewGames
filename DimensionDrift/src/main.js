// carve — boot, state machine and frame loop.
//
// The clock relationship here is the opposite of every other music game in this
// app, and it is worth being explicit about. Elsewhere the world is placed FROM
// the audio clock, so a hazard charted on a beat cannot miss it. Here the world
// is placed from the rider's own momentum, and the audio clock is consulted to
// decide WHEN to place the next thing — the course predicts where the rider will
// be when a beat lands and puts a gate there. Speed had to stay genuinely the
// player's, because trading speed for line is the entire game.
//
// One consequence to keep in mind when changing anything below: the run ends
// when the music does, not at a finish line. Distance covered is a score, not a
// goal, which is what makes pointing straight down the fall line tempting and
// dangerous rather than simply correct.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createMenuNav } from './shared/bobo-ui/menunav.js';
import { installGbSdk } from './systems/gbSdk.js';
import { analytics } from './systems/analytics.js';
import { Terrain, MountainMesh, HALF, CHUNK, meshHeight, setValleyScale } from './mountain.js';
import { Sky } from './sky.js';
import { FarRange } from './range.js';
import { Scatter, BAND } from './scatter.js';
import { Rider, CameraRig, TUNE, setPipelineGamma } from './rider.js';
import { Trail } from './trail.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { openCalibration } from './shared/bobo-ui/calibrate.js';
import { DEFAULT_STANCE, stanceFor } from './orientation.js';
import { installLogRing, formatLog } from './shared/bobo-ui/logring.js';

// FIRST, before anything can print: the lines worth keeping are boot lines.
installLogRing();
import { Course, ReferenceRun, planGates, planKickers } from './course.js';
import { Pickups } from './pickups.js';
import { createFinishLine } from './finishLine.js';
import { createStartLine } from './startLine.js';
import { createRivals } from './rivals.js';
import { listPlaces, getPlace, defaultPlaceId, pickOffset, pickHour } from './places.js';
import { Timer, CLOCK } from './timer.js';
import { Post, Particles, Snowfall } from './fx.js';
import { Audio, BeatPulse } from './audio.js';
import { Mood } from './mood.js';
import { updateLitCommon } from './lit.js';
import { Hud } from './hud.js';
import { installDevUnlock } from './devUnlock.js';
import { createSettingsPanel, createDevPanel } from './panels.js';
import { listModes, getMode, defaultModeId } from './modes/mode.js';
// Registering is the side effect — see modes/mode.js. Importing a mode is what
// puts it in the lobby, so this list is the only place a mode is switched on.
import './modes/chillVibe.js';
import { RACE_LENGTH } from './modes/race.js';
import { Input } from './input.js';
import { clamp } from './rng.js';
import { BoboHost } from './shared/bobo-host/index.js';

const RIDER_URL = '/models/rider.glb';

/**
 * Seconds to bring the music up over at the start of a run.
 *
 * Sized against the countdown rather than picked: the numbers run for three
 * seconds and the music starts on the last of them, so a fade of a little over
 * two seconds finishes just as the rider is released. Any longer and the first
 * gates are ridden to a half-volume track.
 */
const MUSIC_FADE_IN = 2.2;

/**
 * Whether leaning forward and back does anything.
 *
 * Off: the board is steered on ONE axis. See the note where it is applied.
 */
const FORE_AFT_INPUT = false;
/** Reported to the host in `ready`. Kept in step with package.json by hand. */
/**
 * The version this game reports to its host, and it MUST match the tag that
 * ships it (`<game>-v0.3.0` -> `<game>-0.3.0.tgz`, DISTRIBUTION.md).
 *
 * It said `1.0.0` in all five games while the shipped tags were 0.1.0 to 0.2.1,
 * so every host that logged a game's version logged the same wrong number for
 * every game — and `DISTRIBUTION.md`'s claim that the tag is "the only place a
 * version is written" was not true. Bump this in the same commit as the tag.
 */
const VERSION = '0.3.0';
const SEED = 20260809;

/**
 * The world's own defaults, named so a place can leave a key out and get them.
 *
 * They are the values `scatter.js` and `planKickers` boot with, repeated here
 * rather than imported because the point is that a place OMITTING a key is
 * identical to the game before places existed -- and that is easier to keep
 * true when the fallback is written down next to the thing that applies it.
 */
const SCATTER_DEFAULTS = { trees: 90, obstacles: 1.5 };
/** `scatter.js`'s own lateral spread for race blockers, metres either side. */
const OBSTACLE_U_DEFAULT = 15;
/** `planKickers`' own defaults: metres of clear run between jumps, and how
 *  hard the track has to be leaning on a beat before one is put there. */
const KICKER_GAP = 250;
const KICKER_ENERGY = 0.55;

/**
 * TEMPORARY — the wrench appears without the gesture.
 *
 * Asked for while the race is being built, to make testing it quicker. The
 * seven-second hold and the code still work and are still the only route in a
 * shipped build; this just also fires the unlock once on load.
 *
 * SET IT FALSE BEFORE ANYTHING SHIPS. Trenchlight §7.9 is explicit that the dev
 * panel skips content and removes failure conditions, so a player must never
 * reach it by accident — and a wrench sitting in the chrome row is not an
 * accident away, it is a tap away.
 */
const DEV_UNLOCKED_AT_BOOT = true;
const MAX_MULT = 8;
// The end-of-run coast (see _updateCoast): how long she keeps gliding after the
// run ends before the motion freezes, tuned to land the freeze just behind the
// fully-faded results panel (scheduled at 900 ms + its 0.62 s fade).
const COAST_S = 1.6;
const COAST_BRAKE = 11;               // m/s per second -- must beat downhill
                                     // gravity (~1.5/s) so she visibly winds
                                     // down to the drift floor, not speeds up
const COAST_FLOOR = 3;                // m/s she drifts at before the freeze
const COAST_LEAN = Object.freeze({ x: 0, y: 0 });

const SPEED_LO = 12;
const SPEED_HI = 34;

/**
 * BAL-584's second half, behind one name. OFF, by decision.
 *
 * "We want people only to play the horizontal in the default. I don't want
 * the other options to be accessible at all... I don't know how people will
 * play it, it won't somehow get there."
 *
 * So this is not a hidden button. With it false there is NO rotate control
 * and no road to one from the menus, and -- the part a hidden button would
 * miss -- the stored stance is IGNORED. Anyone who turned their board while
 * the feature was live has a 90 sitting in local storage, and reading it back
 * would hand them a rotated game with nothing on screen to explain it and no
 * way out. The screen stays, doing the half of the job that was never in
 * doubt: showing how the board goes down and which way to lean.
 *
 * The machinery underneath is intact and unit-tested (`orientation.js`), so
 * turning this back on is one word plus the markup for a button.
 */
const STANCES_ENABLED = false;

/**
 * Two-player mode (BAL-594), off unless the URL says otherwise.
 *
 * Reading the flag rather than shipping a constant keeps one build able to do
 * both, which is what the pixel budget knob already does and for the same
 * reason: the thing being developed can be turned on wherever it needs
 * measuring, including on a device, without a separate build to confuse with
 * the real one.
 */
/** What a slot with no live board reads as. Frozen, never steered -- see
 *  `_updatePlayerTwo`. Shared and never mutated. */
const ZERO_LEAN = Object.freeze({ x: 0, y: 0 });

/** Wall clock for diagnostics, independent of the game's own time. */
const now2 = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** How far across the fall line player two starts from player one. Wide
 *  enough that neither opens the race inside the other's board, narrow
 *  enough that both are on the groomed line rather than one in the trees. */
const P2_START_OFFSET = 9;

/** THE PLATFORM'S OWN MULTIPLAYER PALETTE, by slot. Elad: every multiplayer
 *  surface in the app uses the same four fixed colours, and a player keeps
 *  theirs for the whole session -- player one is always the red, player two
 *  the turquoise. The values are the app's, read from the serialized
 *  `playersColors` on MultiplayerManagerUI (gobalance
 *  App/Multiplayer/Prefabs/multiplayerPopup.prefab, 2026-10-14):
 *  red, turquoise, purple, orange. A colour the roster sends for a player
 *  OVERRIDES the slot colour (the app is the source of truth; these are the
 *  same values it would send today). Single-player stays untinted.
 *
 *  Red and orange do collide with ZED's and ACE's warm suits -- but the
 *  rival field only exists in single-player, where no human wears a tint. */
const PLAYER_COLORS = [0xf65e5e, 0x00c9d1, 0xca47fa, 0xff8c00];
/**
 * HOW FAR IS LEFT, said exactly once in the codebase.
 *
 * The ending card has to agree with the TO FINISH the player was watching a
 * second earlier -- BAL-622's acceptance is literally "the number matches
 * what player 2's own HUD showed at that moment" -- and two formatters that
 * agree today are two formatters that disagree after the next edit. Metres
 * under a kilometre, because that is what the HUD says and because "600 m"
 * is a distance a child can picture where "0.6 km" is arithmetic.
 */
const toFinishText = (m) => {
  const togo = Math.max(0, m ?? 0);
  return togo >= 1000 ? `${(togo / 1000).toFixed(1)} km` : `${Math.round(togo)} m`;
};
/** `#rrggbb` for the DOM, from the one list the scene is tinted from. */
const playerCss = (i) => `#${PLAYER_COLORS[i].toString(16).padStart(6, '0')}`;
/**
 * The two letters on a player's badge: their initials, or the first two
 * characters of a single-word name. Used by the countdown card and the
 * calibration wizard, which must agree -- a player learns the badge once.
 */
const initials = (n) => {
  const words = String(n ?? '').trim().split(/\s+/).filter(Boolean);
  const ini = words.map((w) => w[0]).slice(0, 2).join('');
  return (ini.length > 1 ? ini : String(n ?? '').trim().slice(0, 2)).toUpperCase();
};

/**
 * The bridge's max-angle reply, as a number.
 *
 * IT IS A PROMISE OF AN OBJECT -- getMaxAngle(seat?) resolves to
 * {value, default, min, max, seat?} and REJECTS on a refusal ("no such seat").
 * Confirmed against the SDK source, 2026-10-15.
 *
 * This is worth stating because the shape fails silently in the worst way: a
 * promise is never nullish, so `gb.getMaxAngle(seat) ?? fallback` takes the
 * PROMISE as the value and every fallback downstream is dead code. That is
 * what the seat read did from 16aa5dc until now.
 *
 * A rejection is "no value", not an error -- an unknown seat is an ordinary
 * answer to an ordinary question.
 */
const readAngle = async (reply) => {
  try {
    const r = await reply;                 // the bridge answers with a PROMISE
    const v = +(r?.value ?? NaN);
    return Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;                            // a refusal is "no value", not an error
  }
};

/** The lobby painting. Relative to index.html, so it resolves in every build. */
const LOBBY_ART = 'lobby_bg.jpg';

const TWO_PLAYER = (() => {
  const v = new URLSearchParams(location.search).get('2p');
  return v != null && v !== '0';
})();

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  },
};

const RANKS = [
  { rank: 'S', at: 0.95 },
  { rank: 'A', at: 0.80 },
  { rank: 'B', at: 0.62 },
  { rank: 'C', at: 0.42 },
  { rank: 'D', at: 0 },
];

function rankFor(score, par) {
  const ratio = par > 0 ? score / par : 0;
  return RANKS.find((r) => ratio >= r.at).rank;
}

const multFor = (combo) => Math.min(MAX_MULT, 1 + Math.floor(combo / 4));

/**
 * What an EXCELLENT run is worth — not a flawless one.
 *
 * Modelling par as every gate taken with the multiplier never breaking put it at
 * eighty thousand, which a clean autopilot descent reached a third of. A par
 * nobody can approach makes every rank below it meaningless, so this assumes
 * what a good run actually looks like: a carve linked between each pair of
 * gates, and the streak going down about once in ten gates.
 */
function computePar(plan, reference) {
  let combo = 0;
  let score = 0;
  for (let i = 0; i < plan.length; i++) {
    if (i > 0 && i % 10 === 0) combo = 0;
    score += 100 * multFor(combo++);
    score += 90 * multFor(combo++);
  }
  // Distance banked along the way, plus what a run's worth of air is worth.
  return Math.round(score + reference.totalDistance * 2 + 6000);
}

class Game {
  /**
   * The pixel-budget knob — mechanism shipped, CONSTANT deliberately not.
   *
   * The lag that prompted the KNOB was measured only in the Unity EDITOR,
   * whose texture-copy transport (33 MB per frame at 8.3 Mpx) does not exist
   * on any device a player holds, so carve shipped no constant. The first
   * real-device report (Elad's big Android tablet, 2026-10-06, GoBalance
   * build) is what earned a DEFAULT -- and only for that build: the
   * `--gobalance` target defines `__BUDGET_DEFAULT__` (1.6 Mpx, the fleet's
   * one device-validated number) while Bobo/web stay uncapped, their lag
   * still unmeasured. `?budget=N` overrides either way; `?budget=0` turns
   * any cap off.
   */
  static _budgetMpx() {
    const q = new URLSearchParams(location.search).get('budget');
    if (q != null) {
      if (q === '0') return null;
      const n = Number(q);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return typeof __BUDGET_DEFAULT__ === 'number' ? __BUDGET_DEFAULT__ : null;
  }

  /**
   * Bloom: on in a browser, OFF on the device build, and `?bloom=1|0` either way.
   *
   * THE KNOB SHIPS WITH THE DEFAULT, exactly as the pixel budget does, because
   * this is a look change and the look is Elad's. A browser keeps the glow so
   * nothing about the game we iterate on changes; the GoBalance build drops it
   * for the two reasons in fx.js Post -- it is the fill the adaptive scaler is
   * not allowed to shed, and it is the measured source of the two-player black
   * flash. `?bloom=1` puts it back on a device for an A/B without a rebuild.
   */
  static _bloomOn(transport) {
    const q = new URLSearchParams(location.search).get('bloom');
    if (q != null) return q !== '0';
    return transport !== 'gobalance';
  }

  static _scaleFor(w, h, maxDpr = 2) {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const b = Game._budgetMpx();
    if (!b || w <= 0 || h <= 0) return dpr;
    return Math.min(dpr, Math.sqrt((b * 1e6) / (w * h)));   // never upscales
  }

  constructor() {
    // Scratch colour for gate feedback: `emit` and `punch` both COPY from it,
    // so one instance is reused rather than allocating per gate.
    this._gateBurst = new THREE.Color();
    this.canvas = document.getElementById('stage');
    // The HUD first: a version refusal fires the moment `hello` lands, which can
    // be inside this constructor, and it has to have something to draw on.
    this.hud = new Hud();
    this.host = this._makeHost();
    this.input = new Input(this.host);
    // BAL-584: the stored stance, adopted before the first frame polls a lean.
    // Through `stanceFor` so a hand-edited or stale value cannot leave
    // steering rotated by something the screen has no way to show.
    // THE STORED STANCE IS ONLY READ WHILE STANCES ARE ENABLED. Off, every
    // player is square to the screen whatever is in their local storage --
    // see STANCES_ENABLED for why that matters more than a hidden button.
    this.input.stance = STANCES_ENABLED
      ? stanceFor(store.get('carve.stance', DEFAULT_STANCE)).deg
      : DEFAULT_STANCE;
    this.audio = new Audio();
    this.mood = new Mood();

    this.state = 'load';
    this.time = 0;
    this.lastFrame = 0;
    /** Set while the board-setup screen is holding a countdown. */
    this._stanceThen = null;

    // Adaptive resolution: a phone that cannot hold the frame budget drops
    // pixels rather than frames, measured over a rolling window so one hitch
    // never triggers a change.
    this.renderScale = 1;
    /** Reused so the per-frame lean costs no allocation. */
    this._lean = { x: 0, y: 0 };
    // ── THE PIXEL BUDGET ──────────────────────────────────────────────────
    // Identical semantics to HillBombSunsetRidge and RoboRun, deliberately --
    // one function shipped three times beats three tuned constants, and 1.6
    // Mpx is the only budget anyone has validated on the oldest iPad (the
    // device that decides what ships). See _budgetMpx for why carve ships the
    // KNOB and not a constant: the only lag measured so far was the Editor's,
    // whose per-frame texture copy no device pays, and the Editor log's
    // 23.2 ms at scale 1.00 vs 9.9 ms at 0.88 says cliff, not fill-rate --
    // numbers from the wrong transport to tune a product by.
    this.maxScale = Game._scaleFor(window.innerWidth, window.innerHeight);
    this._frameAcc = 0;
    this._frameCount = 0;

    this._setupRenderer();
    this._loop = this._loop.bind(this);
    this._bindUi();
  }

  /**
   * The one place in this game that knows a host exists (BRIDGE.md §1).
   *
   * Constructed before the world is built, not after: `hello` is sent "as early
   * as possible" and the shim only buffers what arrives before the game object
   * is up. Handlers other than `hello`/`refuse` are held by the shim until
   * `ready()`, so they can safely reach for `this.audio` and the rest.
   *
   * `recenter` is absent on purpose — the shim owns the neutral and reports its
   * own `calibrating` progress, so there is nothing for the game to do with it.
   */
  _makeHost() {
    const host = new BoboHost({
      id: 'carve',
      version: VERSION,
      orientation: 'landscape',
      // BAL-594. BEHIND A FLAG ON PURPOSE, and the flag is not timidity: the
      // host hands WASD to slot 1 as soon as a game says it wants two players,
      // so declaring `max: 2` before carve can draw a second rider would take
      // WASD away from single-player testing and give it to a player nobody
      // can see. `?2p=1` until the split screen is real.
      players: { min: 1, max: TWO_PLAYER ? 2 : 1 },
      needs: ['tilt'],
      // Keep the dev drag on the canvas, as it was: on the window it would also
      // fire under the HUD's own buttons.
      devCanvas: this.canvas,
      on: {
        // Logged for the same reason the GL renderer string is: which host and
        // which API version was actually on the other end is the first question
        // asked about any report from a device, and inferring it costs days.
        hello: (h) => console.log(`[carve] host ${h.host}/${h.appId} api ${h.hostApi} ` +
          `caps [${(h.capabilities ?? []).join(' ')}]`),
        settings: (s) => this.audio.applySettings(s),
        // `sensor` is not handled: the shim's own `live`/`stale` answer both
        // questions carve asks of it, and they answer them for a host that
        // never implements the message. Battery is not shown anywhere here.
        pause: () => this._pause(),
        resume: () => this._resumeFromPause(),
        // The host forwards the system back gesture rather than deciding itself:
        // only this side knows whether a run is currently in flight.
        back: () => this._back(),
        refuse: (r) => this.hud.fatal(r.message),
      },
    });

    // ── ON GOBALANCE, THE CONSOLE CROSSES THE BRIDGE ─────────────────────
    // gobalance-33 counted it from the shipped bundle: twelve console.log
    // sites, none of which can reach Unity's log, against exactly one
    // window.Unity reference -- so the geometry line built FOR the Unity hunt
    // was invisible to it. Routing one line by hand is how that happens again;
    // mirroring the console wholesale is how it cannot. Everything still goes
    // to the real console first (and the log ring wrapped it earlier, so the
    // ring keeps capturing), and the mirror only exists on the one transport
    // whose log is otherwise unreachable. Nothing this game prints is
    // high-frequency; send failures fall into console.debug, which is
    // deliberately not mirrored, so a broken bridge cannot loop.
    if (host.transport === 'gobalance') {
      for (const lvl of ['log', 'warn', 'error']) {
        const orig = console[lvl].bind(console);
        console[lvl] = (...a) => {
          orig(...a);
          try {
            host.send({ type: 'log', lvl, text: a.map((x) => {
              if (typeof x === 'string') return x;
              if (x instanceof Error) return `${x.message} | ${(x.stack || '').split('\n')[1]?.trim() ?? ''}`;
              try { return JSON.stringify(x); } catch { return String(x); }
            }).join(' ').slice(0, 300) });
          } catch { /* the bridge is the thing being debugged; never throw over it */ }
        };
      }
    }

    // The pipeline's response curve, handed to the rider so `TUNE.edgeCurve`
    // keeps meaning the composed exponent the mountain was tuned against. Read
    // once here, off the shim, rather than copied as a literal into rider.js.
    setPipelineGamma(host.tilt?.gamma);
    return host;
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,          // the composer's blur and bloom cover the edges
      powerPreference: 'high-performance',
      stencil: false,
      // ── ONLY INSIDE THE UNITY WEBVIEW ───────────────────────────────────
      // The GoBalance Editor path captures the page as a BITMAP (WKWebView
      // rendered offscreen, copied into a Texture2D), and a capture of a
      // WebGL canvas whose drawing buffer is discarded after composite reads
      // back black or stale tiles -- Elad's Editor screenshot shows exactly
      // that: DOM crisp, canvas black except one leftover rectangle of an
      // earlier frame. Preserving the buffer gives the capture a stable
      // surface to read. Scoped to window.Unity because preservation costs a
      // copy on every present, and no other platform captures the page.
      preserveDrawingBuffer: !!window.Unity,
    });
    // ── CONTEXT LOSS: THE SILENT VERSION OF EVERY BLACK WE HAVE CHASED ────
    // A lost WebGL context blacks the CANVAS LAYER while the DOM keeps
    // compositing crisply over it -- which is pixel-for-pixel what the Unity
    // Editor screenshot showed (gobalance-33's column sampling, 2026-10-01).
    // WKWebView reclaims the backing stores of occluded views, and the Editor
    // renders the page occluded by design, so this is the prime suspect there
    // -- and untilnow the page had NO listener, so a loss was indistinguishable
    // from every other black. Now it announces itself through the error bridge
    // (the string lands in Unity's log / adb logcat), and on the GoBalance
    // transport the page reloads itself after a beat: auto-start puts it back
    // into a run, which beats a permanently black canvas a player cannot fix.
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();   // without it the context can never be restored
      console.error('[carve] WEBGL CONTEXT LOST — canvas layer is black until restored');
      this.host.error('WEBGL CONTEXT LOST');
      if (this.host.transport === 'gobalance') {
        clearTimeout(this._ctxReload);
        this._ctxReload = setTimeout(() => location.reload(), 2500);
      }
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      clearTimeout(this._ctxReload);
      console.error('[carve] webgl context restored');
      this.host.error('WEBGL CONTEXT RESTORED');
    });
    this.renderer.setPixelRatio(this.maxScale);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Which GPU/driver/backend is actually rendering. Two machines — or two
    // Chrome profiles on ONE machine — can run different ANGLE backends with
    // different shader compilers, and a shader that compiles on one can fail
    // on the other. Debugging that blind cost a week.
    try {
      const gl = this.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      console.log('[carve] gl:', ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    } catch (e) { /* diagnostic only */ }

    this.scene = new THREE.Scene();
    // Near/far are tight ON PURPOSE. At 0.4 to 2600 the depth buffer spans a ratio
    // of 6500, and on a phone that left no precision at thirty metres — the carve
    // trench, which sits a few centimetres above the snow, lost the depth fight
    // and simply did not appear on device. Nothing is drawn closer than the
    // rider, and the fog closes long before the sky dome.
    this.camera = new THREE.PerspectiveCamera(TUNE.fovBase, 1, 1.0, 1500);

    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this._resize(), 120));
  }

  /**
   * ── MENUS RENDER AT HALF SCALE ────────────────────────────────────────────
   *
   * The attract lobby is the full game playing itself: whole mountain, whole
   * post chain, at play-time cost, behind panels nobody is reading it through.
   * Elad's call (option 1 of 3): keep the living lobby, drop its resolution.
   * Half the linear scale is a quarter of the pixels -- invisible behind the
   * wash, and the biggest single GPU saving available without changing what
   * anything looks like in play. `count` and `play` stay at full scale; every
   * panel state (title, place, pause, results, sensor) takes the cut.
   */
  _menuFactor() {
    return (this.state === 'play' || this.state === 'count') ? 1 : 0.5;
  }

  /** Called once per frame from the loop: cheap compare, resize only on a real
   *  group change, so no state-transition site needs to remember to call it. */
  _syncMenuScale() {
    const f = this._menuFactor();
    if (f !== this._menuF) { this._menuF = f; this._resize(); }
  }

  _resize() {
    // A postcard is a photograph of a canvas that no longer exists at that
    // size. Drop it; the next lobby frame takes a new one at the new shape.
    this._thawPostcard();
    // The rail is sized from the viewport, so its width -- and the lens shift
    // that matches it -- is stale the moment the frame changes.
    this._lensDirty = true;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // The budget is per-geometry, not per-boot: a genuinely resized window
    // re-derives the cap (deterministic for a given size), while the adaptive
    // scaler stays subordinate to it and stays held on gobalance.
    this.maxScale = Game._scaleFor(w, h);
    // GEOMETRY, ANNOUNCED. In the Unity Editor the plugin believes the WebView
    // is 1920x1080 while Unity's surface is 1781x1141 and the native bitmap is
    // 3840x2160 at a reported devicePixelRatio of 1 (gobalance-33's probe,
    // 2026-10-01) -- three geometries that cannot all be right. This line says
    // which one the PAGE is laying out for, into the log every side can read,
    // so the mismatch is settled by printout instead of by theory.
    console.log(`[carve] viewport ${w}x${h} dpr ${window.devicePixelRatio} ` +
      `budget ${Game._budgetMpx() ?? 'off'}Mpx scale ${this.maxScale.toFixed(2)} ` +
      `vv ${window.visualViewport ? `${Math.round(window.visualViewport.width)}x${Math.round(window.visualViewport.height)}@${window.visualViewport.scale}` : 'n/a'} ` +
      `canvas ${Math.round(w * this.maxScale * this.renderScale)}x${Math.round(h * this.maxScale * this.renderScale)}`);
    const ratio = this.maxScale * this.renderScale * (this._menuF ?? this._menuFactor());
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    // Each player owns half the HEIGHT, so each camera's aspect is twice as
    // wide as the window's. Getting this wrong does not crop, it stretches,
    // and a stretched mountain reads as a lens change rather than as a bug.
    //
    // THE WALLS ARE GONE (reference frame, 2026-10-14): the sidebar is a
    // TRANSLUCENT overlay on the scenery, like the reference's left rail, so
    // the lens is full width again and nothing is inset. The sidebar's width
    // is the reference's proportion (~17% of the screen), clamped so a phone
    // keeps a readable rail and a desktop does not grow a door.
    // JS owns --sb-w; the stylesheet only carries a fallback for first paint.
    // CAPPED AGAINST HEIGHT, NOT AGAINST A PIXEL COUNT. A flat 300px cap
    // meant the rail KEPT SHRINKING in proportion as the screen got wider:
    // at 2560x1440 it was 11.7% of the frame against the reference's 17%, and
    // the course map inside it was squeezed to a thread (Elad: "2560:1440 for
    // example it's way too narrow"). The real thing a rail must not do is
    // swallow an ultra-wide frame, which is a question about its height.
    //
    // THE FLOOR IS 170, NOT 150 (BAL-609). 150 left 124px of usable rail once
    // the padding was paid, and the clock alone measured 123px at the phone
    // font floor -- fitting by a single pixel, which is not fitting. The safe
    // inset is handled in CSS (see .side-bar); this is the separate half of
    // Elad's "just give it a bit more width".
    this._sbW = Math.round(Math.max(170, Math.min(0.17 * w, 0.34 * h)));
    document.documentElement.style.setProperty('--sb-w', `${this._sbW}px`);
    const vw = w;
    const vh = TWO_PLAYER ? h / 2 : h;
    this.camera.aspect = vw / vh;
    this.camera.updateProjectionMatrix();
    this.post?.setSize(vw, vh, ratio);
    if (TWO_PLAYER && this.camera2) {
      this.camera2.aspect = vw / vh;
      this.camera2.updateProjectionMatrix();
      this.post2?.setSize(vw, vh, ratio);
    }
  }

  _bindUi() {
    // The act carries the element it came from, so which mode was chosen rides
    // on the button rather than on a variable somebody has to remember to set.
    // TWO QUESTIONS NOW. Picking a mode no longer drops you in -- it asks
    // where. Only the place screen starts a run, which is why its buttons carry
    // `place` and not `start`.
    // ── ANALYTICS (GoBalance only) ────────────────────────────────────────
    // installGbSdk must be CALLED, not merely imported -- two games shipped
    // with the import present, the call missing, and reported nothing, loudly
    // documented in ANALYTICS.md. Gated to the gobalance transport: on Bobo,
    // window.Unity is the FLUTTER bridge and gb2: traffic into it would be
    // noise into the wrong host; without a host, every analytics call below
    // is a documented no-op.
    // PRELOADED, because the lobby freezes on its first frame and a painting
    // that arrives afterwards would never be shown. If it lands late it is
    // swapped in under the already-frozen lobby; if it never lands the
    // rendered fallback stands and the player sees a mountain either way.
    {
      const art = new Image();
      art.onload = () => {
        this._artReady = true;
        if (this._frozen && this._wantsPostcard()) {
          const layer = this._el('postcard');
          if (layer) layer.style.backgroundImage = `url(${LOBBY_ART})`;
        }
      };
      art.onerror = () => {
        this._artReady = false;
        console.warn(`[carve] lobby art missing (${LOBBY_ART}); falling back to a rendered frame`);
      };
      art.src = LOBBY_ART;
    }

    if (this.host.transport === 'gobalance') installGbSdk();
    // ── THE APP ALREADY KNOWS THE PLAYER'S REACH; ASK IT ──────────────────
    // host.settings.maxAngleDeg starts at DEFAULT_SETTINGS' 12 and is only
    // ever written by host.setMaxAngle, i.e. by something happening in THIS
    // session. Nothing read the app's stored value at boot, so every launch
    // showed 12 however carefully the player had calibrated -- reported from a
    // device, 2026-10-15, as "it did not persist". It did persist; we never
    // asked. Seeded before the first frame so the settings row, the pipeline
    // and the rider all start on the player's own number.
    this._seedMaxAngleFromApp();

    this.hud.on('start', (e) => this._toPlaces(e?.el?.dataset?.mode));
    this.hud.on('place', (e) => this._beginRun(this._pendingMode, e?.el?.dataset?.place));
    // A restart stays in the mode that was being played — the button is on the
    // pause and results screens, where "again" can only mean this one.
    // ── THE MENU NAV (shared/bobo-ui/menunav.js) ──────────────────────────
    // Owns the rules Elad specified as a system: corner buttons toggle their
    // own menus, one suspend per menu visit, X closes the open menu, X in a
    // bare run asks "exit run?". Carve plugs in its own pause/resume/quit.
    this._nav = createMenuNav({
      // No `stance` here: with the stances off it is not a menu anyone can
      // open, only the gate shown before a run. See STANCES_ENABLED.
      screens: { pause: 'pause', settings: 'settings' },
      setScreen: (name) => {
        if (name == null) this.hud.setScreen(this._menuFrom ?? 'title');
        else this.hud.setScreen(name);
      },
      isRunning: () => this.state === 'play',
      pauseRun: () => this._pause(),
      resumeRun: () => this._resumeFromPause(),
      quitRun: () => this._quitRun(),
      exitApp: () => this._back(),
      onMenuShown: (id) => {
        if (id !== 'settings') return;
        // Repaint the inline rows against live values. Nothing else to do
        // here since BAL-585 took the `back` row out -- the road back to the
        // pause menu is the pause button, which crosses without re-suspending.
        this._settings?.setOpen(true);
      },
      confirmCopy: { title: 'exit run?', body: 'leaving here ends this run',
        yes: 'leave the run', no: 'keep riding' },
    });
    this.hud.on('restart', () => { this._nav.reset(); this._beginRun(this._modeId, this._placeId); });
    this.hud.on('resume', () => this._nav.close());
    this.hud.on('pause', () => this._nav.toggle('pause'));
    this.hud.on('to-settings', () => this._nav.switchTo('settings'));
    // ── CALIBRATION ──────────────────────────────────────────────────────
    // NO `pause` HOOK, because the button is only reachable from the pause
    // screen and `_pause` has already set `state = 'pause'`, which is what the
    // frame loop reads. That matters more than it looks: the wizard widens
    // `maxAngleDeg` to 45 while it measures, and a world still advancing
    // against that would be steering on a gamut nearly four times the real one.
    // Resuming goes through the usual 3-count, so the player is not dropped
    // straight back into a moving run from a standing lean.
    //
    // SESSION-SCOPED, DELIBERATELY. `host.setMaxAngle` reaches this game's
    // pipeline and nothing else -- the bridge has no message for writing a
    // setting -- so the measurement holds until the page is reloaded and does
    // not follow the player into wend or swoon. Making it stick needs one new
    // bridge message and a decision about whether reach is device-wide.
    this.hud.on('calibrate', () => this._runCalibration(false));
    // BAL-594: the finished player chose not to wait. Routed through the
    // mode's OWN ending -- the same one the line would have reached -- so
    // there is no second path for the results screen to drift between.
    this.hud.on('call-race', () => {
      if (this.state !== 'play') return;      // ignored while paused or over
      this._mode?.callIt?.();
    });
    // ── BAL-584: THE BOARD SETUP SCREEN ──────────────────────────────────
    // Two ways in, and they end differently. From the settings menu it is a
    // menu like any other: the run stays suspended under it and `ok` hands
    // back to settings. Before a run it is a GATE -- `_stanceThen` holds the
    // countdown, and `ok` is what releases it.
    this.hud.on('stance-ok', () => {
      const go = this._stanceThen;
      this._stanceThen = null;
      if (go) go();
      else this._nav.switchTo('settings');
    });
    // The X means "go up one level", which is what `_back` already meant for
    // the host's own back gesture: pause if a run is in flight, leave if not.
    // Wired to the behaviour this game already had rather than to a second one.
    this.hud.on('back', () => {
      // THE WIZARD FIRST, ALWAYS. While calibration is open the X is the only
      // live control in the chrome row, and it means one thing: get me out of
      // this screen. Routing it anywhere else is how a two-board wizard with
      // one driveable board became a room with no door.
      if (window.__bcalClose) { window.__bcalClose(); return; }
      // The gate stands BEFORE a run, so there is no run to confirm leaving.
      // X here means "not yet" and hands back to the route screen.
      if (this.state === 'stance' && this._stanceThen) {
        this._stanceThen = null;
        this.state = 'place';
        this.hud.setScreen('place');
        return;
      }
      this._nav.onExit();
    });
    this._installPanels();
    // `quit` READS AS "exit" AND IS NOT ONE. It is the labelled twin of the X
    // on the pause, sensor and results screens, and it means the same thing the
    // X means there: go up one level, to the lobby. Only the lobby's own X
    // reaches `_leave`.
    this.hud.on('quit', () => this._quitRun());

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'play') this._pause();
    });

    // ── QA surface ─────────────────────────────────────────────────────────
    //
    // Nothing here is part of the host bridge — that is `this.host` and only
    // `this.host`. These are the driver's hooks, and the harnesses in tools/
    // are written against them.
    window.CARVE = window.CARVE || {};
    // Live foot tuning on the deck plane -- CARVE.footYaw('Right', -10) turns
    // the boot by eye and logs the stance numbers to bake. Ends the round-trip
    // of guessing yaw signs over screenshots.
    window.CARVE.footYaw = (side, deg) => this.rider?.yawFootOnDeck?.(side, deg);
    window.CARVE.footPitch = (side, deg) => this.rider?.pitchFootOnDeck?.(side, deg);
    window.CARVE.footSlide = (side, m) => this.rider?.slideFootOnDeck?.(side, m);
    window.CARVE.bodyPivot = (deg) => this.rider?.bodyPivot?.(deg);
    window.CARVE.nudge = (m) => this.rider?.nudge?.(m);
    // Experiment dial: hip sway across the board per full edge (default 0.10).
    window.CARVE.sway = (k) => { this.rider._swayK = k; console.log('[carve] swayK', k); };
    window.CARVE.banana = (k) => { this.rider._bananaK = k; console.log('[carve] bananaK', k); };
    window.CARVE.centerDrop = (m) => { this.rider._centerDropM = m; console.log('[carve] centerDrop', m); };
    window.CARVE.arms = (k) => { this.rider._armsK = k; console.log('[carve] armsK', k); };
    // Center settle: extra pelvis drop earned by dwelling centered.
    // settle(maxMetres, secondsToFull)
    window.CARVE.settle = (m, t) => { this.rider._settleM = m; if (t) this.rider._settleT = t;
      console.log('[carve] settle', m, 'over', t ?? this.rider._settleT ?? 8, 's'); };
    window.CARVE.balanceArms = (k) => { this.rider._balanceArmsK = k; console.log('[carve] balanceArms', k); };
    window.CARVE.autopilot = (on) => { this._autopilot = !!on; };
    /** Inject a lean as if the sensor had produced it. QA only.
     *
     *  It goes in as GRAVITY, through the real pipeline, so a scripted rider is
     *  smoothed and dead-zoned exactly like a played one — the whole point of
     *  the pipeline living in the game. Screen space, like the sensor: y grows
     *  downward, so a tuck is negative. */
    window.CARVE.lean = (x, y) => this.host.pushControl(x, y);
    /** Freeze the run for a capture. QA only — the app's own pause arrives
     *  through the shim. */
    window.CARVE.freeze = () => { if (this.state === 'play') this._pause(); };
    // The whole tuning table, live. debugCam covers the three camera values that
    // get swept most, but framing turns out to hinge on camLookUp — how high
    // above the snow the view axis aims — and reaching it meant editing a file
    // and waiting for a rebuild for every trial.
    window.CARVE.TUNE = TUNE;
    // The shared shot tool (`shared/bobo-ui/shots.mjs`) drives THIS rather
    // than writing `body[data-state]` itself: a game that re-asserts its own
    // state from the frame loop overwrites an external write within 16 ms,
    // and the tool then measures whichever screen the game actually wanted
    // while reporting the one it asked for.
    window.CARVE.ui = this.hud.ui;
    /** Pull the camera in to inspect the rider. QA only. */
    window.CARVE.debugCam = (back, up, ahead) => {
      TUNE.camBack = back ?? TUNE.camBack;
      TUNE.camUp = up ?? TUNE.camUp;
      TUNE.camLookAhead = ahead ?? TUNE.camLookAhead;
    };
    /** Frame the rider from a fixed angle, ignoring the chase rig. QA only. */
    window.CARVE.inspectRider = (azimuth, dist) => {
      this._inspect = azimuth == null ? null : { az: azimuth, dist: dist ?? 4 };
    };
    /**
     * Hold the light at one point on the five-mood arc, ignoring run time. QA
     * only; null hands the arc back to the clock.
     *
     * Comparing two builds means comparing two frames, and the mood mixer moves
     * the whole palette continuously — so a capture that rides for six seconds
     * to lay down a trail has also travelled a third of the way from `first
     * light` toward `sunrise` by the time it shoots. Two rounds that ride for
     * even slightly different durations are then lit differently, and the
     * difference gets read as whatever shader change was under test.
     */
    window.CARVE.pinMood = (p) => {
      this._moodPin = p == null ? null : Math.max(0, Math.min(1, p));
      if (this._moodPin != null) this.mood.setProgress(this._moodPin);
    };
    /** Pin the camera at a fixed pose — for framing terrain features the chase
     *  rig never looks at, e.g. a kicker in profile. QA only. */
    window.CARVE.freeCam = (pos, look) => {
      this._freeCam = pos ? { pos, look } : null;
    };
    /** Live stance tuning: pose a bone as a delta from bind, then read the
     *  whole pose back with stanceDump() and bake it into STANCE. QA only. */
    window.CARVE.stance = (name, x, y, z) => this.rider.setStanceRotation(name, x, y, z);
    window.CARVE.stanceDump = () => this.rider.dumpStance();
    window.CARVE.bones = () => (this.rider.bones ? [...this.rider.bones.keys()] : []);
    // The whole game, for ad-hoc interrogation from the driver. QA only.
    window.CARVE._game = this;
    window.CARVE.debugSeek = (t) => {
      if (this.state !== 'play') return false;
      this.audio.start(t);
      this._seekTo(t);
      return true;
    };
    // Layout probe: world-space positions, so a geometry problem can be read off
    // numbers rather than inferred from a screenshot.
    window.CARVE.probe = () => ({
      rider: {
        x: +this.rider.x.toFixed(2), y: +this.rider.y.toFixed(2), z: +this.rider.z.toFixed(2),
        p: +this.rider.p.toFixed(1), u: +this.rider.u.toFixed(2),
        yawDeg: +(this.rider.yaw * 180 / Math.PI).toFixed(1),
        vh: +this.rider.vh.toFixed(2), edge: +this.rider.edge.toFixed(2),
        heading: [+this.rider.heading.x.toFixed(3), +this.rider.heading.y.toFixed(3), +this.rider.heading.z.toFixed(3)],
      },
      camera: {
        pos: this.camera.position.toArray().map((v) => +v.toFixed(2)),
        look: this.cameraRig.look.toArray().map((v) => +v.toFixed(2)),
        up: this.camera.up.toArray().map((v) => +v.toFixed(3)),
        rollDeg: +(this.cameraRig.roll * 180 / Math.PI).toFixed(1),
        fov: +this.camera.fov.toFixed(1),
      },
      centerX: {
        atRider: +this.terrain.centerX(this.rider.z).toFixed(2),
        ahead60: +this.terrain.centerX(this.rider.z - 60).toFixed(2),
        ahead200: +this.terrain.centerX(this.rider.z - 200).toFixed(2),
      },
      groundAtRider: +this.terrain.height(this.rider.x, this.rider.z).toFixed(2),
      gates: this.course.live.map((g) => ({
        p: +g.data.p.toFixed(1), u: +g.data.u.toFixed(1),
        x: +g.data.x.toFixed(1), z: +g.data.z.toFixed(1),
        ahead: +(g.data.p - this.rider.p).toFixed(1),
        red: g.data.red, passed: g.data.passed,
      })),
      shade: (() => {
        // Statistics of the baked terrain-shadow attribute, per visible chunk.
        return this.mountain.chunks.map((c) => {
          const a = c.geometry.attributes.aShade.array;
          let mn = 1; let mx = 0; let sum = 0;
          for (let i = 0; i < a.length; i++) { mn = Math.min(mn, a[i]); mx = Math.max(mx, a[i]); sum += a[i]; }
          return { p0: Math.round(c.p0), vis: c.mesh.visible, mn: +mn.toFixed(2), mx: +mx.toFixed(2), avg: +(sum / a.length).toFixed(2) };
        });
      })(),
      trailSamples: this.trail.samples.length,
      kickers: this.kickers.map((k) => ({ p: Math.round(k.p), t: +k.t.toFixed(1), u: +k.u.toFixed(1), h: +k.h.toFixed(1) })),
      pRate: +this.course.pRate.toFixed(2),
      planIdx: this.course.planIdx,
    });

    /** Height of the surface AS DRAWN — what the camera must stay above. QA. */
    window.CARVE.meshHeight = (x, z) => meshHeight(this.terrain, x, z);
    /** Terrain height along the fall line, for reading geometry as numbers. */
    window.CARVE.profile = (p0, p1, u = 0, step = 3) => {
      const out = [];
      for (let p = p0; p <= p1; p += step) {
        const z = -p;
        const x = this.terrain.xAt(u, z);
        out.push([Math.round(p), +(this.terrain.height(x, z) - this.terrain.baseHeight(p)).toFixed(2)]);
      }
      return out;
    };

    window.CARVE.stats = () => {
      const g = this.gateTiming;
      const sorted = [...g].sort((a, b) => a - b);
      return {
        state: this.state,
        time: this.audio.time,
        progress: this.grid ? this.audio.time / this.grid.durationSec : 0,
        beatSec: this.grid ? 60 / (this.grid.bpm || 128) : 0.469,
        score: this.score,
        combo: this.combo,
        timeLeft: this.timer ? +this.timer.remaining.toFixed(2) : null,
        renderScale: this.renderScale,
        p: this.rider?.p ?? 0,
        u: this.rider?.u ?? 0,
        speed: this.rider?.speed ?? 0,
        gatesPassed: this.course?.stats.passed ?? 0,
        gatesMissed: this.course?.stats.missed ?? 0,
        gatesPlanned: this.gatePlan?.length ?? 0,
        // How far off the beat the gates actually landed. This is the number
        // that proves or disproves the predictive placement idea.
        beatErrorMean: g.length ? g.reduce((a, b) => a + b, 0) / g.length : 0,
        beatErrorMedian: sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : 0,
        beatErrorP90: sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : 0,
        beatErrorMax: sorted.length ? sorted[sorted.length - 1] : 0,
        detail: this.gateDetail,
        ...this.stats,
      };
    };
  }

  async boot() {
    try {
      this.hud.setLoadText('decoding the soundtrack…');
      // THE GRIDS COME FROM `audio.load()` NOW, not from a fetch here. The
      // playlist pairs each track's buffer with its grid in one literal, and
      // separating them again in this file is exactly the drift that pairing
      // exists to prevent — see TRACKS in audio.js.
      await this.audio.load();
      // `this.grid` is the FIRST track's, and it is only the default used where
      // a single representative is all that is wanted: the reference run's
      // initial length, attract mode's fabricated clock, the probe's beatSec.
      // Everything that must agree with what is PLAYING reads `audio.grid`, and
      // everything that cuts a course segment reads that segment's own grid.
      this.grid = this.audio.tracks[0].grid;

      this.hud.setLoadText('surveying the mountain…');
      this.terrain = new Terrain(SEED);
      this.reference = new ReferenceRun(this.terrain, this.grid.durationSec + 8);
      // Kickers must exist before ANY terrain is meshed — the ramps are part of
      // the height field, and the height field is built hundreds of metres ahead.
      this.kickers = planKickers(this.grid, this.reference, SEED);
      this.terrain.setKickers(this.kickers);

      this.hud.setLoadText('setting the course…');
      this.gatePlan = planGates(this.grid, this.reference, SEED);
      // Lap 0's extent, so a restart can cut the endless tail back off rather
      // than riding a plan that has been growing since the app started.
      this._lapsPlanned = 1;
      // Where segment 1 begins. Accumulated rather than multiplied, because
      // the playlist's tracks are not the same length.
      this._segStart = this.audio.tracks[0].duration;
      this._lap0Gates = this.gatePlan.length;
      this._lap0Kickers = this.kickers.length;
      // Snapshot BEFORE anything can extend the reference table — see the use
      // in `_updateIdle`.
      this._attractLoopP = this.reference.totalDistance;
      // Snapshotted before anything can nudge them, for the dev panel's reset.
      // Each mode's AUTHORED camera, so the dev panel's reset restores what the
      // mode was written with rather than the boot table — the two differ the
      // moment a mode overrides a key.
      this._modeCamDefaults = new Map(
        listModes().map((m) => [m.id, { ...(m.camera ?? {}) }]));
      this._tuneDefaults = {
        camBack: TUNE.camBack, camUp: TUNE.camUp, camLookAhead: TUNE.camLookAhead,
        camLookUp: TUNE.camLookUp, maxRoll: TUNE.maxRoll,
      };
      this.par = computePar(this.gatePlan, this.reference);
      console.log(`[carve] course ok — ${this.gatePlan.length} gates, ${this.kickers.length} kickers, ` +
        `${Math.round(this.reference.totalDistance)}m reference, par ${this.par}`);

      this.hud.setLoadText('kitting out the rider…');
      // Not fatal if it fails: the rider falls back to primitives rather than
      // the whole game refusing to start over one asset.
      let riderModel = null;
      try {
        const gltf = await new GLTFLoader().loadAsync(RIDER_URL);
        riderModel = gltf.scene;
      } catch (e) {
        console.warn('[carve] rider model unavailable, using the primitive rider', e);
      }

      this.hud.setLoadText('grooming the piste…');
      this.sky = new Sky(this.scene, this.mood);
      this.range = new FarRange(this.scene, this.mood, SEED);
      this.mountain = new MountainMesh(this.terrain, this.scene, this.mood);
      this.scatter = new Scatter(this.terrain, this.scene, this.mood, SEED);
      this.rider = new Rider(this.terrain, this.scene, this.mood, riderModel);
      this.trail = new Trail(this.scene, this.mood);
      this.course = new Course(this.terrain, this.scene, this.mood, this.gatePlan);
      // After setKickers, which it reads to keep drift lines off the ramps.
      this.pickups = new Pickups(this.terrain, this.scene, this.mood, SEED);
      this.finishLine = createFinishLine(this.scene);
      this.startLine = createStartLine(this.scene);
      this.rivals = createRivals(this.scene, this.terrain, this.mood);
      // The field clones the player's assembled rider — board and body in one
      // group — so it has to be handed over after the Rider is built.
      this.rivals.setPrefab(this.rider.group);
      // ── WARM THE FIELD'S SHADERS WHILE THE LOADER IS STILL UP ───────────
      // The per-run `renderer.compile` in `_beginRun` fixed the black opening
      // frame once, and adding rivals brought it straight back: measured 2.0
      // and 0.0 mean luma at 600 and 900 ms, clean from 1500 ms. Four SKINNED
      // clones need skinned variants of the lit material, and those are new
      // programs no amount of compiling the empty scene will produce.
      //
      // So the field is spawned once here, compiled, and taken away again. The
      // jersey materials are cached for the life of the page (see `jerseyMats`)
      // so every later race reuses the programs built on this line. The stall
      // lands on the loading screen, which is the one place in this game where
      // a stall is what the player is already being shown.
      this.rivals.spawn(0);
      this.renderer.compile(this.scene, this.camera);
      this.rivals.despawn();
      this.pickups.onMote = (mote, chain) => {
      this.audio.pickup(chain.taken - 1);
      // THE CLOCK IS PAID PER MOTE; the score is still paid per CHAIN, in the
      // `pickups.update` loop below. Two currencies on one object, deliberately:
      // see timer.js on why the streak may multiply the chain and never this.
      if (this.state === 'play') this._grantTime(CLOCK.mote, null);
    };
      this.particles = new Particles(this.scene, 900);
      this.snowfall = new Snowfall(this.scene, 800, 64);
      this._bloomOn = Game._bloomOn(this.host.transport);
      this.post = new Post(this.renderer, this.scene, this.camera, this._bloomOn);
      console.log(`[carve] bloom ${this._bloomOn ? 'on' : 'off'} (${this.host.transport})`);
      this.cameraRig = new CameraRig(this.camera, this.terrain);
      // ── BAL-594: PLAYER TWO ──────────────────────────────────────────
      // A rider of their own, on the same terrain and in the same scene, so
      // the world stays single and only the riders are doubled. The model is
      // CLONED with SkeletonUtils rather than shared: two Riders posing one
      // skeleton would animate each other, which is the same clone the rivals
      // have always used for exactly this reason.
      if (TWO_PLAYER) {
        this.input2 = new Input(this.host, 1);
        // One calibration and one stance cover both players (BAL-594), so
        // player two adopts player one's rather than defaulting separately --
        // the two must never be able to drift apart silently.
        this.input2.stance = this.input.stance;
        this.rider2 = new Rider(this.terrain, this.scene, this.mood,
          riderModel ? cloneSkinned(riderModel) : null);
        // Worn, not washed: the player colour goes on the cap, the jacket
        // and the board (Elad's direction, 2026-10-13) instead of tinting the
        // whole character. Slot palette now, roster colour when the app
        // sends one -- see _syncPlayerColors.
        this._syncPlayerColors();
        this.trail2 = new Trail(this.scene, this.mood);
        this._lean2 = { x: 0, y: 0 };
        // ── A SECOND WINDOW ON THE WORLD ─────────────────────────────────
        // The mountain and the trees are streamed rings: ~70 m behind the
        // anchor, ~630 m ahead. One ring, anchored at the TRAILING rider,
        // means the LEADER rides off the front of the world the moment the
        // gap passes ~630 m -- Elad's screenshot: the top half riding pure
        // fog, no ground, no trees, the finish checker floating in the sky.
        //
        // So two-player gets a second ring of each, anchored at the LEADER.
        // Placement is a pure function of the chunk/band index, so the two
        // rings build IDENTICAL geometry for the same index -- overlapping
        // windows would z-fight every tree against its own twin. The update
        // below therefore clamps ring two to start where ring one ends:
        // riders close, it extends the vista ahead; riders apart, it sits
        // around the leader, and the uncovered middle lies outside both
        // cameras (each looks downhill from its own rider) behind the fog.
        // Each camera's frustum culls the ring it cannot see, so the cost
        // per half stays what one ring costs.
        this.mountain2 = new MountainMesh(this.terrain, this.scene, this.mood);
        this.scatter2 = new Scatter(this.terrain, this.scene, this.mood, SEED);
      }
      // ── BAL-594: THE SECOND HALF ─────────────────────────────────────
      // Its own camera, its own rig and its OWN COMPOSER. Two composers
      // rather than one shared chain is what makes bloom unable to cross
      // the seam: each half's glow is computed in its own targets, from
      // its own pixels, and the halves never meet until they are already
      // on the canvas. Sized to half the frame, so the two together cost
      // the same fill as the single full-frame chain they replace.
      if (TWO_PLAYER) {
        this.camera2 = new THREE.PerspectiveCamera(TUNE.fovBase, 1, 1.0, 1500);
        this.post2 = new Post(this.renderer, this.scene, this.camera2, this._bloomOn);
        this.cameraRig2 = new CameraRig(this.camera2, this.terrain);
      }
      this.beat = new BeatPulse(this.grid.beats);

      this.litMaterials = [
        ...this.rider.materials, ...this.scatter.materials, ...this.course.materials,
        ...this.pickups.materials,
        // Player two's rider is lit like every other object. Left out of this
        // list it never got uFogBase/uCamPos and rode as a pale fog ghost --
        // the same failure the rivals' jerseys had (see the frame loop).
        ...(this.rider2 ? this.rider2.materials : []),
        // The second tree ring is lit like the first, or its trees ride as
        // fog ghosts -- the same omission that got rider two (BAL-594).
        ...(this.scatter2 ? this.scatter2.materials : []),
      ];

      this.gateTiming = [];
      this.gateDetail = [];
      this._resetRunState();
      this._seekTo(0);
      this._resize();

      const best = store.get('carve.best', 0);
      this.hud.setBuild(typeof __BUILD__ === 'string' ? __BUILD__ : 'dev');
      // OFF AT BOOT, AND NOT PERSISTED. It rode on `carve.diag` in
      // localStorage and was toggled by tapping the build stamp — a
      // discoverable door to a developer tool, which is the thing CHROME.md's
      // "two panels" section exists to prevent, and a stored flag meant the
      // overlay could be on for a player who never asked for it. It is reached
      // through the dev panel now and nowhere else.
      this._diag = false;
    /**
     * The frame-cost readout. Separate from `_diag` on purpose: diagnostics is
     * a wall of text about the rider and the trail, and this is five lines you
     * read on a tablet at arm's length while standing on a board.
     */
    // ?perf=1 TURNS IT ON AT BOOT, because the only other way in is the dev
    // panel behind the seven-second hold on the score -- a gesture that is
    // deliberately undiscoverable and miserable to perform on a tablet while
    // standing on a board. The number this panel shows is the before/after for
    // any host-side frame-pacing change, so getting at it must not be a trick.
    this._perf = new URLSearchParams(location.search).get('perf') === '1';
    /** Rolling windows for the perf readout. ~1 s at 60 fps, ~2 s at 30. */
    this._perfFrames = [];
    this._perfJs = [];
      // BAL-594: ONLY THE RACE IN TWO-PLAYER. Chill vibe is a clock, and two
      // people sharing one clock is not a contest -- whoever runs it down
      // ends the other's run too. Offering it would be offering a mode that
      // cannot be played, so the list simply does not carry it. Elad's call.
      this.hud.setModes(TWO_PLAYER
        ? listModes().filter((m) => m.id !== 'chill')
        : listModes());
      this.hud.setPlaces(listPlaces());
      this.hud.setBest(best, best > 0 ? rankFor(best, this.par) : null);
      this.hud.setSensorState(this.input.connected);

      this.state = 'title';
      this.hud.setScreen('title');
      // §2: a host too old to drive this game is refused, not degraded. The
      // `refuse` handler has already put the reason on screen; starting the loop
      // anyway is the black-screen boot the compare exists to prevent.
      if (!this.host.ready()) return;
      this.lastFrame = performance.now();
      requestAnimationFrame(this._loop);
      this._watchFrames();
      this._gbAutoStart();
    } catch (err) {
      console.error('[carve] boot failed', err);
      this.hud.fatal(`carve failed to start\n\n${err.message ?? err}`);
      this.host.error(String(err.message ?? err), true);
    }
  }

  // ── Run lifecycle ─────────────────────────────────────────────────────────

  _resetRunState() {
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.stats = { gates: 0, carves: 0, air: 0, top: 0, crashes: 0, jumps: 0, tricks: 0 };
    (this.timer ??= new Timer()).reset();
    this.lastTrick = null;   // the last trick landed, for the HUD to read off
    this.distance = 0;
    this._lastMilestone = -1;
    this.gateTiming = [];
    this.gateDetail = [];
    // Cut the endless tail back to lap 0. The laps a previous run planned are
    // not WRONG — same seed, same reference, same absolute times, so re-cutting
    // them produces the same numbers — but leaving them on grows both arrays for
    // as long as the app is open, and `setKickers` re-sorts the whole list.
    //
    // HERE AND NOT IN `_seekTo`. That runs on every attract-mode loop-around and
    // on every QA seek, and truncating there would make `CARVE.debugSeek(3600)`
    // re-plan twenty-one laps inside a single frame. A run resets once.
    this.gatePlan.length = this._lap0Gates;
    this.kickers.length = this._lap0Kickers;
    this._lapsPlanned = 1;
    this._segStart = this.audio.tracks[0].duration;
    this.terrain.setKickers(this.kickers);
    this.course.kickers = this.terrain.kickers;
    // LAP 0 IS RE-PLANNED, NOT TRUNCATED, and this is why a mode may shape the
    // plan at all.
    //
    // Those gates are solved ONCE at boot, before any mode exists. Truncating a
    // stored copy back to `_lap0Gates` worked while every run used every gate;
    // it cannot work now that the race keeps one beat in three, because a
    // shaped array cannot be cut back into the plan it came from — and the
    // boost gates of a race would otherwise still be boost gates in the chill
    // vibe descent that followed it.
    //
    // Re-planning is cheap: 42 entries against a reference table that is
    // already built.
    const lap0 = planGates(this.grid, this.reference, SEED);
    this.gatePlan = this._mode?.shapePlan?.(lap0) ?? lap0;
    // `Course` holds the array itself, so the new one has to be handed over or
    // it keeps consuming the old.
    this.course.plan = this.gatePlan;
  }

  /** Place the whole world at a track time — used at boot, on restart and by QA. */
  _seekTo(t) {
    // ── WHERE ON THE MOUNTAIN THIS RUN HAPPENS ──────────────────────────
    // The reference run always starts at zero; `_courseOffset` is how far down
    // the real mountain that zero is pinned. Everything the world is built from
    // — `slopeAt`, `centerX`, `relief`, the scatter bands, the pickup bands —
    // is a pure function of p, so moving the start moves the whole course and
    // nothing has to be regenerated or reseeded.
    const p = this.reference.pAt(t) + (this._courseOffset ?? 0);
    this.rider.reset(p);
    // PLAYER TWO STARTS BESIDE PLAYER ONE, and this line is not a detail.
    // Rider one keeps riding through attract mode behind the menus, so by the
    // time a run begins its `p` is kilometres down the hill; rider two is only
    // stepped during play. Without this the race opened with the two of them
    // 3.2 km apart, which the terrain stream then papered over by following
    // whoever was behind. Reset together, offset across the fall line so they
    // do not start inside each other.
    if (this.rider2) {
      this._p2Ident = null;   // re-bind to whoever is in the second seat now
      this.p1Finished = false; this.p2Finished = false;
      this.p1ToGo = null; this.p2ToGo = null;
      const r2p = document.getElementById('results2p');
      if (r2p) r2p.hidden = true;
      this.p1Place = 1; this.p2Place = 2;
      this._top2 = 0;
      const d1 = document.getElementById('donePanel1');
      const d2 = document.getElementById('donePanel2');
      if (d1) d1.hidden = true;
      if (d2) d2.hidden = true;
      this.rider2.reset(p);
      // LANES, not a nudge: both riders used to sit on (or 4 m off) the same
      // centre line, and with each chase camera centred on its own rider the
      // two halves opened as the same picture -- "they start exactly in the
      // same location". Symmetric lanes either side of the course line put the
      // other rider visibly beside you at the gun, the way the rival field
      // lines up. Heights re-sampled so neither rider pops on frame one.
      this.rider.x -= P2_START_OFFSET / 2;
      this.rider.y = this.terrain.height(this.rider.x, this.rider.z);
      this.rider2.x = this.rider.x + P2_START_OFFSET;
      this.rider2.y = this.terrain.height(this.rider2.x, this.rider2.z);
      // ...and PLACED, not just assigned: the groups' positions are written
      // by rider.update, which does not run during the stance screen or the
      // countdown -- so both riders visibly STOOD in one spot until the gun
      // and snapped apart on the first play frame ("they start exactly in
      // the same location", round two). The lane goes into the meshes now.
      this.rider.group.position.set(this.rider.x, this.rider.y, this.rider.z);
      this.rider2.group.position.set(this.rider2.x, this.rider2.y, this.rider2.z);
      this.trail2?.clear();
    }
    this.mountain.reset(p);
    this.scatter.reset(p);
    if (this.mountain2) {
      // Ring one first, then ring two clamped above it -- the same no-overlap
      // rule the frame update keeps (see _streamWorld).
      this.mountain2.reset(Math.max(p,
        (this.mountain.baseIndex + this.mountain.count + 1) * CHUNK));
      this.scatter2.reset(Math.max(p,
        (this.scatter.baseBand + this.scatter.bands + 1) * BAND));
    }
    this.trail.clear();
    this.particles.clear();
    this.course.reset(p);
    this.pickups.reset(p);
    // Fast-forward the plan so gates are not spawned for beats already past.
    while (this.course.planIdx < this.gatePlan.length
      && this.gatePlan[this.course.planIdx].t < t) this.course.planIdx++;
    this.beat.reset();
    this.cameraRig.reset();
    // Through `locate`, so a seek into the second track sets the light for
    // where that track is, not for where the first one would have been.
    //
    // AND THROUGH THE PLACE'S HOUR. This line predates places having hours and
    // set the mood to the bare track position -- which, on every run start
    // (`_seekTo(musicStart)` with musicStart 0), OVERRODE the hour _beginRun
    // had just applied with hour zero, 32 ms later. The countdown then ran at
    // first light and the real hour snapped in on the first play frame:
    // "some system overrides the hour and lighting once the countdown
    // finishes and the run starts." Same formula as the play loop's walk now,
    // so a seek lands on the hour the walk would have reached, and a run
    // start lands on the place's own hour exactly.
    const moodAt = this.audio.locate(t);
    this.mood.setProgress(this._moodPin
      ?? (((this._moodBase ?? 0)
        + moodAt.offset / Math.max(1, this.audio.tracks[moodAt.index].duration)) % 1));
    this.cameraRig.update(0.016, this.rider, 0.3);
    this.cameraRig2?.update(0.016, this.rider2 ?? this.rider, 0.3);
    this.snowfall.reset(this.camera.position);
    this._prevP = this.rider.p;
    this._prevX = this.rider.x;
  }

  /**
   * Make the world be this place.
   *
   * Everything here is a per-run setting on something that already exists --
   * no mesh is rebuilt, no buffer is reallocated, and a key a place omits keeps
   * whatever the game booted with. That is the whole reason these four were
   * chosen over the seed: they are the drastic-feeling knobs that happen to be
   * free at this point in the frame.
   *
   * THE KICKERS ARE RE-PLANNED, and that is the only non-trivial one. It is a
   * pure function of the beat grid, the reference run and a seed, so calling it
   * again costs nothing -- but `Terrain` has to be told BEFORE `_seekTo`, since
   * the note on `setKickers` is explicit that kickers must be known before the
   * terrain around them is meshed, and `_seekTo` is what re-meshes it.
   */
  _applyPlace(place) {
    this.scatter.treesPerBand = place.trees ?? SCATTER_DEFAULTS.trees;
    this.scatter.obstaclesPerBand = place.obstacles ?? SCATTER_DEFAULTS.obstacles;
    this.mood.fogScale = place.fog ?? 1;
    // How close the valley sides come. See `setValleyScale` in mountain.js --
    // this changes what the mountain looks like, never how wide it is.
    setValleyScale(place.valley ?? 0);
    // ── LAYOUT, not density. See the note in `scatter.js`. ────────────────
    this.scatter.treeClump = place.treeClump ?? 0;
    this.scatter.treeReach = place.treeReach ?? 1;
    this.scatter.obstacleU = place.obstacleU ?? OBSTACLE_U_DEFAULT;
    this.scatter.obstacleGap = place.obstacleGap ?? 0;
    this.course.gateAmp = place.gateAmp ?? 1;
    this.course.timeGates = this._modeDef.timeGates === true;
    // The far view: the cheapest change in the game per unit of difference.
    // Where this place's day starts. The race overwrites it with a pin of its
    // own in `start`; chill vibe cycles from here.
    this._moodBase = pickHour(place);
    analytics.runStarted(this._modeId);
    analytics.levelStarted(this._placeId, place.order ?? 0);
    // APPLIED NOW, NOT AT THE FIRST PLAY FRAME. The race pins its own light in
    // mode.start before the countdown, but chill's hour was only written by the
    // play loop -- so the countdown ran under the lobby's leftover light and
    // the place's weather arrived AFTER it. "I asked that change of weather and
    // hour will happen before the first countdown, not after." lapTime is zero
    // here, so the play loop's walking formula continues seamlessly from this.
    if (this._moodPin == null) this.mood.setProgress(this._moodBase);
    this.range.setProfile(place.rangeProfile ?? 'ridges');
    this.range.setRock(place.rock ?? 0, place.snowLine ?? 60);
    this.range.setPresence(place.range ?? 1);
    const gap = place.kickerGap ?? KICKER_GAP;
    const energyMin = place.kickerEnergy ?? KICKER_ENERGY;
    const bars = place.kickerBars ?? 1;
    if (gap !== this._kickerGap || energyMin !== this._kickerEnergy
        || bars !== this._kickerBars) {
      this._kickerBars = bars;
      this._kickerGap = gap;
      this._kickerEnergy = energyMin;
      this.kickers = planKickers(this.grid, this.reference, SEED,
        { minGap: gap, energyMin, everyBars: place.kickerBars ?? 1 });
      // THE LAP-ZERO COUNT MOVES WITH IT, and forgetting this broke the whole
      // terrain. `_resetRunState` truncates the list back to `_lap0Kickers` to
      // undo the laps an endless run appended -- written when that count was a
      // constant decided once at load. Re-planning made it a variable: a place
      // with 3 kickers had its array LENGTHENED back to the old 8, which in
      // JavaScript fills the gap with holes, and `setKickers` sorted five
      // `undefined`s to the end of the list. `kickerAt` then read `.p` off one
      // of them on the first height query of the frame, so `terrain.height`
      // threw for every caller -- the physics, the mesh and the scatter at once.
      this._lap0Kickers = this.kickers.length;
      this.terrain.setKickers(this.kickers);
    }
  }

  /**
   * The second lobby screen.
   *
   * The mode is remembered rather than started, so the back ladder has
   * somewhere to return to and `restart` still knows what to restart.
   */
  _toPlaces(modeId) {
    this._pendingMode = modeId ?? this._modeId ?? defaultModeId();
    const m = getMode(this._pendingMode);
    this.hud.setPlaceFor(m.explainer ?? m.routeName ?? 'route');
    // THE GAME'S OWN STATE TOO, not just the HUD's. `setScreen` moves what is
    // drawn; `this.state` is what `_back`, `_loop` and the attract mode all
    // branch on. Setting only the first left the game believing it was still on
    // the title -- the screen changed and the back ladder did not.
    this.state = 'place';
    this.hud.setScreen('place');
    this.host.haptic('select');
  }

  async _beginRun(modeId, placeId) {
    // NOT A BARE AWAIT. `AudioContext.resume()` is an external promise, and in
    // a WebView it can reject or simply never settle when the context was
    // never blessed by a gesture the view recognises -- and every line below
    // is the run itself, so the run would never start. Same freeze as
    // BAL-591, one step earlier. Unblocked after 1.5s; the audio catches up
    // on its own when the context does come back.
    await this._audioReady();
    // Resolved BEFORE the reset, and the outgoing mode stopped exactly once, so
    // nothing it placed can survive into a run of a different mode.
    this._mode?.stop?.();
    const def = getMode(modeId ?? this._modeId ?? defaultModeId());
    this._modeId = def.id;
    /**
     * THE REGISTERED DEFINITION, kept beside the instance.
     *
     * A mode has two halves and they are easy to confuse: `def` is the
     * registered record -- `camera`, `music`, `order`, `hidesScore`, `skirt`,
     * `showsStartLine` -- and `this._mode` is what `create()` returned, which
     * owns the run's behaviour and its per-run state.
     *
     * Reading a definition key off the instance gives `undefined` and fails
     * SILENTLY, which has now cost three separate bugs: the score overwriting
     * the place readout, chill vibe reporting a course offset of 0, and the
     * start line refusing to go away. Holding the definition explicitly is what
     * stops the fourth.
     */
    this._modeDef = def;
    this._mode = def.create(this);
    // WHERE IN THE TRACK THE RUN STARTS. Both tracks open with an intro before
    // anything you could call a beat, and a race is only two and a half minutes
    // — spending the opening of it waiting for the music wastes a real fraction
    // of the mode.
    //
    // THE RUN CLOCK IS THE TRACK CLOCK, deliberately: `audio.time` simply starts
    // at this value instead of zero, so the beat grid, the gate plan, the mood
    // arc and the scheduler all continue to agree without an offset term
    // anywhere. `_seekTo`'s existing fast-forward drops the gates whose beats
    // are already behind, which is the right behaviour and was already there
    // for debug seeks.
    this._musicStart = def.musicStart ?? 0;
    // A DIFFERENT STRETCH OF MOUNTAIN PER RUN, if the mode wants one. See
    // `_seekTo`. Asked once per run rather than read as a constant, because the
    // whole point is that it is not the same twice.
    // THE PLACE DECIDES THE REGION; THE MODE DECIDES HOW IT SITS IN IT.
    // The race wants a different hundred metres every time for replayability;
    // chill vibe is scored and compared across runs, so it needs the SAME
    // mountain every time or the best score means nothing. Handing the place to
    // the mode lets both be true -- see `courseOffset` in each.
    this._place = getPlace(placeId ?? this._placeId ?? defaultPlaceId());
    this._placeId = this._place.id;
    this._applyPlace(this._place);
    this._courseOffset = this._mode.courseOffset?.(this._place) ?? 0;
    this._applyModeConfig(def);
    // The placing moved to centre stage (see Hud.setPlace), so the race's left
    // column has nothing left to say and hides whole; chill keeps its score.
    // ON THE DEFINITION, NOT THE INSTANCE. `hidesScore` is declared on the
    // registered mode; `this._mode` is what `create()` returned and has never
    // carried it. Reading it off the instance gave `undefined`, so the score
    // kept being written over the place every frame — the readout said "place"
    // and then showed 194.
    this._hidesScore = !!def.hidesScore;
    this.hud.setScoreVisible(!this._hidesScore);
    this.hud.setPlace(this._hidesScore ? '—' : null);
    this.hud.setSoloStat(false);
    this._resetRunState();
    this.audio.stop();
    this.audio.setClarity(1);
    this._seekTo(this._musicStart);

    this.hud.setScore(0);
    this.hud.setCombo(1);
    this.hud.setClock(this._readout());
    this.hud.setProgress(0);
    this.hud.setLive(false);

    // ── THE WORLD IS DRESSED BEFORE THE COUNTDOWN, NOT AFTER ────────────
    // This used to run in the callback below, guarded by a comment about
    // attract mode placing things against a run that had not started. That was
    // wrong: `_updateIdle` only runs while the state is `title`, and during the
    // countdown the state is `count`, so NEITHER update runs and the world is
    // frozen exactly where `_seekTo` left it. Nothing could drift.
    //
    // What it cost was real, though: the trees, the finish line and the gates
    // all arrived on the frame the countdown ended, so a race began with the
    // course appearing out of nowhere — "curentyly they popup once the
    // countdown finishes". Placed here they are simply there to look at while
    // the numbers count down, which is what a start line is for.
    this._mode.start?.();
    this._dressCourse();
    // Painted where the rider is standing RIGHT NOW, which is after `_seekTo`
    // has put them at the mode's own starting distance -- the race picks a
    // random one for replayability, so this cannot be a constant. Placed with
    // the rest of the dressing so it is there to look at during the countdown
    // rather than appearing on the frame the run begins.
    // THE START LINE IS THE RACE'S, not the game's. A line you cross once and
    // never return to is furniture for a mode that has a finish; in an endless
    // descent it is a chequered band announcing the start of nothing. Asked for
    // directly: "I don't want the starting line graphics on this mode."
    if (this._modeDef.showsStartLine !== false) this.startLine.place(this.terrain, this.rider.p);
    else this.startLine.hide();

    // ── COMPILE THE COURSE BEFORE THE RUN, NOT DURING IT ──────────────────
    // Reported as "a new bug of flickering black". Reproduced and bisected:
    // the FIRST race of a page load renders black for the opening ~1.5 s and
    // every race after it is clean (measured mean frame luma 0.0 then 155 on
    // race one, 153 immediately on race two). Chill vibe never does it.
    //
    // Which rules out the two obvious suspects. It is not the random course
    // offset -- forcing 0, 5000, 20000 and 40000 m into a chill run all render
    // normally. It is not the resolution scaler -- that already runs at the top
    // of the frame and is refilled before the same frame's render.
    //
    // It is first-use MATERIAL COMPILATION. The race is the only thing that
    // brings in the boost gate's material, the finish line's banner and the
    // start line, and a material compiles on the frame it is first drawn. That
    // frame is the first frame of the run, and on a slow driver it overruns the
    // compositor and the cleared buffer is what reaches the screen.
    //
    // `compile` walks the scene and builds every program up front. It is done
    // HERE, after the dressing is placed and before the countdown starts, so
    // the cost lands on three seconds of static numbers instead of on the first
    // frame anyone is riding.
    this.renderer.compile(this.scene, this.camera);

    // AND THE OUTGOING TRACK GOES DOWN UNDER THE COUNTDOWN.
    //
    // This is for a RESTART, not for the title. Measured: at the title
    // `audio.playing` is false and nothing is scheduled -- the bus sits at 0.70
    // with no sources on it, which is why sampling the gain there looked like
    // music at full volume and was not. `fadeOut` no-ops in that case.
    //
    // Where it earns its place is restarting from the pause menu, where the
    // previous run's track IS playing and `start` would otherwise open with
    // `stop()` -- which severs a buffer source mid-sample, a click, exactly as
    // `fadeOut`'s own note says. Three seconds of countdown is room for both
    // halves: the old one gone by the second number, the new one arriving under
    // the last.
    this.audio.fadeOut(0.9);
    // BAL-584: the board-setup screen holds the run here, and only here. A
    // resume from the pause menu is not a new run and keeps its bare
    // countdown -- being asked how your board is standing every time you come
    // back from a menu would be an interrogation, not an explanation.
    this._askStance(() => this._startCountdown(3, () => {
      this.audio.start(this._musicStart, MUSIC_FADE_IN);
      this.state = 'play';
      this.hud.setScreen(null);
      this.hud.setLive(true);
    }));
  }

  /**
   * Adopt a stance: the input layer, the picture and the stored preference.
   *
   * The input layer is the authority -- `this.input.stance` is what steering
   * actually reads -- so it is set first and the screen is painted FROM it
   * rather than from the value passed in. A stance that failed to apply must
   * not be able to show as applied; that is the same rule the max tilt row
   * follows about the pipeline.
   */
  _setStance(deg) {
    if (!STANCES_ENABLED) return;
    this.input.stance = stanceFor(deg).deg;
    store.set('carve.stance', this.input.stance);
    analytics.settingChanged('board_stance', this.input.stance);
    this._paintStance();
  }

  _paintStance() {
    const st = stanceFor(this.input.stance);
    const board = document.getElementById('stanceBoard');
    if (board) board.dataset.deg = String(st.deg);
  }

  /** Hold the run on the board-setup screen; `ok` calls `then`. */
  _askStance(then) {
    this._stanceThen = then;
    this._paintStance();
    this.state = 'stance';
    this.hud.setScreen('stance');
  }

  /**
   * THE STALL WATCHDOG: the game says when it has stopped.
   *
   * On a board session, and inside the Editor's WebView, the console is the
   * only channel out -- and a game whose frame loop has stopped cannot report
   * anything from inside that loop. So this rides a TIMER instead, which is a
   * different clock: `setInterval` keeps firing when rAF does not, and in the
   * GoBalance WebView rAF is a queue Unity pumps, so the two can diverge
   * completely.
   *
   * It exists because a freeze was reported that left NOTHING in the Editor
   * log -- no error, no line, nothing -- and silence was unreadable: it could
   * equally have meant the JS had died or that nothing happened to log. One
   * line naming the state and the gap tells those two apart immediately, and
   * tells us whether the loop stopped at all, which is the first fork in the
   * diagnosis and the one we could not take.
   *
   * Quiet unless something is wrong: it says one line when frames stop and
   * one when they come back.
   */
  _watchFrames() {
    const GAP_MS = 2500;         // longer than any legitimate hitch
    let lastFrame = -1;
    let lastSeen = performance.now();
    let stalled = false;
    setInterval(() => {
      const now = performance.now();
      const moved = this._frameNo !== lastFrame;
      lastFrame = this._frameNo;
      if (moved) {
        if (stalled) {
          stalled = false;
          console.log(`[carve] frames resumed after ${((now - lastSeen) / 1000).toFixed(1)}s`
            + ` — state ${this.state}, screen ${document.body.dataset.state}`);
        }
        lastSeen = now;
        return;
      }
      // Backgrounding legitimately stops rAF; that is not a stall worth
      // shouting about, and the app does it every time it takes the screen.
      if (document.hidden || stalled || now - lastSeen < GAP_MS) return;
      stalled = true;
      console.log(`[carve] STALL — no frame for ${((now - lastSeen) / 1000).toFixed(1)}s.`
        + ` state ${this.state}, screen ${document.body.dataset.state},`
        + ` menu ${this._nav?.top ?? 'none'}, wizard ${document.querySelector('.bcal') ? 'open' : 'no'},`
        + ` visible ${!document.hidden}`);
    }, 1000);
  }

  /**
   * Two viewports, top and bottom, one composer each.
   *
   * The scissor is doing real work, not tidiness: a composer's final pass is a
   * fullscreen quad, so without it the second half would paint over the first.
   * With scissor and viewport set, each chain lands inside its own half and
   * each one's internal targets are already half-height -- which is why the
   * pair costs the same fill as the single chain they replace, and why the
   * real bill for split screen is geometry (the scene is drawn twice), not
   * pixels.
   *
   * Player one takes the TOP half. On a tablet lying on a table between two
   * people that is arbitrary; when it is propped up, top is the better half,
   * and player one is the phone's own board.
   */
  /**
   * Point everything that is drawn RELATIVE TO THE VIEWER at one half's camera
   * and rider, right before that half renders.
   *
   * The frame loop computes all of it once, from player one: the fog distance
   * (uCamPos) and fog floor (uFogBase) on every lit material, the sky dome and
   * the ranges that ride along with the eye, the snow box that wraps around it.
   * Player two shared that, so the further back they fell the more of their
   * world was "far from the camera" -- they rode into a wall of fog a minute
   * in, and saw no snow and a sky centred on somebody else.
   *
   * Uniforms are read at draw time, so setting them between the two renders is
   * enough; the next frame's loop sets them for player one again before the top
   * half draws.
   */
  _aimWorldAt(cam, rider) {
    if (!cam || !rider) return;
    const fogBase = this.terrain.baseHeight(rider.p) - 40;
    const mu = this.mountain.material.uniforms;
    mu.uCamPos.value.copy(cam.position);
    mu.uFogBase.value = fogBase;
    // ── AND THE SECOND RING, WHICH IS THE WHOLE BLACKS BUG ────────────────
    // The mountain shader's faceted normals are derivatives of a
    // CAMERA-RELATIVE varying, because an absolute one loses its derivatives
    // past |p| ~ 16384 and whole triangles render pure black. That rebasing
    // is only correct if uCamPos is the camera actually drawing -- and this
    // function existed to keep that true per half, while the leader's ring
    // (added for the fog gap) was left out of it. Its uCamPos stayed
    // whatever the frame loop set, the LEADER's camera, so the trailing
    // player's half differentiated against a camera up to a kilometre away.
    // Shards in one half, growing with the gap.
    if (this.mountain2) {
      const m2 = this.mountain2.material.uniforms;
      m2.uCamPos.value.copy(cam.position);
      m2.uFogBase.value = fogBase;
    }
    updateLitCommon(this.litMaterials, cam.position, fogBase, mu.uSunFloor.value, mu.uSunFlat.value);
    updateLitCommon(this.rivals.materials, cam.position, fogBase, mu.uSunFloor.value, mu.uSunFlat.value);
    for (const t of [this.trail, this.trail2]) {
      if (!t) continue;
      t.material.uniforms.uCamPos.value.copy(cam.position);
      t.material.uniforms.uFogBase.value = fogBase;
    }
    this.sky.mesh.position.copy(cam.position);
    this.range.update(cam.position);
    // The flakes wrap around player one's camera in absolute space. Shifting
    // the whole cloud by the gap between the cameras puts the same box around
    // player two without simulating a second one; zero for the top half.
    this.snowfall.points.position.subVectors(cam.position, this.camera.position);
  }

  _renderSplit() {
    const r = this.renderer;
    const size = r.getSize(this._sizeTmp ?? (this._sizeTmp = new THREE.Vector2()));
    const w = size.x;
    const half = Math.floor(size.y / 2);
    r.setScissorTest(true);
    // WebGL's origin is bottom-left, so the TOP half is the upper y range.
    r.setViewport(0, half, w, size.y - half);
    r.setScissor(0, half, w, size.y - half);
    this._aimWorldAt(this.camera, this.rider);
    this.post.render();
    r.setViewport(0, 0, w, half);
    r.setScissor(0, 0, w, half);
    this._aimWorldAt(this.camera2, this.rider2);
    this.post2.render();
    r.setScissorTest(false);
    r.setViewport(0, 0, w, size.y);
  }

  /**
   * The finished player's panel: where they came, and a way to stop waiting.
   *
   * Appears once and STAYS, rather than timing out -- Skateboard Extreme's
   * finding, which Elad chose there: boredom arrives about twenty seconds
   * after the moment, not at it. The explanation line is not decoration: with
   * only a button, ending the race looks strictly better than waiting, and
   * someone ends a race whose result they have not seen yet.
   */
  /**
   * Who won, written where everyone looks at the end of a race.
   *
   * A race whose result is only a number on one player's card is not a race
   * either of them watched. Both are named -- from the roster when there is
   * one -- and a player who never reached the line is said to have not
   * finished rather than quietly given second place, which would read as
   * though they had been beaten by a length.
   */
  _paintResults2p() {
    const panel = this._el('r2p');
    if (!panel) return;
    if (!this.rider2) { panel.hidden = true; return; }
    const [n1, n2] = this._playerNames();
    const set = (id, text) => {
      const el = this._el(id);
      if (el && el.textContent !== text) el.textContent = text;
    };
    // The time AT THE LINE (race.js stamps it there) -- the RUN_OUT seconds
    // of coasting afterwards are not part of the race.
    const fmt = (t) => {
      if (t == null) return '\u2014';
      const mm = Math.floor(t / 60);
      const ss = t - mm * 60;
      return `${mm}:${ss < 10 ? '0' : ''}${ss.toFixed(1)}`;
    };
    const winner = this.p1Place === 1 ? n1 : n2;
    const loser = this.p1Place === 1 ? n2 : n1;
    set('r2pWin', `${winner} wins`);
    // How it ended matters to the loser: beaten on the line is a race,
    // called early is a decision, and the screen says which.
    const called = this._mode?.endedBy?.() === 'called';
    set('r2pHow', called
      ? `${winner} called the race while ${loser} was still riding`
      : 'decided on the line');
    const card = (i, name, place, t, topMs, finished, toGo) => {
      set(`r2pAv${i}`, initials(name));
      set(`r2pName${i}`, name);
      set(`r2pPlace${i}`, place === 1 ? '1st' : '2nd');
      // ── WHAT A RIDER WHO NEVER REACHED THE LINE GETS (BAL-622) ─────────
      // "dnf" was a racing abbreviation on a screen a child reads: QA's
      // testers did not know what it meant, and it tells the one person who
      // was still riding nothing about the run they just had. The distance
      // they had left does -- it is the number they were already watching
      // top-right, and it says how close they came.
      //
      // Frozen when the winner tapped, not measured now: see `callIt` in
      // race.js. The fallback recomputes it, so a path that forgets to
      // snapshot still shows a distance rather than a dash.
      const left = toGo ?? Math.max(0, (this.finishP ?? 0) - (i === 1 ? this.rider : this.rider2).p);
      set(`r2pTime${i}`, finished ? fmt(t) : toFinishText(left));
      set(`r2pTimeLbl${i}`, finished ? 'time' : 'to the finish');
      set(`r2pTop${i}`, String(Math.round((topMs ?? 0) * 3.6)));
      this._el(`r2pCard${i}`)?.classList.toggle('is-win', place === 1);
    };
    card(1, n1, this.p1Place, this.p1FinishT, this.stats.top, this.p1Finished, this.p1ToGo);
    card(2, n2, this.p2Place, this.p2FinishT, this._top2, this.p2Finished, this.p2ToGo);
    panel.hidden = false;
  }

  /**
   * The per-camera chrome, one set per half -- the reference frame's overlay:
   * the identity row (avatar initials, place over name, speed with its
   * segmented bar), the big place | kilometres COVERED at the top centre, and
   * TO FINISH at the top right. Fed from the same _playerNames and
   * p1Place/p2Place the rest of the HUD reads, so nothing here can say
   * something the race does not.
   */
  _paintHalves() {
    // Two-player fills both halves; a single-player RACE fills half 1 only --
    // the same hero speed block, bottom-left, against the rival field's
    // placings (Elad, 2026-10-14: "bring the speed ui back to the 1 player
    // competition mode"). Chill keeps its quiet bottom bar: no rivals, no row.
    const twoP = !!this.rider2;
    if (!twoP && !this.rivals?.field.length) return;
    this._syncPlayerColors();
    const set = (id, text) => {
      const el = this._el(id);
      if (el && el.textContent !== text) el.textContent = text;
    };
    const ORD = ['', '1st', '2nd', '3rd', '4th', '5th'];
    const half = (i, rider, name, place, finished) => {
      set(`wallAv${i}`, initials(name));
      set(`wallName${i}`, name);
      set(`htPlace${i}`, ORD[place] ?? '\u2014');
      // ONE distance, the one a racer steers by. Covered metres and a
      // per-half gap were painted here for a day and cut on sight: three
      // numbers up top answered questions nobody mid-race was asking, and
      // the sidebar already owns the gap.
      const togo = Math.max(0, (this.finishP ?? 0) - rider.p);
      set(`htFin${i}`, finished ? 'finish' : toFinishText(togo));
      // The speed, and its ten segments out of the rider's own ceiling.
      set(`idSpeed${i}`, String(Math.round(rider.speed * 3.6)));
      const bar = this._el(`speedBar${i}`);
      if (bar) {
        const segs = bar.children;
        const on = Math.round(Math.max(0, Math.min(1, rider.speed / TUNE.maxSpeed)) * segs.length);
        for (let k = 0; k < segs.length; k++) segs[k].classList.toggle('on', k < on);
      }
    };
    if (twoP) {
      const [n1, n2] = this._playerNames();
      half(1, this.rider, n1, this.p1Place, this.p1Finished);
      half(2, this.rider2, n2, this.p2Place, this.p2Finished);
    } else {
      // Solo: the roster's main profile when the app sent one, else YOU --
      // the 2p simulated-name fallback is a demo pair, wrong for a solo run.
      const r = this.host.roster;
      const main = Array.isArray(r) && r.length
        ? (r.find((q) => q.isMain) ?? r[0])?.name : null;
      half(1, this.rider, main || 'YOU', this.rivals.placeOf(this.rider.p), false);
    }
  }

  /**
   * The sidebar -- the reference frame's left rail. Shown while a race is
   * LIVE at any player count (the single-player field race included, Elad's
   * ask), hidden everywhere else; `has-sb` on the body is what the rest of
   * the HUD keys its race layout off.
   *
   * Carries the course name, the race clock, the GAP, and the course map:
   * the course's own bending line (terrain.centerX sampled once per race),
   * START / CP1-3 / FINISH markers on it, and a dot per racer -- with 1P/2P
   * pills in two-player, the reference's tags. The screen shows the two
   * seconds of mountain around you; this is the only place the SHAPE of the
   * race exists.
   */
  /**
   * BAL-611: each player's name, centred in their own half, during the
   * countdown.
   *
   * ON THE FRAME LOOP, NOT IN _paintHalves. That one is called from
   * _updatePlay, which only runs once the state is `play` -- so a label whose
   * entire job is to be read BEFORE the race starts would have been empty for
   * every frame it was visible, showing the markup's "P1"/"P2" placeholders.
   * Caught by measuring the rendered text rather than trusting the wiring.
   *
   * Written only on change, and the whole thing is skipped unless there are
   * two riders, so a solo run never touches it.
   */
  _paintCountNames() {
    if (!this.rider2) return;
    const [n1, n2] = this._playerNames();
    const set = (id, text) => {
      const el = this._el(id);
      if (el && el.textContent !== text) el.textContent = text;
    };
    set('countName1', n1);
    set('countName2', n2);
    set('countAv1', initials(n1));
    set('countAv2', initials(n2));
  }

  /**
   * THE LENS LOOKS AT THE PART OF THE SCREEN YOU CAN SEE.
   *
   * The rail is an overlay on a full-width canvas, so the camera was centring
   * the rider in the whole VIEWPORT while the player only sees what is right
   * of the rail. Measured at 1100x620 with a 187px rail: the rider landed
   * 119px left of the centre of the visible picture. Elad: "it's like you're
   * hiding the left side of the screen... we should change the position so
   * the character will be in the center of the new screen."
   *
   * setViewOffset rather than moving the camera: shifting the camera sideways
   * would change the ANGLE on the mountain and the parallax with it. This
   * leaves the camera exactly where it is and slides the frustum's principal
   * point by half the rail, so the picture is the same picture, re-centred.
   *
   * Only while the rail is up -- which is the race, in both modes. Chill has
   * no map and already centres correctly; its offset is cleared, not left
   * stale from the last race.
   */
  _aimLens(railW) {
    if (this._lensRail === railW) return;
    this._lensRail = railW;
    const w = window.innerWidth;
    const vh = TWO_PLAYER ? window.innerHeight / 2 : window.innerHeight;
    for (const cam of [this.camera, this.camera2]) {
      if (!cam) continue;
      // Both halves sit beside the same rail, so both get the same shift.
      if (railW > 0) cam.setViewOffset(w, vh, -railW / 2, 0, w, vh);
      else cam.clearViewOffset();
    }
  }

  _paintSidebar() {
    const bar = this._el('sideBar');
    if (!bar) return;
    // NOT WHILE A MENU PANEL IS UP. The pause state is a racing state (the
    // course is still the course), but the pause/settings screens cover the
    // frame, and the chrome painted over them -- Elad's screenshot, caught by
    // spamming settings/pause, even had the lobby up mid-run with the green
    // fade and the identity rows across it. ui.isMenu is the screens system's
    // own answer to "is a panel showing", so every panel a menu-nav race can
    // land on hides the chrome, not just the ones we can name.
    const racing = this._modeId === 'race' && this.finishP != null
      && (this.state === 'play' || this.state === 'count' || this.state === 'pause')
      && !this.hud.ui.isMenu;
    document.body.classList.toggle('has-sb', racing);
    if (!racing) {
      if (!bar.hidden) bar.hidden = true;
      this._aimLens(0);
      this._lensOn = false;
      return;
    }
    if (bar.hidden) bar.hidden = false;
    // Measured off the element, not recomputed from --sb-w and the safe
    // inset: the rail's width is a CSS expression and the element is the only
    // thing that knows what it resolved to. Read only when it can have
    // changed -- the rail appearing, or a resize -- never per frame.
    if (!this._lensOn || this._lensDirty) {
      this._lensOn = true;
      this._lensDirty = false;
      this._aimLens(bar.getBoundingClientRect().width);
    }
    const set = (id, text) => {
      const el = this._el(id);
      if (el && el.textContent !== text) el.textContent = text;
    };
    set('sbCourse', this._place?.name ?? 'the mountain');
    // The race clock, in the reference's shape: minutes, seconds, hundredths.
    const t = Math.max(0, this.runTime);
    set('sbTime', `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`);
    // THE GAP: the metres between first and second over the chaser's own
    // downhill rate -- the seconds the chaser needs to close it. In
    // single-player it is MY gap: to the leader when trailing (+, red), to
    // the runner-up when leading (-, green).
    const rate = Math.max(7, this.rider.speed * 0.92);
    const secs = (m) => `${Math.min(99, m / rate).toFixed(2)}s`;
    let gapText = '\u2014';
    if (this.rider2) {
      gapText = `+${secs(Math.abs(this.rider.p - this.rider2.p))}`;
    } else {
      let ahead = null; let behind = null;
      for (const r of this.rivals?.field ?? []) {
        if (r.p > this.rider.p) ahead = Math.max(ahead ?? -Infinity, r.p);
        else behind = Math.max(behind ?? -Infinity, r.p);
      }
      if (ahead != null) gapText = `+${secs(ahead - this.rider.p)}`;
      else if (behind != null) gapText = `-${secs(this.rider.p - behind)}`;
    }
    const gapEl = this._el('sbGap');
    if (gapEl) {
      if (gapEl.textContent !== gapText) gapEl.textContent = gapText;
      const c = gapText.startsWith('-') ? '#6dff9e' : '#ff5868';
      if (gapEl.style.color !== c) gapEl.style.color = c;
    }
    // ── the map ──────────────────────────────────────────────────────────
    // The path's 0-100 space lands in the svg, which spans 46% of the map
    // box (the labels own the rest), so everything positioned in the BOX's
    // percent space scales by 0.46.
    const SVG_W = 0.46;
    const startP = this.finishP - RACE_LENGTH;
    const map = this._el('sbMap');
    if (this._mapShape?.startP !== startP) {
      const N = 48;
      const xs = [];
      let x0 = Infinity;
      let x1 = -Infinity;
      for (let i = 0; i <= N; i++) {
        const x = this.terrain.centerX(-(startP + (i / N) * RACE_LENGTH));
        xs.push(x);
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
      const span = Math.max(1e-6, x1 - x0);
      const nx = (x) => 12 + 76 * ((x - x0) / span);
      const d = xs.map((x, i) =>
        `${i ? 'L' : 'M'}${nx(x).toFixed(1)} ${(100 - (i / N) * 100).toFixed(1)}`).join(' ');
      this._el('sbPath')?.setAttribute('d', d);
      // The rail's markers: start, the three quarter checkpoints, finish.
      for (const m of map.querySelectorAll('.sb-mark')) m.remove();
      const km = (m) => `${(m / 1000).toFixed(1)}km`;
      const marks = [
        [1, 'sb-finish', 'finish', km(RACE_LENGTH)],
        [0.75, '', 'cp 3', km(RACE_LENGTH * 0.75)],
        [0.5, '', 'cp 2', km(RACE_LENGTH * 0.5)],
        [0.25, '', 'cp 1', km(RACE_LENGTH * 0.25)],
        [0, 'sb-start', 'start', km(0)],
      ];
      for (const [f, cls, name, dist] of marks) {
        const el = document.createElement('div');
        el.className = `sb-mark ${cls}`.trim();
        // 0 = start, 1-3 = the quarter checkpoints, 4 = finish. BAL-612 needs
        // to find one mark by the checkpoint a rider just crossed.
        el.dataset.cp = String(Math.round(f * 4));
        el.style.top = `${(1 - f) * 100}%`;
        const ring = document.createElement('i');
        ring.style.left = `${(nx(xs[Math.round(f * N)]) * SVG_W).toFixed(2)}%`;
        const lbl = document.createElement('b');
        lbl.innerHTML = `${name}<em>${dist}</em>`;
        el.append(ring, lbl);
        map.appendChild(el);
      }
      map.dataset.cast = '';
      // The marks were just rebuilt, so the crossings belong to a race that no
      // longer exists -- without this the first checkpoint of race two never
      // pulses, because the counter still remembers race one.
      this._cpSeen = {};
      this._mapShape = { startP, nx };
    }
    const frac = (p) => Math.max(0, Math.min(1, (p - startP) / RACE_LENGTH));
    const alongX = (p) => this._mapShape.nx(this.terrain.centerX(-p)) * SVG_W;
    const hexc = (n) => `#${n.toString(16).padStart(6, '0')}`;
    let cast;
    if (this.rider2) {
      // 1P's pill sits right of the line, 2P's left -- the reference's
      // arrangement, and the two can never cover each other.
      const [n1, n2] = this._playerNames();
      const ini = (n) => n.split(/\s+/).map((w) => w[0]).filter(Boolean)
        .slice(0, 2).join('').toUpperCase();
      cast = [
        { key: '1P', color: hexc(this._tints[0]), p: this.rider.p, tag: ini(n1), side: 'r' },
        { key: '2P', color: hexc(this._tints[1]), p: this.rider2.p, tag: ini(n2), side: 'l' },
      ];
    } else {
      cast = [{ key: 'me', color: '#ffffff', p: this.rider.p, me: true }];
      for (const r of this.rivals?.field ?? []) {
        cast.push({ key: r.name, color: hexc(r.colour), p: r.p });
      }
    }
    // ── BAL-612: THE CHECKPOINT PULSES WHEN SOMEBODY CROSSES IT ───────────
    // Elad's rules, verbatim: "on single player - only the player - not AI",
    // "on two players - once for each player". So a checkpoint can fire twice
    // in a two-player race, once in each player's colour, and the rival field
    // never fires it at all -- a map that flashed four times for riders you
    // are not would be noise, not information.
    //
    // Driven off the same `frac` the dots are placed with, so the pulse and
    // the dot can never disagree about where a rider is.
    this._cpSeen = this._cpSeen ?? {};
    for (const c of cast) {
      if (!this.rider2 && !c.me) continue;        // solo: the player, never the AI
      const f = frac(c.p);
      const n = [0.25, 0.5, 0.75, 1].filter((t) => f >= t).length;
      const was = this._cpSeen[c.key] ?? 0;
      if (n > was) {
        const mark = map.querySelector(`.sb-mark[data-cp="${n}"]`);
        if (mark) {
          mark.style.setProperty('--pulse-c', c.color);
          // Restart only when it is actually running: the same mark can be
          // pulsed again by the other player before the first animation has
          // finished, and a class that is already present does not replay on
          // its own. Guarded, because classList.remove rewrites the attribute
          // even when the class is absent -- a wasted mutation on every first
          // pulse, and one that makes the DOM look like it fired twice.
          if (mark.classList.contains('sb-pulse')) {
            mark.classList.remove('sb-pulse');
            void mark.offsetWidth;
          }
          mark.classList.add('sb-pulse');
        }
      }
      this._cpSeen[c.key] = n;
    }

    const castKey = cast.map((c) => c.key + c.color + (c.tag ?? '')).join(',');
    if (map.dataset.cast !== castKey) {
      for (const d of map.querySelectorAll('.sb-dot, .sb-tag')) d.remove();
      for (const c of cast) {
        const d = document.createElement('i');
        d.className = 'sb-dot' + (c.me ? ' is-me' : '');
        d.style.background = c.color;
        map.appendChild(d);
        if (c.tag) {
          const tg = document.createElement('b');
          tg.className = 'sb-tag' + (c.side === 'r' ? ' on-r' : '');
          tg.style.setProperty('--tag-c', c.color);
          tg.textContent = c.tag;
          map.appendChild(tg);
        }
      }
      map.dataset.cast = castKey;
    }
    const dots = map.querySelectorAll('.sb-dot');
    const tags = map.querySelectorAll('.sb-tag');
    let ti = 0;
    for (let i = 0; i < cast.length; i++) {
      const pp = Math.max(startP, Math.min(this.finishP, cast[i].p));
      const top = `${((1 - frac(pp)) * 100).toFixed(2)}%`;
      const left = `${alongX(pp).toFixed(2)}%`;
      dots[i].style.top = top;
      dots[i].style.left = left;
      if (cast[i].tag) {
        tags[ti].style.top = top;
        tags[ti].style.left = left;
        ti++;
      }
    }
  }

  /**
   * The overhead bubbles -- the reference's "EM"/"TC" badges: a tag in the
   * racer's colour floating over every OTHER racer visible in your camera.
   * In two-player each half tags the other player (your own back needs no
   * label); in the single-player field race the four rivals carry their
   * names. DOM elements projected from the 3D heads each frame, rebuilt only
   * when the cast changes -- same pattern as the map dots.
   */
  _paintRiderTags() {
    const wrap = this._el('riderTags');
    if (!wrap) return;
    const live = (this.state === 'play' || this.state === 'count' || this.state === 'pause')
      && !this.hud.ui.isMenu;  // no badges floating over a menu panel
    const w = window.innerWidth;
    const h = window.innerHeight;
    const hexc = (n) => `#${n.toString(16).padStart(6, '0')}`;
    const cast = [];
    if (live && this.rider2) {
      const [n1, n2] = this._playerNames();
      const ini = (n) => n.split(/\s+/).map((x) => x[0]).filter(Boolean)
        .slice(0, 2).join('').toUpperCase();
      cast.push({ key: 'p2', text: ini(n2), color: hexc(this._tints[1]),
        node: this.rider2.group, cam: this.camera, y0: 0, hh: h / 2,
        p: this.rider2.p, ref: this.rider.p });
      cast.push({ key: 'p1', text: ini(n1), color: hexc(this._tints[0]),
        node: this.rider.group, cam: this.camera2, y0: h / 2, hh: h / 2,
        p: this.rider.p, ref: this.rider2.p });
    } else if (live && this._modeId === 'race') {
      for (const r of this.rivals?.field ?? []) {
        cast.push({ key: r.name, text: r.name, color: hexc(r.colour),
          node: r.holder, cam: this.camera, y0: 0, hh: h,
          p: r.p, ref: this.rider.p });
      }
    }
    const castKey = cast.map((c) => c.key).join(',');
    if (wrap.dataset.cast !== castKey) {
      wrap.textContent = '';
      for (const c of cast) {
        const el = document.createElement('div');
        el.className = 'rider-tag';
        el.style.setProperty('--tag-c', c.color);
        el.textContent = c.text;
        el.style.display = 'none';
        wrap.appendChild(el);
      }
      wrap.dataset.cast = castKey;
    }
    if (!cast.length) return;
    const v = this._tagV ?? (this._tagV = new THREE.Vector3());
    const els = wrap.children;
    for (let i = 0; i < cast.length; i++) {
      const c = cast[i];
      const el = els[i];
      // Beyond ~350 m the rider is a speck in the fog, and a badge floating
      // over nothing reads as a glitch.
      if (!c.cam || !c.node || Math.abs(c.p - c.ref) > 350) {
        if (el.style.display !== 'none') el.style.display = 'none';
        continue;
      }
      v.setFromMatrixPosition(c.node.matrixWorld);
      v.y += 2.2;
      v.project(c.cam);
      // Behind the lens or outside the frame: no badge. The projection uses
      // last render's matrices, which is one frame stale and invisible.
      const vis = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.02 && Math.abs(v.y) < 1.05;
      if (!vis) {
        if (el.style.display !== 'none') el.style.display = 'none';
        continue;
      }
      const x = ((v.x + 1) / 2) * w;
      const y = c.y0 + (1 - (v.y + 1) / 2) * c.hh;
      if (el.style.display !== '') el.style.display = '';
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  _paintFinished() {
    if (!this.rider2) return;
    const show = (panel, line, finished, place, otherName) => {
      if (!panel) return;
      const want = !finished;
      if (panel.hidden !== want) panel.hidden = want;
      if (!finished) return;
      const ord = place === 1 ? 'first' : 'second';
      const text = `You came ${ord}. ${otherName} is still riding — wait and watch, or end the race now!`;
      if (line && line.textContent !== text) line.textContent = text;
    };
    const names = this._playerNames();
    show(this._el('donePanel1'), this._el('doneLine1'),
      this.p1Finished && !this.p2Finished, this.p1Place, names[1]);
    show(this._el('donePanel2'), this._el('doneLine2'),
      this.p2Finished && !this.p1Finished, this.p2Place, names[0]);
  }

  /** Cached element lookup -- this runs every frame. */
  _el(id) {
    this._els = this._els ?? new Map();
    if (!this._els.has(id)) this._els.set(id, document.getElementById(id));
    return this._els.get(id);
  }

  /**
   * What to call each player.
   *
   * From the HOST'S ROSTER when there is one, because the app already knows
   * who is on which board and inventing "Player 2" beside their real name
   * would be worse than useless. Falls back to the generic pair in a browser,
   * where there is no roster to ask.
   */
  /**
   * The pair's colours: the roster's, when the app sent one, else the
   * platform palette by slot (red, then turquoise -- the session-fixed
   * colours every multiplayer surface in the app shares). Applied to the
   * riders' garments and the --p1/--p2 custom props the chrome reads;
   * re-checked per frame from _paintHalves, so a roster that arrives after
   * the run started still lands. Cheap: one string compare when nothing
   * changed.
   */
  _syncPlayerColors() {
    if (!this.rider2) return;
    // ── THE TWO PLAYERS ARE ALWAYS RED AND TEAL ───────────────────────────
    // THIS REVERSES "the app is the source of truth". The roster's own colour
    // used to win, and in the Editor the app sends green and red -- so player
    // one was green in a game whose entire chrome is built around red for
    // player one and teal for player two: the half tints, the avatars, the
    // speed gauge, the map dots and both riders' garments.
    //
    // Elad, playing it in Unity, 2026-10-19: "the default colors of the
    // players ui is green and red. it should be allways: player 1 - red,
    // player 2 - teal."
    //
    // A roster colour is per-session and belongs to the app's own lobby. In a
    // split screen the colour is not decoration -- it is which half is yours
    // -- so it has to be the same every time somebody plays, not whatever the
    // pairing screen happened to hand out. The roster's NAME is still
    // authoritative; only the colour is pinned (see _playerNames).
    const tints = [PLAYER_COLORS[0], PLAYER_COLORS[1]];
    const key = tints.join(',');
    if (this._tintKey === key) return;
    this._tintKey = key;
    this._tints = tints;
    this.rider.setProfileColor(tints[0]);
    this.rider2.setProfileColor(tints[1]);
    // The same two colours drive the chrome's tint and the avatars -- one
    // source, so the rider and their chrome can never disagree.
    const css = document.documentElement.style;
    css.setProperty('--p1', `#${tints[0].toString(16).padStart(6, '0')}`);
    css.setProperty('--p2', `#${tints[1].toString(16).padStart(6, '0')}`);
  }

  _playerNames() {
    const r = this.host.roster;
    if (Array.isArray(r) && r.length >= 2) {
      const main = r.find((p) => p.isMain) ?? r[0];
      const other = r.find((p) => p !== main);
      return [main?.name || 'Player 1', other?.name || 'Player 2'];
    }
    // In a plain browser there is no roster to ask, so the pair is SIMULATED
    // with real-shaped names -- one medium, one deliberately long -- because
    // the app's profile creator enforces NO maximum length (the TMP input's
    // m_CharacterLimit is 0 in UserCreateProfile.unity, checked 2026-10-14;
    // the code only requires >= 2 chars). Every layout that carries a name
    // has to survive a long one, and 'Player 2' never tests that.
    if (this.host.transport === 'browser') {
      return ['Maya Shapiro', 'Jonathan-Alexander Goldenberg'];
    }
    return ['Player 1', 'Player 2'];
  }

  /**
   * Player two's physics, driven by slot 1.
   *
   * Deliberately NOT a second copy of the play loop. The course, the gates,
   * the pickups and the clock belong to the world and are stepped once; this
   * advances a rider and its trail, which is everything needed to race. What
   * player two's gates and collisions score is Phase 4's problem, and writing
   * it now would mean writing it twice.
   *
   * A DISCONNECTED BOARD IS FROZEN, NOT STEERED. The app's own angle maths
   * returns a CONSTANT FULL DEFLECTION for a board whose address has stopped
   * resolving -- not zero -- so a player whose board drops would otherwise
   * career off the mountain on a hard edge rather than coasting to a stop.
   * There is no mid-game re-pairing to recover with, so the honest behaviour
   * is to stop reading that slot and let them run straight.
   */
  /**
   * One line a second, in two-player only, saying what player two is getting.
   *
   * Written because a report of "the lower camera is not following the
   * player" could not be told apart from four different causes without it:
   * no second seat arriving at all, a seat arriving but bound to the wrong
   * index, a rider frozen by the disconnect guard, or a genuine camera bug.
   * The camera was measured as fine; everything else lives in these numbers,
   * and in the Editor this is the only channel out.
   */
  _logTwoPlayer() {
    const t = now2();
    if (t - (this._2pLogAt ?? 0) < 1000) return;
    this._2pLogAt = t;
    const seats = Array.isArray(this.host.roster) ? this.host.roster.length : 0;
    const raw = this.host.input(this.input2.slot);
    console.log(`[carve 2p] seats ${seats} | p2 slot ${this.input2.slot}`
      + ` bound ${this._p2Ident ? `${this._p2Ident.name || '(unnamed)'}` : 'none'}`
      + ` stale ${this.input2.stale} lean ${raw.x.toFixed(2)},${raw.y.toFixed(2)}`
      + ` | rider2 p ${this.rider2.p.toFixed(0)}m edge ${this.rider2.edge.toFixed(2)}`
      + ` | rider1 p ${this.rider.p.toFixed(0)}m`);
  }

  _updatePlayerTwo(dt) {
    if (!this.rider2) return;
    this._logTwoPlayer();
    const gone = !this._resolveP2Slot();
    const raw = (gone || this._deadSlot(dt, this.input2)) ? ZERO_LEAN : this.input2.lean;
    this._lean2.x = raw.x;
    this._lean2.y = FORE_AFT_INPUT ? raw.y : 0;
    // Where player two was BEFORE this frame moved them. The course tests a
    // crossing as "was behind the gate, is now past it", so it needs the same
    // pair for player two that `_updatePlay` keeps for player one -- taken
    // here because this is the last moment it is still true.
    this._prev2P = this.rider2.p;
    this._prev2X = this.rider2.x;
    this.rider2.update(dt, this._lean2);
    this.trail2.update(dt, this.rider2, this.terrain);
    // Their fastest moment, for the ending screen's card -- the twin of
    // stats.top, which belongs to player one.
    this._top2 = Math.max(this._top2 ?? 0, this.rider2.speed);
    this._collidePlayerTwo();
  }

  /**
   * A tree or a rock is in EITHER window, so the question is asked of both.
   * A band that is not resident in a window answers null (its collider slot
   * holds some other band's absolute coordinates, which cannot match), so the
   * two probes compose safely whatever the riders' arrangement.
   */
  _hitScatter(x, z) {
    return this.scatter.hitTest(x, z) ?? this.scatter2?.hitTest(x, z) ?? null;
  }

  /**
   * Player two hits what player one hits. Until this, he rode THROUGH the
   * trees -- collisions were tested for player one alone, so the 1v1 gave one
   * player a forest and the other a slalom through ghosts, and his boost
   * chain could never break (race.js keeps a chain per player on exactly
   * this promise).
   *
   * The same three rules as player one, same constants: contact ends the
   * chain and costs half his speed; a stand of trees off the line gets the
   * longer grace; leaving the map entirely is a wipeout plus a hard steer
   * home. What he does NOT get is player one's bookkeeping -- stats.crashes
   * feeds the single-player results panel, combo is a chill-mode currency,
   * and the clock belongs to modes that have one.
   */
  _collidePlayerTwo() {
    const r = this.rider2;
    const hit = r.crashTimer <= 0 && r.invuln <= 0 ? this._hitScatter(r.x, r.z) : null;
    if (hit && !r.airborne) {
      this._mode.breakChain?.(1);
      this._wipeoutTwo();
      if (Math.abs(r.u) > HALF) r.invuln = 2.6;
    }
    if (Math.abs(r.u) > HALF * 1.9 && r.invuln <= 0) {
      this._mode.breakChain?.(1);
      this._wipeoutTwo();
      // Toward home means yaw opposing u -- see player one's block for the
      // sign lesson this copies rather than relearns.
      r.yaw = Math.sign(r.u) * 1.05;
      r.invuln = 3.0;
    }
  }

  /**
   * The boost wake, for one rider.
   *
   * THE DENSITY IS CAPPED BY THE BLOOM, not by taste. At 170/s with a 2.3
   * size in 0x8ff0ff the trail fed the bloom pass hard enough to white out
   * the entire frame -- the mountain, the sky and the rider all went to
   * near-flat pale blue, in the same mood and at the same moment a thinner
   * trail looked right. Additive particles in a scene with a 0.5 to 0.95
   * bloom are a light source, and enough of them are a floodlight. 130/s at
   * 1.9, in a cyan that is deeper than it looks on screen precisely so it can
   * be bright without being white.
   *
   * RATE-BASED, like the carve spray beside it, so the tail looks the same at
   * 30 fps as at 144 and does not thin out on a slow device -- which is why
   * each rider needs an accumulator of ITS OWN: one shared counter would have
   * the two riders stealing each other's fractional particles.
   *
   * In two-player both halves render the same scene, so the wake is visible
   * in whichever camera can see that rider -- no per-half work needed.
   */
  _boostTrail(rider, dt, who) {
    const key = `_boostAcc${who}`;
    if (!(rider.boostT > 0 && this.state === 'play')) { this[key] = 0; return; }
    this[key] = (this[key] ?? 0) + dt * 130;
    const n = Math.floor(this[key]);
    this[key] -= n;
    if (n <= 0) return;
    this._gateBurst.set(0x46cfe8);
    this.particles.emit(rider.world, this._gateBurst, {
      count: Math.min(n, 12),
      speed: 8,
      size: 1.9,
      life: 0.62,
      // Straight back down the line the rider is travelling, with a little
      // lift so the tail hangs rather than burying itself in the snow.
      dir: { x: -rider.heading.x, y: 0.22, z: -rider.heading.z },
      spread: 0.30,
      up: 1.4,
    });
  }

  /**
   * Player two's crash, in player two's half: the hurt vignette and the punch
   * on post2, the kick on his rig, the burst at his board. The speed loss is
   * the real cost, exactly as it is for player one. No text callout -- the
   * callout strip sits in player one's half, and announcing player two's
   * crash there would be the edge-meter mistake again.
   */
  _wipeoutTwo() {
    const r = this.rider2;
    if (r.invuln > 0) return;
    r.crash();
    this.audio.crash();
    this.post2?.hurt(1);
    this.post2?.punch(0.30, new THREE.Color(1, 0.4, 0.45));
    this.cameraRig2?.kick(1.15);
    this.particles.emit(r.world, this.mood.uSnowColor, {
      count: 70, speed: 13, size: 2.0, life: 1.4, up: 5, spread: 1,
    });
  }

  /**
   * A gate answered for PLAYER TWO.
   *
   * Deliberately smaller than player one's branch, and the difference is not
   * laziness. What player two shares with player one is the WORLD: the boost
   * on their own rider, the plume out of the gate (one scene, both halves see
   * it), a punch and a camera kick in THEIR OWN half -- post2 and cameraRig2
   * exist precisely so one player's glow cannot cross the seam.
   *
   * What they do not get is anything attached to the phone or to the single
   * HUD: no haptic (the phone is in one person's hands, and buzzing it for the
   * other player's gate is a lie about whose run it is), no callout (there is
   * one callout strip, belonging to player one's half), and nothing added to
   * `stats`, which feeds player one's results panel. Player two's own numbers
   * belong on the two-player ending screen, which does not exist yet.
   */
  _gateForTwo(ev) {
    if (ev.type === 'boost') {
      // Player two's OWN chain -- see the note in race.js on why a streak
      // cannot be shared by two people.
      const b = this._mode.takeBoost?.(1) ?? this._mode.boost;
      this.rider2.boost(b.seconds, b.addSpeed, b.ceiling);
      this.audio.boost(b.seconds);
      this._gateBurst.set(0xa78bfa);
      this.particles.emit(
        { x: ev.gate.x, y: this.terrain.height(ev.gate.x, ev.gate.z) + 1.2, z: ev.gate.z },
        this._gateBurst,
        { count: 64, speed: 13, size: 2.2, life: 1.0, up: 8, spread: 1 },
      );
      this.post2?.punch(0.42, this._gateBurst);
      this.cameraRig2?.kick(0.5);
    }
    // A missed boost gate costs the boost and nothing else, which is the whole
    // cost for player one too. Plain and timed gates do not appear in the race
    // (its plan is boost gates alone), so there is nothing else to pay here.
  }

  /**
   * Find player two again, because their SEAT NUMBER IS NOT THEIR IDENTITY.
   *
   * When a board disconnects the app removes that seat and the ones after it
   * SHIFT DOWN. A game that holds "player two is slot 1" therefore keeps
   * reading slot 1 and silently starts obeying a different person -- in a
   * three-board house, the moment the middle board drops, player two's rider
   * answers to somebody else and nothing on screen looks wrong. That is the
   * worst shape a bug can take and it is why this exists.
   *
   * So player two is captured at the gun as a roster ENTRY and looked up by
   * it every frame. The roster carries name, colour and isMain and no stable
   * id -- the app has none to give yet (BAL-597) -- so identity is name plus
   * colour, which two children with one name would defeat. Good enough at a
   * cap of two; revisit if this ever goes to four.
   *
   * Returns false when that player is no longer in the roster at all, which
   * is simply the disconnect path by another road.
   */
  _resolveP2Slot() {
    const roster = this.host.roster;
    if (!Array.isArray(roster) || roster.length < 2) {
      // No roster to speak of -- a browser session, or an older app build.
      // Trust the slot we were given rather than inventing a disconnect.
      return true;
    }
    const want = this._p2Ident;
    if (!want) {
      const them = roster.find((p) => !p.isMain) ?? roster[1];
      if (!them) return false;
      this._p2Ident = { name: them.name, color: them.color };
      this.input2.slot = them.slot;
      return true;
    }
    const them = roster.find((p) => p.name === want.name && p.color === want.color);
    if (!them) return false;
    this.input2.slot = them.slot;
    return true;
  }

  /**
   * Has this slot's board gone, and is the game being lied to about it?
   *
   * NOT `connected`. That asks whether a real sensor is attached, which is
   * false in every browser session, so gating on it froze player two on the
   * one platform the whole thing is developed on. It took a probe printing
   * `slot1x: 1, live: false` to see it, because the rider looked exactly as
   * wrong as a steering bug would.
   *
   * Two real failures, two signals:
   *
   *  - THE SLOT GOES QUIET. The app drops a disconnected player from its
   *    roster, the per-player array shrinks, and nothing pushes this slot any
   *    more. `stale` is exactly that question and the pipeline already
   *    answers it.
   *
   *  - THE SLOT LIES STILL. The app's angle maths returns a CONSTANT FULL
   *    DEFLECTION for a board whose address stopped resolving -- not zero, and
   *    not stale either, because something is still publishing it. That reads
   *    as a player holding a perfect maximum lean, which no human does: a real
   *    lean at the stops still trembles. So a value pinned at the rail, not
   *    moving by even a thousandth, for two seconds, is a dead board.
   */
  _deadSlot(dt, input) {
    // ── THE ONLY SIGNAL WE ACT ON ─────────────────────────────────────────
    // A seat that goes QUIET. The designed disconnect path removes the player
    // from the roster, the per-player array shrinks, and nothing pushes this
    // slot again -- which is exactly what `stale` asks.
    if (input.stale) return true;

    // ── WHAT WE MEASURE BUT NO LONGER BELIEVE ─────────────────────────────
    // "Pinned at the rail and bit-identical frame to frame is not a human,
    // because a real board under a real person always trembles" is TRUE OF
    // HARDWARE AND FALSE OF EVERYTHING ELSE, and acting on it was a live bug
    // within minutes of Elad playing in the Editor: "lower camera not
    // following the player".
    //
    // The Editor's simulated seats ease toward the key's target and clamp
    // radially to 1, so a held key settles on EXACTLY 1.0 and then stays
    // exactly 1.0 forever -- precisely the tell. Hold a direction for two
    // seconds and the rider froze. Bloop Squad hit the same thing with Amit
    // the same afternoon and read it as one player's input affecting the
    // other; it was each seat tripping this independently.
    //
    // So the trade is: a guard against a RARE failure (the disconnect handler
    // never firing, leaving a seat frozen at its last value) that reliably
    // breaks a COMMON case (a child holding an edge, any synthetic input, any
    // replay). Kept as a reported state because the reasoning still holds for
    // real hardware, and because when someone finally sees it on a board we
    // will want to know it was detected -- but nothing is wired to it until
    // there is evidence from hardware, which nobody has: everything we know
    // about this failure is still code-reading.
    const mag = Math.hypot(input.x, input.y);
    const moved = Math.abs(mag - (this._pinMag ?? 0)) > 1e-3;
    this._pinMag = mag;
    if (mag < 0.97 || moved) { this._pinFor = 0; this._pinned = false; return false; }
    this._pinFor = (this._pinFor ?? 0) + dt;
    if (this._pinFor > 2 && !this._pinned) {
      this._pinned = true;
      console.log('[carve] slot pinned at full lean and perfectly still — '
        + 'a dead board on hardware, but also what the Editor and any '
        + 'synthetic input look like. Reported, not acted on.');
    }
    return false;
  }

  /** Wait for audio, but never on audio's terms. */
  async _audioReady() {
    try {
      await Promise.race([
        this.audio.resume(),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch (err) {
      console.warn('[carve] audio did not resume, starting the run anyway:', err?.message ?? err);
    }
  }

  _startCountdown(from, done) {
    this.state = 'count';
    this.hud.setScreen('count');
    // ── BAL-610: THE RACE IS ON SCREEN BEFORE IT STARTS ───────────────────
    // "map should be seen from the start - during count down." The map was
    // always there and always correct -- the sidebar paints from the frame
    // loop -- but the whole HUD sat at opacity 0 until the countdown ENDED,
    // because setLive fired with the state change to `play`. So this was
    // never a missing map; it was a faded one, which is why measuring its
    // layout width said it was fine.
    //
    // The three seconds before a race are exactly when a player wants to read
    // the course: which run, how long, where the checkpoints are. Nothing on
    // this screen is a lie during the countdown -- the clock reads 00:00.00,
    // the gap is zero, and the distance is the full race.
    this.hud.setLive(true);
    let n = from;
    // ── THE NEXT TICK IS BOOKED BEFORE ANYTHING ELSE RUNS ─────────────────
    // This chain used to call the blip BEFORE scheduling, and a throw inside
    // it took the whole run with it: "3" painted, the next timeout never
    // booked, the countdown stopped there and the run never began. That is
    // BAL-591 -- on the tablet the game sat on 3 until the player paused and
    // came back, which is the only path that leaves `count`. Reproduced in
    // the harness by making `audio.countdown` throw, and the symptom matched
    // the device video exactly. Ordering is the fix; the guard below is the
    // belt. A SOUND MUST NEVER BE ABLE TO END A RUN.
    const tick = () => {
      if (n > 0) {
        this.hud.countdown(String(n));
        n--;
        this._countTimer = setTimeout(tick, 700);
        this._blip(false);
      } else {
        this.hud.countdown('GO!');
        this._countTimer = setTimeout(done, 420);
        this._blip(true);
      }
    };
    tick();
  }

  /** The countdown's blip, which is decoration and is treated as decoration.
   *  It is logged rather than swallowed silently: a device whose audio layer
   *  is throwing is worth knowing about, just not worth freezing for. */
  _blip(final) {
    try {
      this.audio.countdown(final);
    } catch (err) {
      console.warn('[carve] countdown sound failed, the run continues:', err?.message ?? err);
    }
  }

  /** Hand the player back to the host. `exit` fires once however often this is
   *  reached — a held back-lean on a menu used to pop three routes. */
  _leave() {
    this.audio.stop();
    this.audio.silenceRide();
    analytics.gameLeft();
    this.host.exit();
  }

  /**
   * The gear, and the wrench behind the gesture.
   *
   * THE GEAR IS ALWAYS THERE, THE WRENCH IS NOT. The wrench button is only
   * inserted once `devUnlock` has been satisfied — a seven-second hold on the
   * score, then a four-digit code — and the unlock is deliberately NOT
   * persisted, so a reload re-locks it (Trenchlight §7.9).
   *
   * The hold target is the score: on screen for the whole run and never
   * otherwise interactive. Trenchlight uses the hull pip row and carve's wipeout
   * pips would have been the exact analogue, but the clock replaced them.
   */
  _installPanels() {
    const doc = document;
    const row = doc.getElementById('chromeRow');

    // ── ONE MENU, EVERYWHERE ──────────────────────────────────────────────
    // The floating dropdown is gone on BOTH platforms -- "I asked to remove
    // this side drop-down menu... bring both of those menus together, just one
    // of them, and do an on-off on the resume button." The settings rows
    // (music, effects, the guarded max-tilt stepper) render INLINE inside the
    // pause screen, which is now the single menu: mid-run the gear and the
    // pause button both open it with the run rows showing; from the lobby the
    // gear opens the same screen in `is-lobby` dress -- run rows hidden, a
    // close row instead, the game state untouched beneath (the attract keeps
    // riding behind it, which is also why nothing here pauses or resumes
    // anything in lobby mode).
    //
    // No onCalibrate hook on purpose: the panel then builds no calibrate row,
    // and the menu's own `calibrate your lean` row (the keep-on-pause path)
    // stays the one entry.
    // Sound toggles are settings_changed too; wrapped here so panels.js stays
    // template-faithful (it is lifted from NovaVanguard and must keep lifting).
    const ah = this.audio.settingsHooks;
    const audioHooks = {
      ...ah,
      setMusicOn: (v) => { ah.setMusicOn(v); analytics.settingChanged('music', v ? 1 : 0); },
      setSfxOn: (v) => { ah.setSfxOn(v); analytics.settingChanged('sound_effects', v ? 1 : 0); },
    };
    this._settings = createSettingsPanel(doc, audioHooks, this.host, {
      getMaxAngle: () => this.host.settings?.maxAngleDeg ?? this.host.tilt?.maxAngleDeg,
      setMaxAngle: (d) => this._stepMaxAngle(d),
      msSinceCalibration: () => (this._calibratedAt ? Date.now() - this._calibratedAt : Infinity),
      /**
       * THE SECOND BOARD'S REACH, and why the row needs telling about it.
       *
       * One row showed one number, and in two-player that read as "whoever
       * calibrated last won" -- reported from a device, 2026-10-15. The number
       * was never wrong: the row paints host.settings.maxAngleDeg, which is a
       * single global by design (host.setMaxAngle applies to EVERY slot, so
       * two players on one board cannot end up on two difficulties). Player
       * two's reach is session-only and seat-scoped and lives on the bridge,
       * so it was simply never on this screen.
       *
       * Null when there is no second seat to ask about -- single player, or a
       * host with no seat API -- and the row stays exactly as it was.
       */
      getSeats: async () => {
        if (!TWO_PLAYER) return null;
        const gb = window.GoBalance;
        const slot2 = this.input2?.slot ?? 1;
        const [n1, n2] = this._playerNames();
        let p2 = typeof gb?.getMaxAngle === 'function'
          ? await readAngle(gb.getMaxAngle(slot2)) : NaN;
        if (!Number.isFinite(p2)) p2 = this._p2Reach;
        return [
          { label: `${n1} (main board)`, deg: this.host.settings?.maxAngleDeg
            ?? this.host.tilt?.maxAngleDeg, scope: 'saved' },
          { label: n2, deg: p2, scope: 'this session only' },
        ];
      },
    });
    doc.getElementById('menuSettings').appendChild(this._settings.panel);
    this._settings.setOpen(true); // inline: always present, repainted per open
    if (TWO_PLAYER) doc.body.classList.add('is-2p');   // shows the divider
    this._paintStance();            // the stored stance, drawn before first use
    doc.getElementById('btnSettings').addEventListener('click', (e) => {
      e.stopPropagation();
      this._dev?.setOpen(false);
      // Only meaningful over the lobby or a run; count/results/sensor ignore it.
      if (this.state === 'title' || this.state === 'place') this._menuFrom = this.state;
      if (this.state === 'play' || this.state === 'pause'
        || this.state === 'title' || this.state === 'place') {
        this._nav.toggle('settings');
      }
    });

    // ── TEMPORARY: THE WRENCH IS UNLOCKED AT BOOT ─────────────────────────
    // Asked for while the race is being built — "make the devtool button icon
    // visible on default. easier for me to test." The gesture still works and
    // is still the only route in a shipped build; this just also fires it once
    // on load.
    //
    // FLIP `DEV_UNLOCKED_AT_BOOT` BEFORE ANYTHING SHIPS. Trenchlight §7.9 is
    // explicit that the panel skips content and removes failure conditions, so
    // a player must never reach it by accident, and a wrench sitting in the
    // chrome row is not an accident away — it is a tap away.
    const unlock = installDevUnlock(doc, doc.getElementById('score'), () => {
      if (this._dev) { this._dev.setOpen(true); return; }
      this._dev = createDevPanel(doc, {
        // The no-console answer (GOBALANCE_Bobo_DoubleFlow.md §3): the ring on
        // the glass, and out through whatever transport is listening. Chunked,
        // because logcat truncates long lines and one giant JSON string would
        // arrive as its own first third.
        isTestCardOn: () => !!this._testCard,
        setTestCardOn: (v) => {
          // Save and restore the clear colour: the card borrows the renderer's
          // clear state, and handing back a magenta sky would be its own bug.
          if (v && !this._testCard) this._tcPrev = this.renderer.getClearColor(new THREE.Color());
          if (!v && this._tcPrev) this.renderer.setClearColor(this._tcPrev, 1);
          this._testCard = !!v;
        },
        viewLog: () => formatLog(),
        sendLog: () => {
          const lines = formatLog().split('\n');
          for (let i = 0; i < lines.length; i += 25) {
            this.host.send({ type: 'log', part: 1 + (i / 25 | 0), of: Math.ceil(lines.length / 25),
                             text: lines.slice(i, i + 25).join('\n') });
          }
        },
        isDiagOn: () => this._diag,
        setDiagOn: (v) => { this._diag = v; if (!v && !this._perf) this.hud.setDiag(null); },
        isPerfOn: () => this._perf,
        setPerfOn: (v) => {
          this._perf = v;
          this._perfFrames.length = 0;
          this._perfJs.length = 0;
          if (!v && !this._diag) this.hud.setDiag(null);
        },
        isAutopilotOn: () => !!this._autopilot,
        setAutopilotOn: (v) => { this._autopilot = v; },
        capture: () => this._captureDiag(),
        // ── the live numbers ────────────────────────────────────────────
        // Framing is the thing that cannot be judged from a still: how big the
        // rider reads and how much of the course is in shot are the same
        // number pulling in opposite directions, and which one matters more is
        // a question about riding, not about a screenshot.
        //
        // These three are exactly `debugCam`'s arguments, so the panel and the
        // console reach the same numbers rather than two parallel sets. Steps
        // are the size of a change worth looking at: half a metre of distance
        // is visible, a tenth is not.
        numbers: [
          // THE CAMERA KEYS WRITE THROUGH TO THE MODE as well as to `TUNE`, so
          // a framing tuned during a race is still there at the next race and
          // is NOT there in chill vibe. Writing only `TUNE` would tune both
          // modes at once and then lose it at the next mode switch, which
          // applies the mode's own config over the boot defaults.
          { label: 'cam back', step: 0.5, fmt: (v) => v.toFixed(1),
            get: () => TUNE.camBack, set: (v) => this._setCam('camBack', clamp(v, 4, 24)) },
          { label: 'cam up', step: 0.25, fmt: (v) => v.toFixed(2),
            get: () => TUNE.camUp, set: (v) => this._setCam('camUp', clamp(v, 1.5, 14)) },
          { label: 'look ahead', step: 2, fmt: (v) => v.toFixed(0),
            get: () => TUNE.camLookAhead, set: (v) => this._setCam('camLookAhead', clamp(v, 8, 80)) },
          // The one that decides whether the game has a sky in it, per its own
          // note in rider.js — worth having here precisely because raising it
          // for the vista is what pushes the rider off the bottom of the frame.
          { label: 'look up', step: 1, fmt: (v) => v.toFixed(0),
            get: () => TUNE.camLookUp, set: (v) => this._setCam('camLookUp', clamp(v, 2, 26)) },
          { label: 'body roll', step: 0.04, fmt: (v) => `${(v * 180 / Math.PI).toFixed(0)}\u00B0`,
            get: () => TUNE.maxRoll, set: (v) => { TUNE.maxRoll = clamp(v, 0.1, 1.2); } },
        ],
        // Back to what the MODE was authored with, not to the boot table —
        // resetting inside a race should give you the race's camera back.
        resetNumbers: () => {
          const def = getMode(this._modeId);
          const authored = this._modeCamDefaults.get(def.id);
          if (authored && def.camera) Object.assign(def.camera, authored);
          Object.assign(TUNE, this._tuneDefaults, def.camera ?? {});
        },
      });
      doc.body.appendChild(this._dev.panel);
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'chrome-btn';
      btn.id = 'btnDev';
      btn.setAttribute('aria-label', 'dev tools');
      btn.textContent = '\u{1F527}';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._settings.setOpen(false);
        this._dev.setOpen(!this._dev.isOpen());
      });
      // Ahead of the gear, so the row stays wrench / gear / pause / back and the
      // convention's 48px pitch holds however many buttons are showing.
      row.insertBefore(btn, row.firstChild);
      // The row is now four buttons wide and reaches into the clock. See the
      // `dev-unlocked` rule in styles.css — the clock moves, not the row.
      doc.body.classList.add('dev-unlocked');
      // Opened only when the GESTURE earned it. Unlocking at boot puts the
      // wrench in the row and leaves the panel shut, which is what "visible by
      // default" should mean — a panel that opened itself on every load would
      // be in the way of the first run rather than available to it.
      if (!this._bootUnlock) this._dev.setOpen(true);
    });

    // BROWSER ONLY, structurally. The boot unlock exists because Elad asked
    // for the wrench "visible on default, easier for me to test", and that is
    // a statement about a desktop browser, not about a child's tablet. Gating
    // it on the transport means there is no longer a flag to remember to flip
    // before a ship: a device build can never boot unlocked, whatever the
    // constant says, and the 7s-hold-plus-code gesture stays the only way in.
    if (DEV_UNLOCKED_AT_BOOT && this.host.transport === 'browser') {
      this._bootUnlock = true;
      unlock.unlockNow();
      this._bootUnlock = false;
    }

    // A tap anywhere else closes the DEV dropdown -- and only that. The
    // settings panel used to be a dropdown governed by this same closer, but
    // it renders INLINE inside the menu screens now, and this listener was
    // hiding it on every row click ("music+sfx, max angle -- clicking on it
    // closes the window"): the stack trace of the mystery setOpen(false)
    // pointed here. An inline panel's visibility belongs to the menu that
    // hosts it, not to stray taps.
    doc.addEventListener('click', () => {
      this._dev?.setOpen(false);
    });
  }

  /**
   * Back to the INNER LOBBY, which is this game's title screen.
   *
   * There was no way back to it: `state = 'title'` appeared exactly once in this
   * file, at boot. Every route out of a run went to `host.exit()` and left the
   * game entirely.
   *
   * The audio fades rather than cutting, for the same reason `_endRun` does —
   * and faster, 0.8 s, because this is a deliberate navigation and not the end
   * of a run being sat with. `_seekTo(4)` puts the attract rider back near the
   * top of the mountain, which is where `_updateIdle` expects to find it.
   */
  _toLobby() {
    if (this.state === 'title') return;
    // From the place screen there is no run to tear down -- nothing has started
    // -- so this is just a walk back up to the mode list.
    if (this.state === 'place') {
      this.state = 'title';
      this.hud.setScreen('title');
      this.host.haptic('select');
      return;
    }
    // The mode's things belong to the run, not to the session. Left alive they
    // would turn up in the next run, which may be a different mode entirely.
    this._mode?.stop?.();
    clearTimeout(this._countTimer);
    clearTimeout(this._resultsTimer);
    this.audio.fadeOut(0.8);
    this.audio.silenceRide();
    this.audio.setClarity(1);
    this.state = 'title';
    this.hud.setLive(false);
    this.hud.setScreen('title');
    this._seekTo(4);
    this._gbAutoStart();
  }

  /**
   * ── GOBALANCE AUTO-START: REMOVED, AND WHY IT EXISTED ────────────────────
   *
   * This used to force a race from the title on the gobalance transport, on
   * the premise -- derived from a reading of the SDK contract -- that the
   * player there has no pointer and a lobby could never be left. The premise
   * was FALSIFIED BY USE: Elad's Editor screenshot shows the pause dialog and
   * settings panel opened by clicking, and his report of the forced flow was
   * "it took me several times to go out and out until it allowed me to
   * select". The pass-through also rolled every quit into a fresh race,
   * racing the player's taps against a 400 ms timer. The SDK's actual words
   * require reaching a playable state "without an initial KEY press" -- about
   * keyboards, not about choice.
   *
   * The hook stays so the decision is visible and reversible; it does
   * nothing. If a real pointerless surface ever appears, the answer is a
   * Space/Enter-navigable lobby, not the removal of the lobby.
   */
  _gbAutoStart() {}

  /**
   * ONE BUTTON, ONE MEANING: GO UP ONE LEVEL.
   *
   * The X is not an exit. It only leaves the game from the lobby, where there is
   * nothing above the current screen; everywhere else it is a move INSIDE the
   * game. See web_games/GOBALANCE_Bobo_DoubleFlow.md §2.
   *
   *   play / count   --X-->  pause            (which asks before going further)
   *   pause          --X-->  lobby            (the pause screen IS the "sure?")
   *   results        --X-->  lobby
   *   sensor         --X-->  lobby
   *   lobby          --X-->  the platform     <-- only here
   *
   * ONE DIVERGENCE FROM THE DOC, and it is deliberate rather than an oversight:
   * the doc's ladder has `pause --X--> resume`, treating pause as a modal the X
   * dismisses. Elad's call is that the X always moves OUTWARD — play, pause,
   * lobby, platform — with `resume` the button that goes back in. It is the more
   * consistent reading of "up one level", but it means carve and swerve differ
   * at that rung, which is the one thing the doc exists to prevent. Reconcile it
   * before the second game ships, in whichever direction.
   *
   * Every rung below `lobby` routes through `_toLobby`, and so does the `quit`
   * act — they are two paths to one decision and the doc is explicit that fixing
   * one without the other leaves the other wrong.
   */
  _back() {
    if (this.state === 'play' || this.state === 'count') this._pause();
    else if (this.state === 'title') this._leave();
    // THE PLACE SCREEN GOES BACK ONE RUNG, not out. The title is still the
    // inner lobby and still the only screen whose X leaves for the platform --
    // a second screen that also left would make the ladder depend on which one
    // you happened to be standing on.
    else if (this.state === 'place') this._toLobby();
    else this._toLobby();
  }

  // _panelPause and _calibrateFromPanel are gone with the floating dropdown:
  // the one menu pauses through _pause like everything else, and calibration
  // has a single entry -- the menu's own row, which keeps the pause.

  /**
   * Open the wizard and log what it decided.
   *
   * `resumeAfter` puts the player back into the run through the usual 3-count.
   * Never straight back: they have just been asked to lean as far as they
   * physically can, and dropping a moving mountain on that is how you fall off.
   */
  /**
   * The seats this wizard should measure.
   *
   * BOTH BOARDS AT ONCE IN TWO-PLAYER, one above the other, each in the half
   * its player will race in -- "I think we should present the 2 calibration
   * screens one above the other" (Elad). Genuinely simultaneous: the widen is
   * per seat, so neither player waits on the other, and either half can
   * refuse and retry on its own.
   *
   * THE TWO SEATS SAVE DIFFERENTLY, which is the whole reason the wizard
   * takes these as callbacks (BAL-597 phase 1):
   *
   *  - PLAYER ONE is the main board and has no per-seat value at all -- the
   *    bridge refuses one for seat 0. His reach persists app-wide, exactly as
   *    it does in single player, through the plain calls.
   *  - PLAYER TWO is seat-scoped and SESSION-ONLY: the value lives in the
   *    bridge's memory, never in PlayerPrefs, and the app clears it on exit.
   *    So his pass widens and commits through setMaxAngleSession(deg, seat)
   *    and restores whatever it read on the way in.
   *
   * `seat` is the seat's CURRENT index, and the bridge stores the value
   * against that board's address -- so it follows the child if an earlier
   * seat drops and the indices shift under them.
   *
   * Returns null when there is nothing to split: single player, or a host
   * with no seat-scoped call (an older app), where one wizard on slot 0 is
   * the honest answer rather than a second half that cannot save anything.
   */
  /**
   * Seed the local reach from the app's stored value.
   *
   * setMaxAngle, NOT persistMaxAngle: this is a read, and writing back what we
   * just read would turn a boot into a save -- harmless today, but it would
   * make the app's own value depend on having opened this game, which is not
   * a relationship worth creating.
   */
  async _seedMaxAngleFromApp() {
    const gb = window.GoBalance;
    if (typeof gb?.getMaxAngle !== 'function') return;
    const deg = await readAngle(gb.getMaxAngle());
    if (!Number.isFinite(deg) || deg <= 0) return;   // no reply: 12 stands
    this.host.setMaxAngle(deg);
    console.log(`[carve] reach seeded from the app: ${Math.round(deg)} deg`);
  }

  _calSeats() {
    if (!TWO_PLAYER) return null;
    // THE SCREEN EXISTS IN THE BROWSER TOO, and gating it on the bridge was
    // simply wrong: it made the one layout that most needs looking at the one
    // thing nobody could look at without Unity and two boards. The keyboard
    // already stands in for a board everywhere else in this wizard (see
    // DEV_LEAN_DEG), so it stands in here.
    //
    // What the browser cannot do is SAVE player two's reach -- there is no
    // seat API to save it through. So the seat-scoped calls are taken when
    // the bridge is there and quietly skipped when it is not, and the number
    // is kept in the page for the length of the session either way. The
    // measurement, the layout and the two-half flow are identical; only the
    // persistence is absent, and it is absent on a platform that has nowhere
    // to persist to.
    const gb = window.GoBalance;
    const seatApi = typeof gb?.setMaxAngleSession === 'function';
    const [n1, n2] = this._playerNames();
    const slot2 = this.input2?.slot ?? 1;
    // `phase` and `skippable` are what turn the two seats into a queue: the
    // wizard runs them one at a time, says whose turn it is on every screen,
    // and offers Skip rather than Cancel -- a second button cannot mean
    // "abandon everything" when the next player has not had their turn.
    return [
      // THE BADGE IS PART OF THE SEAT, not of the wizard. Elad: "use the icon
      // of the name with the red/teal color next to the name". The colours
      // are PLAYER_COLORS, the same list the riders, the halves and the
      // countdown cards are tinted from -- player one red, player two teal,
      // always, which is the whole point of pinning them.
      { slot: 0, label: n1, icon: initials(n1), tint: playerCss(0),
        phase: 'player 1 of 2', skippable: true },
      {
        slot: slot2,
        label: n2,
        icon: initials(n2),
        tint: playerCss(1),
        phase: 'player 2 of 2',
        skippable: true,
        // HIS OWN PREVIOUS VALUE, from the bridge. Falling back to the
        // host's setting read PLAYER ONE's number and handed it to player
        // two's seat on the way out -- measured: both seats restored to 12.
        // getMaxAngle(seat) exists for exactly this and answers the seat's
        // effective value, its own or the global one.
        read: async () => {
          const v = seatApi ? await readAngle(gb.getMaxAngle?.(slot2)) : NaN;
          return Number.isFinite(v) ? v : (this._p2Reach ?? null);
        },
        widen: () => { if (seatApi) gb.setMaxAngleSession(45, slot2); },
        restore: (prev) => { if (seatApi && prev != null) gb.setMaxAngleSession(prev, slot2); },
        commit: (deg) => {
          this._p2Reach = deg;
          if (seatApi) gb.setMaxAngleSession(deg, slot2);
        },
      },
    ];
  }

  async _runCalibration(resumeAfter) {
    const seats = this._calSeats();
    const out = await openCalibration({ host: this.host, seats });
    // A split resolves with one result per seat; a single seat resolves with
    // its own, as it always has. Player one's is what the rest of this
    // function has always been about: his is the value that persists, and the
    // one the max-tilt settings row shows.
    const r = Array.isArray(out) ? out[0] : out;
    if (Array.isArray(out)) {
      const two = out[1];
      console.log(two?.ok
        ? `[carve 2p] player two reach ${two.deg.toFixed(1)} deg (session, seat ${seats[1].slot})`
        : `[carve 2p] player two calibration ended: ${two?.reason}`);
    }
    if (r.ok) {
      // STAMPED ONLY ON A SUCCESS. The guard exists to stop someone undoing a
      // measurement they just took by accident; a cancelled, timed-out or
      // refused wizard changed nothing, so there is nothing to protect and
      // arming it would just put a warning in front of an ordinary edit.
      this._calibratedAt = Date.now();
      // Calibration IS a settings change, not a new event -- a new name would
      // fragment the shared vocabulary (sky-trough's explicit warning).
      analytics.settingChanged('max_tilt_angle', Math.round(r.deg));
      console.log(`[carve] reach measured ${r.deg.toFixed(1)} deg (this session)`);
    } else {
      console.log(`[carve] calibration ended: ${r.reason}`);
    }
    if (resumeAfter) {
      this._resumeFromPause();
    } else if (this._nav?.top) {
      // ── BACK ON THE MENU IT CAME FROM, REPAINTED ──────────────────────────
      // Keep-on-pause generalised by the nav: the wizard hands back to
      // whichever menu opened it (pause or settings, run suspended or lobby),
      // and the inline rows repaint -- the wizard may have just changed the
      // number the max-tilt row shows, and the menu was never closed, so
      // nothing else would.
      this.hud.setScreen(this._nav.top);
      this.hud.setLive(false);
      this._settings?.setOpen(true);
    }
  }

  /**
   * Step the tilt gamut by a degree, within what the pipeline will take.
   *
   * WRAPS at the ends rather than stopping, matching the GoBalance panel: the
   * two extremes are a long way apart and a player who has run to one of them
   * usually wants the other. The 5-45 band is the pipeline's, NOT the wizard's
   * 6-30 -- that one judges a measurement, and this is a deliberate edit.
   */
  _stepMaxAngle(d) {
    const MIN = 5;
    const MAX = 45;
    const cur = Math.round(this.host.settings?.maxAngleDeg ?? this.host.tilt?.maxAngleDeg ?? 12);
    let next = cur + d;
    if (next > MAX) next = MIN;
    if (next < MIN) next = MAX;
    // PERSISTED, not the session verb: this row is the deliberate manual
    // override, and on GoBalance `setMaxAngle` maps to the session stash --
    // the edit would silently evaporate on exit (Half Shell Hustle's "a
    // deliberate write wins"). On Bobo the two verbs are the same write.
    (this.host.persistMaxAngle ?? this.host.setMaxAngle).call(this.host, next);
    analytics.settingChanged('max_tilt_angle', next);
  }

  /** The PLAYER ended the run -- the pause menu's row or the X-confirm popup.
   *  One path so analytics and nav bookkeeping cannot diverge. */
  _quitRun() {
    this._stanceThen = null;
    const pct = this._modeId === 'race'
      ? Math.round((this._mode?.progress?.() ?? 0) * 100) : null;
    analytics.levelQuit(this.score, pct);
    this._nav?.reset();
    this._toLobby();
  }

  _pause() {
    if (this.state !== 'play') return;
    this.state = 'pause';
    this.audio.pause();
    this.hud.setLive(false);
    this.hud.setScreen('pause');
    this.host.haptic('select');
  }

  _resumeFromPause() {
    if (this.state !== 'pause' && this.state !== 'sensor') return;
    this._startCountdown(3, () => {
      this.audio.unpause();
      this.state = 'play';
      this.hud.setScreen(null);
      this.hud.setLive(true);
    });
  }

  /**
   * @param {string|boolean} reason what the MODE said ended the run — 'timeup',
   *   'finish', and so on. Coerced to the old boolean for the host payload,
   *   which has carried `completed` since day one and whose meaning must not be
   *   quietly re-cut underneath a host that already reads it (BRIDGE.md §4.2).
   */
  _endRun(reason) {
    if (this.state === 'over') return;
    this._paintResults2p();
    const completed = reason === true || reason === 'finish' || reason === 'complete';
    // Read before anything stops the transport. Track position rather than wall
    // clock, so a run that sat on the pause screen for a minute does not report
    // a minute of riding.
    // The RUN's length, not the track position. `audio.time` starts at
    // `_musicStart` so everything downstream of the beat grid agrees, and
    // reporting that to the host would add the intro to every run's duration.
    const durationMs = Math.round(this.runTime * 1000);
    clearTimeout(this._countTimer);
    this.state = 'over';
    this.hud.setLive(false);
    // ── SHE KEEPS GLIDING WHILE THE PANEL ARRIVES ─────────────────────────
    // "I don't want to see her stop. If she keeps going and the fade to the end
    // screen happens while she's moving, and she only stops when the UI is
    // fully there, it's better." So `over` does NOT freeze the rider: the loop
    // coasts her (see `_updateCoast`) with no input through the panel's fade,
    // easing her speed down, and the motion is frozen only once the results are
    // fully up -- by which point the stop is behind the panel, not watched.
    this._coasting = true;
    this._coastT = 0;
    // ── THE END OF A RUN IS A STOP, NOT A DEATH ───────────────────────────
    // This used to be `stop()` + `gameOver()` + `post.hurt(1)` +
    // `cameraRig.kick(1.3)`: the music severed mid-sample, a sawtooth falling
    // 300 Hz to 60 with a noise burst behind it, a red damage vignette at full,
    // and the camera shaken. That was written when a run ended by losing the
    // last of three lives, and it was right for that.
    //
    // It ends now because a clock reached zero on a mountain that does not end.
    // Nothing was destroyed and nothing was failed, so nothing hits the player:
    // the music rides down over 1.8 s, a consonant figure descends under it, and
    // the frame is left alone to be looked at.
    this.audio.fadeOut(1.8);
    this.audio.silenceRide();
    this.audio.setClarity(1);
    this.audio.settle();

    if (completed) this.score += 1200;

    const best = store.get('carve.best', 0);
    const isBest = this.score > best;
    if (isBest) store.set('carve.best', Math.round(this.score));
    const rank = rankFor(this.score, this.par);

    // A BEAT, THEN THE PANEL -- over a rider who is still moving. `_updateCoast`
    // carries her glide across this window and the panel's own 0.62 s fade; the
    // freeze lands at the end of it, under the full UI.
    const res = this._mode.results?.() ?? {
      title: 'run over',
      run: { distance: this.distance, earned: this.timer.earned },
    };
    // ── ANALYTICS: how the level ended ────────────────────────────────────
    // The vocabulary's distinctions, applied: a race at the line is a CLEAR
    // with its placing; chill's clock running out is a FAIL ("clock ran out"
    // is the vocabulary's own example) -- the game ended it, the player did
    // not. Quits are reported where the player quits, not here.
    if (completed && this._modeId === 'race') {
      // In two-player the placing is between the two humans, and `place`
      // carries it exactly as it carries a placing among the AI field --
      // same dimension, same meaning, no second spelling of one fact.
      const place = this.rider2 ? (this.p1Place ?? 0) : (parseInt(res.rank, 10) || 0);
      const two = this.rider2 ? { endedBy: this._mode?.endedBy?.() ?? 'line' } : null;
      analytics.raceFinished(place, this.score, two);
    } else if (reason === 'timeup') {
      analytics.timeUp(this.score);
    }
    this.hud.showResults({
      // There is only one way a run ends now — the clock — so the title says so
      // rather than implying there was an alternative. `completed` is kept in
      // the shape below because BRIDGE.md §4.2 has always carried it.
      ...(res),
      score: this.score,
      // THE MODE'S RANK WINS. It is spread first, so a bare `rank` here would
      // overwrite it -- and the race's placing would have been replaced by the
      // endless descent's letter grade every time.
      rank: res.rank ?? rank,
      gates: this.stats.gates,
      carves: this.stats.carves,
      air: this.stats.air,
      tricks: this.stats.tricks,   // for the HUD, if it wants a line for them
      top: this.stats.top * 3.6,
      isBest,
    });
    this.hud.setBest(Math.max(best, this.score), rankFor(Math.max(best, this.score), this.par));
    clearTimeout(this._resultsTimer);
    this._resultsTimer = setTimeout(() => {
      if (this.state === 'over') this.hud.setScreen('over');
    }, 900);
    // BRIDGE.md §4.2. `slots` from day one even though carve is single-player:
    // retrofitting one into a result whose score is a scalar touches the host's
    // store as well as this file. `isBest` is deliberately not sent — §6 makes
    // the host the owner of scores, so it decides what a best is.
    this.host.result({
      // The GAME's id, not the track's — the playlist is an implementation
      // detail and a host grouping scores by `level` must not see two.
      level: 'carve',
      durationMs,
      completed,
      slots: [{ slot: 0, score: Math.round(this.score), rank, completed }],
      // Additive per BRIDGE.md §2, so a host that has never heard of either
      // ignores them and loses nothing. Distance is here because it is what a
      // leaderboard for an endless descent will be built on, and sending it from
      // the first run means the host has history by the time one exists.
      distance: Math.round(this.distance),
      timeEarned: Math.round(this.timer.earned),
    });
    // 'select', not 'warning'. A warning buzz is the haptic equivalent of the
    // red vignette that just came out of this block.
    this.host.haptic(completed ? 'success' : 'select');
  }

  // ── Scoring ───────────────────────────────────────────────────────────────

  get mult() { return multFor(this.combo); }

  _award(points, label, { big = false, color = null } = {}) {
    const m = this.mult;
    this.score += points * m;
    this.hud.award(points * m);
    const m0 = m;
    this.combo++;
    if (this.mult > m0) this.audio.comboUp(this.mult);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (label) this.hud.callout(`${label} +${Math.round(points * m)}`, { big, color });
  }

  /**
   * Pay the clock, and say so.
   *
   * SEPARATE FROM `_award`, which pays the score and steps the streak. A mote
   * pays time but not score; a chain pays score, and time only once it is
   * complete; a gate pays both. Folding them together would force every caller
   * to pass a zero, and the two currencies would drift into each other the first
   * time anyone tuned one.
   *
   * The callout reports what the clock ACTUALLY took, not what was offered: at
   * the cap, a "+1.5s" the player never received is the kind of small lie that
   * makes a HUD stop being worth reading.
   */
  _grantTime(seconds, label, { big = false, color = null } = {}) {
    const got = this.timer.add(seconds);
    if (label && Math.abs(got) >= 0.05) {
      const sign = got > 0 ? '+' : '';
      this.hud.callout(`${label} ${sign}${got.toFixed(1)}s`, { big, color });
    }
    return got;
  }

  _wipeout(what) {
    if (this.rider.invuln > 0) return;
    this.combo = 0;
    this.stats.crashes++;
    this.rider.crash();

    this.audio.crash();
    this.post.hurt(1);
    this.post.punch(0.30, new THREE.Color(1, 0.4, 0.45));
    this.cameraRig.kick(1.15);
    this.particles.emit(this.rider.world, this.mood.uSnowColor, {
      count: 70, speed: 13, size: 2.0, life: 1.4, up: 5, spread: 1,
    });
    // A wipeout costs SECONDS in a mode that has a clock. It is charged after
    // the combo is zeroed above, and that zeroing is half the punishment on its
    // own: it collapses the chain bonus from x3 back to x1, so the next drift
    // line pays a third of what it would have. CLOCK.wipeout is sized knowing
    // that.
    //
    // IN A MODE WITH NO CLOCK IT COSTS SECONDS TO NOBODY, and must not say that
    // it does. Hitting a tree in a race reported "tree! -10.0s" and quietly
    // drained a timer nothing reads — 67 down to 57 on a run that ends at a
    // line. The real cost is already paid and is the right one: speed, measured
    // at 104 km/h down to 56, plus every metre the field takes while you are
    // down.
    if (this._mode?.usesClock !== false) {
      this._grantTime(CLOCK.wipeout, what, { big: true, color: '#ff5d78' });
      this.hud.setClock(this._readout());
    } else {
      // "When hitting a tree I'm losing speed -- we need stronger feedback;
      // the text needs to be bigger." The race's hit is the huge tier: losing
      // half your speed to a tree is a bigger event than any gate.
      this.hud.callout(what, { huge: true, color: '#ff5d78' });
    }

    if (this._mode?.usesClock !== false && this.timer.expired) this._endRun('timeup');
  }

  // ── Frame ─────────────────────────────────────────────────────────────────

  _loop(now) {
    requestAnimationFrame(this._loop);
    this._frameNo = (this._frameNo | 0) + 1;   // read by the stall watchdog
    this._syncMenuScale();
    // THE TOP OF OUR OWN WORK. Everything after this line and before the render
    // returns is what this game costs; the rest of the frame belongs to the
    // browser. See `_perfText` for why that split is the whole diagnosis.
    const jsStart = this._perf ? performance.now() : 0;
    const raw = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    const dt = Math.min(0.05, Math.max(0.0001, raw));
    // The SIMULATION gets the real elapsed time, not the clamped dt.
    //
    // The course places gates by predicting where the rider will be when a beat
    // lands, and beats arrive on the audio clock, which always advances by the
    // full frame. Clamping the physics to 50 ms therefore does not merely slow
    // the world down — it desynchronises the world from the music, and every
    // gate lands late by a margin that grows for the whole run. At 6 fps the
    // mountain ran at a third of real speed and gates were arriving fifteen
    // seconds off the beat.
    //
    // The rider sub-steps internally, so a long frame is integrated properly
    // rather than jumped over; 0.25 s is a genuine stall guard (a backgrounded
    // tab), not a frame-rate accommodation. Effects and camera follows keep the
    // clamped dt: an exponential follow cannot overshoot at any step size, and
    // particles look better catching up gently than teleporting.
    const dtSim = Math.min(0.25, Math.max(0.0001, raw));
    this.time += dt;

    this._adaptResolution(raw);
    // Once a frame, before anything reads the lean. This is also what steps the
    // shim's dev keyboard/drag, so a game that stops polling stops accumulating.
    this.input.update();
    // PLAYER TWO IS POLLED HERE TOO, and the omission of this one line is the
    // whole of "the lower camera is not following the player". `Input.update`
    // is what moves a host reading into the object the game steers from; left
    // uncalled, input2.lean stayed {0, 0} for the length of a race while
    // host.input(1) carried a perfectly good lean the entire time. The rider
    // coasted the fall line and ignored every key, which from the other side
    // of the screen looks exactly like a camera that has stopped following.
    //
    // It survived three phases of tests because they asserted the SLOT -- the
    // value arriving from the host -- and the slot was never the broken part.
    // Nothing read what the rider was actually given.
    if (this.input2) this.input2.update();
    this.hud.setSensorState(this.input.connected);

    // THAWED BY STATE, NOT BY EVENT. A run can begin from the mode list, the
    // place list, a restart or the results panel, and hanging the thaw off
    // each of those is how one of them gets forgotten and the player rides a
    // photograph. Asking the question every frame cannot be forgotten.
    if (this._frozen && !this._wantsPostcard()) this._thawPostcard();

    if (this.state === 'play') this._updatePlay(dtSim);
    // Attract mode belongs to the title screen alone. Everywhere else the world
    // must HOLD. The countdown runs for two and a half seconds of wall time, and
    // letting the course spawn against attract mode's fabricated clock in that
    // window placed the run's opening gates before the music had even started.
    // On the results screen it was worse than wrong: it rode on past the finish
    // and reset the very statistics the panel is reporting. A frozen frame of
    // wherever the run ended is also simply a better backdrop for them.
    // ATTRACT MODE RUNS ON BOTH LOBBY SCREENS. The mountain behind the place
    // list is the same demo it is behind the mode list, and freezing it the
    // moment you picked a mode would read as the game having hung.
    else if ((this.state === 'title' || this.state === 'place') && !this._frozen) {
      this._updateIdle(dtSim);
    }
    else if (this.state === 'over' && this._coasting) this._updateCoast(dtSim);

    const speedNorm = clamp((this.rider.speed - SPEED_LO) / (SPEED_HI - SPEED_LO), 0, 1);
    // Player two's camera pulls back and widens on player two's OWN speed --
    // fed player one's, it zoomed on the other rider's straights.
    const speedNorm2 = this.rider2
      ? clamp((this.rider2.speed - SPEED_LO) / (SPEED_HI - SPEED_LO), 0, 1) : speedNorm;
    this.cameraRig.update(dt, this.rider, speedNorm);
    if (this.cameraRig2) this.cameraRig2.update(dt, this.rider2 ?? this.rider, speedNorm2);
    if (this._inspect) {
      const r = this.rider;
      const { az, dist } = this._inspect;
      this.camera.position.set(
        r.x + Math.sin(az) * dist, r.y + 1.15, r.z + Math.cos(az) * dist,
      );
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(r.x, r.y + 0.85, r.z);
      this.camera.fov = 42;
      this.camera.updateProjectionMatrix();
    }
    if (this._freeCam) {
      const f = this._freeCam;
      this.camera.position.set(f.pos[0], f.pos[1], f.pos[2]);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(f.look[0], f.look[1], f.look[2]);
    }

    // A failed shader is INVISIBLE failure: three.js logs to the console and
    // the mesh silently stops drawing, and what remains — sky dome, fog
    // gradient, floating props — looks enough like "washed-out snow" that a
    // broken build was mistaken for an art-direction problem for days, on
    // both sides of this project. Never again: if any program on THIS machine
    // failed to compile, say so on screen, with the error.
    if (!this._glChecked && this.time > 2) {
      this._glChecked = true;
      const bad = this.renderer.info.programs.filter((p) => p.diagnostics);
      if (bad.length) {
        const d = bad[0].diagnostics;
        const log = (d.fragmentShader?.log || d.vertexShader?.log || d.programLog || 'unknown')
          .replace(/\u0000/g, '').trim();
        console.error('[carve] SHADER COMPILE FAILURE', bad);
        this.hud.fatal(`a shader failed to compile on this GPU\n\n${log.slice(0, 400)}`);
      }
    }

    const fogBase = this.terrain.baseHeight(this.rider.p) - 40;
    // THE TRAILING RIDER DRIVES THE STREAM, not player one. The ring covers
    // about 70 m behind the position it is given and 630 m ahead, so streaming
    // from the leader drops the other rider off the back of the world the
    // moment they are ~70 m down. Driven from behind, the pair have ~630 m of
    // separation before the LEADER outruns the terrain instead -- which is the
    // number any catch-up rule should be set against.
    const streamP = this.rider2 ? Math.min(this.rider.p, this.rider2.p) : this.rider.p;
    const tailCam = (!this.rider2 || this.rider.p <= this.rider2.p)
      ? this.camera : (this.camera2 ?? this.camera);
    this.mountain.update(streamP, tailCam.position);
    // Trees and rocks stream from the same trailing rider as the ground they
    // stand on. From player one alone, a player two a few hundred metres back
    // rode a bare, featureless slope -- nothing to read speed or distance by.
    this.scatter.update(streamP);
    // THE LEADER'S RING. Anchored at the front rider but never below the top
    // of ring one: the clamp is what keeps the two windows from ever building
    // the same chunk (see the note at construction). Both anchors are
    // monotonic within a run -- the leader only descends and ring one's top
    // only advances -- which the streaming code requires; restarts go through
    // _seekTo, which resets both rings together.
    if (this.mountain2) {
      const lead = Math.max(this.rider.p, this.rider2.p);
      const leadCam = this.rider.p >= this.rider2.p ? this.camera : (this.camera2 ?? this.camera);
      this.mountain2.update(Math.max(lead,
        (this.mountain.baseIndex + this.mountain.count + 1) * CHUNK), leadCam.position);
      this.scatter2.update(Math.max(lead,
        (this.scatter.baseBand + this.scatter.bands + 1) * BAND));
    }
    // Drift lines stream on the title screen too — the `live` flag is what
    // stops the attract rider scoring them.
    for (const ev of this.pickups.update(dt, this.rider, this.state === 'play')) {
      this._award(ev.points, ev.label, { color: ev.color });
      // THE STREAK PAYS HERE AND NOWHERE ELSE ON THE CLOCK. A whole drift line
      // ridden, multiplied by the streak — capped at x3, not the x8 the score
      // uses. Chains cannot arrive closer than 133 m however well anyone rides,
      // so this income has a ceiling that skill cannot lift; the per-mote second
      // has no such ceiling, which is exactly why the multiplier is kept off it.
      // See timer.js.
      if (ev.full && this.state === 'play') {
        const m = Math.min(CLOCK.chainMultCap, this.mult);
        this._grantTime(CLOCK.chain * m, m > 1 ? `full line x${m}` : 'full line',
          { big: m >= CLOCK.chainMultCap, color: '#97d700' });
      }
      this.audio.driftLine(ev.taken, ev.total, ev.full);
    }
    // The mountain owns the sun floor — it derives it from the mood's sun
    // elevation every frame — and every other lit object borrows it, so trees,
    // rocks and gates catch the sunrise at the same moment the snow does.
    const mu = this.mountain.material.uniforms;
    updateLitCommon(this.litMaterials, this.camera.position, fogBase,
      mu.uSunFloor.value, mu.uSunFlat.value);
    // The rivals' jersey materials are built lazily and live outside
    // `litMaterials`; without this they never get uFogBase/uCamPos and render
    // as pale fog-coloured ghosts whatever colour the jersey is set to.
    updateLitCommon(this.rivals.materials, this.camera.position, fogBase,
      mu.uSunFloor.value, mu.uSunFlat.value);
    this.trail.material.uniforms.uCamPos.value.copy(this.camera.position);
    this.trail.material.uniforms.uFogBase.value = fogBase;
    // ── THE BOOST TRAIL ──────────────────────────────────────────────────
    // This replaces a screen-space streak effect that was built first and cut:
    // full-frame radiating lines read as a filter laid over the picture rather
    // than as something the rider was doing, and at the density needed to be
    // felt they covered the mountain. "the particles you did dont work well at
    // all. looks bad - maybe add some speed effect as a trail to the character
    // it's self."
    //
    // So it comes off the RIDER and stays there: a tight cone thrown backwards
    // along the reverse of the heading, which is a wake rather than a weather
    // effect. It is anchored to the thing going fast, so it says WHO is fast —
    // which matters once there are four rivals on the hill also taking gates.
    //
    // RATE-BASED, like the carve spray beside it, so the tail looks the same at
    // 30 fps as at 144 and does not thin out on a slow device.
    this._boostTrail(this.rider, dt, 1);
    // PLAYER TWO'S WAKE. The trail is the thing that says WHO is fast, and it
    // was emitted for player one alone -- so player two took a gate, surged,
    // and nothing came off the back of his board. One emitter, asked twice.
    if (this.rider2) this._boostTrail(this.rider2, dt, 2);
    this.sky.update(this.time, this.camera.position);
    this.range.update(this.camera.position);

    this.trail.update(dt, this.rider, this.terrain);
    this.particles.update(dt);
    this.snowfall.update(dt, this.camera.position, this.mood.uCloud, this.rider.heading);

    this.hud.setAccent(this.mood.uFogSunColor);
    this.hud.setMood(this.mood.label);
    // THE RECORDER ALWAYS RECORDS; the overlay is only a view of it. It used to
    // be called from `_reportDiag`, which runs only while the overlay is on —
    // so `copy capture` from the dev panel returned "nothing recorded yet"
    // unless diagnostics happened to have been switched on first. The capture
    // is pressed in the seconds after something was SEEN, and having to have
    // predicted that is no use at all.
    this._watchFlicker();
    if (this._perf || this._diag) {
      const parts = [];
      if (this._perf) parts.push(this._perfText());
      if (this._diag) parts.push(this._diagText(raw));
      this.hud.setDiag(parts.join('\n\n'));
    }
    this.post.update(dt, this.time, speedNorm, this.mood);
    // The second composer has its own grade -- the sun veil, the speed blur --
    // and nothing was updating it, so the bottom half never got the light that
    // follows player one in the top half.
    if (this.post2) this.post2.update(dt, this.time, speedNorm2, this.mood);
    // ── the clock, drawn last ─────────────────────────────────────────────
    // AFTER the world update, NOT inside `_updatePlay`. Gates and landings are
    // paid in `_updatePlay`, but motes and the full-line bonus are paid by
    // `pickups.update`, which runs after it. A draw inside `_updatePlay` read
    // `lastGain` before the motes had added to it and `endFrame` then cleared it
    // unread — so every mote taken, which is the most common event in the game,
    // flashed nothing at all.
    //
    // The flash reads the frame's NET movement, so a mote taken on the same
    // frame as a tree hit shows one verdict rather than a green and a red
    // fighting over the same element.
    if (this.state === 'play') {
      this.hud.setClock(this._readout());
      if (this.timer.lastGain) this.hud.clockFlash(this.timer.lastGain);
      this.timer.endFrame();
    }

    // ── THE TEST CARD: THE HUMAN EYE AS THE MISSING INSTRUMENT ────────────
    // The Unity Editor's WebView path has no screenshot tooling and no
    // attachable inspector, so when it shows black nobody can capture WHAT
    // KIND of black -- and the edge geometry is the whole diagnosis. This
    // replaces the frame with full-screen magenta/green ALTERNATING EVERY
    // FRAME, which makes each failure mode legible live, to a person:
    //   horizontal bands mixing the two colours  -> the host copied the bitmap
    //     mid-write (the unfenced Render/LoadRawTextureData pair);
    //   whole-rectangle black blinks on resize   -> a texture reallocated and
    //     presented before it was filled;
    //   stepped tiles                            -> the page compositor, the
    //     family the backdrop-filter bug was in;
    //   a steady ~30 Hz shimmer and nothing else -> the display path is clean
    //     and the blacks are the game's own frame, i.e. mine.
    // The sidebar and the overhead bubbles paint from the FRAME loop, not the
    // play step: both must disappear the moment the race stops being live
    // (quit, results), and the play step stops running exactly then.
    this._paintSidebar();
    this._paintCountNames();
    // ON THE FRAME LOOP, so the half blocks are filled during the countdown
    // too. It used to be called only from _updatePlay, which is why turning
    // the HUD on early showed "Player 1" and a row of em dashes: the data was
    // all there, nothing had asked for it to be written. Measured before and
    // after -- names, placings and the 2.4 km to go are all correct the
    // moment the countdown begins.
    this._paintHalves();
    this._paintRiderTags();

    if (this._testCard) {
      this._tcFlip = !this._tcFlip;
      this.renderer.setRenderTarget(null);
      this.renderer.setClearColor(this._tcFlip ? 0xff00ff : 0x00ff40, 1);
      this.renderer.clear(true, true, true);
    } else if (!this._frozen) {
      if (TWO_PLAYER && this.post2) this._renderSplit();
      else this.post.render();
      // INSIDE THE FRAME THAT DREW IT. preserveDrawingBuffer is only on under
      // Unity, so anywhere else the buffer is gone the moment this callback
      // returns -- a snapshot taken a tick later is a blank canvas.
      if (this._wantsPostcard()) this._takePostcard();
    }

    // AFTER the render call, which is as late in our own work as it is possible
    // to measure from. It does not include the GPU actually finishing -- WebGL
    // is asynchronous and nothing here can wait on it without destroying the
    // thing being measured -- and that is exactly the point: what falls outside
    // this window is the part no amount of JS tuning will move.
    if (this._perf) this._samplePerf(performance.now() - jsStart, raw);
  }

  /**
   * Keep the rolling windows for the perf readout.
   *
   * A backgrounded tab produces a four-second "frame" that is not a frame, and
   * one of them poisons a sixty-frame average for a full second, so anything
   * over a second is dropped rather than averaged.
   */
  _samplePerf(jsMs, raw) {
    const ms = raw * 1000;
    if (ms > 0 && ms < 1000) {
      this._perfFrames.push(ms);
      if (this._perfFrames.length > 60) this._perfFrames.shift();
    }
    if (jsMs >= 0 && jsMs < 1000) {
      this._perfJs.push(jsMs);
      if (this._perfJs.length > 60) this._perfJs.shift();
    }
  }

  /**
   * WHAT THIS COSTS, ON THE GLASS.
   *
   * Ported in substance from HillBombSunsetRidge/src/systems/perfHud.js on the
   * `perf-hotfix` branch, where it was written after a day of measuring the
   * released games on Elad's old iPad. Two of its findings are the reason this
   * exists here at all:
   *
   *   THE IPAD IS NOT SLOW. It holds a locked 60 fps at 2.86 Mpx in a
   *   full-screen Canvas 2D game. Three of the three.js/Pixi titles run at 25
   *   fps on the same hardware, so "it is an old device" is not an explanation
   *   of anything.
   *
   *   PIXELS, NOT FPS, IS THE HEADLINE. fps says it is slow; pixels say why.
   *   `Math.min(devicePixelRatio, 2)` -- which this game has, at line 164 --
   *   caps the MULTIPLIER and not the work, and a tablet's logical viewport is
   *   larger than a phone's, so the same "cap" costs about 2.4x more there.
   *
   * AND THE JS/FRAME SPLIT IS THE LINE THAT ENDS ARGUMENTS:
   *
   *   js ~= frame   we are the cost; look at this game's own code.
   *   js << frame   the time is going somewhere we do not control -- GPU wait,
   *                 compositing, vsync -- and no amount of JS tuning moves it.
   *                 Ask the GPU for less instead.
   *
   * Their session burned hours reasoning from source about whether a 39 ms
   * frame was CPU or GPU. This number answers it in three seconds.
   *
   * NOT on a query string like theirs, because carve already has a dev menu
   * with an unlock in front of it, and a second way in is a second thing to
   * remember. `scale` is carve's own: the adaptive resolution multiplier, which
   * the other games do not have.
   */
  _perfText() {
    const f = this._perfFrames;
    const j = this._perfJs;
    const avg = f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0;
    const jsAvg = j.length ? j.reduce((a, b) => a + b, 0) / j.length : 0;
    const cv = this.renderer.domElement;
    const mpx = (cv.width * cv.height) / 1e6;
    const pct = avg ? Math.round((jsAvg / avg) * 100) : 0;
    // THE MAX OF THE WINDOW, not a peak that gets cleared when the text is
    // built. The first version cleared it on every call and this text is built
    // every frame, so "worst" was the worst of ONE frame and read lower than
    // the average -- measured at worst 33 ms against avg 56 ms, which is
    // arithmetically impossible and is how the bug announced itself.
    const worst = f.length ? Math.max(...f) : 0;
    return (
      `${mpx.toFixed(2)} Mpx  ${cv.width}x${cv.height}\n` +
      `css ${Math.round(cv.clientWidth)}x${Math.round(cv.clientHeight)}  ` +
      `dpr ${(window.devicePixelRatio || 1).toFixed(2)}  scale ${this.renderScale.toFixed(2)}\n` +
      `${avg ? (1000 / avg).toFixed(1) : '0.0'} fps  avg ${avg.toFixed(1)}ms  ` +
      `worst ${worst.toFixed(0)}ms\n` +
      `js ${jsAvg.toFixed(1)}ms = ${pct}% of frame  ` +
      `${pct >= 70 ? '(cpu bound)' : pct <= 40 ? '(gpu/compositor bound)' : ''}`
    );
  }

  /**
   * Catch a per-frame alternation in the act.
   *
   * WHY THIS EXISTS. The rider was reported flickering left and right at low
   * speed in a hard turn, and it could not be reproduced here across seven
   * hypotheses — the slip sign flip (which was real, and fixed, and was not
   * this), the edge, the audio, a degenerate basis, the camera, the projected
   * screen position, and `airborne` chattering. Every one of them measured
   * SMOOTH in the harness. The one time a signal appeared it turned out to be
   * the measurement forcing `vh` and not the game at all.
   *
   * So the instrument goes where the bug is instead: on the machine that sees
   * it. Two overlapping images, one faint, is what a value ALTERNATING every
   * frame looks like — and an alternating series has a strongly NEGATIVE lag-1
   * autocorrelation in its frame-to-frame deltas, which is the same test that
   * caught the old camera shake (it measured -0.55, "textbook white noise").
   *
   * Smooth motion sits near +1. Anything below about -0.2 is alternating and is
   * the thing to report. The overlay names the worst offender, so the answer to
   * "what is flickering" is read off the screen rather than guessed at.
   */
  _watchFlicker() {
    const r = this.rider;
    if (!r) return;
    const w = (this._flick ??= {
      n: 0,
      keys: ['x', 'yaw', 'qy', 'slip', 'edge', 'camX'],
      buf: {},
      // A LONGER RING FOR THE CAPTURE than for the readout. The readout wants a
      // short window so it reacts while the fault is on screen; the capture
      // wants enough history that pressing the button a second or two AFTER
      // seeing something still contains it. Four seconds at 60 fps.
      ring: [],
    });
    const vals = {
      x: r.x,
      yaw: r.yaw,
      qy: r.group.quaternion.y,
      slip: r.slip,
      edge: r.edge,
      camX: this.camera.position.x,
    };
    let worstK = null;
    let worstV = 1;
    for (const k of w.keys) {
      const b = (w.buf[k] ??= []);
      b.push(vals[k]);
      if (b.length > 64) b.shift();
      if (b.length < 24) continue;
      const d = [];
      for (let i = 1; i < b.length; i++) d.push(b[i] - b[i - 1]);
      const m = d.reduce((a, v) => a + v, 0) / d.length;
      let va = 0;
      for (const v of d) va += (v - m) * (v - m);
      va /= d.length;
      if (va < 1e-12) continue;
      let c = 0;
      for (let i = 1; i < d.length; i++) c += (d[i] - m) * (d[i - 1] - m);
      c /= (d.length - 1) * va;
      if (c < worstV) { worstV = c; worstK = k; }
    }
    w.worst = worstK;
    w.value = worstV;

    w.ring.push([
      +this.audio.time.toFixed(2), +vals.x.toFixed(4), +vals.yaw.toFixed(4),
      +vals.qy.toFixed(5), +vals.slip.toFixed(4), +vals.edge.toFixed(4),
      +vals.camX.toFixed(4), +(r.vh * 3.6).toFixed(1), +r.u.toFixed(2),
      r.airborne ? 1 : 0, +this._dtSim.toFixed(4),
    ]);
    if (w.ring.length > 240) w.ring.shift();
  }

  /**
   * Everything needed to diagnose what was just seen, as pasteable text.
   *
   * IT IS A RING, so the four seconds BEFORE the button was pressed are what it
   * contains — which is the only useful design, because the button is pressed
   * after the thing has been noticed.
   *
   * The per-signal autocorrelation comes first because it is usually the whole
   * answer: near +1 is smooth, strongly negative is alternating frame to frame,
   * which is what two overlapping images means. The raw series follows so a
   * claim in the summary can be checked rather than trusted.
   */
  _captureDiag() {
    const w = this._flick;
    if (!w || !w.ring.length) return 'carve capture: nothing recorded yet';
    const R = w.ring;
    const names = ['t', 'x', 'yaw', 'qy', 'slip', 'edge', 'camX', 'kmh', 'u', 'air', 'dt'];
    const ac = (i) => {
      const v = R.map((row) => row[i]);
      const d = [];
      for (let k = 1; k < v.length; k++) d.push(v[k] - v[k - 1]);
      const m = d.reduce((a, b) => a + b, 0) / d.length;
      let va = 0;
      for (const q of d) va += (q - m) * (q - m);
      va /= d.length;
      if (va < 1e-14) return { lag1: 0, maxAbsDelta: 0 };
      let c = 0;
      for (let k = 1; k < d.length; k++) c += (d[k] - m) * (d[k - 1] - m);
      return {
        lag1: +(c / ((d.length - 1) * va)).toFixed(3),
        maxAbsDelta: +Math.max(...d.map(Math.abs)).toFixed(4),
      };
    };
    const rows = names.map((n, i) => {
      if (i === 0) return null;
      const a = ac(i);
      const flag = a.lag1 < -0.2 ? '   <-- ALTERNATING' : '';
      return `  ${n.padEnd(5)} lag1 ${String(a.lag1).padStart(7)}   maxStep ${String(a.maxAbsDelta).padStart(9)}${flag}`;
    }).filter(Boolean);
    const last = R[R.length - 1];
    return [
      `carve capture  build ${typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'}`,
      `frames ${R.length}  state ${this.state}  track ${this.audio.grid?.id ?? '-'}`,
      `at capture: ${last[7]} km/h  u ${last[8]}m  edge ${last[5]}  air ${last[9]}`,
      '',
      'lag-1 autocorrelation of frame-to-frame deltas',
      '  (near +1 = smooth, below -0.2 = alternating every frame)',
      ...rows,
      '',
      `raw, oldest first: ${names.join(',')}`,
      ...R.map((row) => row.join(',')),
    ].join('\n');
  }

  /**
   * The overlay exists because three rounds were spent guessing at symptoms that
   * one line of on-screen state would have settled. It reports the things that
   * have actually been wrong: whether the trail has any geometry, what the board
   * is really doing with the lean, and where the camera has the rider.
   */
  _diagText(raw) {
    const r = this.rider;
    const fl = this._flick ?? {};
    const flick = fl.worst
      ? `${fl.worst} ${fl.value.toFixed(2)}${fl.value < -0.2 ? '  <-- ALTERNATING' : ''}`
      : 'warming up';
    const omega = Math.abs(r.edge) * (TUNE.turnBase + r.vh * TUNE.turnV);
    const radius = omega > 0.02 ? (r.vh / omega).toFixed(0) : '\u221e';
    const camOff = (this.camera.position.x - r.x).toFixed(1);
    return (
      `build ${typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'}\n` +
      `fps    ${(1 / Math.max(raw, 1e-3)).toFixed(0)}  scale ${this.renderScale.toFixed(2)}\n` +
      `input  ${this.input.connected ? 'sensor' : 'touch'}  ` +
      `lean ${this.input.x.toFixed(2)},${this.input.y.toFixed(2)}\n` +
      `edge   ${r.edge.toFixed(2)}  radius ${radius}m\n` +
      `trail  ${this.trail.samples.length} samples\n` +
      `u      ${r.u.toFixed(1)}m  camOff ${camOff}m\n` +
      `air    ${r.airborne ? 'yes' : 'no'}  speed ${(r.speed * 3.6).toFixed(0)}\n` +
      `flick  ${flick}`,
    );
  }

  _adaptResolution(frameSec) {
    // Menu frames run at quarter pixels and would teach the scaler that
    // everything is cheap; it would climb, and the first seconds of play would
    // pay the lesson back. Menus are not evidence about play.
    if (this._menuFactor() !== 1) { this._frameAcc = 0; this._frameCount = 0; return; }
    // ── HELD STILL WHERE THE PAGE IS CAPTURED ─────────────────────────────
    // Every step of this scaler RESIZES THE CANVAS BACKING STORE, and the
    // Editor log shows it firing constantly there (3379x1901 -> 3686x2074 ->
    // 3840x2160 within one session). In WKWebView's offscreen capture path a
    // resized WebGL canvas reallocates its surface, and a capture that keeps
    // sampling the orphaned one reads black canvas under crisp DOM,
    // persisting -- Elad's screenshot, letter for letter, with context loss
    // and buffer preservation both eliminated by measurement first. One
    // resize at boot is fine; the ban is on resizing DURING a session.
    if (this.host.transport === 'gobalance') {
      // ── ONE MEASUREMENT, ONE RESIZE, THEN FROZEN FOREVER ────────────────
      // The ban above is on resizing DURING a session, and it says so: "One
      // resize at boot is fine". Holding the scale at 1.00 for the whole
      // session obeyed the ban by never measuring at all, which left the
      // weakest device with no way to shed pixels -- so it shed FRAMES. A big
      // Android tablet reported as "not unplayable, but rigid" while a
      // flagship phone was fine on the same build and the same 1.6 Mpx: same
      // pixels, slower GPU, and nothing in the game able to notice.
      //
      // So: measure once, before play, and commit. The lobby is the right
      // place to do it because the attract mode behind the panels IS the game
      // playing itself -- a representative load, not an idle screen. After the
      // single commit this returns forever and the canvas never resizes again,
      // which is what the WebView actually requires.
      if (this._scaleCommitted) return;
      if (this.state === 'play') {           // never mid-run, whatever happens
        if (!this._scaleCommitted) {
          this._scaleCommitted = true;
          console.log(`[carve] render scale committed at ${this.renderScale.toFixed(2)} (unmeasured — play began first)`);
        }
        return;
      }
      this._frameAcc += frameSec;
      this._frameCount++;
      if (this._frameCount < 90) return;     // ~1.5 s, past any boot hitch
      const avgBoot = this._frameAcc / this._frameCount;
      this._frameAcc = 0;
      this._frameCount = 0;
      // Solve for the scale that would have hit 16.7 ms, in area terms, then
      // quantise so two similar devices do not land on neighbouring values.
      // Clamped to the same 0.6 floor the adaptive path uses: below that the
      // picture costs more than the frames are worth.
      const want = Math.sqrt(0.0167 / Math.max(avgBoot, 1e-4));
      const next = Math.max(0.6, Math.min(1, Math.round(want * 10) / 10));
      this._scaleCommitted = true;
      if (next !== this.renderScale) {
        this.renderScale = next;
        this._resize();
      }
      console.log(`[carve] render scale committed at ${this.renderScale.toFixed(2)} ` +
        `(boot avg ${(avgBoot * 1000).toFixed(1)}ms) — the canvas will not resize again`);
      return;
    }
    this._frameAcc += frameSec;
    this._frameCount++;
    if (this._frameCount < 60) return;
    const avg = this._frameAcc / this._frameCount;
    this._frameAcc = 0;
    this._frameCount = 0;
    let next = this.renderScale;
    if (avg > 0.0215 && this.renderScale > 0.6) next = this.renderScale - 0.12;
    else if (avg < 0.0136 && this.renderScale < 1) next = Math.min(1, this.renderScale + 0.08);
    if (next !== this.renderScale) {
      this.renderScale = next;
      this._resize();
      console.log(`[carve] render scale -> ${this.renderScale.toFixed(2)} (avg ${(avg * 1000).toFixed(1)}ms)`);
    }
  }

  /** The lobby screens, where the world is scenery rather than a game. */
  _wantsPostcard() {
    if (this._postcardBroken) return false;   // failed once; do not try every frame
    return this.state === 'title' || this.state === 'place';
  }

  /**
   * THE LOBBY IS A POSTCARD, NOT A RUNNING GAME.
   *
   * Measured 2026-10-18, one painted frame, counted by wrapping render():
   *
   *   solo menu     43 calls    413,284 tris      solo run    63 / 437,006
   *   2P   menu    118-138    1,578,000 tris      2P run     124 / 1,576,000
   *
   * Sitting in a menu cost 94% of a run in solo and 100% of it in two-player,
   * because attract mode is the game playing itself and nothing stopped. On
   * the tablet that is Elad's "when I go back to the menus it gets super duper
   * uber laggy" -- and it was worst after a two-player run, where the split
   * renderer kept drawing two world rings twice per frame behind a menu.
   *
   * So the world is rendered ONCE, kept as an image, and the loop stops. The
   * frame costs nothing to look at and the simulation stops with it.
   *
   * NOT A SHIPPED PNG, which is where Elad started ("a PNG background in the
   * main menu"): a rendered frame needs no art, and it carries the current
   * mood and place, so the lobby still looks like the mountain you are about
   * to ride rather than a picture of a different one.
   *
   * AIMED AT THE SKYLINE, because he then asked for "a BG of mountain tops".
   * The pose is vista.mjs's canonical 2-far shot -- lifted and aimed down the
   * corridor at the far range -- rather than the chase camera, which looks at
   * the back of a rider nobody is riding.
   *
   * THIS REVERSES A DELIBERATE CHOICE, and the comment it replaces says why:
   * attract mode ran on both lobby screens because freezing the moment you
   * picked a mode "would read as the game having hung". That reasoning was
   * about motion STOPPING under the player. Here nothing ever moves: the
   * postcard is taken on the first lobby frame and the same still carries
   * through to the place list, so there is no transition to misread.
   */
  _takePostcard() {
    const layer = this._el('postcard');
    if (!layer || this._frozen) return;
    // ── THE PAINTED LOBBY ─────────────────────────────────────────────────
    // Elad, asked for a background and then asked for the right thing: "i
    // dont want a printscreen from the game - i want to generate a good
    // looking art that fits us". So when the artwork is there, the lobby is a
    // PAINTING and the renderer does not run at all -- not even the single
    // frame the snapshot path needs.
    //
    // The rendered snapshot below stays as the fallback, and it is not dead
    // code: it is what a missing or failed image gets, and it is still a
    // better lobby than a live one. Nothing about this costs a frame either
    // way; the choice is purely what the player looks at.
    if (this._artReady) {
      layer.style.backgroundImage = `url(${LOBBY_ART})`;
      layer.hidden = false;
      this._frozen = true;
      return;
    }
    const r = this.rider;
    try {
      if (r) {
        // vista.mjs 2-far: lifted 16 m, 14 m back, aimed at the notch 320 m on.
        this._freeCam = { pos: [r.x, r.y + 16, r.z + 14], look: [0, r.y + 12, r.z - 320] };
        this.cameraRig.update(0, r, 0);
        const f = this._freeCam;
        this.camera.position.set(f.pos[0], f.pos[1], f.pos[2]);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(f.look[0], f.look[1], f.look[2]);
        this._aimWorldAt(this.camera, r);
        this.post.render();          // the skyline frame, single view even in 2P
        this._freeCam = null;
      }
      // JPEG, not PNG: this is a photograph of a mountain, and a lossless one
      // runs to megabytes of data URL for no visible gain.
      layer.style.backgroundImage = `url(${this.canvas.toDataURL('image/jpeg', 0.86)})`;
      layer.hidden = false;
      this._frozen = true;
    } catch (e) {
      // A tainted or zero-sized buffer must not cost the player a lobby.
      this._freeCam = null;
      console.warn('[carve] postcard failed, leaving the world live:', e?.message ?? e);
      this._postcardBroken = true;
    }
  }

  /** Back to a live world: a run is starting, or the frame is no longer valid. */
  _thawPostcard() {
    if (!this._frozen) return;
    this._frozen = false;
    const layer = this._el('postcard');
    if (layer) { layer.hidden = true; layer.style.backgroundImage = ''; }
  }

  /**
   * Attract mode behind the title and results panels: the game playing itself.
   * It is the same autopilot QA uses, so the menu background doubles as a live
   * demonstration that the course is actually rideable.
   */
  _updateIdle(dt) {
    if (!this.rider) return;
    this._dtSim = dt;
    // Keep the mountain scrolling by running the real physics with the real
    // steering — nothing here is a special case.
    const t = 6 + (this.time * 1.0) % Math.max(20, this.grid.durationSec - 12);
    this.rider.update(dt, this._autopilotLean());
    this.course.update(dt, t, this.rider, this._prevP, this._prevX);
    this._prevP = this.rider.p;
    this._prevX = this.rider.x;
    // `reference.totalDistance` IS NO LONGER A CONSTANT. The table grows on
    // demand now, so after one endless run it reads tens of kilometres and this
    // test would never fire again — the attract rider would descend behind the
    // menu forever, dragging the terrain ring and the scatter bands with it.
    // `_attractLoopP` is the lap-0 figure, captured at boot, which is what this
    // line always meant.
    if (this.rider.p > this._attractLoopP - 200) this._seekTo(4);
    this.mood.setProgress((this.time * 0.02) % 1);
    this.audio.silenceRide();
  }

  /**
   * Steer for the next gate not yet crossed.
   *
   * This inverts the rider's own model rather than guessing at gains. Lateral
   * position is reached through TWO integrations — edge sets a turn rate, the
   * turn rate swings the heading, the heading's lateral component moves `u` — and
   * hand-tuned proportional control of a double integrator either oscillates or
   * crawls, which is exactly what every attempt at it did here.
   *
   * So: solve for the lateral acceleration that puts the error at zero in the
   * time left, then divide by the acceleration a unit of edge actually produces.
   *
   *   e(T) = e - w*T - 0.5*a*T^2 = 0   =>   a = 2*(e - w*T) / T^2
   *   w  = -sin(yaw) * vh                      (lateral velocity)
   *   dw = cos(yaw) * vh * edge * (turnBase + vh*turnV)
   *
   * The autopilot is allowed to be a better rider than a human. It is not
   * allowed to be a different KIND of rider — it goes through the same edge, the
   * same turn model, the same lag and the same collisions.
   */
  _autopilotLean() {
    const gates = this.course.live;
    let best = null;
    for (const g of gates) {
      if (g.data.passed || g.data.p <= this.rider.p) continue;
      if (!best || g.data.p < best.p) best = g.data;
    }
    const r = this.rider;
    const targetU = best ? best.u : 0;
    const dist = Math.max(8, (best ? best.p : r.p + 45) - r.p);

    // Aim to be there a little early: the board takes about a fifth of a second
    // to come onto a new edge, on top of everything downstream of it.
    const T = Math.max(0.75, dist / Math.max(6, r.vh) - 0.30);
    const e = targetU - r.u;
    // The lateral velocity IN CORRIDOR SPACE. u is measured from a centre line
    // that MEANDERS — up to a third of a metre sideways per metre of descent —
    // so u̇ = -sin(yaw)·v - C'(p)·cos(yaw)·v. The controller originally used the
    // first term alone and so was blind to the corridor sliding out from under
    // it: it held a near-zero edge while u drained away at five metres a
    // second, discovered the error late, slammed full edge, and oscillated off
    // the piste. The uncapped canyon walls used to catch that; real valley
    // sides do not.
    const cp = (this.terrain.centerX(r.z - 2) - this.terrain.centerX(r.z + 2)) / 4;
    const w = (-Math.sin(r.yaw) - cp * Math.cos(r.yaw)) * r.vh;

    // Cap the demanded traverse. Solving the double integrator exactly is stable
    // on paper and divergent in practice: with no limit it drives the heading to
    // the yaw clamp, where the rate of descent collapses, the gate stops getting
    // closer, and the whole thing winds itself off the piste. A rider crossing
    // the fall line at more than about forty degrees has stopped going downhill.
    const maxW = 0.62 * r.vh;
    const wTarget = clamp(e / T, -maxW, maxW);
    // Gain scheduling on the frame time. This controller is a double
    // integrator commanded once per FRAME through a quarter-second actuator
    // lag; at sixty fps that is fine, at the five fps of a software rasteriser
    // the loop's sample time alone destabilises it and the bot oscillates its
    // way off the piste. Slower frames get proportionally gentler demands —
    // sluggish is recoverable, divergent is not.
    const gain = clamp(0.05 / Math.max(this._dtSim ?? 0.016, 0.05), 0.30, 1);
    const want = (wTarget - w) / 0.6 * gain;

    // Feed-forward for the bowl. Its parabolic cross-section steers the rider
    // back toward the centre line the whole time, hardest out near the rim —
    // exactly where the gates are. A controller blind to it is fighting a force
    // it cannot see, and settles short of every wide gate.
    const g = this.terrain.gradient(r.x, r.z);
    const mLat = g.gx * Math.cos(r.yaw) - g.gz * Math.sin(r.yaw);
    // Same sign as the rider's own bank term (+g·mLat — see rider.js): the
    // feed-forward must model the actual dynamics or it doubles the force
    // instead of cancelling it.
    const bankOmega = (TUNE.gravity * mLat / Math.sqrt(1 + mLat * mLat))
      / Math.max(r.vh, 6) * TUNE.bankPull;

    const authority = Math.cos(r.yaw) * r.vh * (TUNE.turnBase + r.vh * TUNE.turnV);
    const edge = clamp((want + Math.cos(r.yaw) * r.vh * bankOmega) / Math.max(authority, 1e-3), -1, 1);
    // Undo the input response curve. The autopilot reasons about EDGE, but what
    // it returns is a LEAN, and the rider raises that to a power before it
    // becomes an edge. Handing the edge straight back asked for a fraction of
    // the turn it had computed, and the bot quietly wandered off the piste.
    // `edgeExp`, not `edgeCurve`: the rider raises the lean by the RESIDUAL over
    // the pipeline's gamma, and the autopilot's lean does not go through the
    // pipeline at all. Inverting the design number instead of the applied one
    // would hand back an edge bent by the pipeline's share of a curve this path
    // never paid.
    let lean = Math.sign(edge) * Math.pow(Math.abs(edge), 1 / TUNE.edgeExp);
    // Slew-limit the command to what the edge actuator can follow. At sixty
    // fps this is no constraint at all; at a software rasteriser's five fps it
    // stops the bot flicking rail to rail between control updates, which is
    // what was still walking it off the piste after everything else was fixed.
    const dtc = Math.max(this._dtSim ?? 0.016, 0.016);
    const prev = this._apLean ?? 0;
    const step = 2.2 * dtc;
    lean = clamp(lean, prev - step, prev + step);
    this._apLean = lean;
    // A little tuck, never enough to eat the edge budget.
    const tuck = 0.25 * (1 - Math.abs(lean));
    const m = Math.hypot(lean, tuck);
    return m > 1 ? { x: lean / m, y: tuck / m } : { x: lean, y: tuck };
  }

  /**
   * Keep the gate plan and the kickers ahead of the rider, one lap at a time.
   *
   * Called every frame and does nothing on almost all of them: the guard is one
   * comparison, and the body runs once every 171 seconds.
   *
   * THE LEAD IS A LAP, NOT A HORIZON, and the reason is the kickers. A gate is a
   * prop that can be placed three and a half seconds before it is needed, but a
   * kicker is part of the height field — `Terrain.height` has to already contain
   * the ramp — and the mesh is built out to VIEW (560 m), which the rider covers
   * in about twenty-five seconds. Cutting a lap the moment the previous one
   * starts leaves that margin at roughly seven times over.
   *
   * Every lap gets its own seed. The beats repeat, so without it the eight
   * kickers would keep the same widths and heights forever; with it the music
   * is the only thing that comes round again.
   */
  _extendCourse(t) {
    const tracks = this.audio.tracks;
    // A FINITE MODE STILL NEEDS THE COURSE CUT AHEAD OF IT, just not forever.
    // The cutter is driven by the audio clock rather than by distance, and a
    // race is shorter than one pass of the music, so in practice this loop
    // plans one or two segments and then the race ends inside them. Left
    // unbounded it would keep cutting laps nobody rides.
    // Plan segment N while the rider is still riding segment N-1. A SEGMENT is
    // one pass over one track, so with a two-track playlist the segments
    // alternate grids and their lengths alternate with them — which is why the
    // start of segment N is accumulated rather than `n * duration`.
    for (let guard = 0; guard < 8; guard++) {
      const n = this._lapsPlanned;
      const grid = this.audio.trackAt(n).grid;
      const tOffset = this._segStart;
      if (tOffset >= t + grid.durationSec) break;
      const seed = (SEED ^ (n * 0x9e3779b1)) >>> 0;
      const prev = this.gatePlan[this.gatePlan.length - 1];
      const entries = planGates(grid, this.reference, seed, {
        tOffset,
        leadIn: 0,
        // Alternate across the seam: a lap restarting on the side the last one
        // ended asks the rider to hold still where the course should be asking
        // for the widest swing in it.
        startSide: prev ? -prev.side : undefined,
      });
      const lastK = this.kickers[this.kickers.length - 1];
      const cut = planKickers(grid, this.reference, seed, {
        tOffset,
        minT: 0,
        lastP: lastK ? lastK.p : -1e9,
        pOffset: this._courseOffset ?? 0,
      });
      // The mode shapes the plan before it is ridden — see `shapePlan`. The
      // race keeps one beat in three and drops the rest, so this may add fewer
      // gates than were planned, or none.
      this.gatePlan.push(...(this._mode?.shapePlan?.(entries) ?? entries));
      this.kickers.push(...cut);
      // Terrain re-sorts internally; the ramps must be in the height field
      // before any mesh containing them is built.
      this.terrain.setKickers(this.kickers);
      this.course.kickers = this.terrain.kickers;
      this._lapsPlanned++;
      this._segStart += grid.durationSec;
      console.log(`[carve] segment ${n} (${this.audio.trackAt(n).id}) cut at `
        + `${tOffset.toFixed(1)}s — ${entries.length} gates, ${cut.length} kickers, `
        + `plan now ${this.gatePlan.length}/${this.kickers.length}`);
    }
  }

  /** Write a camera value live AND into the mode that owns it. */
  _setCam(key, value) {
    TUNE[key] = value;
    const def = getMode(this._modeId);
    if (def?.camera && key in def.camera) def.camera[key] = value;
  }

  /**
   * Put the mode's camera and music in force for this run.
   *
   * THE CAMERA IS A PARTIAL of `TUNE`, applied over the boot values rather than
   * replacing them: a key a mode does not mention keeps whatever it booted
   * with, so adding a number to `TUNE` does not hand every mode a copy of it to
   * drift. `_tuneDefaults` is restored first, or a value tuned in one mode
   * would leak into the next through the keys the next one omits.
   *
   * THE MUSIC IS AN ORDER, not a reload — every track stays decoded and the
   * mode only says which of them this run plays. `pickMusic` is the mode's, so
   * chill vibe can keep all of them in sequence while the race takes one at
   * random.
   */
  _applyModeConfig(def) {
    Object.assign(TUNE, this._tuneDefaults);
    if (def.camera) Object.assign(TUNE, def.camera);
    const ids = this._mode.pickMusic?.(def.music ?? []) ?? def.music;
    if (ids?.length) this.audio.setOrder(ids);
    console.log(`[carve] mode ${def.id} — music [${this.audio.order.map((i) => this.audio.tracks[i].id).join(', ')}]`
      + `, cam back ${TUNE.camBack} up ${TUNE.camUp}`);
  }

  /**
   * What goes in the big central slot. The mode's if it has one, the clock's if
   * not — see `Hud.setClock` for why that slot may never show a countdown in a
   * mode that has no clock.
   */
  /**
   * Put the first gates on the hill before the run starts.
   *
   * `Course` only spawns from `_updatePlay`, which does not run during the
   * countdown, so the first gate appeared the instant the state changed. One
   * call at the run's own start time places everything already inside the
   * spawn horizon, with `dt` at zero and `prevP` equal to `p` so nothing is
   * counted as crossed and the pace estimator is not fed a bogus first sample.
   */
  _dressCourse() {
    if (!this.course) return;
    this.course.update(0, this._musicStart, this.rider, this.rider.p, this.rider.x);
  }

  /** Seconds since the run began — `audio.time` less where the track started. */
  get runTime() {
    return Math.max(0, this.audio.time - (this._musicStart ?? 0));
  }

  _readout() {
    return this._mode?.readout?.() ?? this.timer.state;
  }

  /**
   * The run is over and the panel is arriving; keep the rider gliding under it.
   * No input, none of the run logic -- just her physics, eased gently toward
   * rest so by the time the results are fully up she has slowed to a drift, then
   * frozen. Camera, trail and terrain already update every frame, so they follow
   * for free.
   */
  _updateCoast(dt) {
    this._coastT += dt;
    this.rider.update(dt, COAST_LEAN);
    this.rider.vh = Math.max(COAST_FLOOR, this.rider.vh - COAST_BRAKE * dt);
    this._prevP = this.rider.p;
    if (this._coastT >= COAST_S) this._coasting = false;
  }

  _updatePlay(dt) {
    this._dtSim = dt;
    const t = this.audio.time;

    if (this.input.stale) {
      this.state = 'sensor';
      this.audio.pause();
      this.hud.setLive(false);
      this.hud.setScreen('sensor');
      return;
    }
    // THE TRACK RUNNING OUT NO LONGER ENDS THE RUN. The music loops, the course
    // is re-cut per lap, and the only thing that stops a descent is running out
    // of wipeouts — see `_wipeout`. What used to be here was
    // `if (t >= durationSec - 0.15) this._endRun(true)`.
    this._extendCourse(t);

    // THE CLOCK IS THE TERMINATOR NOW. Drained before anything can pay into it,
    // so a gate taken on the frame the clock runs out cannot resurrect a run
    // that is already over — and with the REAL elapsed time, for the same reason
    // the physics gets it: a clamped dt would make the countdown run slow on a
    // bad frame, and a run would quietly last longer the worse the device was.
    // ONLY IF THE MODE HAS A CLOCK. The race does not — it ends at a line —
    // and a timer draining underneath it would expire mid-race and end a run
    // that was going perfectly well.
    if (this._mode.usesClock !== false) this.timer.tick(dt);
    // THE MODE'S OWN FRAME, and the contract in `mode.js` has always promised
    // it: "called every frame while playing, AFTER the world has moved". It was
    // never actually wired up, because neither mode needed it until the race
    // grew a field of rivals — they have to move after the player does, so a
    // place read this frame is read against where the player is NOW.
    this._mode.update?.(dt, this.time);
    // THE MODE DECIDES WHEN A RUN IS OVER. The clock is still drained here,
    // before anything can pay into it, so a gate taken on the frame it runs out
    // cannot resurrect a run that is already finished — but whether that ends
    // the run is chill vibe's rule, not the game's.
    const over = this._mode.ended?.();
    if (over) {
      this._endRun(over);
      return;
    }

    // ── NO FORE-AFT INPUT, IN EITHER MODE ─────────────────────────────────
    // Asked for directly. `y` was nose/tail pressure: a tuck tightens the arc
    // (`tuckTurnGain`) and takes up to 36% off the drag (`tuckDrag`), leaning
    // back scrubs. On a balance board that is a real axis; on the keyboard it
    // is two more keys doing something invisible, and it made the speed you
    // were carrying a function of a control most players never found.
    //
    // Zeroed HERE, at the one place lean enters the rider, rather than in
    // `input.js` -- so the autopilot is held to the same rule. It returns a
    // tuck of its own (see `_autopilotLean`), and letting the AI keep an axis
    // the player no longer has would quietly invalidate every pace measurement
    // taken with it, including the one the rivals' PACE_REF is anchored to.
    //
    // The physics keeps `tuck` and every constant behind it: this is the input
    // being disconnected, not the model being torn out, so a future mode with a
    // real sensor can hand it back by flipping one flag.
    const raw = this._autopilot ? this._autopilotLean() : this.input.lean;
    this._lean.x = raw.x;
    this._lean.y = FORE_AFT_INPUT ? raw.y : 0;
    const lean = this._lean;
    const prevP = this.rider.p;
    const prevX = this.rider.x;
    this.rider.update(dt, lean);
    this._updatePlayerTwo(dt);
    this._paintFinished();
    // LAP TIME, not run time. The beat grid describes one pass over the track,
    // so it has to be asked where we are inside the track. BeatPulse already
    // re-seeks when time goes backwards — that branch was written for a debug
    // seek and is exactly what a loop wrap needs — so the wrap costs nothing.
    // THE BEAT GRID FOLLOWS THE TRACK. Each track has its own `beats`, so the
    // pulse has to be handed the playing one — otherwise the second track drives
    // the HUD's flash and the carve rewards off the first track's beats, which
    // is the one desync a listener would hear immediately.
    const playingGrid = this.audio.grid;
    if (playingGrid && this.beat.beats !== playingGrid.beats) {
      this.beat.beats = playingGrid.beats;
      this.beat.reset();
    }
    this.beat.update(dt, this.audio.lapTime);
    if (this.beat.justFired) this.hud.beat();

    // Distance is scored directly, so speed pays even where the course does not.
    const gained = Math.max(0, this.rider.p - prevP);
    this.distance += gained;
    this.score += gained * 2;
    this.stats.top = Math.max(this.stats.top, this.rider.speed);
    if (this.rider.airborne) this.stats.air += dt;

    // The mood arc is a CYCLE now, not a one-way trip: dawn to alpenglow and
    // round again, once per pass over the track. `Mood.setProgress` wraps its
    // last stop back into its first, so the run keeps having somewhere to go
    // instead of sitting in alpenglow for as long as the player survives.
    // PINNED, or CYCLING FROM THE PLACE'S OWN HOUR.
    //
    // The race pins the light for the whole run. Chill vibe walks it with the
    // music, dawn to alpenglow and round again, which is the mode's whole idea
    // -- but it was walking it from the same starting point in every place, so
    // the hours a place declares did nothing here at all and THE NEEDLES looked
    // like THE BOWL. Reported exactly that way.
    //
    // The base is where this place's cycle STARTS. The descent still moves
    // through the whole day; it simply begins somewhere the place chose, so a
    // run on the needles opens in bluebird and one in the bowl opens at dawn.
    this.mood.setProgress(this._moodPin
      ?? (((this._moodBase ?? 0) + this.audio.lapTime / this.audio.duration) % 1));

    // ── gates ─────────────────────────────────────────────────────────────
    // ASKED ABOUT BOTH RIDERS, ONCE. The course is one piece of geography and
    // updating it twice would spawn, recycle and count everything twice; it
    // takes player two as an extra question and tags every event with `who`.
    // Before this, crossings were tested for player one alone, so player two
    // took no boosts, scored nothing from gates, and watched gates vanish in
    // front of him as player one passed them (BAL-594).
    const two = this.rider2
      ? { rider: this.rider2, prevP: this._prev2P ?? this.rider2.p, prevX: this._prev2X ?? this.rider2.x }
      : null;
    for (const ev of this.course.update(dt, t, this.rider, prevP, prevX, two)) {
      if (ev.who === 1) { this._gateForTwo(ev); continue; }
      if (ev.type === 'boost') {
        // ── A BOOST GATE, AND IT IS LOUD ──────────────────────────────────
        // "when the player goes through them we need to get much more
        // feedback." A slalom gate is a question answered correctly; this is
        // the course handing something over, and the two must not feel alike.
        // THROUGH THE MODE, so a run can make a gate worth more than the last
        // one. `takeBoost` advances the chain and hands back the ceiling and
        // hold it has earned; a mode without one falls back to its flat table.
        const b = this._mode.takeBoost?.(0) ?? this._mode.boost;
        // COUNTED, because in the race these are the only gates there are. The
        // stat was incremented on slalom gates alone, so a race that was made
        // entirely of boost gates reported "0 gates" on its results panel --
        // the same fault as the D and the score beside it: a readout that
        // belongs to the other mode, answering a question nobody asked.
        this.stats.gates++;
        this.rider.boost(b.seconds, b.addSpeed, b.ceiling);
        // The sound is handed the SAME `seconds` the rider is, so the surge
        // lasts exactly as long as the speed floor does. Tuning the boost in
        // the dev panel retunes its sound with it, which is the only way these
        // two stay honest about each other.
        this.audio.boost(b.seconds);
        // The chain is only a mechanic if the player can see it building, so it
        // is on the callout from the second gate on. Not on the first: "boost
        // x1" is noise, and the word alone is what the first one means.
        this.hud.callout(b.chain > 1 ? `boost x${b.chain}` : 'boost',
          { big: true, color: '#a78bfa' });
        this._gateBurst.set(0xa78bfa);
        // Four times the spray of a slalom gate, thrown UP and forward out of
        // the gate rather than scattered: a plume you ride into.
        this.particles.emit(
          { x: ev.gate.x, y: this.terrain.height(ev.gate.x, ev.gate.z) + 1.2, z: ev.gate.z },
          this._gateBurst,
          { count: 64, speed: 13, size: 2.2, life: 1.0, up: 8, spread: 1 },
        );
        this.post.punch(0.42, this._gateBurst);
        this.cameraRig.kick(0.5);
        this.host.haptic('success');
      } else if (ev.type === 'boostMiss') {
        // Nothing punishing — a boost gate missed costs the boost, and that is
        // the whole cost. A miss sound here would read as a penalty for not
        // taking a reward.
        this.hud.gate(false);
      } else if (ev.type === 'gate') {
        this.stats.gates++;
        // ── A TIME GATE PAYS, AND SAYS SO ─────────────────────────────────
        // "I go through them, it's not clear what happens. I need to feel that
        // something happened and I got more time." In chill the plain gate IS
        // the economy, so it announces like one: the seconds on a big amber
        // callout, a chime that rises (time going UP), an amber plume from the
        // gate itself, a punch, and the clock's own flash -- against the race's
        // quiet slalom tick, which stays quiet on purpose: there a gate is a
        // question answered, not a payment received.
        if (ev.timed) {
          const got = this._grantTime(CLOCK.gate, 'time', { big: true, color: '#d6ff5a' });
          this.hud.clockFlash(got);
          this.audio.timeGate();
          this._gateBurst.set(0xd6ff5a);
          this.particles.emit(
            { x: ev.gate.x, y: this.terrain.height(ev.gate.x, ev.gate.z) + 1.1, z: ev.gate.z },
            this._gateBurst,
            { count: 40, speed: 10, size: 1.9, life: 0.9, up: 6, spread: 1 },
          );
          this.post.punch(0.26, this._gateBurst);
          this.cameraRig.kick(0.3);
          this.host.haptic('success');
        } else {
          this._grantTime(CLOCK.gate, null);
        }
        this.gateTiming.push(Math.abs(ev.gate.hitT - ev.gate.t));
        this.gateDetail.push({
          beatT: +ev.gate.t.toFixed(2),
          err: +(ev.gate.hitT - ev.gate.t).toFixed(3),
          p: Math.round(ev.gate.p),
          wantU: +ev.gate.u.toFixed(1),
          gotU: +(ev.gate.uAt ?? 0).toFixed(1),
        });
        this._award(100, null);
        this.hud.gate(true);
        this.audio.gate();
        // ── FEEDBACK AT THE GATE, not only on the HUD ─────────────────────
        // Clearing a gate is the most frequent thing a player does right — one
        // every 4.08 s — and it was acknowledged by a ring on the progress bar
        // at the bottom of the screen, a short burst, and a 0.06 punch. All of
        // it landed somewhere other than where the player was looking, which is
        // through the gate.
        //
        // A spray in the gate's own colour, thrown from the gate's own
        // position, so the cue is where the act was. The colour is the mark's,
        // not the panel's: the panels are deliberately DARKER than the snow
        // (see the note on `matBlue`), and a dark spray on white snow is a
        // smudge.
        if (!ev.timed) {
          this._gateBurst.set(ev.gate.red ? 0xff9db4 : 0xd6a6dc);
          this.particles.emit(
            { x: ev.gate.x, y: this.terrain.height(ev.gate.x, ev.gate.z) + 1.0, z: ev.gate.z },
            this._gateBurst,
            { count: 16, speed: 7, size: 1.5, life: 0.7, up: 4, spread: 1 },
          );
        }
        // Twice the old punch and in the gate's colour rather than the haze's,
        // so it reads as a thing that happened rather than as the light moving.
        this.post.punch(0.13, this._gateBurst);
        this.hud.setCombo(this.mult);
      } else {
        this.gateDetail.push({
          beatT: +ev.gate.t.toFixed(2), err: +(ev.gate.hitT - ev.gate.t).toFixed(3),
          p: Math.round(ev.gate.p), wantU: +ev.gate.u.toFixed(1),
          gotU: +(ev.gate.uAt ?? 0).toFixed(1), MISS: true,
        });
        this.hud.gate(false);
        this.combo = 0;
        this.audio.missed();
        this.hud.callout('missed gate', { color: '#ff5d78' });
        this.hud.setCombo(this.mult);
      }
    }

    // ── carves ────────────────────────────────────────────────────────────
    if (this.rider.justCarved) {
      const c = this.rider.justCarved;
      this.stats.carves++;
      const points = clamp(Math.round(c.quality * 1.1), 20, 400);
      this._award(points, c.quality > 120 ? 'clean carve' : null,
        { color: '#8fd0ff' });
      this.audio.carveReward(Math.floor(this.combo / 3));
      this.hud.setCombo(this.mult);
    }

    // ── air ───────────────────────────────────────────────────────────────
    if (this.rider.airborne && !this._wasAirborne) this.audio.takeoff();
    this._wasAirborne = this.rider.airborne;
    if (this.rider.justLanded) {
      const l = this.rider.justLanded;
      this.hud.land(l);
      this.stats.jumps++;
      // ── trick, awarded on the landing ─────────────────────────────────────
      // `l.trick` is the rider's own report: { name, value, landed, spinDeg,
      // phase, airTime }. It is also on `rider.justTrick` for this one frame.
      // Whether the rotation finished is already folded into `l.clean`, so a
      // trick pays through exactly the path a jump always paid through — one
      // award, one combo step, no parallel scoring.
      const tk = l.trick;
      if (l.clean) {
        const points = clamp(Math.round(l.airTime * 220), 30, 900);
        this._award(points, `${l.airTime.toFixed(1)}s air`, { big: l.airTime > 1.2, color: '#ffd166' });
        // A KICKER WOULD OTHERWISE BE A TIME HOLE, which is backwards for the
        // most exciting thing on the mountain. `Course._nearKicker` suppresses
        // gates for the run-up plus 72 m past the lip, and airtime is above the
        // grab window (GRAB_UP is 2.6 m), so ~90 m — about 4.6 s at 70 km/h —
        // around every jump pays nothing at all, once every 21 s. This is what
        // fills that hole, and it is paid on the LANDING so it is earned rather
        // than granted for leaving the ground.
        this._grantTime(CLOCK.kicker, null);
        if (tk) {
          this.stats.tricks++;
          this.lastTrick = tk;
          this._award(tk.value, tk.name, { big: tk.value >= 350, color: '#c58cff' });
        this.audio.trick(tk.value);
        }
      } else {
        this.combo = 0;
        this.hud.callout(tk ? `bailed ${tk.name}` : 'sketchy landing', { color: '#ff9d5c' });
      }
      this.audio.land(l.impact, l.clean);
      this.cameraRig.kick(clamp(l.impact / 24, 0.1, 1.0));
      this.particles.emit(this.rider.world, this.mood.uSnowColor, {
        count: Math.round(clamp(l.impact * 1.6, 12, 60)), speed: 9, size: 1.6, life: 1.0, up: 3,
      });
      this.post.punch(0.10, this.mood.uSnowColor);
      this.hud.setCombo(this.mult);
    }

    // ── spray ─────────────────────────────────────────────────────────────
    // Emission is rate-based rather than per-frame, so the plume looks the same
    // whatever the frame rate — the one place a particle system usually lies.
    // Spray only when the edge is genuinely loaded. At a 0.10 gate and 14/s
    // baseline the puffs overlapped into a continuous glowing contrail down
    // the whole run — brighter than the snow, caught by the bloom, and it was
    // THIS the eye read where the carve line should have been. A rooster tail
    // is a burst under a hard carve, not a beam.
    const bite = Math.abs(this.rider.edge) * clamp(this.rider.vh / 22, 0, 1.4);
    if (!this.rider.airborne && bite > 0.30) {
      this._sprayAcc = (this._sprayAcc ?? 0) + dt * (bite * 26);
      const n = Math.floor(this._sprayAcc);
      this._sprayAcc -= n;
      if (n > 0) {
        // Thrown off the uphill side of the board, up and back.
        const s = -Math.sign(this.rider.edge);
        const dir = new THREE.Vector3(
          this.rider.right.x * s * 0.55 - this.rider.heading.x * 0.35,
          0.75,
          this.rider.right.z * s * 0.55 - this.rider.heading.z * 0.35,
        );
        this.particles.emit(this.rider.world, this.mood.uSnowColor, {
          count: Math.min(n, 5), speed: 2.5 + bite * 6, size: 0.8 + bite * 0.8,
          life: 0.45 + bite * 0.4, dir, spread: 0.5, up: 1.2 + bite * 2.2,
        });
      }
    }

    // ── THE SKIRT AT THE TAIL ─────────────────────────────────────────────
    // A separate emitter from the rooster tail above, and it has a different
    // job: the rooster tail is a BURST under a hard carve, thrown up and to the
    // uphill side. This is a low, dense, short-lived cloud sitting on the snow
    // at the board's tail, and the only thing it is for is covering the seam
    // where the trench begins. Asked for as "thick particles at the back end of
    // my board to cover up those really clear straight lines".
    //
    // The ribbon's own head fade (see `uHead` in trail.js) does most of the
    // work; this is what makes the handover look like thrown snow rather than
    // like a gradient.
    //
    // GATED ON SPEED, NOT ON EDGE, because the seam is there whenever the
    // trench is, including running dead flat -- which is exactly when the old
    // spray was silent and the straight line was most obvious.
    //
    // The warning above applies and is respected: at 14/s and a long life the
    // puffs used to merge into a glowing contrail brighter than the snow. This
    // one lives 0.3 s, barely rises, and is emitted BEHIND the board, so it is
    // gone within a metre and never gets the length to read as a beam.
    const roll = clamp(this.rider.vh / 16, 0, 1);
    if (!this.rider.airborne && roll > 0.12) {
      // ── SCALED BY THE MODE, BECAUSE IT IS SCALED BY THE CAMERA ──────────
      // The skirt was sized against the race's camera, four metres behind the
      // board. Chill vibe sits at thirteen, where the same cloud covers three
      // times the screen and reads as a smoke machine rather than as thrown
      // snow: "way too strong because the camera is far away, it looks bad".
      //
      // A multiplier rather than a second emitter -- it is the same effect at
      // the same place, seen from further away, and the honest fix is less of
      // it. It scales the RATE and the SIZE together; the lateral jitter stays,
      // because the seam it covers is the same width whatever the camera does.
      const sk = this._modeDef?.skirt ?? 1;
      this._skirtAcc = (this._skirtAcc ?? 0) + dt * (17 + roll * 31) * sk;
      const m = Math.floor(this._skirtAcc);
      this._skirtAcc -= m;
      if (m > 0) {
        this._skirtAt = this._skirtAt ?? new THREE.Vector3();
        this._skirtDir = this._skirtDir ?? new THREE.Vector3();
        // WIDER IS A POSITION, NOT A SPREAD. `spread` scatters the VELOCITIES
        // out of one point, so raising it makes a cone that is wide only once
        // the puffs have flown — which is late, and by then they have also
        // risen. Jittering the emission point ACROSS the board instead gives
        // the cloud its width at birth, where the seam is, and every tick lands
        // somewhere different along the edge that is actually cutting.
        const across = (Math.random() - 0.5) * 1.05;
        // At the TAIL — three quarters of a metre back down the board — and on
        // the snow rather than at the rider's waist.
        this._skirtAt.set(
          this.rider.world.x - this.rider.heading.x * 0.75 + this.rider.right.x * across,
          this.rider.world.y,
          this.rider.world.z - this.rider.heading.z * 0.75 + this.rider.right.z * across,
        );
        this._skirtDir.set(-this.rider.heading.x, 0.32, -this.rider.heading.z);
        this.particles.emit(this._skirtAt, this.mood.uSnowColor, {
          count: Math.min(m, 5), speed: 1.1 + roll * 1.6,
          size: (1.5 + roll * 0.95) * sk,
          life: 0.34, dir: this._skirtDir, spread: 1.15, up: 0.55 + roll * 0.7,
        });
      }
    }

    // ── collisions ────────────────────────────────────────────────────────
    const hit = this.rider.crashTimer <= 0 && this.rider.invuln <= 0
      ? this._hitScatter(this.rider.x, this.rider.z)
      : null;
    if (hit && !this.rider.airborne) {
      // "Without bumping into anything" is the rule the chain is built on, so
      // CONTACT is what ends it -- not a missed gate, which keeps what you have.
      this._mode.breakChain?.();
      this._wipeout(hit.kind === 'tree' ? 'tree!' : 'rock!');
      if (this.state === 'over') return;
      // Off the groomed line the trees come in stands, not singles. The
      // standard 1.6 s of grace expired exactly one trunk short of the piste,
      // and a slow rider threading home lost the whole run to one bad exit.
      if (Math.abs(this.rider.u) > HALF) this.rider.invuln = 2.6;
    }
    // Off the map entirely: the valley walls are not rideable, so treat leaving
    // as a wipeout rather than letting the rider climb into the scenery.
    if (Math.abs(this.rider.u) > HALF * 1.9 && this.rider.invuln <= 0) {
      this._mode.breakChain?.();
      this._wipeout('off piste!');
      if (this.state === 'over') return;
      // Steer back toward the bowl, hard, and with enough grace time to
      // actually get back inside the line. At 0.7 rad and 1.6 s a slow rider
      // pointed home was still outside when the invulnerability lapsed, and
      // one mistake became three wipeouts in seven seconds — the exact death
      // spiral every zero-input run ended in.
      //
      // Toward home means heading.x opposing u: hx = -sin(yaw), so for u > 0
      // the yaw must be POSITIVE. This shipped negated — the mercy pointed the
      // rider deeper into the scenery, and each grace period was spent climbing
      // further from the piste it was meant to return them to.
      this.rider.yaw = Math.sign(this.rider.u) * 1.05;
      this.rider.invuln = 3.0;
    }

    // ── milestones and feedback ───────────────────────────────────────────
    if (this.combo > 0 && this.combo % 20 === 0 && this.combo !== this._lastMilestone) {
      this._lastMilestone = this.combo;
      this.hud.callout(`${this.combo} streak`, { big: true, color: '#97d700' });
      this.post.punch(0.18, this.mood.uFogSunColor);
    }

    // THE MUSIC CLOSES UP AS THE CLOCK RUNS DOWN. This used to read the wipeout
    // pips — `wipeouts / WIPEOUTS + combo / 60` — and there are no pips any more.
    // Pointing the same filter at the clock costs nothing and is better than what
    // it replaced: a discrete three-step ladder becomes a continuous one that
    // only starts closing at CLOCK.lowAt, so a player in trouble HEARS it before
    // they have time to look at a number.
    this.audio.setClarity(Math.min(1,
      this.timer.remaining / CLOCK.lowAt + this.combo / 60));
    const speedNorm = clamp((this.rider.speed - SPEED_LO) / (SPEED_HI - SPEED_LO), 0, 1);
    // The 4th argument is how far off the groomed piste the board is. The
    // 0.88..1.04 band is lifted from the snow shader's own corduroy fade, so
    // the sound changes exactly where the grooming visibly ends.
    this.audio.setRide(speedNorm, bite, this.rider.airborne ? 1 : 0,
      clamp((Math.abs(this.rider.u) / HALF - 0.88) / 0.16, 0, 1));

    // Not when the mode has taken the slot for something else -- the race
    // shows PLACE there, and a score written over it every frame would win.
    if (!this._hidesScore) this.hud.setScore(this.score);
    // `audio.time` and not a counter of our own: it is the run's elapsed
    // seconds, it freezes while paused because the transport does, and it is
    // the same number `_endRun` reports as `durationMs` — so the HUD and the
    // results screen cannot disagree about how long a run was.
    this.hud.setRunTime(this.runTime);
    // Per-frame rather than per-event: _wipeout zeroes the combo without
    // telling the HUD, so the multiplier read stale after every crash.
    this.hud.setCombo(this.mult, this.combo);
    // The bar reads the MOOD CYCLE, not the run: an endless descent has no
    // fraction of itself to be at. It still means what it looked like it meant —
    // how far through this light we are — and it is the one readout that told
    // the player the sky was about to change. What it no longer is, is a
    // countdown to the end.
    // THE BAR BELONGS TO THE MODE WHEN THE MODE HAS SOMETHING TO PUT IN IT. In
    // chill vibe it reads the mood cycle — an endless descent has no fraction of
    // itself to be at. In the race it reads the distance still to run, which is
    // the thing the player is actually racing toward.
    this.hud.setProgress(this._mode.progress?.() ?? (this.audio.lapTime / this.audio.duration));
    this.hud.setSpeed(this.rider.speed * 3.6);
    this.hud.setEdge(this.rider.edge, this.rider.carveHold);
  }
}

const game = new Game();
game.boot();

// Recovering from a sensor drop: the reconnect screen watches for packets to
// come back rather than requiring a tap, so the player can just stand up again.
//
// The two halves of the condition are now both answered by the shim rather than
// guessed at. `live(0)` is "a sensor has driven this slot at some point", which
// is what put the run on the sensor screen in the first place; `stale(0)` is
// "and it has gone quiet". So the run pauses on `live && stale` (`_updatePlay`,
// via `input.stale` — the shim's `stale()` already implies `live`) and resumes
// on `live && !stale`, with nothing inferred from whether the host bothers to
// send `sensor`. The old derivation could not answer either question until
// after the drop had happened, and a host that DID report state 'lost' would
// have driven `connected` false and stranded the player on the screen forever.
setInterval(() => {
  if (game.state === 'sensor' && game.input.connected && !game.input.stale) {
    game._resumeFromPause();
  }
}, 250);
