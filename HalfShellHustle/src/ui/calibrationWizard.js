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
const subEl = document.getElementById('calibration-sub');
const cancelBtn = document.getElementById('calibration-cancel');

// Real physical hold time before a side is recorded (systems/
// boardCalibration.js's own MOVE_GATE_DEG doubles as "have they actually
// started leaning that way").
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
        },
        onGateOpen: () => {
          subEl.textContent = 'Hold it there...';
        },
        onTilt: (x) => setBoardTilt(x),
      });
    }

    if (!result.cancelled) {
      titleEl.textContent = "THAT'S YOUR RANGE";
      subEl.textContent = result.applied
        ? `Set to ${result.applied.value}° -- full steering arrives just before your limit, so you never have to hold the very edge.`
        : 'Could not save that -- try again from Settings.';
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
