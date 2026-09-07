/* The POC instrument panel.
 *
 * This is the whole reason the orientation and mapping abstractions exist: the
 * question "is fore/aft steering good enough to keep classic Pong's layout?"
 * cannot be answered by reasoning, only by standing on a board and switching
 * between them back to back. A rebuild between each attempt would make that a
 * two-session comparison from memory, which is not a comparison.
 *
 * Every switch here changes behaviour live and mid-run, without resetting the
 * score, so the two options can be compared inside one rally.
 *
 * VISIBLE AND UNGUARDED ON PURPOSE, FOR THE POC ONLY. Before this ships it
 * goes behind the standard hold-then-keypad unlock -- debug controls must not
 * be reachable by a curious child, and must stay reachable on a device with no
 * keyboard. Player-facing settings (sensitivity) are the opposite and belong
 * in their own panel, split by audience rather than by convenience.
 */

import { CLASSIC, LATERAL } from '../data/orientation.js';
import { ABSOLUTE, RATE } from '../data/tuning.js';

export function createDevPanel({ cfg, onOrientation, onRecentreNow, onChange }) {
  const panel = document.getElementById('dev-panel');
  const btn = {
    orientation: document.getElementById('dev-orientation'),
    mapping: document.getElementById('dev-mapping'),
    sign: document.getElementById('dev-sign'),
    recenter: document.getElementById('dev-recenter'),
    assist: document.getElementById('dev-assist'),
    centreNow: document.getElementById('dev-centre-now'),
  };
  const readout = document.getElementById('dev-readout');
  const body = document.getElementById('dev-body');
  const toggle = document.getElementById('dev-toggle');

  toggle.addEventListener('click', () => body.classList.toggle('hidden'));

  function paint() {
    btn.orientation.textContent = cfg.orientation === CLASSIC ? 'CLASSIC' : 'LATERAL';
    btn.mapping.textContent = cfg.mapping === ABSOLUTE ? 'ABSOLUTE' : 'RATE';
    btn.sign.textContent = cfg.sign > 0 ? '+1' : '-1';
    btn.recenter.textContent = cfg.recenter ? 'ON' : 'OFF';
    btn.assist.textContent = cfg.assist ? 'ON' : 'OFF';
  }

  btn.orientation.addEventListener('click', () => {
    const next = cfg.orientation === CLASSIC ? LATERAL : CLASSIC;
    onOrientation(next);
    paint();
  });

  /* Every switch persists, not just orientation.
   *
   * The point of this panel is comparing settings, and a comparison that
   * silently resets on reload is worse than none -- you come back believing
   * you are still on the setting you chose. */
  function change(mutate) {
    mutate();
    paint();
    onChange();
  }

  btn.mapping.addEventListener('click', () =>
    change(() => {
      cfg.mapping = cfg.mapping === ABSOLUTE ? RATE : ABSOLUTE;
    }),
  );

  // Whether a forward lean should move the paddle up is a guess until it is
  // felt. Rather than ship a guess and re-flash the device to test the other
  // one, it is a button.
  btn.sign.addEventListener('click', () =>
    change(() => {
      cfg.sign = -cfg.sign;
    }),
  );

  btn.recenter.addEventListener('click', () =>
    change(() => {
      cfg.recenter = !cfg.recenter;
    }),
  );

  btn.assist.addEventListener('click', () =>
    change(() => {
      cfg.assist = !cfg.assist;
    }),
  );

  btn.centreNow.addEventListener('click', () => onRecentreNow());

  paint();

  return {
    /* Live tilt readout. On a board with no console this is the only way to
     * see what the host is actually publishing -- including whether it is
     * publishing at all, which is the first thing to check when steering does
     * nothing. */
    update(input, w) {
      if (body.classList.contains('hidden')) return;
      const a = input.channels[0];
      const b = input.channels[1];
      const parts = [
        `src ${a.source}`,
        `raw ${fmt(a.raw)}`,
        `mid ${fmt(a.neutral)}`,
        `out ${fmt(a.value)}`,
      ];
      if (w.twoPlayer) parts.push(`| p2 ${fmt(b.raw)} -> ${fmt(b.value)}`);
      readout.textContent = parts.join('  ');
    },

    hide() {
      panel.classList.add('hidden');
    },
  };
}

function fmt(v) {
  const s = (v || 0).toFixed(2);
  return v >= 0 ? `+${s}` : s;
}
