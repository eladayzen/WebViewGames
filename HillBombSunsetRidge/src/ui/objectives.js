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
      li.innerHTML = `<span class="obj-label">${o.label}</span><b class="obj-count"></b>`;
      listEl.appendChild(li);
      return li;
    });
    prev = objectives.map(() => ({ text: null, done: false }));
    retrigger(titleEl, 'intro');
    retrigger(root, 'intro');
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
        const count = rows[i].lastElementChild;

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
