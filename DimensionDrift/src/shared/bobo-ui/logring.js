/**
 * bobo-ui/logring — the console that survives not having one.
 *
 * On a board there is no devtools: the Flutter WebView ships without an
 * inspector in release, and the GoBalance WebView never has one at all -- its
 * only outward channel is `Unity.call`, which lands in adb logcat
 * (GOBALANCE_Bobo_DoubleFlow.md §3). So everything a game prints is also kept
 * HERE, in a ring, and the dev panel can put it on the actual screen in front
 * of the player who just reported something -- which is the whole reason the
 * panel exists in the shipped build behind its gesture.
 *
 * Installed FIRST, before the game constructs, because the lines worth keeping
 * are boot lines: a game that installs its log after booting keeps every line
 * except the ones that explain the report.
 */

const CAP = 400;        // entries; a boot plus a few minutes of play
const LINE_MAX = 300;   // chars per entry; a stack's head, not its tail

const ring = [];
let installed = false;

function push(lvl, args) {
  let msg;
  try {
    msg = args.map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return `${a.message}\n${(a.stack || '').split('\n').slice(0, 3).join('\n')}`;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ');
  } catch { msg = '[unprintable]'; }
  if (msg.length > LINE_MAX) msg = msg.slice(0, LINE_MAX) + '…';
  ring.push({ t: Math.round(performance.now()), lvl, msg });
  if (ring.length > CAP) ring.shift();
}

/** Wrap the console and the error events. Idempotent, and every original
 *  behaviour is preserved -- this listens, it never silences. */
export function installLogRing(win = window) {
  if (installed) return;
  installed = true;
  // The UNWRAPPED console.error, captured before the wrapping below, so the
  // relay cannot recurse through its own ring entry.
  const realError = win.console.error.bind(win.console);
  for (const lvl of ['log', 'warn', 'error', 'info']) {
    const orig = win.console[lvl].bind(win.console);
    win.console[lvl] = (...a) => { push(lvl, a); return orig(...a); };
  }
  /**
   * AN UNCAUGHT ERROR IS SAID OUT LOUD, not just remembered.
   *
   * These two handlers used to put the error in the ring and stop there, and
   * the ring only leaves the device when a human opens the dev panel and taps
   * `copy capture`. Everywhere the ring actually matters -- a board session, a
   * WebView inside the Unity Editor -- the only channel OUT is the console,
   * which the host relays. So a crash was invisible in exactly the places we
   * cannot attach a debugger to, and an Editor log showing no error meant
   * nothing at all: there was no path for one to appear on.
   *
   * Printing through the console costs one line and makes "no error in the
   * log" a real answer instead of an artefact of the instrument.
   */
  const shout = (what, detail) => {
    push('error', [what, detail]);
    try { realError(`[uncaught] ${what}`, detail); } catch { /* nothing left to try */ }
  };
  win.addEventListener('error', (e) => shout(
    `${e.message} at ${e.filename}:${e.lineno}`, e.error?.stack ?? ''));
  win.addEventListener('unhandledrejection', (e) => shout(
    'unhandled rejection', e.reason?.stack ?? String(e.reason ?? '')));
  push('log', [`[logring] capturing (ring of ${CAP})`]);
}

export function getLog() { return ring.slice(); }

/** The ring as screen-ready text: seconds since boot, level-tagged. */
export function formatLog() {
  return ring.map((r) => `${(r.t / 1000).toFixed(1).padStart(7)}s ${r.lvl === 'log' ? ' ' : r.lvl[0].toUpperCase()} ${r.msg}`).join('\n');
}
