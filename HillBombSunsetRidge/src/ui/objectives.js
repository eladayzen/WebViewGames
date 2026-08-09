// The mission panel: clock plus checklist.
//
// Driven entirely by whatever the active mode's `panel()` returns, and hidden
// when that is null. So a mode with no objectives costs nothing here, and this
// file never needs to know which modes exist.
//
// It also rebuilds the list only when the SHAPE changes, not every frame: the
// labels are stable for a whole run, and replacing DOM nodes 60 times a second
// would restart any CSS transition on them and thrash layout for no reason.

export function createObjectives() {
  const root = document.getElementById('objectives');
  const titleEl = document.getElementById('obj-title');
  const fillEl = document.getElementById('obj-clock-fill');
  const timeEl = document.getElementById('obj-time');
  const listEl = document.getElementById('obj-list');

  let signature = '';
  /** @type {HTMLElement[]} */
  let rows = [];

  function rebuild(objectives) {
    listEl.innerHTML = '';
    rows = objectives.map((o) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${o.label}</span><b></b>`;
      listEl.appendChild(li);
      return li;
    });
  }

  return {
    update(panel) {
      if (!panel) {
        root.classList.add('hidden');
        signature = '';
        return;
      }
      root.classList.remove('hidden');
      titleEl.textContent = panel.title;

      const sig = panel.title + '|' + panel.objectives.map((o) => o.label).join('|');
      if (sig !== signature) {
        signature = sig;
        rebuild(panel.objectives);
      }

      for (let i = 0; i < rows.length; i++) {
        const o = panel.objectives[i];
        rows[i].classList.toggle('done', o.done);
        rows[i].lastElementChild.textContent = o.done ? '✓' : `${o.have}/${o.count}`;
      }

      if (panel.limit > 0) {
        const frac = Math.max(0, panel.seconds) / panel.limit;
        fillEl.style.width = `${frac * 100}%`;
        // Thresholds are in SECONDS, not fractions: ten seconds left is the same
        // amount of panic on a 70s mission as on a 90s one, whereas "last 15%"
        // would mean two different amounts of time.
        root.classList.toggle('warn', panel.seconds <= 20);
        root.classList.toggle('critical', panel.seconds <= 10);
      }

      const t = Math.max(0, Math.ceil(panel.seconds));
      timeEl.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    },
  };
}
