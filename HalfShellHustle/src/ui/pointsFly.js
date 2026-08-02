// Flying "+N" score labels: a number pops where the thing was collected, holds
// long enough to read, then flies into the points counter and lands.
//
// Direct feedback, and the reasoning is worth keeping: "I want a really clear
// feedback of how points are being added... maybe I see a clear UI element
// where I killed the enemy for a second of the points that I got there and then
// they fly into the UI, something like that. So I will understand what's giving
// me points and how much points."
//
// So the animation has three deliberate beats, and the middle one is the one
// that actually teaches:
//   1. POP   -- appears at the kill/collect point and overshoots. Says WHERE.
//   2. HOLD  -- sits still and readable. Says HOW MUCH. Skipping this is what
//               makes most score popups unreadable; it's short but non-zero.
//   3. FLY   -- accelerates into the counter and shrinks. Says WHERE IT WENT.
// The counter only increments when a label lands (systems/scoring.js's
// displayed/total split), so the connection is real, not implied.
//
// DOM rather than 3D sprites, because the destination is a DOM element -- a
// canvas-space effect could never actually arrive at the HUD. Cost is kept off
// the WebView's slow path deliberately: textContent is written ONCE at spawn
// (rewriting stroked text every frame is the documented stutter cause -- see
// ui/hud.js's dirty-check note), and the per-frame update touches only
// `transform` and `opacity`, both compositor-only properties.

import * as THREE from 'three';
import {
  POINTS_FLY_POP_SEC, POINTS_FLY_HOLD_SEC, POINTS_FLY_TRAVEL_SEC,
  POINTS_FLY_POOL_SIZE, POINTS_FLY_RISE_PX, POINTS_FLY_END_SCALE,
} from '../data/constants.js';

const _projected = new THREE.Vector3();

// Pool, never grown at runtime -- a coin row can land several labels within a
// few frames, and allocating DOM nodes mid-run is exactly the kind of hitch
// this game has already chased out of the HUD elsewhere.
const labels = [];
let hudEl = null;
let stageEl = null;
let counterEl = null;
let onArrive = null;

// Counter position in stage-local px. Cached because getBoundingClientRect
// forces layout, and the target only moves on resize.
let targetX = 0;
let targetY = 0;

function measureTarget() {
  if (!counterEl || !stageEl) return;
  const c = counterEl.getBoundingClientRect();
  const s = stageEl.getBoundingClientRect();
  targetX = c.left - s.left + c.width / 2;
  targetY = c.top - s.top + c.height / 2;
}

export function initPointsFly(stage, hud, counter, arriveCallback) {
  stageEl = stage;
  hudEl = hud;
  counterEl = counter;
  onArrive = arriveCallback;

  for (let i = 0; i < POINTS_FLY_POOL_SIZE; i++) {
    const el = document.createElement('div');
    el.className = 'points-fly';
    el.style.display = 'none';
    hudEl.appendChild(el);
    labels.push({ el, active: false, t: 0, x0: 0, y0: 0, value: 0, credited: false });
  }
  measureTarget();
  window.addEventListener('resize', measureTarget);
}

// Recompute after a layout change the resize listener can't see (the counter
// grows a digit, the tray rebuilds). Cheap enough to call on those events.
export function refreshPointsFlyTarget() {
  measureTarget();
}

// Projects a world position into stage-local pixels. Returns null when the
// point is behind the camera -- z > 1 in NDC -- which can happen for a coin
// collected right at the player's own plane.
function worldToStage(worldX, worldY, worldZ, camera) {
  _projected.set(worldX, worldY, worldZ).project(camera);
  if (_projected.z > 1) return null;
  const w = stageEl.clientWidth;
  const h = stageEl.clientHeight;
  return {
    x: (_projected.x * 0.5 + 0.5) * w,
    y: (-_projected.y * 0.5 + 0.5) * h,
  };
}

// `variant` picks the styling (see style.css): 'enemy' reads hotter and bigger
// than 'coin', because a kill is worth 15x a common coin and the feedback
// should say so before the number is even read.
export function spawnPointsFly(worldX, worldY, worldZ, camera, value, variant) {
  // EVERY awarded point must reach the counter. The visible total is driven
  // purely by arrivals (systems/scoring.js), so any path that awards points
  // without launching a label has to credit them directly or the HUD silently
  // under-reports for the rest of the run. Both bail-outs below do that.
  if (!hudEl) {
    if (onArrive) onArrive(value);
    return;
  }
  const at = worldToStage(worldX, worldY, worldZ, camera);
  if (!at) {
    if (onArrive) onArrive(value);
    return;
  }

  // Oldest-in-flight is recycled rather than dropping the new one: a dropped
  // label would mean points that silently never arrive (creditDisplayed is
  // driven from arrivals), so every spawned label MUST eventually land.
  let slot = labels.find((l) => !l.active);
  if (!slot) {
    slot = labels.reduce((a, b) => (a.t > b.t ? a : b));
    if (!slot.credited && onArrive) onArrive(slot.value); // settle the one being evicted
  }

  slot.active = true;
  slot.credited = false;
  slot.t = 0;
  slot.x0 = at.x;
  slot.y0 = at.y;
  slot.value = value;
  slot.el.textContent = `+${value}`;
  slot.el.className = `points-fly points-fly--${variant}`;
  slot.el.style.display = 'block';
  slot.el.style.transform = `translate3d(${at.x}px, ${at.y}px, 0) translate(-50%, -50%) scale(0.4)`;
  slot.el.style.opacity = '0';
}

export function updatePointsFly(dt) {
  const popEnd = POINTS_FLY_POP_SEC;
  const holdEnd = popEnd + POINTS_FLY_HOLD_SEC;
  const flyEnd = holdEnd + POINTS_FLY_TRAVEL_SEC;

  for (const l of labels) {
    if (!l.active) continue;
    l.t += dt;

    let x;
    let y;
    let scale;
    let opacity = 1;

    if (l.t < popEnd) {
      // Overshoot then settle -- a plain fade-in doesn't catch the eye at the
      // edge of vision, which is where a lane kill usually happens.
      const p = l.t / popEnd;
      scale = 0.4 + 0.85 * p + 0.25 * Math.sin(p * Math.PI);
      x = l.x0;
      y = l.y0 - POINTS_FLY_RISE_PX * p;
      opacity = Math.min(1, p * 3);
    } else if (l.t < holdEnd) {
      scale = 1;
      x = l.x0;
      y = l.y0 - POINTS_FLY_RISE_PX;
    } else if (l.t < flyEnd) {
      // Ease-IN on the travel: it leaves slowly enough that the eye can follow
      // it off the mark, then accelerates into the counter. Matches the coin
      // magnet's acceleration curve, so "things being drawn in" moves the same
      // way everywhere in this game.
      const p = (l.t - holdEnd) / POINTS_FLY_TRAVEL_SEC;
      const e = p * p;
      const sx = l.x0;
      const sy = l.y0 - POINTS_FLY_RISE_PX;
      x = sx + (targetX - sx) * e;
      y = sy + (targetY - sy) * e;
      scale = 1 + (POINTS_FLY_END_SCALE - 1) * e;
      opacity = 1 - 0.25 * e;
    } else {
      // Landed. Credit exactly once, then retire the slot.
      if (!l.credited) {
        l.credited = true;
        if (onArrive) onArrive(l.value);
      }
      l.active = false;
      l.el.style.display = 'none';
      continue;
    }

    // translate(-50%,-50%) centres the label on the point EXACTLY, whatever
    // its rendered width -- a fixed negative margin would mis-centre "+15"
    // against "+1". scale() last so it grows about the label's own middle.
    l.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`;
    l.el.style.opacity = `${opacity}`;
  }
}

// Run ended: stop everything on screen. Any uncredited label is settled by
// systems/scoring.js's settleScore instead, so nothing is lost.
export function clearPointsFly() {
  for (const l of labels) {
    l.active = false;
    l.credited = true;
    l.el.style.display = 'none';
  }
}
