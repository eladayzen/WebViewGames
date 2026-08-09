// THE MODE CONTRACT.
//
// A mode is the only place that decides what a run is FOR: what you are asked
// to do, when the run ends, and what the screen says at the end. It is not
// allowed to decide how the board feels -- that is the controller, one system,
// shared unanimously. The two meet at core/events.js and nowhere else.
//
// Concretely, a mode gets:
//   ctx.events   subscribe to what the ride reports (RIDE_EVENTS)
//   ctx.scoring  read the score, award points
//   ctx.hud      banners and popups
//   ctx.getState read-only peek at the ride (distance, speed)
//   ctx.endRun   ask the game to finish, with a reason and an end card
//
// And it implements:
//   start()      subscribe, reset counters, seed the panel
//   update(dt)   only for things a clock drives (a mission timer)
//   stop()       unsubscribe -- MUST leave no listeners behind
//   panel()      what to draw in the objectives panel, or null for nothing
//
// The unsubscribe discipline matters more than it looks: modes are switched
// from the lobby without reloading, so a mode that leaks a listener would keep
// counting a mission that is no longer being played.

/** @type {Map<string, object>} */
const registry = new Map();

/**
 * @param {{id:string, name:string, tagline:string, course:string, create:Function}} def
 *   `create(ctx)` returns { start, update, stop, panel }.
 */
export function registerMode(def) {
  registry.set(def.id, def);
  return def;
}

export function listModes() {
  return [...registry.values()];
}

export function getMode(id) {
  return registry.get(id) || registry.values().next().value;
}

/**
 * Runs one mode at a time and guarantees the previous one is fully torn down
 * before the next starts. Every mode switch in the game goes through here, so
 * "stop then start, never both live" is enforced in one place rather than
 * being remembered at each call site.
 */
export function createModeHost(ctx) {
  let active = null;
  let def = null;

  return {
    get id() { return def ? def.id : null; },
    get name() { return def ? def.name : ''; },
    get instance() { return active; },

    /** Switch to a mode and begin a run of it. */
    start(id) {
      this.stop();
      def = getMode(id);
      active = def.create(ctx);
      active.start();
    },

    /** Re-run the same mode (the restart button) without re-selecting it. */
    restart() {
      if (!def) return;
      active.stop();
      active = def.create(ctx);
      active.start();
    },

    stop() {
      if (active) active.stop();
      active = null;
    },

    update(dt) {
      if (active && active.update) active.update(dt);
    },

    panel() {
      return active && active.panel ? active.panel() : null;
    },
  };
}
