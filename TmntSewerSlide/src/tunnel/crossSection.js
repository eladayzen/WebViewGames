// Pipe cross-sections (§5.3): the valid range of `theta` Raphael can occupy,
// implemented as a simple min/max clamp -- the concept's entire structural
// difficulty mechanism (no new input, just less/more room within the same
// left/right lean). Post-MVP's full-pipe (no clamp at all) is intentionally
// not defined here -- out of scope for this build.

import * as THREE from 'three';
import { ARC_CENTER, PARTIAL_ARC_HALF_WIDTH, HALF_PIPE_HALF_WIDTH } from '../data/constants.js';

export const CROSS_SECTIONS = {
  partialArc: {
    key: 'partialArc',
    min: ARC_CENTER - PARTIAL_ARC_HALF_WIDTH,
    max: ARC_CENTER + PARTIAL_ARC_HALF_WIDTH,
  },
  halfPipe: {
    key: 'halfPipe',
    min: ARC_CENTER - HALF_PIPE_HALF_WIDTH,
    max: ARC_CENTER + HALF_PIPE_HALF_WIDTH,
  },
};

export function clampThetaToSection(theta, sectionKey) {
  const s = CROSS_SECTIONS[sectionKey];
  return THREE.MathUtils.clamp(theta, s.min, s.max);
}

// Random theta strictly inside the section's reachable arc, with a small
// inset margin so nothing spawns flush against the silted/broken edge.
export function randomThetaInSection(sectionKey, marginFrac = 0.08) {
  const s = CROSS_SECTIONS[sectionKey];
  const width = s.max - s.min;
  const margin = width * marginFrac;
  return s.min + margin + Math.random() * (width - margin * 2);
}
