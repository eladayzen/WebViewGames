// THE CO-OP BOARD, which has to be ours because the platform has only one.
//
// ── WHY A TEAM RUN DOES NOT GO TO THE FAMILY BOARD ──────────────────────────
//
// `GoBalance.submitScore(value)` takes a number and nothing else. One board per
// game, one entry attributed to THE SIGNED-IN PROFILE. There is no mode, no
// category and no way to submit on behalf of a second player -- see the SDK
// surface in systems/gbSdk.js, which is the whole of it.
//
// So submitting a two-player run would do two wrong things at once:
//
//   1. It would record a score one child did not earn alone under that child's
//      name, while the sibling who popped half the field gets nothing. The host
//      cannot attribute to two profiles; there is no API for it.
//   2. It would make the solo board unwinnable solo. Two pods means two
//      cannons, eight hearts instead of five and an ultimate that does not
//      exist in a one-player run -- a team run outscores a good solo run by a
//      wide margin, every time. Mixed into one ranked list, every top row would
//      be a team run forever, and a child playing alone would never appear on
//      their own board again.
//
// That second one is the real damage, and it is permanent: scores cannot be
// withdrawn. So co-op runs are kept out of `submitScore` entirely and ranked
// here instead, against other co-op runs, which is the comparison that actually
// means something. The result screen says so in as many words -- a score that
// silently went nowhere would be a worse bug than the one being avoided.
//
// ── WHERE IT LIVES ──────────────────────────────────────────────────────────
//
// In the profile save blob (`GoBalance.load` / `save`), which the app stores
// without parsing, so its shape is entirely ours. This game has never written a
// blob before, so there is nothing to collide with -- but the whole blob is
// still read, merged and written back rather than replaced, because the day
// this game does store something else is the day a blind overwrite eats it.
//
// The blob is per profile and per device, which makes this a board for the
// household rather than a global one -- the same scope the family board has.
// Nothing here should be built as though a shared backend were coming; it is
// not, and the same note is already on systems/scoreboard.js.

// ── SUBMITTING A TEAM RUN TO THE PLATFORM (BAL-605) ─────────────────────────
//
// The host is gaining a second argument: `submitScore(value, {mode, seats})`,
// where `mode` is a game-defined string the app does not interpret and the
// BRIDGE resolves who was in each seat. The game deliberately does not pass
// identities: the roster it receives is `{index, name, color, isMain}` with no
// profile id in it, and names are display strings that two sub-profiles on one
// account can share, so anything this file invented would be a guess.
//
// WHY THE FEATURE DETECTION HERE IS POSITIVE-ONLY, AND MUST STAY THAT WAY.
// An older app build's `submitScore` takes one argument and IGNORES the
// second. It does not throw, it does not warn -- it files the number, and the
// number is a two-player score landing on the one signed-in child's solo
// board. That is precisely the permanent damage this whole module exists to
// avoid (see the note above: scores cannot be withdrawn), and it would happen
// silently on every device still running the old build.
//
// So this must never be probed by trying. There is no safe "attempt it and see
// what happens" here, because the failure mode of the attempt IS the bug. The
// host has to say yes first, and anything other than an explicit yes means the
// blob, which is what shipped and what works.
const COOP_MODE = 'coop';

const KEY = 'coopRuns';
const MAX_ROWS = 20;

function sdk() {
  return typeof window !== 'undefined' && window.GoBalance ? window.GoBalance : null;
}

/** Is there anywhere to keep a team board at all? False at a plain dev URL. */
export function teamBoardAvailable() {
  const gb = sdk();
  return !!(gb && typeof gb.load === 'function' && typeof gb.save === 'function');
}

/**
 * Will the host record a co-op run as a co-op run?
 *
 * `GoBalance.capabilities.scoreModes === true` and nothing else. Settled with
 * the app side on BAL-605, where the contract is: there is no `capabilities`
 * object in the SDK today, and it arrives carrying this one flag as a literal
 * `true` in the SAME commit that teaches `submitScore` the options object --
 * never earlier and never separately. So the flag cannot be present on a build
 * that would ignore the argument.
 *
 * Identity comparison, not truthiness. `'yes'` and `1` are both things a
 * hand-written config could produce and neither is a promise from the host, so
 * neither counts. Nor does `submitScore.length` -- arity says nothing about a
 * wrapper, and a wrong guess here submits a team score to a child's solo board.
 */
export function coopSubmitAvailable() {
  const gb = sdk();
  if (!gb || typeof gb.submitScore !== 'function') return false;
  const caps = gb.capabilities;
  return !!caps && caps.scoreModes === true;
}

/**
 * Hand the run to the platform, when the platform can hold it.
 *
 * Resolves true/false and never rejects: this is additive. The blob below is
 * still written either way and is still what the result screen renders, so a
 * failed or absent submit costs the player nothing and the screen never waits
 * on the network to find out.
 */
function submitTeamRun(entry) {
  if (!coopSubmitAvailable()) return Promise.resolve(false);
  const gb = sdk();
  return Promise.resolve()
    .then(() => gb.submitScore(entry.score, { mode: COOP_MODE, seats: entry.seats }))
    .then(() => true)
    .catch(() => false);
}

function loadBlob() {
  const gb = sdk();
  if (!gb || typeof gb.load !== 'function') return Promise.resolve(null);
  return Promise.resolve()
    .then(() => gb.load())
    .then((b) => (b && typeof b === 'object' ? b : null))
    .catch(() => null);
}

/** Descending by score, ties broken by the older run first so order is stable. */
function rank(runs) {
  return runs
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0) || (a.at || 0) - (b.at || 0))
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Bank one co-op run and return the ranked board with that run marked.
 *
 * Resolves either way and never rejects: a save that failed must not stop the
 * result screen appearing, for exactly the reason the family board gives. When
 * there is no SDK the run is still RANKED -- against an empty board, so it
 * comes back as row 1 of 1 -- rather than vanishing, which is what makes the
 * screen reviewable in a browser.
 */
export function recordTeamRun(run) {
  const entry = {
    score: Math.max(0, Math.round(run.score || 0)),
    popped: Math.max(0, Math.round(run.popped || 0)),
    level: Math.max(1, Math.round(run.level || 1)),
    seats: Math.max(1, Math.round(run.seats || 2)),
    names: (run.names || []).map((n) => String(n).slice(0, 24)),
    at: Date.now(),
  };

  // Fired alongside the blob write, not before it: the local board is the one
  // the player is about to look at, and it must not wait on a host round trip.
  const submitted = submitTeamRun(entry);

  return loadBlob().then((blob) => {
    const prev = Array.isArray(blob && blob[KEY]) ? blob[KEY].filter(Boolean) : [];
    const rows = rank(prev.concat([entry]));
    // `at` is a timestamp from this device's clock and two runs cannot share a
    // millisecond, so it identifies the row just added without needing an id.
    const marked = rows.map((r) => ({ ...r, isRun: r.at === entry.at }));

    const gb = sdk();
    if (gb && typeof gb.save === 'function') {
      try {
        // Merge, never replace: the rest of the blob is not ours to drop.
        gb.save({ ...(blob || {}), [KEY]: rows.map(({ rank: _r, ...k }) => k) });
      } catch { /* a failed save must never block the screen */ }
    }
    return submitted.then((sent) => ({
      rows: marked,
      placed: marked.find((r) => r.isRun) || null,
      stored: teamBoardAvailable(),
      // Whether the run ALSO reached the account board. Nothing renders this
      // yet -- the screen's wording is true either way -- but a caller that
      // wants to say "and it is on the family's co-op board" can.
      submitted: sent,
    }));
  });
}
