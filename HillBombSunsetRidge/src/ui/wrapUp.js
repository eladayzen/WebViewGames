// The "wrap up the run" panel under the mission panel (BAL-580).
//
// A cleared mission keeps riding to the end of the clock -- that is the default
// and it stays. This is the second option, for the player who has met every
// objective and has nothing left to chase: end the run now and bank the win.
//
// It NEVER pauses and never asks to be dismissed. A player who ignores it plays
// exactly as before. It arrives on the objective-clear beat that already exists,
// with one pulse, and then sits still for the rest of the run -- loud entrance,
// quiet presence. Boredom turns up some time after the clear, not at it, and a
// panel that had already hidden itself would miss the moment it is for.
//
// Driven by the `wrapUp` flag on the active mode's panel(), so this file never
// needs to know which modes have one.

export function createWrapUp(onPress) {
  const root = document.getElementById('wrap-up');
  const button = document.getElementById('wrap-up-button');
  let shown = false;

  if (button) button.addEventListener('click', () => { if (shown) onPress(); });

  return {
    update(show) {
      if (!root) return;
      show = !!show;
      // Edges only -- re-adding the class every frame would restart the
      // entrance pulse and freeze it on its first frame.
      if (show === shown) return;
      shown = show;
      root.classList.toggle('hidden', !show);
      if (show) {
        root.classList.remove('enter');
        void root.offsetWidth; // reflow so the pulse restarts on a second clear
        root.classList.add('enter');
      }
    },
  };
}
