// DONNIE'S POPUP: a small Donnie speech bubble in the bottom-left for a few seconds.
// DONNIE'S BOX ARROW (Elad, 25 Nov): an arrow beside Raphael pointing at the box whenever there is one and it is NOT close -- off screen,
// or near the edge of the screen. It goes away when the box is comfortably in view.
import * as THREE from 'three';
import { PX } from '../render/units.js';

export function createMachineUi(camera) {
  const pop = document.getElementById('donnie-pop');
  let lastId = -1;
  if (pop) pop.innerHTML = `<div class="face"><img src="tex/donnie_head.png" alt=""></div><div class="say"><b></b><span></span></div>`;

  const arrow = document.createElement('div');
  arrow.id = 'box-arrow'; arrow.className = 'hidden';
  // A CHUBBY ARROW: one rounded block shape, the same line width all the way round, a half-transparent fill, and a gentle nudge
  // along the way it points. (.dir is turned to face the box; the nudge is on the svg inside it so the two never fight.)
  arrow.innerHTML = '<div class="dir"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 14h15V7l15 13-15 13v-7H5z" fill="#c58cff" fill-opacity=".5" stroke="#14210f" stroke-width="3.5" stroke-linejoin="round"/></svg></div>';
  document.body.appendChild(arrow);
  const A = new THREE.Vector3(), B = new THREE.Vector3();
  let shown = false;
  const EDGE = 0.14;           // "close to the edge": within this share of the screen's width/height from a side

  function pointAtBox(w) {
    const box = w.mach && w.mach.box && w.mach.box.alive ? w.mach.box : null;
    if (!box || w.dead) { if (shown) { arrow.classList.add('hidden'); shown = false; } return; }
    const W = innerWidth, H = innerHeight;
    B.set(box.x / PX, 0.6, box.y / PX).project(camera);
    const bx = (B.x * 0.5 + 0.5) * W, by = (-B.y * 0.5 + 0.5) * H;
    const inView = B.z < 1 && bx > W * EDGE && bx < W * (1 - EDGE) && by > H * EDGE && by < H * (1 - EDGE);
    if (inView) { if (shown) { arrow.classList.add('hidden'); shown = false; } return; }
    A.set(w.player.x / PX, 0.9, w.player.y / PX).project(camera);
    const px = (A.x * 0.5 + 0.5) * W, py = (-A.y * 0.5 + 0.5) * H;
    let dx = bx - px, dy = by - py;
    if (B.z >= 1) { dx = -dx; dy = -dy; }          // behind the camera: the projection is mirrored
    const ang = Math.atan2(dy, dx), r = 136;
    arrow.style.transform = `translate(${(px + Math.cos(ang) * r).toFixed(1)}px, ${(py + Math.sin(ang) * r).toFixed(1)}px) translate(-50%, -50%)`;
    arrow.firstChild.style.transform = `rotate(${ang.toFixed(3)}rad)`;
    if (!shown) { arrow.classList.remove('hidden'); shown = true; }
  }

  function sync(w) {
    pointAtBox(w);
    const m = w.mach;
    if (pop) {
      const p = m && m.popup;
      if (p && p.id !== lastId) {
        lastId = p.id;
        pop.querySelector('b').textContent = p.title; pop.querySelector('span').textContent = p.text;
        pop.classList.remove('hidden'); pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
      }
      if (!p) pop.classList.add('hidden');
    }
  }
  return { sync };
}
