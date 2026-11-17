// The story layer: full-screen talking scenes between levels, and the brothers' one-line
// popups during a level. Pure DOM over the running game; the art is public/story/*.webp
// (tools/make-story-art.py), full body for scenes and a round head crop for popups.
const $ = (id) => document.getElementById(id);

export const CAST = {
  mikey: { name: 'MIKEY', img: 'mikey', col: '#ff9a1e' },
  raph_q: { name: 'RAPH', img: 'raph_q', col: '#ff3b2e' },
  raph: { name: 'RAPH', img: 'raph_good', col: '#ff3b2e' },
  donnie: { name: 'DONNIE', img: 'donnie', col: '#b06cff' },
  leo: { name: 'LEO', img: 'leo', col: '#3b8bff' },
};

// preload, so a line never shows an empty frame on a slow WebView
export function preloadStory() {
  return Promise.all(Object.values(CAST).flatMap((c) => [`/story/${c.img}.webp`, `/story/${c.img}_head.webp`]).map((src) => new Promise((ok) => {
    const im = new Image(); im.onload = im.onerror = ok; im.src = src;
  })));
}

// A talking scene. lines: [{ who, text }]. Speakers alternate sides in the order they first
// talk; the one speaking is lit and forward, the others dim back. Tap (or SKIP) advances; each
// line also moves on by itself. Ends on the level card (title + objective) and resolves.
export function playScene({ lines, title, objective, level = '', start = 'GO!' }) {
  const root = $('story');
  const stage = $('story-cast'), bubble = $('story-bubble'), card = $('story-card');
  stage.replaceChildren();
  root.classList.remove('hidden', 'carding');
  card.classList.add('hidden');
  const sides = {}, figs = {};
  let n = 0;
  for (const l of lines) {
    if (sides[l.who] !== undefined) continue;
    const c = CAST[l.who];
    sides[l.who] = n % 2 === 0 ? 'left' : 'right';
    const im = document.createElement('img');
    im.src = `/story/${c.img}.webp`; im.alt = c.name;
    im.className = `fig ${sides[l.who]} slot${Math.floor(n / 2)}`;
    stage.appendChild(im); figs[l.who] = im;
    n++;
  }
  return new Promise((done) => {
    let i = -1, timer = 0;
    const next = () => {
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
        bubble.querySelector('span').textContent = l.text;
        void bubble.offsetWidth; bubble.classList.add('pop');
        timer = setTimeout(next, 1600 + l.text.length * 45);
      } else if (i === lines.length) {
        // the level card
        root.classList.add('carding');
        bubble.className = 'bubble hidden';
        card.classList.remove('hidden');
        $('story-level').textContent = level;
        $('story-title').textContent = title;
        $('story-goal').textContent = objective;
        $('story-go').textContent = start;
        timer = setTimeout(next, 3800);
      } else {
        root.removeEventListener('pointerdown', next);
        $('story-skip').removeEventListener('pointerdown', skip);
        root.classList.add('hidden');
        done();
      }
    };
    const skip = (e) => { e.stopPropagation(); i = Math.max(i, lines.length - 1); next(); };
    root.addEventListener('pointerdown', next);
    $('story-skip').addEventListener('pointerdown', skip);
    next();
  });
}

// In-level popup: a round head and a speech bubble, top-left. Queued, so lines never overlap.
const queue = [];
let busy = false;
export function say(who, text, dur = 3.4) {
  queue.push({ who, text, dur });
  if (!busy) pump();
}
export function clearSay() { queue.length = 0; const el = $('say'); el.className = 'hidden'; busy = false; clearTimeout(pumpT); }
let pumpT = 0;
function pump() {
  const el = $('say');
  const q = queue.shift();
  if (!q) { busy = false; el.classList.remove('on'); return; }
  busy = true;
  const c = CAST[q.who];
  el.style.setProperty('--col', c.col);
  el.innerHTML = `<img src="/story/${c.img}_head.webp" alt=""><div><b>${c.name}</b><span></span></div>`;
  el.querySelector('span').textContent = q.text;
  el.className = '';
  void el.offsetWidth; el.className = 'on';
  pumpT = setTimeout(() => { el.className = 'off'; pumpT = setTimeout(pump, 260); }, q.dur * 1000);
}
