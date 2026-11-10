// The multiplier orb stack (§5.6) -- this game's entire in-run power curve.
//
// THE SLOTS ARE STATUS READOUTS, NEVER BUTTONS. Nothing about them is
// pressable, targetable or selectable, and no input in this game can affect
// them. An orb fills the next empty slot immediately on pickup, with no input,
// and a full stack fires the barrel by itself (§0.4).
//
// Drain: the stack holds for SLOT_HOLD from the LAST orb collected, shown as
// the radial sweep on the highest filled slot. When the sweep empties, ONE slot
// drops -- not the whole stack -- and the timer restarts. The pressure is "keep
// feeding it", not "one miss and it's gone".

import { SLOT_COUNT, SLOT_HOLD, SLOT_MULTIPLIERS, BARREL_MULTIPLIER } from '../data/tuning.js';

export class MultiplierStack {
  constructor() {
    this.reset();
  }

  reset() {
    this.slots = 0;
    this.drain = 0;      // seconds remaining on the current sweep
    this.locked = false; // true during the barrel: multiplier is pinned at x6
  }

  get multiplier() {
    if (this.locked) return BARREL_MULTIPLIER;
    return SLOT_MULTIPLIERS[Math.min(this.slots, SLOT_MULTIPLIERS.length - 1)];
  }

  /** [0,1] for the radial sweep on the highest filled slot. */
  get sweep() {
    if (this.slots <= 0) return 0;
    return Math.max(0, Math.min(1, this.drain / SLOT_HOLD));
  }

  get isFull() { return this.slots >= SLOT_COUNT; }

  /** @returns true if this orb just topped the stack. */
  addOrb() {
    const wasFull = this.isFull;
    if (this.slots < SLOT_COUNT) this.slots++;
    this.drain = SLOT_HOLD;
    return !wasFull && this.isFull;
  }

  update(dt) {
    if (this.locked || this.slots <= 0) return;
    this.drain -= dt;
    if (this.drain <= 0) {
      this.slots = Math.max(0, this.slots - 1);
      this.drain = this.slots > 0 ? SLOT_HOLD : 0;
    }
  }

  /** The stack is lost ENTIRELY on a wipeout (§5.8). */
  loseAll() {
    this.slots = 0;
    this.drain = 0;
    this.locked = false;
  }

  lock() { this.locked = true; }

  unlock() {
    this.locked = false;
    this.slots = 0;
    this.drain = 0;
  }
}
