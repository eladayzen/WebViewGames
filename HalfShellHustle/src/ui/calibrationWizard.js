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
const progressEl = document.getElementById('calibration-progress');
const progressFillEl = document.getElementById('calibration-progress-fill');
const subEl = document.getElementById('calibration-sub');
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

const PHASE_COPY = {
  right: { title: 'LEAN RIGHT', sub: 'Go as far as you comfortably can, then hold it.' },
  left: { title: 'LEAN LEFT', sub: 'Go as far as you comfortably can, then hold it.' },
};

let cancelled = false;
let isOpen = false;
let onOpenHook = null;
let onCloseHook = null;

// main.js supplies these -- pause/restore-prior-pause-state is core/main.js's
// closure, not this file's; same ownership split as every other panel here.
export function setCalibrationLifecycleHooks(onOpen, onClose) {
  onOpenHook = onOpen;
  onCloseHook = onClose;
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
    cancelled = true;
  });

  async function open() {
    if (!maxAngleAvailable()) return false;
    if (isOpen) return false; // re-entry guard -- see this file's header
    isOpen = true;
    cancelled = false;
    overlayEl.classList.remove('hidden');
    if (onOpenHook) onOpenHook();

    titleEl.textContent = 'STAND ON THE BOARD';
    subEl.textContent = 'Get comfortable, then lean all the way RIGHT.';
    setBoardTilt(0);
    setHoldState(false, 0);
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
        },
        onGateOpen: () => {
          subEl.textContent = 'Hold it there...';
          setHoldState(true, 0);
        },
        onGateClose: (phase) => {
          // Came back under the gate before the hold finished -- the sample
          // restarts, so say the original ask again rather than leaving
          // "hold it there" up over a bar that just emptied itself.
          const copy = PHASE_COPY[phase];
          if (copy) subEl.textContent = copy.sub;
          setHoldState(false, 0);
        },
        onHoldProgress: (f) => setHoldState(true, f),
        onTilt: (x) => setBoardTilt(x),
      });
    }

    setHoldState(false, 0);
    if (!result.cancelled) {
      titleEl.textContent = "THAT'S YOUR RANGE";
      subEl.textContent = result.applied
        ? `Set to ${result.applied.value}° -- full steering arrives just before your limit, so you never have to hold the very edge.`
        : 'Could not save that -- try again from Settings.';
      setBoardTilt(0);
      await wait(2600);
    } else if (result.reason === 'timeout' || result.reason === 'implausible') {
      // A genuine failure, not the player choosing to back out -- say so
      // rather than just vanishing (see systems/boardCalibration.js's own
      // comment on why these must never silently persist a value).
      titleEl.textContent = "COULDN'T MEASURE THAT";
      subEl.textContent = "Didn't get a clear reading -- nothing was changed. Try again from Settings.";
      setBoardTilt(0);
      await wait(2600);
    }

    overlayEl.classList.add('hidden');
    setBoardTilt(0);
    isOpen = false;
    if (onCloseHook) onCloseHook();
    return true;
  }

  return { open };
}
