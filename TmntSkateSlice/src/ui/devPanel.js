// Dev panel (wrench button, bottom-left chrome).
//
// WHAT THIS IS FOR. This catcher runs eight stages and the campaign only ends
// at Docks (20000 cumulative score) -- several minutes of real play before you
// reach the beat you actually changed. Amit asked for the same convenience
// NovaVanguard carries: skip straight to a stage, push the score, force the
// win, stop dying. Ported from NovaVanguard/src/ui/devPanel.js and adapted to
// this game's actions.
//
// DEV ONLY, AND IT SAYS SO. Every row here either skips content or removes a
// failure condition, so nothing in this file may be reachable by accident: it
// is mounted only behind the long-press-plus-code unlock (ui/devUnlock.js),
// the panel starts closed, and the invincible row tints the whole frame so a
// "why am I not dying" question can never survive more than a glance.
//
// THEME-NEUTRAL COPY. This file ships in BOTH the TMNT and original builds
// (same bundle, gated behind the unlock), so its own labels stay theme-
// agnostic -- no pizza/ninja words. The only themed strings are the stage
// NAMES, which come from data/stages.js, exactly as Nova's came from SURFACES.
//
// KEYBOARD PARITY. Inside the Unity WebView there is no pointer at all -- the
// host forwards only Space/Enter (plus synthetic steering), never a click. That
// makes every button here unreachable on device, exactly as this repo's
// settings panels document for themselves. This is a desktop-development tool;
// the unlock gesture still mounts it on device, but operating the rows needs a
// pointer.
//
// WHO OWNS WHAT. This file renders controls and calls back into main.js. It
// owns no game state of its own -- the actions it invokes (jumpToStage, winNow,
// addScore, ...) are the game's own functions, passed in, so the panel cannot
// drift from what the game actually does. The `debug` flag object is read and
// written directly because that object IS the debug contract main.js reads.

const WRENCH = '&#128295;'; // 🔧

/**
 * @param {Document} doc
 * @param {object} actions
 *   @param {Array}                actions.stages      STAGES, for count + names
 *   @param {(index:number)=>void} actions.jumpToStage
 *   @param {(amount:number)=>void}actions.addScore
 *   @param {()=>void}             actions.winNow
 *   @param {()=>void}             actions.addLife
 *   @param {()=>void}             actions.fullLives
 *   @param {()=>void}             actions.spawnHeart
 *   @param {()=>void}             actions.restart
 *   @param {object}               actions.debug       live debug-flag object
 */
export function createDevPanel(doc, actions) {
  const { stages = [], jumpToStage, addScore, winNow, addLife, fullLives,
          spawnHeart, restart, debug } = actions;

  const btn = doc.createElement('button');
  btn.id = 'dev-button';
  btn.setAttribute('aria-label', 'Dev tools');
  btn.innerHTML = WRENCH;

  const panel = doc.createElement('div');
  panel.id = 'dev-panel';
  panel.className = 'hidden';

  let open = false;

  // --- rows -----------------------------------------------------------------

  function section(title) {
    const h = doc.createElement('div');
    h.className = 'dev-section';
    h.textContent = title;
    panel.appendChild(h);
  }

  function note(text) {
    const n = doc.createElement('div');
    n.className = 'dev-note';
    n.textContent = text;
    panel.appendChild(n);
  }

  function buttonRow(labels, onPick) {
    const row = doc.createElement('div');
    row.className = 'dev-row';
    labels.forEach((label, i) => {
      const b = doc.createElement('button');
      b.className = 'dev-chip';
      b.textContent = label;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onPick(i);
      });
      row.appendChild(b);
    });
    panel.appendChild(row);
    return row;
  }

  function toggleRow(label, get, set) {
    const row = doc.createElement('div');
    row.className = 'dev-row dev-toggle';
    const name = doc.createElement('span');
    name.textContent = label;
    const b = doc.createElement('button');
    b.className = 'dev-chip';
    const paint = () => {
      const on = !!get();
      b.textContent = on ? 'ON' : 'OFF';
      b.classList.toggle('on', on);
    };
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      set(!get());
      paint();
    });
    paint();
    row.appendChild(name);
    row.appendChild(b);
    panel.appendChild(row);
    return { paint };
  }

  // STAGE JUMP -- the reason this panel exists. One chip per stage; the names
  // note underneath so a number maps to a place without memorising the order.
  section('JUMP TO STAGE');
  buttonRow(
    stages.map((_, i) => String(i + 1)),
    (i) => jumpToStage(i),
  );
  note(stages.map((s, i) => `${i + 1} ${s.name}`).join('  ·  '));

  // SCORE -- push the run score to reach a threshold without grinding catches.
  // The campaign win is at 20000, so a +20K chip is a one-tap way to arm the
  // final-stage clear once you're on Docks.
  section('SCORE');
  const SCORE_STEPS = [1000, 5000, 20000];
  buttonRow(['+1K', '+5K', '+20K'], (i) => addScore(SCORE_STEPS[i]));

  section('SHORTCUTS');
  buttonRow(['WIN NOW', 'RESTART'], (i) => {
    if (i === 0) winNow();
    else restart();
  });

  section('LIVES');
  buttonRow(['+1 LIFE', 'FULL'], (i) => {
    if (i === 0) addLife();
    else fullLives();
  });

  section('SPAWN');
  buttonRow(['HEART'], () => spawnHeart());

  // INVINCIBLE has to be impossible to forget about -- a persistent tint on
  // the frame (see #dev-invincible CSS), so "why am I not dying" is answered
  // before it is asked.
  section('CHEATS');
  const invRow = toggleRow(
    'Invincible',
    () => !!debug.invincible,
    (v) => {
      debug.invincible = v;
      doc.body.classList.toggle('dev-invincible', v);
    },
  );

  section('UNLOCK');
  note('Hold the top-left score area 7s, then enter the code · or ?dev=1');

  // --- open/close -----------------------------------------------------------

  function setOpen(v) {
    open = v;
    panel.classList.toggle('hidden', !open);
    btn.classList.toggle('on', open);
    if (open) invRow.paint();
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!open);
  });

  // Clicking the playfield closes it, so it can never be left covering the
  // action by accident.
  doc.addEventListener('click', () => { if (open) setOpen(false); });

  return {
    button: btn,
    panel,
    toggle: () => setOpen(!open),
    close: () => setOpen(false),
    isOpen: () => open,
  };
}
