// Pipe-section/difficulty progression tracker (§5.4, §9.3). Purely in-run,
// time-based, always restarts from section 0 (§8) -- no persistence.

import { SECTIONS, sectionIndexAt } from '../data/sectionsData.js';

export function createSectionState() {
  return { index: 0 };
}

export function resetSectionState(state) {
  state.index = 0;
}

// Returns the new section object if a transition just happened this frame,
// otherwise null.
export function tickSection(state, elapsedSeconds) {
  const newIndex = sectionIndexAt(elapsedSeconds);
  if (newIndex !== state.index) {
    state.index = newIndex;
    return SECTIONS[newIndex];
  }
  return null;
}

export function currentSection(state) {
  return SECTIONS[state.index];
}
