// The mission panel: clock plus checklist, and the feedback that makes it feel
// like something is happening.
//
// Driven entirely by whatever the active mode's `panel()` returns, and hidden
// when that is null. So a mode with no objectives costs nothing here, and this
// file never needs to know which modes exist.
//
// FEEDBACK IS THE POINT OF THIS FILE, not decoration. A checklist that silently
// changes 3/6 to 4/6 while the player is looking at the road is a checklist they
// never see move. Every change therefore announces itself: the counter kicks, a
// completed line snaps shut with a tick, and the last ten seconds of the clock
// pulse once per second. The rule throughout is that effects fire on EDGES --
// the frame a value actually changed -- never on a condition that stays true,
// which would restart the animation every frame and freeze it on frame one.

import { iconFor } from './propIcons.js';

export function createObjectives() {
  const root = document.getElementById('objectives');
  const titleEl = document.getElementById('obj-title');
  const fillEl = document.getElementById('obj-clock-fill');
  const timeEl = document.getElementById('obj-time');
  const listEl = document.getElementById('obj-list');

  let signature = '';
  /** @type {HTMLElement[]} */
  let rows = [];
  /** Last frame's values, so a change can be detected rather than a state. */
  let prev = [];
  let prevSecond = -1;
  let prevMeterText = null;
  let reported = false;

  /**
   * Report the panel's real geometry once per run, through the SDK bridge.
   *
   * There is no console on the board, so a HUD that does not appear there and
   * does appear in a browser is otherwise pure guesswork -- this turns the next
   * device run into data: whether the element is being shown at all, where it
   * actually is, how big it resolved to, and what font-size it inherited. Silent
   * in a browser, since window.Unity only exists inside the WebView.
   */
  function reportOnce() {
    if (reported || !window.Unity) return;
    reported = true;
    try {
      const r = root.getBoundingClientRect();
      const cs = getComputedStyle(root);
      window.Unity.call(
        `HUD objectives: ${Math.round(r.left)},${Math.round(r.top)} `
        + `${Math.round(r.width)}x${Math.round(r.height)} `
        + `font=${cs.fontSize} vis=${cs.visibility} op=${cs.opacity} `
        + `disp=${cs.display} vp=${window.innerWidth}x${window.innerHeight}`,
      );
    } catch (e) { /* a diagnostic must never be the thing that breaks */ }
  }

  function retrigger(node, cls) {
    if (!node) return;
    node.classList.remove(cls);
    void node.offsetWidth; // force a reflow so the animation restarts
    node.classList.add(cls);
  }

  function rebuild(objectives) {
    listEl.innerHTML = '';
    rows = objectives.map((o) => {
      const li = document.createElement('li');
      /**
       * THE SAME ICON AS THE BRIEFING CARD. Amit: "maybe add them in the left
       * counter UI panel as well."
       *
       * Which closes the loop the card opens. The card teaches "this shape is
       * what you are after"; the panel is what the player glances at for the
       * rest of the run, and it was still describing that thing in words only.
       * Using the same drawing in both places means the lesson survives the
       * three seconds after the card closes -- and a glance at the corner
       * becomes a shape-match rather than a read.
       *
       * Beside the COUNT, for the same reason as the card: the icon and the
       * number are one statement, and a glance should not have to join them up
       * across the width of the panel.
       */
      const icon = o.kind ? iconFor(o.kind, o.type) : '';
      // A row may carry a NOTE -- one line under it, for something the label
      // cannot say. Only the banked-mission row uses it today: "you already
      // have this, X to finish", which a player has no other way to learn.
      if (o.note) li.classList.add('has-note');
      li.innerHTML = `<span class="obj-label">${o.label}</span>`
        + `${icon ? `<i class="obj-icon">${icon}</i>` : ''}`
        + `<b class="obj-count"></b>`
        + (o.note ? `<small class="obj-note">${o.note}</small>` : '');
      listEl.appendChild(li);
      return li;
    });
    prev = objectives.map(() => ({ text: null, done: false }));
    // No entrance animation -- see the CSS. The panel is simply there.
  }

  return {
    update(panel) {
      if (!panel) {
        root.classList.add('hidden');
        signature = '';
        prevSecond = -1;
        prevMeterText = null;
        return;
      }
      root.classList.remove('hidden');
      // Defensive: the briefing hides this panel while it measures its position
      // for the fly-in. If that hand-off is ever missed -- an interrupted run, a
      // transitionend the WebView never fires -- the panel would stay invisible
      // for the whole run with nothing to say why. Clearing it every frame means
      // the worst case is one bad frame instead of a HUD that never appears.
      reportOnce();
      titleEl.textContent = panel.title;

      const sig = panel.title + '|' + panel.objectives.map((o) => o.label).join('|');
      if (sig !== signature) {
        signature = sig;
        // Rebuild only when the SHAPE changes. Replacing these nodes every frame
        // would restart every animation on them and thrash layout for nothing.
        rebuild(panel.objectives);
      }

      for (let i = 0; i < rows.length; i++) {
        const o = panel.objectives[i];
        const was = prev[i];
        /**
         * BY CLASS, not by position. This was `lastElementChild`, which was
         * true right up until a row gained an optional note after the count --
         * and then the update quietly wrote the score into the note instead.
         * Nothing threw; the note simply read "250".
         *
         * A positional lookup is a rule about markup that the markup does not
         * know it is obeying, so the next person to add an element breaks it
         * from a different file.
         */
        const count = rows[i].querySelector('.obj-count');

        if (o.done && !was.done) {
          // Completion gets the loudest treatment in the panel: the whole row
          // flashes and settles into its struck-through state.
          rows[i].classList.add('done');
          retrigger(rows[i], 'just-done');
          count.textContent = o.text;
        } else if (o.text !== was.text) {
          count.textContent = o.text;
          if (!o.done) retrigger(count, 'kick');
        }

        was.text = o.text;
        was.done = o.done;
      }

      // TWO KINDS OF PROGRESS, one bar. A mission counts DOWN a clock; a race
      // counts UP to a finish line. Rather than give the race its own panel,
      // a mode can hand over a `meter` instead of seconds and drive the same
      // bar and readout with whatever it is actually measuring.
      if (panel.meter) {
        const m = panel.meter;
        fillEl.style.width = `${Math.max(0, Math.min(1, m.frac)) * 100}%`;
        root.classList.toggle('warn', !!m.warn);
        root.classList.toggle('critical', !!m.critical);
        if (m.text !== prevMeterText) {
          timeEl.textContent = m.text;
          retrigger(timeEl, 'tick');
          prevMeterText = m.text;
        }
      } else if (panel.limit > 0) {
        const frac = Math.max(0, panel.seconds) / panel.limit;
        fillEl.style.width = `${frac * 100}%`;
        // Thresholds are in SECONDS, not fractions: ten seconds left is the same
        // amount of panic on a 70s mission as on a 90s one, whereas "last 15%"
        // would mean two different amounts of time.
        root.classList.toggle('warn', panel.seconds <= 20);
        root.classList.toggle('critical', panel.seconds <= 10);
      }

      if (!panel.meter) {
        const t = Math.max(0, Math.ceil(panel.seconds));
        if (t !== prevSecond) {
          timeEl.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
          // Tick audibly-in-vision for the last ten seconds only. Pulsing the
          // whole way down would make the clock ambient and the ending mean
          // nothing; starting at ten is where it earns attention.
          if (t <= 10 && t > 0) retrigger(timeEl, 'tick');
          prevSecond = t;
        }
      }
    },
  };
}
