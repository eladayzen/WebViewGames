// The game state machine and the one fixed-timestep update (§9.2, §9.1).
//
//   boot -> title -> dropIn -> riding <-> airborne <-> tumbling
//                                 |
//                          barrelEntry -> barrel -> barrelExit -> riding
//                                 |
//                             runOver -> scoreCard -> title
//
// `riding` is the hub; every other in-run state returns to it. Game state is
// PLAIN DATA and systems tick over it once per frame in a fixed order -- the
// render layer reads that data and never writes to it.
//
// FIXED TIMESTEP AT 60 Hz with an accumulator. The reaction-floor and gap
// guarantees in §5.3 are expressed in seconds and must not drift with frame
// rate; a variable-dt integration would make the pacing contract untestable.

import {
  H_TRIM as H_TRIM_FOR_SEEK, H_SPAN as H_SPAN_FOR_SEEK,
  FIXED_DT, MAX_FRAME_DT, WIPEOUTS_ALLOWED, SEABIRD_BONUS_DEGREES,
  DESIGN_W, DESIGN_H, PLAYER_X, PLAYER_H_HALF, PLAYER_X_HALF,
  SEABIRD_INTERVAL, DROPIN_SEC, ZONE_LENGTH,
} from '../data/tuning.js';
import { Wave } from '../wave/wave.js';
import { Player, PlayerState } from '../player/player.js';
import { HazardPool, Seabird, hits } from '../hazards/hazards.js';
import { PickupPool } from '../pickups/pickups.js';
import { SpawnDirector } from '../systems/spawnDirector.js';
import { Ramp } from '../systems/ramp.js';
import { MultiplierStack } from '../systems/multiplier.js';
import { BarrelController, BarrelPhase } from '../systems/barrel.js';
import { Scoring, CREW } from '../systems/scoring.js';
import { ZoneCycle } from '../systems/zoneCycle.js';
import { validateAll, runtimeAssertions } from '../systems/constraints.js';
import { KINDS } from '../render/particleKinds.js';

export const GameState = {
  TITLE: 'title',
  DROP_IN: 'dropIn',
  PLAYING: 'playing',
  RUN_OVER: 'runOver',
  SCORE_CARD: 'scoreCard',
};

const TITLE_SEC = 3.0;

export class Game {
  constructor({ input, renderer, hud, screens, audio, instrumentation }) {
    this.input = input;
    this.renderer = renderer;
    this.hud = hud;
    this.screens = screens;
    this.audio = audio;
    this.instr = instrumentation;

    this.wave = new Wave();
    this.player = new Player();
    this.hazards = new HazardPool();
    this.pickups = new PickupPool();
    this.seabird = new Seabird();
    this.spawner = new SpawnDirector();
    this.ramp = new Ramp();
    this.multiplier = new MultiplierStack();
    this.barrel = new BarrelController();
    this.scoring = new Scoring();
    this.zone = new ZoneCycle();

    this.state = GameState.TITLE;
    this.stateT = 0;
    this.paused = false;
    this.wipeoutsUsed = 0;
    this.pendingEnd = false;
    this.sessionBest = Scoring.loadSessionBest();

    this._events = {};
    this._lastCarve = 'trim';
    this._pickResult = {};
    this._accumulator = 0;
    this._lastTime = 0;
    this._devAsserts = import.meta.env ? import.meta.env.DEV : false;
    this._assertCooldown = 0;

    this.failModel = instrumentation.failModel;
    instrumentation.hooks.onFailModelChanged = (m) => this._setFailModel(m);
  }

  // -- boot ----------------------------------------------------------------

  boot() {
    // The constraints validator runs at boot over all authored data and FAILS
    // LOUDLY (§9.5). On-device there is no console, so it has to be visible on
    // the screen itself.
    const result = validateAll();
    if (!result.ok) {
      this.hud.showConstraintFailure(result.errors);
      if (window.Unity) window.Unity.call('CONSTRAINT VIOLATION: ' + result.errors[0]);
      if (console && console.error) console.error('Constraint violations:', result.errors);
    }
    if (this.renderer.missing.length && console && console.warn) {
      console.warn('Missing art (placeholders shown in magenta):', this.renderer.missing);
    }

    this._toTitle();
  }

  _setFailModel(m) {
    this.failModel = m;
    this.hud.setWipeouts(this._wipeoutsRemaining, this.failModel);
    this.hud.banner('FAIL MODEL: ' + (m === 'leash3' ? '3 WIPEOUTS' : 'ONE HIT'), true);
  }

  get _wipeoutsRemaining() {
    if (this.failModel !== 'leash3') return 0;
    return Math.max(0, WIPEOUTS_ALLOWED - this.wipeoutsUsed);
  }

  // -- state transitions ---------------------------------------------------

  _toTitle() {
    this.state = GameState.TITLE;
    this.stateT = 0;
    this._resetRun();
    this.screens.showTitle(this.sessionBest);
    this.hud.reset();
  }

  _resetRun() {
    this.wave.reset();
    this.player.reset();
    this.hazards.clear();
    this.pickups.clear();
    this.seabird.active = false;
    this.spawner.reset();
    this.ramp.reset();
    this.multiplier.reset();
    this.barrel.reset();
    this.scoring.reset();
    this.zone.reset();
    this.wipeoutsUsed = 0;
    this.pendingEnd = false;
    this.renderer.clearTransients();
    this.audio.duck(false);
  }

  /**
   * The drop-in beat: the boat drops Wren onto the shoulder. ~2 s,
   * NON-BLOCKING, auto-advancing on its own timer -- there is no button on the
   * board and the SDK requires the first playable state to be reachable on load
   * with no key press (§7.3).
   */
  _toDropIn() {
    this.state = GameState.DROP_IN;
    this.stateT = 0;
    this._resetRun();
    this.screens.hideTitle();
    this.screens.hideScoreCard();
    this.screens.showDropIn();
    this.hud.reset();
    this.instr.beginRun();
  }

  _toPlaying() {
    this.state = GameState.PLAYING;
    this.stateT = 0;
    this.screens.hideDropIn();
    this.hud.setWipeouts(this._wipeoutsRemaining, this.failModel);
    this.hud.zoneCaption(this.zone.current.name);
  }

  _endRun() {
    this.state = GameState.SCORE_CARD;
    this.stateT = 0;
    this.instr.endRun();
    Scoring.saveSessionBest(this.scoring.score);
    this.sessionBest = Math.max(this.sessionBest, Math.floor(this.scoring.score));
    this.screens.showScoreCard({
      rideSeconds: this.scoring.rideSeconds,
      coins: this.scoring.coins,
      bestTrick: this.scoring.bestTrick,
      highestMultiplier: this.scoring.highestMultiplier,
      crewPassed: this.scoring.crewIndex,
      crewTotal: CREW.length,
      score: this.scoring.score,
    });
    this.audio.duck(false);
  }

  restart() {
    if (this.state === GameState.SCORE_CARD || this.state === GameState.TITLE) {
      this._toDropIn();
    }
  }

  togglePause() {
    // Pause freezes the whole simulation WITHOUT changing the state machine's
    // current value, so resuming drops back into exactly what was paused (§9.2).
    this.paused = !this.paused;
    this.hud.setPaused(this.paused);
    return this.paused;
  }

  /**
   * Advance the simulation by `seconds` with the board at neutral, before the
   * first frame is ever drawn. `?warm=20`.
   *
   * This is a VERIFICATION affordance, not a gameplay one: a headless
   * screenshot otherwise always lands on the title card, because a virtual-time
   * browser run advances rAF only a handful of frames. Warming lets a capture
   * land on a representative frame -- hazards in flight, a coin arc on the
   * face, the ramp partway up -- deterministically. It is also handy during the
   * on-device tuning pass (§10, MVP-20) for jumping to late-run density without
   * playing three minutes to get there.
   */
  warmUp(seconds, seek = false) {
    this._toDropIn();
    this._toPlaying();
    const steps = Math.min(60 * 60 * 5, Math.round(seconds / FIXED_DT));
    const realInput = this.input;
    if (seek) {
      // `?warm=N&seek=1` drives the warm-up with a crude orb-seeking policy
      // instead of a neutral board, so the captured frame actually contains the
      // things worth looking at -- a coin arc mid-collect, a filling multiplier
      // stack, the barrel section. Without it a warm-up just holds the trim
      // line and every screenshot is the same quiet frame.
      //
      // It writes the SAME single lean scalar the board does (§4) and only
      // during warm-up; `this.input` is restored before the first real frame.
      this.input = { sample: () => this._seekLean() };
    }
    for (let i = 0; i < steps; i++) this._step(FIXED_DT);
    this.input = realInput;
  }

  _seekLean() {
    const scrolled = this.wave.scrolled;
    let want = null;
    for (const p of this.pickups.live) {
      const dx = p.worldX - scrolled;
      if (dx < 20 || dx > 2200) continue;
      const blocked = this.hazards.live.some((e) => {
        const ex = e.worldX - scrolled;
        return ex > -200 && ex < 2200 && p.h > e.hMin - 0.05 && p.h < e.hMax + 0.05;
      });
      if (blocked) continue;
      const rank = p.kind === 'orb' ? 0 : 1;
      if (!want || rank < want.rank || (rank === want.rank && dx < want.dx)) {
        want = { h: p.h, dx, rank };
      }
    }
    if (!want) {
      let near = null, nearDx = Infinity;
      for (const e of this.hazards.live) {
        const dx = e.worldX - scrolled;
        if (dx < 0 || dx > 900) continue;
        if (dx < nearDx) { nearDx = dx; near = e; }
      }
      if (!near) return 0;
      const h = near.h > 0.5 ? Math.max(0.06, near.hMin - 0.14) : Math.min(0.88, near.hMax + 0.14);
      return Math.max(-1, Math.min(1, (H_TRIM_FOR_SEEK - h) / H_SPAN_FOR_SEEK));
    }
    return Math.max(-1, Math.min(1, (H_TRIM_FOR_SEEK - want.h) / H_SPAN_FOR_SEEK));
  }

  // -- the loop ------------------------------------------------------------

  frame(now) {
    if (!this._lastTime) this._lastTime = now;
    let dt = (now - this._lastTime) / 1000;
    this._lastTime = now;
    if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;

    this._accumulator += dt;
    let steps = 0;
    while (this._accumulator >= FIXED_DT && steps < 6) {
      this._step(FIXED_DT);
      this._accumulator -= FIXED_DT;
      steps++;
    }

    this.renderer.draw(this._renderState(), this._accumulator / FIXED_DT);
    this.renderer.render();
  }

  _renderState() {
    return {
      wave: this.wave,
      player: this.player,
      hazards: this.hazards,
      pickups: this.pickups,
      seabird: this.seabird,
      zone: this.zone,
      barrel: this.barrel,
    };
  }

  _step(dt) {
    this.audio.update(dt);

    if (this.paused) {
      this.hud.updateBanners(0);
      return;
    }

    this.stateT += dt;
    this.hud.updateBanners(dt);
    this.hud.updateZoneCaption(dt);
    this.instr.update();

    switch (this.state) {
      case GameState.TITLE:
        this.screens.tickTitle(TITLE_SEC - this.stateT);
        if (this.stateT >= TITLE_SEC) this._toDropIn();
        break;

      case GameState.DROP_IN:
        // The world already scrolls under her during the drop-in, so the first
        // frame of play is not a standing start.
        this.wave.advance(dt, this.ramp.scrollSpeed);
        if (this.stateT >= DROPIN_SEC) this._toPlaying();
        break;

      case GameState.PLAYING:
        this._stepPlaying(dt);
        break;

      case GameState.SCORE_CARD:
        if (this.screens.tickScoreCard(dt)) this._toTitle();
        break;

      default:
        break;
    }
  }

  _stepPlaying(dt) {
    const p = this.player;
    const ev = this._events;
    ev.launched = null; ev.landed = null; ev.recovered = false;

    // THE ONE INPUT SCALAR. Nothing else in this function reads input.
    const lean = this.input.sample(dt);

    // Ride time excludes tumbles and the barrel (§5.10).
    const counts = p.state === PlayerState.RIDING || p.state === PlayerState.AIRBORNE;
    this.ramp.tick(dt, counts);
    const speed = this.ramp.scrollSpeed;

    this.wave.advance(dt, speed);
    p.update(dt, lean, this.wave, ev);

    this.hazards.update(dt, this.wave, speed);
    this.pickups.update(dt, this.wave);
    this.seabird.update(dt, this.wave);

    // The barrel has NO HAZARDS at MVP (§5.7), so the director is idle inside
    // it; the barrel controller routes its own coins.
    if (!this.barrel.active) {
      this.spawner.update(dt, {
        ramp: this.ramp,
        wave: this.wave,
        hazards: this.hazards,
        pickups: this.pickups,
        seabird: this.seabird,
        seabirdInterval: SEABIRD_INTERVAL,
        paused: false,
      });
    }

    this._announceTelegraphs();
    this._collide(dt, ev);
    this._collect();

    this.multiplier.update(dt);
    this.barrel.update(dt, {
      wave: this.wave,
      player: p,
      multiplier: this.multiplier,
      pickups: this.pickups,
      scrollSpeed: speed,
      onExit: () => {
        this.audio.duck(false);
        this.hud.banner('BACK OUT', false);
      },
    });

    // Base score accrues while riding, airborne and in the barrel -- NOT during
    // the tumble (§8.1).
    const accrues = p.state !== PlayerState.TUMBLING;
    this.scoring.tickBase(dt, this.multiplier.multiplier, accrues);

    if (p.carve !== this._lastCarve) {
      // One carve sound per committed lean, not per frame -- the hysteresis in
      // the player's carve state is what makes this a real edge rather than a
      // stutter at the deadzone (§6.1).
      if (p.carve !== 'trim') this.audio.play('carve', { volume: 0.5, rate: 0.95 + Math.random() * 0.12 });
      this._lastCarve = p.carve;
    }

    this._handleEvents(ev);
    this._updateCrew();
    this._updateZone(dt);
    this._emitAmbient(dt);
    this.renderer.particles.update(dt);
    this._updateHud();

    this.instr.sample(dt, lean, p.h, p.state === PlayerState.RIDING);

    if (this._devAsserts) {
      this._assertCooldown -= dt;
      if (this._assertCooldown <= 0) {
        this._assertCooldown = 0.5;
        const bad = runtimeAssertions({
          player: p,
          hazards: this.hazards.items,
          bannerQueueDepth: this.hud._queue.length,
        });
        if (bad.length && console && console.warn) console.warn('Runtime invariant:', bad);
      }
    }
  }

  /**
   * The urchin-puffer's telegraph gets a sound the first time it starts, so the
   * `!` bubble is not the only channel (§5.3's "nothing closes on the player
   * without one").
   */
  _announceTelegraphs() {
    for (const e of this.hazards.live) {
      if (e.type !== 'puffer') continue;
      if (e.state === 'telegraph' && !e._announced) {
        e._announced = true;
        this.audio.play('alert');
      }
    }
  }

  // -- collision and collection --------------------------------------------

  _collide(dt, ev) {
    const p = this.player;

    // The seabird: a TARGET, not a hazard, and only while airborne (§6.2).
    if (p.state === PlayerState.AIRBORNE
      && this.seabird.intersectsAirborne(this.wave, p.screenX, p.screenY)) {
      this.seabird.hit = true;
      p.addSeabirdBonus(SEABIRD_BONUS_DEGREES);
      const payout = this.scoring.addSeabird(this.multiplier.multiplier);
      this.renderer.addPayout(this.wave.scrolled, 1.0, '+' + Math.floor(payout).toLocaleString('en-US'), false);
      this.audio.play('payout', { rate: 1.25 });
    }

    if (!p.collidable) return;

    for (const e of this.hazards.live) {
      if (!hits(e, this.wave.scrolled, p.h, PLAYER_H_HALF, PLAYER_X_HALF)) continue;
      this._wipeout(e);
      break;
    }
  }

  /**
   * ONE FAIL SOURCE ONLY: contact with a hazard (§5.8). The lip is a launch
   * ramp, not a boundary; there is no fail at the bottom of the face, ever; and
   * the seabird is a target.
   */
  _wipeout(entity) {
    const p = this.player;
    p.wipeout();
    this.wipeoutsUsed++;
    this.multiplier.loseAll();   // the stack is lost ENTIRELY
    this.instr.noteWipeout();
    this.audio.play('wipeout');

    const x = p.screenX * DESIGN_W;
    const y = this.wave.faceY(p.screenX, p.h) * DESIGN_H;
    this.renderer.particles.emit(KINDS.FOAM, x, y, 26, {
      speed: 460, cone: 2.6, angle: -Math.PI / 2, life: 0.85, size: 74, gravity: 760, alpha: 0.95,
    });

    // The leash: the third wipeout ends the run. Under 'onehit', the first
    // does. Both live behind this one flag so the POC-7 A/B stays runnable on
    // hardware without a rebuild -- DO NOT DELETE THE LOSING PATH (§5.8).
    this.pendingEnd = this.failModel === 'onehit' || this.wipeoutsUsed >= WIPEOUTS_ALLOWED;
    this.hud.setWipeouts(this._wipeoutsRemaining, this.failModel);
    if (!this.pendingEnd) this.hud.banner('WIPEOUT', true);
  }

  _collect() {
    const r = this.pickups.collect(this.wave.scrolled, this.player.h, this._pickResult);
    if (r.coins > 0) {
      const gained = this.scoring.addCoins(r.coins, this.multiplier.multiplier);
      for (const pop of r.coinPops) {
        this.renderer.addPayout(pop.worldX, pop.h, '+250', false);
        this.renderer.particles.emit(KINDS.SPRAY, this.wave.screenXpx(pop.worldX),
          this.wave.faceY(this.wave.screenX(pop.worldX), pop.h) * DESIGN_H, 4,
          { speed: 150, life: 0.35, size: 22, gravity: 260, tint: 0xe9b64a, alpha: 0.8 });
      }
      this.audio.play('coin', { rate: 0.96 + Math.random() * 0.12 });
    }

    if (r.orbs > 0) {
      for (let i = 0; i < r.orbs; i++) {
        // An orb fills the next empty slot immediately on pickup, with no
        // input. A full stack fires the barrel BY ITSELF (§0.4, §5.6).
        const topped = this.multiplier.addOrb();
        this.audio.play('slot');
        if (topped && this.barrel.canFire()) this._fireBarrel();
      }
      this.hud.banner('×' + this.multiplier.multiplier, false);
      this.audio.play('orb');
    }

    // A stack that filled during the barrel cooldown fires as soon as the
    // cooldown clears -- "a fourth orb collected during cooldown still fills
    // slots normally; the barrel just won't re-fire until the cooldown clears".
    if (this.multiplier.isFull && this.barrel.canFire()) this._fireBarrel();
  }

  _fireBarrel() {
    // Hazards already in flight are outside the wave once it closes over her;
    // the interior is threat-free by design (§5.7).
    this.hazards.clear();
    this.barrel.fire({
      wave: this.wave, player: this.player, multiplier: this.multiplier,
    });
    this.audio.play('barrel');
    this.audio.duck(true);
    this.hud.banner('BARREL  ×6', true);
  }

  // -- events ---------------------------------------------------------------

  _handleEvents(ev) {
    if (ev.launched) {
      this.audio.play('launch', { rate: 0.92 + ev.launched.power * 0.3 });
      const x = this.player.screenX * DESIGN_W;
      const y = this.wave.faceY(this.player.screenX, 1) * DESIGN_H;
      this.renderer.particles.emit(KINDS.SPRAY, x, y, 18, {
        speed: 380, cone: 1.5, angle: -Math.PI * 0.75, life: 0.7, size: 58, gravity: 700,
      });
    }

    if (ev.landed) {
      const { degrees } = ev.landed;
      if (degrees > 0) {
        const payout = this.scoring.addTrick(degrees, this.multiplier.multiplier);
        // Big chunky white slab numerals with a soft glow, floating in world
        // space under the surfer -- as the reference does (§5.4).
        this.renderer.addPayout(this.wave.scrolled, this.player.h,
          Math.floor(payout).toLocaleString('en-US'), true);
        this.audio.play('payout');
      }
      this.audio.play('land');
      const x = this.player.screenX * DESIGN_W;
      const y = this.wave.faceY(this.player.screenX, this.player.h) * DESIGN_H;
      this.renderer.particles.emit(KINDS.FOAM, x, y, 16, {
        speed: 280, cone: 2.2, angle: -Math.PI / 2, life: 0.6, size: 62, gravity: 640,
      });
    }

    if (ev.recovered && this.pendingEnd) this._endRun();
  }

  _updateCrew() {
    const passed = this.scoring.checkCrewPass();
    if (passed) {
      this.hud.banner('PASSED ' + passed.name, true);
      this.audio.play('crew');
    }
    const rival = this.scoring.rival;
    this.hud.setCrew(
      this.scoring.ladderLabel,
      this.scoring.remainingGap,
      rival ? `assets/${rival.portrait}.png` : null,
      !rival,
    );
  }

  _updateZone(dt) {
    const entered = this.zone.update(this.wave.scrolled, dt);
    if (entered) this.hud.zoneCaption(entered.name);
  }

  /** Spray off the board, and foam wash along the trough. */
  _emitAmbient(dt) {
    const p = this.player;
    if (p.state !== PlayerState.RIDING && p.state !== PlayerState.BARREL) return;
    const x = p.screenX * DESIGN_W;
    const y = this.wave.faceY(p.screenX, p.h) * DESIGN_H;
    const rate = 0.6 + Math.abs(p.dh) * 3.2;
    this._sprayAcc = (this._sprayAcc || 0) + dt * rate * 60;
    while (this._sprayAcc >= 1) {
      this._sprayAcc -= 1;
      this.renderer.particles.emit(KINDS.SPRAY, x - 26, y + 6, 1, {
        speed: 120 + Math.abs(p.dh) * 420, cone: 0.8, angle: Math.PI * 0.88,
        life: 0.45, size: 30, gravity: 420, alpha: 0.55,
      });
    }
    if (this.barrel.inside && Math.random() < 0.5) {
      this.renderer.particles.emit(KINDS.BUBBLE, Math.random() * DESIGN_W, DESIGN_H * 0.9, 1, {
        speed: 60, cone: 0.6, angle: -Math.PI / 2, life: 2.2, size: 26, gravity: -60, alpha: 0.5,
      });
    }
  }

  _updateHud() {
    this.hud.setScore(this.scoring.displayScore);
    this.hud.setCoins(this.scoring.coins);
    this.hud.setSlots(this.multiplier.slots, this.multiplier.sweep);
    this.hud.updateTopRunFade(
      this.player.state === PlayerState.AIRBORNE,
      this.player.screenX,
      this.player.screenY,
    );
  }
}
