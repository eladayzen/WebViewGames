// WHAT THE GAME REPORTS, and the one place that knows how to report it.
//
// The board's app has a complete analytics layer -- every event lands in Google
// Analytics AND in a Firestore mirror at users/{uid}/event_log, stamped with the
// sub-profile -- and web games were wired into none of it until Skateboard
// Extreme proved the path end to end.
//
// Nothing here throws and nothing blocks a frame. With no host at all (a plain
// dev URL, which is where this game is built and tested) every call is a no-op.
// Same shape as systems/scoreboard.js, and for the same reason: the development
// path has to keep working.
//
// THE NAMES HERE ARE BARE ON PURPOSE -- `level_end`, not `nova_level_end` and
// not carrying a `game` parameter. The BRIDGE adds both, because it knows the
// game folder and a web page does not get to be trusted about it anyway.
//
// IDS AND NUMBERS ONLY. No free text, no player input, nothing identifying --
// every value below is either a number the game computed or an id from its own
// content files.

/**
 * THE SHARED VOCABULARY. Identical to Skateboard Extreme's, deliberately and to
 * the letter -- same five events, same fourteen parameters, same spellings.
 *
 * That is the whole point of it. These names are registered in GA4 once, as
 * custom dimensions and metrics, and a parameter that is not registered is
 * invisible in every report forever. If this file invented `sector_id` where the
 * other says `level_id`, Nova's data would need its own registration, its own
 * column in every report, and could never be compared with anything.
 *
 * So a SURFACE here is a LEVEL, exactly as a mission or a race is a level there.
 * The mapping is the interesting part of this file; the vocabulary is fixed.
 *
 * WHY A SURFACE AND NOT THE CAMPAIGN. One Nova run crosses five surfaces and
 * ends when the player dies or beats the last boss. Reporting the campaign as a
 * single level would answer "did they finish" and nothing else -- while the
 * question worth asking is WHERE a run ends, which is exactly what a per-surface
 * level_end gives. It is the same shape as a mission ladder: five steps, and the
 * useful number is the one people do not get past.
 */
const EV = {
  /** One run begins -- the campaign starts, or is restarted. */
  START: 'start_game',
  /** A surface begins, including after a transition from the one before it. */
  LEVEL_START: 'level_start',
  /** That surface ended, however it ended. See RESULT. */
  LEVEL_END: 'level_end',
  /** A setting was changed, named by `setting`. */
  SETTINGS: 'settings_changed',
  /** They left the game for the app. */
  END: 'game_end',
  /**
   * Still playing, every 30 seconds, carrying the time played so far.
   *
   * The only event here that exists for a measurement rather than a moment --
   * see the session block below for why an end event alone cannot be trusted.
   */
  HEARTBEAT: 'heartbeat',
};

/**
 * How a surface ended.
 *
 * `clear` is surviving it -- the boss died and the campaign moved on. `fail` is
 * the player dying on it, which is the only other way a surface ends here.
 *
 * `quit` and `dnf` are in the shared vocabulary and are deliberately unused by
 * this game: Nova has no mid-run exit of its own (leaving goes through the app's
 * back button, which ends the session rather than the level) and no race. An
 * unused value costs nothing; inventing a sixth would cost a registration.
 */
const RESULT = { CLEAR: 'clear', FAIL: 'fail' };

const host = () => (typeof window !== 'undefined' ? window.GoBalance : null);

/**
 * Whether the host can take events at all.
 *
 * CHECKED PER CALL, NOT CACHED, and that is not paranoia. The app injects its
 * own SDK as the first script in <head>, and systems/gbSdk.js then adds the one
 * method it lacks -- so `logEvent` appears slightly after the page starts. A
 * cached answer taken at module load would be false forever.
 */
function available() {
  const h = host();
  return !!(h && typeof h.logEvent === 'function');
}

/**
 * Send one event. The only function in this file that talks to the host.
 *
 * SWALLOWS EVERYTHING. Analytics is the least important thing the game does and
 * must never be able to break it: a host that throws, a rejected promise, a
 * bridge that has gone away mid-run are all silently nothing. No retry and no
 * queue -- a dropped event is a dropped event, which is the right trade.
 */
function send(name, params) {
  if (!available()) return;
  try {
    const r = host().logEvent(name, params);
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch {
    // See above.
  }
}

/** Rounded to whole numbers -- GA sums and averages these, and a float tail from
 *  a frame-timed value is noise in every report it appears in. */
const whole = (n) => Math.max(0, Math.round(n || 0));

/** 0-100, clamped. The one shape every "how far did they get" answer takes. */
function pct(done, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

/** Monotonic where possible; Date.now() is only a fallback for a very old
 *  WebView, and a clock that steps backwards would produce negative durations. */
function now() {
  return (typeof performance !== 'undefined' && performance.now)
    ? performance.now() : Date.now();
}

// --- the session, and how long it really lasted -----------------------------
//
// A "session" is one visit to the GAME, not one run.
//
// YOU CANNOT RELY ON BEING TOLD IT ENDED. Amit: "people can shut down the app
// without closing the game." A player who kills the app, presses home, or runs
// out of battery never reaches leaveToLobby(), so a design that only reports
// duration at the exit loses those sessions entirely.
//
// That is worse than missing data, because the loss is BIASED: the sessions that
// end abruptly skew long, so average play time would read low and look like a
// retention problem that is not real.
//
// SO THE HEARTBEAT CARRIES THE ANSWER. Every 30 seconds a `heartbeat` event goes
// out carrying the total time played so far, which makes the rule for reading it
// simple and exit-proof:
//
//     time played = duration_seconds on the LAST event received
//
// No end event required. However the session dies, the answer is already
// recorded, accurate to within one interval. `game_end` is still sent on a clean
// exit, where it is exact and marks the session properly closed.
//
// IT COSTS NO GA4 CONFIGURATION. Registration is per PARAMETER, not per event,
// and `duration_seconds` and `level_id` are already registered -- so a new event
// reusing them needs nothing set up. Two events a minute against the bridge's
// 60/minute limit is also nothing.
//
// TIME PLAYED IS ACTIVE TIME, NOT WALL CLOCK. The clock stops while the page is
// hidden and resumes when it comes back. A player who backgrounds the app over
// lunch and returns has not played for an hour, and a duration that said so
// would poison every average it touches.
const HEARTBEAT_MS = 30000;

/** Whether a session is open at all. Distinct from `playedMs > 0`, since a
 *  session that has just begun has legitimately played for zero. */
let inSession = false;
/** Active milliseconds banked from previous visible stretches. */
let playedMs = 0;
/** When the current visible stretch began, or 0 while hidden. */
let resumedAt = 0;
let beat = null;
let runs = 0;
/** Attempts per surface id, within this session. The question is "did they keep
 *  trying now", not a lifetime total. */
const attempts = Object.create(null);
/**
 * The surface in progress.
 *
 * SNAPSHOTTED AT START AND NEVER RE-READ. Skateboard Extreme had a bug here
 * worth not repeating: it read the current mode at SEND time, so a level ending
 * while the next run was already starting got stamped with the wrong one. The
 * facts a level_end needs are the facts that were true when it began.
 */
let current = null;

/** Active seconds played this session, counting the stretch in progress. */
function playedSeconds() {
  const live = resumedAt ? now() - resumedAt : 0;
  return Math.max(0, Math.round((playedMs + live) / 1000));
}

/** One heartbeat. Carries the level so a long session can still be attributed
 *  to where it was spent, and skipped entirely outside a session. */
function sendBeat(force) {
  if (!inSession) return;
  // The interval keeps firing while the page is hidden -- throttled, but firing
  // -- and every one of those would re-send the same frozen number. The hide
  // handler sends one deliberately (force) and then there is nothing to say
  // until the page comes back.
  if (!resumedAt && !force) return;
  const params = { duration_seconds: playedSeconds() };
  if (current) params.level_id = current.id;
  send(EV.HEARTBEAT, params);
}

/**
 * Page visibility, installed once and never removed.
 *
 * ON HIDE the clock stops and a final heartbeat goes out immediately, because
 * backgrounding is how most app shutdowns begin -- this is usually the last
 * moment anything can be sent, and `visibilitychange` fires on Android where
 * `pagehide` often does not.
 *
 * HIDING DOES NOT END THE SESSION. A player who takes a call and comes back is
 * still in the same visit, and ending it here would either lose the rest or
 * start a phantom second session.
 */
function watchVisibility() {
  if (typeof document === 'undefined' || watchVisibility.done) return;
  watchVisibility.done = true;
  document.addEventListener('visibilitychange', () => {
    if (!inSession) return;
    if (document.visibilityState === 'hidden') {
      if (resumedAt) { playedMs += now() - resumedAt; resumedAt = 0; }
      sendBeat(true);
    } else if (!resumedAt) {
      resumedAt = now();
    }
  });
}

/** The parameters every level event carries. Nova sends no `place`, so there is
 *  room inside the bridge's nine-parameter budget without choosing. */
function base() {
  return {
    level_id: current.id,
    level_number: current.number,
    attempt: current.attempt,
    mode: 'campaign',
  };
}

export const analytics = {
  /**
   * A run has begun -- the campaign starting, or restarting after a death.
   *
   * Fired per RUN rather than once per session, because the useful funnel is
   * open_game (which the app's launcher sends) -> did they actually start -> how
   * far did they get. Once-per-session would lose the middle, and Nova is a game
   * people retry.
   */
  runStarted() {
    if (!inSession) {
      inSession = true;
      playedMs = 0;
      resumedAt = now();
      watchVisibility();
      if (beat) clearInterval(beat);
      beat = setInterval(sendBeat, HEARTBEAT_MS);
    }
    runs += 1;
    current = null;
    send(EV.START, { mode: 'campaign' });
  },

  /**
   * A surface has begun. Called for the first one and for each transition.
   *
   * @param {string} id      the surface id, e.g. 'ashfall'
   * @param {number} number  1-based position in the campaign
   */
  levelStarted(id, number) {
    attempts[id] = (attempts[id] || 0) + 1;
    current = { id, number, attempt: attempts[id], at: now(), score: 0 };
    send(EV.LEVEL_START, base());
  },

  /**
   * Survived it -- the boss died and the campaign moved on, or the last boss
   * died and the campaign is over.
   *
   * @param {number} score  run score so far, not surface score: Nova scores one
   *                        continuous run, and splitting it per surface would
   *                        invent a number the game does not keep.
   *
   * NO `stars` AND NO `runs` HERE, and both omissions are deliberate. Nova has
   * no star rating, and sending 0 would not mean "no stars available" -- it
   * would mean "earned none", dragging down any average taken across games.
   * `runs` means runs started in one visit and belongs to game_end; borrowing it
   * to carry a wave count would corrupt that metric everywhere it is read. An
   * absent parameter is the honest way to say a game does not have something.
   */
  levelCleared(score) {
    if (!current) return;
    send(EV.LEVEL_END, {
      ...base(),
      result: RESULT.CLEAR,
      score: whole(score),
      progress_pct: 100,
      duration_seconds: whole((now() - current.at) / 1000),
    });
    current = null;
  },

  /**
   * Died on it. `wavesDone` of `wavesTotal` is how far into the surface they
   * got, which is the number that says whether a surface is slightly too hard
   * or wildly mis-tuned -- the same job progress_pct does for a mission.
   */
  levelFailed(score, wavesDone, wavesTotal) {
    if (!current) return;
    send(EV.LEVEL_END, {
      ...base(),
      result: RESULT.FAIL,
      score: whole(score),
      progress_pct: pct(wavesDone, wavesTotal),
      duration_seconds: whole((now() - current.at) / 1000),
    });
    current = null;
  },

  /**
   * One setting changed, named rather than baked into the event.
   *
   * `setting_value`, not `value`: GA4 treats a bare `value` as the monetary
   * amount on an event and pairs it with `currency`, so a sensitivity of 60
   * would quietly become revenue in any report that touches it.
   */
  settingChanged(setting, value) {
    send(EV.SETTINGS, { setting, setting_value: whole(value) });
  },

  /** The player has left the game for the app. Pairs with the launcher's
   *  open_game and carries the two numbers that event cannot know. */
  gameLeft() {
    if (!inSession) return; // never played; the launcher already logged the open
    if (resumedAt) { playedMs += now() - resumedAt; resumedAt = 0; }
    send(EV.END, { duration_seconds: playedSeconds(), runs });
    if (beat) { clearInterval(beat); beat = null; }
    inSession = false;
    playedMs = 0;
    runs = 0;
    current = null;
  },

  /** For a headless check: whether the host would take an event right now. */
  isAvailable: available,
};
