// The level loop (Elad 2026-11-22): "a story progression thing — a level ends and
// starts … an intro UI of just one step, minimum words … sewers with an objective,
// then outdoors. Two or three levels so we can feel if it's fun."
//
// Shape borrowed from Wagon Rampage: each level has a named objective; before
// its card a NEW power is shown, and that power is the level's first pickup.
// House style is icon-only (no prose): level number, title, goal icon + number,
// a round GO whose ring is the auto-start clock.
//
// Objectives (chosen for kids, see the design note in the commit):
//   pizza — grab N pizza (practice: no hazards, can't really fail)
//   dist  — reach the exit N m down (sewers: always moving toward it, never stuck)
//   air   — grab N pizza in the AIR off the kickers (city: makes the new ramp matter)
const $ = (id) => document.getElementById(id);

// Elad 2026-11-22: the ladder — TRAINING 1 (ride it, no enemies), TRAINING 2 in the
// turtles' wooden dojo course (knock down cardboard dummies, the stars are new),
// then the SEWERS with real Foot Soldiers, then the CITY. Dimension X / mines /
// Technodrome come after, one world at a time.
// Elad 2026-11-23: the story — Donnie calls Mikey home, trains him in the DIY
// dojo, sends him out to fight, then up to the street. `say` is Donnie's one line
// on the card; `pickups` is which powers that level deals (null = all of them).
// Elad 2026-11-24: after the two trainings the goal is POINTS, not metres — distance plus
// everything else you score (pizza, kicks, cuts, combos). Set from a measured blind ride
// (tools/drive.mjs --script=scorerate) a little under what it makes over the old distance.
export const LEVELS = [
  { key: 'home', n: 1, title: 'GET HOME', world: 'sewers', open: false, deck: 'nofoes', scene: 'intro', goal: { type: 'dist', n: 600 }, pickups: [],
    routes: { kinds: ['rise'], every: 220 },   // up only: the pipe climbs
    say: 'Mikey, back to the dojo NOW! Enemies on the way!' },
  { key: 'dojo', n: 2, title: 'TRAINING', world: 'dojo', open: false, deck: 'dojo', goal: { type: 'ko', n: 12 }, pickups: [],
    routes: { kinds: ['y', 'rise', 'drop'], every: 260 },   // a split, a climb, a drop — wood all the way round, all the way (Elad 2026-11-23)
    say: "Let's get you trained. Knock down the dummies!" },
  { key: 'sewers', n: 3, title: 'SEWERS', world: 'sewers', open: false, deck: 'normal', goal: { type: 'pts', n: 7500 }, unlock: 'shield', pickups: ['shield'],
    routes: { kinds: ['rise', 'y', 'drop'], every: 300 },   // every route kind
    say: "You're ready. Go fight them!" },
  { key: 'city', n: 4, title: 'CITY', open: true, deck: 'city', goal: { type: 'pts', n: 15000 }, unlock: 'sai', pickups: ['shield', 'sai'],
    say: 'They ran up to the street! Take these stars!' },
  // Elad 2026-11-23: the city again at twilight, Donnie's gear (backpack: glider +
  // saw arms), and a portal at the end — then inside the portal, then Dimension X
  { key: 'night', n: 5, title: 'NIGHT CITY', open: true, night: true, scene: 'gear', deck: 'city', goal: { type: 'pts', n: 12000 }, unlock: 'glider', gear: true, portal: true,
    pickups: ['shield', 'sai', 'glider'], say: 'New gear in your backpack! Glide right over them!' },
  { key: 'portal', n: 6, title: 'THE PORTAL', world: 'portal', open: false, deck: 'nofoes', speed: 1.45, goal: { type: 'pts', n: 12000 }, gear: true, gearGap: 220,
    pickups: ['glider', 'shield'], routes: { kinds: ['drop', 'rise'], every: 230 }, say: 'Whoa, a portal! Hold on tight, Mikey!' },
  { key: 'dimx', n: 7, title: 'DIMENSION X', world: 'dimx', open: true, theme: 'dimx', deck: 'alien', goal: { type: 'pts', n: 16000 }, gear: true, unlock: 'saws', scene: 'saws',
    pickups: ['shield', 'sai', 'glider', 'saws'], routes: { kinds: ['y', 'rise', 'drop'], every: 300 }, say: 'Dimension X! I upgraded your pack: SAW ARMS!' },
];

// inline SVG icons (no emoji — they render differently per device)
export const ICON = {
  pizza: '<svg viewBox="0 0 24 24"><path d="M3 5.5Q12 1 21 5.5L12 22Z" fill="#ffcf3a" stroke="#14181a" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 5.5Q12 1 21 5.5L20 8Q12 4 4 8Z" fill="#c8742a" stroke="#14181a" stroke-width="1.2" stroke-linejoin="round"/><circle cx="10" cy="10" r="1.6" fill="#c62f1f"/><circle cx="14.5" cy="11.5" r="1.4" fill="#c62f1f"/><circle cx="12" cy="15.5" r="1.3" fill="#c62f1f"/></svg>',
  exit: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="13" rx="10" ry="8" fill="#5d6870" stroke="#14181a" stroke-width="1.6"/><ellipse cx="12" cy="13" rx="6.5" ry="5" fill="none" stroke="#14181a" stroke-width="1.2"/><path d="M6 13h12M12 8v10" stroke="#14181a" stroke-width="1.2"/><path d="M12 1l2.2 3h-1.4v3h-1.6v-3H9.8z" fill="#ffe25a" stroke="#14181a" stroke-width="0.8"/></svg>',
  // a cardboard dummy on its stake, with a hit star
  dummy: '<svg viewBox="0 0 24 24"><path d="M12 21v2" stroke="#7a4a22" stroke-width="2.2"/><path d="M8.5 21c-.6-3 .2-5.4 1-6.2-1.8-.6-3.2-2.2-3.3-4.2l2.4-.2c.3 1 1 1.6 2 1.8.4-.7.3-1.4-.2-2.1C9.2 9.2 8.8 7.2 10 5.6 11.4 3.8 14 4 15 6c.8 1.6.3 3.4-.8 4.3 1-.1 1.8-.8 2.1-1.8l2.4.2c-.1 2-1.5 3.6-3.3 4.2.8.8 1.6 3.2 1 6.1z" fill="#c9965a" stroke="#14181a" stroke-width="1.3" stroke-linejoin="round"/><path d="M10.4 7.6h4.2" stroke="#e23b2e" stroke-width="1.4" stroke-linecap="round"/><path d="M19.5 2.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="#ffe25a" stroke="#14181a" stroke-width="0.6"/></svg>',
  pts: '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.2 6.8.8-5 4.6 1.4 6.7L12 17l-6.1 3.3 1.4-6.7-5-4.6 6.8-.8z" fill="#ffe25a" stroke="#14181a" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  air: '<svg viewBox="0 0 24 24"><path d="M2 21h11l8-7v7z" fill="#c98a45" stroke="#14181a" stroke-width="1.4" stroke-linejoin="round"/><g transform="translate(6 -1) scale(0.55)"><path d="M3 5.5Q12 1 21 5.5L12 22Z" fill="#ffcf3a" stroke="#14181a" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="11" r="2" fill="#c62f1f"/></g><path d="M4 15q2-6 6-9" fill="none" stroke="#fff" stroke-width="1.4" stroke-dasharray="2 2"/></svg>',
};
const GOAL_ICON = { pizza: 'pizza', dist: 'exit', air: 'air', ko: 'dummy', pts: 'pts' };
const UNLOCK_IMG = { shield: '/tex/shield_icon.png', sai: '/tex/sai_icon.png', glider: '/tex/glider_icon.png', saws: '/tex/saws_icon.png' };
/** The hero's weapon badge (MIKEY: nunchucks) stands in for the sai one. */
export function setWeaponIcon(src) { UNLOCK_IMG.sai = src; }

const kfmt = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}K` : `${Math.floor(v)}`);
export function goalLabel(goal) { return goal.type === 'dist' ? `${goal.n} m` : goal.type === 'pts' ? `${kfmt(goal.n)} PTS` : `× ${goal.n}`; }

const SAVE_V = 4;   // bump whenever LEVELS is reordered
// ── progress: GoBalance.save / load (per profile; null on first run) ──
const gb = () => (typeof window !== 'undefined' && window.GoBalance && window.GoBalance.available !== false ? window.GoBalance : null);
export async function loadProgress() {
  const sdk = gb();
  let st = null;
  if (sdk?.load) { try { st = await sdk.load(); } catch { /* offline / none */ } }
  if (!st) { try { st = JSON.parse(localStorage.getItem('sewerShred.progress') || 'null'); } catch { /* private */ } }
  // the ladder was re-cut (Elad 2026-11-23, the wood look test at the front): a save
  // from an older ladder points at the wrong level, so it starts over at level 1
  const ok = st?.v === SAVE_V && Number.isInteger(st?.level);
  const lvl = ok ? st.level : 0;
  maxUnlocked = Math.max(lvl, ok && Number.isInteger(st.max) ? st.max : 0);
  return Math.max(0, Math.min(LEVELS.length - 1, lvl));
}
let maxUnlocked = 0;
export const getMaxUnlocked = () => Math.min(LEVELS.length - 1, maxUnlocked);
export function saveProgress(level) {
  maxUnlocked = Math.max(maxUnlocked, level);
  const st = { level, max: maxUnlocked, v: SAVE_V };
  const sdk = gb();
  if (sdk?.save) { try { sdk.save(st); } catch { /* offline */ } }
  try { localStorage.setItem('sewerShred.progress', JSON.stringify(st)); } catch { /* private */ }
}

// ── the level card: one step ──
// Resolves when GO is pressed (tap, Space/Enter via press(), or the ring runs out).
const AUTO_GO = 6;
let cardDone = null, cardT0 = 0, cardRaf = 0;
export function showCard(L) {
  const el = $('level-card');
  $('lc-num').textContent = L.n === 0 ? '' : `LEVEL ${L.n}`;
  $('lc-title').textContent = L.title;
  const say = $('lc-say');
  if (say) { say.querySelector('p').textContent = L.say || ''; say.classList.toggle('hidden', !L.say); }
  $('lc-goal').innerHTML = `<i>${ICON[GOAL_ICON[L.goal.type]]}</i><b>${goalLabel(L.goal)}</b>`;
  const un = $('lc-new');
  un.innerHTML = L.unlock ? `<img src="${UNLOCK_IMG[L.unlock]}" alt=""><em>NEW!</em>` : '';
  un.classList.toggle('hidden', !L.unlock);
  el.classList.remove('hidden');
  void el.offsetWidth; el.classList.add('pop');
  cardT0 = performance.now();
  const ring = $('lc-ring');
  const tick = () => {
    const p = Math.min(1, (performance.now() - cardT0) / 1000 / AUTO_GO);
    ring.style.strokeDashoffset = String(100 * (1 - p));
    if (p >= 1) { go(); return; }
    cardRaf = requestAnimationFrame(tick);
  };
  tick();
  return new Promise((res) => { cardDone = res; });
}
function go() {
  if (!cardDone) return;
  cancelAnimationFrame(cardRaf);
  const el = $('level-card');
  el.classList.remove('pop'); el.classList.add('hidden');
  const r = cardDone; cardDone = null; r();
}
export const cardUp = () => !!cardDone;
/** Space / Enter / a held lean — ignored for the first half second so the press that got here doesn't skip it. */
export function cardPress() { if (cardDone && performance.now() - cardT0 > 500) go(); }
$('lc-go')?.addEventListener('click', (e) => { e.stopPropagation(); go(); });

// ── level clear (its own id — never #gameover-overlay: the host clicks #restart-button there) ──
const AUTO_NEXT = 3;   // then the lobby (Elad 2026-11-24)
let clearDone = null, clearT0 = 0, clearRaf = 0;
export function showClear(last) {
  const el = $('level-clear');
  $('lclr-title').textContent = last ? 'COWABUNGA!' : 'LEVEL CLEAR!';
  $('lclr-next').classList.toggle('again', last);
  el.classList.remove('hidden');
  void el.offsetWidth; el.classList.add('pop');
  clearT0 = performance.now();
  const ring = $('lclr-ring');
  const tick = () => {
    const p = Math.min(1, (performance.now() - clearT0) / 1000 / AUTO_NEXT);
    ring.style.strokeDashoffset = String(100 * (1 - p));
    if (p >= 1) { next(); return; }
    clearRaf = requestAnimationFrame(tick);
  };
  tick();
  return new Promise((res) => { clearDone = res; });
}
function next() {
  if (!clearDone) return;
  cancelAnimationFrame(clearRaf);
  $('level-clear').classList.remove('pop'); $('level-clear').classList.add('hidden');
  const r = clearDone; clearDone = null; r();
}
export const clearUp = () => !!clearDone;
export function clearPress() { if (clearDone && performance.now() - clearT0 > 800) next(); }
$('lclr-next')?.addEventListener('click', (e) => { e.stopPropagation(); next(); });

// ── in-run goal HUD ──
export function renderGoal(L, have) {
  const el = $('goal');
  if (!L) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const g = L.goal;
  if (el.dataset.lv !== L.key) { el.dataset.lv = L.key; el.innerHTML = `<i>${ICON[GOAL_ICON[g.type]]}</i><span class="bar"><u></u></span><b></b>`; }
  const p = Math.max(0, Math.min(1, have / g.n));
  el.querySelector('u').style.transform = `scaleX(${p})`;
  el.querySelector('b').textContent = g.type === 'dist' ? `${Math.max(0, Math.ceil(g.n - have))} m` : g.type === 'pts' ? `${kfmt(Math.min(have, g.n))}/${kfmt(g.n)}` : `${Math.min(have, g.n)}/${g.n}`;
}

// ── the LOBBY (Elad 2026-11-24): "the first screen you see, and you see it after every
// successful level — levels unlock left to right, you see the next one unlocked and
// Donnie telling you the text. Either click, or lean-hold forward for 2 seconds." ──
const LOCK_SVG = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" fill="#2a2f3a" stroke="#14181a" stroke-width="1.6"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#14181a" stroke-width="2.2"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
let lobbyDone = null, lobbySel = 0, lobbyMax = 0, lobbyOnSelect = null;
// Each stop on the route is a little round window into its world (art the game already has).
const STOP_ART = {
  home: '/tex/concrete_grey.jpg', dojo: '/tex/wood_planks.jpg', sewers: '/tex/concrete_warm.jpg',
  city: '/tex/city_sky.jpg', night: '/tex/city_sky.jpg', portal: '/tex/portal_wall.jpg', dimx: '/tex/dimx_rock.jpg',
};
// the route winds: stop i sits at x (spread across) and y (up / down) in % of the map
const stopXY = (i, n) => [6 + (i * 88) / Math.max(1, n - 1), i % 2 ? 66 : 30];
function paintLobby() {
  const map = $('lb-map');
  const n = LEVELS.length, pts = LEVELS.map((_, i) => stopXY(i, n));
  // the road: dashed all the way, bright as far as you've got
  const line = (k) => pts.slice(0, k + 1).map(([x, y]) => `${x},${y}`).join(' ');
  let html = `<svg class="lb-road" viewBox="0 0 100 100" preserveAspectRatio="none">
    <polyline points="${line(n - 1)}" class="all"/><polyline points="${line(lobbyMax)}" class="done"/></svg>`;
  html += LEVELS.map((L, i) => {
    const st = i > lobbyMax ? 'locked' : i === lobbySel ? 'sel' : i < lobbyMax ? 'done' : 'open';
    const badge = st === 'locked' ? LOCK_SVG : st === 'done' ? CHECK_SVG : `<b>${L.n}</b>`;
    const [x, y] = pts[i];
    return `<button class="lb-node ${st} k-${L.key}" data-i="${i}" ${st === 'locked' ? 'disabled' : ''} style="left:${x}%;top:${y}%">
      <span class="disc" style="background-image:url('${STOP_ART[L.key] || STOP_ART.home}')"></span>
      <span class="badge">${badge}</span><em>${L.title}</em></button>`;
  }).join('');
  // Mikey stands on the stop you're about to play
  const [mx, my] = pts[lobbySel];
  html += `<div class="lb-me" style="left:${mx}%;top:${my}%"><img src="/tex/mikey_head.png" alt=""></div>`;
  map.innerHTML = html;
  const L = LEVELS[lobbySel];
  $('lb-num').textContent = `CHAPTER ${L.n} OF ${n}`;
  $('lb-title').textContent = L.title;
  $('lb-say').querySelector('p').textContent = L.say || '';
  $('lb-say').classList.toggle('hidden', !L.say);
  $('lb-goal').innerHTML = `<i>${ICON[GOAL_ICON[L.goal.type]]}</i><b>${goalLabel(L.goal)}</b>`;
  const un = $('lb-new');
  un.innerHTML = L.unlock ? `<img src="${UNLOCK_IMG[L.unlock]}" alt=""><em>NEW!</em>` : '';
  un.classList.toggle('hidden', !L.unlock);
}
/** Up until GO; resolves the chosen level. `fresh` = the level that was just unlocked (it pops in). */
export function showLobby(sel, max, fresh = -1, onSelect = null) {
  lobbySel = sel; lobbyMax = max; lobbyOnSelect = onSelect;
  const el = $('lobby');
  paintLobby();
  lobbyHold(0);
  if (fresh >= 0) { const n = $('lb-map').querySelector(`[data-i="${fresh}"]`); if (n) n.classList.add('fresh'); }
  el.classList.remove('hidden'); document.body.classList.add('in-lobby');
  void el.offsetWidth; el.classList.add('pop');
  lobbyT0 = performance.now();
  return new Promise((res) => { lobbyDone = res; });
}
let lobbyT0 = 0;
export const lobbyUp = () => !!lobbyDone;
/** The GO ring: 0..1 of the forward-lean hold. */
export function lobbyHold(f) { const r = $('lb-ring'); if (r) r.style.strokeDashoffset = String(100 * (1 - Math.max(0, Math.min(1, f)))); }
export function lobbyGo() {
  if (!lobbyDone || performance.now() - lobbyT0 < 500) return;
  const el = $('lobby');
  el.classList.remove('pop'); el.classList.add('hidden'); document.body.classList.remove('in-lobby');
  const r = lobbyDone; lobbyDone = null; r(lobbySel);
}
$('lb-go')?.addEventListener('click', (e) => { e.stopPropagation(); lobbyGo(); });
$('lb-map')?.addEventListener('click', (e) => {
  const b = e.target.closest('.lb-node'); if (!b || b.disabled) return;
  e.stopPropagation();
  const i = +b.dataset.i; if (i === lobbySel) return;
  lobbySel = i; paintLobby(); lobbyOnSelect?.(i);
});
