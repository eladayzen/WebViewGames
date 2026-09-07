/* Banking a run and drawing the board.
 *
 * Two things the host does that shape this code:
 *
 * 1. `submitScore()` RESOLVES BEFORE THE WRITE COMMITS. It reports success
 *    while the Firestore write is still in flight, so a getScoreboard() fired
 *    the instant it resolves can come back without the run just played --
 *    intermittently, which is the worst way for it to fail. So the submitted
 *    value is held and rendered from memory rather than trusted to come back.
 *
 * 2. The store keeps a profile's BEST hundred runs, not its last hundred --
 *    sorted high-to-low and then truncated. A low run is discarded at write
 *    time once a hundred better ones exist. A run genuinely can be missing
 *    from the board it just fed, and that is the host's behaviour rather than
 *    a bug here.
 *
 * Entries are RUNS, not per-profile bests: one profile can hold several rows.
 * That is the shipped convention across the app's own boards, so it is left
 * alone rather than reduced.
 */

import { identityFor } from '../data/avatars.js';

const gb = () => (typeof window !== 'undefined' ? window.GoBalance : null);

/* Bank a run. Returns the value submitted so the caller can render it without
 * a round trip. Never throws -- a board that fails to record must not take the
 * result screen down with it. */
export async function submitRun(score) {
  const api = gb();
  const value = Math.max(0, Math.round(score));
  if (!api || typeof api.submitScore !== 'function') return value;
  try {
    await api.submitScore(value);
  } catch (e) {
    if (window.Unity) window.Unity.call('SCORE SUBMIT FAILED: ' + e);
  }
  return value;
}

/* Fetch and render into `listEl`. `justScored` is the value we submitted this
 * run, used to pick which `isYou` row to mark as the one just played -- there
 * is no timestamp and no run id on an entry, so matching on the exact score is
 * the only anchor available, and it is ambiguous only between runs that are
 * identical anyway. */
export async function renderBoard(listEl, titleEl, justScored) {
  const api = gb();
  if (!listEl) return;

  if (!api || typeof api.getScoreboard !== 'function') {
    // No host: this is a plain browser. Say so rather than showing an empty
    // list that reads as "nobody has ever played".
    listEl.innerHTML = '';
    if (titleEl) titleEl.textContent = 'NO BOARD OUTSIDE THE APP';
    return;
  }

  let board = null;
  try {
    board = await api.getScoreboard();
  } catch (e) {
    if (window.Unity) window.Unity.call('SCOREBOARD FETCH FAILED: ' + e);
  }

  const entries = (board && board.entries) || [];
  if (titleEl) {
    // `complete: false` means only this device could be read -- offline, or
    // nobody signed in. Labelling that as the family board would be a lie.
    titleEl.textContent = board && board.complete ? 'BEST RUNS' : 'BEST ON THIS DEVICE';
  }

  listEl.innerHTML = '';
  let markedOwn = false;
  entries.slice(0, 8).forEach((entry, i) => {
    const id = identityFor(entry);
    const li = document.createElement('li');
    li.className = 'board-row';

    const isThisRun = !markedOwn && entry.isYou && entry.score === justScored;
    if (isThisRun) {
      markedOwn = true;
      li.classList.add('is-run');
    } else if (entry.isYou) {
      li.classList.add('is-you');
    }

    const rank = document.createElement('span');
    rank.className = 'board-rank';
    rank.textContent = String(i + 1);

    const dot = document.createElement('span');
    dot.className = 'board-dot';
    dot.style.background = id.color;
    dot.textContent = id.initial;

    const name = document.createElement('span');
    name.className = 'board-name';
    name.textContent = entry.name || 'Player';

    const score = document.createElement('span');
    score.className = 'board-score';
    score.textContent = String(entry.score);

    li.append(rank, dot, name, score);
    listEl.appendChild(li);
  });

  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'board-empty';
    li.textContent = 'No runs recorded yet.';
    listEl.appendChild(li);
  }
}
