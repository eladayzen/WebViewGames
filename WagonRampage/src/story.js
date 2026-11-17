// The story layer, drawn as a comic: full-screen talking scenes between levels on a static comic
// background (public/story/bg_night / bg_win, Kolbo), and the brothers' one-line popups during
// a level. Pure DOM over the game; the 3D view isn't drawn while a scene covers it (main.js).
// Character art: public/story/*.webp (tools/make-story-art.py) — full body for scenes, a head
// crop for popups.
const $ = (id) => document.getElementById(id);

export const CAST = {
  mikey: { name: 'MIKEY', img: 'mikey', col: '#ff8a1e' },
  raph_q: { name: 'RAPH', img: 'raph_q', col: '#ff3b2e' },
  raph: { name: 'RAPH', img: 'raph_good', col: '#ff3b2e' },
  donnie: { name: 'DONNIE', img: 'donnie', col: '#a45cff' },
  leo: { name: 'LEO', img: 'leo', col: '#2f7fff' },
};

// preload, so a line never shows an empty frame on a slow WebView
export function preloadStory() {
  const srcs = ['/story/bg_night.webp', '/story/bg_win.webp', ...Object.values(CAST).flatMap((c) => [`/story/${c.img}.webp`, `/story/${c.img}_head.webp`])];
  return Promise.all(srcs.map((src) => new Promise((ok) => { const im = new Image(); im.onload = im.onerror = ok; im.src = src; })));
}

// type the line out, a few letters a frame, like it's being lettered in
function typeInto(el, text, cps = 55) {
  el.textContent = '';
  const t0 = performance.now();
  let raf = 0;
  const tick = () => {
    const n = Math.min(text.length, Math.ceil((performance.now() - t0) / 1000 * cps));
    el.textContent = text.slice(0, n);
    if (n < text.length) raf = requestAnimationFrame(tick);
  };
  tick();
  return () => { cancelAnimationFrame(raf); el.textContent = text; };
}

// A talking scene. lines: [{ who, text }]. Speakers alternate sides in the order they first
// talk; the one speaking pops forward on a burst of their colour, the others dim back. Tap (or
// SKIP) advances; each line also moves on by itself. Ends on the title card and resolves.
// bg: 'night' (level intros, fails) or 'win'.
// unlock: [{ img, name }] — powers new on this level, shown on the title card
export function playScene({ lines, title, objective, level = '', start = 'GO!', bg = 'night', unlock = [], unlockFirst = false }) {
  const root = $('story');
  const stage = $('story-cast'), bubble = $('story-bubble'), card = $('story-card');
  stage.replaceChildren();
  root.dataset.bg = bg;
  root.classList.remove('hidden', 'carding');
  card.classList.add('hidden');
  const sides = {}, figs = {};
  let n = 0;
  for (const l of lines) {
    if (sides[l.who] !== undefined) continue;
    const c = CAST[l.who];
    sides[l.who] = n % 2 === 0 ? 'left' : 'right';
    const fig = document.createElement('div');
    fig.className = `fig ${sides[l.who]} slot${Math.floor(n / 2)}`;
    fig.style.setProperty('--col', c.col);
    fig.innerHTML = `<i class="burst"></i><img src="/story/${c.img}.webp" alt="${c.name}">`;
    stage.appendChild(fig); figs[l.who] = fig;
    n++;
  }
  return new Promise((done) => {
    let i = -1, timer = 0, finishType = null;
    const next = () => {
      // first tap on a line still being lettered just finishes the lettering
      if (finishType) { const f = finishType; finishType = null; if (bubble.dataset.typing === '1') { f(); bubble.dataset.typing = '0'; return; } }
      clearTimeout(timer);
      i++;
      if (i < lines.length) {
        const l = lines[i], c = CAST[l.who];
        for (const [who, f] of Object.entries(figs)) {
          f.classList.toggle('in', lines.slice(0, i + 1).some((x) => x.who === who));
          f.classList.toggle('talk', who === l.who);
        }
        bubble.className = `bubble ${sides[l.who]}`;
        bubble.style.setProperty('--col', c.col);
        bubble.innerHTML = `<b>${c.name}</b><span></span>`;
        void bubble.offsetWidth; bubble.classList.add('pop');
        bubble.dataset.typing = '1';
        finishType = typeInto(bubble.querySelector('span'), l.text);
        setTimeout(() => { bubble.dataset.typing = '0'; }, l.text.length / 55 * 1000 + 50);
        timer = setTimeout(next, 1900 + l.text.length * 45);
      } else if (i === lines.length) {
        root.classList.add('carding');
        bubble.className = 'bubble hidden';
        card.classList.remove('hidden');
        $('story-level').textContent = level;
        $('story-title').textContent = title;
        $('story-goal').textContent = objective;
        $('story-go').textContent = start;
        const un = $('story-unlock');
        // every power this level hands out; the newly unlocked one is tagged NEW
        un.innerHTML = unlock.length ? `<b>${unlockFirst ? 'YOUR POWERS' : 'POWERS'}</b>` + unlock.map((u) => `<span class="${u.isNew ? 'new' : ''}"><img src="${u.img}" alt="">${u.name}${u.isNew ? '<em>NEW!</em>' : ''}</span>`).join('') : '';
        void card.offsetWidth; card.classList.add('pop');
        timer = setTimeout(next, 4200);
      } else {
        root.removeEventListener('pointerdown', next);
        $('story-skip').removeEventListener('pointerdown', skip);
        card.classList.remove('pop');
        root.classList.add('hidden');
        done();
      }
    };
    const skip = (e) => { e.stopPropagation(); finishType = null; i = Math.max(i, lines.length - 1); next(); };
    root.addEventListener('pointerdown', next);
    $('story-skip').addEventListener('pointerdown', skip);
    next();
  });
}

// In-level popup: the speaker's head in a tilted comic frame and a speech bubble, top-left.
// Queued, so lines never overlap.
const queue = [];
let busy = false, pumpT = 0;
export function say(who, text, dur = 3.4) {
  queue.push({ who, text, dur });
  if (!busy) pump();
}
export function clearSay() { queue.length = 0; $('say').className = 'hidden'; busy = false; clearTimeout(pumpT); }
function pump() {
  const el = $('say');
  const q = queue.shift();
  if (!q) { busy = false; el.className = 'hidden'; return; }
  busy = true;
  const c = CAST[q.who];
  el.style.setProperty('--col', c.col);
  el.innerHTML = `<figure><img src="/story/${c.img}_head.webp" alt=""></figure><div class="sb"><b>${c.name}</b><span></span></div>`;
  el.className = '';
  void el.offsetWidth; el.className = 'on';
  typeInto(el.querySelector('span'), q.text, 70);
  pumpT = setTimeout(() => { el.className = 'off'; pumpT = setTimeout(pump, 260); }, q.dur * 1000);
}
