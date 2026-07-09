import * as THREE from 'three';
import {
  LANE_X, LANE_RESPONSE, BANK_FACTOR, BANK_MAX,
  SOFT_STEER_SPEED, SOFT_STEER_BOUND,
} from './constants.js';
import { createCarModel, updateHover } from './car-model.js';

const BODY_COLOR = 0x2f6bff;
const ACCENT_COLOR = 0xff9a1f;

export function createPlayerCar() {
  const car = createCarModel({ bodyColor: BODY_COLOR, accentColor: ACCENT_COLOR, detailed: true });
  car.userData.laneIndex = 1;
  car.position.x = LANE_X[1];
  return car;
}

export function setPlayerLane(car, laneIndex) {
  car.userData.laneIndex = laneIndex;
}

function applyBank(car, prevX, dt) {
  const lateralVel = (car.position.x - prevX) / Math.max(dt, 1e-4);
  car.rotation.z = THREE.MathUtils.clamp(-lateralVel * BANK_FACTOR, -BANK_MAX, BANK_MAX);
}

// Runner controller: one discrete step snaps a target lane; position eases
// toward it. The easing itself is what reads as "steering."
export function updatePlayerCarDiscrete(car, dt) {
  const targetX = LANE_X[car.userData.laneIndex];
  const followT = 1 - Math.exp(-LANE_RESPONSE * dt);
  const prevX = car.position.x;
  car.position.x += (targetX - car.position.x) * followT;
  applyBank(car, prevX, dt);
  updateHover(car, dt);
}

// Soft controller: no lanes -- position is a free continuous value that only
// moves while an input is held, and simply stops (no re-centering) when
// released.
export function updatePlayerCarContinuous(car, axis, dt) {
  const prevX = car.position.x;
  car.position.x += axis * SOFT_STEER_SPEED * dt;
  car.position.x = THREE.MathUtils.clamp(car.position.x, -SOFT_STEER_BOUND, SOFT_STEER_BOUND);
  applyBank(car, prevX, dt);
  updateHover(car, dt);
}
