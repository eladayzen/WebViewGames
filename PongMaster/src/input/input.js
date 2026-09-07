/* Board and keyboard input, funnelled through one function per player.
 *
 * brief-for-webgames.md's one durable piece of input advice was to route
 * everything through a single abstraction rather than scattering listeners,
 * and it held up across two complete control rewrites on an earlier game. It
 * is doing real work here: orientation, mapping, sign and recentring are four
 * independent switches that all land in this file and nowhere else.
 *
 * The host publishes tilt as a plain global rewritten at ~60Hz -- it is polled,
 * never an event. `GoBalance.getPlayers()` is the multiplayer form of the same
 * read and is index-aligned with the roster, with index 0 ALWAYS this device's
 * own board. That is what lets one and two player share this code path
 * completely: one player reads players[0] and never branches.
 */

import { PROFILES, ABSOLUTE, RECENTER } from '../data/tuning.js';
import { tiltComponent, KEYS } from '../data/orientation.js';
import { clamp } from '../sim/world.js';

export function createInput() {
  const held = new Set();
  const channels = [makeChannel(), makeChannel()];

  window.addEventListener('keydown', (e) => {
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
  });
  // A WebView that loses focus mid-lean would otherwise keep the key "held"
  // forever, which reads as a paddle stuck against a wall.
  window.addEventListener('blur', () => held.clear());

  function makeChannel() {
    return { neutral: 0, stillRef: 0, stillFor: 0, raw: 0, value: 0, source: 'none' };
  }

  /* Whatever the host is currently publishing for this player, or null.
   *
   * Feature-detected rather than assumed: GOBALANCE_APP_INTEGRATION.md is
   * explicit that `window.GoBalance` simply does not exist at a plain dev URL,
   * and that developing against its absence is the point rather than a
   * courtesy. Falling through to `__gbSensor` keeps the older single-board
   * global working, which the app team have said is not going away.
   */
  function readTilt(index) {
    const gb = typeof window !== 'undefined' ? window.GoBalance : null;
    if (gb && typeof gb.getPlayers === 'function') {
      const players = gb.getPlayers();
      if (players && players[index]) return { tilt: players[index], source: 'board' };
    }
    if (index === 0 && window.__gbSensor) return { tilt: window.__gbSensor, source: 'sensor' };
    return { tilt: null, source: 'none' };
  }

  function readKeys(orientation, index) {
    const map = KEYS[orientation][index === 0 ? 'p1' : 'p2'];
    let v = 0;
    for (const k of map.neg) if (held.has(k)) v -= 1;
    for (const k of map.pos) if (held.has(k)) v += 1;
    return clamp(v, -1, 1);
  }

  /* One player's paddle, one frame. */
  function drivePaddle(w, index, dt, cfg) {
    const pad = w.paddles[index];
    const p = PROFILES[w.orientation];
    const ch = channels[index];

    const kb = readKeys(w.orientation, index);
    const { tilt, source } = readTilt(index);
    ch.source = kb !== 0 ? 'keys' : source;

    if (kb !== 0) {
      // A keyboard has no analog position, so it always drives as a rate
      // regardless of the mapping under test. This path exists to keep the
      // game playable at a dev URL, not to be one of the things being compared.
      pad.across += kb * p.rateSpeed * dt;
      ch.raw = 0;
      ch.value = kb;
    } else if (!tilt) {
      // No board is publishing -- a plain browser. Leave the paddle where the
      // keyboard left it.
      //
      // Without this the absolute mapping would keep pulling it to the centre,
      // because "no tilt" and "standing level" are the same zero. On a board
      // that is exactly right; in a browser it makes the paddle spring back
      // the instant a key is released, which is unplayable. The game has to be
      // genuinely playable with no GoBalance present -- that is what proves
      // the feature detection is real rather than decorative.
      ch.raw = 0;
      ch.value = 0;
    } else {
      const raw = tiltComponent(w.orientation, tilt);
      ch.raw = raw;
      updateNeutral(ch, raw, dt, cfg);

      const centred = raw - ch.neutral;
      const signed = applyDeadzone(centred, p.deadzone) * cfg.sign;
      ch.value = signed;

      // The player's sensitivity setting. In analog mode the host's own
      // sensitivity call does nothing (it only tunes arrow-key thresholds), so
      // this multiplier IS the setting -- see ui/settingsPanel.js.
      const sens = cfg.sensitivityScale || 1;

      if (cfg.mapping === ABSOLUTE) {
        const target = w.A / 2 + signed * p.absGain * sens * (w.A / 2);
        // Exponential approach rather than a hard set: the published tilt is
        // noisy enough at rest that assigning it straight to a position makes
        // the paddle buzz. Frame-rate independent, so the feel does not change
        // between the editor and a device.
        const k = 1 - Math.exp(-p.smoothing * dt);
        pad.across += (target - pad.across) * k;
      } else {
        pad.across += signed * p.rateSpeed * sens * dt;
      }
    }

    pad.across = clamp(pad.across, pad.half, w.A - pad.half);
  }

  /* Auto-recentre.
   *
   * The direct answer to the fore/aft problem: a rider's neutral point drifts
   * as they settle, and under an absolute mapping that leaves the paddle
   * parked off centre with no way back short of holding a counter-lean. When
   * the tilt has sat inside a narrow band long enough to be a stance rather
   * than an input, adopt it as the new zero.
   *
   * Capped distance from true zero, or a player who leans and HOLDS through
   * the whole window -- which is what chasing a ball to one wall looks like --
   * would teach the game that the wall is the middle.
   */
  function updateNeutral(ch, raw, dt, cfg) {
    if (!cfg.recenter) {
      ch.stillFor = 0;
      return;
    }
    if (Math.abs(raw - ch.stillRef) <= RECENTER.stillnessBand) {
      ch.stillFor += dt;
      if (ch.stillFor >= RECENTER.stillnessSec) {
        ch.neutral = clamp(ch.stillRef, -RECENTER.maxOffset, RECENTER.maxOffset);
        ch.stillFor = 0;
      }
    } else {
      ch.stillRef = raw;
      ch.stillFor = 0;
    }
  }

  function applyDeadzone(v, dz) {
    const m = Math.abs(v);
    if (m <= dz) return 0;
    // Rescale so the first movement past the deadzone starts from zero rather
    // than jumping to the deadzone's width.
    return Math.sign(v) * ((m - dz) / (1 - dz));
  }

  return {
    /* Drive whichever paddles are human-controlled this frame, then publish
     * paddle velocity for the spin the bounce reads. Velocity is derived here
     * rather than in physics because it has to include AI motion too, and this
     * is the one place that runs after every paddle has finished moving. */
    update(w, dt, cfg) {
      drivePaddle(w, 0, dt, cfg);
      if (w.twoPlayer) drivePaddle(w, 1, dt, cfg);
    },

    /* Publish paddle velocity for the spin the bounce reads.
     *
     * `prevAcross` is NOT reset here: it holds this frame's STARTING position
     * and the collision test needs it to credit the whole path a paddle swept
     * through. It is re-armed at the top of the next frame instead. */
    settle(w, dt) {
      for (const pad of w.paddles) {
        pad.vAcross = dt > 0 ? (pad.across - pad.prevAcross) / dt : 0;
      }
    },

    /* Manual recentre -- "wherever I am standing now is the middle". Bound to
     * a dev-panel button and to the start of every point. */
    recentre() {
      for (const ch of channels) {
        ch.neutral = clamp(ch.raw, -RECENTER.maxOffset, RECENTER.maxOffset);
        ch.stillRef = ch.raw;
        ch.stillFor = 0;
      }
    },

    channels,
  };
}
