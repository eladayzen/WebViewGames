// THE FINISH LINE -- the first thing on this course that has an end.
//
// Not a prop. Props are spawned procedurally by pattern as the road unrolls and
// recycled behind the rider; the finish line is a single object at one known
// distance that must exist from the moment the race starts, because a goal you
// cannot see coming is not a goal. So it owns itself: place it, and it sits
// there until the mode takes it away.
//
// It is deliberately BIG and deliberately not in any other object's colour. The
// launchers are violet, the grindables green, the gates cyan and gold, the
// crystals amber. A finish line the player mistakes for scenery at 200 m is
// worse than none at all, so this is chequered white on the one hue nothing else
// uses, and it spans the full ridable width rather than sitting on the line.

import * as THREE from 'three';
import { toWorld, surfaceUp, frameAt, makeFrame } from '../world/trough.js';

export function createFinishLine(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const _pos = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _basis = new THREE.Matrix4();
  const _frame = makeFrame();

  const WIDTH = 22;
  const HEIGHT = 7;

  const white = new THREE.MeshBasicMaterial({ color: 0xfff6e8, side: THREE.DoubleSide });
  const dark = new THREE.MeshBasicMaterial({ color: 0x1b1330, side: THREE.DoubleSide });

  // Two towers and a banner across the top.
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, HEIGHT, 0.6), white);
    post.position.set(side * WIDTH * 0.5, HEIGHT / 2, 0);
    group.add(post);
  }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(WIDTH + 0.6, 1.6, 0.35), dark);
  banner.position.y = HEIGHT - 0.8;
  group.add(banner);

  // Chequers along the banner. Built as individual quads rather than a texture
  // so there is no asset to load and no filtering to go soft at distance --
  // this has to read as "finish" from as far away as it is visible.
  const cell = (WIDTH + 0.6) / 16;
  for (let i = 0; i < 16; i++) {
    for (let row = 0; row < 2; row++) {
      if ((i + row) % 2 === 0) continue;
      const q = new THREE.Mesh(new THREE.PlaneGeometry(cell, 0.8), white);
      // On the APPROACH side (-Z, since local +Z is the direction of travel).
      // At +0.2 they sat behind the banner from where the rider actually looks,
      // and the banner occluded every one of them -- the finish read as a plain
      // dark bar.
      q.position.set(-(WIDTH + 0.6) / 2 + cell * (i + 0.5), HEIGHT - 0.4 - row * 0.8, -0.25);
      group.add(q);
    }
  }

  // A chequered strip on the road itself, so the exact crossing point is
  // unambiguous once you are on top of it and the banner is overhead.
  for (let i = 0; i < 16; i++) {
    if (i % 2 === 0) continue;
    const q = new THREE.Mesh(new THREE.PlaneGeometry(cell, 1.6), white);
    q.rotation.x = -Math.PI / 2;
    q.position.set(-(WIDTH + 0.6) / 2 + cell * (i + 0.5), 0.03, 0);
    group.add(q);
  }

  return {
    /** Put it at a distance along the course and show it. */
    place(s) {
      toWorld(s, 0, _pos);
      surfaceUp(s, 0, _up);
      const f = frameAt(s, _frame);
      _fwd.copy(f.tangent);
      _right.crossVectors(_up, _fwd).normalize();
      _basis.makeBasis(_right, _up, _fwd);
      group.position.copy(_pos);
      group.quaternion.setFromRotationMatrix(_basis);
      group.visible = true;
    },

    hide() {
      group.visible = false;
    },
  };
}
