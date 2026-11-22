// THE IRIS: a black screen with a round hole in it, centred on the turtle.
//
// All of the timing is in core/transition.js; this only paints one frame of it.
// It does nothing at all while the screen is fully open -- the common case, and
// a full-screen element with a gradient on it is not something to keep alive
// for the whole of a fight.
import { irisRadiusPx } from '../core/transition.js';

export function createIris() {
  const el = document.getElementById('iris');
  let shown = false;

  /** `open` 0..1, and the turtle's position on screen in CSS pixels. */
  function set(open, cx, cy) {
    if (!el) return;
    if (open >= 1) {
      if (shown) { el.style.display = 'none'; shown = false; }
      return;
    }
    if (!shown) { el.style.display = 'block'; shown = true; }
    const r = irisRadiusPx(open, cx, cy, window.innerWidth, window.innerHeight);
    // A hard edge with a hair of softening: a cartoon iris is a clean circle,
    // but a perfectly aliased one shimmers as it moves.
    el.style.background = r <= 0.5
      ? '#000'
      : `radial-gradient(circle at ${cx.toFixed(1)}px ${cy.toFixed(1)}px, transparent ${r.toFixed(1)}px, #000 ${(r + 1.5).toFixed(1)}px)`;
  }

  return { set };
}
