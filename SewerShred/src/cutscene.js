// Comic cut-scenes (Elad 2026-11-24): "a comix cut scene with Donnie (current asset blown
// up) explaining the bag and new gadgets … and one at the start of the game, after the lobby
// and before the first game — maybe a diagonal split screen of Mikey and Donnie, Donnie on
// the radio telling Mikey to get back."
//
// Built like Wagon Rampage's story pages: a diagonal split — Mikey's panel in the sewer,
// Donnie's in the dojo — each a real comic panel (white gutter + ink frame, halftone dots,
// slow push-in), the turtles as ink-outlined cut-outs slamming in, the one who's talking
// lit on a starburst in his colour, the other dimmed, and a bubble with his name tag.
// One line per beat; tap / Space / a forward lean moves on, or it moves on by itself.
const $ = (id) => document.getElementById(id);

export const SCENES = {
  // before GET HOME (Elad 2026-11-24: two beats, minimum text)
  intro: [
    { who: 'donnie', text: 'Mikey! The Foot are coming — get home!', radio: true },
    { who: 'mikey', text: 'On my way! Cowabunga!' },
  ],
  // before NIGHT CITY: Donnie just holds out the backpack — no ability explained (Elad 2026-11-24)
  gear: [
    { who: 'donnie', text: 'Mikey — gear up!', pose: 'bag' },
    { who: 'mikey', text: 'Booyakasha!', pose: 'bag' },
  ],
};
const NAME = { mikey: 'MIKEY', donnie: 'DONNIE' };
const BEAT_S = 4.2;   // a line moves on by itself after this long

let done = null, beats = [], k = 0, t0 = 0, raf = 0;

function paint() {
  const b = beats[k], el = $('cutscene');
  el.dataset.who = b.who;
  el.classList.toggle('radio', !!b.radio);
  const bub = $('cs-bubble');
  bub.className = 'cs-bubble ' + b.who;
  bub.querySelector('b').textContent = NAME[b.who];
  bub.querySelector('p').textContent = b.text;
  $('cs-bag').classList.toggle('hidden', b.pose !== 'bag');
  const it = $('cs-item');
  it.classList.toggle('hidden', !b.item);
  if (b.item) it.src = b.item;
  void bub.offsetWidth; bub.classList.add('in');
  $('cs-dots').innerHTML = beats.map((_, i) => `<i class="${i === k ? 'on' : i < k ? 'was' : ''}"></i>`).join('');
  t0 = performance.now();
}

/** Plays a scene; resolves when its last line is done (or skipped). */
export function playScene(name) {
  beats = SCENES[name] || [];
  if (!beats.length) return Promise.resolve();
  k = 0;
  const el = $('cutscene');
  el.classList.remove('hidden');
  void el.offsetWidth; el.classList.add('on');
  paint();
  const tick = () => {
    if ((performance.now() - t0) / 1000 > BEAT_S) { sceneNext(); if (!done) return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return new Promise((res) => { done = res; });
}
export const sceneUp = () => !!done;
/** Next line (or the end). Ignores a press in the first moment of a line. */
export function sceneNext() {
  if (!done || performance.now() - t0 < 350) return;
  if (k < beats.length - 1) { k++; paint(); return; }
  cancelAnimationFrame(raf);
  const el = $('cutscene');
  el.classList.remove('on'); el.classList.add('hidden');
  const r = done; done = null; r();
}
$('cutscene')?.addEventListener('click', (e) => { e.stopPropagation(); sceneNext(); });
