// Lean input.
//
// Everything upstream of this file now lives in the shared shim: the host sends
// raw gravity, `bobo-host` runs the pipeline (BRIDGE.md §5) and the game POLLS
// `host.input(0)` once a frame. Nothing is filtered here. A second filter on top
// of the pipeline's tau of about a third of a second would put the board further
// behind the rider's body, and the board is the one thing that must not lag more
// than it already does.
//
// AXIS CONVENTION. The pipeline's control is in screen space, where y grows
// downward (ySign = -1 makes lean-forward negative so "forward" is up on a
// screen). This game's world has y up, so y is negated exactly once, here, and
// every other module can assume y-up.
//
// WHAT THE AXES MEAN HERE:
//   x  lean left/right  -> which edge, and how hard it is driven
//   y  lean forward     -> nose pressure: a tuck, tighter arcs, less drag
//      lean back        -> tail pressure: scrub speed, wash the tail out
//
// The gamut is a disc, not a square — the sensor clamps radially at maxAngle —
// so a rider cannot have a full edge AND a full tuck at once. That is not a
// limitation to work around; it is the trade the whole game is built on, handed
// over for free by the hardware.
//
// WHERE THE KEYBOARD AND THE DRAG WENT. Both used to be reimplemented here,
// including the relative-drag fix (touch-down is neutral, lean is the drag from
// it over a thumb-sized radius) that absolute-position mapping needed because it
// snapped to a hard edge on any touch off centre. The shim carries that same fix
// — it was lifted from this file — and it has one property this copy did not:
// the synthetic lean is pushed through the REAL pipeline, dead zone, radial
// clamp and EMA included, so desktop testing tunes the game against the control
// a player actually has rather than a cleaner one.

import { rotateLean, DEFAULT_STANCE } from './orientation.js';

export class Input {
  /**
   * @param host
   * @param {number} slot  which player this reads. Slot 0 is the phone's own
   *   board on GoBalance and the arrow keys in a browser; slot 1 is the second
   *   board, or WASD. One of these per player, rather than one object asking
   *   for a different slot each frame -- the stance, the smoothing and the
   *   connected/stale state all belong to a player, not to the reader.
   */
  constructor(host, slot = 0) {
    this._host = host;
    this.slot = slot | 0;
    this.x = 0;
    this.y = 0;
    /**
     * How far the player has turned the physical board, clockwise (BAL-584).
     *
     * APPLIED HERE AND NOWHERE ELSE. This is the one place the game turns a
     * host reading into a lean, so a stance applied here is a stance every
     * consumer agrees on -- steering, tuck, the rider's pose, the diagnostics
     * line and the dev keyboard -- without any of them knowing stances exist.
     */
    this.stance = DEFAULT_STANCE;
  }

  /**
   * True when a real sensor is driving, false on the keyboard/drag dev path —
   * it decides only which line the title screen prints and what the diag
   * overlay calls the input.
   *
   * Asked of the shim, which sets the flag on the first `input` message, rather
   * than inferred from the `sensor` message or from having watched the slot go
   * stale. Both inferences were wrong in the same direction: a host that never
   * implements `sensor` would have shown "using touch & keys" for a whole run
   * while a sensor drove it, and the stale-based fallback could not answer at
   * all until after the sensor had already dropped.
   */
  get connected() {
    return this._host.live(this.slot);
  }

  /** True when the sensor bridge has gone quiet mid-run. */
  get stale() {
    return this._host.stale(this.slot);
  }

  update() {
    // Polling, not a per-sample push: a burst of BLE notifications sharing one
    // arrival millisecond must not become a burst of work, and a dropped frame
    // must not leave a backlog to catch up on. Last write wins, as before.
    const c = this._host.input(this.slot);
    // The negation first (screen-down-positive -> world y-up, still the only
    // one), then the stance, so `rotateLean` works in one consistent frame.
    const lean = rotateLean(c.x, -c.y, this.stance);
    this.x = lean.x;
    this.y = lean.y;
  }

  get lean() {
    return this;
  }
}
