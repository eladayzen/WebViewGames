// THE MAP BETWEEN ROOMS (Elad, 25 Nov): while the screen is black after a room, the level map shows the dotted line of doors and the
// turtle walking from the room he cleared to the next one. Same drawing as the OVERRUN map (ui/endscreen.js).
import { doorIcon } from './doors.js';
import { MASK } from './endscreen.js';

export function createTravel() {
  const root = document.getElementById('travel');
  let timers = [];
  const clear = () => { timers.forEach(clearTimeout); timers = []; };

  /** `e` is the run's travelStart event: { level, from, to, rooms }. */
  function show(e) {
    if (!root) return;
    clear();
    const nodes = (state) => Array.from({ length: e.rooms }, (_, i) => {
      const boss = i === e.rooms - 1;
      return `<div class="node${boss ? ' boss' : ''}" data-i="${i}">${doorIcon(state(i, boss))}${boss ? '<span class="crown">&#9813;</span>' : ''}</div>`;
    }).join('');
    // the turtle stands at the door he has just come through; the next door is closed until he gets there
    const before = (i, boss) => (i < e.from ? 'done' : i === e.from ? 'here' : boss ? 'boss' : 'todo');
    const p = (i) => (e.rooms > 1 ? i / (e.rooms - 1) : 0);
    root.innerHTML =
      `<div class="travel-card"><div class="travel-title"><span>LEVEL ${e.level}</span></div>` +
      `<div class="trail">${nodes(before)}<div class="runner" style="--p:${p(e.from)}">${MASK}</div></div>` +
      `<div class="travel-room"><span>ROOM</span><b>${e.to + 1}</b></div></div>`;
    root.classList.remove('hidden');
    const runner = root.querySelector('.runner');
    // a beat at the door, then the walk (1.1 s, in the CSS transition), then the new door opens
    timers.push(setTimeout(() => runner?.style.setProperty('--p', String(p(e.to))), 350));
    timers.push(setTimeout(() => {
      const prev = root.querySelector(`.node[data-i="${e.from}"]`), next = root.querySelector(`.node[data-i="${e.to}"]`);
      if (prev) prev.firstElementChild.outerHTML = doorIcon('done');
      if (next) next.firstElementChild.outerHTML = doorIcon('here');
      next?.classList.add('arrived');
    }, 1500));
  }

  function hide() { clear(); root?.classList.add('hidden'); }
  return { show, hide };
}
