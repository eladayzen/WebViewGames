// Tiny shared flag so the player settings panel (ui/steeringPanel.js) and
// the dev tools panel (ui/devPanel.js) never both try to claim the same
// Enter/Space keypress.
//
// devPanel.js is the only writer -- it can ONLY be opened by tapping its own
// (hidden-until-unlocked) button, never by Enter, so there's no ambiguity
// about which panel Enter should open when both are closed: it's always the
// settings panel, unless dev tools has explicitly claimed the keyboard by
// being open right now. steeringPanel.js only reads this, to bail out of its
// own keydown handling while that's true.
let devPanelOpen = false;

export function setDevPanelOpen(v) {
  devPanelOpen = v;
}

export function isDevPanelOpen() {
  return devPanelOpen;
}
