// The seam between the CONTROLLER and the GAME MODES.
//
// The controller is one system: how the board feels is identical in every mode,
// and changing it changes it everywhere. That only stays true if modes cannot
// reach into the simulation -- so the ride EMITS what happened, and modes only
// listen.
//
// A mission is then counters over this stream. A survival mode adds time on the
// same events. A race mode compares them between competitors. None of them
// touch the rider, the physics or the camera, which is what stops the
// controller being quietly re-forked once per mode.
//
// Deliberately tiny: no priorities, no async, no wildcard matching. This is a
// seam, not a framework, and every one of those features would be an invitation
// to put game logic in the wrong place.

/** Everything the ride reports. Listed here so modes have one place to read. */
export const RIDE_EVENTS = {
  /** Left the ground. {launcher, power, height, trick} -- trick may be null. */
  LAUNCH: 'launch',
  /** A rotation completed and landed. {type: 'backflip'|'spin'|'hop', height} */
  TRICK: 'trick',
  /**
   * Touched back down. {trick, amount, height, points, huge} -- trick is null
   * for an ordinary jump, and `huge` is the same threshold that makes the
   * on-screen popup read HUGE AIR rather than AIR.
   */
  LAND: 'land',
  /** Left a rail or ledge. {label, seconds, points} */
  GRIND: 'grind',
  /** Hopped over an obstacle taken too crosswise to ride. {label} */
  HOP: 'hop',
  /** Collected something. {type} -- for the missions mode's pickups. */
  PICKUP: 'pickup',
  /** Clipped a hazard. {label, wobble} */
  HAZARD: 'hazard',
  /** The run ended. {reason: 'wipeout'|'timeup'|'complete', score, distance} */
  RUN_END: 'runEnd',
};

export function createEvents() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  return {
    /** @returns an unsubscribe function, so a mode can clean up on exit. */
    on(type, fn) {
      let set = listeners.get(type);
      if (!set) listeners.set(type, (set = new Set()));
      set.add(fn);
      return () => set.delete(fn);
    },

    emit(type, payload) {
      const set = listeners.get(type);
      if (!set || set.size === 0) return;
      // Iterate a copy: a listener that unsubscribes itself mid-emit (a mission
      // completing its last objective, say) would otherwise mutate the set
      // being walked.
      for (const fn of [...set]) {
        try {
          fn(payload);
        } catch (e) {
          // One bad mode listener must not take the ride down with it. There is
          // no devtools console on-device, so route it through the SDK bridge.
          if (window.Unity) window.Unity.call('MODE LISTENER ERROR: ' + e.message);
          else console.error('[events] listener failed for "' + type + '"', e);
        }
      }
    },

    /** Drop every listener -- used when switching modes. */
    clear() {
      listeners.clear();
    },

    get listenerCount() {
      let n = 0;
      for (const set of listeners.values()) n += set.size;
      return n;
    },
  };
}
