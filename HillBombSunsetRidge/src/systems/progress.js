// PER-PLAYER PROGRESS -- which missions are unlocked and how many stars each
// has earned.
//
// THIS IS A SEAM, NOT A SAVE SYSTEM. In the shipped GoBalance product this is
// account data: it belongs to a user, follows them across devices, and arrives
// from the host rather than from this game. None of that exists yet, so it lives
// in localStorage for now -- but everything above this file talks to it through
// the same handful of methods it would use against a real service, so swapping
// the backing store is a change to THIS file and nothing else.
//
// That is the entire reason it is a module rather than a couple of variables in
// the missions mode. Progress read straight out of localStorage at a dozen call
// sites would have to be found and rewritten a dozen times.
//
// It is deliberately synchronous. A real service call is not, but making the
// UI async now -- for data that is a few hundred bytes and will almost certainly
// be handed over at launch, in bulk, by the host -- would be inventing a problem
// to solve. When the host arrives, `hydrate()` takes its payload.

const STORAGE_KEY = 'hillbomb.progress.v1';

export function createProgress(missionIds) {
  /** @type {Record<string, {stars:number, score:number}>} */
  let records = {};

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) records = JSON.parse(raw) || {};
    } catch (e) {
      // A corrupt or unavailable store must not stop the game booting -- worst
      // case the player starts from the first mission again. Private-browsing
      // modes throw on localStorage access entirely.
      records = {};
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) { /* nothing to do; progress is a nicety, not the game */ }
  }

  load();

  const api = {
    /** Stars earned on a mission, 0 if never cleared. */
    stars(id) {
      return records[id] ? records[id].stars : 0;
    },

    /** Best score on a mission, 0 if never cleared. */
    best(id) {
      return records[id] ? records[id].score : 0;
    },

    cleared(id) {
      return api.stars(id) > 0;
    },

    /**
     * UNLOCK RULE: the first mission is always open, and each one after it
     * opens when the mission before it has been cleared. Kept as a rule rather
     * than a stored flag so it cannot drift out of step with the star records
     * -- there is one source of truth, and unlocking is derived from it.
     */
    isUnlocked(id) {
      const i = missionIds.indexOf(id);
      if (i <= 0) return i === 0;
      return api.cleared(missionIds[i - 1]);
    },

    /** The first unlocked mission that has not been cleared, else the last. */
    nextMissionId() {
      for (const id of missionIds) {
        if (api.isUnlocked(id) && !api.cleared(id)) return id;
      }
      return missionIds[missionIds.length - 1];
    },

    /**
     * Record a result. Only ever improves: replaying a mission you three-starred
     * and scraping one star must not take the other two away.
     */
    record(id, stars, score) {
      const prev = records[id] || { stars: 0, score: 0 };
      records[id] = {
        stars: Math.max(prev.stars, stars),
        score: Math.max(prev.score, Math.round(score)),
      };
      save();
    },

    /** Total stars, for a future "you have N of M" readout. */
    get totalStars() {
      return missionIds.reduce((n, id) => n + api.stars(id), 0);
    },

    /** Replace everything at once -- the shape a host handover would take. */
    hydrate(data) {
      records = data && typeof data === 'object' ? data : {};
      save();
    },

    /** What a host would be handed to persist. */
    serialise() {
      return JSON.parse(JSON.stringify(records));
    },

    reset() {
      records = {};
      save();
    },
  };

  return api;
}
