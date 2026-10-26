/**
 * bobo-ui/menunav — the one menu-navigation system, for every game here.
 *
 * Asked for as a SYSTEM, not a patch: "each corner button can close the menu
 * it opened... pause button opens the pause menu, its settings button closes
 * it and opens the settings menu and vice versa... X closes each one of the
 * menus, and X while running with no menu up asks 'exit run, are you sure?'.
 * Don't do these ad-hoc — think about a proper system, we will reuse it with
 * other games on this repo." (Elad, 2026-10-06.)
 *
 * THE MODEL. A game has one game layer and AT MOST ONE menu over it. Menus are
 * ordinary screens the game already owns (shown via its own setScreen); this
 * file owns only the NAVIGATION RULES, which are the part every game would
 * otherwise re-implement slightly differently:
 *
 *   1. TOGGLE  — the corner button that opens a menu closes it again.
 *   2. SUSPEND — opening any menu from a live run pauses it ONCE; closing the
 *                last menu resumes it through the game's own safe resume
 *                (carve counts 3 — this file neither knows nor cares).
 *                Switching between menus keeps the run paused: one suspend,
 *                however long the visit.
 *   3. X CLOSES — with a menu up, the corner X closes it (same as rule 2's
 *                resume if a run is live). It never exits from inside a menu.
 *   4. X CONFIRMS — in a live run with no menu up, X raises the built-in
 *                "exit run?" popup AND SUSPENDS THE RUN under it ("leave this
 *                run popup should also pause"): confirm quits, decline repays
 *                the suspend through the game's safe resume. Outside a run
 *                with no menu up, X falls through to exitApp — the game's
 *                existing exit ladder, untouched.
 *
 * WHAT A GAME PLUGS IN — the whole reuse contract:
 *   screens   {pause:'pause', settings:'settings'}  its screen names
 *   setScreen (name|null)                           its screen switcher
 *   isRunning ()                                    a run is in flight
 *   pauseRun / resumeRun ()                         its own safe suspend pair
 *   quitRun ()                                      end the run to its lobby
 *   exitApp ()                                      the top of its back ladder
 *   onMenuShown (id)                                optional: repaint hooks
 *   confirmCopy {title, body, yes, no}              optional: popup wording
 *
 * THE POPUP IS SELF-CONTAINED — DOM and style injected here, like
 * calibrate.js does — so a game adds exit confirmation without owning
 * another screen. It is deliberately NOT a registered menu: it is a question,
 * not a place, and rules 1–3 must not apply to it.
 */

const STYLE_ID = 'bobo-menunav-style';

function ensureStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
body.mnav-confirm-open .screen{visibility:hidden}

.mnav-confirm{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;
  justify-content:center;background:rgba(8,10,14,.78);font-family:Manrope,system-ui,sans-serif}
.mnav-card{background:#10141d;border:1px solid rgba(255,255,255,.08);border-radius:16px;
  padding:26px 28px;max-width:min(86vw,420px);text-align:center;color:#f2f5f8;
  box-shadow:0 18px 60px rgba(0,0,0,.5)}
.mnav-card h3{margin:0 0 6px;font-size:1.25rem;font-weight:800;letter-spacing:.04em}
.mnav-card p{margin:0 0 18px;opacity:.75;font-size:.95rem}
.mnav-row{display:flex;gap:10px;justify-content:center}
.mnav-row button{font:inherit;font-weight:700;border-radius:12px;padding:12px 18px;
  border:1px solid rgba(255,255,255,.14);cursor:pointer}
.mnav-yes{background:#8fd0ff;color:#0a0f18;border-color:transparent}
.mnav-no{background:transparent;color:#f2f5f8}
`;
  doc.head.appendChild(el);
}

export function createMenuNav({
  screens = { pause: 'pause', settings: 'settings' },
  setScreen,
  isRunning,
  pauseRun,
  resumeRun,
  quitRun,
  exitApp,
  onMenuShown = null,
  confirmCopy = {},
  doc = document,
} = {}) {
  ensureStyle(doc);

  /** The menu on top, or null. */
  let top = null;
  /** Whether THIS system suspended a run on the way in (and so owes a resume). */
  let suspended = false;
  let confirmEl = null;

  /** BAL-590's instant swap now belongs to `Screens.go`, which sees every
   *  transition rather than only the ones this system drives. */
  function show(id) {
    top = id;
    setScreen(screens[id]);
    onMenuShown?.(id);
  }

  /** Close whatever is open. The one place the resume debt is repaid. */
  function close() {
    if (!top) return;
    top = null;
    if (suspended) {
      suspended = false;
      resumeRun(); // the game's own safe resume decides what the screen shows
    } else {
      setScreen(null); // lobby visit: hand the screen back
    }
  }

  function open(id) {
    if (!top && isRunning()) {
      suspended = true;
      pauseRun(); // ONCE per visit, however many menus are switched through
    }
    show(id);
  }

  /** Rule 1: the corner button that opened it closes it. */
  function toggle(id) {
    if (top === id) close();
    else if (top) show(id);   // rule 2: switching keeps the suspend
    else open(id);
  }

  /** Cross-links between menus (the pause menu's `settings` row and back). */
  function switchTo(id) {
    if (top) show(id);
    else open(id);
  }

  function dismissConfirm() {
    confirmEl?.remove();
    confirmEl = null;
    doc.body.classList.remove('mnav-confirm-open');
  }

  /** Rule 4's popup. Self-contained, never part of the menu stack -- but it
   *  SUSPENDS like one: the question freezes the run it is asking about, and
   *  declining resumes through the game's own safe path. The game's screens
   *  hide under it (pauseRun may raise the pause screen; the popup is the only
   *  thing on show). */
  function confirmExit() {
    if (confirmEl) return;
    if (isRunning()) {
      suspended = true;
      pauseRun();
    }
    doc.body.classList.add('mnav-confirm-open');
    const c = confirmCopy;
    confirmEl = doc.createElement('div');
    confirmEl.className = 'mnav-confirm';
    confirmEl.innerHTML = `
      <div class="mnav-card" role="alertdialog" aria-modal="true">
        <h3>${c.title ?? 'exit run?'}</h3>
        <p>${c.body ?? 'leaving here ends this run'}</p>
        <div class="mnav-row">
          <button type="button" class="mnav-yes">${c.yes ?? 'leave the run'}</button>
          <button type="button" class="mnav-no">${c.no ?? 'keep riding'}</button>
        </div>
      </div>`;
    confirmEl.querySelector('.mnav-yes').addEventListener('click', () => {
      dismissConfirm();
      suspended = false; // the run is about to not exist; owe it nothing
      quitRun();
    });
    confirmEl.querySelector('.mnav-no').addEventListener('click', () => {
      dismissConfirm();
      if (suspended && !top) {
        suspended = false;
        resumeRun();
      }
    });
    doc.body.appendChild(confirmEl);
  }

  /** Rule 3 + 4: what the corner X means depends on what is up. */
  function onExit() {
    if (confirmEl) { // same as declining: the question is withdrawn
      dismissConfirm();
      if (suspended && !top) { suspended = false; resumeRun(); }
      return;
    }
    if (top) { close(); return; }
    if (isRunning()) { confirmExit(); return; }
    exitApp();
  }

  return {
    toggle,
    switchTo,
    close,
    onExit,
    confirmExit,
    /** For the game's own flows (quit rows, run end): forget any open menu
     *  WITHOUT paying the resume debt — the run is gone, there is nothing to
     *  resume into. */
    reset() { suspended = false; top = null; dismissConfirm(); },
    get top() { return top; },
  };
}
