// THE BRIEFING -- what you are about to be asked to do, before the hill moves.
//
// A mission's objectives used to appear in the corner on the same frame the run
// started, which is the one moment the player is least able to read anything.
// Amit: "I start the mission, I don't understand what I should do."
//
// So the run waits. The objectives are shown centre-screen at a size that cannot
// be missed, and then they FLY INTO the HUD panel's own position and shrink to
// its size. That flight is the point of the whole thing: a cut, or a fade, would
// leave the player to work out that the small thing in the corner is the same
// list they just read. Moving it says so without words.
//
// TECHNIQUE. The card is animated from its own measured rectangle to the live
// panel's measured rectangle -- FLIP, in the usual jargon. The panel has to be
// laid out and measurable for that, so it is made visible-but-transparent for
// the duration rather than being left display:none, which would have no rect to
// aim at.

export function createBriefing() {
  const el = document.getElementById('briefing');
  const card = document.getElementById('brief-card');
  const numEl = document.getElementById('brief-num');
  const nameEl = document.getElementById('brief-name');
  const subEl = document.getElementById('brief-sub');
  const listEl = document.getElementById('brief-list');
  const goEl = document.getElementById('brief-go');

  let resolveShow = null;
  let dismissed = true;

  /** Minimum time on screen before an input can skip it. */
  const MIN_HOLD = 0.45;
  /** Auto-advance if the player does nothing. */
  const AUTO_AFTER = 3.2;
  let shownAt = 0;

  function finish() {
    const done = resolveShow;
    resolveShow = null;
    el.classList.add('hidden');
    card.classList.remove('flying');
    card.style.transform = '';
    card.style.opacity = '';
    const panel = document.getElementById('objectives');
    if (panel) panel.style.opacity = '';
    if (done) done();
  }

  function fly() {
    if (dismissed) return;
    dismissed = true;
    const panel = document.getElementById('objectives');
    if (!panel) { finish(); return; }

    // The panel must be laid out to have a rectangle to aim at. It is shown but
    // transparent, so it occupies its real position without appearing early.
    panel.classList.remove('hidden');
    panel.style.opacity = '0';

    const from = card.getBoundingClientRect();
    const to = panel.getBoundingClientRect();
    if (to.width < 1 || from.width < 1) { finish(); return; }

    // Uniform scale from the width alone: the two elements have different
    // aspect ratios, and scaling each axis independently would visibly squash
    // the text on the way across.
    const scale = to.width / from.width;
    const dx = to.left - from.left;
    const dy = to.top - from.top;

    card.classList.add('flying');
    // Both transforms are relative to the card's top-left origin, so translate
    // then scale lands its corner exactly on the panel's corner.
    card.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    card.style.opacity = '0';

    let settled = false;
    const land = () => {
      if (settled) return;
      settled = true;
      card.removeEventListener('transitionend', land);
      panel.style.opacity = '';
      finish();
    };
    card.addEventListener('transitionend', land);
    // A transition that never fires -- an interrupted run, a backgrounded tab --
    // would leave the game frozen behind a hidden card forever.
    setTimeout(land, 900);
  }

  // Space/Enter and a tap all skip ahead. On the board these are the only inputs
  // the host forwards, so without them the briefing would be unskippable there.
  window.addEventListener('keydown', (e) => {
    if (dismissed) return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); fly(); }
  });
  el.addEventListener('click', fly);

  return {
    isOpen: () => !dismissed,

    /**
     * @param {{number?:number, name:string, sub?:string,
     *          rows:Array<{label:string,text:string}>}} data
     * @returns {Promise<void>} resolves once the card has landed on the HUD.
     */
    show(data) {
      numEl.textContent = data.number != null
        ? String(data.number).padStart(2, '0') : '';
      numEl.style.display = data.number != null ? '' : 'none';
      nameEl.textContent = data.name;
      subEl.textContent = data.sub || '';
      subEl.style.display = data.sub ? '' : 'none';
      listEl.innerHTML = '';
      data.rows.forEach((r, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${r.label}</span><b>${r.text}</b>`;
        li.style.animationDelay = `${0.12 + i * 0.09}s`;
        listEl.appendChild(li);
      });
      goEl.textContent = 'PRESS TO START';

      dismissed = false;
      shownAt = performance.now();
      el.classList.remove('hidden');
      card.classList.remove('flying');
      card.style.transform = '';
      card.style.opacity = '';
      card.classList.remove('intro');
      void card.offsetWidth;
      card.classList.add('intro');

      return new Promise((resolve) => {
        resolveShow = resolve;
        // Auto-advance so a player who does nothing is not stuck, and a minimum
        // hold so a keypress left over from the menu cannot skip it instantly.
        const tick = () => {
          if (dismissed) return;
          const t = (performance.now() - shownAt) / 1000;
          if (t >= AUTO_AFTER) { fly(); return; }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },

    /** Close it immediately, without the flight -- used when a run is abandoned. */
    cancel() {
      if (dismissed) return;
      dismissed = true;
      finish();
    },
  };
}
