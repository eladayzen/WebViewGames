/**
 * bobo-ui/calibrate — the guided lean measurement, on the web.
 *
 *   import { openCalibration } from '../shared/bobo-ui/calibrate.js';
 *   const r = await openCalibration({ host, pause: () => game.pause() });
 *
 * ── WHY THIS EXISTS IN WEB AND NOT ONLY IN THE APP ──────────────────────────
 *
 * There is already a calibration screen in Flutter, and it works. It is also
 * unreachable from the place this is going: only STREAMING ASSETS migrate to
 * GoBalance, which is Unity and has no Flutter layer at all. A measurement that
 * lives in the app is a measurement that does not exist on the other platform,
 * so the one that has to survive is this one.
 *
 * It is also the version Elad could not see: "NOT WORKING here on the web on
 * the computer — i want to see the experience you built". The Half Shell
 * session hit the identical report, in nearly the same words, for the identical
 * reason — a wizard that only exists behind real hardware is dead in the
 * environment it is actually reviewed in. So this samples through
 * `host.raw()`, which the dev keyboard input already drives, and works with no
 * board attached.
 *
 * ── THE ONE THING A CALLER MUST NOT GET WRONG ───────────────────────────────
 *
 * `TiltPipeline` clamps radially at `maxAngleDeg` BEFORE publishing `raw`, so
 * sampling at the shipped angle measures the SETTING and not the player: at 12°
 * anyone who can reach 15° reads full deflection and calibrates to 12, which is
 * a result indistinguishable from success. This widens to `WIDEN_DEG` for the
 * duration and restores on every exit — including cancel, including a thrown
 * error. If it did not, an abandoned wizard would leave the player on a 45°
 * gamut, which is the most insensitive board they have ever stood on.
 */

import {
  ReachCalibration,
  degreesFromRaw,
  PHASE,
  WIDEN_DEG,
  DEV_LEAN_DEG,
  MIN_DEG,
  MAX_DEG,
} from '../bobo-host/reach.js';

/** The live board never maps 1:1 to the lean. A literal mapping takes the deck
 *  near edge-on at full reach, which reads as broken rather than as tilted.
 *  Borrowed, with its reasoning, from the Half Shell wizard. */
const VISUAL_MAX_DEG = 32;

/** What the range track spans either side. Wider than anyone leans on purpose:
 *  a scale the player can peg stops telling them anything at exactly the moment
 *  they reach their limit. */
const TRACK_DEG = 22;

const COPY = {
  [PHASE.settle]: ['STAND ON THE BOARD', 'Get comfortable and let it settle.'],
  // THE WHOLE INSTRUCTION IN THE HEADING, and nothing under it. Elad, after
  // the queue landed: "instead of LEAN RIGHT/LEFT write LEAN RIGHT AND HOLD
  // ... and you can remove the small text below it". The hold is the part
  // people were getting wrong -- they leaned, bounced straight back, and the
  // line that told them to hold was the small grey one under a shouted title
  // nobody reads twice. Saying it in the title costs two words; the sub-line
  // then has nothing left to add, so it says nothing. What the lean is DOING
  // is on the hold bar, in colour, where they are already looking.
  [PHASE.right]: ['LEAN RIGHT AND HOLD', ''],
  [PHASE.left]: ['LEAN LEFT AND HOLD', ''],
  [PHASE.done]: ['THAT IS YOUR RANGE', 'Full steering arrives just before the edge, so you do not have to hold it exactly.'],
};

const FAILED = {
  cancelled: ['STOPPED', 'Nothing has changed.'],
  skipped: ['SKIPPED', 'Kept the current setting.'],
  timeout: ['NO READING', 'That side never moved, so nothing was measured. Nothing has changed.'],
  implausible: [
    'NOT A CLEAR READING',
    `The measurement has to land between ${MIN_DEG}° and ${MAX_DEG}°. Nothing has changed — stand on the board and lean as far as is comfortable each way.`,
  ],
  incomplete: ['NOT FINISHED', 'Nothing has changed.'],
};

const CSS = `
/* THE WIZARD IS MODAL, and says so where the host can see it.
   Without this the corner buttons underneath stayed live: a tap on the X
   closed the menu and RESUMED THE RUN while this overlay stayed up, so the
   game was playing, audible, behind an opaque panel -- and before BAL-587
   that panel's own buttons were off the bottom of the screen, which left no
   way out at all. Found by fuzzing the menus, which ended with a wizard
   mounted over a running game. The host hides what it owns (carve dims its
   chrome row); this hides the screens, which every bobo-ui game has. */
body.bcal-open .screen{visibility:hidden}
/* BAL-587: THE BUTTONS MUST ALWAYS BE ON SCREEN.
   This was justify-content:center with no scroll. A centred flex column that
   overflows spills past BOTH ends, so on a short landscape phone the heading
   was cut off the top and the Try again / Exit row sat below the bottom edge
   -- measured at 780x360 as 24px of the row off screen, which is what QA
   reported as "there is no exit button". The auto-margin idiom centres while
   there is room and collapses when there is not, which (unlike
   justify-content:center) leaves the overflow reachable by scrolling. */
.bcal{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;
  align-items:center;justify-content:flex-start;overflow-y:auto;
  gap:1.1rem;padding:6vmin 6vw;
  background:rgba(8,10,14,.93);color:#f2f5f8;
  font-family:Manrope,system-ui,sans-serif;text-align:center}
.bcal>:first-child{margin-top:auto}
.bcal>:last-child{margin-bottom:auto}
/* ── TWO BOARDS, ONE AFTER THE OTHER (BAL-597, reworked) ──────────────────
   The first version split the screen and had both players measure AT ONCE,
   each in the half they would race in. It was clever and it did not survive
   contact: neither player could be told what to do without talking over the
   other, and a half-height panel had to be cut down so far to fit a board,
   two lines of copy, a track, a hold bar and two buttons that its buttons
   once fell off the bottom (BAL-587, a 390px-tall phone).
   Elad, after watching people use it: "instead of dividing the screen we need
   to do it in several phases."
   So the seats queue, and a phase is just an ordinary full-screen .bcal --
   the same wizard a single player gets, with all of its room and all of its
   rules. That is why there is almost no CSS here: .bcal is position:fixed and
   sizes itself, so the container only has to not exist. */
.bcal-seq{display:contents}
/* WHOSE TURN IT IS. Said on every phase, because with the players queued
   rather than side by side nothing else on screen identifies the board in
   front of you. */
.bcal-seat{display:flex;flex-direction:column;align-items:center;gap:.15rem;
  margin:0 0 .2rem}
.bcal-seat b{font-size:clamp(.58rem,1.7vw,.74rem);font-weight:800;
  letter-spacing:.2em;text-transform:uppercase;opacity:.6}
.bcal-seat span{font-size:clamp(1rem,3.4vw,1.5rem);font-weight:800;
  letter-spacing:.04em;max-width:72vw;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.bcal-who{display:flex;align-items:center;gap:.5rem;max-width:86vw}
/* THE SAME BADGE THE COUNTDOWN SHOWS, in the same colour. Elad: "use the icon
   of the name with the red/teal color next to the name". A player answers "is
   this me?" by colour long before they have read a word, and carve has already
   taught them which colour they are -- their rider, their half's chrome and
   their name card all carry it. The wizard borrowing the badge means the
   calibration is not a separate place with its own rules.
   The tint arrives per seat (icon/tint on the spec); with neither, the
   badge is simply not built and the header is what it was. */
.bcal-av{display:flex;align-items:center;justify-content:center;
  width:2.1em;height:2.1em;border-radius:.45em;flex:none;font-style:normal;
  font-size:clamp(.72rem,2.1vw,.95rem);font-weight:800;letter-spacing:.03em;
  color:#0b0f18;background:var(--bcal-tint,#fff);
  border:2px solid rgba(255,255,255,.92);box-shadow:0 3px 12px rgba(0,0,0,.5)}
/* ── THE SUM-UP ───────────────────────────────────────────────────────────
   "in the end show both players and their current calibration value sum up".
   One row per player: who, what their board now reads, and whether that is
   new. A skipped player still shows a number -- theirs -- because a blank
   there would read as something having gone wrong. */
.bcal-sum{display:flex;flex-direction:column;gap:.5rem;width:min(30rem,86vw)}
.bcal-sum-row{display:grid;grid-template-columns:1fr auto auto;
  align-items:baseline;gap:.9rem;padding:.6rem .9rem;border-radius:.7rem;
  background:rgba(255,255,255,.07)}
.bcal-sum-row.has-av{grid-template-columns:auto 1fr auto auto}
.bcal-sum-row b{font-size:clamp(.85rem,2.6vw,1.05rem);font-weight:800;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
.bcal-sum-row span{font-size:clamp(1.1rem,3.6vw,1.6rem);font-weight:800;
  font-variant-numeric:tabular-nums}
.bcal-sum-row i{font-style:normal;font-size:clamp(.56rem,1.7vw,.7rem);
  letter-spacing:.14em;text-transform:uppercase;opacity:.55;min-width:7.5em;
  text-align:right}
/* And on a short screen it should not need scrolling at all: the board and
   the type give up height before the controls do. */
@media (max-height:470px){
  .bcal{gap:.42rem;padding:2.2vmin 5vw}
  .bcal-h{font-size:clamp(1rem,3.6vw,1.45rem)}
  .bcal-p{font-size:clamp(.75rem,2.1vw,.9rem);line-height:1.3}
  .bcal-stage{height:clamp(44px,12vh,88px)}
  .bcal-board{height:clamp(30px,7vh,50px)}
  .bcal-deg{font-size:clamp(1.3rem,4.6vw,1.9rem)}
  .bcal button{padding:.55em 1.25em}
}
.bcal-h{font-size:clamp(1.3rem,5vw,2.1rem);font-weight:800;letter-spacing:.06em;margin:0}
.bcal-p{font-size:clamp(.85rem,2.6vw,1rem);opacity:.75;margin:0;max-width:34ch;line-height:1.45}
.bcal-stage{perspective:380px;height:clamp(90px,22vh,170px);display:flex;
  align-items:center;justify-content:center;width:min(78vw,420px)}
.bcal-board{width:100%;height:clamp(52px,12vh,86px);border-radius:14px;
  background:linear-gradient(180deg,#3a4250,#232a34);
  border:1px solid rgba(255,255,255,.14);
  box-shadow:0 18px 34px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.18);
  display:flex;align-items:center;justify-content:center;
  transition:transform 90ms linear;will-change:transform}
.bcal-dot{width:22%;aspect-ratio:1.55;border-radius:999px;
  background:radial-gradient(circle at 42% 36%,#59626f,#1b2129);
  border:1px solid rgba(255,255,255,.1)}
.bcal-track{position:relative;width:min(78vw,420px);height:10px;border-radius:999px;
  background:rgba(255,255,255,.12)}
.bcal-span{position:absolute;top:0;height:10px;border-radius:999px;background:rgba(167,139,250,.45)}
.bcal-live{position:absolute;top:50%;width:20px;height:20px;border-radius:50%;
  background:#a78bfa;transform:translate(-50%,-50%);box-shadow:0 0 14px rgba(167,139,250,.6)}
.bcal-mid{position:absolute;left:50%;top:-7px;width:2px;height:24px;background:rgba(255,255,255,.28)}
.bcal-deg{font-size:clamp(1.8rem,7vw,3rem);font-weight:800;margin:0;letter-spacing:.02em}
.bcal-row{display:flex;gap:.7rem;flex-wrap:wrap;justify-content:center}
.bcal button{font:inherit;font-weight:700;letter-spacing:.04em;border-radius:999px;
  padding:.72em 1.6em;border:1px solid rgba(255,255,255,.22);cursor:pointer;
  background:rgba(255,255,255,.08);color:#f2f5f8}
.bcal button[disabled]{opacity:.35;cursor:default}
.bcal .bcal-go{background:#7c5cf0;border-color:#7c5cf0;color:#fff}
.bcal-hold{width:min(60vw,260px);height:5px;border-radius:999px;background:rgba(255,255,255,.14);overflow:hidden}
.bcal-hold i{display:block;height:100%;width:0;background:#a78bfa;transition:width 90ms linear}
.bcal-hold[data-state="done"] i{background:#4ade80}
.bcal-hold[data-state="travel"] i{background:#fbbf24}
.bcal-board[data-state="travel"]{border-color:rgba(251,191,36,.85);
  box-shadow:0 18px 34px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.18),0 0 0 2px rgba(251,191,36,.35)}
.bcal-board[data-state="counting"]{border-color:rgba(167,139,250,.85);
  box-shadow:0 18px 34px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.18),0 0 0 2px rgba(167,139,250,.35)}
.bcal-board[data-state="done"]{border-color:rgba(74,222,128,.9);
  box-shadow:0 18px 34px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.18),0 0 0 2px rgba(74,222,128,.45)}
@media (prefers-reduced-motion:reduce){.bcal-board,.bcal-hold i{transition:none}}
`;

let styled = false;
function ensureStyle(doc) {
  // Injected rather than added to `base.css`, which install.mjs COPIES into each
  // game's output and stamps for cache-busting. A stale copy of that stylesheet
  // has already cost this project two rounds of "nothing changed"; a wizard that
  // renders unstyled because a game rebuilt its JS and not its CSS is the same
  // failure with a worse blast radius.
  if (styled) return;
  const el = doc.createElement('style');
  el.textContent = CSS;
  doc.head.appendChild(el);
  styled = true;
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Run the wizard. Resolves `{ ok, deg, reason }` — never throws for a refusal,
 * and never resolves `ok` with a number that has not passed `result()`'s gate.
 *
 * @param {object}   o
 * @param {object}   o.host      a live BoboHost
 * @param {Function} [o.pause]   called on open; its return value, if a function,
 *                               is called on close. A game that is mid-run must
 *                               not keep running behind this — the player is
 *                               about to lean as far as they physically can.
 * @param {Function} [o.onApply] given the measured degrees when one is accepted,
 *                               for a caller that wants to persist it. The
 *                               session value is applied here either way.
 * @param {Document} [o.doc]
 */
export function openCalibration({
  host, pause, onApply, doc = document, boardArt = null, seats = null,
} = {}) {
  ensureStyle(doc);

  // ── ONE SEAT, OR TWO STACKED (BAL-597) ─────────────────────────────────
  // `seats` is how a two-player caller asks for both boards at once: one
  // entry per player, each saying which input slot to read and HOW TO WRITE
  // its result. The writing differs per seat and the difference is not this
  // file's business -- player one's reach persists app-wide while player
  // two's is session-only and seat-scoped -- so a caller hands in `widen`,
  // `restore` and `commit`, and this module keeps knowing nothing about any
  // particular host's seat API.
  //
  // Omitted, it is exactly one seat on slot 0 writing the way it always has,
  // which is every existing caller and every other game.
  const DEFAULT_SEAT = {
    slot: 0,
    label: null,
    widen: () => host.setMaxAngle(WIDEN_DEG),
    restore: (prev) => { if (prev != null) host.setMaxAngle(prev); },
    commit: (deg) => (host.persistMaxAngle ?? host.setMaxAngle).call(host, deg),
  };
  const specs = (seats?.length ? seats : [DEFAULT_SEAT]).map((q) => ({ ...DEFAULT_SEAT, ...q }));
  const split = specs.length > 1;

  let resume = null;
  let raf = 0;

  const el = (tag, cls, text) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /**
   * A player's name wearing their badge, or just their name.
   *
   * The badge is the countdown card's: their initials on their own colour.
   * It is built from what the caller passes and nothing else -- this file has
   * no idea who player one is, and should not acquire one.
   */
  const nameWithBadge = (spec) => {
    const who = el('div', 'bcal-who');
    if (spec.icon) {
      const av = el('em', 'bcal-av', spec.icon);
      if (spec.tint) av.style.setProperty('--bcal-tint', spec.tint);
      who.appendChild(av);
    }
    who.appendChild(el('span', null, spec.label));
    return who;
  };

  /**
   * One player's wizard: its own panel, its own measurement, its own widen
   * and its own ending. Everything that was a single `const` in this function
   * lives here instead, so two of them can run side by side without sharing a
   * single variable -- the bug this shape exists to make impossible.
   */
  function makeSeat(spec, onSettled) {
    let cal = new ReachCalibration();
    // A SEAT'S PREVIOUS VALUE MAY ARRIVE LATE. The GoBalance bridge answers
    // getMaxAngle with a PROMISE of {value, default, min, max}, and a promise
    // is never nullish -- so the old one-liner took the promise itself as the
    // value and handed that object to restore() on the way out. Player two's
    // reach was being restored from garbage on device.
    //
    // Seeded synchronously from the host so there is always something sane to
    // give back, then replaced when the seat's own answer lands. restore()
    // runs on exit, seconds later, and reads this at call time.
    let before = host?.settings?.maxAngleDeg ?? host?.tilt?.maxAngleDeg ?? null;
    Promise.resolve(spec.read?.())
      .then((v) => { if (Number.isFinite(v)) before = v; })
      .catch(() => { /* no value for this seat; the host's stands */ });
    let settled = false;
    let widened = false;
    let outcome = null;

    const root = el('div', 'bcal');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    const h = el('h2', 'bcal-h');
    const p = el('p', 'bcal-p');
    const stage = el('div', 'bcal-stage');
    const board = el('div', 'bcal-board');
    let footL = null;
    let footR = null;
    if (boardArt) {
      // ── THE GOBALANCE BOARD, HSH'S WAY ──────────────────────────────────────
      // Elad: "the actual asset of the GoBalance looks different. You have
      // something very narrow -- I would like to use our asset. Look at how it
      // does it with the feet: the feet are highlighted." The reference
      // (HalfShellHustle's calibrationWizard) draws gobalance_horizontal_board
      // and highlights each foot with THE SAME IMAGE clipped to an ellipse over
      // that foot -- no second asset, just clip-path + brightness. Ported whole.
      board.classList.add('is-art');
      const img = el('img', 'bcal-gb');
      img.src = boardArt;
      img.alt = '';
      footL = el('div', 'bcal-gbfoot bcal-gbfoot-left');
      footR = el('div', 'bcal-gbfoot bcal-gbfoot-right');
      footL.style.backgroundImage = `url(${boardArt})`;
      footR.style.backgroundImage = `url(${boardArt})`;
      board.append(img, footL, footR);
    } else {
      board.appendChild(el('div', 'bcal-dot'));
    }
    stage.appendChild(board);
    const track = el('div', 'bcal-track');
    const span = el('div', 'bcal-span');
    const live = el('div', 'bcal-live');
    track.append(span, el('div', 'bcal-mid'), live);
    const hold = el('div', 'bcal-hold');
    const holdBar = el('i');
    hold.appendChild(holdBar);
    const deg = el('p', 'bcal-deg');
    deg.hidden = true;
    const row = el('div', 'bcal-row');
    const go = el('button', 'bcal-go', 'Next');
    // SKIP, NOT CANCEL, when the seats run one after another. Elad: "always
    // allow to skip". In a queue the second button cannot mean "abandon
    // everything" -- the next player has not had their turn yet -- so it
    // means "this player keeps what they have, move on". The way out of the
    // WHOLE wizard is the chrome X, which stays live throughout.
    const cancel = el('button', null, spec.skippable ? 'Skip' : 'Cancel');
    row.append(go, cancel);
    root.append(h, p, stage, track, hold, deg, row);
    if (spec.label) {
      // WHOSE TURN IT IS, said on every phase. Elad: "always show which
      // player we are calibrating now". With the seats queued rather than
      // side by side, nothing else on screen says whose board this is -- the
      // other player is not visible to compare against.
      const seat = el('div', 'bcal-seat');
      if (spec.phase) seat.appendChild(el('b', null, spec.phase));
      seat.appendChild(nameWithBadge(spec));
      // PREPENDED, not appended. Below the buttons it is a footnote; this
      // line is the first thing a player needs -- is this me? -- so it goes
      // where the eye lands, above the instruction.
      root.prepend(seat);
    }

    function settle(res) {
      if (settled) return;
      settled = true;
      outcome = res;
      // RESTORE FIRST, and on every path. The widen is a borrowed setting, not
      // a new one, and the one outcome worse than a failed calibration is a
      // cancelled one that leaves the board on a 45-degree gamut. Only if we
      // actually widened: a seat that settles before its first frame has
      // nothing to give back, and handing `before` to a seat-scoped setter
      // that was never touched would write a value nobody asked for.
      if (widened) spec.restore(before);
      if (res.ok) {
        // THE FINAL COMMIT (doc step 7; Elad 2026-10-05: a result behaves like
        // the native calibration's). For player one that persists app-wide;
        // for a guest seat it is session-only and seat-scoped. Which of those
        // it is, is the caller's to say -- see `seats`.
        spec.commit(res.deg);
        onApply?.(res.deg, spec.slot);
      }
      render();
      onSettled();
    }

    function render() {
      // A SETTLED SEAT STOPS ASKING FOR ANYTHING. In a split, one player can
      // be done while the other is still leaning, and the finished half must
      // not keep offering buttons -- it says its number and waits.
      if (settled) {
        row.hidden = true;
        hold.hidden = true;
        h.textContent = outcome?.ok ? 'Ready' : (FAILED[outcome?.reason]?.[0] ?? 'Cancelled');
        p.textContent = outcome?.ok ? 'Waiting for the other board\u2026' : '';
        return;
      }
      const aborted = cal.phase === PHASE.failed;
      const finished = cal.phase === PHASE.done;
      // THE WORDING COMES FROM THE GATE, NOT FROM THE PHASE. Reaching `done`
      // means both sides were held; it does NOT mean the measurement is usable.
      // Keying the copy off the phase printed "THAT IS YOUR RANGE" over a 4.6°
      // reach that `result()` had already refused — the button said "Try again"
      // while the heading congratulated them. One source of truth, and it is
      // the same call that decides whether a number may leave at all.
      const res = aborted || finished ? cal.result() : null;
      const bad = !!res && !res.ok;
      const [title, sub] = bad
        ? (FAILED[res.reason] ?? FAILED.incomplete)
        : COPY[cal.phase];
      h.textContent = title;
      p.textContent = sub;
      // AN EMPTY LINE STILL COSTS A GAP. The panel is a flex column with a
      // 1.1rem gap, so a paragraph with nothing in it holds the heading a
      // whole gap away from the board it is talking about. Hidden, the gap
      // goes with it.
      p.hidden = !sub;

      stage.hidden = aborted;
      track.hidden = aborted;
      hold.hidden = aborted || finished;

      board.style.transform =
        `rotateY(${clamp(cal.now / VISUAL_MAX_DEG, -1, 1) * VISUAL_MAX_DEG}deg)`;
      // The moment sampling actually starts has to be visible on the thing the
      // player is already looking at. They are leaning, at the edge of their
      // balance, and asking them to notice a 5px bar somewhere else is asking
      // for the one glance they cannot spare.
      board.dataset.state = hold.dataset.state ?? 'waiting';

      const pos = (d) => 50 + clamp(d / TRACK_DEG, -1, 1) * 50;
      live.style.left = `${pos(cal.now)}%`;
      const l = pos(cal.reachLeft);
      const r = pos(cal.reachRight);
      span.style.left = `${Math.min(l, r)}%`;
      span.style.width = `${Math.abs(r - l)}%`;

      // ── THE HOLD, WHICH IS THE ONLY STEP THAT ASKS FOR NOTHING ──────────
      // This was three fixed widths -- 0, 60, 100 -- which is a state light
      // wearing a progress bar's clothes: it jumped to most-of-the-way the
      // instant the gate opened and then sat there, so the second it was
      // counting looked identical whether one tick or nine had passed. It is
      // now the real elapsed fraction, which is the difference between "it
      // sees me" and "it sees me and here is how much longer".
      // Four states now, because rev 5 of the shared algorithm split "moving"
      // from "measuring": TRAVEL (amber -- keep going) runs from the gate to
      // the plateau, COUNTING (purple) only once the reading has actually
      // arrived. The old copy said "hold it" the moment the gate opened, which
      // told the player the measurement had started while they were still
      // moving -- untrue, and the reason slow and fast leans disagreed.
      hold.dataset.state = cal.held ? 'done'
        : cal.arrived ? 'counting'
        : cal.gateOpen ? 'travel' : 'waiting';
      holdBar.style.width = `${cal.holdProgress * 100}%`;
      if (res) {
        // The number is still shown when the run completed but was refused —
        // "4.6°" under "NOT A CLEAR READING" tells the player what actually
        // happened, where a bare refusal leaves them guessing at it.
        deg.hidden = res.deg == null;
        if (res.deg != null) deg.textContent = `${res.deg.toFixed(1)}°`;
        // "Use this" appears only for a value that has ALREADY passed the gate
        // in result(). There is deliberately no path where a number is shown
        // with a live button and refused afterwards — that is precisely the bug
        // the Flutter screen shipped with.
        go.textContent = res.ok ? 'Use this' : 'Try again';
        go.disabled = false;
        // BAL-587: "Exit", not "Close" -- the refused state offers exactly two
        // roads and they are named for what they do: Try again, or Exit.
        cancel.textContent = spec.skippable ? 'Skip' : (res.ok ? 'Cancel' : 'Exit');
      } else {
        deg.hidden = true;
        go.textContent = 'Next';
        go.disabled = !cal.held;
      }
    }

    go.onclick = () => {
      if (cal.phase === PHASE.done || cal.phase === PHASE.failed) {
        const res = cal.result();
        if (res.ok) return settle(res);
        // "TRY AGAIN" MEANS IT. This used to close the wizard, so the one
        // button offered after a refusal did the opposite of what it said and
        // the player had to find their way back in from the menu -- after a
        // failure, which is the worst moment to ask that. A fresh measurement
        // starts in place; `Close` beside it is the way out.
        cal = new ReachCalibration();
        return render();
      }
      cal.next(performance.now());
      render();
    };
    // CANCEL LEAVES THIS HALF, AND ONLY THIS HALF.
    //
    // It used to close the wizard for both players, and that was right at the
    // time: a seat that cancelled itself left the player sitting in a screen
    // with no way out, chrome inert behind it -- Elad, stuck in exactly that:
    // "we've got to have some bullet proof option to get out of that screen."
    //
    // What makes the narrow behaviour safe now is that the bullet-proof exit
    // exists independently: the wizard publishes __bcalClose and the chrome's
    // X stays live under body.bcal-open, so neither player can be trapped by
    // the other. That guarantee is load-bearing for this change -- if the X
    // ever stops being live while this is open, cancel must go back to
    // closing everything.
    //
    // The reason for the change (Elad, 2026-10-18): one player's calibration
    // is not the other's to throw away. Settling is per-seat and always was --
    // restore() gives back this seat's own previous value and commit() writes
    // this seat's own result -- so a cancelled half now leaves a successful
    // half's value exactly where the successful player put it.
    cancel.onclick = () => settle({
      ok: false, reason: spec.skippable ? 'skipped' : 'cancelled', deg: null,
    });

    function step(t) {
      if (settled) return;
      if (!widened) {
        // Widen only once the loop is actually running, so a caller that throws
        // between construction and the first frame cannot leave it widened.
        spec.widen();
        widened = true;
      }
      if (cal.phase !== PHASE.done && cal.phase !== PHASE.failed) {
        // ── PUMP BEFORE READING ────────────────────────────────────────────
        // `raw` is a getter over whatever the pipeline last computed; it is
        // `input()` that runs the dev keyboard pump. The game calls that from
        // its frame loop -- and the game is PAUSED while this is open, which is
        // the whole point -- so without this line the keyboard feeds nothing
        // and the wizard sits at zero forever on any machine without a board.
        // That is every laptop it gets reviewed on.
        const real = host.live?.(spec.slot);
        if (!real) host.input?.(spec.slot);
        // A full key press is a ratio of 1. Against the widened 45 that reads
        // as a 45 degree lean and is refused as implausible every single time,
        // so the flow could not be completed without hardware. With no board
        // attached it stands for an ordinary lean instead.
        cal.sample(degreesFromRaw(host.raw(spec.slot).x, real ? WIDEN_DEG : DEV_LEAN_DEG), t);
      }
      render();
    }

    render();
    return {
      root,
      step,
      cancel: () => settle({ ok: false, reason: 'cancelled', deg: null }),
      escape: () => { cal.cancel(); render(); },
      get settled() { return settled; },
      get result() { return outcome; },
      // What this player's board is set to NOW: the number they just measured,
      // or the one they already had if they skipped. The summary reports the
      // SETTING, not the session -- a skipped player still has a value, and
      // showing them a blank would read as "yours is missing".
      get current() { return outcome?.ok ? outcome.deg : before; },
      label: spec.label,
      icon: spec.icon,
      tint: spec.tint,
      slot: spec.slot,
    };
  }

  return new Promise((resolve) => {
    let done = false;
    const seatList = [];
    // THE WIZARD PUBLISHES ITS OWN EXIT. A game's chrome (the X in the
    // corner) is inert while this is open, so without a handle on the way out
    // the only exits are inside the dialog -- and on a platform where one of
    // the two halves cannot be driven at all, that was no exit.
    doc.defaultView.__bcalClose = () => closeAll();

    function closeAll() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      doc.removeEventListener('keydown', onKey);
      // EVERY SEAT GIVES ITS WIDEN BACK, including one the player never
      // touched: in a split, cancelling half way through must not leave the
      // other board on a 45-degree gamut.
      //
      // A SEAT THAT ALREADY FINISHED KEEPS ITS VALUE. settle() is idempotent --
      // it returns immediately once settled -- so this neither restores over a
      // committed value nor commits twice. Pressing the X after one player is
      // done takes nothing away from them; only unfinished seats give back.
      for (const seat of seatList) seat.cancel();
      doc.body.classList.remove('bcal-open');
      doc.defaultView.__bcalClose = null;
      if (typeof resume === 'function') resume();
      shell.remove();
      // One seat resolves with its own result, exactly as before. A split
      // resolves with one result per seat, in the order they were asked for.
      resolve(split ? seatList.map((q) => q.result) : seatList[0].result);
    }

    // ── ONE PLAYER AT A TIME ──────────────────────────────────────────────
    // Elad, after watching people use the split version: "instead of dividing
    // the screen we need to do it in several phases". The split asked both
    // players to measure at once on half a screen each, which meant neither
    // could be told what to do without talking over the other, and the panel
    // had to be cut down to fit (see the .bcal-split note in the CSS).
    //
    // Queued, each phase is an ORDINARY full-screen wizard -- the same one a
    // single player gets, with every rule and every pixel of room it has.
    // That is also why this needs no new layout: .bcal is position:fixed and
    // sizes itself, so a phase is just the seat that is currently mounted.
    let active = -1;
    function mount(i) {
      if (active >= 0 && seatList[active]) seatList[active].root.remove();
      active = i;
      if (i >= 0) shell.appendChild(seatList[i].root);
    }
    function advance() {
      const next = seatList.findIndex((q) => !q.settled);
      if (next >= 0) { mount(next); return; }
      mount(-1);
      showSummary();
    }

    function onSettled() {
      if (!split) { if (seatList.every((q) => q.settled)) closeAll(); return; }
      // A phase ends the moment its seat settles, however it settled --
      // measured, refused or skipped. The queue does not care which.
      advance();
    }

    /**
     * BOTH PLAYERS, AND WHAT THEIR BOARDS ARE SET TO.
     *
     * "in the end show both players and their current calibration value sum
     * up". It reports the SETTING rather than the session, so a player who
     * skipped still sees a number -- theirs, unchanged -- instead of a blank
     * that would read as though something had gone wrong.
     */
    function showSummary() {
      const panel = el('div', 'bcal');
      panel.appendChild(el('h2', 'bcal-h', 'READY TO RIDE'));
      panel.appendChild(el('p', 'bcal-p', 'This is how far each board now reads as full lean.'));
      const list = el('div', 'bcal-sum');
      seatList.forEach((seat, i) => {
        const rowEl = el('div', 'bcal-sum-row');
        // Same badge as the phase header, so a row is matched to the player it
        // belongs to by colour rather than by reading two names in a list.
        if (seat.icon) {
          const av = el('em', 'bcal-av', seat.icon);
          if (seat.tint) av.style.setProperty('--bcal-tint', seat.tint);
          rowEl.appendChild(av);
          rowEl.classList.add('has-av');
        }
        rowEl.appendChild(el('b', null, seat.label ?? `Player ${i + 1}`));
        const v = seat.current;
        rowEl.appendChild(el('span', null,
          Number.isFinite(v) ? `${Math.round(v)}\u00b0` : '\u2014'));
        rowEl.appendChild(el('i', null, seat.result?.ok ? 'just measured' : 'unchanged'));
        list.appendChild(rowEl);
      });
      panel.appendChild(list);
      const rowEl = el('div', 'bcal-row');
      const done = el('button', 'bcal-go', 'Start riding');
      done.onclick = () => closeAll();
      rowEl.appendChild(done);
      panel.appendChild(rowEl);
      summary = panel;
      shell.appendChild(panel);
    }

    function onKey(e) {
      // Escape and Enter belong to nobody in particular once there are two
      // panels, so Escape abandons the whole wizard rather than guessing at a
      // half. A split is driven by the two boards, not the keyboard.
      if (e.key === 'Escape') {
        if (split) closeAll();
        else { seatList[0].escape(); }
      }
    }

    for (const spec of specs) seatList.push(makeSeat(spec, onSettled));

    let summary = null;
    const shell = split ? el('div', 'bcal-seq') : seatList[0].root;

    function tick() {
      // THE GUARD IS THE STOP, NOT cancelAnimationFrame. GoBalance's rAF shim
      // (GOBALANCE_SDK.md) queues callbacks for Unity to pump and makes
      // cancelAnimationFrame a NO-OP -- so on that platform the cancel in
      // `closeAll` cancels nothing and this loop would tick forever against a
      // dismantled overlay. The flag is the contract; the cancel is merely a
      // courtesy to browsers where it works.
      if (done) return;
      raf = requestAnimationFrame(tick);
      const t = performance.now();
      // ONLY THE SEAT ON SCREEN. step() is what widens a board to 45 degrees,
      // so stepping a queued seat would widen a board whose turn has not come
      // -- and that player would be riding a stretched gamut while they
      // watched somebody else calibrate.
      if (split) { if (active >= 0) seatList[active].step(t); return; }
      for (const seat of seatList) seat.step(t);
    }

    // The pause screen's bright buttons read through the 93% backdrop (measured:
    // they are the brightest thing on the page). Hidden VISUALLY while the
    // wizard owns the screen -- body[data-state] stays untouched, so the run's
    // paused state keeps telling the truth to everything that reads it.
    doc.body.classList.add('bcal-open');
    doc.body.appendChild(shell);
    if (split) advance();          // mounts the first phase
    doc.addEventListener('keydown', onKey);
    resume = pause?.();
    raf = requestAnimationFrame(tick);
  });
}

export default openCalibration;
