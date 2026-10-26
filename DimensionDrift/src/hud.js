// Thin binder over the DOM UI. Every querySelector lives here, and nothing is
// written to the document unless the value actually changed — a HUD that rewrites
// textContent sixty times a second forces style recalculation next to a WebGL
// canvas that wants the whole frame budget.
//
// The reactions — a promotion, a landing, a gain — are played through
// Element.animate() rather than by toggling animation classes. Two reasons.
// Restarting a CSS animation on an element that is already running it needs a
// forced reflow (`void el.offsetWidth`) to flush, and landings and gates arrive
// in bursts; and the amplitude of these has to scale with the event — a landing
// off a big kicker must hit harder than a hop off a roller — which keyframes
// alone cannot express. These animate transform and opacity only, so they run
// on the compositor and never touch layout.
//
// Timing rule for everything below: the physical half of a reaction is
// immediate, the acknowledging half may be a little late, and NOTHING outlives
// the moment it is describing. A landing is done in half a second because half
// a second later the player is looking at the next gate.

import { Screens } from './shared/bobo-ui/screens.js';

const $ = (id) => document.getElementById(id);

/** Every state this game has. `over` was `screenOver`'s id and is now
 *  `results`, which is the name the other four games already used — one
 *  vocabulary across five games was the whole point of the shared layer. */
// `stance` is the board-setup screen (BAL-584). Registered here or `go()`
// throws on it -- which is exactly what happened the first time: the game
// entered the stance state and the screen never appeared, because the throw
// landed after the state had been set.
const STATES = ['load', 'title', 'place', 'count', 'play', 'pause', 'settings', 'stance', 'sensor', 'results'];

/** The states in which the world is running and there is no menu over it.
 *  `count` is one of them: the run has started, the panel is gone, and the
 *  numbers are counting down over a live mountain. */
const PLAY_STATES = ['play', 'count'];

// Mirrors main.js. Only the charge bar reads these: if the scoring changes and
// these do not, the bar simply fills at the wrong rate.
const COMBO_STEP = 4;
const MAX_MULT = 8;

// How long a flourish may be held back to land on the beat. The track is around
// 110 bpm, so a whole beat is 545 ms — far too long to wait for anything the
// player did with their own hands. Only the second, acknowledging half of a
// reaction is ever quantised, and only when the beat is already nearly here;
// otherwise it fires now and is merely early for the next one.
const BEAT_SNAP_MS = 150;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class Hud {
  constructor() {
    this.el = {
      placeNow: $('placeNow'),
      placeSep: $('placeSep'),
      hud: $('hud'),
      hudTop: $('hudTop'),
      hudBottom: $('hudBottom'),
      score: $('score'),
      scoreGain: $('scoreGain'),
      elapsed: $('elapsed'),
      combo: $('combo'),
      comboStat: $('comboStat'),
      comboRing: $('comboRing'),
      comboCharge: $('comboCharge'),
      chargePips: $('comboCharge').querySelectorAll('i'),
      landFlash: $('landFlash'),
      callouts: $('callouts'),
      progress: $('progress'),
      progressFill: $('progressFill'),
      progressHead: $('progressHead'),
      progressPing: $('progressPing'),
      moodName: $('moodName'),
      speedText: $('speedText'),
      edgeL: $('edgeL'),
      edgeR: $('edgeR'),
      edgeMeter: $('edgeMeter'),
      edgeTick: $('edgeTick'),
      countNum: $('countNum'),
      chromeRow: $('chromeRow'),
      pauseBtn: $('btnPause'),
      clock: $('clock'),
      clockValue: $('clockValue'),
      clockFill: $('clockFill'),
      clockUnit: $('clockUnit'),
      resultsMission: $('resultsMission'),
      bestScore: $('bestScore'),
      bestRank: $('bestRank'),
      sensorText: $('sensorText'),
      loadText: $('loadText'),
      rank: $('rank'),
      overTitle: $('overTitle'),
      finalScore: $('finalScore'),
      newBest: $('newBest'),
      statGates: $('statGates'),
      statCarves: $('statCarves'),
      statAir: $('statAir'),
      statTop: $('statTop'),
      fatal: $('fatal'),
      buildStamp: $('buildStamp'),
      modeList: $('modeList'),
      placeList: $('placeList'),
      placeFor: $('placeFor'),
      scoreLabel: $('scoreLabel'),
      timeStat: $('timeStat'),
      diag: $('diag'),
      diagText: $('diagText'),
    };

    this._last = {};
    this._screen = 'load';
    this._handlers = {};
    this._anim = {};
    this._live = false;
    this.resetRun();

    // ── SCREENS, AND WHY THERE ARE NO `addEventListener` CALLS HERE ────────
    // There used to be eight, one per button id, and every id appeared twice —
    // once in the markup and once here — so a renamed button was a silently
    // dead control. `Screens` binds by `data-act` through delegation, so the
    // markup is the only place a button's identity is written down, and an act
    // with no handler is a console warning rather than a button that does
    // nothing. See `shared/bobo-ui/screens.js`.
    //
    // The acts are declared here and RESOLVED LATE, through `this._handlers`,
    // because main.js installs them with `hud.on(...)` after construction.
    this.ui = new Screens({
      states: STATES,
      play: PLAY_STATES,
      // NO LIST. Every act main.js registers with `hud.on` resolves here at
      // the moment it fires, so a new button is a line of markup and a
      // handler, never a third place to remember. The list that used to live
      // here went stale twice in one week: it still carried `menu-close` and
      // `to-pause` after BAL-585 deleted those rows, and it did not carry the
      // board-setup acts, so the rotate button was dead markup. An act with
      // no handler still warns, because `resolve` returns undefined for one.
      resolve: (act) => (this._handlers[act] ? (e) => this._fire(act, e) : undefined),
    });
  }

  /**
   * Draw the lobby's mode buttons.
   *
   * They carry `data-act="start"` like the single button they replaced, so
   * `Screens` binds them by delegation exactly as before and the act is still
   * the only name written down. Which mode was picked rides on `data-mode`,
   * read off the element the act came from.
   */
  setModes(modes) {
    if (!this.el.modeList) return;
    this.el.modeList.innerHTML = '';
    for (const m of modes) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'say say-go say-mode';
      b.dataset.act = 'start';
      b.dataset.mode = m.id;
      const label = document.createElement('span');
      label.className = 'btn-label';
      label.textContent = m.name;
      // LABEL ONLY. The taglines went with the primer and the screen taglines:
      // "all of the text near the buttons, we don't need it". A mode is a word
      // you choose between, and a sentence under each one is a sentence nobody
      // reads twice. `tagline` stays on the registered mode -- it costs nothing
      // and the end card and any future briefing screen may want it.
      b.append(label);
      this.el.modeList.appendChild(b);
    }
  }
  /**
   * The second lobby screen's buttons, built from the place registry.
   *
   * Same construction as `setModes` and deliberately so: one screen shape, one
   * button class, one way a list of choices looks in this game. `data-act` is
   * `place` rather than `start`, because choosing where does not begin a run --
   * it is the second of two questions and only the second one drops you in.
   */
  setPlaces(places) {
    if (!this.el.placeList) return;
    this.el.placeList.innerHTML = '';
    for (const p of places) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'say say-go say-mode';
      b.dataset.act = 'place';
      b.dataset.place = p.id;
      const label = document.createElement('span');
      label.className = 'btn-label';
      label.textContent = p.name;
      b.append(label);
      this.el.placeList.appendChild(b);
    }
  }

  /**
   * What the route screen is choosing, in the words of the mode that asked.
   * "race route" for the race, plain "route" for the endless descent.
   */
  setPlaceFor(label) {
    if (this.el.placeFor) this.el.placeFor.textContent = label;
  }


  /**
   * Show or hide the score and combo column.
   *
   * The whole stack goes, not just the numerals: a labelled SCORE with nothing
   * under it is a readout that has broken, and an empty column still holds the
   * space that made centring the clock awkward in the first place.
   */
  setScoreVisible(v) {
    this.el.hudTop.hidden = !v;
  }

  /**
   * Strip the left column down to ONE readout.
   *
   * Asked for on the race: "remove UI on the left - everything but your
   * location." The time and the combo are both chill vibe's language -- how
   * long you have survived, and how long you have strung scoring together --
   * and a race has neither. It is 2400 m against four riders, so the only thing
   * worth the corner of the screen is where you are in the field.
   *
   * The elements are hidden rather than emptied: a labelled TIME with nothing
   * under it is a readout that has broken.
   */
  setSoloStat(v) {
    if (this.el.timeStat) this.el.timeStat.hidden = v;
    if (this.el.comboStat) this.el.comboStat.hidden = v;
  }

  /**
   * Turn the score column into a PLACE column, for a mode that has no score.
   *
   * The race hides the score outright, which left the one number that actually
   * matters during a race -- where you are in the field -- readable only after
   * you had crossed the line. This reuses the slot rather than adding a fifth
   * thing to the top of the screen: same position, same type, only the label
   * and the value change.
   *
   * Deliberately NOT routed through `setScore`, which rounds, formats with
   * thousands separators and calls `resetRun` whenever the number goes DOWN --
   * and a place going down is the good direction.
   *
   * @param {string|null} text e.g. '2nd', or null to hand the slot back.
   */
  setPlace(text) {
    // CENTRE STAGE NOW, not the corner slot. "Take the first/second place out
    // of the [corner] UI, put it in the middle, above the kilometers left."
    // The score column is a score again everywhere; the race hides it whole.
    const el = this.el.placeNow;
    if (!el) return;
    if (text == null) {
      el.hidden = true;
      if (this.el.placeSep) this.el.placeSep.hidden = true;
      this._last.place = null;
      return;
    }
    el.hidden = false;
    if (this.el.placeSep) this.el.placeSep.hidden = false;
    if (el.textContent === text) return;
    const was = this._last.place;
    el.textContent = text;
    // "Big squeeze animation -- becoming bigger and lighter -- when I'm passing
    // or being passed." Only on a REAL change of placing: the first write of a
    // run (from the '--' placeholder) is the race starting, not an overtake.
    if (was && was !== '—' && text !== '—') {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
      clearTimeout(this._placeBumpTimer);
      this._placeBumpTimer = setTimeout(() => el.classList.remove('bump'), 650);
    }
    this._last.place = text;
  }

  on(evt, fn) { this._handlers[evt] = fn; }
  _fire(evt, e) { this._handlers[evt]?.(e); }

  /**
   * The name main.js still calls, translated onto the shared vocabulary.
   *
   * Two translations, and both are the old interface being imprecise rather
   * than the new one being awkward: `over` is `results` in the other four
   * games, and `null` used to mean "take the menu away", which is not the
   * absence of a state — it is the `play` state, and naming it is what lets
   * `Screens` decide whether the wash is up.
   */
  setScreen(name) {
    this.ui.go(name === null ? 'play' : name === 'over' ? 'results' : name);
    this._screen = this.ui.state;
    this._syncChrome();
  }

  /**
   * Who gets the chrome row.
   *
   * IT FOLLOWS THE SCREEN, NOT `is-live`. It used to ride on `setLive`, which is
   * true only during play — so the X was invisible on pause, results and the
   * lobby. That was survivable while the X merely paused; it is not now that the
   * X is the ONLY way from the lobby to the platform, and the only way from
   * pause or results back to the lobby. A navigation control that disappears on
   * every screen you would navigate FROM is not a navigation control.
   *
   * The host's back gesture always reached `_back()` regardless, so the button
   * being missing never disabled the behaviour — it just hid it from anyone
   * without a system back gesture, which on a board is everyone.
   *
   * PAUSE IS THE EXCEPTION and hides on its own. It means nothing on the lobby
   * or the results screen, and a dead control next to a live one teaches people
   * not to trust either.
   */
  _syncChrome() {
    const st = this._screen;
    this.el.chromeRow.classList.toggle('is-live', st !== 'load');
    this.el.pauseBtn.hidden = !(st === 'play' || st === 'count' || st === 'pause');
  }

  setLive(live) {
    this._live = live;
    this.el.hud.classList.toggle('is-live', live);
  }

  /**
   * Everything the HUD remembers about the run in progress, back to zero.
   *
   * Called from setScore whenever the score goes DOWN, which only happens when a
   * new run starts, so this needs no wiring of its own — but it is public, and
   * calling it from _beginRun is the honest version.
   */
  resetRun() {
    this._comboN = 0;
    this._fresh = true;
    this._speedTier = 5;
    this._gainVal = 0;
    this._gainAt = -1e9;
    this._slamUntil = 0;
    this._hot = false;
    this._last.combo = 1;
    this._last.clock = undefined;
    this._last.elapsed = undefined;
    this.el.elapsed.textContent = '0:00';
    this.el.clock.classList.remove('is-low', 'gained', 'lost');
    this.el.combo.classList.remove('broke');
    this.el.comboStat.style.setProperty('--heat', '0');
    this.el.comboCharge.classList.remove('maxed');
    this.el.chargePips.forEach((p) => p.classList.remove('on'));
    this.el.edgeMeter.classList.remove('is-hot');
  }

  /**
   * Play a one-shot on an element, replacing whatever that slot was playing.
   *
   * `fill: none` on purpose: the element must return to the style the sheet
   * gives it the instant the animation ends, so nothing an event left behind can
   * be inherited by the next one.
   *
   * The default easing is LINEAR, and every curve below is written on the
   * keyframe it starts from. An easing on the effect as a whole warps the
   * offsets — an ease-out over five stops moved a peak written at 80 ms to
   * about 15 ms and stretched the settle across the rest — which makes the one
   * thing that has to be right here, the timing, impossible to read off the
   * numbers.
   */
  _play(key, el, frames, options) {
    if (!el) return null;
    this._anim[key]?.cancel();
    const a = el.animate(frames, { fill: 'none', easing: 'linear', ...options });
    this._anim[key] = a;
    return a;
  }

  // ── the beat ──────────────────────────────────────────────────────────────

  /**
   * One beat of the music has just passed. The period is measured from the gaps
   * between calls rather than taken from the grid's bpm, for the same reason
   * BeatPulse reads the beat list: the generated track drifts.
   */
  beat() {
    const now = performance.now();
    const gap = now - (this._beatAt ?? 0);
    if (this._beatAt && gap > 240 && gap < 1400) {
      this._beatMs = this._beatMs ? this._beatMs * 0.7 + gap * 0.3 : gap;
    }
    this._beatAt = now;
    if (!this._live || !this._hot) return;
    // Small enough to be felt rather than watched: up in 45 ms, gone in 260.
    this._play('tick', this.el.edgeTick, [
      { transform: 'scaleY(1)', opacity: 0.75, offset: 0, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
      { transform: 'scaleY(1.55)', opacity: 1, offset: 0.18, easing: 'cubic-bezier(0.4, 0, 0.4, 1)' },
      { transform: 'scaleY(1)', opacity: 0.75, offset: 1 },
    ], { duration: 260 });
  }

  /** Run `fn` on the next beat if one is nearly here, otherwise right now. */
  _onBeat(fn) {
    if (!this._beatMs || !this._beatAt) return fn();
    const since = performance.now() - this._beatAt;
    const wait = this._beatMs - (since % this._beatMs);
    if (wait > 4 && wait <= BEAT_SNAP_MS) setTimeout(fn, wait);
    else fn();
  }

  /**
   * The mood mixer's live sky colour, published as `--sky`.
   *
   * IT USED TO BE `--accent` AND THAT WAS A BUG. `--accent` is `bobo-ui`'s
   * contract colour: the shared layer paints `--accent-ink` on top of it and
   * promises the pair is legible. This value is whatever the sky is, including
   * a dark alpenglow — a 640x360 capture caught the wordmark and the primary
   * button both rendered dark-on-dark because of it. The interface keeps a
   * stable accent; the world keeps a live one. See styles.css's `:root`.
   */
  setAccent(color) {
    const hex = `#${color.getHexString()}`;
    if (this._last.accent === hex) return;
    this._last.accent = hex;
    document.documentElement.style.setProperty('--sky', hex);
  }

  setScore(n) {
    const v = Math.round(n);
    const prev = this._last.score;
    if (prev === v) return;
    this._last.score = v;
    this.el.score.textContent = v.toLocaleString('en-US');
    if (prev == null) return;
    // The score only ever falls at the start of a new run.
    if (v < prev) { this.resetRun(); return; }
    // Distance is scored continuously, an award is scored all at once, and the
    // difference is a step far larger than one frame of ground. Used only until
    // award() is wired, which reports the figure exactly.
    if (!this._awardWired && v - prev >= 40) this._gain(v - prev);
  }

  /**
   * A discrete award — a gate, a carve, a landing — already multiplied.
   * Preferred over letting setScore infer it: at a low frame rate a single
   * frame of distance can look like a small award.
   */
  award(points) {
    this._awardWired = true;
    this._gain(points);
  }

  /**
   * The score reacting to a gain, with weight proportional to it. A gate at ×1
   * is a tick; a long air at ×6 is a jolt with a number thrown off it.
   */
  _gain(points) {
    const p = Math.round(points);
    if (p <= 0 || !this._live) return;
    const now = performance.now();
    // A gate taken out of a carve is ONE moment. Two ghosts fighting for the
    // same 30 px read as noise, and — worse — halve the number the player sees.
    const merged = now - this._gainAt < 260 ? this._gainVal + p : p;
    this._gainAt = now;
    this._gainVal = merged;

    const k = clamp01(merged / 500);
    // Out in 80 ms, past the mark, back by 350. The size of the overshoot is
    // the whole message: a gate at ×1 barely moves, a long air at ×6 jolts.
    this._play('scoreBump', this.el.score, [
      { transform: 'scale(1)', offset: 0, easing: 'cubic-bezier(0.2, 0.85, 0.4, 1)' },
      { transform: `scale(${(1.05 + k * 0.16).toFixed(3)})`, offset: 0.23, easing: 'cubic-bezier(0.4, 0, 0.3, 1)' },
      { transform: `scale(${(1 - k * 0.022).toFixed(3)})`, offset: 0.62, easing: 'ease-out' },
      { transform: 'scale(1)', offset: 1 },
    ], { duration: 340 + k * 200 });

    // Below a gate's worth at ×1 the bump says it on its own.
    if (merged < 60) return;
    const g = this.el.scoreGain;
    g.textContent = `+${merged.toLocaleString('en-US')}`;
    g.style.setProperty('--gain', k.toFixed(2));
    const s = 0.9 + k * 0.3;
    this._play('scoreGain', g, [
      { opacity: 0, transform: `translateY(7px) scale(${(s * 0.8).toFixed(3)})`, offset: 0, easing: 'cubic-bezier(0.15, 0.9, 0.3, 1)' },
      { opacity: 1, transform: `translateY(-1px) scale(${s.toFixed(3)})`, offset: 0.18, easing: 'ease-out' },
      { opacity: 0.95, transform: `translateY(-8px) scale(${s.toFixed(3)})`, offset: 0.55, easing: 'ease-in' },
      { opacity: 0, transform: `translateY(-22px) scale(${(s * 0.94).toFixed(3)})`, offset: 1 },
    ], { duration: 620 + k * 200 });
  }

  /**
   * The multiplier, and how close the next one is.
   *
   * `combo` is the raw streak count; without it each call is taken to be one
   * scoring event, which is what main.js currently reports, and the charge bar
   * counts them itself. Passing the real count makes it exact — and once one
   * call has passed it, the counted ones are ignored, so the two styles can
   * coexist through a wiring change without the charge bar counting twice.
   */
  setCombo(mult, combo = null) {
    const prev = this._last.combo ?? 1;
    if (combo != null) this._comboWired = true;
    else if (this._comboWired) return;
    if (combo == null) {
      if (this._fresh && mult === 1) combo = 0;
      else if (mult < prev) combo = 0;
      else combo = this._comboN + 1;
    }
    this._fresh = false;
    if (prev === mult && this._comboN === combo) return;
    const grew = mult > prev;
    const broke = mult < prev || (combo === 0 && this._comboN > 0);
    this._last.combo = mult;
    this._comboN = combo;
    this.el.combo.textContent = `×${mult}`;

    const maxed = mult >= MAX_MULT;
    const heat = clamp01((mult - 1) / (MAX_MULT - 1));
    this.el.comboStat.style.setProperty('--heat', heat.toFixed(2));
    this.el.comboCharge.classList.toggle('maxed', maxed);
    this.el.edgeMeter.classList.toggle('is-hot', mult > 1);
    this._hot = mult > 1;

    // A promotion holds the full bar for a sixth of a second before emptying
    // it: filling the fourth pip and clearing all four in the same frame reads
    // as the bar going backwards, not as the bar being spent.
    const fill = (n) => this.el.chargePips.forEach((p, i) => p.classList.toggle('on', i < n));
    clearTimeout(this._chargeTimer);
    if (grew && !maxed) {
      fill(COMBO_STEP);
      this._chargeTimer = setTimeout(() => fill(combo % COMBO_STEP), 150);
    } else {
      fill(maxed ? COMBO_STEP : combo % COMBO_STEP);
    }

    if (!this._live) return;
    if (grew) this._promote(heat);
    else if (broke) this._breakCombo();
    else if (combo > 0) {
      // One more in the bank. The pip that just lit leans out and settles.
      const pip = this.el.chargePips[(combo - 1) % COMBO_STEP];
      this._play('pip', pip, [
        { transform: 'scaleY(1)', offset: 0, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
        { transform: 'scaleY(2.8)', offset: 0.2, easing: 'cubic-bezier(0.4, 0, 0.3, 1)' },
        { transform: 'scaleY(1)', offset: 1 },
      ], { duration: 300 });
    }
  }

  _promote(heat) {
    // Weight, not a pop: out to the peak in 85 ms, past the mark on the way
    // back, one small settle, home at 520.
    this._play('combo', this.el.combo, [
      { transform: 'scale(1)', offset: 0, easing: 'cubic-bezier(0.2, 0.9, 0.35, 1)' },
      { transform: `scale(${(1.26 + heat * 0.12).toFixed(3)})`, offset: 0.16, easing: 'cubic-bezier(0.45, 0, 0.3, 1)' },
      { transform: 'scale(0.962)', offset: 0.52, easing: 'ease-out' },
      { transform: 'scale(1.014)', offset: 0.78, easing: 'ease-out' },
      { transform: 'scale(1)', offset: 1 },
    ], { duration: 520 });
    // The shockwave is the acknowledgement rather than the event, so it is the
    // half allowed to wait for the music.
    this._onBeat(() => this._play('comboRing', this.el.comboRing, [
      { transform: 'scale(0.45)', opacity: 0.85, offset: 0, easing: 'cubic-bezier(0.1, 0.65, 0.3, 1)' },
      { transform: 'scale(1.15)', opacity: 0.5, offset: 0.4, easing: 'ease-out' },
      { transform: 'scale(1.6)', opacity: 0, offset: 1 },
    ], { duration: 560 }));
  }

  _breakCombo() {
    this.el.combo.classList.add('broke');
    clearTimeout(this._breakTimer);
    this._breakTimer = setTimeout(() => this.el.combo.classList.remove('broke'), 240);
    // Dropped rather than struck — it falls, squashes and comes back up empty.
    this._play('combo', this.el.combo, [
      { transform: 'translateY(0) scale(1)', offset: 0, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' },
      { transform: 'translateY(5px) scale(0.86)', offset: 0.3, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
      { transform: 'translateY(0) scale(1)', offset: 1 },
    ], { duration: 440 });
  }

  /**
   * A landing. The most physical thing that happens in the game, so the HUD
   * takes the hit with the rider: the two bars compress toward each other and
   * settle, and the snow lights up at the bottom edge where the board is.
   *
   * @param {{airTime?: number, impact?: number, clean?: boolean}} info
   */
  land({ airTime = 0, impact = 0, clean = true } = {}) {
    if (!this._live) return;
    // Weight comes from the impact, except that a long floaty air off a big
    // kicker can come down gently and still be the biggest thing in the run —
    // so time in the air can carry the moment on its own.
    const k = Math.max(0.2, clamp01(Math.max(impact / 22, airTime / 2.2)));
    const dip = (clean ? 5 + k * 8 : 3 + k * 5);
    // Down in 55 ms — that is the impact, and it has to be faster than the eye
    // — then most of half a second riding it out. Fast in, slow out, or the
    // whole thing reads as a wobble rather than as weight.
    const squash = (key, el, sign) => this._play(key, el, [
      { transform: 'translateY(0)', offset: 0, easing: 'cubic-bezier(0.35, 0, 0.25, 1)' },
      { transform: `translateY(${(dip * sign).toFixed(2)}px)`, offset: 0.13, easing: 'cubic-bezier(0.25, 0.7, 0.3, 1)' },
      { transform: `translateY(${(-dip * sign * 0.18).toFixed(2)}px)`, offset: 0.5, easing: 'ease-out' },
      { transform: 'translateY(0)', offset: 1 },
    ], { duration: 420 + k * 130 });
    squash('landTop', this.el.hudTop, 1);
    squash('landBottom', this.el.hudBottom, -0.55);

    this.el.landFlash.classList.toggle('sketchy', !clean);
    const peak = (clean ? 0.20 + k * 0.30 : 0.24 + k * 0.22);
    this._play('landFlash', this.el.landFlash, [
      { opacity: 0, transform: 'translateY(16%) scaleY(0.8)', offset: 0, easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)' },
      { opacity: peak, transform: 'translateY(0) scaleY(1)', offset: 0.13, easing: 'cubic-bezier(0.35, 0, 0.6, 1)' },
      { opacity: 0, transform: 'translateY(-3%) scaleY(1.06)', offset: 1 },
    ], { duration: 320 + k * 160 });

    this._slamNextCallout();
  }

  /**
   * A gate. Clean ones ping off the head of the run — the only place on the
   * HUD that already means "where you are" — and a miss shakes it. Deliberately
   * wordless: gates arrive every couple of beats and a callout each time would
   * bury everything that matters more.
   */
  gate(ok = true) {
    if (!this._live) return;
    if (ok) {
      // Three stops rather than two so the ring is still THERE while it grows:
      // one easing governs both properties, and an ease-out over the pair took
      // the opacity to nothing in the first sixth of the expansion.
      this._play('ping', this.el.progressPing, [
        { transform: 'scale(0.28)', opacity: 0.95, offset: 0, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)' },
        { transform: 'scale(0.82)', opacity: 0.72, offset: 0.38, easing: 'ease-in' },
        { transform: 'scale(1)', opacity: 0, offset: 1 },
      ], { duration: 430 });
      return;
    }
    this.el.progressHead.classList.add('miss');
    clearTimeout(this._missTimer);
    this._missTimer = setTimeout(() => this.el.progressHead.classList.remove('miss'), 420);
    this._play('ping', this.el.progress, [
      { transform: 'translateX(0)', offset: 0 },
      { transform: 'translateX(-3px)', offset: 0.2 },
      { transform: 'translateX(3px)', offset: 0.5 },
      { transform: 'translateX(-1.5px)', offset: 0.75 },
      { transform: 'translateX(0)', offset: 1 },
    ], { duration: 300 });
  }

  /**
   * The clock, which is the run.
   *
   * THE NUMERAL IS CEILINGED, not rounded. A clock reading 0 while the run is
   * still going is the readout calling the player dead before the game does,
   * and `Math.round` shows 0 for the whole last half second. Ceiling means the
   * numeral hits 0 exactly when the run does.
   *
   * The bar is driven by `transform: scaleX`, never `width`: it changes every
   * frame, and a width animation on something over a WebGL canvas relayouts the
   * HUD sixty times a second for a three-pixel bar.
   */
  setClock(c) {
    if (!c || !this.el.clock) return;
    // THE SLOT IS THE MODE'S, not the clock's. It is the biggest number on the
    // screen and it must always be the thing the run is actually about: seconds
    // left in chill vibe, metres left in the race. A countdown ticking in a mode
    // that has no clock is worse than an empty slot — it is the readout lying
    // about what ends the run.
    const shown = c.text ?? String(Math.max(0, Math.ceil(c.remaining - 1e-6)));
    const prev = this._last.clock;
    if (prev !== shown) {
      this._last.clock = shown;
      this.el.clockValue.textContent = shown;
    }
    this.el.clock.classList.toggle('has-unit', !!c.unit);
    if (c.unit && this.el.clockUnit.textContent !== c.unit) this.el.clockUnit.textContent = c.unit;
    this.el.clockFill.style.transform = `scaleX(${c.fraction.toFixed(4)})`;
    this.el.clock.classList.toggle('is-low', !!c.low);
  }

  /**
   * How long the run has lasted, counting up.
   *
   * WRITES ONLY ON A WHOLE SECOND. It is called every frame like every other
   * setter here, and a readout that reformats and re-lays-out sixty times a
   * second beside a WebGL canvas is exactly the cost this file exists to avoid.
   *
   * Rolls to h:mm:ss past an hour rather than letting the minutes run to 137 —
   * the descent is endless, so an hour is reachable, and "1:03:20" is a length a
   * person can hold in their head where "63:20" is not.
   */
  setRunTime(seconds) {
    const whole = Math.floor(Math.max(0, seconds));
    if (this._last.elapsed === whole) return;
    this._last.elapsed = whole;
    const ss = String(whole % 60).padStart(2, '0');
    const m = Math.floor(whole / 60);
    this.el.elapsed.textContent = m < 60
      ? `${m}:${ss}`
      : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${ss}`;
  }

  /**
   * Flash the clock for seconds just gained or lost.
   *
   * Separate from `setClock` because it is an EVENT and that is a state: the
   * clock is redrawn every frame and a flash driven from the redraw would
   * retrigger on every one of them. The class is taken back off on a timer so
   * the animation can be replayed by a second gain half a second later — which
   * happens constantly, because motes arrive in lines.
   */
  clockFlash(delta) {
    if (!this.el.clock || Math.abs(delta) < 0.05 || !this._live) return;
    const cls = delta > 0 ? 'gained' : 'lost';
    this.el.clock.classList.remove('gained', 'lost');
    void this.el.clock.offsetWidth;
    this.el.clock.classList.add(cls);
    clearTimeout(this._clockFlashTimer);
    this._clockFlashTimer = setTimeout(
      () => this.el.clock.classList.remove('gained', 'lost'), 360);
  }

  /**
   * The edge meter. Which way the board is on edge, how hard, and — as the bar
   * brightens — how long the arc has been held. It is the only place the player
   * can see the difference between riding an edge and merely steering.
   */
  setEdge(edge, hold) {
    const pct = Math.min(1, Math.abs(edge)) * 100;
    const left = edge < 0 ? pct : 0;
    const right = edge > 0 ? pct : 0;
    if (Math.abs((this._last.edgeL ?? -1) - left) > 0.8) {
      this._last.edgeL = left;
      this.el.edgeL.style.width = `${left}%`;
    }
    if (Math.abs((this._last.edgeR ?? -1) - right) > 0.8) {
      this._last.edgeR = right;
      this.el.edgeR.style.width = `${right}%`;
    }
    const glow = Math.min(1, hold / 1.6);
    const q = Math.round(glow * 10) / 10;
    if (this._last.edgeGlow !== q) {
      this._last.edgeGlow = q;
      this.el.edgeMeter.style.setProperty('--glow', String(q));
    }
  }

  setProgress(p) {
    const pct = Math.max(0, Math.min(1, p)) * 100;
    if (Math.abs((this._last.progress ?? -1) - pct) < 0.12) return;
    this._last.progress = pct;
    this.el.progressFill.style.width = `${pct}%`;
    this.el.progressHead.style.left = `${pct}%`;
  }

  setSpeed(kmh) {
    const v = Math.round(kmh);
    if (this._last.speed === v) return;
    this._last.speed = v;
    this.el.speedText.innerHTML = `${v} <em>km/h</em>`;

    // Quantised to eighths: the colour is a state the rider is in, not a
    // read-out, and rewriting a custom property every km/h would restyle the
    // element several times a second for no visible gain.
    const q = Math.round(clamp01((v - 52) / 34) * 8) / 8;
    if (this._last.fast !== q) {
      this._last.fast = q;
      this.el.speedText.style.setProperty('--fast', String(q));
    }

    // Every ten km/h past sixty, once each per run. Speed climbs and falls all
    // the way down the mountain; only the first time it reaches a number is
    // news, and marking every crossing would make it wallpaper.
    const tier = Math.floor(v / 10);
    if (!this._live || v < 60 || tier <= this._speedTier) return;
    this._speedTier = tier;
    this._play('speed', this.el.speedText, [
      { transform: 'scale(1)', offset: 0, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
      { transform: 'scale(1.24)', offset: 0.16, easing: 'cubic-bezier(0.4, 0, 0.3, 1)' },
      { transform: 'scale(0.985)', offset: 0.55, easing: 'ease-out' },
      { transform: 'scale(1)', offset: 1 },
    ], { duration: 520 });
  }

  setMood(name) {
    if (this._last.mood === name) return;
    const had = this._last.mood != null;
    this._last.mood = name;
    this.el.moodName.textContent = name;
    // The light has moved on. Slow on purpose — this is the one thing on the
    // HUD that is allowed to take its time, because it is describing an hour.
    if (had && this._live) {
      this._play('mood', this.el.moodName, [
        { opacity: 0.1, transform: 'translateY(5px)', offset: 0, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
        { opacity: 1, transform: 'none', offset: 1 },
      ], { duration: 700 });
    }
  }

  /**
   * `slam` makes the callout drop in from above and settle rather than rise —
   * the treatment a landing gets. land() sets it for whatever callout the same
   * event produces, in either order, so the caller does not have to.
   */
  callout(text, { big = false, huge = false, color = null, slam = false } = {}) {
    const now = performance.now();
    const el = document.createElement('div');
    el.className = `callout${huge ? ' huge' : big ? ' big' : ''}${slam || now < this._slamUntil ? ' slam' : ''}`;
    el.textContent = text;
    el._bornAt = now;
    if (color) el.style.color = color;
    el.addEventListener('animationend', () => el.remove());
    this.el.callouts.appendChild(el);
    while (this.el.callouts.childElementCount > 4) {
      this.el.callouts.firstElementChild.remove();
    }
  }

  /** The landing's own callout, whichever side of land() it was written on. */
  _slamNextCallout() {
    const last = this.el.callouts.lastElementChild;
    if (last && performance.now() - (last._bornAt ?? -1e9) < 80) last.classList.add('slam');
    this._slamUntil = performance.now() + 220;
  }

  countdown(label) {
    this.el.countNum.textContent = label;
    this.el.countNum.classList.remove('tick');
    void this.el.countNum.offsetWidth;
    this.el.countNum.classList.add('tick');
  }

  setSensorState(connected) {
    if (this._last.sensor === connected) return;
    this._last.sensor = connected;
    // `.chip[data-state]` is the shared layer's link indicator — the same
    // element, the same two words and the same colours in all five games, so a
    // player learns "is my board on?" once. The old `.sensor-row` with its own
    // dot was carve's private answer to a question four other games also
    // answered, four different ways.
    // BAL-589 took the chip off the screen. The state is still TRACKED -- the
    // input layer and the dev readout both ask whether a board is talking --
    // so this keeps its bookkeeping and simply has nothing to paint. Same
    // shape as `setBest` below, and for the same reason: deleting the call
    // sites would delete the record along with the readout.
    if (!this.el.sensorText) return;
    this.el.sensorText.dataset.state = connected ? 'live' : 'off';
    this.el.sensorText.textContent = connected
      ? 'BoBo connected'
      : 'using touch & keys';
  }

  /**
   * The lobby no longer shows a best, so this is a no-op kept deliberately.
   *
   * `main.js` calls it on boot and after every run, and the best is still
   * TRACKED and still persisted -- it is what `isBest` on the results panel is
   * measured against. Only the lobby's display of it is gone, so removing the
   * call sites would delete the record along with the readout.
   */
  setBest(score, rank) {
    if (!this.el.bestScore) return;
    this.el.bestScore.textContent = Math.round(score).toLocaleString('en-US');
    if (!this.el.bestRank) return;
    this.el.bestRank.hidden = !rank;
    if (rank) this.el.bestRank.textContent = rank;
  }

  setLoadText(t) { this.el.loadText.textContent = t; }

  /** BAL-589: no stamp on the screen any more. The id still reaches the dev
   *  panel's diagnostics line, which is where a tester looks for it. */
  setBuild(id) {
    if (!this.el.buildStamp) return;
    this.el.buildStamp.textContent = `build ${id}`;
  }

  /** Tap the build stamp to toggle the diagnostics overlay. */
  setDiag(text) {
    this.el.diag.hidden = text == null;
    // Into the TEXT node, not the container: the container holds the capture
    // button, and `textContent` on it would delete that button on frame one.
    if (text != null) this.el.diagText.textContent = text;
  }


  /**
   * @param {string} [headline] replaces the big number when a mode is not
   *   scored. A race is decided by a clock and a placing, and showing it a
   *   SCORE of 3,854 under a rank of D was three wrong answers at once -- the
   *   letter grades the endless descent, the score is the distance one, and
   *   neither means anything when the question was who got there first.
   */
  showResults({ title, score, rank, headline, gates, carves, air, top, isBest, run,
                summary = null, statsRow = true, showRank = true }) {
    this.el.overTitle.textContent = title;
    // Chill dropped its grade on request -- "remove the letter D/S/B" -- so the
    // rank slot is a mode choice now, not a fixture.
    this.el.rank.hidden = !showRank;
    this.el.finalScore.textContent = headline
      ?? Math.round(score).toLocaleString('en-US');
    this.el.rank.textContent = rank;
    this.el.newBest.hidden = !isBest;
    // A mode may hide the generic grid outright -- chill does: a row of
    // near-zero carve/air/speed counters under a grade is noise in a layout.
    const grid = this.el.statGates?.parentElement?.parentElement;
    if (grid) grid.hidden = !statsRow;
    this.el.statGates.textContent = gates;
    this.el.statCarves.textContent = carves;
    this.el.statAir.textContent = `${air.toFixed(1)}s`;
    this.el.statTop.textContent = Math.round(top);
    // Spelled out rather than shown as two more counters: on the results screen
    // the question is "how far did I get", and a sentence answers that faster
    // than a pair of figures the reader has to relate to each other.
    //
    // DISTANCE LEADS, because it is the number an endless descent is actually
    // scored on and the one a leaderboard will be built from. Seconds earned is
    // beside it because it is the only place a player can see what the clock
    // ATE at the cap — the HUD can never show that while it is happening.
    if (this.el.resultsMission) {
      // EARNED ONLY IF ANY WAS. The race has no clock to feed, so it reported
      // "0s earned" -- a true statement about a currency that does not exist in
      // that mode, which reads as something having gone wrong.
      // A mode-supplied summary wins over the assembled one.
      if (summary != null) { this.el.resultsMission.textContent = summary; return; }
      const km = run ? `${(run.distance / 1000).toFixed(2)} km ridden` : '';
      const sec = Math.round(run?.earned ?? 0);
      this.el.resultsMission.textContent = !run ? ''
        : (sec > 0 ? `${km} — ${sec}s earned` : km);
      this.el.resultsMission.classList.remove('is-complete');
    }
    this.el.rank.style.animation = 'none';
    void this.el.rank.offsetWidth;
    this.el.rank.style.animation = '';
  }

  fatal(message) {
    // `.is-on`, not `hidden = false`: `bobo-ui` shows the fatal panel with a
    // class so the rule is visible in the stylesheet next to everything else
    // that shows and hides. The `hidden` property was invisible to CSS review
    // and depended on this game's own `[hidden] { display: none !important }`
    // override still existing.
    this.el.fatal.classList.add('is-on');
    this.el.fatal.textContent = message;
  }
}
