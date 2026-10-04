// THE PROFILE-SCOPED STORE -- where progress actually lives on a real device.
//
// Hill Bomb is the first of our games that has to remember anything per PLAYER
// rather than per device: a family shares one BoBo, and two children must each
// see their own unlocked missions and their own stars. `localStorage` cannot do
// that -- it is one bucket per device, so a sibling inherits your ladder.
//
// `GoBalance.save()` / `load()` are ALREADY per-profile: the host writes to
// `users/{uid}/…/{upid}/profile_saved_data/{gameKey}`, so switching sub-profile
// switches the blob with no work here. That is the whole reason this file is
// thin -- the separation is the host's, and all we have to do is stop using the
// device-wide store.
//
// THREE THINGS THE HOST'S README INSISTS ON, and each is a real hazard:
//
//   VERSION THE PAYLOAD FROM THE FIRST BUILD. The blob is opaque -- the app
//   never parses it -- so nothing upstream will ever migrate it for us. Saves
//   written today keep arriving after the shape changes, forever, and a reader
//   with no version field cannot tell an old one from a corrupt one.
//
//   IT MUST WORK WITH NO `GoBalance` AT ALL. The global does not exist at a
//   plain dev URL, which is where this game is built and tested. Falling back
//   to localStorage is not a courtesy; it is the development path.
//
//   localStorage CAN THROW OUTRIGHT in a restricted WebView, not just return
//   null. Every access is guarded.
//
// WRITES ARE DEBOUNCED because save() is a network call. Clearing a mission
// records a star, which is one save; a score objective ticking up would be one
// per frame without this.

/** Bump when the SHAPE changes. Readers below decide what to do with an old one. */
const SCHEMA = 1;

const LOCAL_KEY = 'hillbomb.progress.v1';

/** How long to sit on a change before writing. Long enough to coalesce a burst
 *  of records at the end of a run, short enough to survive a quick quit. */
const WRITE_DEBOUNCE_MS = 600;

const gb = () => (typeof window !== 'undefined' ? window.GoBalance : null);

function readLocal() {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(blob) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(blob));
  } catch {
    // Progress is a nicety, not the game.
  }
}

/**
 * Unwrap a stored blob into plain records.
 *
 * ACCEPTS AN UNVERSIONED BLOB, deliberately. Anyone who played before this file
 * existed has a bare `{missionId: {stars, score}}` map in localStorage, and
 * throwing it away would reset the ladder of every existing tester for no
 * reason. It is recognised by having no `v` and no `records`.
 */
function unwrap(blob) {
  if (!blob || typeof blob !== 'object') return {};
  if (typeof blob.v === 'number' && blob.records) {
    // A blob from a LATER version than this build understands. Reading it as if
    // it were current is how a downgrade silently corrupts a save; returning
    // the records untouched is the least-harm option, since every version so
    // far only adds keys.
    return blob.records;
  }
  return blob;
}

function wrap(records) {
  return { v: SCHEMA, records };
}

/**
 * @returns {{load: () => Promise<object>, save: (r: object) => void,
 *            flush: () => void, backend: () => string}}
 */
export function createProfileStore() {
  let timer = 0;
  let pending = null;

  function commit() {
    if (!pending) return;
    const blob = wrap(pending);
    pending = null;
    // ALWAYS write locally too, even on the host. The host mirrors to
    // PlayerPrefs itself, but a local copy also covers the case where the page
    // is reloaded at a dev URL against a save made in the app.
    writeLocal(blob);
    const api = gb();
    if (api && typeof api.save === 'function') {
      // Fire and forget: a failed save must not stop the game, and the next
      // record() writes the whole blob again anyway.
      Promise.resolve(api.save(blob)).catch(() => {});
    }
  }

  return {
    /**
     * Read the player's progress. Called ONCE at boot, before anything renders.
     *
     * The host wins when it answers. A local blob is only used when there is no
     * host or the host has nothing -- never merged, because two sources merged
     * on a shared device is exactly how one child's stars leak into another's.
     */
    async load() {
      const api = gb();
      if (api && typeof api.load === 'function') {
        try {
          const remote = await api.load();
          if (remote) return unwrap(remote);
          // Signed in with nothing saved: a genuinely new profile. Its ladder
          // starts closed rather than inheriting whatever this device happens
          // to have in localStorage.
          return {};
        } catch {
          // Fall through to local rather than starting a signed-in player from
          // scratch on a transient read failure.
        }
      }
      return unwrap(readLocal());
    },

    /** Queue a write. Safe to call on every change. */
    save(records) {
      pending = records;
      clearTimeout(timer);
      timer = setTimeout(commit, WRITE_DEBOUNCE_MS);
    },

    /** Write immediately -- for a run ending, where a debounce could lose it. */
    flush() {
      clearTimeout(timer);
      commit();
    },

    /** Which store is actually in use, for the dev panel and for diagnosis. */
    backend() {
      const api = gb();
      return api && typeof api.save === 'function' ? 'profile' : 'device';
    },
  };
}
