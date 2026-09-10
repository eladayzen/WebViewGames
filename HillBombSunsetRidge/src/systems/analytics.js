// WHAT THE GAME REPORTS, and the one place that knows how to report it.
//
// The board's app has a complete analytics layer -- every event lands in Google
// Analytics AND in a Firestore mirror at users/{uid}/eventLogs, stamped with the
// sub-profile -- and web games were wired into none of it. See
// GOBALANCE_ANALYTICS_REQUEST.md for the full picture and the two-phase plan.
//
// THIS FILE IS DORMANT UNTIL THE HOST GAINS logEvent. Nothing here throws,
// nothing blocks a frame, and with no host at all (a plain dev URL, which is
// where this game is built and tested) every call is a no-op. Same shape as
// systems/gbProfile.js, and for the same reason: the development path has to
// keep working.
//
// THE NAMES HERE ARE BARE ON PURPOSE -- `mission_clear`, not
// `skateboard_mission_clear` and not carrying a `game` parameter. Which of
// those two conventions the app uses is the app's decision, and it is one the
// BRIDGE can apply on its own, because it knows the game folder and we do not
// get to be trusted about it anyway. Keeping the game out of our payload means
// their naming decision never edits this file.
//
// IDS AND NUMBERS ONLY. No free text, no player input, nothing identifying --
// every value below is either a number we computed or an id from our own
// content files. A web page is the least trusted thing in the system and should
// not be the source of anything else.

/**
 * THE VOCABULARY, in one table so it can be renamed in one edit.
 *
 * Deliberately close to the app's existing catalogue in spirit: a small set of
 * discrete moments, each with a value that means something on its own. The app
 * numbers its own events the same way (`color_tunnel_died` carries a score,
 * `snowboard_play_level` carries a level name).
 */
const EV = {
  START: 'start_game',
  END: 'game_end',
  MISSION_START: 'mission_start',
  MISSION_CLEAR: 'mission_clear',
  MISSION_FAIL: 'mission_fail',
  MISSION_QUIT: 'mission_quit',
  MISSION_RETRY: 'mission_retry',
  RACE_FINISH: 'race_finish',
  RACE_DNF: 'race_dnf',
  SENSITIVITY: 'settings_changed_sensitivity',
};

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
const secs = (ms) => Math.max(0, Math.round(ms / 1000));

// --- session ---------------------------------------------------------------
// A "session" here is one visit to the GAME, not one run: it opens when the
// page starts a run and closes when the player leaves for the app. Runs inside
// it are counted so game_end can say how much was actually played, which is the
// difference between someone who bounced and someone who stayed.
let sessionStart = 0;
let runs = 0;
/** Attempts per mission id, for MISSION_RETRY. Reset per session, since the
 *  question is "did they keep trying now", not a lifetime total. */
const attempts = Object.create(null);

export const analytics = {
  /**
   * A run has begun -- after the briefing, when the hill actually starts.
   *
   * Fired per RUN rather than once per session, because the useful funnel is
   * open_game (which the app's launcher sends, see the request doc) -> did they
   * actually start -> did they finish. Once-per-session would lose the middle.
   */
  runStarted(mode) {
    if (!sessionStart) sessionStart = perfNow();
    runs += 1;
    send(EV.START, { mode });
  },

  /** The player has left the game for the app. Pairs with the launcher's
   *  open_game, and carries the two numbers that open_game cannot know. */
  gameLeft() {
    if (!sessionStart) return; // never played; the launcher already logged the open
    send(EV.END, { session_seconds: secs(perfNow() - sessionStart), runs });
    sessionStart = 0;
    runs = 0;
  },

  // --- missions ------------------------------------------------------------

  missionStarted(id, number) {
    attempts[id] = (attempts[id] || 0) + 1;
    send(EV.MISSION_START, { mission: id, mission_number: number });
    // The retry is its own event rather than a parameter on the start, so a
    // report can count "second and later attempts" without having to filter
    // every start. Only from the second attempt on, so first plays cost nothing.
    if (attempts[id] > 1) send(EV.MISSION_RETRY, { mission: id, attempt: attempts[id] });
  },

  /** Objectives met. `secondsLeft` is the headroom, which is the honest measure
   *  of whether a mission's clock is generous or mean. */
  missionCleared(id, stars, score, secondsLeft) {
    send(EV.MISSION_CLEAR, {
      mission: id, stars, score: Math.round(score), seconds_left: secs(secondsLeft * 1000),
    });
  },

  /** The clock ran out with objectives unmet. The two counts are what say
   *  whether a mission is slightly too hard or wildly mis-tuned. */
  missionFailed(id, done, total) {
    send(EV.MISSION_FAIL, { mission: id, objectives_done: done, objectives_total: total });
  },

  /**
   * The player left mid-run. `banked` distinguishes the two very different
   * things this can mean: leaving a mission already cleared (fine -- the clear
   * is kept, see the exit-after-clear rule in modes/missions.js) from
   * abandoning one that was not (a signal about the mission).
   */
  missionQuit(id, banked) {
    send(EV.MISSION_QUIT, { mission: id, banked: banked ? 1 : 0 });
  },

  // --- race ----------------------------------------------------------------

  raceFinished(track, place, score) {
    send(EV.RACE_FINISH, { track, place, score: Math.round(score) });
  },

  /** Hit the time cap before the line. The distance short is more use than a
   *  place they never reached. */
  raceDnf(track, metresShort) {
    send(EV.RACE_DNF, { track, metres_short: Math.round(metresShort) });
  },

  // --- settings ------------------------------------------------------------

  /**
   * Reuses the app's OWN event name, deliberately, so a sensitivity story reads
   * the same whether the player changed it in the app's settings or in ours --
   * and follows the app's rule for it too, quoted in its catalogue: check on
   * EXIT rather than on every step, "we dont want to send hundreds of events".
   * The value is the rounded int the player actually sees.
   */
  sensitivityChanged(value) {
    send(EV.SENSITIVITY, { value: Math.round(value) });
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
