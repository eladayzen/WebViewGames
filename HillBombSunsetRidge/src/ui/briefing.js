// THE BRIEFING -- what you are about to be asked to do, before the hill moves.
//
// A mission's objectives used to appear in the corner on the same frame the run
// started, which is the one moment the player is least able to read anything.
// Amit: "I start the mission, I don't understand what I should do."
//
// So the run waits: the objectives are shown centre-screen at a size that cannot
// be missed, and then the card simply closes and the HUD panel takes over.
//
// IT USED TO FLY INTO THE PANEL -- a measured transform from the card's rect to
// the panel's, so the list visibly became the thing in the corner. That read
// well in a browser and is gone, because on the SDK's WebView the left panel did
// not appear at all and this was the only thing standing between "the mode says
// show it" and "it is on screen": a transform that had to land, a transitionend
// that had to fire, and the panel held at opacity 0 until both did. Three ways
// to fail, all silent, none reproducible in Chrome.
//
// A cut looks worse and is strictly more reliable. A HUD that always appears
// beats one that arrives elegantly when it arrives at all.

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
  /**
   * How long the card holds. There is no "press to start" any more -- this is a
   * balance board, not a keyboard, and telling a player to press something they
   * do not have is worse than saying nothing. A visible countdown does the same
   * job without asking for anything: you can see exactly how long you have to
   * read. A second longer than the prompted version, since nobody can now cut
   * it short deliberately.
   */
  const AUTO_AFTER = 4.2;
  let shownAt = 0;

  function finish() {
    const done = resolveShow;
    resolveShow = null;
    el.classList.add('hidden');
    if (done) done();
  }

  /**
   * Close the card and hand over. No animation, no measuring, no waiting on an
   * event: the panel is shown by its own update() on the very next frame, which
   * is the moment the run starts.
   */
  function fly() {
    if (dismissed) return;
    dismissed = true;
    finish();
  }

  /**
   * NO CLICK-TO-SKIP. Amit: "there is a countdown -- when I click on it, it
   * jumps straight to the game. Let's disable this click-skip."
   *
   * The card is not decoration: it is where the player reads what the mission
   * is asking for, and a tap anywhere on a full-screen panel is very easy to
   * fire by accident -- so the one interaction this screen had was to destroy
   * its own reason for existing, on a touch device, on every single run.
   *
   * Space/Enter still skip. Those are a deliberate press rather than a stray
   * tap, and on the GoBalance board they are the only inputs the host forwards
   * at all -- removing them too would leave a rider unable to get past the card
   * except by waiting it out.
   */
  window.addEventListener('keydown', (e) => {
    if (dismissed) return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); fly(); }
  });

  return {
    isOpen: () => !dismissed,

    /**
     * @param {{number?:number, name:string, sub?:string,
     *          rows:Array<{label:string,text:string}>}} data
     * @returns {Promise<void>} resolves once the card has closed.
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
      goEl.textContent = '';

      dismissed = false;
      shownAt = performance.now();
      el.classList.remove('hidden');

      return new Promise((resolve) => {
        resolveShow = resolve;
        // Auto-advance so a player who does nothing is not stuck, and a minimum
        // hold so a keypress left over from the menu cannot skip it instantly.
        const tick = () => {
          if (dismissed) return;
          const t = (performance.now() - shownAt) / 1000;
          if (t >= AUTO_AFTER) { fly(); return; }
          // The countdown IS the prompt. Seconds remaining, plus a bar draining
          // beneath it, so the wait is visibly finite rather than a card that
          // might sit there forever.
          const left = Math.max(0, AUTO_AFTER - t);
          goEl.textContent = String(Math.ceil(left));
          goEl.style.setProperty('--brief-left', String(left / AUTO_AFTER));
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
