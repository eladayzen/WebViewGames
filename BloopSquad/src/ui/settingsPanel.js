// Player settings (gear button, top-right chrome row).
//
// TEMPLATE FILE, like devUnlock.js. Every GoBalance web game should carry the
// same separation: a GEAR that players are meant to open, and a WRENCH that is
// unlocked by gesture and holds only developer tools. Mixing them is how a
// player ends up one tap from invincibility, and how a developer ends up
// hunting for sensitivity behind a secret.
//
// WHAT BELONGS HERE: anything a player could reasonably want to change about
// how the game plays for them. Sensitivity is the one every board game shares,
// because the right lean for an adult is not the right lean for a child.
//
// WHAT DOES NOT: anything that skips content, removes a failure condition or
// only makes sense to someone reading the source. Those go in the dev panel.
//
// SENSITIVITY IS THE HOST'S, not ours. `GoBalance.setSensitivity(0..100)` --
// higher reacts to a smaller lean -- is applied on the Unity side to the board
// reading itself, before the page ever sees it. A game must not also scale the
// sensor value, or the two compound and the setting stops meaning what it says.

const PREF_KEY = 'gobalance:settings';
const DEFAULT_SENSITIVITY = 55;

function loadPrefs() {
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (err) {
    return {};
  }
}

function savePrefs(p) {
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch (err) {
    /* restricted WebView: the session still behaves correctly */
  }
}

const GEAR = '&#9881;';

/**
 * @param {Document} doc
 * @param {object} opts
 *   @param {(percent:number)=>void} [opts.onSensitivity] extra hook for a game
 *          that wants to know; the host call is made here regardless.
 */
export function createSettingsPanel(doc, opts = {}) {
  const prefs = loadPrefs();
  let sensitivity =
    typeof prefs.sensitivity === 'number' ? prefs.sensitivity : DEFAULT_SENSITIVITY;

  const btn = doc.createElement('button');
  btn.id = 'settings-button';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Settings');
  btn.innerHTML = GEAR;

  const panel = doc.createElement('div');
  panel.id = 'settings-panel';
  panel.className = 'hidden';

  const title = doc.createElement('div');
  title.className = 'settings-section';
  title.textContent = 'BOARD SENSITIVITY';
  panel.appendChild(title);

  const note = doc.createElement('div');
  note.className = 'settings-note';
  note.textContent = 'Higher reacts to a smaller lean.';
  panel.appendChild(note);

  const row = doc.createElement('div');
  row.className = 'settings-row';
  const minus = doc.createElement('button');
  minus.type = 'button';
  minus.className = 'settings-step';
  minus.textContent = '−';
  const value = doc.createElement('span');
  value.className = 'settings-value';
  const plus = doc.createElement('button');
  plus.type = 'button';
  plus.className = 'settings-step';
  plus.textContent = '+';
  row.appendChild(minus);
  row.appendChild(value);
  row.appendChild(plus);
  panel.appendChild(row);

  function apply(next, persist) {
    // Steps of 5 across 10..100. A slider would be finer and much worse here:
    // this is set while standing on a board, often by a parent, and a coarse
    // control you can hit is better than a precise one you cannot.
    sensitivity = Math.max(10, Math.min(100, Math.round(next / 5) * 5));
    value.textContent = String(sensitivity);
    if (window.GoBalance && typeof window.GoBalance.setSensitivity === 'function') {
      window.GoBalance.setSensitivity(sensitivity);
    } else if (window.Unity) {
      // Legacy path, still supported by the host and still used by older games.
      window.Unity.call('gb:sensitivity:' + sensitivity);
    }
    if (opts.onSensitivity) opts.onSensitivity(sensitivity);
    if (persist) savePrefs({ ...loadPrefs(), sensitivity });
  }

  minus.addEventListener('click', (e) => { e.stopPropagation(); apply(sensitivity - 5, true); });
  plus.addEventListener('click', (e) => { e.stopPropagation(); apply(sensitivity + 5, true); });

  function setOpen(open) {
    panel.classList.toggle('hidden', !open);
    btn.classList.toggle('on', open);
  }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(panel.classList.contains('hidden'));
  });
  doc.addEventListener('click', () => setOpen(false));

  // Push the stored value to the host on boot, so a setting made last session
  // is in force before the first lean rather than after the first adjustment.
  apply(sensitivity, false);

  return { button: btn, panel, close: () => setOpen(false) };
}
