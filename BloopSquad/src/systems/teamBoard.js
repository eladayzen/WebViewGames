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
    return { rows: marked, placed: marked.find((r) => r.isRun) || null, stored: teamBoardAvailable() };
  });
}
