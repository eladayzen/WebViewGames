// The DOM HUD: shells (lives), score, the countdown, and the three end-of-run
// surfaces -- the death result (#gameover-overlay), the quit board
// (#quit-overlay) and the "quit?" confirm modal (#confirm-overlay).
//
// #gameover-overlay is the DEATH screen and nothing else. The host synth-clicks
// #restart-button on Space/Enter whenever that overlay lacks the class `hidden`,
// so the quit board has its own id and its own buttons.
import { identityFor } from '../data/avatars.js';

export function createHud(doc) {
  const $ = (id) => doc.getElementById(id);
  const el = {
    shells: [...doc.querySelectorAll('#lives .shell')],
    score: $('score'),
    countdown: $('countdown'),
    gameover: $('gameover-overlay'), gameoverStats: $('gameover-stats'), gameoverCountdown: $('gameover-countdown'),
    scoreboard: $('scoreboard'), scoreboardTitle: $('scoreboard-title'), scoreboardRows: $('scoreboard-rows'),
    confirm: $('confirm-overlay'),
    quit: $('quit-overlay'), quitStats: $('quit-stats'),
    quitScoreboard: $('quit-scoreboard'), quitScoreboardTitle: $('quit-scoreboard-title'), quitScoreboardRows: $('quit-scoreboard-rows'),
  };
  let shownScore = -1, shownLives = -1, shownCount = null;

  return {
    setLives(n) {
      if (n === shownLives) return; shownLives = n;
      el.shells.forEach((s, i) => s.classList.toggle('lost', i >= n));
    },
    setScore(n) {
      if (n === shownScore) return; shownScore = n;
      el.score.textContent = n.toLocaleString();
    },
    /** null hides it. */
    setCountdown(text) {
      if (text === shownCount) return; shownCount = text;
      el.countdown.textContent = text || '';
      el.countdown.classList.toggle('hidden', !text);
      el.countdown.classList.toggle('go', text === 'GO!');
    },

    showGameOver(statsText) {
      el.gameoverStats.textContent = statsText;
      el.gameover.classList.remove('hidden');
    },
    hideGameOver() {
      el.gameover.classList.add('hidden');
      el.scoreboard.classList.add('hidden');
    },
    setResultCountdown(secs) {
      el.gameoverCountdown.textContent = secs > 0 ? `Restarting in ${secs}` : '';
    },

    showConfirm() { el.confirm.classList.remove('hidden'); },
    hideConfirm() { el.confirm.classList.add('hidden'); },
    isConfirmOpen() { return !el.confirm.classList.contains('hidden'); },

    showQuit(statsText) {
      el.quitStats.textContent = statsText;
      el.quit.classList.remove('hidden');
    },
    hideQuit() {
      el.quit.classList.add('hidden');
      el.quitScoreboard.classList.add('hidden');
    },
    isQuitOpen() { return !el.quit.classList.contains('hidden'); },

    /**
     * Paint a board (NovaVanguard's hud.showBoard). `groups` is a list of
     * row-runs drawn with a visible break between them: [leaders, window
     * around your run]. HIDDEN IS A REAL OUTCOME -- outside the app there is no
     * SDK, and an empty framed panel would look broken.
     */
    showBoard(where, board, groups) {
      const box = where === 'quit' ? el.quitScoreboard : el.scoreboard;
      const title = where === 'quit' ? el.quitScoreboardTitle : el.scoreboardTitle;
      const list = where === 'quit' ? el.quitScoreboardRows : el.scoreboardRows;
      const total = (groups || []).reduce((n, g) => n + g.length, 0);
      if (!board || !board.available || !total) { box.classList.add('hidden'); return; }
      // `complete: false` = only this device could be read; say so.
      title.textContent = board.complete ? 'BEST ON THIS ACCOUNT' : 'BEST ON THIS DEVICE';
      list.textContent = '';
      groups.forEach((rows, gi) => {
        if (gi > 0 && rows.length) {
          const gap = doc.createElement('li'); gap.className = 'sb-gap'; gap.textContent = '·  ·  ·'; list.appendChild(gap);
        }
        rows.forEach((r) => {
          const li = doc.createElement('li');
          li.className = 'sb-row' + (r.isRun ? ' sb-you' : r.isYou ? ' sb-mine' : '');
          const rank = doc.createElement('span'); rank.className = 'sb-rank'; rank.textContent = String(r.rank);
          const id = identityFor(r);
          const av = doc.createElement('span'); av.className = 'sb-avatar'; av.style.backgroundColor = id.color; av.textContent = id.initial;
          const name = doc.createElement('span'); name.className = 'sb-name'; name.textContent = r.name || 'PLAYER';
          const score = doc.createElement('span'); score.className = 'sb-score'; score.textContent = Number(r.score || 0).toLocaleString();
          li.append(rank, av, name, score);
          list.appendChild(li);
        });
      });
      box.classList.remove('hidden');
    },
  };
}
