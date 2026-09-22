// Dev panel (wrench button, top-right chrome row).
//
// WHAT THIS IS FOR. Every question worth asking about this game sits behind
// several minutes of play: the chain does not exist until level 5, the shield
// until 6, and seeing four toys cooperate means collecting four presents at one
// every fourteen seconds. That is a long wait to look at a thing you changed
// thirty seconds ago, and the URL hooks (?toy=, ?level=, ?art=1) only set the
// world up at BOOT -- they cannot answer "what does this look like now, mid-run,
// with monsters on screen".
//
// The unlock flow (devUnlock.js) and its stylesheet are copied verbatim from
// Nova Vanguard so that anyone who knows the gesture for one game knows it for
// all of them. THE CONTENTS are per-game and this file is Bloop Squad's.
//
// DEV ONLY, AND IT SAYS SO. Every row here either skips content or removes a
// failure condition, so nothing in this file may be reachable by accident during
// a real run: the panel starts closed, opens only after the hold-and-code, and
// the invincibility row paints its own state so a "why am I not dying" question
// cannot survive a glance.
//
// WHO OWNS WHAT. This file renders controls and calls back into main.js. It owns
// no game state: the actions it invokes are the game's own functions, passed in,
// so the panel cannot drift from what the game actually does.
//
// ON DEVICE IT IS UNREACHABLE, and that is not a bug to fix here.
// WebGameController forwards Space, Enter and synthetic steering arrows, and
// never a click -- so no button in this panel can be pressed inside the Unity
// WebView. It is a desktop-development tool and does not pretend otherwise. The
// number keys remain the on-device path.

const WRENCH = '&#128295;'; // 🔧

/**
 * @param {Document} doc
 * @param {object} actions
 *   @param {(id:string)=>void}  actions.giveToy     equip one by id
 *   @param {()=>void}           actions.clearToys   drop everything active
 *   @param {(n:number)=>void}   actions.setLevel    jump to a level (fires the celebration)
 *   @param {(tier:string)=>void} actions.spawnTier  put one monster on screen
 *   @param {()=>void}           actions.clearField  pop everything alive
 *   @param {()=>void}           actions.restart
 *   @param {object}             actions.world       live world, for debug flags
 *   @param {string[]}           actions.toyIds
 */
export function createDevPanel(doc, actions) {
  const { giveToy, clearToys, setLevel, spawnTier, clearField, restart,
          world, toyIds = [] } = actions;

  const btn = doc.createElement('button');
  btn.id = 'dev-button';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Dev tools');
  btn.innerHTML = WRENCH;

  const panel = doc.createElement('div');
  panel.id = 'dev-panel';
  panel.className = 'hidden';

  function section(title) {
    const h = doc.createElement('div');
    h.className = 'dev-section';
    h.textContent = title;
    panel.appendChild(h);
  }

  function chips(labels, onPick) {
    const row = doc.createElement('div');
    row.className = 'dev-row';
    labels.forEach((label, i) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'dev-chip';
      b.textContent = label;
      b.addEventListener('click', (e) => { e.stopPropagation(); onPick(i, label); });
      row.appendChild(b);
    });
    panel.appendChild(row);
  }

  function toggle(label, get, set) {
    const row = doc.createElement('div');
    row.className = 'dev-row dev-toggle';
    const name = doc.createElement('span');
    name.textContent = label;
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'dev-chip';
    const paint = () => {
      const on = !!get();
      b.textContent = on ? 'ON' : 'OFF';
      b.classList.toggle('on', on);
    };
    b.addEventListener('click', (e) => { e.stopPropagation(); set(!get()); paint(); });
    paint();
    row.appendChild(name);
    row.appendChild(b);
    panel.appendChild(row);
  }

  // --- TOYS. The row that earns the panel: every toy, instantly, stacked. ---
  section('GIVE A TOY');
  chips(toyIds, (i, id) => giveToy(id));
  chips(['ALL', 'CLEAR'], (i) => {
    if (i === 0) toyIds.forEach(giveToy);
    else clearToys();
  });

  // --- LEVELS. Unlocks and the celebration ladder both hang off this. -------
  section('JUMP TO LEVEL');
  chips(['1', '2', '3', '5', '7', '10'], (i, label) => setLevel(parseInt(label, 10)));

  // --- THE FIELD ------------------------------------------------------------
  section('FIELD');
  chips(['+SMALL', '+MEDIUM', '+LARGE'], (i) => spawnTier(['small', 'medium', 'large'][i]));
  chips(['CLEAR FIELD', 'RESTART'], (i) => (i === 0 ? clearField() : restart()));

  section('FLAGS');
  // Invincible is the one flag that changes what a run MEANS, so it is the one
  // the HUD has to be able to show. `world.debug` is the contract the renderer
  // reads; nothing here keeps its own copy.
  toggle('Invincible', () => world.debug.invincible,
         (v) => { world.debug.invincible = v; });
  toggle('Show stats', () => !world.stats.showStatsOff,
         (v) => { world.stats.showStatsOff = !v; });

  const note = doc.createElement('div');
  note.className = 'dev-note';
  note.textContent = 'Keys 1-8 give toys · R restarts · C camera · [ ] speed · - = clearance';
  panel.appendChild(note);

  function setOpen(v) {
    panel.classList.toggle('hidden', !v);
    btn.classList.toggle('on', v);
  }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(panel.classList.contains('hidden'));
  });
  doc.addEventListener('click', () => setOpen(false));
  // Clicks inside the panel must not bubble to the document handler above, or
  // the panel closes on its own buttons.
  panel.addEventListener('click', (e) => e.stopPropagation());

  return { button: btn, panel, close: () => setOpen(false) };
}
