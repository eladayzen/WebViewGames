// Single source of truth for the 3-lane slot system (GDD §9.1: lane positions
// are fixed X-coordinates, player/obstacles snap/lerp between them -- this is
// a lane-slot state machine, not free-roam movement).

export const LANE_COUNT = 3;
export const LANE_WIDTH = 2.2;
export const CENTER_LANE = 1;

export const LANE_X = [-LANE_WIDTH, 0, LANE_WIDTH];

export function laneToX(laneIndex) {
  return LANE_X[laneIndex];
}

export function clampLane(laneIndex) {
  return Math.max(0, Math.min(LANE_COUNT - 1, laneIndex));
}
