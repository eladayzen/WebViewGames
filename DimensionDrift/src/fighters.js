// FIGHTERS — who is in the fight, and what each of them is pointed at.
//
// ── WHY THIS FILE EXISTS BEFORE IT IS NEEDED ───────────────────────────────
//
// Today there are one or two riders and a hill full of drones, and a single
// `rider` argument threaded through `combat.js` would cover it. It is written
// this way because of what is already on the list: AI competitors, and PVP.
//
// Both of those break a `rider` argument in the same place and for the same
// reason — the question stops being "where is the player" and becomes "which
// of the several things on this mountain is this drone shooting at". A rival
// is not a Rider (see `rivals.js`: they are deliberately not run through the
// player's controller) and in PVP a rider is a legitimate target for another
// rider. Any design where combat reaches for `game.rider` has to be unpicked
// to support either, and unpicking it later means unpicking it in the middle
// of a turret, a guidance loop and a hit test at the same time.
//
// So: combat never sees a Rider. It sees a Fighter, which is an ADAPTER over
// anything that has a position and a heading, plus the state a combatant needs
// — health, team, current weapon, a cooldown and whatever has a projectile in
// the air toward it.
//
// ── THE ADAPTER IS DELIBERATELY NOT AN INTERFACE RIDER IMPLEMENTS ──────────
//
// The obvious alternative is to put `hp`, `team` and `weapon` fields on Rider
// and on Rival and have combat duck-type them. That couples the board physics
// to the fight: `rider.js` is 2,500 lines about how an edge feels, it is
// shared unanimously by every mode, and a mode that has no combat in it would
// still be carrying a weapon cooldown. It also makes two-player health two
// fields on two objects rather than two rows in one list, which is exactly the
// shape that makes a HUD hard to write.
//
// A Fighter holds a reference and reads through it. Rider knows nothing.
//
// ── WHAT A TEAM IS FOR ─────────────────────────────────────────────────────
//
// `foesOf(team)` is the only targeting question anything ever asks, and it
// never asks whether something is a player. Co-op is both riders on CREW; PVP
// is player two on PVP_B and not one other line of code different. See
// `weapons.js` for the full note.

import { TEAM, WEAPONS, DEFAULT_WEAPON } from './weapons.js';

/**
 * One combatant: a rider, a rival, or anything else with a place and a facing.
 *
 * The entity must expose `x`, `y`, `z` and `heading` (a THREE.Vector3-like with
 * x/y/z). `p` — distance down the mountain — is read when present and derived
 * from `-z` when it is not, which is what lets a Rival be a Fighter without
 * Rival growing a field for it.
 */
export class Fighter {
  /**
   * @param {object} entity anything with x/y/z and a heading
   * @param {object} opts
   */
  constructor(entity, {
    id, team = TEAM.CREW, maxHp = 100, label = '', muzzleUp = 0.85, slot = 0,
  } = {}) {
    this.entity = entity;
    this.id = id;
    this.team = team;
    this.label = label;
    /** Which player this is, for the HUD and the split screen. 0 or 1. */
    this.slot = slot;
    this.maxHp = maxHp;
    this.hp = maxHp;
    /** Metres above the board a projectile leaves from. */
    this.muzzleUp = muzzleUp;

    this.weapon = DEFAULT_WEAPON;
    /** Seconds of power remaining; 0 means the default weapon. */
    this.powerLeft = 0;
    this.cd = 0;
    /** The thing this fighter's gun has found, or null. */
    this.target = null;
    /** How many projectiles are in the air toward this fighter. */
    this.inbound = 0;
    /**
     * Seconds of grace after taking a hit. Without it a three-drone squad
     * landing on the same frame is three separate hit reactions on top of each
     * other, which reads as one large unexplained drop rather than as three
     * hits — and the player cannot learn what hurt them from it.
     */
    this.iframes = 0;

    this.shots = 0;
    this.hits = 0;
    this.kills = 0;
    this.taken = 0;

    /** (amount, from) => void — the game's hit feedback. */
    this.onDamage = null;
    /** (from) => void — fired once, when hp first reaches zero. */
    this.onDown = null;
    /** (weaponId) => void */
    this.onPower = null;
  }

  get x() { return this.entity.x; }

  get y() { return this.entity.y; }

  get z() { return this.entity.z; }

  get p() { return this.entity.p ?? -this.entity.z; }

  get heading() { return this.entity.heading; }

  get alive() { return this.hp > 0; }

  get gun() { return WEAPONS[this.weapon] ?? WEAPONS[DEFAULT_WEAPON]; }

  /** Health as a fraction, for a bar that should not have to know the scale. */
  get health() { return Math.max(0, this.hp / this.maxHp); }

  /**
   * Take a hit.
   *
   * RETURNS WHETHER IT LANDED, and the caller needs that: a projectile that
   * arrives during someone's grace window has to be retired all the same, or
   * it hangs in the air and connects again on the next frame.
   */
  damage(amount, from = null) {
    if (!this.alive || this.iframes > 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.taken += amount;
    this.iframes = IFRAMES;
    this.onDamage?.(amount, from);
    if (this.hp === 0) this.onDown?.(from);
    return true;
  }

  heal(amount) {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
   * Grant a timed weapon.
   *
   * REFRESHING, NOT STACKING. A second gate taken while a power is running
   * restarts the clock rather than adding to it — a player who finds two gates
   * close together should not be able to bank half a minute of the strongest
   * weapon in the game off one lucky stretch of course. Taking a DIFFERENT
   * power overwrites, because carrying two at once is a state nothing in the
   * HUD can say in the space available.
   */
  givePower(weaponId) {
    const w = WEAPONS[weaponId];
    if (!w) return null;
    this.weapon = weaponId;
    this.powerLeft = w.duration ?? 0;
    this.onPower?.(weaponId);
    return w;
  }

  /** Back to the default weapon, whatever was running. */
  clearPower() {
    this.weapon = DEFAULT_WEAPON;
    this.powerLeft = 0;
  }

  /** Cooldowns, grace and the power clock. Called once a frame by the Roster. */
  step(dt) {
    if (this.cd > 0) this.cd -= dt;
    if (this.iframes > 0) this.iframes -= dt;
    if (this.powerLeft > 0) {
      this.powerLeft -= dt;
      if (this.powerLeft <= 0) this.clearPower();
    }
  }

  reset() {
    this.hp = this.maxHp;
    this.cd = 0;
    this.iframes = 0;
    this.inbound = 0;
    this.target = null;
    this.shots = 0;
    this.hits = 0;
    this.kills = 0;
    this.taken = 0;
    this.clearPower();
  }
}

/**
 * Half a second of grace.
 *
 * Long enough that a squad firing together costs one hit rather than four,
 * short enough that a drone left alive still grinds you down. It is NOT a
 * dodge window — the player is not being asked to time anything with it.
 */
const IFRAMES = 0.5;

/**
 * Everyone in the fight.
 *
 * Deliberately a list and not a pair of named slots. Two players is the case
 * today; the field of rivals is four more; a PVP match is the same list with
 * different team labels on it. Nothing that reads this list knows how long it
 * is.
 */
export class Roster {
  constructor() {
    /** @type {Fighter[]} */
    this.fighters = [];
  }

  add(fighter) {
    this.fighters.push(fighter);
    return fighter;
  }

  remove(fighter) {
    const i = this.fighters.indexOf(fighter);
    if (i >= 0) this.fighters.splice(i, 1);
  }

  clear() {
    this.fighters.length = 0;
  }

  get length() { return this.fighters.length; }

  [Symbol.iterator]() { return this.fighters[Symbol.iterator](); }

  /** Everyone on this team, alive or not. */
  team(team) {
    return this.fighters.filter((f) => f.team === team);
  }

  /**
   * THE ONLY TARGETING QUESTION ANYTHING ASKS.
   *
   * Written to allocate nothing on the hot path: `into` is reused by the
   * caller. A drone runs this once a frame, and with a chevron of four drones
   * and a field of six fighters an allocating version is 240 arrays a second
   * for a list that changes about twice a run.
   */
  foesOf(team, into = []) {
    into.length = 0;
    for (const f of this.fighters) {
      if (f.team !== team && f.alive) into.push(f);
    }
    return into;
  }

  /** Everyone still standing, whatever side they are on. */
  aliveCount(team = null) {
    let n = 0;
    for (const f of this.fighters) {
      if (f.alive && (team === null || f.team === team)) n++;
    }
    return n;
  }

  step(dt) {
    for (const f of this.fighters) f.step(dt);
  }

  reset() {
    for (const f of this.fighters) f.reset();
  }
}

export { TEAM };
