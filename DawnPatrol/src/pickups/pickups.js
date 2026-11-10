// Coins and multiplier orbs (§5.5, §5.6, §6.3).
//
// BOTH ARE COLLECTED BY CONTACT, WITH NO INPUT (§0.4). Collection radii are
// deliberately generous, so a near-miss is a hit -- fine height control on a
// balance board is expensive and the coin is a lure, not a test.
//
// A COIN IS NOT CURRENCY. There is no wallet, nothing persists, nothing is
// spent, and the in-run coin counter is never written to storage (§8.6). If you
// are about to add a `balance` field anywhere, stop.

import {
  COIN_PICK_H, COIN_PICK_X, ORB_PICK_H, ORB_PICK_X, DESIGN_W,
} from '../data/tuning.js';
import { arcPoints } from '../data/coinArcs.js';

class Pickup {
  constructor() {
    this.active = false;
    this.kind = 'coin';
    this.worldX = 0;
    this.h = 0.5;
    this.spin = 0;
    this.stringId = 0;
  }
}

export class PickupPool {
  constructor(size = 96) {
    this.items = [];
    for (let i = 0; i < size; i++) this.items.push(new Pickup());
    this.live = [];
    this._nextString = 1;
    this.strings = new Set();
  }

  clear() {
    for (const p of this.items) p.active = false;
    this.live.length = 0;
    this.strings.clear();
  }

  _take() {
    for (const p of this.items) if (!p.active) return p;
    const p = new Pickup();
    this.items.push(p);
    return p;
  }

  /**
   * Lay out one coin arc template starting at the spawn edge.
   * Returns the h extent it occupies, so the spawn director can check its
   * clearance from live hazards (§5.5's routing rule).
   */
  spawnCoinArc(arc, wave, scrollSpeed, hOffset = 0) {
    const id = this._nextString++;
    this.strings.add(id);
    const pts = arcPoints(arc);
    const spanPx = arc.xSpanSec * scrollSpeed;
    const head = wave.spawnWorldX;
    for (const pt of pts) {
      const p = this._take();
      p.active = true;
      p.kind = 'coin';
      p.worldX = head + pt.t * spanPx;
      p.h = clamp01(pt.h + hOffset);
      p.spin = Math.random() * Math.PI * 2;
      p.stringId = id;
      this.live.push(p);
    }
    return id;
  }

  /**
   * One multiplier orb. Placed at deliberately awkward heights -- near the lip
   * or deep in the trough -- more often than coins are, since they are the
   * ceiling's key (§5.6).
   */
  spawnOrb(wave, h) {
    const id = this._nextString++;
    this.strings.add(id);
    const p = this._take();
    p.active = true;
    p.kind = 'orb';
    p.worldX = wave.spawnWorldX;
    p.h = clamp01(h);
    p.spin = 0;
    p.stringId = id;
    this.live.push(p);
    return id;
  }

  update(dt, wave) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.spin += dt * (p.kind === 'coin' ? 3.4 : 1.8);
      if (wave.isDespawned(p.worldX)) {
        p.active = false;
        this.live.splice(i, 1);
      }
    }
    // Strings whose last member has gone are no longer "on screen" for the
    // CAP_PICKUP_STRINGS count.
    const liveIds = new Set(this.live.map((p) => p.stringId));
    for (const id of this.strings) if (!liveIds.has(id)) this.strings.delete(id);
  }

  get stringCount() { return this.strings.size; }

  /**
   * Contact collection. Returns { coins, orbs } collected this step.
   * Same 1D test as hazards, with the generous radii from §5.5/§5.6.
   */
  collect(playerWorldX, playerH, out) {
    out.coins = 0;
    out.orbs = 0;
    out.coinPops = out.coinPops || [];
    out.coinPops.length = 0;
    out.orbPops = out.orbPops || [];
    out.orbPops.length = 0;

    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      const rx = p.kind === 'coin' ? COIN_PICK_X : ORB_PICK_X;
      const rh = p.kind === 'coin' ? COIN_PICK_H : ORB_PICK_H;
      if (Math.abs(p.worldX - playerWorldX) > rx) continue;
      if (Math.abs(p.h - playerH) > rh) continue;
      if (p.kind === 'coin') { out.coins++; out.coinPops.push({ worldX: p.worldX, h: p.h }); }
      else { out.orbs++; out.orbPops.push({ worldX: p.worldX, h: p.h }); }
      p.active = false;
      this.live.splice(i, 1);
    }
    return out;
  }

  /** The h extent currently occupied by a given string, for clearance checks. */
  stringExtent(id) {
    let lo = Infinity, hi = -Infinity;
    for (const p of this.live) {
      if (p.stringId !== id) continue;
      if (p.h < lo) lo = p.h;
      if (p.h > hi) hi = p.h;
    }
    return lo === Infinity ? null : { lo, hi };
  }
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export { DESIGN_W };
