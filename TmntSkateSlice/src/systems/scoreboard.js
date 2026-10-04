// The account scoreboard (GoBalance SDK `submitScore` / `getScoreboard`).
// Ported from NovaVanguard/src/systems/scoreboard.js (2026-09-01) -- the app
// team's GOBALANCE_APP_INTEGRATION.md points to it as the copyable reference.
// Game-agnostic: nothing here is TMNT- or reskin-specific, so both themes use
// it unchanged.
//
// WHAT THIS IS AND IS NOT. The board ranks the profiles on ONE ACCOUNT -- the
// people who share this device (a "family board"). It is NOT a global board:
// that would need a shared Firestore collection and write rules that do not
// exist, so nothing here should be designed as though it were coming.
//
// EVERYTHING IS FEATURE-DETECTED. `window.GoBalance` is injected by the Unity
// host at runtime and simply does not exist at a plain dev URL -- the SDK is
// served from /__gobalance/sdk.js, which 404s outside the app. So every entry
// point answers "no board" rather than throwing, and the game stays fully
// playable in a browser with the board hidden. That is how it's developed.
//
// SCORES DO NOT GO IN save(). The app stores a save blob without parsing it, so
// a score buried there could never be ranked. submitScore is the only path.

/** The SDK, or null outside the app. Read per call rather than cached: the SDK
 *  installs itself before the game's own scripts, but a cached null taken at
 *  module load would be permanent if that order ever changed. */
function sdk() {
  return typeof window !== 'undefined' && window.GoBalance ? window.GoBalance : null;
}

/** Is the board available at all? Drives whether the UI renders its section. */
export function scoreboardAvailable() {
  const gb = sdk();
  return !!(gb && typeof gb.getScoreboard === 'function');
}

/**
 * Record one run.
 *
 * Integers only -- the SDK rounds, and rounding here too keeps what we submit
 * identical to what we display. Never throws and never blocks the caller: a
 * failed submit must not stop the game-over screen from appearing, so this
 * resolves to false instead of rejecting.
 */
export function submitRun(score) {
  const gb = sdk();
  if (!gb || typeof gb.submitScore !== 'function') return Promise.resolve(false);
  const value = Math.max(0, Math.round(score || 0));
  try {
    return Promise.resolve(gb.submitScore(value))
      .then(() => true)
      .catch(() => false);
  } catch (err) {
    return Promise.resolve(false);
  }
}

/** How many entries we ever consider. Display-side only: the app stores
 *  everything and this game simply never looks past the best 100. */
const MAX_ENTRIES = 100;

/**
 * Fetch the board as a ranked list of RUNS.
 *
 * ONE ROW PER RUN, not per profile: the app stores each run, so one player can
 * hold several rows -- that's intended (a player seeing "two places off my own
 * best" only works if the runs are all there).
 *
 * Every row carries its TRUE RANK in the full list, assigned here and never
 * recomputed downstream, so a windowed view (rows 34-38) can say 34-38 rather
 * than renumbering itself 1..5.
 *
 * Resolves to `{ available, complete, rows }` and never rejects.
 */
export function fetchBoard() {
  const gb = sdk();
  if (!gb || typeof gb.getScoreboard !== 'function') {
    return Promise.resolve({ available: false, complete: true, rows: [] });
  }
  return Promise.resolve(gb.getScoreboard())
    .then((board) => {
      const entries = ((board && board.entries) || []).filter(Boolean);
      const rows = entries
        .slice()
        // Descending by score. Ties broken by name then profileId so the order
        // is STABLE: the board is re-fetched on every run, and two equal scores
        // swapping places between screens would read as a bug.
        .sort(
          (a, b) =>
            (b.score || 0) - (a.score || 0) ||
            String(a.name || '').localeCompare(String(b.name || '')) ||
            String(a.profileId || '').localeCompare(String(b.profileId || ''))
        )
        .slice(0, MAX_ENTRIES)
        .map((e, i) => ({ ...e, rank: i + 1 }));
      return {
        available: true,
        complete: board ? board.complete !== false : false,
        rows,
      };
    })
    .catch(() => ({ available: true, complete: false, rows: [] }));
}

/**
 * The rows a RESULT screen should show: the leaders, plus a window around the
 * run just played.
 *
 * `justScored` is the value we submitted. Entries carry no timestamp and no run
 * id, so the run is found by matching an `isYou` row on exactly that score --
 * ambiguous only between runs that are identical anyway.
 *
 * If that run is already inside the leaders, there is NO second section: it is
 * highlighted where it sits (repeating one row twice reads as a fault).
 *
 * Returns `{ top, window }`, where `window` is empty when it would duplicate.
 */
export function resultSections(rows, justScored, topN = 5, above = 2, below = 2) {
  const top = rows.slice(0, topN);
  if (justScored == null) return { top, window: [] };

  const target = Math.round(justScored);
  const idx = rows.findIndex((r) => r.isYou && Math.round(r.score || 0) === target);
  if (idx < 0) return { top, window: [] };
  if (idx < topN) return { top, window: [] }; // already among the leaders

  const from = Math.max(topN, idx - above);
  const to = Math.min(rows.length, idx + below + 1);
  const window = rows.slice(from, to).map((r) => ({ ...r, isRun: r === rows[idx] }));
  return { top, window };
}
