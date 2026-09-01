// The dev-tools unlock: a long press, then a code.
//
// TEMPLATE FILE. This is meant to be copied verbatim into other GoBalance web
// games -- the flow should be identical everywhere, so that anyone who knows it
// for one game knows it for all of them. Nothing in here is Nova Vanguard
// specific: it takes an element to press and a callback to fire.
//
// WHY A GESTURE AND A CODE, rather than a build flag. The panel skips content
// and removes failure conditions, so a player must never reach it by accident
// -- but WE need it on real hardware, in the shipped build, in front of a
// player who just reported something. A build flag can only be one or the
// other. `import.meta.env.PROD` in particular is the wrong test: the production
// build is exactly the one worth debugging.
//
// The two steps do different jobs. The long press is what makes it
// undiscoverable -- nobody holds a HUD gauge for seven seconds by accident. The
// code is what makes it deliberate, so a curious child who does discover the
// hold cannot get in.

const HOLD_MS = 7000;
const CODE = '2128';
// Digits 1-9 only: a 3x3 grid is one glance and one thumb, and the code is
// chosen from that set so the keypad never needs a zero or a wider row.
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * @param {Document} doc
 * @param {Element}  target    what to press and hold -- pick something always
 *                             on screen and never otherwise interactive
 * @param {Function} onUnlock  called once, when the correct code is entered
 */
export function installDevUnlock(doc, target, onUnlock) {
  if (!target) return;

  let holdTimer = null;
  let pad = null;
  let entry = '';

  // --- the keypad ---------------------------------------------------------

  function buildPad() {
    const wrap = doc.createElement('div');
    wrap.id = 'devcode-overlay';

    const card = doc.createElement('div');
    card.id = 'devcode-card';

    const row = doc.createElement('div');
    row.id = 'devcode-head';
    const dots = doc.createElement('div');
    dots.id = 'devcode-dots';
    const close = doc.createElement('button');
    close.id = 'devcode-close';
    close.type = 'button';
    close.textContent = '×';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closePad();
    });
    row.appendChild(dots);
    row.appendChild(close);

    const grid = doc.createElement('div');
    grid.id = 'devcode-grid';
    KEYS.forEach((k) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'devcode-key';
      b.textContent = k;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        press(k, dots);
      });
      grid.appendChild(b);
    });

    card.appendChild(row);
    card.appendChild(grid);
    wrap.appendChild(card);
    // Swallow clicks on the backdrop so the game underneath cannot be reached
    // through it -- but do NOT close on backdrop, or a stray tap loses the
    // seven seconds someone just spent.
    wrap.addEventListener('click', (e) => e.stopPropagation());
    return { wrap, dots };
  }

  function paintDots(dots) {
    dots.textContent = KEYS.length
      ? '•'.repeat(entry.length) + '–'.repeat(Math.max(0, CODE.length - entry.length))
      : '';
  }

  function press(k, dots) {
    entry += k;
    // Compare only as far as the player has typed. A wrong digit resets
    // immediately rather than letting them finish and then failing -- the
    // feedback is the dots snapping back to empty.
    if (CODE.indexOf(entry) !== 0) entry = '';
    paintDots(dots);
    if (entry === CODE) {
      closePad();
      onUnlock();
    }
  }

  function openPad() {
    if (pad) return;
    entry = '';
    const built = buildPad();
    pad = built.wrap;
    paintDots(built.dots);
    doc.body.appendChild(pad);
  }

  function closePad() {
    if (!pad) return;
    pad.remove();
    pad = null;
    entry = '';
  }

  // --- the long press -----------------------------------------------------

  const start = () => {
    if (pad) return;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(openPad, HOLD_MS);
    target.classList.add('devhold');
  };
  const cancel = () => {
    clearTimeout(holdTimer);
    holdTimer = null;
    target.classList.remove('devhold');
  };

  target.addEventListener('pointerdown', start);
  // Every way a press can end, including the pointer leaving the element and
  // the browser cancelling it (a scroll gesture, a system dialog). A missed
  // cancel would leave the timer armed and pop the pad up minutes later.
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) =>
    target.addEventListener(ev, cancel)
  );

  return { open: openPad, close: closePad };
}
