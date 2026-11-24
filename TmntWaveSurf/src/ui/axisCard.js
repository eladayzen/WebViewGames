// The board card shown every time the game starts: which way of leaning drives the rider.
//
// Two tiles, icons only. Each shows the board rocking on its axis (left/right, or
// forward/back) with Mikey rising as it tips toward the green "up" edge -- the animation
// is the explanation. Pick by:
//   - leaning on the board along a tile's axis for 1 s (the lean itself is the choice),
//   - tapping a tile, or arrow keys (Left/Right = left/right, Up/Down = forward/back),
//   - the round GO (or the clock running out) keeps the current choice.
// The same choice lives in the settings panel.
import { rawLean, thresholds, getAxis, setAxis } from '../input/input.js';

const PICK_S = 1.0, AUTO_S = 10;

export function createAxisCard(doc, heroUrl) {
  const el = doc.getElementById('axis-overlay');
  const tiles = [...el.querySelectorAll('.axis-opt')];
  const go = doc.getElementById('axis-go');
  el.querySelectorAll('.ad-mikey').forEach((im) => { im.src = heroUrl; });
  let on = false, done = null, t = 0, hold = { lr: 0, fb: 0 }, keys = { lr: false, fb: false };

  const paint = () => tiles.forEach((b) => b.classList.toggle('on', b.dataset.axis === getAxis()));
  function finish(axis) {
    if (!on) return;
    if (axis) setAxis(axis);
    on = false; paint(); el.classList.add('hidden');
    const cb = done; done = null; if (cb) cb();
  }
  tiles.forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); finish(b.dataset.axis); }));
  go.addEventListener('click', (e) => { e.stopPropagation(); finish(null); });
  el.addEventListener('pointerdown', (e) => e.stopPropagation());   // not a surf hold
  const KEY = { ArrowLeft: 'lr', ArrowRight: 'lr', KeyA: 'lr', KeyD: 'lr', ArrowUp: 'fb', ArrowDown: 'fb', KeyW: 'fb', KeyS: 'fb' };
  addEventListener('keydown', (e) => {
    if (!on) return;
    if (KEY[e.code]) keys[KEY[e.code]] = true;
    if (e.code === 'Enter' && !e.repeat) finish(null);
  });
  addEventListener('keyup', (e) => { if (KEY[e.code]) keys[KEY[e.code]] = false; });

  return {
    isOn: () => on,
    show(cb) { on = true; done = cb; t = AUTO_S; hold = { lr: 0, fb: 0 }; keys = { lr: false, fb: false }; paint(); el.classList.remove('hidden'); },
    /** Per frame while shown. */
    tick(dt) {
      if (!on) return;
      const r = rawLean(), p = thresholds().press;
      for (const ax of ['lr', 'fb']) {
        const leaning = keys[ax] || (r && Math.abs(r[ax]) > p && Math.abs(r[ax]) >= Math.abs(r[ax === 'lr' ? 'fb' : 'lr']));
        hold[ax] = leaning ? hold[ax] + dt : 0;
        el.querySelector(`.axis-opt[data-axis="${ax}"]`).style.setProperty('--hold', Math.min(1, hold[ax] / PICK_S).toFixed(3));
        if (hold[ax] >= PICK_S) { finish(ax); return; }
      }
      t -= dt;
      go.parentNode.style.setProperty('--t', Math.max(0, t / AUTO_S).toFixed(3));
      if (t <= 0) finish(null);
    },
  };
}
