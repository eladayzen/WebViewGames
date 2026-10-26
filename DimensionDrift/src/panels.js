// The two panels: a gear for players, a wrench for us.
//
// The separation is the point, and it was nearly got wrong here — carve shipped
// a chrome row with no gear at all and a developer overlay reachable by tapping
// the build stamp, which is exactly backwards. See web_games/CHROME.md "Two
// panels, not one" and WebViewGames/pipeline/build-docs/Trenchlight.md §7.9.
//
//   THE GEAR is anything a player could reasonably want to change about how the
//   game plays for them. Nearly empty by design.
//
//   THE WRENCH is anything that skips content, removes a failure condition, or
//   only makes sense to someone who has read the source. It is unreachable
//   without a seven-second hold and a four-digit code (`devUnlock.js`).
//
// ── WHAT DID NOT PORT FROM THE TEMPLATE, AND WHY ────────────────────────────
// `NovaVanguard/src/ui/settingsPanel.js` is meant to be lifted verbatim and the
// SOUND section below is lifted faithfully — same two separate rows, same
// paint-from-getter, same repaint-every-row-on-open.
//
// ITS SENSITIVITY SECTION IS NOT HERE, and that is deliberate rather than an
// omission. The template drives `GoBalance.setSensitivity(0..100)`, which is
// applied on the Unity side to the board reading before the page sees it. On
// Bobo there is no such call: sensitivity is `settings.maxAngleDeg`, it arrives
// from the host (BRIDGE.md §5), and carve's README is emphatic that a preset
// changes how far the player leans to reach full deflection and must never
// scale the turn rate — "the radius of a carve [would become] a property of the
// patient rather than of the mountain". A second owner of that number in this
// panel is precisely the compounding the template's own header warns about.
//
// So on this pipeline the gear is SOUND only. When the GoBalance branch lands,
// the sensitivity section comes back with it, because there the host offers no
// settings at all and this panel is the only place it can live.
//
// ── AND ONE THING THE DOCS DO NOT SETTLE ───────────────────────────────────
// On Bobo the HOST already owns the mute switches: it sends `settings` and the
// game applies them (BRIDGE.md §4.1). There is no game-to-host direction for
// it, so a player's choice here cannot be told to the host, and a later
// `settings` message will overwrite it. That is the behaviour implemented —
// host wins, because the host is the outer authority — and it is written down
// here rather than discovered later. It wants reconciling once for both games.

/** Rows are painted from the getter, never from a remembered value. */
function soundRow(doc, label, get, set, painters) {
  const row = doc.createElement('button');
  row.type = 'button';
  row.className = 'panel-row panel-toggle';
  const name = doc.createElement('span');
  name.textContent = label;
  const state = doc.createElement('span');
  state.className = 'panel-state';
  row.append(name, state);
  const paint = () => {
    const on = !!get();
    state.textContent = on ? 'on' : 'off';
    row.classList.toggle('is-on', on);
    row.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  row.addEventListener('click', (e) => {
    e.stopPropagation();
    set(!get());
    painters.forEach((fn) => fn());
  });
  painters.push(paint);
  paint();
  return row;
}

/**
 * The gear panel.
 *
 * @param {Document} doc
 * @param {{isMusicOn:Function,setMusicOn:Function,isSfxOn:Function,setSfxOn:Function}} audio
 *   The game's audio layer as HOOKS, so this file never learns which audio
 *   module carve has — the template's contract, kept.
 */
export function createSettingsPanel(doc, audio, host, hooks = {}) {
  const panel = doc.createElement('div');
  panel.className = 'panel panel-settings';
  panel.hidden = true;

  const head = doc.createElement('div');
  head.className = 'panel-head';
  head.textContent = 'sound';
  panel.appendChild(head);

  const painters = [];
  if (typeof audio?.isMusicOn === 'function') {
    panel.appendChild(soundRow(doc, 'music', audio.isMusicOn, audio.setMusicOn, painters));
  }
  if (typeof audio?.isSfxOn === 'function') {
    // MUSIC AND EFFECTS STAY SEPARATE, from the template: they are separately
    // wanted — people want the game's feedback while listening to their own
    // music — and an all-or-nothing switch gets the whole game silenced by
    // anyone who dislikes its soundtrack.
    panel.appendChild(soundRow(doc, 'sound effects', audio.isSfxOn, audio.setSfxOn, painters));
  }

  // CLOSE IS THE LAST ROW, and the panel is height-capped in CSS so it can never
  // be pushed off the bottom. On a board there is no Escape key and no second
  // pointer, so a close row below the fold is a trapped player (CHROME.md).
  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'panel-row panel-close';
  close.textContent = 'close';
  panel.appendChild(close);

  const setOpen = (open) => {
    const was = !panel.hidden;
    // REPAINT EVERY ROW ON OPEN — a stale switch is worse than no switch. The
    // host can change these behind our back at any moment via `settings`.
    if (open) painters.forEach((fn) => fn());
    panel.hidden = !open;
    // ONLY ON A REAL CHANGE. The caller stops the run off this, and setOpen is
    // called with the state it is already in from more than one place; firing
    // every time would pause a paused game and resume one nobody asked to.
    if (open !== was) hooks.onToggle?.(open);
  };
  // ── CALIBRATE, ABOVE CLOSE ──────────────────────────────────────────────
  // IT USED TO ASK THE PLATFORM, through `host.calibrate()`, on the reasoning
  // that the max angle belongs to the host and the game can only request a
  // change to it. True, and it made the row DEAD EVERYWHERE THERE IS NO APP:
  // in a browser the message goes into a bridge nobody is listening to and the
  // button does nothing at all, which is exactly how it was reported --
  // "when I click calibrate your lane nothing happens".
  //
  // The measurement now lives in web (`shared/bobo-ui/calibrate.js`) because
  // only streaming assets migrate to GoBalance, which has no Flutter layer. So
  // the row calls back into the game, which owns both the wizard and the pause.
  //
  // Built here rather than beside the sound rows because it needs `setOpen`,
  // and INSERTED BEFORE the close row so close stays last: on a board there is
  // no Escape key, and a close row pushed down the list is a trapped player
  // (CHROME.md).
  //
  // Guarded on the host actually offering it, so a build running against an
  // older platform shows a panel without a dead row in it.
  if (typeof hooks.onCalibrate === 'function') {
    const cal = doc.createElement('button');
    cal.type = 'button';
    cal.className = 'panel-row';
    cal.textContent = 'calibrate your lean';
    // The panel is NOT closed here. Closing it is what resumes the run, and the
    // run must stay stopped while the wizard is up -- it widens the tilt gamut
    // to 45 degrees to take the measurement. The caller closes it itself, in
    // the order that keeps the pause.
    cal.addEventListener('click', (e) => {
      e.stopPropagation();
      hooks.onCalibrate();
    });
    panel.insertBefore(cal, close);
  }

  // SPLIT FROM THE CALIBRATE GUARD above (they used to share one if-block):
  // the one-menu rework keeps calibration as the menu's own row and passes no
  // onCalibrate hook, which silently took the angle row down with it -- calqa
  // caught the max-tilt row gone. The number answers to getMaxAngle alone.
  if (typeof hooks.getMaxAngle === 'function') {
    // ── THE NUMBER THE CALIBRATION PRODUCED ────────────────────────────────
    // Measured and then invisible was the complaint: the wizard reported a
    // reach, applied it, and nothing anywhere would tell you what the board was
    // now set to. This row is that number, and it is also the manual override
    // for a player who would rather type than lean.
    //
    // REPAINTED FROM `getMaxAngle`, NEVER FROM THE VALUE JUST REQUESTED. The
    // authority is the pipeline, not this row: it clamps, and on a device-wide
    // host another game may have moved it since. Showing the request back
    // would make a rejected value look accepted.
    const angle = doc.createElement('div');
    angle.className = 'panel-row panel-step';
    const aName = doc.createElement('span');
    aName.className = 'panel-step-label';
    aName.textContent = 'max tilt angle';
    const aMinus = doc.createElement('button');
    aMinus.type = 'button';
    aMinus.className = 'panel-step-btn';
    aMinus.textContent = '\u2212';
    const aVal = doc.createElement('span');
    aVal.className = 'panel-step-value';
    const aPlus = doc.createElement('button');
    aPlus.type = 'button';
    aPlus.className = 'panel-step-btn';
    aPlus.textContent = '+';
    angle.append(aName, aMinus, aVal, aPlus);

    const note = doc.createElement('div');
    note.className = 'panel-note';
    note.textContent = 'how far you lean for full steering';

    // ── THE INTENT GATE ────────────────────────────────────────────────────
    // A manual edit right after a calibration is almost always a misread of
    // what the row is for, so the first press explains rather than applies. It
    // is deliberately NOT the 6-30 plausibility bound: that one judges a
    // MEASUREMENT, and a deliberate edit is not a measurement -- only the
    // pipeline's own limits apply here. (BOARD_SENSITIVITY.md rev 2.)
    const GUARD_MS = 15000;   // how long a fresh calibration is protected
    const CONFIRM_MS = 4000;  // how long the "press again" offer stands
    let armed = 0;
    let armTimer = 0;

    const paintAngle = () => {
      const v = hooks.getMaxAngle?.();
      aVal.textContent = Number.isFinite(v) ? `${Math.round(v)}\u00b0` : '\u2026';
    };
    const disarm = () => {
      armed = 0;
      clearTimeout(armTimer);
      note.classList.remove('is-warn');
      note.textContent = 'how far you lean for full steering';
    };
    const nudgeAngle = (d) => (e) => {
      e.stopPropagation();
      const fresh = (hooks.msSinceCalibration?.() ?? Infinity) < GUARD_MS;
      const now = Date.now();
      if (fresh && !(armed && now - armed < CONFIRM_MS)) {
        armed = now;
        note.classList.add('is-warn');
        note.textContent = 'you just calibrated \u2014 press again to change anyway';
        clearTimeout(armTimer);
        armTimer = setTimeout(disarm, CONFIRM_MS);
        return;
      }
      disarm();
      hooks.setMaxAngle?.(d);
      paintAngle();
    };
    aMinus.addEventListener('click', nudgeAngle(-1));
    aPlus.addEventListener('click', nudgeAngle(1));
    // ── TWO BOARDS, TWO NUMBERS ───────────────────────────────────────────
    // The stepper above edits the GLOBAL reach, which is player one's and the
    // only one that persists. Player two's is session-only and seat-scoped and
    // lives on the bridge, so without this block the screen showed one number
    // for two people -- and whichever of them calibrated last looked like the
    // winner. Reported from a device on 2026-10-15. Nothing was saved wrong;
    // the second value simply had nowhere to appear.
    //
    // Labelled with the SCOPE as well as the number, because "saved" and "this
    // session only" is the whole difference between the two seats and a bare
    // pair of degrees would hide it.
    const seats = doc.createElement('div');
    seats.className = 'panel-seats';
    seats.hidden = true;
    // ASYNCHRONOUS, because the seats' values come from the bridge and the
    // bridge answers with a promise. The token guards the obvious race: open,
    // close, open again, and two in-flight reads resolve against one element.
    let seatPaint = 0;
    const paintSeats = () => {
      const token = ++seatPaint;
      Promise.resolve(hooks.getSeats?.()).then((list) => {
        if (token !== seatPaint) return;
        renderSeats(list);
      }).catch(() => { if (token === seatPaint) renderSeats(null); });
    };
    const renderSeats = (list) => {
      seats.hidden = !list;
      if (!list) return;
      seats.textContent = '';
      for (const q of list) {
        const row = doc.createElement('div');
        row.className = 'panel-seat';
        const nm = doc.createElement('span');
        nm.className = 'panel-seat-name';
        nm.textContent = q.label;
        const vv = doc.createElement('span');
        vv.className = 'panel-seat-val';
        // An em dash rather than a 0: a seat that has not calibrated has no
        // number, and printing one would invent a measurement.
        vv.textContent = Number.isFinite(q.deg)
          ? `${Math.round(q.deg)}\u00b0 \u00b7 ${q.scope}`
          : `\u2014 \u00b7 ${q.scope}`;
        row.append(nm, vv);
        seats.appendChild(row);
      }
    };
    painters.push(paintSeats);
    painters.push(paintAngle);
    // Disarmed on every open: a warning left over from a panel closed fifteen
    // minutes ago would turn the next press into a no-op nobody asked for.
    painters.push(disarm);
    // AT THE TOP of the panel, not above the close row: the panel mounts
    // directly under the menu's calibrate button, and Elad wants this number
    // right below that button -- measure, then read what you measured.
    panel.insertBefore(note, panel.firstChild);
    panel.insertBefore(seats, note);
    panel.insertBefore(angle, seats);
  }

  close.addEventListener('click', (e) => { e.stopPropagation(); setOpen(false); });
  panel.addEventListener('click', (e) => e.stopPropagation());

  return { panel, setOpen, isOpen: () => !panel.hidden };
}

/**
 * A live number: label, minus, value, plus.
 *
 * READ THROUGH A GETTER EVERY REPAINT, never from a remembered copy, for the
 * same reason the sound rows are: the game can change these from elsewhere —
 * `CARVE.TUNE` from a console, `debugCam`, a reset — and a stepper showing its
 * own last write instead of the truth is worse than no stepper.
 *
 * The game keeps running while this is open. That is the whole point of putting
 * camera and feel numbers here: the panel sits top-right and the rider sits
 * centre-bottom, so the thing being judged is never behind the thing judging it.
 */
function stepper(doc, label, get, set, step, fmt, painters) {
  const row = doc.createElement('div');
  row.className = 'panel-row panel-step';
  const name = doc.createElement('span');
  name.className = 'panel-step-label';
  name.textContent = label;
  const minus = doc.createElement('button');
  minus.type = 'button';
  minus.className = 'panel-step-btn';
  minus.textContent = '\u2212';
  const val = doc.createElement('span');
  val.className = 'panel-step-value';
  const plus = doc.createElement('button');
  plus.type = 'button';
  plus.className = 'panel-step-btn';
  plus.textContent = '+';
  row.append(name, minus, val, plus);
  const paint = () => { val.textContent = fmt ? fmt(get()) : String(get()); };
  const nudge = (d) => (e) => {
    e.stopPropagation();
    set(get() + d * step);
    painters.forEach((fn) => fn());
  };
  minus.addEventListener('click', nudge(-1));
  plus.addEventListener('click', nudge(1));
  painters.push(paint);
  paint();
  return row;
}

/**
 * The dev panel. Everything here either skips content, removes a failure
 * condition, or only means something to someone reading the source.
 *
 * It renders controls and calls back into the game; it owns no state of its
 * own, so it cannot drift from what the game actually does.
 */
export function createDevPanel(doc, actions) {
  const panel = doc.createElement('div');
  panel.className = 'panel panel-dev';
  panel.hidden = true;

  const head = doc.createElement('div');
  head.className = 'panel-head';
  head.textContent = 'dev tools';
  panel.appendChild(head);

  // ── THE LOG, ON THE SCREEN THAT HAS NO CONSOLE ───────────────────────────
  // The whole reason this panel survives into shipped builds is a player on a
  // board saying "it did something weird": there is no inspector on either
  // platform, so VIEW puts the ring (bobo-ui/logring.js) on the glass itself,
  // selectable and screenshot-able, and SEND pushes it out through the host
  // transport -- on GoBalance that is Unity's log, i.e. adb logcat.
  if (typeof actions.viewLog === 'function') {
    const row = doc.createElement('button');
    row.type = 'button';
    row.className = 'panel-row';
    row.textContent = 'view log';
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      let shade = doc.getElementById('devLogShade');
      if (shade) { shade.remove(); return; }
      shade = doc.createElement('div');
      shade.id = 'devLogShade';
      shade.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(4,6,10,.96);' +
        'overflow:auto;padding:14px;-webkit-user-select:text;user-select:text;';
      const pre = doc.createElement('pre');
      pre.style.cssText = 'margin:0;font:10px/1.5 ui-monospace,monospace;color:#9fe8b0;white-space:pre-wrap;';
      pre.textContent = actions.viewLog();
      const close = doc.createElement('button');
      close.type = 'button';
      close.textContent = 'close';
      close.style.cssText = 'position:fixed;top:10px;right:12px;z-index:10001;padding:8px 18px;' +
        'border-radius:999px;border:1px solid #444;background:#1a2230;color:#eee;font:600 13px system-ui;';
      close.addEventListener('click', () => shade.remove());
      shade.append(close, pre);
      doc.body.appendChild(shade);
      shade.scrollTop = shade.scrollHeight;   // the newest line is the one they came for
    });
    panel.appendChild(row);
  }
  if (typeof actions.sendLog === 'function') {
    const row = doc.createElement('button');
    row.type = 'button';
    row.className = 'panel-row';
    row.textContent = 'send log to host';
    row.addEventListener('click', (e) => { e.stopPropagation(); actions.sendLog(); row.textContent = 'sent \u2713'; });
    panel.appendChild(row);
  }

  const painters = [];

  // The display-path test card -- see main.js at `_testCard` for how to read
  // it. BELOW `painters`, which its row paints through: it sat above once and
  // the TDZ throw took the whole browser boot down with it, because the
  // browser is the one transport that auto-opens this panel at boot.
  if (typeof actions.isTestCardOn === 'function') {
    panel.appendChild(soundRow(doc, 'test card', actions.isTestCardOn, actions.setTestCardOn, painters));
  }

  const toggle = (label, get, set) => {
    const row = soundRow(doc, label, get, set, painters);
    panel.appendChild(row);
  };
  const action = (label, fn) => {
    const row = doc.createElement('button');
    row.type = 'button';
    row.className = 'panel-row';
    row.textContent = label;
    row.addEventListener('click', (e) => { e.stopPropagation(); fn(row); });
    panel.appendChild(row);
    return row;
  };

  toggle('diagnostics overlay', actions.isDiagOn, actions.setDiagOn);
  // Separate from diagnostics: this one is read on the device, at arm's length,
  // while riding. See `_perfText` in main.js for what the numbers mean.
  toggle('perf readout', actions.isPerfOn, actions.setPerfOn);
  toggle('autopilot', actions.isAutopilotOn, actions.setAutopilotOn);

  // ── live numbers ────────────────────────────────────────────────────────
  // The reason this panel is worth having open mid-run. Every one of these is
  // a value that can only honestly be judged while riding, which is why they
  // are steppers here rather than constants edited and rebuilt.
  if (actions.numbers?.length) {
    const head2 = doc.createElement('div');
    head2.className = 'panel-head panel-head-later';
    head2.textContent = 'live';
    panel.appendChild(head2);
    for (const n of actions.numbers) {
      panel.appendChild(stepper(doc, n.label, n.get, n.set, n.step, n.fmt, painters));
    }
    const reset = doc.createElement('button');
    reset.type = 'button';
    reset.className = 'panel-row';
    reset.textContent = 'reset to defaults';
    reset.addEventListener('click', (e) => {
      e.stopPropagation();
      actions.resetNumbers?.();
      painters.forEach((fn) => fn());
    });
    panel.appendChild(reset);
  }

  // LOG EXPORT. Trenchlight §7.9 lists it among the dev panel's contents, and
  // GOBALANCE_Bobo_DoubleFlow.md §3 says why: a board session has no console, so
  // this is the only way anything gets off the device. It is what found the
  // rider's ground-contact chatter, from a machine neither of us could attach a
  // debugger to.
  const cap = action('copy capture', async (row) => {
    const text = actions.capture();
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { ok = false; }
    console.log('[carve] capture\n' + text);
    window.__carveCapture = text;
    row.textContent = ok ? 'copied' : 'in console';
    row.classList.add('is-on');
    clearTimeout(cap._t);
    cap._t = setTimeout(() => {
      row.textContent = 'copy capture';
      row.classList.remove('is-on');
    }, 1600);
  });

  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'panel-row panel-close';
  close.textContent = 'close';
  panel.appendChild(close);

  const setOpen = (open) => {
    if (open) painters.forEach((fn) => fn());
    panel.hidden = !open;
  };
  close.addEventListener('click', (e) => { e.stopPropagation(); setOpen(false); });
  panel.addEventListener('click', (e) => e.stopPropagation());

  return { panel, setOpen, isOpen: () => !panel.hidden };
}
