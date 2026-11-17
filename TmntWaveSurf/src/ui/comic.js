// Story comics between missions -- a minimal take on WagonRampage's src/story.js.
// Two figures (Mikey left, the villain right) over the dimmed, still-rolling wave, a halftone
// panel frame, and one speech bubble whose line is lettered in. The speaker pops forward on a
// burst of their colour; the other dims back. Tap advances (a first tap on a line still being
// lettered just finishes it); every line also moves on by itself, so a player on the board never
// has to touch the screen. SKIP (or a 1 s lean, via skip()) jumps to the end.
import happyUrl from '../assets/mikey_happy.webp';
import bossUrl from '../assets/boss.webp';
import yachtUrl from '../assets/yacht_boss.webp';

const CAST = {
  mikey: { name: 'MIKEY', img: happyUrl, col: '#ff8a1e', side: 'left' },
  yacht: { name: 'OOZE BOSS', img: yachtUrl, col: '#00ff1e', side: 'right', wide: true },
  boss: { name: 'OOZE BOSS', img: bossUrl, col: '#00ff1e', side: 'right' },
};

export function preloadComic() {
  for (const c of Object.values(CAST)) { const im = new Image(); im.src = c.img; }
}

export function createComic(doc) {
  const $ = (id) => doc.getElementById(id);
  const root = $('comic'), bubble = $('comic-bubble');
  const figs = { left: root.querySelector('.fig.left'), right: root.querySelector('.fig.right') };
  let lines = [], i = -1, timer = 0, typeT = 0, typing = false, full = '', done = null;

  function letter(span, text) {   // a few letters per tick, like it is being lettered in
    clearInterval(typeT); typing = true; full = text; let n = 0;
    span.textContent = '';
    typeT = setInterval(() => { n += 2; span.textContent = text.slice(0, n); if (n >= text.length) { clearInterval(typeT); typing = false; } }, 36);
  }
  function show() {
    const l = lines[i], c = CAST[l.who];
    for (const side of ['left', 'right']) {
      const f = figs[side], who = lines.slice(0, i + 1).filter((x) => CAST[x.who].side === side).pop();
      f.classList.toggle('in', !!who);
      f.classList.toggle('talk', side === c.side);
      if (who) { const cc = CAST[who.who]; f.style.setProperty('--col', cc.col); f.classList.toggle('wide', !!cc.wide);
        const im = f.querySelector('img'); if (im.getAttribute('src') !== cc.img) im.src = cc.img; }
    }
    bubble.className = 'bubble ' + c.side; bubble.style.setProperty('--col', c.col);
    bubble.querySelector('b').textContent = c.name;
    void bubble.offsetWidth; bubble.classList.add('pop');
    letter(bubble.querySelector('span'), l.text);
    clearTimeout(timer); timer = setTimeout(next, 1900 + l.text.length * 45);
  }
  function next() {
    if (!done) return;
    if (typing) { clearInterval(typeT); typing = false; bubble.querySelector('span').textContent = full; return; }
    i++;
    if (i < lines.length) show(); else finish();
  }
  function finish() {
    clearTimeout(timer); clearInterval(typeT); typing = false;
    root.classList.add('hidden');
    const d = done; done = null; if (d) d();
  }
  root.addEventListener('pointerdown', (e) => { e.stopPropagation(); next(); });
  $('comic-skip').addEventListener('pointerdown', (e) => { e.stopPropagation(); finish(); });

  return {
    /** Play lines [{who, text}], then call onDone. An empty list calls onDone straight away. */
    play(ls, onDone) {
      if (!ls || !ls.length) { onDone(); return; }
      lines = ls; i = -1; done = onDone;
      figs.left.className = 'fig left'; figs.right.className = 'fig right';
      root.classList.remove('hidden');
      next();
    },
    isOn: () => !!done,
    skip: finish,
    /** Close without calling onDone (a restart / quit took over). */
    stop() { done = null; clearTimeout(timer); clearInterval(typeT); typing = false; root.classList.add('hidden'); },
  };
}
