// MISSION SELECT -- what you have done, what is next, and what is still shut.
//
// Shown after picking the missions mode, and again after every result, so
// finishing a mission shows you what it just unlocked instead of dropping you
// straight back onto the hill.
//
// LOCKED ROWS STAY VISIBLE. A list that only shows what you can play right now
// tells you nothing about where you are going; seeing rows below you with locks
// on them is the reason to clear the one you are on. For the same reason a
// cleared row keeps showing its stars, including the ones it did NOT earn --
// that gap is the only reason to replay something you have already beaten.
//
// THE HORIZON GROWS IN BLOCKS OF TEN. Showing all twenty from the first run
// makes the list a wall and the end of it feel impossibly far; showing only the
// next one or two hides the shape of the game entirely. So ten are visible
// until ten are cleared, then twenty, and so on. The block is a round number
// the player can feel themselves crossing.
//
// Everything here is read from the progress store (systems/progress.js), which
// is the seam that becomes account data later. This file never reads storage.

/** Missions revealed per block -- see the horizon note above. */
const BLOCK = 10;

/**
 * WHICH LADDER THE PANEL IS CURRENTLY SHOWING.
 *
 * There are two instances of this component -- the ridge's and the face's --
 * and they share ONE #mission-select element, one #mission-list and one
 * #msel-next button, because only one is ever on screen. What they do not
 * share is their event listeners: each instance wires its own click handler
 * onto that single NEXT button and its own keydown handler onto the window at
 * construction time, and the only guard either of them had was "is the panel
 * hidden" -- a question about the SHARED element, which both answer the same
 * way.
 *
 * So pressing NEXT (or Space, or Enter) on the ridge list ran BOTH handlers.
 * The ridge started its mission and then the face started one over the top of
 * it, last write winning. Amit: "I found myself somehow, after I completed a
 * run, in the forbidden open valley mission lobby."
 *
 * The open face is meant to be unreachable -- there is no lobby button for it
 * any more -- but unreachable was only ever enforced at the menu. Its list
 * object still existed, still listened, and Space is one of the only two keys
 * the GoBalance board forwards, so on the board it was not an edge case.
 *
 * This is the ownership the shared element never had: whoever opened it last
 * owns it, and every other instance ignores input until it does not.
 */
let showing = null;

/**
 * @param {number} [track=0] which progression ladder this list is showing.
 *
 * There are two now -- the ridge and the open face -- and every call to
 * nextMissionId has to name one. Without it the face's list asked for "the next
 * mission" and was handed a RIDGE id, which is not in its array: the lookup
 * returned undefined and reading .number off it threw, leaving the list hidden
 * and the button dead.
 */
/**
 * @param {string} [noun='mission'] what a row IS, for the locked-row text.
 *
 * The race ladder reuses this list, and told the player to "clear the mission
 * before it" on a screen with no missions on it. One word, but it is the only
 * sentence a locked row gets, and being wrong about what the game calls its own
 * content is exactly the kind of thing that reads as unfinished.
 */
export function createMissionSelect(missions, progress, onPick, track = 0, noun = 'mission') {
  const el = document.getElementById('mission-select');
  const listEl = document.getElementById('mission-list');
  const totalEl = document.getElementById('msel-total');
  const nextBtn = document.getElementById('msel-next');

  function stars(n) {
    // Three glyphs always, so every row is the same width and the eye can
    // compare them down the column without reading numbers.
    return [0, 1, 2].map((i) => `<span class="msel-star${i < n ? ' earned' : ''}">&#9733;</span>`).join('');
  }

  /**
   * How far down the list the player can currently see. Ten until ten are
   * cleared, then twenty, and so on -- never fewer than one block, never more
   * than the list itself.
   */
  function horizon() {
    const cleared = missions.filter((m) => progress.cleared(m.id)).length;
    return Math.min(missions.length, Math.ceil((cleared + 1) / BLOCK) * BLOCK);
  }

  function render() {
    listEl.innerHTML = '';
    const nextId = progress.nextMissionId(track);
    const shown = missions.slice(0, horizon());

    for (const m of shown) {
      const unlocked = progress.isUnlocked(m.id);
      const cleared = progress.cleared(m.id);
      const isNext = unlocked && m.id === nextId;

      const row = document.createElement('button');
      row.className = 'msel-row'
        + (unlocked ? '' : ' locked')
        + (cleared ? ' cleared' : '')
        + (isNext ? ' next' : '');
      row.dataset.mission = m.id;
      row.disabled = !unlocked;

      // The number leads every row. Once the list scrolls, "the one I am on" is
      // otherwise only expressible as a position on screen -- a number makes it
      // something the player can hold on to and say out loud.
      // Numbered within its own ladder. m.number is the position in the global
      // table, which reads as 21-28 on a list of eight.
      const num = `<div class="msel-num">${String(missions.indexOf(m) + 1).padStart(2, '0')}</div>`;
      row.innerHTML = unlocked
        ? `${num}
           <div class="msel-text">
             <b>${m.name}</b>
             <small>${m.brief}</small>
           </div>
           <div class="msel-stars">${stars(progress.stars(m.id))}</div>`
        // A locked row names itself but not its brief: knowing there is a
        // SUNSET RUN ahead is the hook; spoiling what it asks for is not.
        : `${num}
           <div class="msel-text">
             <b>${m.name}</b>
             <small>Clear the ${noun} before it</small>
           </div>
           <div class="msel-lock">&#128274;</div>`;

      if (unlocked) row.addEventListener('click', () => choose(m.id));
      listEl.appendChild(row);
    }

    // Say what is beyond the horizon rather than just ending. A list that stops
    // at ten with no explanation reads as "this is the whole game".
    if (shown.length < missions.length) {
      const more = document.createElement('div');
      more.className = 'msel-more';
      more.textContent = `${missions.length - shown.length} more · clear ${shown.length} to reveal the next set`;
      listEl.appendChild(more);
    }

    const total = progress.totalStars;
    totalEl.innerHTML = `<span class="msel-star earned">&#9733;</span> ${total} / ${missions.length * 3}`;
    const nextM = missions.find((m) => m.id === nextId);
    nextBtn.textContent = progress.cleared(nextId)
      ? `PLAY ${String(missions.indexOf(nextM) + 1).padStart(2, '0')} AGAIN`
      : `MISSION ${String(missions.indexOf(nextM) + 1).padStart(2, '0')}`;
  }

  function choose(id) {
    el.classList.add('hidden');
    showing = null;
    onPick(id);
  }

  /** True only when the shared panel is open AND showing THIS ladder. */
  function mine() {
    return showing === api && !el.classList.contains('hidden');
  }

  nextBtn.addEventListener('click', () => {
    if (!mine()) return;
    choose(progress.nextMissionId(track));
  });

  // Space/Enter takes the default action. On the board these are the only keys
  // the host forwards, so without this the screen would be a dead end there --
  // the same reason the game-over overlay listens for them.
  window.addEventListener('keydown', (e) => {
    if (!mine()) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      choose(progress.nextMissionId(track));
    }
  });

  const api = {
    isOpen: () => mine(),
    /** Re-reads progress every time, so a result is reflected the moment it lands. */
    open() {
      render();
      showing = api;
      el.classList.remove('hidden');
      // Bring the mission you are actually on into view. The list scrolls, but
      // the GoBalance WebView forwards no pointer at all -- there is nothing to
      // drag with on the board -- so a list that opens at the top would bury
      // the current mission out of reach once a few are cleared. Scrolling it
      // into view is what keeps this screen usable there, and the NEXT button
      // plus Space/Enter remain the pointer-free way to act on it.
      const next = listEl.querySelector('.msel-row.next');
      if (next) next.scrollIntoView({ block: 'center' });
    },
    close() {
      el.classList.add('hidden');
      if (showing === api) showing = null;
    },
  };

  return api;
}
