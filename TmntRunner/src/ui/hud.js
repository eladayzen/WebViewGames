// DOM/CSS overlay, not Babylon GUI (GDD §7). Score/coins are static-for-now
// placeholders in this pass -- real scoring/economy is GDD Milestone 4+ --
// but the visual chrome exists now since matching the reference HUD look is
// an explicit early priority. Updated via textContent, not re-created per frame.
export function createHud() {
  const scoreEl = document.getElementById('score');
  const coinsEl = document.getElementById('coins');

  return {
    setScore(value) {
      scoreEl.textContent = `SCORE: ${Math.floor(value)}`;
    },
    setCoins(value) {
      coinsEl.textContent = `COINS: ${value}`;
    },
  };
}
