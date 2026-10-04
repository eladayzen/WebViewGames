// The covering beat's DOM, driven from the simulation clock.
//
// Part of the HUD layer (§7.1): DOM/CSS over the canvas, not drawn into the
// render layer. That matters more here than for the rest of the HUD -- the
// cover has to be able to hide the playfield completely, and a full-frame
// opaque quad inside the Pixi scene would sit inside the letterboxed root and
// therefore inside the same transform the screen shake moves.
//
// Animated per frame from `coverAmount(world)` rather than with CSS
// transitions. Three reasons, all of them things this repo has been bitten by:
//   * the simulation is frozen during the beat, so a CSS transition would run
//     on wall-clock time while everything else runs on the fixed timestep;
//   * inside the Unity WebView, frames are pumped by the SDK's rAF shim -- a
//     CSS transition keeps its own clock and can finish while the game has not
//     advanced a frame;
//   * a mode swap or a death mid-beat has to be able to cancel it instantly,
//     which is one assignment here and a class-juggling problem with CSS.
//
// Cost is three style writes per frame for ~2.35 s, and only while the beat is
// running -- nothing is touched at all once it is over.

import { coverAmount } from '../surface/transition.js';

export function createSectorTransitionUi(root) {
  const el = root.querySelector('#sector-transition');
  const top = root.querySelector('#shutter-top');
  const bottom = root.querySelector('#shutter-bottom');
  const card = root.querySelector('#sector-card');
  const name = root.querySelector('#sector-name');
  const rule = root.querySelector('#sector-rule');

  let shown = false;

  function hide() {
    if (!shown) return;
    shown = false;
    el.classList.add('hidden');
  }

  return {
    /** Called once when a transition starts, with the DESTINATION surface. */
    begin(surface) {
      name.textContent = surface.name;
      card.style.color = surface.accent;
      rule.style.width = '0%';
      card.style.opacity = '0';
      el.classList.remove('hidden');
      shown = true;
    },

    hide,

    update(w) {
      if (!w.transition.active) {
        hide();
        return;
      }
      if (!shown) {
        el.classList.remove('hidden');
        shown = true;
      }
      const k = coverAmount(w);
      // Shutters travel their own height, so k = 1 is exactly closed.
      top.style.transform = `translateY(${k * 100}%)`;
      bottom.style.transform = `translateY(${-k * 100}%)`;
      // The card only exists once the shutters have nearly met -- text that
      // fades up through a moving gap reads as a glitch, not as a title.
      const t = Math.max(0, (k - 0.62) / 0.38);
      card.style.opacity = String(t);
      rule.style.width = `${(t * 26).toFixed(1)}%`;
    },
  };
}
