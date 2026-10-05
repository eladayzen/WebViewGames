// Board max-angle calibration wizard -- the UI half of systems/
// boardCalibration.js. Own overlay (#calibration-overlay), reachable from
// the player settings panel's CALIBRATE row, feature-detected so it never
// offers itself outside the app or on a build before the host's wrapper
// landed (see boardCalibration.js's own header).
//
// Reuses the SAME board art the intro tutorial uses (.intro-board,
// gobalance_horizontal_board.png) -- direct request: "you have that asset
// already... even animation of it tilting sideways" -- but its rotation is
// driven LIVE from the real tilt sample every poll, not a canned demo sweep.
// #calibration-board overrides .intro-board's 0.4s eased transition to
// near-instant (style.css) so that live feedback doesn't read as laggy.
//
// PAUSES THE GAME while open, restoring the prior pause state on close --
// same pattern as the quit-confirm modal (core/main.js), via the lifecycle
// hooks set by setCalibrationLifecycleHooks (main.js owns pausing; this file
// only renders).

import { maxAngleAvailable, runCalibrationWizard } from '../systems/boardCalibration.js';

const overlayEl = document.getElementById('calibration-overlay');
const titleEl = document.getElementById('calibration-title');
const boardEl = document.getElementById('calibration-board');
const boardWrapEl = document.getElementById('calibration-board-wrap');
const footEls = {
  right: document.querySelector('.cal-foot-right'),
  left: document.querySelector('.cal-foot-left'),
};
const progressEl = document.getElementById('calibration-progress');
const progressFillEl = document.getElementById('calibration-progress-fill');
const subEl = document.getElementById('calibration-sub');
const valueEl = document.getElementById('calibration-value');
const cancelBtn = document.getElementById('calibration-cancel');

// Opening beat before any sampling starts -- time to actually get on the
// board and read the prompt. Not a measurement window; the real gating is
// boardCalibration.js's MOVE_GATE_DEG plus its hold.
const SETTLE_MS = 1200;
// Visual scale only -- how far the board graphic rotates at a full
// (widened-ruler) reading. Matches the intro tutorial's own look (its fixed
// lane states use +/-29deg) rather than a literal 1:1 degree mapping, which
// would spin the board edge-on and read as broken, not tilted.
const VISUAL_MAX_DEG = 32;

// Copy is deliberately TERSE -- direct request: "short texts that are
// bigger." Longer guidance was tried and reads as a wall at board distance;
// the ring/bar/foot visuals carry the detail the words used to.
const PHASE_COPY = {
  right: { title: 'LEAN RIGHT', sub: 'All the way, then hold.' },
  left: { title: 'LEAN LEFT', sub: 'All the way, then hold.' },
};

let cancelled = false;
let isOpen = false;
let onOpenHook = null;
let onCloseHook = null;

// 'cancel' while measuring, 'ok' on a result screen. One physical button --
// the same spot on screen stops the wizard or confirms the result, and the
// label says which. okResolver is the pending waitForOk() promise.
let buttonMode = 'cancel';
let okResolver = null;

export function isCalibrationWizardOpen() {
  return isOpen;
}

// main.js supplies these -- pause/restore-prior-pause-state is core/main.js's
// closure, not this file's; same ownership split as every other panel here.
export function setCalibrationLifecycleHooks(onOpen, onClose) {
  onOpenHook = onOpen;
  onCloseHook = onClose;
}

// Lights the footprint for the side being asked for -- 'right', 'left', or
// null for neither (settle and result, where no side is being asked for).
function setActiveFoot(side) {
  footEls.right.classList.toggle('active', side === 'right');
  footEls.left.classList.toggle('active', side === 'left');
}

function setBoardTilt(x) {
  const deg = Math.max(-1, Math.min(1, x || 0)) * VISUAL_MAX_DEG;
  boardEl.style.transform = `perspective(380px) rotateY(${deg.toFixed(1)}deg)`;
}

// How long the completed (green) state stays up after a side finishes.
// Without it that state is invisible: the sample resolves the instant the
// fraction reaches 1, so the next side's prompt would clear the green in the
// same frame it appeared, and the player would never get told "that side is
// done, you can come off it" -- which is the one moment they're waiting for
// while holding a lean at the edge of their balance.
const HELD_FLASH_MS = 450;
let heldUntil = 0;
let clearTimer = null;

// The travelling-outward state: the player is moving but nothing is being
// measured yet. Visually distinct from the hold on purpose -- it's the
// difference between "I can see you" and "I'm recording", and conflating
// them is what let a fast lean and a slow lean produce different numbers
// without the player ever being told which part counted.
function setReaching(on) {
  boardWrapEl.classList.toggle('reaching', on);
}

function paintHold(counting, f) {
  boardWrapEl.classList.toggle('counting', counting && f < 1);
  boardWrapEl.classList.toggle('held', counting && f >= 1);
  progressEl.classList.toggle('visible', counting);
  progressFillEl.style.width = `${(counting ? f : 0) * 100}%`;
  progressFillEl.classList.toggle('full', counting && f >= 1);
}

// `counting` = the movement gate is open and the hold is being timed;
// fraction drives the bar. Both drop back to nothing when the player drifts
// out from under the gate, so "it stopped counting" is visible rather than
// something they only discover when the side doesn't end.
function setHoldState(counting, fraction) {
  const f = Math.max(0, Math.min(1, fraction || 0));
  window.clearTimeout(clearTimer);

  if (counting && f >= 1) {
    heldUntil = performance.now() + HELD_FLASH_MS;
    paintHold(true, 1);
    return;
  }
  const remaining = heldUntil - performance.now();
  if (remaining > 0) {
    // Let the green finish being seen, then apply whatever was asked for.
    clearTimer = window.setTimeout(() => { heldUntil = 0; paintHold(counting, f); }, remaining);
    return;
  }
  heldUntil = 0;
  paintHold(counting, f);
}

// Switches the overlay between its two layouts. Measuring: board + bar,
// CANCEL. Result: the number HUGE, no board, OK -- direct request: "the new
// angle needs to be presented bigger with more time to read, and perhaps an
// ok button." The result has NO timer: it stays until OK, so "more time to
// read" is however long the player wants.
function showResult({ title, value, warn, sub }) {
  titleEl.textContent = title;
  subEl.textContent = sub;
  boardWrapEl.classList.add('hidden');
  progressEl.classList.add('hidden');
  if (value != null) {
    valueEl.textContent = value;
    valueEl.classList.toggle('warn', !!warn);
    valueEl.classList.remove('hidden');
  } else {
    valueEl.classList.add('hidden');
  }
  buttonMode = 'ok';
  cancelBtn.textContent = 'OK';
}

function resetLayout() {
  boardWrapEl.classList.remove('hidden');
  progressEl.classList.remove('hidden');
  valueEl.classList.add('hidden');
  valueEl.classList.remove('warn');
  buttonMode = 'cancel';
  cancelBtn.textContent = 'CANCEL';
}

function waitForOk() {
  return new Promise((resolve) => { okResolver = resolve; });
}

// Interruptible sleep -- a cancel during the settle beat must stop it
// immediately rather than waiting out the full 1.2s before noticing.
function wait(ms) {
  return new Promise((resolve) => {
    const start = performance.now();
    const check = () => {
      if (cancelled || performance.now() - start >= ms) { resolve(); return; }
      requestAnimationFrame(check);
    };
    check();
  });
}

export function initCalibrationWizard() {
  if (!overlayEl) return { open: async () => false };

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (buttonMode === 'ok') {
      if (okResolver) { const r = okResolver; okResolver = null; r(); }
    } else {
      cancelled = true;
    }
  });

  // Enter/Space while the wizard is up belong to the wizard: they press OK on
  // a result screen and are otherwise swallowed. Without this they fall
  // through to the settings panel's own window listener, which would open the
  // panel UNDERNEATH the wizard. Registration order matters for the swallow:
  // the host dispatches synthetic keys directly ON window, where listeners
  // run in registration order, and this file is initialised by
  // initSteeringPanel BEFORE the panel registers its own listener -- so
  // stopImmediatePropagation here reliably runs first. The panel also checks
  // isCalibrationWizardOpen() itself, so neither ordering nor the swallow is
  // load-bearing alone.
  window.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.code !== 'Enter' && e.code !== 'Space') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (buttonMode === 'ok' && okResolver) {
      const r = okResolver;
      okResolver = null;
      r();
    }
  }, true);

  async function open() {
    if (!maxAngleAvailable()) return false;
    if (isOpen) return false; // re-entry guard -- see this file's header
    isOpen = true;
    cancelled = false;
    overlayEl.classList.remove('hidden');
    if (onOpenHook) onOpenHook();

    titleEl.textContent = 'STAND ON THE BOARD';
    subEl.textContent = 'Get comfortable.';
    resetLayout();
    setBoardTilt(0);
    setHoldState(false, 0);
    setReaching(false);
    setActiveFoot(null);
    await wait(SETTLE_MS);

    let result = { cancelled: true };
    if (!cancelled) {
      result = await runCalibrationWizard({
        isCancelled: () => cancelled,
        onPhase: (phase) => {
          const copy = PHASE_COPY[phase];
          if (copy) {
            titleEl.textContent = copy.title;
            subEl.textContent = copy.sub;
          }
          // Each side starts its own hold from nothing -- never carry the
          // previous side's completed (green, full) bar into the next prompt.
          setHoldState(false, 0);
          setReaching(false);
          setActiveFoot(PHASE_COPY[phase] ? phase : null);
        },
        onGateOpen: () => {
          // Moving, but NOT measuring yet -- see boardCalibration.js's
          // plateau constants. Saying "hold it" here (as this used to) told
          // the player the measurement had started while they were still
          // travelling, which is both untrue and the thing that made a slow
          // lean read lower than a fast one.
          subEl.textContent = 'Keep going -- all the way to your limit.';
          setReaching(true);
          // Also fires if the player pushes further after seeming to settle,
          // so the bar must drop back rather than keep its partial fill.
          setHoldState(false, 0);
        },
        onHoldStart: () => {
          subEl.textContent = 'Got it -- hold it there...';
          setReaching(false);
          setHoldState(true, 0);
        },
        onGateClose: (phase) => {
          // Came back under the gate before the hold finished -- the sample
          // restarts, so say the original ask again rather than leaving
          // "hold it there" up over a bar that just emptied itself.
          const copy = PHASE_COPY[phase];
          if (copy) subEl.textContent = copy.sub;
          setReaching(false);
          setHoldState(false, 0);
        },
        onHoldProgress: (f) => setHoldState(true, f),
        onTilt: (x) => setBoardTilt(x),
      });
    }

    setHoldState(false, 0);
    setReaching(false);
    setActiveFoot(null);
    setBoardTilt(0);

    // Every outcome except the player's own cancel gets a RESULT SCREEN that
    // waits for OK -- never a timer, and never a silent close. A failure must
    // be presented as clearly as a success (direct request), and the two
    // failure causes read differently because they ARE different: no clear
    // reading vs a reading that was clear and refused.
    if (!result.cancelled) {
      if (result.applied) {
        showResult({
          title: 'ALL SET',
          value: `${result.applied.value}°`,
          sub: 'Lean this far for full steering.',
        });
      } else {
        // The measurement was fine; the host rejected or never answered the
        // save. Rare (a host older than the maxangle API), but it must not
        // masquerade as success.
        showResult({
          title: "COULDN'T SAVE",
          sub: 'Nothing was changed. Try again from Settings.',
        });
      }
      await waitForOk();
    } else if (result.reason === 'implausible') {
      // Measured cleanly, refused on plausibility -- show the number that was
      // refused and the range it had to be in (direct request: if it was out
      // of range, say so). 6-30 is the MEASUREMENT gate from
      // BOARD_SENSITIVITY.md -- what the wizard will believe it measured --
      // not the host's wider 5-45 manual range.
      showResult({
        title: 'OUT OF RANGE',
        value: `${Math.round(result.computed)}°`,
        warn: true,
        sub: 'A measurement must land between 6° and 30°. Nothing was changed.',
      });
      await waitForOk();
    } else if (result.reason === 'timeout') {
      showResult({
        title: 'NO CLEAR READING',
        sub: 'Nothing was changed. Try again from Settings.',
      });
      await waitForOk();
    }
    // Player-initiated cancel: close without ceremony -- they know.

    overlayEl.classList.add('hidden');
    setBoardTilt(0);
    okResolver = null;
    isOpen = false;
    if (onCloseHook) onCloseHook();
    return true;
  }

  return { open };
}
