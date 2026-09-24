// WHAT THE GAME REPORTS, and the one place that knows how to report it.
//
// The board's app has a complete analytics layer -- every event lands in Google
// Analytics AND in a Firestore mirror at users/{uid}/event_log, stamped with the
// sub-profile -- and web games were wired into none of it.
//
// Nothing here throws and nothing blocks a frame. With no host at all (a plain
// dev URL, which is where this game is built and tested) every call is a no-op.
// Same shape as systems/gbProfile.js, and for the same reason: the development
// path has to keep working.
//
// THE NAMES HERE ARE BARE ON PURPOSE -- `level_end`, not `skateboard_level_end`
// and not carrying a `game` parameter. The BRIDGE adds both, because it knows
// the game folder and we do not get to be trusted about it anyway. Keeping the
// game out of our payload means their naming decision never edits this file.
//
// IDS AND NUMBERS ONLY. No free text, no player input, nothing identifying --
// every value below is either a number we computed or an id from our own
// content files. A web page is the least trusted thing in the system and should
// not be the source of anything else.

/**
 * THE SHARED VOCABULARY -- and the reason it does not mention skateboarding.
 *
 * The obvious way to write this file is in the words of THIS game: mission_clear,
 * race_dnf, metres_short. That is what it used to say, and it is a trap. Those
 * names have to be registered in GA4 as custom dimensions one by one, so the next
 * game brings its own seventeen, and nothing can ever be asked ACROSS games --
 * not "which game retains best", not "where in a ladder do we lose people", not
 * even a single completion-rate number for the catalogue. Every question forks
 * per title, and the config grows without bound.
 *
 * So the vocabulary is deliberately generic. A mission and a race are both a
 * LEVEL; clearing, failing, quitting and timing out are all one `level_end`
 * separated by `result`. Five events and fourteen parameters cover this game, and
 * they are meant to cover every web game after it without a single new
 * definition registered.
 *
 * The cost is that this file reads a little further from the game than it did.
 * That is the trade: a stranger reading a report should be able to understand it
 * without knowing what a hill bomb is.
 */
const EV = {
  /** One run begins. Carries `mode` -- which half of the game they chose. */
  START: 'start_game',
  /** A specific level begins, including on a retry. */
  LEVEL_START: 'level_start',
  /** That level ended, however it ended. See RESULT. */
  LEVEL_END: 'level_end',
  /** A setting was changed, named by `setting`. */
  SETTINGS: 'settings_changed',
  /** They left the game for the app. */
  END: 'game_end',
};

/**
 * How a level ended. One dimension instead of four event names.
 *
 * `quit` and `fail` are kept apart because they are different player acts:
 * failing is the game ending the run, quitting is the player doing it, and a
 * level with a high quit rate and a low fail rate is a level people find boring
 * rather than hard. `dnf` is a race-shaped fail -- the clock beat them to the
 * line -- and is worth its own value because "did not finish" and "finished
 * last" are not the same result.
 */
const RESULT = { CLEAR: 'clear', FAIL: 'fail', QUIT: 'quit', DNF: 'dnf' };

const host = () => (typeof window !== 'undefined' ? window.GoBalance : null);

/** Whether the host can take events at all. Checked per call, not cached: the
 *  SDK object is injected by the WebView and may not exist on the first frame. */
function available() {
  const h = host();
  return !!(h && typeof h.logEvent === 'function');
}

/**
 * Send one event. The only function in this file that talks to the host.
 *
 * SWALLOWS EVERYTHING. Analytics is the least important thing the game does and
 * must never be able to break it: a host that throws, a rejected promise, a
 * bridge that has gone away mid-run are all silently nothing. There is no retry
 * and no queue -- a dropped event is a dropped event, which is the right
 * trade for telemetry.
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

/** Rounded to whole numbers -- GA sums and averages these, and a float tail
 *  from a frame-timed value is noise in every report it appears in. */
const whole = (n) => Math.max(0, Math.round(n || 0));

/** 0-100, clamped. The one shape every "how far did they get" answer takes,
 *  whether the units underneath are objectives or metres. */
function pct(done, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

// --- session ---------------------------------------------------------------
// A "session" here is one visit to the GAME, not one run: it opens when the
// page starts a run and closes when the player leaves for the app. Runs inside
// it are counted so game_end can say how much was actually played, which is the
// difference between someone who bounced and someone who stayed.
let sessionStart = 0;
let runs = 0;
/** The mode of the run being STARTED. Only ever read by runStarted and by
 *  levelStarted, which copies it -- see `current.mode` below. */
let mode = '';
/** Attempts per level id. Reset per session, since the question is "did they
 *  keep trying now", not a lifetime total. */
const attempts = Object.create(null);
/**
 * The level in progress, so an end event does not have to be handed facts the
 * start already established.
 *
 * IT CARRIES ITS OWN `mode`, COPIED AT START, and that is not tidiness. A level
 * can end after the next run has already begun: modes.start() stops the outgoing
 * mode, and it does so downstream of the new run being reported. Reading the
 * module-level `mode` at send time therefore stamped a finished mission with the
 * mode of the race that replaced it -- every such run silently filed under the
 * wrong half of the game. Measured on the wire, not reasoned about; the fix is
 * to snapshot the facts when the level starts and never re-read them.
 */
let current = { id: '', number: 0, mode: '' };

/**
 * The parameters every level event carries, in one place.
 *
 * THE BRIDGE CAPS AN EVENT AT TEN PARAMETERS and spends one of them itself on
 * `game`, so nine is the real budget and `level_end` uses all nine. That is why
 * `stars` and `place` are added by the caller rather than here: a mission has
 * stars and no placement, a race has a placement and its stars are just a
 * restatement of it, and sending both would push one parameter off the end
 * silently. Count before adding anything.
 */
function levelBase(id) {
  return {
    level_id: id,
    level_number: current.number,
    attempt: attempts[id] || 1,
    mode: current.mode,
  };
}

export const analytics = {
  /**
   * A run has begun -- after the briefing, when the hill actually starts.
   *
   * Fired per RUN rather than once per session, because the useful funnel is
   * open_game (which the app's launcher now sends from GameLauncher) -> did they
   * actually start -> did they finish. Once-per-session would lose the middle.
   */
  runStarted(runMode) {
    if (!sessionStart) sessionStart = perfNow();
    runs += 1;
    mode = runMode;
    send(EV.START, { mode });
  },

  /** The player has left the game for the app. Pairs with the launcher's
   *  open_game, and carries the two numbers that open_game cannot know. */
  gameLeft() {
    if (!sessionStart) return; // never played; the launcher already logged the open
    send(EV.END, { duration_seconds: whole((perfNow() - sessionStart) / 1000), runs });
    sessionStart = 0;
    runs = 0;
  },

  // --- levels --------------------------------------------------------------

  /**
   * A level is starting. Missions and races both come through here.
   *
   * The attempt counter lives in this module rather than in either mode, so a
   * retry is one parameter on the start instead of a separate event -- which is
   * what lets a single report say "how many tries before this level clears"
   * across the whole catalogue.
   */
  levelStarted(id, number) {
    attempts[id] = (attempts[id] || 0) + 1;
    current = { id, number, mode };
    send(EV.LEVEL_START, levelBase(id));
  },

  /**
   * The ask was met.
   *
   * `durationSeconds` is time SPENT, not time left. Headroom was the old
   * parameter and it only means anything next to a budget the report would have
   * to know; time taken is the same information in a form that compares across
   * levels of different lengths -- and across games that have no clock at all.
   */
  levelCleared(id, stars, score, durationSeconds) {
    send(EV.LEVEL_END, {
      ...levelBase(id),
      result: RESULT.CLEAR,
      score: whole(score),
      stars: whole(stars),
      progress_pct: 100,
      duration_seconds: whole(durationSeconds),
    });
  },

  /** The clock ran out with objectives unmet. `progress_pct` is what says
   *  whether a level is slightly too hard or wildly mis-tuned -- 75% and 0% are
   *  different problems wearing the same word. */
  levelFailed(id, done, total, score, durationSeconds) {
    send(EV.LEVEL_END, {
      ...levelBase(id),
      result: RESULT.FAIL,
      score: whole(score),
      stars: 0,
      progress_pct: pct(done, total),
      duration_seconds: whole(durationSeconds),
    });
  },

  /**
   * The player left mid-run.
   *
   * Reached 100% and quit anyway is the sanctioned exit-after-clear path (see
   * modes/missions.js) and needs no flag of its own: `result=quit` with
   * `progress_pct=100` says it exactly, and the same pair says the useful thing
   * about every other quit too.
   */
  levelQuit(id, done, total, score, durationSeconds) {
    send(EV.LEVEL_END, {
      ...levelBase(id),
      result: RESULT.QUIT,
      score: whole(score),
      stars: 0,
      progress_pct: pct(done, total),
      duration_seconds: whole(durationSeconds),
    });
  },

  /** Crossed the line. `place` replaces `stars` here rather than joining it --
   *  see levelBase() on the nine-parameter budget -- and it is the better of the
   *  two anyway, since a race's stars are derived from its placement. */
  raceFinished(id, place, score, durationSeconds) {
    send(EV.LEVEL_END, {
      ...levelBase(id),
      result: RESULT.CLEAR,
      score: whole(score),
      place: whole(place),
      progress_pct: 100,
      duration_seconds: whole(durationSeconds),
    });
  },

  /** Hit the time cap before the line. There is no placement to report -- they
   *  were still on the hill -- so the distance covered stands in for it, as the
   *  same 0-100 every other unfinished level reports. */
  raceDnf(id, metresCovered, courseLength, score, durationSeconds) {
    send(EV.LEVEL_END, {
      ...levelBase(id),
      result: RESULT.DNF,
      score: whole(score),
      place: 0,
      progress_pct: pct(metresCovered, courseLength),
      duration_seconds: whole(durationSeconds),
    });
  },

  // --- settings ------------------------------------------------------------

  /**
   * One setting changed, named rather than baked into the event.
   *
   * Follows the app's own rule for sensitivity, quoted in its catalogue: check
   * on EXIT rather than on every step, "we dont want to send hundreds of
   * events". The value is the rounded int the player actually sees.
   *
   * `setting_value`, not `value`: GA4 treats a bare `value` as the monetary
   * amount on an event and pairs it with `currency`. A sensitivity of 60 landing
   * in that field would quietly become revenue in any report that touches it.
   */
  settingChanged(setting, value) {
    send(EV.SETTINGS, { setting, setting_value: whole(value) });
  },

  /** For a headless check: whether the host would take an event right now. */
  isAvailable: available,
};

/** Monotonic where possible; Date.now() is only a fallback for a very old
 *  WebView, and a clock that steps backwards would produce negative sessions. */
function perfNow() {
  return (typeof performance !== 'undefined' && performance.now)
    ? performance.now() : Date.now();
}
