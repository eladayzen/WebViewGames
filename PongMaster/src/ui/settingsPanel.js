/* Player settings -- the gear in the top-right chrome row.
 *
 * Split from the dev panel BY AUDIENCE, not by convenience. What belongs here
 * is anything a player could reasonably want to change about how the game
 * plays for them. Sensitivity is the one every board game shares, because the
 * right lean for an adult is not the right lean for a child, and the default
 * will be wrong for someone in every family. What does not belong here is
 * anything that only makes sense to someone reading the source.
 *
 * WHY THIS SCALES OUR OWN INPUT, unlike the shipped template it follows.
 *
 * The template's rule is "sensitivity is the host's, never scale the sensor
 * too, or the two compound". That is right for a DIGITAL game. It is wrong
 * here, and the difference is not cosmetic:
 *
 *   `GoBalance.setSensitivity(n)` maps to the host's pressThreshold /
 *   releaseThreshold, which exist purely to turn an analog tilt into on/off
 *   arrow-key presses. GOBALANCE_SDK.md is explicit that they only affect
 *   `forwardSteeringKeys = true` games -- "in analog mode the game gets the
 *   raw value via __gbSensor and would do its own scaling."
 *
 * This game reads the analog value (it has to: synthetic keys can only ever
 * drive one player, and two-player needs the real tilt). So the host call
 * changes nothing for us, and a settings panel that only made that call would
 * be a control that visibly moves and does nothing -- worse than no control.
 *
 * So: the host is still told, because it costs nothing and is correct if the
 * host ever applies it in analog mode, and the real work is a gain multiplier
 * applied in input.js. They cannot compound, because exactly one of them is
 * ever in effect.
 */

const PREF_KEY = 'pongmaster:settings';
const DEFAULT_SENSITIVITY = 55;
const MIN = 10;
const MAX = 100;
const STEP = 5;

function loadPrefs() {
  try {
    return JSON.parse(window.localStorage.getItem(PREF_KEY) || '{}') || {};
  } catch (err) {
    return {};
  }
}

function savePrefs(p) {
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch (err) {
    /* restricted WebView: the session still behaves correctly, the choice
       simply does not survive a reload */
  }
}

/* Percent -> input gain multiplier.
 *
 * Piecewise so that the default sits exactly at 1.0 and today's feel is
 * unchanged for anyone who never opens the panel. Both ends stay playable:
 * a literal reading of "10% as sensitive" would need a lean nobody can hold,
 * which is a setting that exists only to be regretted.
 */
export function sensitivityScale(percent) {
  const p = Math.max(MIN, Math.min(MAX, percent));
  if (p <= DEFAULT_SENSITIVITY) {
    const t = (p - MIN) / (DEFAULT_SENSITIVITY - MIN);
    return 0.55 + t * (1.0 - 0.55);
  }
  const t = (p - DEFAULT_SENSITIVITY) / (MAX - DEFAULT_SENSITIVITY);
  return 1.0 + t * (1.6 - 1.0);
}

export function createSettingsPanel({ onChange }) {
  const btn = document.getElementById('settings-button');
  const panel = document.getElementById('settings-panel');
  const valueEl = document.getElementById('sens-value');
  const down = document.getElementById('sens-down');
  const up = document.getElementById('sens-up');

  const prefs = loadPrefs();
  let sensitivity =
    typeof prefs.sensitivity === 'number' ? prefs.sensitivity : DEFAULT_SENSITIVITY;

  function apply(next, persist) {
    // Steps of 5 across 10..100. A slider would be finer and much worse here:
    // this is set while standing on a board, often by a parent, and a coarse
    // control you can hit beats a precise one you cannot.
    sensitivity = Math.max(MIN, Math.min(MAX, Math.round(next / STEP) * STEP));
    valueEl.textContent = String(sensitivity);

    const gb = window.GoBalance;
    if (gb && typeof gb.setSensitivity === 'function') gb.setSensitivity(sensitivity);
    else if (window.Unity) window.Unity.call('gb:sensitivity:' + sensitivity);

    onChange(sensitivityScale(sensitivity));
    if (persist) savePrefs({ ...loadPrefs(), sensitivity });
  }

  // Driven on every press rather than on close, so the player feels the
  // change while adjusting it instead of after.
  down.addEventListener('click', (e) => {
    e.stopPropagation();
    apply(sensitivity - STEP, true);
  });
  up.addEventListener('click', (e) => {
    e.stopPropagation();
    apply(sensitivity + STEP, true);
  });

  function setOpen(open) {
    panel.classList.toggle('hidden', !open);
    btn.classList.toggle('on', open);
  }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(panel.classList.contains('hidden'));
  });
  panel.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => setOpen(false));

  /* Re-apply the stored value on boot. The host does not remember it -- the
   * thresholds are scene fields that reset every time the scene loads -- so a
   * setting made last session is only in force if the page pushes it again. */
  apply(sensitivity, false);

  return {
    close: () => setOpen(false),
    isOpen: () => !panel.classList.contains('hidden'),
    get value() {
      return sensitivity;
    },
  };
}
