/* The DOM chrome. One module owns every element in index.html so no other file
 * reaches for `getElementById` and no two places can disagree about what is on
 * screen.
 *
 * Visibility is toggled with the literal class `hidden` everywhere, because
 * the host checks for exactly that class name on #gameover-overlay before
 * synth-clicking #restart-button. Using a different one anywhere invites
 * someone to "tidy" them into consistency later and break the restart path.
 */

const $ = (id) => document.getElementById(id);

export function createHud() {
  const el = {
    stage: $('stage'),
    scoreNear: $('score-near').querySelector('.score-value'),
    scoreFar: $('score-far').querySelector('.score-value'),
    nameNear: $('score-near').querySelector('.score-name'),
    nameFar: $('score-far').querySelector('.score-name'),
    matchLine: $('match-line'),
    perkChip: $('perk-chip'),
    perkName: $('perk-name'),
    perkLeft: $('perk-left'),
    banner: $('banner'),
    bannerText: $('banner-text'),

    gameover: $('gameover-overlay'),
    goTitle: $('go-title'),
    goScore: $('go-score'),
    goSub: $('go-sub'),
    goClock: $('go-clock'),
    goBoard: $('go-board'),
    goBoardTitle: $('go-board-title'),
    restart: $('restart-button'),

    result: $('result-overlay'),
    resultKicker: $('result-kicker'),
    resultTitle: $('result-title'),
    resultScore: $('result-score'),
    resultSub: $('result-sub'),
    resultBoard: $('result-board'),
    resultBoardTitle: $('result-board-title'),
    resultAgain: $('result-again'),
    resultQuit: $('result-quit'),

    confirm: $('confirm-overlay'),
    confirmYes: $('confirm-yes'),
    confirmNo: $('confirm-no'),

    pause: $('pause-button'),
    back: $('gb-back'),
  };

  return {
    el,

    setOrientation(o) {
      el.stage.classList.remove('orient-classic', 'orient-lateral');
      el.stage.classList.add(`orient-${o}`);
    },

    setNames(near, far) {
      el.nameNear.textContent = near;
      el.nameFar.textContent = far;
    },

    /* Far-side identity: the opponent's name and colour, or player two's.
     * Set inline rather than through a class, because the colour comes from
     * data and there is no fixed set of classes to enumerate. */
    setFarIdentity(name, css) {
      el.nameFar.textContent = name;
      el.scoreFar.style.color = css;
    },

    setScore(a, b) {
      el.scoreNear.textContent = String(a);
      el.scoreFar.textContent = String(b);
    },

    setMatchLine(text) {
      el.matchLine.textContent = text;
    },

    /* The active perk, or null. Called every frame, so it writes only when
     * something actually changed -- a per-frame textContent assignment on an
     * unchanged string is work the WebView does not need to do. */
    setPerk(perk) {
      if (!perk) {
        if (!el.perkChip.classList.contains('hidden')) el.perkChip.classList.add('hidden');
        return;
      }
      el.perkChip.classList.remove('hidden');
      if (el.perkName.textContent !== perk.label) el.perkName.textContent = perk.label;
      const secs = String(Math.ceil(perk.left));
      if (el.perkLeft.textContent !== secs) el.perkLeft.textContent = secs;
    },

    showBanner(text) {
      el.bannerText.textContent = text;
      el.banner.classList.remove('hidden');
    },

    hideBanner() {
      el.banner.classList.add('hidden');
    },

    setPaused(paused) {
      el.pause.innerHTML = paused ? '&#9654;' : '&#9208;';
    },

    /* The death screen. The only screen with a clock, because it is the only
     * one a player lands on without choosing to -- an abandoned machine should
     * not park on a dead screen. A screen someone pressed a button to reach
     * waits for them. */
    showGameOver({ title, score, sub }) {
      el.goTitle.textContent = title;
      el.goScore.textContent = String(score);
      el.goSub.textContent = sub || '';
      el.gameover.classList.remove('hidden');
    },

    setGameOverClock(seconds) {
      el.goClock.textContent = String(Math.max(0, Math.ceil(seconds)));
    },

    hideGameOver() {
      el.gameover.classList.add('hidden');
    },

    /* Quit and finished share this screen. Same position for the player in
     * both cases -- run over, score banked, play again or leave -- so they
     * differ in the headline and nothing else. */
    showResult({ kicker, title, score, sub }) {
      el.resultKicker.textContent = kicker;
      el.resultTitle.textContent = title;
      el.resultScore.textContent = String(score);
      el.resultSub.textContent = sub || '';
      el.result.classList.remove('hidden');
    },

    hideResult() {
      el.result.classList.add('hidden');
    },

    showConfirm() {
      el.confirm.classList.remove('hidden');
    },

    hideConfirm() {
      el.confirm.classList.add('hidden');
    },

    isConfirmOpen() {
      return !el.confirm.classList.contains('hidden');
    },
  };
}
