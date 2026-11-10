// The barrel section (§5.7) -- the reference's inside-the-wave bonus, and this
// game's second rest beat.
//
// NO INPUT TRIGGERS, ENTERS, EXTENDS OR EXITS THE BARREL (§0.4). Filling the
// third multiplier slot begins it by itself. The player keeps control of `h`
// the whole way through; only the rail pair swaps (§9.4), which is the entire
// reason this is a section rather than a second game.
//
// NO HAZARDS AT MVP. That is deliberate: it is the quiet, high-value beat, and
// for an exertion product a repeated no-threat stretch that still rewards
// control is exactly right.

import {
  BARREL_ENTRY, BARREL_DURATION, BARREL_EXIT, BARREL_COOLDOWN,
} from '../data/tuning.js';
import { PlayerState } from '../player/player.js';
import { BARREL_COIN_ARCS } from '../data/coinArcs.js';

export const BarrelPhase = {
  OUT: 'out',
  ENTRY: 'entry',
  INSIDE: 'inside',
  EXIT: 'exit',
};

export class BarrelController {
  constructor() {
    this.reset();
  }

  reset() {
    this.phase = BarrelPhase.OUT;
    this.t = 0;
    this.cooldown = 0;
    this.coinTimer = 0;
    this._arcIndex = 0;
  }

  get active() { return this.phase !== BarrelPhase.OUT; }

  /** True while the interior rail is fully in effect. */
  get inside() { return this.phase === BarrelPhase.INSIDE; }

  /** How much of the barrel rail is blended in, [0,1]. */
  get railMix() {
    switch (this.phase) {
      case BarrelPhase.ENTRY: return Math.min(1, this.t / BARREL_ENTRY);
      case BarrelPhase.INSIDE: return 1;
      case BarrelPhase.EXIT: return Math.max(0, 1 - this.t / BARREL_EXIT);
      default: return 0;
    }
  }

  /** Cross-fade weight for the interior art, same curve as the rail. */
  get interiorMix() { return this.railMix; }

  canFire() { return !this.active && this.cooldown <= 0; }

  fire(ctx) {
    this.phase = BarrelPhase.ENTRY;
    this.t = 0;
    this.coinTimer = 0.35;
    ctx.wave.setRailTarget('barrel');
    ctx.player.enterBarrel();
    ctx.multiplier.lock();
  }

  update(dt, ctx) {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.active) return;

    this.t += dt;

    switch (this.phase) {
      case BarrelPhase.ENTRY:
        ctx.wave.setRailMix(this.railMix);
        if (this.t >= BARREL_ENTRY) {
          this.phase = BarrelPhase.INSIDE;
          this.t = 0;
          ctx.wave.setRailMix(1);
          ctx.player.setBarrelState(PlayerState.BARREL);
        }
        break;

      case BarrelPhase.INSIDE:
        this._routeCoins(dt, ctx);
        if (this.t >= BARREL_DURATION) {
          this.phase = BarrelPhase.EXIT;
          this.t = 0;
          ctx.wave.setRailTarget('face');
          ctx.player.setBarrelState(PlayerState.BARREL_EXIT);
        }
        break;

      case BarrelPhase.EXIT: {
        // railMix here counts DOWN from 1, but wave.setRailMix expects a
        // 0 -> 1 blend from the frozen "from" rail into the target, so feed it
        // the complement.
        ctx.wave.setRailMix(1 - this.railMix);
        if (this.t >= BARREL_EXIT) {
          this.phase = BarrelPhase.OUT;
          this.t = 0;
          this.cooldown = BARREL_COOLDOWN;
          ctx.wave.setRailMix(1);
          ctx.player.exitBarrelToFace();
          // The stack resets to 0 and the multiplier drops to x1 (§5.7).
          ctx.multiplier.unlock();
          if (ctx.onExit) ctx.onExit();
        }
        break;
      }
      default:
        break;
    }
  }

  /**
   * Coins strung through the interior in long serpentine runs across the full
   * height -- the section's reward is ROUTING, and there is a lot of it.
   */
  _routeCoins(dt, ctx) {
    this.coinTimer -= dt;
    if (this.coinTimer > 0) return;
    const arc = BARREL_COIN_ARCS[this._arcIndex++ % BARREL_COIN_ARCS.length];
    ctx.pickups.spawnCoinArc(arc, ctx.wave, ctx.scrollSpeed);
    this.coinTimer = arc.xSpanSec * 0.85;
  }

  /** A wipeout can never happen inside the barrel (no hazards), but a run can
   *  end for other reasons; make sure the rail comes back cleanly. */
  abort(ctx) {
    if (!this.active) return;
    this.phase = BarrelPhase.OUT;
    this.t = 0;
    ctx.wave.setRailTarget('face');
    ctx.wave.setRailMix(1);
    ctx.multiplier.unlock();
  }
}
