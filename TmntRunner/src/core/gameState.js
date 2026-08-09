// playing/gameover state machine + DOM overlay wiring. Uses the exact
// #gameover-overlay / #restart-button ids the GoBalance SDK contract requires
// (see ../../../GOBALANCE_SDK.md) -- Unity synthetically clicks #restart-button
// while #gameover-overlay lacks the `hidden` class.
export function createGameState({ onRestart }) {
  const overlay = document.getElementById('gameover-overlay');
  const restartButton = document.getElementById('restart-button');
  const finalScoreEl = document.getElementById('finalScore');

  const state = { current: 'playing' };

  restartButton.addEventListener('click', () => {
    overlay.classList.add('hidden');
    state.current = 'playing';
    onRestart();
  });

  function triggerGameOver(finalScoreText) {
    if (state.current === 'gameover') return;
    state.current = 'gameover';
    finalScoreEl.textContent = finalScoreText || '';
    overlay.classList.remove('hidden');
  }

  return { state, triggerGameOver };
}
